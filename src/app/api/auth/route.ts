import { cookies } from "next/headers";
import { randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import { currentAccount, rememberAccount, type Account } from "@/lib/account";
import { changeDocument } from "@/lib/documents";
import { accountId, matches, sign } from "@/lib/security";
import { emailConfigured, emailLayout, sendEmail } from "@/lib/email";
import { sameOrigin } from "@/lib/request";
export const maxDuration = 60;
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
export async function GET() {
  const account = await currentAccount();
  return json({
    account: account ? { email: account.email } : null,
    configured: emailConfigured(),
  });
}
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("request"),
    email: z.string().trim().email().max(254),
  }),
  z.object({
    action: z.literal("verify"),
    email: z.string().trim().email().max(254),
    code: z.string().regex(/^\d{6}$/),
    requestId: z.string().uuid(),
  }),
  z.object({ action: z.literal("logout") }),
]);
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return json({ error: "Invalid request origin" }, 403);
  try {
    const raw = await request.text();
    if (raw.length > 2000) return json({ error: "Invalid request" }, 400);
    const parsed = schema.safeParse(JSON.parse(raw));
    if (!parsed.success)
      return json({ error: "Please check your email and code." }, 400);
    const data = parsed.data;
    if (data.action === "logout") {
      (await cookies()).delete("loops_account");
      (await cookies()).delete("loops_session");
      return json({ ok: true });
    }
    if (!emailConfigured())
      return json(
        {
          error:
            "Email sign-in is waiting for the site owner to connect a verified sender. Existing personal access links still work.",
        },
        503,
      );
    const email = data.email.toLowerCase();
    const id = accountId(email);
    const initial = (): Account => ({ id, email, groups: [], verified: false });
    if (data.action === "request") {
      const ip =
        request.headers.get("x-vercel-forwarded-for")?.split(",")[0] ||
        request.headers.get("x-forwarded-for")?.split(",")[0] ||
        "local";
      const rateId = `rate-${Buffer.from(sign(`ip:${ip}`))
        .toString("hex")
        .slice(0, 64)}`;
      const { result: allowed } = await changeDocument(
        rateId,
        () => ({ window: Date.now(), count: 0 }),
        (value) => {
          if (Date.now() - value.window > 3600000) {
            value.window = Date.now();
            value.count = 0;
          }
          if (value.count >= 15) return false;
          value.count++;
          return true;
        },
      );
      if (!allowed)
        return json(
          { error: "Too many sign-in attempts. Please try again in an hour." },
          429,
        );
      const code = String(randomInt(100000, 1000000));
      const requestId = randomUUID();
      const { result: accepted } = await changeDocument<Account, boolean>(
        id,
        initial,
        (value) => {
          if (Date.now() - (value.window || 0) > 3600000) {
            value.window = Date.now();
            value.sends = 0;
          }
          if (
            (value.sends || 0) >= 5 ||
            Date.now() - (value.sentAt || 0) < 60000
          )
            return false;
          value.sends = (value.sends || 0) + 1;
          value.sentAt = Date.now();
          value.challenge = {
            hash: sign(`code:${id}:${requestId}:${code}`),
            expires: Date.now() + 10 * 60000,
            failures: 0,
            requestId,
          };
          return true;
        },
      );
      if (!accepted)
        return json(
          {
            error:
              "Please wait before requesting another code. You can request up to five per hour.",
          },
          429,
        );
      try {
        await sendEmail(
          {
            to: email,
            subject: `${code} is your Loops sign-in code`,
            html: emailLayout(
              "Welcome back to your people.",
              `<p>Your sign-in code is:</p><p style="font:bold 36px monospace;letter-spacing:8px">${code}</p><p>It expires in 10 minutes. If you didn’t request it, you can ignore this email.</p>`,
            ),
            text: `Your Loops sign-in code is ${code}. It expires in 10 minutes. If you didn't request it, ignore this email.`,
          },
          `login-${requestId}`,
        );
      } catch {
        return json(
          {
            error:
              "We couldn’t send your code. Please try again in a minute or contact the loop owner.",
          },
          503,
        );
      }
      return json({ ok: true, requestId });
    }
    const { result: verified } = await changeDocument<Account, boolean>(
      id,
      initial,
      (value) => {
        const c = value.challenge;
        if (
          !c ||
          c.requestId !== data.requestId ||
          c.expires < Date.now() ||
          c.failures >= 5
        )
          return false;
        c.failures++;
        if (!matches(c.hash, sign(`code:${id}:${data.requestId}:${data.code}`)))
          return false;
        delete value.challenge;
        value.verified = true;
        return true;
      },
    );
    if (!verified)
      return json(
        {
          error:
            "That code is invalid or expired. Request a new one after five attempts.",
        },
        400,
      );
    await rememberAccount(id);
    return json({ ok: true });
  } catch {
    return json(
      { error: "Sign-in is temporarily unavailable. Please try again." },
      503,
    );
  }
}

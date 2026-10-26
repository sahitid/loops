import { sameOrigin } from "@/lib/request";
import { head } from "@vercel/blob";
import { NextRequest, after } from "next/server";
import { z } from "zod";
import { createLoop, readLoop, updateLoop } from "@/lib/storage";
import { equal, hash, memberFor, remember, secret, sessions } from "@/lib/auth";
import { defaultQuestions, nextDelivery, type Loop } from "@/lib/model";
import { currentAccount, addGroup } from "@/lib/account";
import {
  dispatchEmails,
  presentLoop as publicLoop,
  publishAndQueue,
  queueForms,
  queueInvitation,
} from "@/lib/mail-queue";
import { emailConfigured } from "@/lib/email";
export const runtime = "nodejs";
export const maxDuration = 300;
const text = (max: number) => z.string().trim().min(1).max(max);
const id = z.string().uuid();
const question = z.object({ id: text(60), text: text(300) });
const command = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    name: text(60),
    description: z.string().trim().max(240),
    memberName: text(40),
    frequency: z.union([z.literal(7), z.literal(14), z.literal(30)]),
    color: z.enum(["peach", "sage", "lavender", "butter"]),
    emailsEnabled: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("join"),
    id,
    key: text(60),
    name: text(40),
    emailsEnabled: z.boolean().optional(),
  }),
  z.object({ action: z.literal("connect-email"), id, enabled: z.boolean() }),
  z.object({
    action: z.literal("email-preferences"),
    id,
    enabled: z.boolean(),
  }),
  z.object({
    action: z.literal("invite-email"),
    id,
    email: z.string().trim().email().max(254),
  }),
  z.object({ action: z.literal("restore"), id, key: text(60) }),
  z.object({
    action: z.literal("reply"),
    id,
    issueId: id,
    values: z.record(z.string().max(60), z.string().max(6000)),
    submitted: z.boolean(),
    story: z.string().max(20000).optional(),
  }),
  z.object({
    action: z.literal("attach"),
    id,
    issueId: id,
    pathname: z.string().max(300),
    name: text(120),
  }),
  z.object({ action: z.literal("remove-media"), id, issueId: id, mediaId: id }),
  z.object({
    action: z.literal("questions"),
    id,
    issueId: id,
    questions: z.array(question).min(1).max(6),
  }),
  z.object({ action: z.literal("publish"), id, issueId: id }),
  z.object({
    action: z.literal("settings"),
    id,
    name: text(60),
    description: z.string().trim().max(240),
    frequency: z.union([z.literal(7), z.literal(14), z.literal(30)]),
    paused: z.boolean(),
  }),
  z.object({ action: z.literal("rotate-invite"), id }),
]);
function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export async function GET(req: NextRequest) {
  try {
    const target = req.nextUrl.searchParams.get("id");
    if (target) {
      if (!id.safeParse(target).success)
        return json({ error: "Invalid loop" }, 400);
      const saved = await readLoop(target);
      const me = saved && (await memberFor(saved.loop));
      if (!saved || !me)
        return json(
          {
            error:
              "Sign in with the email you used to join, or open your personal access link.",
          },
          401,
        );
      return json({
        loop: publicLoop(saved.loop, me),
        accessKey: (await sessions())[target],
      });
    }
    const account = await currentAccount();
    const ids = [
      ...new Set([
        ...Object.keys(await sessions()),
        ...(account?.groups || []),
      ]),
    ];
    const result = await Promise.all(
      ids.map(async (key) => {
        const saved = await readLoop(key);
        const me = saved && (await memberFor(saved.loop));
        return saved && me ? publicLoop(saved.loop, me) : null;
      }),
    );
    return json({ loops: result.filter(Boolean) });
  } catch (e) {
    console.error("Loop read failed", e instanceof Error ? e.name : "Unknown");
    return json(
      { error: "We couldn’t load your loops. Please try again." },
      503,
    );
  }
}
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ error: "Invalid request origin" }, 403);
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    return json({ error: "JSON required" }, 415);
  try {
    const raw = await req.text();
    if (raw.length > 50000)
      return json({ error: "Your reply is too long." }, 413);
    const parsed = command.safeParse(JSON.parse(raw));
    if (!parsed.success)
      return json(
        { error: "Please check the form fields and try again." },
        400,
      );
    const data = parsed.data;
    const account = await currentAccount();
    if (data.action === "create") {
      if (
        (account?.groups.length || Object.keys(await sessions()).length) >= 15
      )
        return json({ error: "This browser can keep up to 15 loops." }, 400);
      const token = secret();
      const member = {
        id: crypto.randomUUID(),
        name: data.memberName,
        role: "owner" as const,
        tokenHash: hash(token),
        ...(account
          ? {
              accountId: account.id,
              email: account.email,
              emailsEnabled: data.emailsEnabled ?? false,
            }
          : {}),
      };
      const loop: Loop = {
        id: crypto.randomUUID(),
        name: data.name,
        description: data.description,
        color: data.color,
        frequency: data.frequency,
        nextDelivery: nextDelivery(data.frequency),
        paused: false,
        createdAt: new Date().toISOString(),
        inviteKey: secret(),
        members: [member],
        current: {
          id: crypto.randomUUID(),
          number: 1,
          questions: defaultQuestions(),
          replies: {},
        },
        issues: [],
      };
      queueForms(loop);
      if (account) await addGroup(account, loop.id);
      await createLoop(loop);
      await remember(loop.id, token);
      after(async () => {
        await dispatchEmails(loop.id, Date.now() + 240000);
      });
      return json({ loop: publicLoop(loop, member), accessKey: token }, 201);
    }
    const saved = await readLoop(data.id);
    if (!saved) return json({ error: "This loop couldn’t be found." }, 404);
    if (data.action === "restore") {
      const member = saved.loop.members.find((m) =>
        equal(m.tokenHash, hash(data.key)),
      );
      if (!member) return json({ error: "That access link is invalid." }, 403);
      await remember(data.id, data.key);
      return json({ loop: publicLoop(saved.loop, member) });
    }
    if (data.action === "join") {
      if (!equal(saved.loop.inviteKey, data.key))
        return json(
          {
            error:
              "That invitation has expired. Ask the owner for a fresh link.",
          },
          403,
        );
      const existing = await memberFor(saved.loop);
      if (existing) return json({ loop: publicLoop(saved.loop, existing) });
      const token = secret();
      const member = {
        id: crypto.randomUUID(),
        name: data.name,
        role: "member" as const,
        tokenHash: hash(token),
        ...(account
          ? {
              accountId: account.id,
              email: account.email,
              emailsEnabled: data.emailsEnabled ?? false,
            }
          : {}),
      };
      if (account) await addGroup(account, data.id);
      const updated = await updateLoop(data.id, (loop) => {
        if (!equal(loop.inviteKey, data.key))
          throw new Error("That invitation has expired.");
        if (loop.members.length >= 30)
          throw new Error("This loop has reached its 30-person limit.");
        if (account && loop.members.some((m) => m.accountId === account.id))
          return;
        loop.members.push(member);
        queueForms(loop);
      });
      const joined = account
        ? updated.loop.members.find((m) => m.accountId === account.id)!
        : member;
      if (joined.id === member.id) await remember(data.id, token);
      after(async () => {
        await dispatchEmails(data.id, Date.now() + 240000);
      });
      return json({
        loop: publicLoop(updated.loop, joined),
        accessKey: joined.id === member.id ? token : undefined,
      });
    }
    const me = await memberFor(saved.loop);
    if (!me)
      return json(
        { error: "Use your personal access link to open this loop." },
        401,
      );
    if (
      ![
        "reply",
        "attach",
        "remove-media",
        "connect-email",
        "email-preferences",
      ].includes(data.action) &&
      me.role !== "owner"
    )
      return json({ error: "Only the loop owner can make this change." }, 403);
    if (data.action === "connect-email") {
      if (!account)
        return json({ error: "Sign in with your email first." }, 401);
      await addGroup(account, data.id);
    }
    if (data.action === "invite-email" && (!account || !emailConfigured()))
      return json(
        {
          error:
            "Email invitations require a verified sender and email sign-in. You can still share the invitation link.",
        },
        503,
      );
    let attachment:
      | {
          id: string;
          pathname: string;
          name: string;
          type: string;
          size: number;
        }
      | undefined;
    if (data.action === "attach") {
      const prefix = `media/${data.id}/${data.issueId}/${me.id}/`;
      if (
        !data.pathname.startsWith(prefix) ||
        !/^[a-zA-Z0-9./_-]+$/.test(data.pathname) ||
        data.pathname.includes("..")
      )
        return json({ error: "Invalid attachment" }, 400);
      const blob = await head(data.pathname);
      if (
        !/^(image\/(jpeg|png|webp|gif|avif)|video\/(mp4|webm|quicktime)|audio\/(webm|mp4|mpeg|wav|ogg))$/.test(
          blob.contentType,
        ) ||
        blob.size > 100 * 1024 * 1024
      )
        return json({ error: "Unsupported attachment" }, 400);
      attachment = {
        id: crypto.randomUUID(),
        pathname: data.pathname,
        name: data.name,
        type: blob.contentType,
        size: blob.size,
      };
    }
    const updated = await updateLoop(data.id, (loop) => {
      if ("issueId" in data && loop.current.id !== data.issueId)
        throw new Error(
          "A new issue has started. Refresh to see the latest questions.",
        );
      if (data.action === "reply") {
        const values = Object.fromEntries(
          loop.current.questions.map((q) => [
            q.id,
            (data.values[q.id] || "").trim(),
          ]),
        );
        if (
          data.submitted &&
          !Object.values(values).some(Boolean) &&
          !data.story?.trim() &&
          !loop.current.replies[me.id]?.media?.length
        )
          throw new Error("Answer at least one question before submitting.");
        loop.current.replies[me.id] = {
          ...loop.current.replies[me.id],
          story: data.story?.trim() || "",
          values,
          submitted: data.submitted,
          updatedAt: new Date().toISOString(),
        };
      }
      if (data.action === "attach" && attachment) {
        const reply = loop.current.replies[me.id] || {
          values: {},
          submitted: false,
          updatedAt: new Date().toISOString(),
        };
        if ((reply.media?.length || 0) >= 30)
          throw new Error(
            "This loop allows up to 30 attachments per person in each issue.",
          );
        if (!reply.media?.some((m) => m.pathname === attachment!.pathname))
          reply.media = [...(reply.media || []), attachment];
        reply.submitted = false;
        loop.current.replies[me.id] = reply;
      }
      if (data.action === "remove-media") {
        const reply = loop.current.replies[me.id];
        if (reply) {
          reply.media = reply.media?.filter((m) => m.id !== data.mediaId);
          reply.submitted = false;
        }
      }
      if (data.action === "questions") {
        if (
          Object.values(loop.current.replies).some(
            (r) =>
              r.story?.trim() ||
              r.media?.length ||
              Object.values(r.values).some((v) => v.trim()),
          )
        )
          throw new Error("Questions are locked once someone starts writing.");
        if (
          new Set(data.questions.map((q) => q.id)).size !==
          data.questions.length
        )
          throw new Error("Question IDs must be unique.");
        loop.current.questions = data.questions;
      }
      if (data.action === "publish" && !publishAndQueue(loop))
        throw new Error("At least one submitted reply is needed to publish.");
      if (data.action === "settings") {
        if (loop.frequency !== data.frequency)
          loop.nextDelivery = nextDelivery(data.frequency);
        loop.name = data.name;
        loop.description = data.description;
        loop.frequency = data.frequency;
        loop.paused = data.paused;
        queueForms(loop);
      }
      if (data.action === "connect-email" && account) {
        if (
          loop.members.some((m) => m.accountId === account.id && m.id !== me.id)
        )
          throw new Error("This loop already has a member using this email.");
        const member = loop.members.find((m) => m.id === me.id)!;
        if (member.accountId && member.accountId !== account.id)
          throw new Error(
            "This loop membership is already connected to another email.",
          );
        member.accountId = account.id;
        member.email = account.email;
        member.emailsEnabled = data.enabled;
        queueForms(loop);
      }
      if (data.action === "email-preferences") {
        const member = loop.members.find((m) => m.id === me.id)!;
        if (!member.email)
          throw new Error("This loop membership needs a verified email first.");
        member.emailsEnabled = data.enabled;
        queueForms(loop);
      }
      if (data.action === "invite-email")
        queueInvitation(loop, data.email.toLowerCase(), me);
      if (data.action === "rotate-invite") loop.inviteKey = secret();
    });
    if (
      [
        "publish",
        "invite-email",
        "settings",
        "connect-email",
        "email-preferences",
      ].includes(data.action)
    )
      after(async () => {
        await dispatchEmails(data.id, Date.now() + 240000);
      });
    return json({
      loop: publicLoop(
        updated.loop,
        updated.loop.members.find((m) => m.id === me.id)!,
      ),
    });
  } catch (e) {
    if (e instanceof SyntaxError)
      return json({ error: "Invalid request" }, 400);
    const message = e instanceof Error ? e.message : "";
    const expected =
      /^(A new issue|Answer at least|Questions are locked|Question IDs|At least one|That invitation|This loop)/.test(
        message,
      );
    if (!expected)
      console.error(
        "Loop write failed",
        e instanceof Error ? e.name : "Unknown",
        process.env.NODE_ENV === "development"
          ? message.replaceAll(
              process.env.BLOB_READ_WRITE_TOKEN || "NEVER",
              "[redacted]",
            )
          : "",
      );
    return json(
      {
        error: expected ? message : "We couldn’t save that. Please try again.",
      },
      expected ? 409 : 503,
    );
  }
}

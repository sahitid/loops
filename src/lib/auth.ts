import { cookies } from "next/headers";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Loop } from "./model";
export const secret = () => randomBytes(32).toString("base64url");
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export function equal(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export async function sessions(): Promise<Record<string, string>> {
  try {
    const value = JSON.parse(
      (await cookies()).get("loops_session")?.value || "{}",
    );
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter(
        ([id, token]) =>
          /^[a-zA-Z0-9-]{1,90}$/.test(id) &&
          typeof token === "string" &&
          token.length === 43,
      ),
    ) as Record<string, string>;
  } catch {
    return {};
  }
}
export async function remember(id: string, token: string) {
  const current = await sessions();
  delete current[id];
  current[id] = token;
  (await cookies()).set(
    "loops_session",
    JSON.stringify(Object.fromEntries(Object.entries(current).slice(-15))),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    },
  );
}
export async function memberFor(loop: Loop) {
  const token = (await sessions())[loop.id];
  return token
    ? loop.members.find((m) => equal(m.tokenHash, hash(token)))
    : undefined;
}

import { createHmac, timingSafeEqual } from "node:crypto";
export function sign(value: string) {
  const key = process.env.AUTH_SECRET;
  if (!key || key.length < 32)
    throw new Error("Email sign-in is not configured");
  return createHmac("sha256", key).update(value).digest("base64url");
}
export function matches(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function seal(payload: Record<string, unknown>) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}
export function unseal<T>(token: string, purpose: string): T | null {
  try {
    const [body, signature, extra] = token.split(".");
    if (extra || !body || !signature || !matches(sign(body), signature))
      return null;
    const value = JSON.parse(Buffer.from(body, "base64url").toString());
    if (
      value.purpose !== purpose ||
      !Number.isFinite(value.exp) ||
      value.exp < Date.now()
    )
      return null;
    return value as T;
  } catch {
    return null;
  }
}
export const accountId = (email: string) =>
  `user-${sign(`email:${email.trim().toLowerCase()}`).toLowerCase().replace(/_/g, "-")}`;
export function safeNext(value: string | null) {
  return value &&
    /^\/(app|new|loop\/[a-f0-9-]{36}|join\/[a-f0-9-]{36})([?#].*)?$/.test(value)
    ? value
    : "/app";
}

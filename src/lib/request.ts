export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const incoming = new URL(origin);
    const host = request.headers.get("host") || new URL(request.url).host;
    const protocol =
      request.headers.get("x-forwarded-proto") ||
      new URL(request.url).protocol.slice(0, -1);
    return incoming.host === host && incoming.protocol === `${protocol}:`;
  } catch {
    return false;
  }
}

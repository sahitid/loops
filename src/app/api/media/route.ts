import { get } from "@vercel/blob";
import { memberFor } from "@/lib/auth";
import { readLoop } from "@/lib/storage";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("loop");
  const mediaId = url.searchParams.get("media");
  if (!id || !mediaId || !/^[a-f0-9-]{36}$/.test(id))
    return new Response("Not found", { status: 404 });
  try {
    const saved = await readLoop(id);
    const me = saved && (await memberFor(saved.loop));
    if (!saved || !me) return new Response("Unauthorized", { status: 401 });
    const visible = [
      saved.loop.current.replies[me.id],
      ...saved.loop.issues.flatMap((i) => Object.values(i.replies)),
    ].filter(Boolean);
    const media = visible
      .flatMap((r) => r.media || [])
      .find((m) => m.id === mediaId);
    if (!media) return new Response("Not found", { status: 404 });
    const result = await get(media.pathname, {
      access: "private",
      useCache: false,
      headers: request.headers.has("range")
        ? { Range: request.headers.get("range")! }
        : undefined,
    });
    if (!result || result.statusCode !== 200)
      return new Response("Not found", { status: 404 });
    const headers = new Headers({
      "Content-Type": media.type,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    });
    for (const h of ["content-range", "content-length", "accept-ranges"]) {
      const v = result.headers.get(h);
      if (v) headers.set(h, v);
    }
    return new Response(result.stream, {
      status: result.headers.has("content-range") ? 206 : 200,
      headers,
    });
  } catch {
    return new Response("Could not load media", { status: 503 });
  }
}

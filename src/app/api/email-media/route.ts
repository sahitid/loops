import { get } from "@vercel/blob";
import { unseal } from "@/lib/security";
import { readLoop } from "@/lib/storage";
export async function GET(request: Request) {
  const access = unseal<{ loop: string; issue: string; media: string }>(
    new URL(request.url).searchParams.get("token") || "",
    "email-media",
  );
  if (!access) return new Response("Image link expired", { status: 403 });
  try {
    const saved = await readLoop(access.loop);
    const issue = saved?.loop.issues.find((i) => i.id === access.issue);
    const media =
      issue &&
      Object.values(issue.replies)
        .flatMap((r) => r.media || [])
        .find((m) => m.id === access.media && m.type.startsWith("image/"));
    if (!media) return new Response("Not found", { status: 404 });
    const result = await get(media.pathname, {
      access: "private",
      useCache: false,
    });
    if (!result || result.statusCode !== 200)
      return new Response("Not found", { status: 404 });
    return new Response(result.stream, {
      headers: {
        "Content-Type": media.type,
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Image unavailable", { status: 503 });
  }
}

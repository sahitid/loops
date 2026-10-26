import { sameOrigin } from "@/lib/request";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { memberFor } from "@/lib/auth";
import { readLoop } from "@/lib/storage";
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as HandleUploadBody;
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        if (!sameOrigin(request)) throw new Error("Invalid origin");
        const parts = pathname.split("/");
        if (
          parts.length !== 5 ||
          parts[0] !== "media" ||
          !parts.slice(1).every((s) => /^[a-zA-Z0-9._-]{1,80}$/.test(s))
        )
          throw new Error("Invalid file path");
        const saved = await readLoop(parts[1]);
        const me = saved && (await memberFor(saved.loop));
        if (
          !me ||
          !saved ||
          me.id !== parts[3] ||
          saved.loop.current.id !== parts[2]
        )
          throw new Error("Please reopen your loop to upload.");
        if ((saved.loop.current.replies[me.id]?.media?.length || 0) >= 30)
          throw new Error("You can add up to 30 photos and videos per issue.");
        return {
          allowedContentTypes: [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
            "image/avif",
            "video/mp4",
            "video/webm",
            "video/quicktime",
            "audio/webm",
            "audio/mp4",
            "audio/mpeg",
            "audio/wav",
            "audio/ogg",
          ],
          maximumSizeInBytes: 100 * 1024 * 1024,
          addRandomSuffix: true,
          allowOverwrite: false,
          validUntil: Date.now() + 15 * 60 * 1000,
        };
      },
    });
    return Response.json(result);
  } catch {
    return Response.json(
      {
        error:
          "Upload unavailable. Check your membership and file limits, then try again.",
      },
      { status: 400 },
    );
  }
}

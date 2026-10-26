"use client";
import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { ImagePlus, X } from "lucide-react";
import { demoAssets } from "@/lib/demo";
import type { Media, PublicLoop } from "@/lib/model";
import { request, Notice } from "./ui";
export function MediaGrid({
  media,
  loopId,
  onRemove,
}: {
  media: Media[];
  loopId: string;
  onRemove?: (id: string) => void;
}) {
  return (
    <div className="media-grid">
      {media.map((m) => (
        <figure className="media-item" key={m.id}>
          {m.type.startsWith("image/") ? (
            <img
              src={
                loopId === "demo" && demoAssets[m.id]
                  ? demoAssets[m.id]
                  : `/api/media?loop=${loopId}&media=${m.id}`
              }
              alt={m.name}
              loading="lazy"
            />
          ) : m.type.startsWith("video/") ? (
            <video
              controls
              preload="metadata"
              playsInline
              src={
                loopId === "demo" && demoAssets[m.id]
                  ? demoAssets[m.id]
                  : `/api/media?loop=${loopId}&media=${m.id}`
              }
            />
          ) : (
            <audio
              controls
              preload="metadata"
              src={
                loopId === "demo" && demoAssets[m.id]
                  ? demoAssets[m.id]
                  : `/api/media?loop=${loopId}&media=${m.id}`
              }
            />
          )}
          <figcaption>{m.name}</figcaption>
          {onRemove && (
            <button
              aria-label={`Remove ${m.name}`}
              className="media-remove"
              onClick={() => onRemove(m.id)}
            >
              <X size={14} />
            </button>
          )}
        </figure>
      ))}
    </div>
  );
}
export async function uploadMedia(file: File, loop: PublicLoop) {
  if (file.size > 100 * 1024 * 1024)
    throw new Error(`${file.name} is larger than 100 MB.`);
  const extension = (file.name.split(".").pop() || "bin")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 10);
  const pathname = `media/${loop.id}/${loop.current.id}/${loop.me}/${crypto.randomUUID()}.${extension}`;
  const blob = await upload(pathname, file, {
    access: "private",
    handleUploadUrl: "/api/upload",
    contentType: file.type,
    multipart: file.size > 5 * 1024 * 1024,
  });
  return request({
    action: "attach",
    id: loop.id,
    issueId: loop.current.id,
    pathname: blob.pathname,
    name: file.name.slice(0, 120),
  });
}
export default function MediaUploader({
  loop,
  onUpdate,
  demo = false,
}: {
  loop: PublicLoop;
  onUpdate: (loop: PublicLoop) => void;
  demo?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const media = loop.current.replies[loop.me]?.media || [];
  return (
    <section className="upload-section">
      <div className="section-title">
        <div>
          <h3>Your camera roll has stories, too.</h3>
          <p>Add up to 30 photos, videos, and voice notes. 100 MB per file.</p>
        </div>
        <button
          className="button button-outline button-small"
          disabled={!!busy || media.length >= 30}
          onClick={() => input.current?.click()}
        >
          <ImagePlus size={18} />
          Add photos & videos
        </button>
      </div>
      <input
        ref={input}
        className="sr-only"
        aria-label="Select photos and videos"
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/webm,video/quicktime"
        onChange={async (e) => {
          const files = Array.from(e.target.files || []);
          e.target.value = "";
          setError("");
          if (demo) {
            setError("Create your own loop to upload your photos and videos.");
            return;
          }
          if (files.length + media.length > 30) {
            setError("Choose up to 30 files in total for this issue.");
            return;
          }
          const failures: string[] = [];
          for (let i = 0; i < files.length; i++) {
            setBusy(`Uploading ${i + 1} of ${files.length}…`);
            try {
              const r = await uploadMedia(files[i], loop);
              onUpdate(r.loop);
            } catch (e) {
              failures.push((e as Error).message);
            }
          }
          setBusy("");
          if (failures.length) setError(failures.join(" "));
        }}
      />
      {busy && (
        <p role="status" className="upload-progress">
          {busy} Keep this page open.
        </p>
      )}
      {error && <Notice>{error}</Notice>}
      {media.length ? (
        <MediaGrid
          media={media}
          loopId={loop.id}
          onRemove={async (mediaId) => {
            setError("");
            try {
              const r = await request({
                action: "remove-media",
                id: loop.id,
                issueId: loop.current.id,
                mediaId,
              });
              onUpdate(r.loop);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        />
      ) : (
        <button
          className="upload-empty"
          disabled={!!busy}
          onClick={() => input.current?.click()}
        >
          <ImagePlus size={27} />
          <span>The sunsets. The dinners. The blurry, happy bits.</span>
          <small>Select several photos and videos at once</small>
        </button>
      )}
    </section>
  );
}

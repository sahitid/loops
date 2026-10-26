import {
  get,
  put,
  list,
  BlobNotFoundError,
  BlobPreconditionFailedError,
} from "@vercel/blob";
import { mkdir, readFile, writeFile, rename, readdir } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { Loop } from "./model";

const cloud = () =>
  Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
const localPath = join(process.cwd(), ".data");
function path(id: string) {
  if (!/^[a-zA-Z0-9-]{1,90}$/.test(id)) throw new Error("Invalid ID");
  return `loops/${id}.json`;
}
export async function readLoop(
  id: string,
): Promise<{ loop: Loop; etag: string } | null> {
  const key = path(id);
  if (cloud()) {
    // Use an uncompressed representation so the ETag stays strong for conditional writes.
    try {
      const result = await get(key, {
        access: "private",
        useCache: false,
        headers: { "Accept-Encoding": "identity" },
      });
      if (!result || result.statusCode !== 200) return null;
      return {
        loop: await new Response(result.stream).json(),
        etag: result.blob.etag,
      };
    } catch (e) {
      if (e instanceof BlobNotFoundError) return null;
      throw e;
    }
  }
  if (process.env.VERCEL) throw new Error("Private storage is not configured.");
  try {
    const raw = await readFile(join(localPath, `${id}.json`), "utf8");
    return {
      loop: JSON.parse(raw),
      etag: createHash("sha256").update(raw).digest("hex"),
    };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}
export async function createLoop(loop: Loop) {
  if (cloud()) {
    await put(path(loop.id), JSON.stringify(loop), {
      access: "private",
      addRandomSuffix: false,
      contentType: "application/json",
    });
    return;
  }
  if (process.env.VERCEL) throw new Error("Private storage is not configured.");
  await mkdir(localPath, { recursive: true });
  await writeFile(join(localPath, `${loop.id}.json`), JSON.stringify(loop), {
    flag: "wx",
  });
}
// Serialize local writes; cloud writes use ETags and retry from the latest version.
const locks = new Map<string, Promise<unknown>>();
export async function updateLoop<T>(
  id: string,
  change: (loop: Loop) => T,
): Promise<{ loop: Loop; result: T }> {
  async function run() {
    for (let attempt = 0; attempt < 6; attempt++) {
      const saved = await readLoop(id);
      if (!saved) throw new Error("Loop not found");
      const result = change(saved.loop);
      try {
        if (cloud())
          await put(path(id), JSON.stringify(saved.loop), {
            access: "private",
            addRandomSuffix: false,
            allowOverwrite: true,
            ifMatch: saved.etag,
            contentType: "application/json",
          });
        else {
          const temp = join(localPath, `${id}.${crypto.randomUUID()}.tmp`);
          await writeFile(temp, JSON.stringify(saved.loop));
          await rename(temp, join(localPath, `${id}.json`));
        }
        return { loop: saved.loop, result };
      } catch (e) {
        if (!(e instanceof BlobPreconditionFailedError) || attempt === 5)
          throw e;
      }
    }
    throw new Error("This loop is busy. Please try again.");
  }
  const previous = locks.get(id) || Promise.resolve();
  const current = previous.catch(() => {}).then(run);
  locks.set(id, current);
  try {
    return await current;
  } finally {
    if (locks.get(id) === current) locks.delete(id);
  }
}
export async function allLoopIds(): Promise<string[]> {
  if (!cloud()) {
    if (process.env.VERCEL)
      throw new Error("Private storage is not configured.");
    try {
      return (await readdir(localPath))
        .filter((p) => p.endsWith(".json"))
        .map((p) => p.slice(0, -5));
    } catch {
      return [];
    }
  }
  const ids: string[] = [];
  let cursor: string | undefined;
  do {
    const batch = await list({ prefix: "loops/", limit: 1000, cursor });
    ids.push(...batch.blobs.map((b) => b.pathname.slice(6, -5)));
    cursor = batch.hasMore ? batch.cursor : undefined;
  } while (cursor);
  return ids;
}

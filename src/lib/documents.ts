import {
  get,
  put,
  BlobNotFoundError,
  BlobPreconditionFailedError,
} from "@vercel/blob";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";

const locks = new Map<string, Promise<unknown>>();
function key(id: string) {
  if (!/^[a-z0-9-]{1,100}$/.test(id)) throw new Error("Invalid document ID");
  return `accounts/${id}.json`;
}
const cloud = () =>
  Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
const folder = () => join(process.cwd(), ".data", "accounts");
export async function readDocument<T>(
  id: string,
): Promise<{ value: T; etag?: string } | null> {
  const pathname = key(id);
  if (cloud()) {
    try {
      const r = await get(pathname, {
        access: "private",
        useCache: false,
        headers: { "Accept-Encoding": "identity" },
      });
      return r?.statusCode === 200
        ? { value: await new Response(r.stream).json(), etag: r.blob.etag }
        : null;
    } catch (e) {
      if (e instanceof BlobNotFoundError) return null;
      throw e;
    }
  }
  if (process.env.VERCEL) throw new Error("Private storage is not configured");
  try {
    return {
      value: JSON.parse(await readFile(join(folder(), `${id}.json`), "utf8")),
    };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}
export async function changeDocument<T, R>(
  id: string,
  initial: () => T,
  change: (value: T) => R,
) {
  async function run() {
    for (let attempt = 0; attempt < 6; attempt++) {
      const previous = await readDocument<T>(id);
      const value = previous?.value ?? initial();
      const result = change(value);
      try {
        if (cloud())
          await put(key(id), JSON.stringify(value), {
            access: "private",
            addRandomSuffix: false,
            contentType: "application/json",
            allowOverwrite: Boolean(previous),
            ...(previous ? { ifMatch: previous.etag } : {}),
          });
        else {
          await mkdir(folder(), { recursive: true });
          const temp = join(folder(), `${id}.${crypto.randomUUID()}.tmp`);
          await writeFile(temp, JSON.stringify(value), { mode: 0o600 });
          await rename(temp, join(folder(), `${id}.json`));
        }
        return { value, result };
      } catch (e) {
        const raced = !previous && (await readDocument<T>(id));
        if (
          attempt === 5 ||
          (!(e instanceof BlobPreconditionFailedError) && !raced)
        )
          throw e;
      }
    }
    throw new Error("Please try again");
  }
  const current = (locks.get(id) || Promise.resolve())
    .catch(() => {})
    .then(run);
  locks.set(id, current);
  try {
    return await current;
  } finally {
    if (locks.get(id) === current) locks.delete(id);
  }
}

// Explicit local-test preload only. This file is never imported by the app.
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
const capture = process.env.LOOPS_TEST_MAIL_CAPTURE;
if (!capture || process.env.VERCEL)
  throw new Error("Local mail-capture path required; never run on Vercel");
mkdirSync(dirname(capture), { recursive: true });
const original = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  if (url === "https://api.resend.com/emails") {
    const mail = JSON.parse(init.body);
    const id = `local-test-${crypto.randomUUID()}`;
    appendFileSync(capture, JSON.stringify({ ...mail, id }) + "\n", {
      mode: 0o600,
    });
    return Response.json({ id });
  }
  return original(input, init);
};

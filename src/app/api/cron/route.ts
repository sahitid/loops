import { allLoopIds, updateLoop } from "@/lib/storage";
import { scheduleLoop, dispatchEmails } from "@/lib/mail-queue";
import { equal } from "@/lib/auth";
export const maxDuration = 300;
export async function GET(request: Request) {
  if (
    !process.env.CRON_SECRET ||
    !equal(
      request.headers.get("authorization") || "",
      `Bearer ${process.env.CRON_SECRET}`,
    )
  )
    return new Response("Unauthorized", { status: 401 });
  let published = 0,
    failed = 0,
    emailsSent = 0;
  const ids = await allLoopIds();
  const deadline = Date.now() + 260000;
  // Commit every due issue and its outbox before spending time on email delivery.
  for (const id of ids) {
    try {
      const { result } = await updateLoop(id, (loop) => scheduleLoop(loop));
      if (result) published++;
    } catch {
      failed++;
    }
  }
  for (const id of ids) {
    if (Date.now() > deadline - 16000) break;
    try {
      const result = await dispatchEmails(id, deadline);
      emailsSent += result.sent;
      failed += result.failed;
    } catch {
      failed++;
    }
  }
  return Response.json(
    { published, emailsSent, failed },
    { status: failed ? 500 : 200 },
  );
}

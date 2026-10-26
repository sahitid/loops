import { allLoopIds, readLoop, updateLoop } from "@/lib/storage";
import { publishIssue } from "@/lib/model";
import { equal } from "@/lib/auth";
export const maxDuration = 60;
export async function GET(request: Request) {
  if (
    !process.env.CRON_SECRET ||
    !equal(
      request.headers.get("authorization") || "",
      `Bearer ${process.env.CRON_SECRET}`,
    )
  )
    return new Response("Unauthorized", { status: 401 });
  let published = 0;
  let failed = 0;
  for (const id of await allLoopIds()) {
    try {
      const saved = await readLoop(id);
      if (
        !saved ||
        saved.loop.paused ||
        Date.parse(saved.loop.nextDelivery) > Date.now()
      )
        continue;
      const { result } = await updateLoop(id, (loop) => {
        if (loop.paused || Date.parse(loop.nextDelivery) > Date.now())
          return false;
        if (publishIssue(loop)) return true;
        loop.nextDelivery = new Date(
          Date.now() + loop.frequency * 86400000,
        ).toISOString();
        return false;
      });
      if (result) published++;
    } catch {
      failed++;
    }
  }
  return Response.json({ published, failed }, { status: failed ? 500 : 200 });
}

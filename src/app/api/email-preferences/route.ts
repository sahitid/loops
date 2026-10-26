import { z } from "zod";
import { unseal } from "@/lib/security";
import { readLoop, updateLoop } from "@/lib/storage";
import { sameOrigin } from "@/lib/request";
const schema = z.object({
  token: z.string().max(2000),
  enabled: z.boolean().optional(),
});
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  try {
    const raw = await request.text();
    if (raw.length > 3000) throw new Error("Invalid request");
    const data = schema.parse(JSON.parse(raw));
    const access = unseal<{ loop: string; member: string }>(
      data.token,
      "preferences",
    );
    if (!access)
      return Response.json(
        {
          error:
            "This email preferences link has expired. Open your loop to update preferences.",
        },
        { status: 403 },
      );
    const saved = await readLoop(access.loop);
    const member = saved?.loop.members.find((m) => m.id === access.member);
    if (!saved || !member) throw new Error("Not found");
    if (typeof data.enabled === "boolean")
      await updateLoop(access.loop, (loop) => {
        const m = loop.members.find((m) => m.id === access.member)!;
        m.emailsEnabled = data.enabled;
        if (!data.enabled)
          for (const j of loop.outbox || [])
            if (j.memberId === m.id && j.status === "pending")
              j.status = "cancelled";
      });
    return Response.json(
      {
        name: saved.loop.name,
        enabled: data.enabled ?? member.emailsEnabled ?? false,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Could not update email preferences." },
      { status: 400 },
    );
  }
}

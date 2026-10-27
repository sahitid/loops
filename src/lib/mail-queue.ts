import {
  defaultQuestions,
  nextDelivery,
  publicLoop,
  publishIssue,
  type EmailJob,
  type Loop,
  type Member,
  type Issue,
} from "./model";
import {
  appUrl,
  emailButton,
  emailConfigured,
  emailProvider,
  emailLayout,
  escapeHtml,
  sendEmail,
  EmailError,
} from "./email";
import { seal } from "./security";
import { updateLoop } from "./storage";

export function presentLoop(loop: Loop, member: Member) {
  const value = publicLoop(loop, member);
  const jobs = loop.outbox || [];
  value.emailStatus = {
    configured: emailConfigured(),
    subscribed: loop.members.filter((m) => m.email && m.emailsEnabled).length,
    pending: jobs.filter(
      (j) => j.status === "pending" || j.status === "sending",
    ).length,
    sent: jobs.filter((j) => j.status === "sent").length,
    failed: jobs.filter((j) => j.status === "failed").length,
  };
  return value;
}
function preferences(loop: Loop, member: Member) {
  const token = seal({
    purpose: "preferences",
    loop: loop.id,
    member: member.id,
    exp: Date.now() + 366 * 86400000,
  });
  return `${appUrl()}/email-preferences#token=${token}`;
}
function footer(loop: Loop, member: Member) {
  return `You joined ${escapeHtml(loop.name)}. <a href="${escapeHtml(preferences(loop, member))}">Manage emails or unsubscribe</a>. Photos are shared with your group; forwarding this newsletter also shares its photos.`;
}
function enqueue(loop: Loop, job: Omit<EmailJob, "status" | "attempts">) {
  loop.outbox ||= [];
  if (loop.outbox.some((j) => j.id === job.id)) return;
  loop.outbox.push({ ...job, status: "pending", attempts: 0 });
}
export function queueForms(loop: Loop, now = new Date(), reminder = false) {
  if (loop.paused || !process.env.AUTH_SECRET) return;
  const kind = reminder ? "reminder" : "form";
  for (const member of loop.members) {
    if (
      !member.email ||
      !member.emailsEnabled ||
      (reminder && loop.current.replies[member.id]?.submitted)
    )
      continue;
    if (
      reminder &&
      !loop.outbox?.some(
        (j) =>
          j.kind === "form" &&
          j.issueId === loop.current.id &&
          j.memberId === member.id &&
          j.status === "sent" &&
          j.sentAt &&
          Date.parse(j.sentAt) < now.getTime() - 86400000,
      )
    )
      continue;
    const deadline = new Date(loop.nextDelivery).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
    const link = `${appUrl()}/loop/${loop.id}?form=${loop.current.id}`;
    const title = reminder
      ? "A little nudge to share your week."
      : "Your next little life update.";
    const text = `Hi ${member.name},\n\n${title}\n${loop.name} · Issue ${loop.current.number}\nReply by ${deadline}, 16:00 UTC.\n\n${loop.current.questions.map((q) => q.text).join("\n")}\n\nWrite, record a voice note, or add photos and videos: ${link}\n\nOnly submitted replies appear in the newsletter.\nManage emails: ${preferences(loop, member)}`;
    enqueue(loop, {
      id: `${kind}-${loop.current.id}-${Date.parse(loop.nextDelivery)}-${member.id}`,
      kind,
      issueId: loop.current.id,
      dueAt: loop.nextDelivery,
      memberId: member.id,
      to: member.email,
      subject: `${reminder ? "Reminder: " : ""}${loop.name} — your response form is ready`,
      html: emailLayout(
        title,
        `<p>Hi ${escapeHtml(member.name)},</p><p>Issue ${loop.current.number} of <b>${escapeHtml(loop.name)}</b> is open. Reply by <b>${deadline}, 16:00 UTC</b>.</p><ul>${loop.current.questions.map((q) => `<li>${escapeHtml(q.text)}</li>`).join("")}</ul><p>Type a few lines, talk it out, or share your camera roll. Only submitted replies appear in the newsletter.</p>${emailButton(link, "Fill out my form")}`,
        footer(loop, member),
      ),
      text,
      createdAt: now.toISOString(),
    });
  }
}
function newsletterBody(loop: Loop, issue: Issue, now: Date) {
  let html = `<p style="color:#777">Issue ${issue.number} · ${now.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" })}</p>`;
  const parts: string[] = [];
  for (const [id, reply] of Object.entries(issue.replies)) {
    const name = issue.people?.[id] || "A friend";
    html += `<hr style="border:0;border-top:1px solid #e1ded5;margin:28px 0"><h2 style="font:25px Georgia,serif">${escapeHtml(name)}</h2>`;
    parts.push(`\n${name}\n${reply.story || ""}`);
    if (reply.story)
      html += `<p style="white-space:pre-wrap">${escapeHtml(reply.story)}</p>`;
    for (const q of issue.questions)
      if (reply.values[q.id]?.trim()) {
        html += `<h3 style="font-size:16px">${escapeHtml(q.text)}</h3><p style="white-space:pre-wrap">${escapeHtml(reply.values[q.id])}</p>`;
        parts.push(`${q.text}\n${reply.values[q.id]}`);
      }
    for (const media of reply.media || []) {
      if (media.type.startsWith("image/")) {
        const token = seal({
          purpose: "email-media",
          loop: loop.id,
          issue: issue.id,
          media: media.id,
          exp: now.getTime() + 90 * 86400000,
        });
        html += `<p><img src="${appUrl()}/api/email-media?token=${token}" alt="${escapeHtml(media.name)}" width="500" style="display:block;width:100%;max-width:500px;height:auto;border-radius:8px"><small>${escapeHtml(media.name)}</small></p>`;
      } else
        html += `<p>${media.type.startsWith("video/") ? "Video" : "Voice note"}: ${escapeHtml(media.name)} — play it in the private issue below.</p>`;
    }
  }
  const link = `${appUrl()}/loop/${loop.id}?issue=${issue.id}`;
  html += emailButton(link, "Read the issue & play videos");
  return {
    html,
    text: `${loop.name} · Issue ${issue.number}\n${parts.join("\n\n")}\n\nPhotos, videos and the full issue: ${link}`,
  };
}
export function publishAndQueue(loop: Loop, now = new Date()) {
  if (!publishIssue(loop, now)) return false;
  if (process.env.AUTH_SECRET) {
    const issue = loop.issues[0];
    const body = newsletterBody(loop, issue, now);
    for (const member of loop.members)
      if (member.email && member.emailsEnabled)
        enqueue(loop, {
          id: `newsletter-${issue.id}-${member.id}`,
          kind: "newsletter",
          memberId: member.id,
          issueId: issue.id,
          to: member.email,
          subject: `${loop.name} — issue ${issue.number} is here`,
          html: emailLayout(loop.name, body.html, footer(loop, member)),
          text: `${body.text}\n\nManage emails: ${preferences(loop, member)}`,
          createdAt: now.toISOString(),
        });
  }
  queueForms(loop, now);
  return true;
}
export function scheduleLoop(loop: Loop, now = new Date()) {
  if (loop.paused) return false;
  let published = false;
  if (Date.parse(loop.nextDelivery) <= now.getTime()) {
    published = publishAndQueue(loop, now);
    if (!published) {
      // Keep unsubmitted drafts intact when nobody has submitted this cycle.
      loop.nextDelivery = nextDelivery(loop.frequency, now);
      if (!Object.keys(loop.current.replies).length)
        loop.current = {
          id: crypto.randomUUID(),
          number: loop.current.number,
          questions: defaultQuestions(now.getUTCDate()),
          replies: {},
        };
    }
  }
  queueForms(loop, now);
  if (Date.parse(loop.nextDelivery) - now.getTime() <= 2 * 86400000)
    queueForms(loop, now, true);
  loop.outbox = loop.outbox?.filter(
    (j) =>
      j.issueId === loop.current.id ||
      !["sent", "cancelled"].includes(j.status) ||
      Date.parse(j.createdAt) > now.getTime() - 90 * 86400000,
  );
  return published;
}
export function queueInvitation(
  loop: Loop,
  to: string,
  owner: Member,
  now = new Date(),
) {
  const recent = (loop.outbox || []).filter(
    (j) =>
      j.kind === "invitation" &&
      Date.parse(j.createdAt) > now.getTime() - 86400000,
  );
  if (recent.length >= 30)
    throw new Error("This loop has sent its 30 invitations for today.");
  if (
    recent.some(
      (j) => j.to === to && Date.parse(j.createdAt) > now.getTime() - 3600000,
    )
  )
    throw new Error("This loop already invited that email in the last hour.");
  const link = `${appUrl()}/join/${loop.id}#key=${loop.inviteKey}`;
  enqueue(loop, {
    id: `invite-${crypto.randomUUID()}`,
    kind: "invitation",
    issueId: loop.current.id,
    to,
    subject: `${owner.name} invited you to ${loop.name}`,
    createdAt: now.toISOString(),
    html: emailLayout(
      "There’s a place for you here.",
      `<p>${escapeHtml(owner.name)} invited you to <b>${escapeHtml(loop.name)}</b>, a private group newsletter.</p><p>Share a few stories, photos or videos ${loop.frequency === 30 ? "each month" : `every ${loop.frequency} days`}. After joining, you can choose to receive forms, reminders and newsletters by email.</p>${emailButton(link, "Join the loop")}`,
      "You received a one-time invitation. Recurring emails start only after you join and enable them.",
    ),
    text: `${owner.name} invited you to ${loop.name}. Join: ${link}\nRecurring emails start only after you join and enable them.`,
  });
}
export function claimEmail(
  loop: Loop,
  now: Date,
  claim: string,
): EmailJob | null {
  for (const job of loop.outbox || []) {
    if (!["pending", "sending"].includes(job.status)) continue;
    if (
      job.status === "sending" &&
      Date.parse(job.leaseUntil || "") > now.getTime()
    )
      continue;
    if (Date.parse(job.nextAttemptAt || "") > now.getTime()) continue;
    const member = loop.members.find((m) => m.id === job.memberId);
    if (job.memberId && (!member?.emailsEnabled || member.email !== job.to)) {
      job.status = "cancelled";
      continue;
    }
    if (
      ["form", "reminder"].includes(job.kind) &&
      (job.issueId !== loop.current.id ||
        job.dueAt !== loop.nextDelivery ||
        (job.kind === "reminder" &&
          loop.current.replies[job.memberId!]?.submitted))
    ) {
      job.status = "cancelled";
      continue;
    }
    if (loop.paused && job.kind !== "invitation") continue;
    const provider = emailProvider();
    if (!provider) return null;
    // Old jobs with attempts predate Gmail support and used Resend.
    const previousProvider = job.deliveryProvider || (job.attempts ? "resend" : undefined);
    if (
      (previousProvider && previousProvider !== provider) ||
      (provider === "gmail" && (job.status === "sending" || job.uncertain))
    ) {
      job.status = "failed";
      job.error = "Receipt needs review; automatic retry stopped to avoid duplicate emails.";
      continue;
    }
    // Resend remembers idempotency keys for 24 hours. Never repeat an ambiguous send outside that window.
    if (
      job.firstAttemptAt &&
      now.getTime() - Date.parse(job.firstAttemptAt) > 23 * 3600000
    ) {
      job.status = "failed";
      job.error =
        "Receipt could not be confirmed; automatic retry stopped to avoid duplicates.";
      continue;
    }
    job.status = "sending";
    job.deliveryProvider = provider;
    job.claim = claim;
    job.leaseUntil = new Date(now.getTime() + 60000).toISOString();
    job.firstAttemptAt ||= now.toISOString();
    job.attempts++;
    return structuredClone(job);
  }
  return null;
}
export async function dispatchEmails(
  id: string,
  deadline = Date.now() + 45000,
) {
  if (!emailConfigured()) return { sent: 0, failed: 0 };
  let sent = 0,
    failed = 0;
  while (Date.now() < deadline - 31000) {
    const claim = crypto.randomUUID();
    const { result: job } = await updateLoop(id, (loop) =>
      claimEmail(loop, new Date(), claim),
    );
    if (!job) break;
    try {
      const receipt = await sendEmail(job, job.id);
      await updateLoop(id, (loop) => {
        const current = loop.outbox?.find(
          (j) => j.id === job.id && j.claim === claim,
        );
        if (current) {
          current.status = "sent";
          current.sentAt = new Date().toISOString();
          current.providerId = receipt;
          current.html = "";
          current.text = "";
          delete current.error;
        }
      });
      sent++;
    } catch (e) {
      failed++;
      await updateLoop(id, (loop) => {
        const current = loop.outbox?.find(
          (j) => j.id === job.id && j.claim === claim,
        );
        if (!current) return;
        const definite = e instanceof EmailError;
        current.status = definite && !e.retryable ? "failed" : "pending";
        current.error = definite
          ? `Email provider returned ${e.status}.`
          : "Email receipt unavailable; queued for retry.";
        current.nextAttemptAt = new Date(
          Date.now() + (definite && e.status === 429 ? 3600000 : 60000),
        ).toISOString();
        current.uncertain ||= !definite || e.uncertain;
        if (definite && !e.uncertain && !current.uncertain)
          delete current.firstAttemptAt;
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  return { sent, failed };
}

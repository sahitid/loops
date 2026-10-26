export type Mail = { to: string; subject: string; html: string; text: string };
export function emailConfigured() {
  return Boolean(
    process.env.RESEND_API_KEY &&
      process.env.EMAIL_FROM &&
      process.env.AUTH_SECRET?.length &&
      process.env.APP_URL,
  );
}
export const appUrl = () =>
  (process.env.APP_URL || "https://loops-sand.vercel.app").replace(/\/$/, "");
export class EmailError extends Error {
  constructor(
    public status: number,
    public retryable: boolean,
  ) {
    super(`Email service returned ${status}`);
  }
}
export async function sendEmail(mail: Mail, id: string) {
  if (!emailConfigured()) throw new EmailError(503, true);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": id,
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [mail.to],
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new EmailError(
      response.status,
      response.status === 429 || response.status >= 500,
    );
  const result = await response.json();
  if (typeof result.id !== "string") throw new Error("Email receipt missing");
  return result.id as string;
}
export const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function emailLayout(
  title: string,
  body: string,
  footer = "A little less distance. A little more us.",
) {
  return `<!doctype html><html><body style="margin:0;background:#f3f0e9;color:#33332f;font:16px/1.6 Arial,sans-serif"><div style="max-width:600px;margin:auto;padding:32px 24px"><p style="font:bold 32px Georgia,serif;color:#ae5d51">loops.</p><div style="background:#fffdf8;padding:32px;border:1px solid #e1ded5;border-radius:12px"><h1 style="font:30px/1.2 Georgia,serif">${escapeHtml(title)}</h1>${body}</div><div style="font-size:12px;color:#66645e;padding:24px 0">${footer}</div></div></body></html>`;
}
export const emailButton = (url: string, label: string) =>
  `<p style="margin:28px 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:#ad5b50;color:white;padding:12px 22px;border-radius:6px;text-decoration:none">${escapeHtml(label)}</a></p>`;

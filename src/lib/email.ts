import { createHash } from "node:crypto";
import nodemailer from "nodemailer";

export type Mail = { to: string; subject: string; html: string; text: string };
let reportedConfiguration = false;
export function emailProvider(): "gmail" | "resend" | null {
  const provider = process.env.EMAIL_PROVIDER || "resend";
  return provider === "gmail" || provider === "resend" ? provider : null;
}
export function emailConfigured() {
  const provider = emailProvider();
  const validAddress = (address: string) => /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(address);
  const senderReady = provider === "gmail"
    ? validAddress(process.env.GMAIL_USER || "") &&
      validAddress(process.env.GMAIL_FROM_ADDRESS || process.env.GMAIL_USER || "") &&
      (process.env.GMAIL_APP_PASSWORD || "").replace(/\s/g, "").length === 16
    : provider === "resend" && process.env.RESEND_API_KEY && process.env.EMAIL_FROM;
  const configured = Boolean(
    senderReady &&
      (process.env.AUTH_SECRET?.length || 0) >= 32 &&
      process.env.APP_URL,
  );
  if (!configured && process.env.VERCEL && !reportedConfiguration) {
    reportedConfiguration = true;
    // Log only validity flags, never addresses, passwords, or secret values.
    console.warn("Email configuration incomplete", {
      provider: provider || "invalid",
      gmailUserValid: validAddress(process.env.GMAIL_USER || ""),
      gmailSenderValid: validAddress(process.env.GMAIL_FROM_ADDRESS || process.env.GMAIL_USER || ""),
      gmailPasswordPresent: Boolean(process.env.GMAIL_APP_PASSWORD),
      gmailPasswordFormatValid: (process.env.GMAIL_APP_PASSWORD || "").replace(/\s/g, "").length === 16,
      resendKeyPresent: Boolean(process.env.RESEND_API_KEY),
      resendSenderPresent: Boolean(process.env.EMAIL_FROM),
      signingSecretValid: (process.env.AUTH_SECRET?.length || 0) >= 32,
      appUrlPresent: Boolean(process.env.APP_URL),
    });
  }
  return configured;
}
export const appUrl = () =>
  (process.env.APP_URL || "https://loops-sand.vercel.app").replace(/\/$/, "");
export class EmailError extends Error {
  constructor(
    public status: number,
    public retryable: boolean,
    public uncertain = status >= 500,
  ) {
    super(`Email service returned ${status}`);
  }
}
export async function sendEmail(mail: Mail, id: string) {
  if (!emailConfigured()) throw new EmailError(503, true);
  if (emailProvider() === "gmail") return sendGmail(mail, id);
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

async function sendGmail(mail: Mail, id: string) {
  const user = process.env.GMAIL_USER!;
  const sender = process.env.GMAIL_FROM_ADDRESS || user;
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass: process.env.GMAIL_APP_PASSWORD!.replace(/\s/g, "") },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    disableFileAccess: true,
    disableUrlAccess: true,
    logger: false,
    debug: false,
  });
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      transport.sendMail({
        from: { name: "Loops", address: sender },
        replyTo: { name: "Loops", address: sender },
        envelope: { from: user, to: [mail.to] },
        to: { address: mail.to, name: "" },
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        // Useful for tracing, but Gmail does not promise idempotent SMTP sends.
        messageId: `<loops-${createHash("sha256").update(id).digest("hex")}@${user.split("@")[1]}>`,
      }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new EmailError(504, false, true)), 30000);
      }),
    ]);
    if (!result.accepted?.length) throw new EmailError(422, false, false);
    return result.messageId;
  } catch (error) {
    if (error instanceof EmailError) throw error;
    const smtp = error as { responseCode?: number; command?: string; code?: string; response?: string };
    // Negative SMTP replies are definite rejections. Keep provider error text,
    // which can contain recipient addresses, out of logs and public errors.
    if (smtp.responseCode && smtp.responseCode >= 400) {
      const temporary = smtp.responseCode < 500 || /5\.4\.5/.test(smtp.response || "");
      throw new EmailError(temporary ? 429 : 422, temporary, false);
    }
    // Nodemailer also labels post-DATA socket failures "CONN", so a generic
    // connection error does not prove that Gmail received no message.
    const beforeMessage = smtp.code === "EDNS" || /^(EHLO|HELO|STARTTLS|AUTH|MAIL FROM|RCPT TO)(\b|:)/.test(smtp.command || "");
    // Never retry an unknown SMTP receipt: Gmail cannot deduplicate it.
    throw new EmailError(503, beforeMessage, !beforeMessage);
  } finally {
    clearTimeout(timeout);
    transport.close();
  }
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

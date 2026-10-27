import test, { mock } from "node:test";
import assert from "node:assert/strict";
import nodemailer, { type SendMailOptions, type SMTPTransportOptions } from "nodemailer";
import {
  claimEmail,
  publishAndQueue,
  queueForms,
  scheduleLoop,
} from "../src/lib/mail-queue";
import {
  nextDelivery,
  publicLoop,
  defaultQuestions,
  type Loop,
} from "../src/lib/model";
import { seal, unseal, safeNext } from "../src/lib/security";
import { sendEmail, EmailError, emailConfigured } from "../src/lib/email";
process.env.AUTH_SECRET = "test-secret-".repeat(5);
process.env.APP_URL = "https://loops.example.test";
function fixture(): Loop {
  return {
    id: "group",
    name: "Friends <&>",
    description: "",
    color: "sage",
    frequency: 7,
    nextDelivery: "2026-11-01T16:00:00.000Z",
    paused: false,
    createdAt: "2026-10-25",
    inviteKey: "private-invite",
    members: [
      {
        id: "a",
        name: "Alice",
        role: "owner",
        tokenHash: "private-token",
        accountId: "private-account",
        email: "alice@example.test",
        emailsEnabled: true,
      },
      {
        id: "b",
        name: "Bob",
        role: "member",
        tokenHash: "private-token-b",
        email: "bob@example.test",
        emailsEnabled: true,
      },
      {
        id: "c",
        name: "Chris",
        role: "member",
        tokenHash: "private-token-c",
        email: "chris@example.test",
        emailsEnabled: false,
      },
    ],
    current: {
      id: "issue-1",
      number: 1,
      questions: defaultQuestions(),
      replies: {},
    },
    issues: [],
  };
}
const now = new Date("2026-10-26T16:00:00Z");
test("forms enqueue once per member and cycle; paused and unsubscribed members receive none", () => {
  const loop = fixture();
  queueForms(loop, now);
  queueForms(loop, now);
  assert.equal(loop.outbox?.length, 2);
  assert.ok(
    loop.outbox?.every(
      (j) => j.kind === "form" && j.html.includes("Fill out my form"),
    ),
  );
  loop.paused = true;
  assert.equal(claimEmail(loop, now, "claim"), null);
  assert.equal(scheduleLoop(loop, new Date("2026-11-02")), false);
});
test("reminders go only to unsubmitted members who have received the form", () => {
  const loop = fixture();
  queueForms(loop, now);
  for (const job of loop.outbox!) {
    job.status = "sent";
    job.sentAt = now.toISOString();
  }
  loop.current.replies.a = {
    values: { q1: "Done" },
    submitted: true,
    updatedAt: now.toISOString(),
  };
  scheduleLoop(loop, new Date("2026-10-31T16:00:00Z"));
  const reminders = loop.outbox!.filter((j) => j.kind === "reminder");
  assert.deepEqual(
    reminders.map((j) => j.memberId),
    ["b"],
  );
  loop.current.replies.b = {
    values: { q1: "Done now" },
    submitted: true,
    updatedAt: now.toISOString(),
  };
  assert.equal(
    claimEmail(loop, new Date("2026-10-31T16:00:00Z"), "claim"),
    null,
  );
});
test("due publication queues complete newsletters and fresh forms exactly once, without drafts", () => {
  const loop = fixture();
  loop.current.replies.a = {
    story: "<script>not executable</script>",
    values: { q1: "A good week" },
    submitted: true,
    updatedAt: now.toISOString(),
    media: [
      {
        id: "photo-1",
        pathname: "private/photo.jpg",
        name: "Our photo",
        type: "image/jpeg",
        size: 100,
      },
    ],
  };
  loop.current.replies.b = {
    story: "PRIVATE DRAFT",
    values: {},
    submitted: false,
    updatedAt: now.toISOString(),
  };
  const due = new Date("2026-11-01T16:00:00Z");
  assert.equal(scheduleLoop(loop, due), true);
  assert.equal(scheduleLoop(loop, due), false);
  assert.equal(loop.current.number, 2);
  assert.equal(Object.keys(loop.current.replies).length, 0);
  assert.equal(loop.outbox!.length, 4);
  const newsletters = loop.outbox!.filter((j) => j.kind === "newsletter");
  assert.equal(newsletters.length, 2);
  assert.ok(newsletters[0].html.includes("&lt;script&gt;"));
  assert.ok(newsletters[0].html.includes("/api/email-media?token="));
  assert.ok(!JSON.stringify(newsletters).includes("PRIVATE DRAFT"));
  assert.ok(!JSON.stringify(newsletters).includes("private/photo.jpg"));
  assert.ok(!newsletters[0].html.includes("<script>"));
  const exposed = JSON.stringify(publicLoop(loop, loop.members[1]));
  for (const privateValue of [
    "alice@example.test",
    "private-account",
    "private-token",
    "outbox",
    "private-invite",
  ])
    assert.ok(!exposed.includes(privateValue));
});
test("email claims prevent overlapping sends and stop ambiguous retries beyond provider deduplication", () => {
  const loop = fixture();
  queueForms(loop, now);
  const a = claimEmail(loop, now, "worker-a")!;
  const b = claimEmail(loop, now, "worker-b")!;
  assert.notEqual(a.id, b.id);
  assert.equal(claimEmail(loop, now, "worker-c"), null);
  assert.equal(
    claimEmail(loop, new Date(now.getTime() + 2 * 60000), "worker-d")!.id,
    a.id,
  );
  assert.equal(
    claimEmail(loop, new Date(now.getTime() + 25 * 3600000), "worker-e"),
    null,
  );
  assert.ok(loop.outbox!.every((j) => j.status === "failed"));
});
test("pending mail is cancelled after unsubscribe, changed deadlines, or publication", () => {
  const loop = fixture();
  queueForms(loop, now);
  loop.members[0].emailsEnabled = false;
  assert.equal(claimEmail(loop, now, "one")!.memberId, "b");
  const other = fixture();
  queueForms(other, now);
  other.nextDelivery = "2026-12-01T16:00:00Z";
  assert.equal(claimEmail(other, now, "two"), null);
  assert.ok(other.outbox!.every((j) => j.status === "cancelled"));
});
test("empty cycles advance without sending an empty newsletter or deleting drafts", () => {
  const loop = fixture();
  loop.current.replies.a = {
    values: { q1: "Private draft" },
    submitted: false,
    updatedAt: now.toISOString(),
  };
  scheduleLoop(loop, new Date("2026-11-02T16:00:00Z"));
  assert.equal(loop.current.replies.a.values.q1, "Private draft");
  assert.equal(loop.issues.length, 0);
  assert.ok(loop.outbox!.every((j) => j.kind === "form"));
});
test("monthly dates clamp at month end, including leap years", () => {
  assert.equal(
    nextDelivery(30, new Date("2027-01-31T16:00:00Z")),
    "2027-02-28T16:00:00.000Z",
  );
  assert.equal(
    nextDelivery(30, new Date("2028-01-31T16:00:00Z")),
    "2028-02-29T16:00:00.000Z",
  );
});
test("signed access tokens reject tampering, expired links, and wrong purposes", () => {
  const token = seal({ purpose: "session", id: "a", exp: Date.now() + 10000 });
  assert.equal(unseal<{ id: string }>(token, "session")?.id, "a");
  assert.equal(unseal(token + "x", "session"), null);
  assert.equal(unseal(token, "email-media"), null);
  assert.equal(unseal(seal({ purpose: "session", exp: 1 }), "session"), null);
  assert.equal(safeNext("//evil.test"), "/app");
  assert.equal(safeNext("/app"), "/app");
});
test("provider requests include idempotency key; errors never become successful sends", async () => {
  process.env.RESEND_API_KEY = "test-only";
  process.env.EMAIL_FROM = "hello@example.test";
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, init) => {
      assert.equal(
        new Headers(init?.headers).get("Idempotency-Key"),
        "test-id",
      );
      const body = JSON.parse(init?.body as string);
      assert.deepEqual(body.to, ["alice@example.test"]);
      return Response.json({ id: "receipt-1" });
    };
    const mail = {
      to: "alice@example.test",
      subject: "Test",
      html: "<p>Test</p>",
      text: "Test",
    };
    assert.equal(await sendEmail(mail, "test-id"), "receipt-1");
    globalThis.fetch = async () =>
      Response.json({ message: "Rate limited" }, { status: 429 });
    await assert.rejects(
      () => sendEmail(mail, "test-id"),
      (e: unknown) =>
        e instanceof EmailError && e.retryable && e.status === 429,
    );
  } finally {
    globalThis.fetch = original;
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
  }
});

test("Gmail sends through authenticated TLS and preserves newsletter content without requiring a domain", async () => {
  process.env.EMAIL_PROVIDER = "gmail";
  process.env.GMAIL_USER = "loops-test@gmail.com";
  process.env.GMAIL_APP_PASSWORD = "abcd efgh ijkl mnop";
  const originalCreate = nodemailer.createTransport;
  const captured: Buffer[] = [];
  const intercepted = mock.method(nodemailer, "createTransport", (options: SMTPTransportOptions) => {
    assert.equal(options.host, "smtp.gmail.com");
    assert.equal(options.secure, true);
    assert.equal(options.auth?.user, process.env.GMAIL_USER);
    assert.equal(options.auth?.pass, "abcdefghijklmnop");
    assert.equal(options.disableFileAccess, true);
    assert.equal(options.disableUrlAccess, true);
    const stream = originalCreate({ streamTransport: true, buffer: true });
    return {
      async sendMail(mail: SendMailOptions) {
        const result = await stream.sendMail(mail);
        captured.push(result.message as Buffer);
        assert.equal(result.envelope.from, process.env.GMAIL_USER);
        assert.deepEqual(result.envelope.to, ["friend@example.test"]);
        return { messageId: result.messageId, accepted: result.envelope.to };
      },
      close() { stream.close(); },
    } as unknown as ReturnType<typeof nodemailer.createTransport>;
  });
  try {
    assert.equal(emailConfigured(), true);
    const mail = { to: "friend@example.test", subject: "A new Loops issue", text: "Hello from our loop", html: '<p>Hello from our loop</p><img src="https://loops.example.test/photo">' };
    const first = await sendEmail(mail, "same-job");
    assert.equal(await sendEmail(mail, "same-job"), first);
    assert.ok(captured[0].toString().includes("multipart/alternative"));
    assert.ok(captured[0].toString().includes("Hello from our loop"));
    assert.ok(captured[0].toString().includes("https://loops.example.test/photo"));
    delete process.env.GMAIL_APP_PASSWORD;
    assert.equal(emailConfigured(), false);
  } finally {
    intercepted.mock.restore();
    delete process.env.EMAIL_PROVIDER;
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
  }
});

test("Gmail retries definite temporary rejections but never repeats an ambiguous SMTP delivery", async () => {
  process.env.EMAIL_PROVIDER = "gmail";
  process.env.GMAIL_USER = "loops-test@gmail.com";
  process.env.GMAIL_APP_PASSWORD = "abcdefghijklmnop";
  let failure: object = { responseCode: 421, command: "DATA" };
  const intercepted = mock.method(nodemailer, "createTransport", () => ({
    async sendMail() { throw failure; },
    close() {},
  }) as unknown as ReturnType<typeof nodemailer.createTransport>);
  const mail = { to: "friend@example.test", subject: "Test", html: "Test", text: "Test" };
  try {
    await assert.rejects(() => sendEmail(mail, "retry"),
      (e: unknown) => e instanceof EmailError && e.retryable && !e.uncertain);
    failure = { code: "EDNS", command: "CONN" };
    await assert.rejects(() => sendEmail(mail, "connect"),
      (e: unknown) => e instanceof EmailError && e.retryable && !e.uncertain);
    failure = { code: "ECONNECTION", command: "CONN" };
    await assert.rejects(() => sendEmail(mail, "ambiguous"),
      (e: unknown) => e instanceof EmailError && !e.retryable && e.uncertain);
    failure = { responseCode: 535, command: "AUTH PLAIN" };
    await assert.rejects(() => sendEmail(mail, "invalid-password"),
      (e: unknown) => e instanceof EmailError && !e.retryable && !e.uncertain);

    const loop = fixture();
    queueForms(loop, now);
    claimEmail(loop, now, "gmail-a");
    claimEmail(loop, now, "gmail-b");
    assert.equal(claimEmail(loop, new Date(now.getTime() + 2 * 60000), "retry"), null);
    assert.ok(loop.outbox!.every(job => job.status === "failed"));
    const delayed = fixture();
    queueForms(delayed, now);
    const claimed = claimEmail(delayed, now, "first")!;
    delayed.outbox![0].status = "pending"; // definite SMTP rejection, safe to retry
    assert.equal(claimEmail(delayed, new Date(now.getTime() + 2 * 60000), "again")!.id, claimed.id);
  } finally {
    intercepted.mock.restore();
    delete process.env.EMAIL_PROVIDER;
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
  }
});

test("switching mail providers cannot resend a previously attempted job", () => {
  const loop = fixture();
  queueForms(loop, now);
  claimEmail(loop, now, "resend-a");
  claimEmail(loop, now, "resend-b");
  process.env.EMAIL_PROVIDER = "gmail";
  try {
    assert.equal(claimEmail(loop, new Date(now.getTime() + 2 * 60000), "gmail"), null);
    assert.ok(loop.outbox!.every(job => job.status === "failed"));
  } finally {
    delete process.env.EMAIL_PROVIDER;
  }
});

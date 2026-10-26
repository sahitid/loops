// Run only against a local server using mock-email-transport.mjs and local storage.
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { accountId } from "../src/lib/security.ts";
const base = "http://127.0.0.1:3000";
const capture = process.env.LOOPS_TEST_MAIL_CAPTURE;
if (!capture || process.env.BLOB_READ_WRITE_TOKEN)
  throw new Error("This test requires local storage and mock email transport");
const cleanup = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function mails() {
  try {
    return (await readFile(capture, "utf8"))
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}
async function call(path, body, cookie = "", expected = 200) {
  const r = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      Origin: base,
      Cookie: cookie,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const d = await r.json();
  assert.equal(
    r.status,
    expected,
    `${path}/${body?.action}: ${d.error || r.status}`,
  );
  return {
    data: d,
    cookie: r.headers.get("set-cookie")?.split(";")[0] || cookie,
  };
}
async function login(email, fail = false) {
  cleanup.push(`.data/accounts/${accountId(email)}.json`);
  const { data } = await call("/api/auth", { action: "request", email });
  const mail = (await mails()).findLast((m) => m.to.includes(email));
  assert.ok(mail);
  const code = mail.subject.match(/^\d{6}/)[0];
  if (fail) {
    for (let i = 0; i < 5; i++)
      await call(
        "/api/auth",
        { action: "verify", email, code: "000000", requestId: data.requestId },
        "",
        400,
      );
    await call(
      "/api/auth",
      { action: "verify", email, code, requestId: data.requestId },
      "",
      400,
    );
    return;
  }
  const signed = await call("/api/auth", {
    action: "verify",
    email,
    code,
    requestId: data.requestId,
  });
  await call(
    "/api/auth",
    { action: "verify", email, code, requestId: data.requestId },
    "",
    400,
  );
  return signed.cookie;
}
try {
  const stamp = crypto.randomUUID();
  const ownerEmail = `owner-${stamp}@example.test`,
    friendEmail = `friend-${stamp}@example.test`;
  const owner = await login(ownerEmail);
  const friend = await login(friendEmail);
  await login(`failed-${stamp}@example.test`, true);
  const created = await call(
    "/api/loops",
    {
      action: "create",
      memberName: "Owner",
      name: "Email QA",
      description: "Disposable QA",
      frequency: 7,
      color: "sage",
      emailsEnabled: true,
    },
    owner,
    201,
  );
  const group = created.data.loop.id;
  cleanup.push(`.data/${group}.json`);
  const issue = created.data.loop.current.id;
  await call(
    "/api/loops",
    {
      action: "join",
      id: group,
      key: created.data.loop.inviteKey,
      name: "Friend",
      emailsEnabled: true,
    },
    friend,
  );
  const onNewDevice = await call("/api/loops", null, owner);
  assert.ok(onNewDevice.data.loops.some((l) => l.id === group));
  const friendView = await call(`/api/loops?id=${group}`, null, friend);
  assert.ok(!JSON.stringify(friendView.data).includes(ownerEmail));
  await call(
    "/api/loops",
    {
      action: "reply",
      id: group,
      issueId: issue,
      story: "A lovely week",
      values: {},
      submitted: true,
    },
    owner,
  );
  await call(
    "/api/loops",
    {
      action: "reply",
      id: group,
      issueId: issue,
      story: "PRIVATE DRAFT",
      values: {},
      submitted: false,
    },
    friend,
  );
  const published = await call(
    "/api/loops",
    { action: "publish", id: group, issueId: issue },
    owner,
  );
  assert.equal(published.data.loop.current.number, 2);
  let delivered = [];
  for (let i = 0; i < 100; i++) {
    delivered = (await mails()).filter(
      (m) => m.subject === "Email QA — issue 1 is here",
    );
    if (delivered.length === 2) break;
    await sleep(150);
  }
  assert.equal(delivered.length, 2);
  assert.ok(
    delivered.every(
      (m) =>
        m.html.includes("A lovely week") && !m.html.includes("PRIVATE DRAFT"),
    ),
  );
  assert.equal(new Set(delivered.map((m) => m.to[0])).size, 2);
  const token = new URL(
    delivered
      .find((m) => m.to[0] === ownerEmail)
      .html.match(/href="([^\"]*email-preferences[^\"]*)"/)[1],
  ).hash.slice(7);
  const unsub = await call("/api/email-preferences", { token, enabled: false });
  assert.equal(unsub.data.enabled, false);
  await call(
    "/api/email-preferences",
    { token: token + "bad", enabled: true },
    "",
    403,
  );
  const prefs = await call(`/api/loops?id=${group}`, null, owner);
  assert.equal(prefs.data.loop.emailsEnabled, false);
  const forged = owner.slice(0, -1) + (owner.endsWith("x") ? "y" : "x");
  await call(`/api/loops?id=${group}`, null, forged, 401);
  await call(
    "/api/loops",
    { action: "publish", id: group, issueId: issue },
    owner,
    409,
  );
  console.log(
    "PASS: email-code sign-in, code reuse and brute-force protection, cross-device groups, verified membership, private drafts, newsletter delivery through mock transport, new forms, unsubscribe and forged-token rejection.",
  );
} finally {
  await sleep(1800);
  for (const file of cleanup) await rm(file, { force: true });
}

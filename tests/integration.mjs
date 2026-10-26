// Run against a development or production URL: node --env-file=.env.local tests/integration.mjs
import assert from "node:assert/strict";
import { upload } from "@vercel/blob/client";
import { del } from "@vercel/blob";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
let ownerCookie = "",
  memberCookie = "",
  groupId = "";
const blobs = [];
async function call(body, cookie = "", expected = 200) {
  const r = await fetch(`${base}/api/loops`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: base,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  assert.equal(r.status, expected, `${body.action}: ${d.error || r.status}`);
  return {
    data: d,
    cookie: r.headers.get("set-cookie")?.split(";")[0] || cookie,
  };
}
async function read(cookie) {
  const r = await fetch(`${base}/api/loops?id=${groupId}`, {
    headers: { Cookie: cookie },
  });
  assert.equal(r.status, 200);
  return r.json();
}
try {
  const owner = await call(
    {
      action: "create",
      name: "Loops integration QA",
      description: "Disposable test group",
      memberName: "QA Owner",
      frequency: 7,
      color: "sage",
    },
    "",
    201,
  );
  ownerCookie = owner.cookie;
  groupId = owner.data.loop.id;
  blobs.push(`loops/${groupId}.json`);
  const issueId = owner.data.loop.current.id;
  const invite = owner.data.loop.inviteKey;
  const ownerId = owner.data.loop.me;
  const anonymous = await fetch(`${base}/api/loops?id=${groupId}`);
  assert.equal(anonymous.status, 401);
  const joined = await call({
    action: "join",
    id: groupId,
    key: invite,
    name: "QA Friend",
  });
  memberCookie = joined.cookie;
  assert.equal(joined.data.loop.inviteKey, undefined);
  assert.equal(JSON.stringify(joined.data).includes("tokenHash"), false);
  await call(
    {
      action: "settings",
      id: groupId,
      name: "Hijacked",
      description: "",
      frequency: 7,
      paused: false,
    },
    memberCookie,
    403,
  );
  await call(
    {
      action: "reply",
      id: groupId,
      issueId,
      values: { q1: "Private owner answer" },
      story: "Owner draft is private",
      submitted: false,
    },
    ownerCookie,
  );
  const memberView = await read(memberCookie);
  assert.equal(
    JSON.stringify(memberView).includes("Private owner answer"),
    false,
  );
  assert.equal(JSON.stringify(memberView).includes("Owner draft"), false);
  await call(
    {
      action: "questions",
      id: groupId,
      issueId,
      questions: [{ id: "q1", text: "Changed" }],
    },
    ownerCookie,
    409,
  );
  const file = new File(
    [
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aScsAAAAASUVORK5CYII=",
        "base64",
      ),
    ],
    "qa.png",
    { type: "image/png" },
  );
  for (let i = 0; i < 2; i++) {
    const uploaded = await upload(
      `media/${groupId}/${issueId}/${ownerId}/${crypto.randomUUID()}.png`,
      file,
      {
        access: "private",
        handleUploadUrl: `${base}/api/upload`,
        contentType: "image/png",
        headers: { Cookie: ownerCookie, Origin: base },
      },
    );
    blobs.push(uploaded.pathname);
    await call(
      {
        action: "attach",
        id: groupId,
        issueId,
        pathname: uploaded.pathname,
        name: `QA photo ${i + 1}.png`,
      },
      ownerCookie,
    );
  }
  const withPhotos = await read(ownerCookie);
  assert.equal(withPhotos.loop.current.replies[ownerId].media.length, 2);
  const mediaId = withPhotos.loop.current.replies[ownerId].media[0].id;
  const memberPhoto = await fetch(
    `${base}/api/media?loop=${groupId}&media=${mediaId}`,
    { headers: { Cookie: memberCookie } },
  );
  assert.equal(memberPhoto.status, 404);
  const ownerPhoto = await fetch(
    `${base}/api/media?loop=${groupId}&media=${mediaId}`,
    { headers: { Cookie: ownerCookie } },
  );
  assert.equal(ownerPhoto.status, 200);
  assert.equal(ownerPhoto.headers.get("content-type"), "image/png");
  await call(
    {
      action: "reply",
      id: groupId,
      issueId,
      values: { q1: "Ready to share" },
      story: "A full test update",
      submitted: true,
    },
    ownerCookie,
  );
  await call(
    {
      action: "reply",
      id: groupId,
      issueId,
      values: { q1: "Unsubmitted friend draft" },
      submitted: false,
    },
    memberCookie,
  );
  const published = await call(
    { action: "publish", id: groupId, issueId },
    ownerCookie,
  );
  assert.equal(published.data.loop.issues.length, 1);
  assert.equal(published.data.loop.current.number, 2);
  assert.equal(Object.keys(published.data.loop.issues[0].replies).length, 1);
  assert.equal(
    JSON.stringify(published.data.loop.issues).includes("Unsubmitted"),
    false,
  );
  const sharedPhoto = await fetch(
    `${base}/api/media?loop=${groupId}&media=${mediaId}`,
    { headers: { Cookie: memberCookie } },
  );
  assert.equal(sharedPhoto.status, 200);
  await call({ action: "publish", id: groupId, issueId }, ownerCookie, 409);
  await call({ action: "rotate-invite", id: groupId }, ownerCookie);
  await call(
    { action: "join", id: groupId, key: invite, name: "Expired invite" },
    "",
    403,
  );
  const cron = await fetch(`${base}/api/cron`);
  assert.equal(cron.status, 401);
  console.log(
    "PASS: create, join, access control, private drafts/media, bulk uploads, submitted-only publication, stale-write rejection, invite rotation, cron protection.",
  );
} finally {
  if (process.env.BLOB_READ_WRITE_TOKEN && blobs.length) {
    await del(blobs);
    console.log("Disposable QA data removed.");
  }
}

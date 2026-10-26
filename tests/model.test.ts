import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultQuestions,
  publicLoop,
  publishIssue,
  type Loop,
} from "../src/lib/model";
const fixture = (): Loop => ({
  id: "test",
  name: "Test",
  description: "",
  color: "peach",
  frequency: 7,
  nextDelivery: "2026-11-01",
  paused: false,
  createdAt: "2026-10-26",
  inviteKey: "invite-secret",
  members: [
    { id: "a", name: "Alice", role: "owner", tokenHash: "owner-secret" },
    { id: "b", name: "Bob", role: "member", tokenHash: "member-secret" },
  ],
  current: {
    id: "first",
    number: 1,
    questions: defaultQuestions(),
    replies: {},
  },
  issues: [],
  aiUsage: { a: { day: "today", count: 2 } },
});
test("members cannot read anyone else’s draft, attachments, credentials, or invitation", () => {
  const l = fixture();
  l.current.replies.a = {
    values: { q1: "private" },
    story: "private story",
    media: [
      {
        id: "photo",
        pathname: "private-path",
        type: "image/jpeg",
        name: "photo",
        size: 12,
      },
    ],
    submitted: false,
    updatedAt: "now",
  };
  const view = publicLoop(l, l.members[1]);
  assert.equal(view.inviteKey, undefined);
  assert.equal("aiUsage" in view, false);
  assert.equal(JSON.stringify(view).includes("private"), false);
  assert.equal(JSON.stringify(view).includes("secret"), false);
});
test("publication includes submitted stories and media but excludes drafts", () => {
  const l = fixture();
  l.current.replies.a = {
    values: {},
    story: "My week",
    submitted: true,
    updatedAt: "now",
  };
  l.current.replies.b = {
    values: { q1: "Draft only" },
    submitted: false,
    updatedAt: "now",
  };
  assert.equal(publishIssue(l, new Date("2026-10-26T16:00:00Z")), true);
  assert.deepEqual(Object.keys(l.issues[0].replies), ["a"]);
  assert.equal(l.issues[0].people?.a, "Alice");
  assert.equal(l.current.number, 2);
  assert.equal(l.nextDelivery, "2026-11-02T16:00:00.000Z");
  assert.deepEqual(l.current.replies, {});
});
test("empty issues cannot publish or advance", () => {
  const l = fixture();
  assert.equal(publishIssue(l), false);
  assert.equal(l.current.number, 1);
  assert.equal(l.issues.length, 0);
});
test("a submitted photo-only update is publishable", () => {
  const l = fixture();
  l.current.replies.a = {
    values: {},
    submitted: true,
    updatedAt: "now",
    media: [
      {
        id: "photo",
        pathname: "private-path",
        type: "image/jpeg",
        name: "photo",
        size: 12,
      },
    ],
  };
  assert.equal(publishIssue(l), true);
  assert.equal(l.issues[0].replies.a.media?.length, 1);
});

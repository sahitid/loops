export type Question = { id: string; text: string };
export type Media = {
  id: string;
  pathname: string;
  name: string;
  type: string;
  size: number;
};
export type Reply = {
  story?: string;
  media?: Media[];
  values: Record<string, string>;
  submitted: boolean;
  updatedAt: string;
};
export type Member = {
  id: string;
  name: string;
  role: "owner" | "member";
  tokenHash: string;
  accountId?: string;
  email?: string;
  emailsEnabled?: boolean;
};
export type EmailJob = {
  id: string;
  kind: "form" | "reminder" | "newsletter" | "invitation";
  issueId: string;
  memberId?: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  createdAt: string;
  status: "pending" | "sending" | "sent" | "cancelled" | "failed";
  dueAt?: string;
  sentAt?: string;
  attempts: number;
  firstAttemptAt?: string;
  uncertain?: boolean;
  nextAttemptAt?: string;
  leaseUntil?: string;
  claim?: string;
  providerId?: string;
  error?: string;
};
export type Issue = {
  questionsLocked?: boolean;
  id: string;
  number: number;
  questions: Question[];
  replies: Record<string, Reply>;
  publishedAt?: string;
  people?: Record<string, string>;
};
export type Loop = {
  id: string;
  name: string;
  description: string;
  color: string;
  frequency: number;
  nextDelivery: string;
  paused: boolean;
  createdAt: string;
  inviteKey: string;
  members: Member[];
  current: Issue;
  issues: Issue[];
  aiUsage?: Record<string, { day: string; count: number }>;
  outbox?: EmailJob[];
};
export type PublicLoop = Omit<
  Loop,
  "members" | "inviteKey" | "aiUsage" | "outbox"
> & {
  members: Pick<Member, "id" | "name" | "role">[];
  me: string;
  inviteKey?: string;
  myEmail?: string;
  emailsEnabled?: boolean;
  emailStatus?: {
    configured: boolean;
    subscribed: number;
    pending: number;
    sent: number;
    failed: number;
  };
};
export const prompts = [
  {
    category: "The everyday",
    text: "What’s a small thing that made your week better?",
  },
  {
    category: "Life lately",
    text: "What’s taking up space in your head lately?",
  },
  {
    category: "A little joy",
    text: "What’s something you’re looking forward to?",
  },
  {
    category: "The everyday",
    text: "What have you been reading, watching, or listening to?",
  },
  {
    category: "A little deeper",
    text: "What’s something you’ve changed your mind about?",
  },
  {
    category: "Way back when",
    text: "Which memory of us still makes you smile?",
  },
  { category: "A little joy", text: "Describe your ideal slow Sunday." },
  {
    category: "Life lately",
    text: "What’s one thing you wish we could do together right now?",
  },
  {
    category: "A little deeper",
    text: "What’s a lesson you’re learning the hard way?",
  },
  {
    category: "The everyday",
    text: "What’s a meal you’d happily eat again tomorrow?",
  },
  {
    category: "Way back when",
    text: "What did you love doing as a kid that you miss?",
  },
  {
    category: "A little joy",
    text: "Tell us about a recent, very small victory.",
  },
];
export function defaultQuestions(offset = 0): Question[] {
  return [0, 1, 2].map((n) => ({
    id: `q${n + 1}`,
    text: prompts[(offset + n) % prompts.length].text,
  }));
}
export function publicLoop(loop: Loop, member: Member): PublicLoop {
  const { aiUsage: _usage, outbox: _outbox, ...safe } = loop;
  return {
    ...safe,
    inviteKey: member.role === "owner" ? loop.inviteKey : undefined,
    members: loop.members.map(({ id, name, role }) => ({ id, name, role })),
    me: member.id,
    myEmail: member.email,
    emailsEnabled: Boolean(member.email && member.emailsEnabled),
    current: {
      ...loop.current,
      questionsLocked: Object.values(loop.current.replies).some(
        (r) =>
          r.story?.trim() ||
          r.media?.length ||
          Object.values(r.values).some((v) => v.trim()),
      ),
      replies: Object.fromEntries(
        Object.entries(loop.current.replies).map(([id, reply]) => [
          id,
          id === member.id
            ? reply
            : {
                submitted: reply.submitted,
                updatedAt: reply.updatedAt,
                values: {},
              },
        ]),
      ),
    },
  };
}
export function publishIssue(loop: Loop, now = new Date()): boolean {
  const replies = Object.fromEntries(
    Object.entries(loop.current.replies).filter(
      ([, r]) =>
        r.submitted &&
        (r.story?.trim() ||
          r.media?.length ||
          Object.values(r.values).some((v) => v.trim())),
    ),
  );
  if (!Object.keys(replies).length) return false;
  loop.issues.unshift({
    ...loop.current,
    replies,
    publishedAt: now.toISOString(),
    people: Object.fromEntries(loop.members.map((m) => [m.id, m.name])),
  });
  loop.current = {
    id: crypto.randomUUID(),
    number: loop.current.number + 1,
    questions: defaultQuestions(loop.current.number * 3),
    replies: {},
  };
  loop.nextDelivery = nextDelivery(loop.frequency, now);
  return true;
}
export function nextDelivery(frequency: number, from = new Date()): string {
  const next = new Date(from);
  if (frequency === 30) {
    const day = next.getUTCDate();
    next.setUTCDate(1);
    next.setUTCMonth(next.getUTCMonth() + 1);
    const last = new Date(
      Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0),
    ).getUTCDate();
    next.setUTCDate(Math.min(day, last));
  } else next.setUTCDate(next.getUTCDate() + frequency);
  next.setUTCHours(16, 0, 0, 0);
  return next.toISOString();
}

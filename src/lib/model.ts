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
};
export type PublicLoop = Omit<Loop, "members" | "inviteKey" | "aiUsage"> & {
  members: Omit<Member, "tokenHash">[];
  me: string;
  inviteKey?: string;
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
  const { aiUsage: _usage, ...safe } = loop;
  return {
    ...safe,
    inviteKey: member.role === "owner" ? loop.inviteKey : undefined,
    members: loop.members.map(({ tokenHash: _secret, ...m }) => m),
    me: member.id,
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
  loop.nextDelivery = new Date(
    now.getTime() + loop.frequency * 86400000,
  ).toISOString();
  return true;
}

import { defaultQuestions, type PublicLoop } from "./model";
export const demoLoop: PublicLoop = {
  id: "demo",
  name: "The Sunday People",
  description:
    "Different cities. Same people. A little space to keep up with each other.",
  color: "peach",
  frequency: 14,
  nextDelivery: "2026-11-08T16:00:00Z",
  paused: false,
  createdAt: "2026-07-01",
  me: "maya",
  inviteKey: "demo",
  members: [
    { id: "maya", name: "Maya", role: "owner" },
    { id: "alex", name: "Alex", role: "member" },
    { id: "jules", name: "Jules", role: "member" },
    { id: "sam", name: "Sam", role: "member" },
  ],
  current: {
    id: "demo-current",
    number: 9,
    questions: defaultQuestions(),
    replies: {
      alex: {
        values: {
          q1: "A long walk with absolutely nowhere to be. More of that, please.",
          q3: "Finally visiting all of you next month!",
        },
        story: "",
        submitted: true,
        updatedAt: "2026-10-26",
      },
      jules: {
        values: {
          q1: "I made a new friend at pottery class. Our bowls are equally wonky.",
        },
        submitted: true,
        updatedAt: "2026-10-26",
      },
    },
  },
  issues: [
    {
      id: "demo-8",
      number: 8,
      questions: defaultQuestions(),
      publishedAt: "2026-10-25T16:00:00Z",
      people: { maya: "Maya", alex: "Alex", jules: "Jules", sam: "Sam" },
      replies: {
        maya: {
          values: {
            q1: "I finally learned my neighbor’s name. She brought over a bag of lemons from her sister’s tree. Made the whole city feel a little smaller.",
            q3: "Dinner together next month. I’ve already started a very ambitious menu.",
          },
          story:
            "Life lately\n\nI’ve been trying to make a little more room for ordinary things. Cooking a proper breakfast. Taking the long way home. Calling someone just because.\n\nThis week, I finally unpacked the last box from the move. It was mostly books and a mug from our road trip. That made me miss you all a lot.",
          submitted: true,
          updatedAt: "2026-10-25",
        },
        alex: {
          values: {
            q1: "A long walk with absolutely nowhere to be. More of that, please.",
            q2: "Thinking about signing up for a half marathon. Someone please hold me to this.",
            q3: "A weekend in the mountains. No notifications allowed.",
          },
          media: [
            {
              id: "demo-lake",
              pathname: "demo/lake.jpg",
              name: "A little mountain air. Wish you were here.",
              type: "image/jpeg",
              size: 0,
            },
          ],
          submitted: true,
          updatedAt: "2026-10-25",
        },
        jules: {
          values: {
            q1: "My first successful loaf of bread! Only took six attempts.",
            q2: "How to keep my plants alive while I travel. Applications for plant godparents are open.",
          },
          media: [
            {
              id: "demo-bread",
              pathname: "demo/bread.jpg",
              name: "Attempt number six. Finally got the crust right!",
              type: "image/jpeg",
              size: 0,
            },
          ],
          submitted: true,
          updatedAt: "2026-10-25",
        },
        sam: {
          values: {
            q1: "An excellent book, a rainy afternoon, and absolutely no plans.",
            q3: "Seeing everyone again. It’s been too long.",
          },
          submitted: true,
          updatedAt: "2026-10-25",
        },
      },
    },
  ],
};

export const demoAssets: Record<string, string> = {
  "demo-lake": "/demo/lake.jpg",
  "demo-bread": "/demo/bread.jpg",
};

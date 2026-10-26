"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Heart,
  KeyRound,
  LockKeyhole,
  Mail,
  MoreHorizontal,
  Plus,
  Printer,
  Save,
  Send,
  Settings,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { Avatar, Header, LoopMark } from "./brand";
import { CopyLink, Loading, Modal, Notice, request } from "./ui";
import {
  defaultQuestions,
  prompts,
  publishIssue,
  type Issue,
  type Loop,
  type PublicLoop,
  type Question,
} from "@/lib/model";
import { demoLoop } from "@/lib/demo";
import { useEmailAccount } from "./email-account";
import VoiceNote from "./voice-note";
import MediaUploader, { MediaGrid, uploadMedia } from "./media";
type Tab = "current" | "archive" | "people" | "settings";
export default function LoopApp({
  id,
  demo = false,
}: {
  id: string;
  demo?: boolean;
}) {
  const [loop, setLoop] = useState<PublicLoop | null>(
    demo ? structuredClone(demoLoop) : null,
  );
  const account = useEmailAccount();
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<Tab>("current");
  const [modal, setModal] = useState<
    "invite" | "questions" | "publish" | "access" | null
  >(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [story, setStory] = useState("");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [access, setAccess] = useState("");
  const [issue, setIssue] = useState<Issue | null>(
    demo ? structuredClone(demoLoop.issues[0]) : null,
  );
  const [editorQuestions, setEditorQuestions] = useState<Question[]>([]);
  const [search, setSearch] = useState("");
  const [custom, setCustom] = useState("");
  const [voice, setVoice] = useState(false);
  function apply(data: PublicLoop, reset = false) {
    setLoop(data);
    if (reset) {
      setValues(data.current.replies[data.me]?.values || {});
      setStory(data.current.replies[data.me]?.story || "");
      setDirty(false);
    }
    if (demo) localStorage.setItem("loops-demo-v2", JSON.stringify(data));
  }
  useEffect(() => {
    if (demo) {
      try {
        const stored = localStorage.getItem("loops-demo-v2");
        if (stored) {
          const d = JSON.parse(stored);
          if (d.id === "demo" && d.current && Array.isArray(d.members))
            apply(d, true);
        }
      } catch {}
      return;
    }
    fetch(`/api/loops?id=${id}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        apply(d.loop, true);
        setAccess(d.accessKey || "");
        const params = new URLSearchParams(location.search);
        if (params.get("issue"))
          setIssue(
            d.loop.issues.find((i: Issue) => i.id === params.get("issue")) ||
              null,
          );
        if (params.get("form") && params.get("form") !== d.loop.current.id)
          setNotice("That issue has closed. Here’s your newest response form.");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, demo]);
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(t);
  }, [notice]);
  async function mutate(
    action: string,
    payload: Record<string, unknown> = {},
    reset = false,
  ) {
    if (!loop) return;
    setError("");
    setBusy(true);
    try {
      let result: PublicLoop;
      if (demo) {
        result = structuredClone(loop);
        if (action === "reply")
          result.current.replies[result.me] = {
            ...result.current.replies[result.me],
            values: values,
            story,
            submitted: Boolean(payload.submitted),
            updatedAt: new Date().toISOString(),
          };
        if (action === "questions")
          result.current.questions = payload.questions as Question[];
        if (action === "publish") {
          if (!publishIssue(result as unknown as Loop))
            throw new Error(
              "At least one submitted reply is needed to publish.",
            );
        }
        if (action === "settings") Object.assign(result, payload);
      } else {
        const r = await request({
          action,
          id,
          issueId: loop.current.id,
          ...payload,
        });
        result = r.loop;
      }
      apply(result, reset);
      return result;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <>
        <Header />
        <Loading />
      </>
    );
  if (!loop)
    return (
      <>
        <Header />
        <main className="narrow-page">
          <Notice>{error || "This loop couldn’t be found."}</Notice>
          <Link
            href={`/login#next=${encodeURIComponent(`/loop/${id}${typeof location !== "undefined" ? location.search : ""}`)}`}
            className="button"
          >
            Sign in to your loop
          </Link>
        </main>
      </>
    );
  const owner = loop.members.find((m) => m.id === loop.me)?.role === "owner";
  const reply = loop.current.replies[loop.me];
  const submitted = Object.values(loop.current.replies).filter(
    (r) => r.submitted,
  ).length;
  const date = new Date(loop.nextDelivery).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
  const locked =
    loop.current.questionsLocked ||
    Object.values(loop.current.replies).some(
      (r) =>
        r.story?.trim() ||
        r.media?.length ||
        Object.values(r.values).some((v) => v.trim()),
    );
  return (
    <>
      <Header />
      {demo && (
        <div className="demo-banner">
          <span>
            <Sparkles size={14} /> You’re exploring a sample loop. Changes stay
            in this browser.
          </span>
          <Link href="/new">
            Make it yours <ArrowUpRight size={14} />
          </Link>
        </div>
      )}
      <main className="loop-page">
        <div className="loop-breadcrumb">
          <Link href="/app">
            <ArrowLeft size={14} /> Your loops
          </Link>
          <span>
            <LockKeyhole size={12} /> PRIVATE GROUP
          </span>
        </div>
        <div className="group-heading">
          <div>
            <div className="eyebrow">STAY A LITTLE CLOSER</div>
            <h1>{loop.name}</h1>
            <p>{loop.description}</p>
          </div>
          <div className="group-actions">
            <div className="avatar-stack">
              {loop.members.slice(0, 4).map((m, i) => (
                <Avatar key={m.id} name={m.name} index={i} />
              ))}
              <span>{loop.members.length} people</span>
            </div>
            {owner && (
              <button
                className="button button-outline button-small"
                onClick={() => setModal("invite")}
              >
                <Plus size={16} />
                Invite your people
              </button>
            )}
          </div>
        </div>
        <nav className="group-tabs">
          {(
            [
              ["current", "Current issue", Mail],
              ["archive", "Past issues", BookOpen],
              ["people", "People", Users],
              ["settings", "Settings", Settings],
            ] as const
          )
            .filter(([key]) => key !== "settings" || owner)
            .map(([key, label, Icon]) => (
              <button
                key={key}
                className={tab === key && !issue ? "active" : ""}
                onClick={() => {
                  setTab(key);
                  setIssue(null);
                }}
              >
                <Icon size={16} />
                {label}
                {key === "archive" && (
                  <span className="count">{loop.issues.length}</span>
                )}
              </button>
            ))}
          {!demo && access && (
            <button className="personal-key" onClick={() => setModal("access")}>
              <KeyRound size={15} />
              <span>Your access key</span>
            </button>
          )}
        </nav>
        {notice && (
          <div className="toast" role="status">
            <Check size={16} />
            {notice}
          </div>
        )}
        {error && <Notice>{error}</Notice>}
        {!demo && (
          <section className="email-strip">
            <Mail size={21} />
            <div>
              <strong>
                {loop.emailsEnabled
                  ? "Your loop, delivered to your inbox."
                  : "Make this a little ritual."}
              </strong>
              <p>
                {!loop.emailStatus?.configured
                  ? "Email delivery is waiting for a verified sender. Your group and response forms are ready to use here."
                  : loop.myEmail
                    ? `Forms, reminders and newsletters ${loop.emailsEnabled ? "go to" : "are turned off for"} ${loop.myEmail}.`
                    : "Connect your email to receive each new form, a reminder, and the finished newsletter."}
              </p>
              {loop.emailStatus?.configured && owner && (
                <small>
                  {loop.emailStatus.subscribed} subscribed ·{" "}
                  {loop.emailStatus.pending} queued · {loop.emailStatus.sent}{" "}
                  accepted by email provider
                  {loop.emailStatus.failed
                    ? ` · ${loop.emailStatus.failed} need attention`
                    : ""}
                </small>
              )}
            </div>
            {loop.myEmail ? (
              <button
                className="text-link"
                disabled={busy}
                onClick={async () => {
                  if (
                    await mutate("email-preferences", {
                      enabled: !loop.emailsEnabled,
                    })
                  )
                    setNotice(
                      loop.emailsEnabled
                        ? "Emails turned off for this loop."
                        : "Recurring emails enabled.",
                    );
                }}
              >
                {loop.emailsEnabled ? "Turn off emails" : "Turn on emails"}
              </button>
            ) : account.email ? (
              <button
                className="button button-small"
                disabled={busy}
                onClick={async () => {
                  if (await mutate("connect-email", { enabled: true }))
                    setNotice(
                      "Your email is connected. Forms and newsletters will arrive in your inbox.",
                    );
                }}
              >
                Connect {account.email}
              </button>
            ) : loop.emailStatus?.configured ? (
              <Link
                href={`/login#next=${encodeURIComponent(`/loop/${id}`)}`}
                className="button button-small"
              >
                Connect my email
              </Link>
            ) : null}
          </section>
        )}
        {issue ? (
          <article className="newsletter">
            <div className="newsletter-toolbar">
              <button className="text-link" onClick={() => setIssue(null)}>
                <ArrowLeft size={15} />
                All issues
              </button>
              <button className="text-link" onClick={() => window.print()}>
                <Printer size={15} />
                Print / save PDF
              </button>
            </div>
            <div className="newsletter-content">
              <h1>{loop.name}</h1>
              <h4>
                No. {issue.number} |{" "}
                {new Date(issue.publishedAt!).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </h4>
              <div className="newsletter-byline">
                ✎ Made by{" "}
                {Object.keys(issue.replies)
                  .map(
                    (m) =>
                      issue.people?.[m] ||
                      loop.members.find((p) => p.id === m)?.name ||
                      "A friend",
                  )
                  .join(", ")}
              </div>
              {Object.entries(issue.replies).some(([, r]) =>
                r.story?.trim(),
              ) && (
                <section>
                  <h2>Life lately</h2>
                  {Object.entries(issue.replies)
                    .filter(([, r]) => r.story?.trim())
                    .map(([m, r]) => (
                      <div className="newsletter-reply" key={m}>
                        <strong>{issue.people?.[m] || "A friend"}</strong>
                        <p>{r.story}</p>
                      </div>
                    ))}
                </section>
              )}
              {issue.questions.map((q) => {
                const answers = Object.entries(issue.replies).filter(([, r]) =>
                  r.values[q.id]?.trim(),
                );
                return answers.length ? (
                  <section key={q.id}>
                    <h2>{q.text}</h2>
                    {answers.map(([m, r]) => (
                      <div className="newsletter-reply" key={m}>
                        <p>
                          <strong>{issue.people?.[m] || "A friend"}: </strong>
                          {r.values[q.id]}
                        </p>
                      </div>
                    ))}
                  </section>
                ) : null;
              })}
              {Object.entries(issue.replies).some(
                ([, r]) => r.media?.length,
              ) && (
                <section>
                  <h2>📷 A little window into our lives</h2>
                  {Object.entries(issue.replies)
                    .filter(([, r]) => r.media?.length)
                    .map(([m, r]) => (
                      <div key={m}>
                        <h3>{issue.people?.[m] || "A friend"}</h3>
                        <MediaGrid loopId={loop.id} media={r.media!} />
                      </div>
                    ))}
                </section>
              )}
              <div className="newsletter-end">
                <Heart size={23} />
                <p>A little piece of everyone, in one place.</p>
                <small>Made with Loops</small>
              </div>
            </div>
          </article>
        ) : tab === "current" ? (
          <div className="issue-layout">
            <div className="issue-main">
              <div className="issue-heading">
                <div>
                  <span className="eyebrow">
                    ISSUE NO. {String(loop.current.number).padStart(3, "0")}
                  </span>
                  <h2>A little life update.</h2>
                  <p>
                    There’s no big-news requirement. The ordinary stuff counts.
                  </p>
                </div>
                <span
                  className={`status-pill ${reply?.submitted && !dirty ? "submitted" : ""}`}
                >
                  {reply?.submitted && !dirty ? (
                    <>
                      <Check size={12} />
                      Your reply is in
                    </>
                  ) : (
                    "Open for replies"
                  )}
                </span>
              </div>
              <section className="update-card">
                <div className="section-title">
                  <div>
                    <h3>Your week, in your words.</h3>
                    <p>Talk it out, type it out, make it yours.</p>
                  </div>
                  <button
                    className="button button-outline button-small"
                    onClick={() => setVoice(!voice)}
                  >
                    <Sparkles size={16} />
                    {voice ? "Hide voice notes" : "Start with a voice note"}
                  </button>
                </div>
                {voice && (
                  <VoiceNote
                    id={loop.id}
                    demo={demo}
                    onDraft={(text) => {
                      setStory(text);
                      setDirty(true);
                      setNotice(
                        "Your draft is ready to review. Nothing has been shared.",
                      );
                    }}
                    onAudio={async (file) => {
                      if (demo)
                        throw new Error(
                          "Create a loop to save your recording.",
                        );
                      const r = await uploadMedia(file, loop);
                      apply(r.loop);
                    }}
                  />
                )}
                <label className="sr-only" htmlFor="story">
                  Your life update
                </label>
                <textarea
                  id="story"
                  className="story-editor"
                  value={story}
                  onChange={(e) => {
                    setStory(e.target.value);
                    setDirty(true);
                  }}
                  rows={story ? 9 : 5}
                  maxLength={20000}
                  placeholder="The little things, the big things, the things you’d tell us over coffee…"
                />
                <span className="editor-meta">
                  {story.length.toLocaleString()} / 20,000 characters · Only you
                  can see this until the issue is published.
                </span>
              </section>
              <MediaUploader
                loop={loop}
                demo={demo}
                onUpdate={(d) => apply(d)}
              />
              <div className="questions-heading">
                <div>
                  <h3>A few things we’re curious about</h3>
                  <p>Answer as many or as few as you like.</p>
                </div>
                {owner && (
                  <button
                    className="text-link"
                    onClick={() => {
                      setEditorQuestions(loop.current.questions);
                      setModal("questions");
                    }}
                  >
                    <Plus size={16} />
                    Edit questions
                  </button>
                )}
              </div>
              {loop.current.questions.map((q, i) => (
                <section className="question-card" key={q.id}>
                  <span className="question-index">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <label htmlFor={q.id}>{q.text}</label>
                    <textarea
                      id={q.id}
                      rows={3}
                      maxLength={6000}
                      placeholder="A little something to share…"
                      value={values[q.id] || ""}
                      onChange={(e) => {
                        setValues({ ...values, [q.id]: e.target.value });
                        setDirty(true);
                      }}
                    />
                  </div>
                </section>
              ))}
              <div className="submit-bar">
                <span>
                  <LockKeyhole size={13} />
                  {dirty
                    ? "You have unsaved changes"
                    : "Your update stays private until publication"}
                </span>
                <div>
                  <button
                    className="button button-outline"
                    disabled={busy}
                    onClick={async () => {
                      if (
                        await mutate(
                          "reply",
                          { values, story, submitted: false },
                          true,
                        )
                      )
                        setNotice(
                          "Draft saved. Come back whenever you’re ready.",
                        );
                    }}
                  >
                    <Save size={16} />
                    Save draft
                  </button>
                  <button
                    className="button"
                    disabled={
                      busy ||
                      (!story.trim() &&
                        !Object.values(values).some((v) => v.trim()) &&
                        !reply?.media?.length)
                    }
                    onClick={async () => {
                      if (
                        await mutate(
                          "reply",
                          { values, story, submitted: true },
                          true,
                        )
                      )
                        setNotice(
                          "Your reply is in. Thanks for sharing a little life.",
                        );
                    }}
                  >
                    <Send size={16} />
                    {busy
                      ? "Saving…"
                      : reply?.submitted
                        ? "Update my reply"
                        : "Submit my reply"}
                  </button>
                </div>
              </div>
            </div>
            <aside className="issue-sidebar">
              <div className="schedule-card">
                <div className="eyebrow">
                  <CalendarDays size={14} />
                  YOUR NEXT GET-TOGETHER
                </div>
                <h3>{loop.paused ? "Taking a little pause" : date}</h3>
                <p>
                  {loop.paused
                    ? "Your owner can resume the schedule in Settings."
                    : `A new issue ${loop.frequency === 30 ? "every month" : `every ${loop.frequency} days`}. A fresh response form opens after publication.`}
                </p>
                <div className="progress-track">
                  <div
                    style={{
                      width: `${(submitted / loop.members.length) * 100}%`,
                    }}
                  />
                </div>
                <span className="reply-count">
                  <strong>
                    {submitted} of {loop.members.length}
                  </strong>{" "}
                  replies are in
                </span>
                <div className="reply-list">
                  {loop.members.map((m, i) => (
                    <div key={m.id}>
                      <Avatar name={m.name} size="avatar-small" index={i} />
                      <span>
                        {m.name}
                        {m.id === loop.me ? " (you)" : ""}
                      </span>
                      {loop.current.replies[m.id]?.submitted ? (
                        <Check className="check" size={15} />
                      ) : (
                        <span className="waiting-dot" />
                      )}
                    </div>
                  ))}
                </div>
                {owner && (
                  <button
                    className="button button-outline full-width"
                    disabled={busy || submitted === 0}
                    onClick={() => setModal("publish")}
                  >
                    Publish this issue <ChevronRight size={15} />
                  </button>
                )}
              </div>
              <div className="side-note">
                <Heart size={20} />
                <h4>The little things are the big things.</h4>
                <p>
                  Your people don’t need a polished highlight reel. They just
                  want a little more you.
                </p>
              </div>
              <p className="delivery-note">
                {demo
                  ? "Your real loop can email new forms, reminders and newsletters to your people."
                  : loop.emailStatus?.configured
                    ? "Forms arrive when each issue opens. Reminders go to people who haven’t submitted, two days before publication. Only submitted updates are shared."
                    : "Your group works here now. Recurring emails start after a sender is connected and members enable email."}
              </p>
            </aside>
          </div>
        ) : tab === "archive" ? (
          <section className="archive-section">
            <h2>A little time capsule.</h2>
            <p>All the stories that brought you closer.</p>
            {loop.issues.length ? (
              <div className="archive-grid">
                {loop.issues.map((i) => (
                  <button
                    key={i.id}
                    className="archive-card"
                    onClick={() => setIssue(i)}
                  >
                    <div className="archive-envelope">
                      <Mail size={40} />
                      <span>NO. {String(i.number).padStart(3, "0")}</span>
                    </div>
                    <div>
                      <h3>{loop.name}</h3>
                      <p>
                        {new Date(i.publishedAt!).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                      <span>
                        {Object.keys(i.replies).length} stories, one shared
                        moment <ArrowUpRight size={15} />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <BookOpen size={40} />
                <h3>Your story is just getting started.</h3>
                <p>Published issues will find a home here.</p>
                <button className="button" onClick={() => setTab("current")}>
                  Write your first update
                </button>
              </div>
            )}
          </section>
        ) : tab === "people" ? (
          <section className="people-section">
            <div className="section-title">
              <div>
                <h2>Your inner circle.</h2>
                <p>The people who make this loop, this loop.</p>
              </div>
              {owner && (
                <button
                  className="button button-small"
                  onClick={() => setModal("invite")}
                >
                  <Plus size={16} />
                  Invite someone
                </button>
              )}
            </div>
            {loop.members.map((m, i) => (
              <div className="person-row" key={m.id}>
                <Avatar name={m.name} index={i} />
                <strong>
                  {m.name}
                  {m.id === loop.me && <span> (you)</span>}
                </strong>
                <span className="person-role">
                  {m.role === "owner" ? "Loop owner" : "Member"}
                </span>
                <span className="person-status">
                  {loop.current.replies[m.id]?.submitted
                    ? "Reply submitted"
                    : "Yet to reply"}
                </span>
              </div>
            ))}
          </section>
        ) : (
          <section className="settings-section">
            <h2>Make it feel like you.</h2>
            <p>A rhythm and a little space that work for your people.</p>
            <form
              className="settings-form"
              key={`${loop.name}-${loop.frequency}-${loop.paused}`}
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                if (
                  await mutate("settings", {
                    name: f.get("name"),
                    description: f.get("description"),
                    frequency: Number(f.get("frequency")),
                    paused: f.get("paused") === "on",
                  })
                )
                  setNotice("Your settings are saved.");
              }}
            >
              <label>
                Loop name
                <input
                  name="name"
                  defaultValue={loop.name}
                  required
                  maxLength={60}
                />
              </label>
              <label>
                Description
                <textarea
                  name="description"
                  defaultValue={loop.description}
                  maxLength={240}
                  rows={3}
                />
              </label>
              <label>
                Publication rhythm
                <select name="frequency" defaultValue={loop.frequency}>
                  <option value={7}>Every week</option>
                  <option value={14}>Every two weeks</option>
                  <option value={30}>Every month</option>
                </select>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="paused"
                  defaultChecked={loop.paused}
                />
                Pause the schedule and recurring emails
              </label>
              <p className="field-help">
                Changing your rhythm schedules the next issue from today. Forms
                and reminders are automatic. Publication runs daily at 16:00
                UTC; monthly schedules use calendar months.
              </p>
              <button className="button" disabled={busy}>
                <Save size={16} />
                Save changes
              </button>
            </form>
          </section>
        )}
      </main>
      {modal === "invite" && (
        <Modal
          title="Good company starts with an invitation."
          onClose={() => setModal(null)}
        >
          <p>
            Share this link with the people you want in {loop.name}. Anyone with
            the link can join and read published issues.
          </p>
          {demo ? (
            <>
              <Notice>
                This is a sample. Start your own loop to invite your people.
              </Notice>
              <Link href="/new" className="button">
                Start a loop
              </Link>
            </>
          ) : (
            <>
              <form
                className="email-invite"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  if (
                    await mutate("invite-email", {
                      email: new FormData(form).get("email"),
                    })
                  ) {
                    form.reset();
                    setNotice("Invitation queued for email delivery.");
                  }
                }}
              >
                <label>
                  Invite by email
                  <input
                    type="email"
                    name="email"
                    required
                    maxLength={254}
                    placeholder="your.friend@example.com"
                  />
                </label>
                <button
                  disabled={
                    busy || !loop.emailStatus?.configured || !account.email
                  }
                  className="button full-width"
                >
                  <Mail size={17} /> Send invitation
                </button>
                {(!loop.emailStatus?.configured || !account.email) && (
                  <p className="field-help">
                    Email invitations need a connected sender and email sign-in.
                    Share the private link below in the meantime.
                  </p>
                )}
              </form>
              <CopyLink
                value={`${location.origin}/join/${loop.id}#key=${loop.inviteKey}`}
              />
              <p className="field-help">
                Up to 30 people per loop. Share your invitation in a text, group
                chat, or email.
              </p>
              <button
                className="text-link subtle"
                disabled={busy}
                onClick={async () => {
                  if (await mutate("rotate-invite"))
                    setNotice(
                      "A fresh invitation is ready. The old link no longer works.",
                    );
                }}
              >
                Replace invite link
              </button>
            </>
          )}
        </Modal>
      )}
      {modal === "access" && (
        <Modal title="Your personal key." onClose={() => setModal(null)}>
          <p>
            Save this link to come back on another device. Keep it
            private—anyone with it can act as you in this loop.
          </p>
          <CopyLink
            value={`${location.origin}/access/${loop.id}#key=${access}`}
            label="Copy key"
          />
        </Modal>
      )}
      {modal === "publish" && (
        <Modal
          title="A little piece of everyone, ready to read."
          onClose={() => setModal(null)}
        >
          <p>
            Publish issue {loop.current.number} with {submitted} submitted{" "}
            {submitted === 1 ? "reply" : "replies"}. Unsubmitted drafts won’t
            appear. This will open the next issue.
          </p>
          {submitted < loop.members.length && (
            <p className="field-help">
              {loop.members.length - submitted}{" "}
              {loop.members.length - submitted === 1
                ? "person hasn’t"
                : "people haven’t"}{" "}
              submitted yet.
            </p>
          )}
          <div className="modal-actions">
            <button
              className="button button-outline"
              onClick={() => setModal(null)}
            >
              Give it more time
            </button>
            <button
              className="button"
              disabled={busy}
              onClick={async () => {
                const d = await mutate("publish", {}, true);
                if (d) {
                  setModal(null);
                  setIssue(d.issues[0]);
                  setTab("archive");
                  setNotice("Your issue is published. Happy catching up.");
                }
              }}
            >
              {busy ? "Publishing…" : "Publish issue"}
              <Send size={16} />
            </button>
          </div>
        </Modal>
      )}
      {modal === "questions" && (
        <Modal
          title="A good question goes a long way."
          onClose={() => setModal(null)}
        >
          {locked ? (
            <Notice>
              Questions are locked once someone starts writing. You can choose
              new questions when the next issue opens.
            </Notice>
          ) : (
            <>
              <p>Choose up to six questions, or write your own.</p>
              <div className="selected-questions">
                {editorQuestions.map((q) => (
                  <div key={q.id}>
                    <span>{q.text}</span>
                    <button
                      className="icon-button"
                      aria-label={`Remove question ${q.text}`}
                      onClick={() =>
                        setEditorQuestions(
                          editorQuestions.filter((x) => x.id !== q.id),
                        )
                      }
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="custom-question">
                <input
                  value={custom}
                  maxLength={300}
                  onChange={(e) => setCustom(e.target.value)}
                  placeholder="Ask your own question…"
                  aria-label="Custom question"
                />
                <button
                  className="icon-button"
                  aria-label="Add custom question"
                  disabled={!custom.trim() || editorQuestions.length >= 6}
                  onClick={() => {
                    setEditorQuestions([
                      ...editorQuestions,
                      { id: crypto.randomUUID(), text: custom.trim() },
                    ]);
                    setCustom("");
                  }}
                >
                  <Plus size={19} />
                </button>
              </div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find a question…"
                aria-label="Search question bank"
              />
              <div className="question-bank">
                {prompts
                  .filter(
                    (p) =>
                      p.text.toLowerCase().includes(search.toLowerCase()) &&
                      !editorQuestions.some((q) => q.text === p.text),
                  )
                  .map((p) => (
                    <button
                      key={p.text}
                      disabled={editorQuestions.length >= 6}
                      onClick={() =>
                        setEditorQuestions([
                          ...editorQuestions,
                          { id: crypto.randomUUID(), text: p.text },
                        ])
                      }
                    >
                      <span>
                        <small>{p.category}</small>
                        {p.text}
                      </span>
                      <Plus size={17} />
                    </button>
                  ))}
              </div>
              <button
                className="button full-width"
                disabled={busy || editorQuestions.length === 0}
                onClick={async () => {
                  if (
                    await mutate("questions", { questions: editorQuestions })
                  ) {
                    setModal(null);
                    setNotice("Your questions are ready.");
                  }
                }}
              >
                Save {editorQuestions.length} questions
                <Check size={16} />
              </button>
            </>
          )}
        </Modal>
      )}
    </>
  );
}

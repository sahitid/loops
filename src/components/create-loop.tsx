"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, LockKeyhole, MoveRight } from "lucide-react";
import { Flower, Header } from "./brand";
import { CopyLink, Notice, request } from "./ui";
export default function CreateLoop() {
  const [frequency, setFrequency] = useState(14);
  const [color, setColor] = useState("peach");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{
    id: string;
    key: string;
    name: string;
  } | null>(null);
  return (
    <>
      <Header />
      <main className="form-page">
        <Link href="/app" className="back-link">
          <ArrowLeft size={16} /> Your loops
        </Link>
        <div className="create-layout">
          <div className="create-intro">
            <span className="eyebrow">GOOD THINGS START SMALL</span>
            <h1>
              A place for
              <br />
              <em>your people.</em>
            </h1>
            <p>
              The ones you miss. The ones you mean to call.
              <br />
              Let’s give you a little way to stay close.
            </p>
            <Flower />
            <div className="small-note">
              <LockKeyhole size={15} /> A private space, by invitation only.
            </div>
          </div>
          {created ? (
            <section className="form-card success-card">
              <div className="success-icon">
                <Check />
              </div>
              <h2>Your loop is ready.</h2>
              <p>
                Welcome to {created.name}. Before you go, save your personal
                access link. It’s your key to this loop on another device.
              </p>
              <CopyLink
                value={`${location.origin}/access/${created.id}#key=${created.key}`}
                label="Copy key"
              />
              <p className="field-help">
                Keep this link private. Anyone with it can act as you. We’ll
                remember you in this browser.
              </p>
              <Link href={`/loop/${created.id}`} className="button full-width">
                Step inside your loop <MoveRight size={17} />
              </Link>
            </section>
          ) : (
            <form
              className="form-card"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                setBusy(true);
                setError("");
                try {
                  const r = await request({
                    action: "create",
                    name: form.get("name"),
                    description: form.get("description"),
                    memberName: form.get("memberName"),
                    frequency,
                    color,
                  });
                  setCreated({
                    id: r.loop.id,
                    key: r.accessKey,
                    name: r.loop.name,
                  });
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <h2>Start a loop</h2>
              <p className="muted">A few details, then it’s yours.</p>
              <label>
                Your name
                <input
                  name="memberName"
                  placeholder="What your people call you"
                  maxLength={40}
                  required
                  autoComplete="given-name"
                />
              </label>
              <label>
                Give your loop a name
                <input
                  name="name"
                  placeholder="The Sunday People"
                  maxLength={60}
                  required
                />
              </label>
              <label>
                A little about your loop{" "}
                <span className="optional">optional</span>
                <textarea
                  name="description"
                  rows={2}
                  placeholder="For the big news and the little things in between."
                  maxLength={240}
                />
              </label>
              <fieldset>
                <legend>Find your rhythm</legend>
                <div className="frequency-options">
                  {[
                    [7, "Weekly"],
                    [14, "Every 2 weeks"],
                    [30, "Every 30 days"],
                  ].map(([n, label]) => (
                    <button
                      type="button"
                      key={n}
                      className={frequency === n ? "selected" : ""}
                      onClick={() => setFrequency(Number(n))}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="field-help">
                  Replies become an issue on your chosen rhythm. You can pause
                  anytime.
                </p>
              </fieldset>
              <fieldset>
                <legend>Pick a little color</legend>
                <div className="color-options">
                  {["peach", "sage", "lavender", "butter"].map((c) => (
                    <button
                      type="button"
                      aria-label={`${c} theme`}
                      aria-pressed={color === c}
                      className={`swatch ${c}`}
                      onClick={() => setColor(c)}
                      key={c}
                    >
                      {color === c && <Check size={18} />}
                    </button>
                  ))}
                </div>
              </fieldset>
              {error && <Notice>{error}</Notice>}
              <button disabled={busy} className="button full-width">
                {busy ? "Making a little space…" : "Create your loop"}
                <MoveRight size={18} />
              </button>
              <p className="form-footnote">
                No password to remember. Just a personal access link.
              </p>
            </form>
          )}
        </div>
      </main>
    </>
  );
}

"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Heart, MoveRight } from "lucide-react";
import { Header } from "./brand";
import { CopyLink, Loading, Notice, request } from "./ui";
import { EmailEnrollment, useEmailAccount } from "./email-account";
export default function JoinLoop({
  id,
  restore = false,
}: {
  id: string;
  restore?: boolean;
}) {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const account = useEmailAccount();
  const [emailsEnabled, setEmailsEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [access, setAccess] = useState("");
  const [name, setName] = useState("");
  useEffect(() => {
    const k = new URLSearchParams(location.hash.slice(1)).get("key") || "";
    setKey(k);
    if (!k) {
      setError("This link is missing its key. Ask for the complete link.");
      return;
    }
    if (restore) {
      request({ action: "restore", id, key: k })
        .then(() => {
          history.replaceState(null, "", location.pathname);
          router.replace(`/loop/${id}`);
        })
        .catch((e) => setError(e.message));
    }
  }, [id, restore, router]);
  return (
    <>
      <Header />
      <main className="join-page">
        <section className="form-card">
          <div className="success-icon">{access ? <Check /> : <Heart />}</div>
          <span className="eyebrow">THERE’S A PLACE FOR YOU HERE</span>
          <h1>
            {access
              ? "You’re in the loop."
              : restore
                ? "Welcome back."
                : "Good to have you."}
          </h1>
          {error && <Notice>{error}</Notice>}
          {restore ? (
            !error && <Loading />
          ) : access ? (
            <>
              <p>
                Welcome to {name}. Save your personal key to open this loop on
                another device.
              </p>
              <CopyLink
                value={`${location.origin}/access/${id}#key=${access}`}
                label="Copy key"
              />
              <p className="field-help">
                Keep this key private. Anyone with it can act as you.
              </p>
              <Link href={`/loop/${id}`} className="button full-width">
                See what’s happening <MoveRight size={18} />
              </Link>
            </>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  const r = await request({
                    action: "join",
                    id,
                    key,
                    name: new FormData(e.currentTarget).get("name"),
                    emailsEnabled: Boolean(account.email && emailsEnabled),
                  });
                  history.replaceState(null, "", location.pathname);
                  if (r.accessKey) {
                    setAccess(r.accessKey);
                    setName(r.loop.name);
                  } else router.push(`/loop/${id}`);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <p>
                A friend saved you a spot in their private newsletter. A few
                stories, a little catching up, and a lot of connection.
              </p>
              <EmailEnrollment
                account={account}
                enabled={emailsEnabled}
                onChange={setEmailsEnabled}
              />
              <label>
                Your name
                <input
                  name="name"
                  maxLength={40}
                  placeholder="What your people call you"
                  required
                  autoComplete="given-name"
                />
              </label>
              <button className="button full-width" disabled={busy || !key}>
                {busy ? "Saving your spot…" : "Join the loop"}
                <MoveRight size={18} />
              </button>
              <p className="field-help">
                Your name and submitted replies will be visible to the group.
              </p>
            </form>
          )}
        </section>
      </main>
    </>
  );
}

"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Mail, MoveRight } from "lucide-react";
import { Header } from "./brand";
import { Notice } from "./ui";
import { useEmailAccount } from "./email-account";
function destination(value: string | null) {
  return value &&
    /^\/(app|new|loop\/[a-f0-9-]{36}|join\/[a-f0-9-]{36})([?#].*)?$/.test(value)
    ? value
    : "/app";
}
export default function Login() {
  const account = useEmailAccount();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [requestId, setRequestId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [next, setNext] = useState("/app");
  useEffect(() => {
    setNext(
      destination(
        new URLSearchParams(location.hash.slice(1)).get("next") ||
          new URLSearchParams(location.search).get("next"),
      ),
    );
  }, []);
  async function submit(action: string) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, email, code, requestId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      if (action === "request") setRequestId(d.requestId);
      else if (action === "logout") location.assign("/login");
      else location.assign(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Header />
      <main className="join-page">
        <section className="form-card">
          <div className="success-icon">
            <Mail />
          </div>
          <span className="eyebrow">YOUR PEOPLE ARE WAITING</span>
          <h1>
            {account.email
              ? "You’re signed in."
              : requestId
                ? "Check your inbox."
                : "A little closer, again."}
          </h1>
          {error && <Notice>{error}</Notice>}
          {account.email ? (
            <>
              <p>{account.email}</p>
              <Link className="button full-width" href={next}>
                Back to your loop <MoveRight size={18} />
              </Link>
              <button
                className="text-link"
                onClick={() => submit("logout")}
                disabled={busy}
              >
                Sign out on this device
              </button>
            </>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit(requestId ? "verify" : "request");
              }}
            >
              <p>
                {requestId
                  ? `We sent a six-digit code to ${email}. Enter it below; it expires in 10 minutes.`
                  : "Sign in or create your account with a code sent to your email. No password to remember."}
              </p>
              {!account.loading && !account.configured && (
                <Notice>
                  Email sign-in is waiting for a verified sender to be
                  connected. You can still create a loop and use your personal
                  access link.
                </Notice>
              )}
              {requestId ? (
                <label>
                  Sign-in code
                  <input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    autoFocus
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  />
                </label>
              ) : (
                <label>
                  Your email
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={254}
                    required
                  />
                </label>
              )}
              <button
                className="button full-width"
                disabled={busy || !account.configured}
              >
                {busy
                  ? "One moment…"
                  : requestId
                    ? "Sign in"
                    : "Email me a sign-in code"}
                <MoveRight size={18} />
              </button>
              {requestId && (
                <button
                  className="text-link"
                  type="button"
                  onClick={() => {
                    setRequestId("");
                    setCode("");
                  }}
                >
                  Use a different email or request a new code
                </button>
              )}
            </form>
          )}
        </section>
      </main>
    </>
  );
}

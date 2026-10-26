"use client";
import { useEffect, useState } from "react";
import { Header } from "@/components/brand";
import { Notice } from "@/components/ui";
export default function Preferences() {
  const [token, setToken] = useState("");
  const [data, setData] = useState<{ name: string; enabled: boolean } | null>(
    null,
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function update(value: string, enabled?: boolean) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/email-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: value, enabled }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setData(d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const value =
      new URLSearchParams(location.hash.slice(1)).get("token") || "";
    setToken(value);
    update(value);
  }, []);
  return (
    <>
      <Header />
      <main className="join-page">
        <section className="form-card">
          <h1>Your inbox, your rhythm.</h1>
          {error && <Notice>{error}</Notice>}
          {data && (
            <>
              <p>{data.name}</p>
              <p>
                {data.enabled
                  ? "You receive new response forms, reminders and published newsletters."
                  : "Emails are turned off for this loop. You can still visit the group and share updates."}
              </p>
              <button
                disabled={busy}
                className="button full-width"
                onClick={() => update(token, !data.enabled)}
              >
                {data.enabled
                  ? "Turn off emails for this loop"
                  : "Turn emails back on"}
              </button>
            </>
          )}
        </section>
      </main>
    </>
  );
}

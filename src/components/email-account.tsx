"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
export function useEmailAccount() {
  const [state, setState] = useState<{
    loading: boolean;
    configured: boolean;
    email: string | null;
  }>({ loading: true, configured: false, email: null });
  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) =>
        setState({
          loading: false,
          configured: d.configured,
          email: d.account?.email || null,
        }),
      )
      .catch(() =>
        setState({ loading: false, configured: false, email: null }),
      );
  }, []);
  return state;
}
export function EmailEnrollment({
  account,
  enabled,
  onChange,
}: {
  account: ReturnType<typeof useEmailAccount>;
  enabled: boolean;
  onChange: (value: boolean) => void;
}) {
  const [next, setNext] = useState("/new");
  useEffect(
    () => setNext(location.pathname + location.search + location.hash),
    [],
  );
  return (
    <div className="email-enrollment">
      <Mail size={20} />
      <div>
        <strong>
          {account.email
            ? "Keep the ritual going."
            : "Bring your loop to your inbox."}
        </strong>
        {account.email ? (
          <>
            <p>Signed in as {account.email}</p>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => onChange(e.target.checked)}
              />
              Email me new forms, reminders, and newsletters.
            </label>
          </>
        ) : account.loading ? (
          <p>Checking your sign-in…</p>
        ) : (
          <>
            <p>
              {account.configured
                ? "Sign in with your email to receive each new form and newsletter, and return on any device."
                : "Group creation works now. Email sign-in and recurring delivery are waiting for the site owner to connect a verified sender."}
            </p>
            {account.configured && (
              <Link
                className="text-link"
                href={`/login#next=${encodeURIComponent(next)}`}
              >
                Sign in with email →
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}

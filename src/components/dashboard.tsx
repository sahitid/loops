"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, Heart, Plus, Users } from "lucide-react";
import { Header, Flower, Avatar } from "./brand";
import { Loading, Notice } from "./ui";
import type { PublicLoop } from "@/lib/model";
export default function Dashboard() {
  const [loops, setLoops] = useState<PublicLoop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/loops")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setLoops(d.loops);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  return (
    <>
      <Header />
      <main className="dashboard">
        <div className="dashboard-heading">
          <div>
            <span className="eyebrow">A LITTLE LESS DISTANCE</span>
            <h1>
              Your people,
              <br />
              <em>all in one place.</em>
            </h1>
            <p>Small updates. Big feelings. Pick up where you left off.</p>
          </div>
          <Link href="/new" className="button">
            <Plus size={18} /> Start a new loop
          </Link>
        </div>
        {loading ? (
          <Loading />
        ) : error ? (
          <Notice>{error}</Notice>
        ) : loops.length ? (
          <div className="loop-grid">
            {loops.map((loop) => (
              <Link
                className={`loop-card ${loop.color}`}
                href={`/loop/${loop.id}`}
                key={loop.id}
              >
                <div className="loop-card-top">
                  <Heart size={28} />
                  <ArrowUpRight size={22} />
                </div>
                <h2>{loop.name}</h2>
                <p>
                  {loop.description ||
                    "A little piece of everyone, in one place."}
                </p>
                <div className="card-people">
                  {loop.members.slice(0, 4).map((m, i) => (
                    <Avatar key={m.id} name={m.name} index={i} />
                  ))}
                  <span>
                    {loop.members.length}{" "}
                    {loop.members.length === 1 ? "person" : "people"}
                  </span>
                </div>
                <div className="loop-card-bottom">
                  <span>
                    <CalendarDays size={14} />
                    {loop.paused
                      ? "Taking a little pause"
                      : `Next issue ${new Date(loop.nextDelivery).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                  </span>
                  <span>
                    No. {String(loop.current.number).padStart(3, "0")}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Flower />
            <h2>Good company starts here.</h2>
            <p>
              Make a little space for your favorite people.
              <br />
              Create a loop, share the invitation, and let the stories begin.
            </p>
            <Link href="/new" className="button">
              Start your first loop <ArrowUpRight size={18} />
            </Link>
            <Link href="/demo" className="text-link">
              Or explore a sample loop
            </Link>
          </div>
        )}
        <div className="dashboard-note">
          <Users size={20} />
          <p>
            <strong>Already part of a loop?</strong> Open the personal access
            link you saved, or ask the owner for an invitation. Your loops stay
            remembered in this browser.
          </p>
        </div>
      </main>
    </>
  );
}

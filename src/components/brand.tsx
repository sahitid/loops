import Link from "next/link";
import { ArrowUpRight, Heart, MoveRight } from "lucide-react";
export function LoopMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="32"
      height="32"
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M20 21C9 5 2 18 8 25c6 7 12-2 12-5S27 6 33 15c6 10-8 19-13 6Z"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="m15 30 3 4m8-29 1 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="Loops home">
      <LoopMark />
      <span>
        loops<span className="logo-period">.</span>
      </span>
    </Link>
  );
}
export function Header() {
  return (
    <header className="site-header">
      <Logo />
      <nav className="desktop-nav">
        <Link href="/#how-it-works">How it works</Link>
        <Link href="/demo">
          A peek inside <ArrowUpRight size={14} />
        </Link>
      </nav>
      <div className="header-actions">
        <Link href="/app" className="text-link">
          My loops
        </Link>
        <Link href="/new" className="button button-small">
          Start a loop <MoveRight size={17} />
        </Link>
      </div>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="site-footer">
      <Logo />
      <span>A little less scrolling. A little more us.</span>
      <span>
        Made for your people <Heart size={13} />
      </span>
    </footer>
  );
}
export function Avatar({
  name,
  size = "",
  index = 0,
}: {
  name: string;
  size?: string;
  index?: number;
}) {
  return (
    <span className={`avatar ${size} avatar-${index % 5}`} title={name}>
      {name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")}
    </span>
  );
}
export function Flower({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="95"
      height="95"
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M50 35C26 5 8 33 35 50 3 63 28 90 49 65 64 96 94 70 66 51 94 31 66 7 50 35Z"
        fill="currentColor"
      />
      <circle cx="50" cy="50" r="10" fill="#FFF9EE" />
      <path
        d="m47 48 1 1m6-1 1 1m-8 6c3 3 6 3 9-1"
        stroke="#44483D"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

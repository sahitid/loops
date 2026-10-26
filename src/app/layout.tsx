import type { Metadata } from "next";
import { DM_Sans, Lora } from "next/font/google";
import "./globals.css";
const sans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });
const serif = Lora({ subsets: ["latin"], variable: "--font-serif" });
export const metadata: Metadata = {
  title: {
    default: "Loops — A little closer, one letter at a time",
    template: "%s · Loops",
  },
  description:
    "A private group newsletter for your favorite people. Share little life updates, ask thoughtful questions, and stay in the loop.",
  referrer: "no-referrer",
  robots: { index: true, follow: true },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={`${sans.variable} ${serif.variable}`}>{children}</body>
    </html>
  );
}

import Link from "next/link";
import {
  ArrowDown,
  ArrowUpRight,
  Heart,
  LockKeyhole,
  MoveRight,
  PenLine,
  Send,
  Sparkles,
} from "lucide-react";
import { Avatar, Flower, Footer, Header, LoopMark } from "@/components/brand";
export default function Home() {
  return (
    <>
      <Header />
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="tiny-line" /> A LITTLE MORE LIFE. A LITTLE LESS
              DISTANCE.
            </div>
            <h1>
              Private group newsletters for
              <br />
              friends, families & your people.
            </h1>
            <p>
              Speak your week. Share your camera roll. Stay a little closer.
              <br className="desktop-break" /> All the little pieces of your
              lives, in one beautiful newsletter.
            </p>
            <div className="hero-buttons">
              <Link href="/new" className="button">
                Start your loop <MoveRight size={19} />
              </Link>
              <Link href="/demo" className="text-link">
                See a sample loop <ArrowUpRight size={17} />
              </Link>
            </div>
            <div className="hero-footnote">
              <LockKeyhole size={13} />
              <span>Just your people. No feeds. No followers.</span>
            </div>
          </div>
          <div
            className="hero-art"
            aria-label="Preview of a newsletter from a group of friends"
          >
            <span className="handwritten art-note">
              a little life update,
              <br />a lot of connection.
            </span>
            <svg className="curved-arrow" viewBox="0 0 100 70">
              <path d="M8 6q-7 50 68 39m-13-9 17 8-14 13" />
            </svg>
            <div className="paper-back" />
            <article className="preview-paper">
              <div className="paper-top">
                <LoopMark />
                <span>THE SUNDAY PEOPLE</span>
                <span>NO. 008</span>
              </div>
              <div className="paper-heading">
                <span className="eyebrow">OCTOBER 25, 2026</span>
                <h2>
                  The good, the little,
                  <br />& everything between.
                </h2>
                <div className="paper-avatars">
                  {["Maya", "Alex", "Sam", "Jules"].map((n, i) => (
                    <Avatar key={n} name={n} index={i} />
                  ))}
                  <span>4 people. A whole lot of life.</span>
                </div>
              </div>
              <div className="paper-question">
                <span>01 / THE EVERYDAY</span>
                <h3>
                  What’s a small thing that
                  <br />
                  made your week better?
                </h3>
              </div>
              <div className="paper-answer">
                <Avatar name="Maya" index={0} />
                <div>
                  <strong>
                    Maya <span>Brooklyn, NY</span>
                  </strong>
                  <p>
                    I finally learned my neighbor’s name. She brought over a bag
                    of lemons from her sister’s tree. Made the whole city feel a
                    little smaller. 🍋
                  </p>
                </div>
              </div>
              <div className="paper-answer second-answer">
                <Avatar name="Alex" index={1} />
                <div>
                  <strong>
                    Alex <span>Austin, TX</span>
                  </strong>
                  <p>
                    A long walk with absolutely nowhere to be. More of that,
                    please.
                  </p>
                </div>
              </div>
              <div className="paper-photos">
                <figure>
                  <img
                    src="/demo/bread.jpg"
                    alt="Jules’ homemade sourdough bread"
                  />
                  <figcaption>Jules’ small victory 🍞</figcaption>
                </figure>
                <figure>
                  <img src="/demo/lake.jpg" alt="Alex’s mountain lake trip" />
                  <figcaption>A little mountain air 🌿</figcaption>
                </figure>
              </div>
              <div className="paper-bottom">
                A little piece of everyone, in one place. <Heart size={12} />
              </div>
            </article>
            <Flower className="hero-flower" />
            <div className="postage-stamp">
              <Heart size={22} />
              <span>WITH LOVE</span>
              <small>FROM YOUR PEOPLE</small>
            </div>
          </div>
        </section>
        <div className="relationship-strip">
          <span>For the friends in different time zones.</span>
          <span className="asterisk">✳</span>
          <span>The family with a lot going on.</span>
          <span className="asterisk">✳</span>
          <span>The people who feel like home.</span>
        </div>
        <section id="how-it-works" className="how-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">A SMALL RITUAL. A BIG DIFFERENCE.</span>
              <h2>
                Keeping up shouldn’t
                <br />
                be another thing to keep up with.
              </h2>
            </div>
            <p>
              A few questions, a few minutes, and a lovely
              <br />
              little window into each other’s lives.
            </p>
          </div>
          <div className="steps">
            <div>
              <span className="step-number">01</span>
              <div className="step-icon peach">
                <Heart />
              </div>
              <h3>Gather your people.</h3>
              <p>
                Start a loop for your friends, family, or favorite humans.
                Invite them with a private link.
              </p>
            </div>
            <div>
              <span className="step-number">02</span>
              <div className="step-icon sage">
                <PenLine />
              </div>
              <h3>Share a little life.</h3>
              <p>
                Record a voice note, add your favorite photos and videos, or
                answer a few thoughtful questions.
              </p>
            </div>
            <div>
              <span className="step-number">03</span>
              <div className="step-icon butter">
                <Send />
              </div>
              <h3>Find each other in the details.</h3>
              <p>
                Everyone’s stories become one beautiful issue. A keepsake you
                can come back to, together.
              </p>
            </div>
          </div>
        </section>
        <section className="prompt-section">
          <div>
            <span className="eyebrow">GO BEYOND “HOW ARE YOU?”</span>
            <h2>
              Good questions.
              <br />
              <em>Even better conversations.</em>
            </h2>
            <p>
              From the beautifully mundane to the surprisingly deep.
              <br />
              There’s always something new to learn about your people.
            </p>
            <Link href="/demo" className="text-link">
              Explore a sample loop <MoveRight size={17} />
            </Link>
          </div>
          <div className="prompt-stack">
            <div className="prompt-card">
              <Sparkles size={20} />
              <span>A LITTLE JOY</span>
              <h3>
                What’s something you’re
                <br />
                looking forward to?
              </h3>
              <span className="prompt-footer">
                A small question. A place to start. <ArrowDown size={17} />
              </span>
            </div>
          </div>
        </section>
        <section className="closing-section">
          <Flower />
          <span className="eyebrow">SAME PEOPLE. A NEW WAY TO STAY CLOSE.</span>
          <h2>Make room for each other.</h2>
          <p>Your people have stories. Give them a place to land.</p>
          <Link href="/new" className="button">
            Start your first loop <MoveRight size={18} />
          </Link>
          <span className="closing-note">
            Free to start. Full of possibility.
          </span>
        </section>
      </main>
      <Footer />
    </>
  );
}

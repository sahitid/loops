"use client";
import { useEffect, useRef, useState } from "react";
import {
  Mic,
  Square,
  Sparkles,
  AudioLines,
  ArrowDownToLine,
} from "lucide-react";
import { Notice } from "./ui";
type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult:
    | ((event: {
        results: {
          length: number;
          [n: number]: {
            isFinal: boolean;
            [n: number]: { transcript: string };
          };
        };
        resultIndex: number;
      }) => void)
    | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
export default function VoiceNote({
  id,
  onDraft,
  onAudio,
  demo = false,
}: {
  id: string;
  onDraft: (text: string) => void;
  onAudio: (file: File) => Promise<void>;
  demo?: boolean;
}) {
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [audio, setAudio] = useState<{ url: string; file: File } | null>(null);
  const [supported, setSupported] = useState(false);
  const [audioSaved, setAudioSaved] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const running = useRef(false);
  const chunks = useRef<Blob[]>([]);
  const speechBase = useRef("");
  useEffect(() => {
    setSupported(
      typeof navigator.mediaDevices?.getUserMedia === "function" &&
        typeof window.MediaRecorder !== "undefined",
    );
    return () => {
      running.current = false;
      recognition.current?.abort();
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  useEffect(
    () => () => {
      if (audio) URL.revokeObjectURL(audio.url);
    },
    [audio],
  );
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);
  useEffect(() => {
    if (seconds >= 600 && recording) stop();
  }, [seconds, recording]);
  function stop() {
    running.current = false;
    recognition.current?.stop();
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach((t) => t.stop());
    setRecording(false);
    setInterim("");
  }
  async function start() {
    setError("");
    setSeconds(0);
    setAudioSaved(false);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      chunks.current = [];
      const type = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find(
        (t) => MediaRecorder.isTypeSupported(t),
      );
      const rec = new MediaRecorder(
        stream.current,
        type ? { mimeType: type } : undefined,
      );
      recorder.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      rec.onstop = () => {
        const mime = rec.mimeType.split(";")[0] || "audio/webm";
        const file = new File(
          chunks.current,
          `voice-note.${mime.includes("mp4") ? "m4a" : "webm"}`,
          { type: mime },
        );
        setAudio({ file, url: URL.createObjectURL(file) });
      };
      rec.start(1000);
      running.current = true;
      setRecording(true);
      const w = window as unknown as {
        SpeechRecognition?: new () => Recognition;
        webkitSpeechRecognition?: new () => Recognition;
      };
      const Speech = w.SpeechRecognition || w.webkitSpeechRecognition;
      if (Speech) {
        const r = new Speech();
        recognition.current = r;
        r.continuous = true;
        r.interimResults = true;
        r.lang = "en-US";
        speechBase.current = transcript.trim();
        r.onresult = (e) => {
          let final = "";
          let partial = "";
          for (let i = 0; i < e.results.length; i++) {
            if (e.results[i].isFinal) final += e.results[i][0].transcript + " ";
            else partial += e.results[i][0].transcript;
          }
          setTranscript(
            [speechBase.current, final.trim()].filter(Boolean).join("\n"),
          );
          setInterim(partial);
        };
        r.onerror = (e) => {
          if (e.error !== "no-speech" && e.error !== "aborted")
            setError(
              "Live transcription isn’t available right now. Your audio is still recording; you can type or paste the transcript below.",
            );
        };
        r.onend = () => {
          if (running.current) {
            setTranscript((t) => {
              speechBase.current = t;
              return t;
            });
            try {
              r.start();
            } catch {}
          }
        };
        try {
          r.start();
        } catch {
          setError(
            "Your audio is recording. Live transcription is unavailable in this browser; type or paste your notes below.",
          );
        }
      } else
        setError(
          "This browser can record audio but doesn’t support live transcription. Use Chrome for live text, or type your notes below.",
        );
    } catch {
      stream.current?.getTracks().forEach((t) => t.stop());
      setError(
        "Microphone access wasn’t available. Allow it in your browser, or type your update below.",
      );
    }
  }
  return (
    <section className="voice-card">
      <div className="voice-heading">
        <div className="voice-icon">
          <AudioLines size={25} />
        </div>
        <div>
          <h3>Tell us about your {period}.</h3>
          <p>A voice note now. A thoughtful update in a moment.</p>
        </div>
        <select
          aria-label="Summary period"
          value={period}
          onChange={(e) => setPeriod(e.target.value as "week" | "month")}
        >
          <option value="week">This week</option>
          <option value="month">This month</option>
        </select>
      </div>
      <div className={`recording-panel ${recording ? "is-recording" : ""}`}>
        <div className="waveform" aria-hidden="true">
          {Array.from({ length: 31 }, (_, i) => (
            <span
              key={i}
              style={{
                height: `${8 + ((i * 19) % 29)}px`,
                animationDelay: `${i * 0.04}s`,
              }}
            />
          ))}
        </div>
        <button
          type="button"
          className={`button ${recording ? "button-stop" : ""}`}
          disabled={!supported || busy}
          onClick={recording ? stop : start}
        >
          {recording ? <Square size={16} /> : <Mic size={17} />}{" "}
          {recording
            ? `Stop · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
            : "Record a voice note"}
        </button>
        <small>Up to 10 minutes. Rambling very much welcome.</small>
      </div>
      <p className="field-help">
        Live transcription uses your browser’s speech service and may send audio
        to its provider. Your transcript goes to Claude only when you choose
        “Make a draft.”
      </p>
      {error && <Notice>{error}</Notice>}
      {audio && (
        <div className="audio-preview">
          <audio controls src={audio.url} />
          <a
            href={audio.url}
            download={audio.file.name}
            className="icon-button"
            aria-label="Download recording"
          >
            <ArrowDownToLine size={18} />
          </a>
          <button
            className="text-link"
            disabled={busy || audioSaved}
            onClick={async () => {
              setBusy(true);
              try {
                await onAudio(audio.file);
                setAudioSaved(true);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {audioSaved ? "Added to update" : "Add recording to update"}
          </button>
        </div>
      )}
      <label className="transcript-label">
        Your transcript or rough notes
        <textarea
          rows={5}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          maxLength={20000}
          placeholder="What happened? What made you laugh? What’s been on your mind? Start talking, or type a few notes here."
        />
      </label>
      {interim && (
        <p className="interim" aria-live="polite">
          {interim}
        </p>
      )}
      <div className="draft-actions">
        <button
          disabled={busy || recording || transcript.trim().length < 20}
          className="button"
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              if (demo)
                throw new Error(
                  "Create your own loop to use Claude drafting. This sample doesn’t send data to AI.",
                );
              const r = await fetch("/api/draft", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, transcript, period }),
              });
              const d = await r.json();
              if (!r.ok) throw new Error(d.error);
              onDraft(d.draft);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Sparkles size={17} />
          {busy ? "Working on your update…" : "Make a draft with Claude"}
        </button>
        <button
          className="text-link"
          disabled={!transcript.trim() || recording}
          onClick={() => onDraft(transcript)}
        >
          Use my words as they are
        </button>
      </div>
      <p className="field-help">
        You’ll review and edit the draft before anything is shared.
      </p>
    </section>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { TRACK_QUIZ, TOTAL_QUESTIONS, fullQuiz, resolveTrack, scoreQuiz, isComplete } from "@/lib/quiz";
import { domainCard } from "@/app/_components/domains";
import DomainArt from "@/app/_components/DomainArt";

const OPTION_LETTERS = ["A", "B", "C", "D"];

export default function FitFinder() {
  const [step, setStep] = useState(0);          // index into QUIZ, or QUIZ.length once done
  const [answers, setAnswers] = useState({});
  const [messages, setMessages] = useState([]);  // { role, content }
  const [draft, setDraft] = useState("");
  const [chatState, setChatState] = useState("idle"); // idle | thinking | unavailable | spent
  const [chatError, setChatError] = useState("");
  const [remaining, setRemaining] = useState(null); // advisor questions left on this IP
  const chatEndRef = useRef(null);
  const startedRef = useRef(false);

  // Stage one sorts tech vs corp; stage two is drawn from whichever side won,
  // so the question list only exists once the first four are answered.
  const questions = fullQuiz(answers);
  const done = step >= TOTAL_QUESTIONS;
  const ranking = done ? scoreQuiz(answers) : [];
  const top = ranking.slice(0, 3);
  const { track } = resolveTrack(answers);

  function choose(questionId, optionId) {
    setAnswers((a) => ({ ...a, [questionId]: optionId }));
    // small pause so the selection is visible before advancing
    setTimeout(() => setStep((s) => s + 1), 180);
  }

  async function send(history) {
    setChatState("thinking");
    setChatError("");
    try {
      const res = await fetch("/api/fit/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, messages: history }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "no_api_key") setChatState("unavailable");
        else if (data.code === "limit_reached") { setChatState("spent"); setRemaining(0); }
        else setChatState("idle");
        setChatError(data.error || "The advisor could not answer.");
        return;
      }
      setMessages([...history, { role: "assistant", content: data.reply }]);
      if (typeof data.remaining === "number") setRemaining(data.remaining);
      setChatState("idle");
    } catch {
      setChatError("Network problem — check your connection and try again.");
      setChatState("idle");
    }
  }

  // Kick off the conversation once the quiz is finished
  useEffect(() => {
    if (!done || startedRef.current || !isComplete(answers)) return;
    startedRef.current = true;
    send([{ role: "user", content: "I just finished the quiz. Which two domains should I pick, and why?" }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, chatState]);

  function onSubmit(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || chatState === "thinking") return;
    const history = [...messages, { role: "user", content: text }];
    setMessages(history);
    setDraft("");
    send(history);
  }

  function restart() {
    startedRef.current = false;
    setAnswers({});
    setMessages([]);
    setChatError("");
    setChatState("idle");
    setStep(0);
  }

  // ── quiz ───────────────────────────────────────────────────────────────────
  if (!done) {
    const q = questions[step];
    const pct = Math.round((step / TOTAL_QUESTIONS) * 100);
    const inStageTwo = step >= TRACK_QUIZ.length;

    return (
      <div className="formCard fitCard">
        <div className="fitProgress" aria-hidden="true">
          <div style={{ width: `${pct}%` }} />
        </div>
        <div className="fitStepLabel">
          Question {step + 1} of {TOTAL_QUESTIONS}
          {inStageTwo && (
            <span style={{ color: track === "tech" ? "var(--red-soft)" : "var(--purple-soft)", marginLeft: 10 }}>
              · {track === "tech" ? "TECHNICAL TRACK" : "CORPORATE TRACK"}
            </span>
          )}
        </div>

        {inStageTwo && step === TRACK_QUIZ.length && (
          <p className="fitTrackNote">
            Your first four answers lean {track === "tech" ? "technical" : "corporate"} — these last
            four narrow it down within that side.
          </p>
        )}

        <h2 className="fitPrompt">{q.prompt}</h2>

        <div className="fitOptions">
          {q.options.map((opt, i) => (
            <button
              key={opt.id}
              type="button"
              className={`fitOption ${answers[q.id] === opt.id ? "chosen" : ""}`}
              onClick={() => choose(q.id, opt.id)}
            >
              <span className="letter">{OPTION_LETTERS[i]}</span>
              <span>{opt.text}</span>
            </button>
          ))}
        </div>

        {step > 0 && (
          <button type="button" className="btnQuiet" style={{ marginTop: 20 }} onClick={() => setStep((s) => s - 1)}>
            ← Back
          </button>
        )}
      </div>
    );
  }

  // ── result + advisor ───────────────────────────────────────────────────────
  return (
    <div className="fitResult">
      <section className="formCard fitCard">
        <div className="fitStepLabel">
          YOUR RANKING
          <span style={{ color: track === "tech" ? "var(--red-soft)" : "var(--purple-soft)", marginLeft: 10 }}>
            · {track === "tech" ? "TECHNICAL" : "CORPORATE"}
          </span>
        </div>
        <h2 className="fitPrompt" style={{ marginBottom: 22 }}>
          Based on your answers, these fit you best
        </h2>

        <div className="fitPodium">
          {top.map((r, i) => {
            const card = domainCard(r.key);
            if (!card) return null;
            return (
              <article key={r.key} className="fitPick" style={{ borderColor: card.border }}>
                <div className="fitPickArt" style={{ background: `linear-gradient(150deg,${card.wash},transparent 70%)` }}>
                  <DomainArt motif={card.key} accent={card.color} />
                </div>
                <div className="fitPickBody">
                  <div className="fitRank" style={{ color: card.color }}>#{i + 1}</div>
                  <h3 style={{ color: card.color }}>{card.label}</h3>
                  <div className="fitBar" aria-label={`${r.pct}% match`}>
                    <div style={{ width: `${Math.min(100, r.pct)}%`, background: card.color }} />
                  </div>
                  <p>{card.teaser}</p>
                </div>
              </article>
            );
          })}
        </div>

        {ranking.length > 3 && (
          <p className="fitAlso">
            Also scored: {ranking.slice(3, 6).map((r) => `${r.label} (${r.pct}%)`).join(" · ")}
          </p>
        )}
      </section>

      <section className="formCard fitCard">
        <div className="fitStepLabel">
          TALK IT THROUGH
          {remaining !== null && (
            <span style={{ color: remaining > 0 ? "#8d8091" : "var(--red-soft)", marginLeft: 10 }}>
              · {remaining} QUESTION{remaining === 1 ? "" : "S"} LEFT
            </span>
          )}
        </div>
        <h2 className="fitPrompt" style={{ marginBottom: 6 }}>Ask the advisor</h2>
        <p style={{ color: "#8d8091", fontSize: 14.5, margin: "0 0 18px", lineHeight: 1.6 }}>
          It has read your answers. Push back on it, tell it what it missed, ask what a domain
          is really like day to day. You get five questions in total.
        </p>

        <div className="chatLog">
          {messages.map((m, i) => (
            <div key={i} className={`bubble ${m.role}`}>{m.content}</div>
          ))}
          {chatState === "thinking" && <div className="bubble assistant thinking">Thinking…</div>}
          {chatError && (
            <div className="alert err" style={{ margin: "10px 0 0" }}>
              {chatError}
              {chatState === "unavailable" && (
                <div style={{ marginTop: 8, fontSize: 13, color: "#a99bad" }}>
                  Set <code>GROQ_API_KEY</code> in <code>.env.local</code> to switch the advisor on.
                  Your ranking above does not need it.
                </div>
              )}
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {chatState !== "unavailable" && chatState !== "spent" && (
          <form onSubmit={onSubmit} className="chatForm">
            <input
              className="input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g. I have never shipped anything — does web still make sense?"
              maxLength={800}
              disabled={chatState === "thinking"}
              aria-label="Message the advisor"
            />
            <button type="submit" className="btn grad sm" disabled={chatState === "thinking" || !draft.trim()}>
              Send
            </button>
          </form>
        )}

        <div className="fitActions">
          <Link href="/apply" className="btn grad">Apply with these domains <span>→</span></Link>
          <button type="button" className="btnQuiet" onClick={restart}>Retake the quiz</button>
        </div>
      </section>
    </div>
  );
}

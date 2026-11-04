"use client";

import { useEffect, useRef, useState } from "react";
import type { Appointment } from "@/lib/demo-data";
import { FIRST_QUICK_REPLIES, GREETING, reply, type ChatState } from "@/lib/mock-assistant";

type Message = { from: "cliente" | "ai"; text: string };

export function ChatPreview({
  appointments,
  onBook,
}: {
  appointments: Appointment[];
  onBook: (booking: Omit<Appointment, "id">) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([{ from: "ai", text: GREETING }]);
  const [quickReplies, setQuickReplies] = useState<string[]>(FIRST_QUICK_REPLIES);
  const [state, setState] = useState<ChatState>({ step: "service" });
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  function send(text: string) {
    if (!text.trim() || typing) return;
    setMessages((m) => [...m, { from: "cliente", text }]);
    setInput("");
    setQuickReplies([]);
    setTyping(true);

    // Piccola pausa per simulare il tempo di risposta del modello
    setTimeout(() => {
      const r = reply(text, state, appointments);
      setMessages((m) => [...m, { from: "ai", text: r.text }]);
      setQuickReplies(r.quickReplies);
      setState(r.next);
      setTyping(false);
      if (r.booking) onBook(r.booking);
    }, 700);
  }

  return (
    <section aria-label="Anteprima dell'assistente" className="flex h-[620px] flex-col rounded-2xl border border-line bg-white">
      <header className="flex items-center gap-3 border-b border-line p-4">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-mint font-display font-bold text-bottle">A</span>
        <div className="flex-1 leading-tight">
          <p className="font-semibold">Assistente di Salone Aurora</p>
          <p className="text-xs text-ink-soft">Funzione in arrivo</p>
        </div>
      </header>

      <p className="bg-paper px-4 py-2 text-xs text-ink-soft">
        Anteprima di una funzione in arrivo, con risposte simulate. Oggi i clienti prenotano dalla pagina del salone.
      </p>

      <ol ref={listRef} className="flex flex-1 flex-col gap-2 overflow-y-auto p-4 text-sm" aria-live="polite">
        {messages.map((m, i) => (
          <li
            key={i}
            className={`animate-bubble-in max-w-[85%] rounded-2xl px-3 py-2 ${
              m.from === "cliente" ? "self-end rounded-br-md bg-bottle text-white" : "self-start rounded-bl-md bg-paper"
            }`}
          >
            {m.text}
          </li>
        ))}
        {typing && (
          <li className="self-start rounded-2xl rounded-bl-md bg-paper px-3 py-2 text-ink-soft">Sta scrivendo…</li>
        )}
      </ol>

      {quickReplies.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          {quickReplies.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => send(q)}
              className="rounded-full border border-bottle/30 px-3 py-1.5 text-sm text-bottle hover:bg-mint"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2 border-t border-line p-3"
      >
        <label htmlFor="chat-input" className="sr-only">Scrivi un messaggio</label>
        <input
          id="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Es. barba alle 16"
          autoComplete="off"
          maxLength={200}
          className="flex-1 rounded-full border border-line bg-paper px-4 py-2 text-sm outline-none focus:border-bottle"
        />
        <button
          type="submit"
          disabled={!input.trim() || typing}
          className="rounded-full bg-bottle px-4 py-2 text-sm font-semibold text-white hover:bg-bottle-dark disabled:opacity-40"
        >
          Invia
        </button>
      </form>
    </section>
  );
}

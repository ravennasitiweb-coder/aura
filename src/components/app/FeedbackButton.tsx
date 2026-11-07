"use client";

import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { sendFeedback } from "@/app/app/feedback-actions";

/** Pulsante fisso "Aiuto": durante la prova i clienti segnalano problemi e idee in un tocco */
export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const pathname = usePathname();

  return (
    <div className="fixed bottom-4 right-4 z-40 print:hidden">
      {open && (
        <div className="mb-3 w-72 rounded-2xl border border-line bg-white p-4 shadow-xl">
          <p className="font-semibold">Qualcosa non va o hai un&apos;idea?</p>
          {result?.ok ? (
            <p className="mt-2 text-sm text-bottle">{result.text}</p>
          ) : (
            <>
              <textarea
                rows={4}
                maxLength={2000}
                value={text}
                onChange={(e) => setText(e.target.value)}
                aria-label="Il tuo messaggio"
                placeholder="Scrivi qui, anche due parole."
                className="mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-bottle"
              />
              {result && <p className="mt-1 text-sm text-cherry">{result.text}</p>}
              <button
                type="button"
                disabled={pending || text.trim().length < 3}
                onClick={() => start(async () => setResult(await sendFeedback(text, pathname ?? "")))}
                className="mt-2 w-full rounded-full bg-bottle py-2 text-sm font-semibold text-white hover:bg-bottle-dark disabled:opacity-50"
              >
                {pending ? "Invio…" : "Invia"}
              </button>
            </>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          if (result?.ok) {
            setResult(null);
            setText("");
          }
        }}
        aria-expanded={open}
        className="ml-auto block rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-bottle-dark"
      >
        {open ? "Chiudi" : "Aiuto"}
      </button>
    </div>
  );
}

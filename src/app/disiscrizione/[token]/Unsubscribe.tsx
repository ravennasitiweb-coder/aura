"use client";

import { useState, useTransition } from "react";
import { unsubscribe } from "./actions";

export function Unsubscribe({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  const [pending, start] = useTransition();

  if (state === "done") return <p role="status" className="mt-5 rounded-xl bg-mint px-4 py-3 text-bottle-dark">Fatto: non riceverai più messaggi promozionali.</p>;

  return (
    <div className="mt-5">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setState((await unsubscribe(token)) ? "done" : "error"))}
        className="rounded-full bg-bottle px-6 py-3 font-semibold text-white hover:bg-bottle-dark disabled:opacity-60"
      >
        {pending ? "Un attimo…" : "Disiscrivimi"}
      </button>
      {state === "error" && <p role="alert" className="mt-3 text-sm text-cherry">Link non valido. Contatta direttamente l&apos;attività.</p>}
    </div>
  );
}

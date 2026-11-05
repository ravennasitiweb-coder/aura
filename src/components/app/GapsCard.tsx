"use client";

import { useActionState } from "react";
import { fillTomorrowGaps } from "@/app/app/marketing-actions";
import { FormMessage, SubmitButton } from "@/components/app/ui";

export function GapsCard({ times, reachable }: { times: string[]; reachable: number }) {
  const [state, action] = useActionState(fillTomorrowGaps, {});

  return (
    <section aria-labelledby="gaps-title" className="rounded-2xl border border-line bg-white p-6">
      <h2 id="gaps-title" className="font-display text-xl font-bold">Riempi i buchi di domani</h2>
      {times.length === 0 ? (
        <p className="mt-1 text-ink-soft">Domani l&apos;agenda è piena. Ottimo lavoro!</p>
      ) : (
        <>
          <p className="mt-1 text-ink-soft">
            Ci sono ancora orari liberi, per esempio alle {times.slice(0, 4).join(", ")}.{" "}
            {reachable > 0
              ? `Puoi avvisare ${reachable === 1 ? "1 cliente abituale" : `${reachable} clienti abituali`} con un'email.`
              : "Nessun cliente da avvisare: servono consenso ed email."}
          </p>
          {reachable > 0 && (
            <form action={action} className="mt-4 flex flex-wrap items-center gap-3">
              <SubmitButton pendingLabel="Invio in corso…">Avvisa i clienti</SubmitButton>
              <FormMessage state={state} />
            </form>
          )}
        </>
      )}
      <p className="mt-3 text-xs text-ink-soft">
        Ricevono l&apos;email solo i clienti che hanno accettato i messaggi promozionali, al massimo una volta a settimana.
      </p>
    </section>
  );
}

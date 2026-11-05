"use client";

import { useActionState } from "react";
import { saveCustomerNote } from "@/app/app/customer-actions";
import { FormMessage, INPUT, SubmitButton } from "@/components/app/ui";

export function CustomerNotes({ customerKey, notes, updatedLabel }: { customerKey: string; notes: string; updatedLabel: string | null }) {
  const [state, action] = useActionState(saveCustomerNote, {});

  return (
    <section aria-labelledby="notes-title" className="max-w-2xl rounded-2xl border border-line bg-white p-5">
      <h2 id="notes-title" className="font-semibold">Scheda tecnica</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Formula del colore, prodotti preferiti, allergie, cosa chiede di solito. Visibile solo a te e ai tuoi collaboratori.
      </p>
      <form action={action} className="mt-3 space-y-3">
        <input type="hidden" name="customer_key" value={customerKey} />
        <label htmlFor="customer-notes" className="sr-only">Note sul cliente</label>
        <textarea
          id="customer-notes"
          name="notes"
          rows={5}
          maxLength={2000}
          defaultValue={notes}
          placeholder="Es. Colore: 6.3 + 7.43, ossigeno 20 vol, posa 35 min. Allergica al nichel."
          className={INPUT}
        />
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton variant="secondary">Salva note</SubmitButton>
          <FormMessage state={state} />
          {updatedLabel && !state.ok && <span className="text-xs text-ink-soft">Ultima modifica: {updatedLabel}</span>}
        </div>
      </form>
    </section>
  );
}

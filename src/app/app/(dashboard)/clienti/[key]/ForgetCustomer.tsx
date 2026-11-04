"use client";

import { useActionState } from "react";
import { forgetCustomer } from "@/app/app/actions";
import { FormMessage, SubmitButton } from "@/components/app/ui";

export function ForgetCustomer({ customerKey, name }: { customerKey: string; name: string }) {
  const [state, action] = useActionState(forgetCustomer, {});

  return (
    <section aria-labelledby="forget-title" className="max-w-2xl rounded-2xl border border-cherry/30 p-5">
      <h2 id="forget-title" className="font-semibold">Cancella i dati del cliente</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Da usare se il cliente chiede la cancellazione (diritto all&apos;oblio, GDPR). Nome, telefono, email e note vengono
        rimossi da tutti i suoi appuntamenti; restano solo data e servizio, senza dati personali. Non si può annullare.
      </p>
      <form
        action={action}
        onSubmit={(e) => {
          if (!confirm(`Cancellare definitivamente i dati di ${name}?`)) e.preventDefault();
        }}
        className="mt-4 flex flex-wrap items-center gap-3"
      >
        <input type="hidden" name="customer_key" value={customerKey} />
        <SubmitButton variant="danger" pendingLabel="Cancellazione…">Cancella i dati di {name}</SubmitButton>
        <FormMessage state={state} />
      </form>
    </section>
  );
}

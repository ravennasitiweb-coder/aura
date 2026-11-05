"use client";

import { useActionState } from "react";
import { saveSalonSettings } from "@/app/app/actions";
import { FormMessage, INPUT, LABEL, SubmitButton } from "@/components/app/ui";
import type { Salon } from "@/lib/auth";
import { BUSINESS_TYPES, businessType } from "@/lib/business-types";

export function SettingsForm({ salon, canEdit }: { salon: Salon; canEdit: boolean }) {
  const [state, action] = useActionState(saveSalonSettings, {});

  return (
    <form action={action} className="max-w-xl space-y-5 rounded-2xl border border-line bg-white p-6">
      <div>
        <label htmlFor="business_type" className={LABEL}>Tipo di attività</label>
        <select
          id="business_type"
          name="business_type"
          defaultValue={businessType(salon.business_type).id}
          disabled={!canEdit}
          className={`${INPUT} mt-1.5`}
        >
          {BUSINESS_TYPES.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="name" className={LABEL}>Nome dell&apos;attività</label>
        <input id="name" name="name" required maxLength={80} defaultValue={salon.name} disabled={!canEdit} className={`${INPUT} mt-1.5`} />
      </div>
      <div>
        <label htmlFor="city" className={LABEL}>Città</label>
        <input id="city" name="city" maxLength={80} defaultValue={salon.city ?? ""} disabled={!canEdit} className={`${INPUT} mt-1.5`} />
      </div>
      <div>
        <label htmlFor="slug" className={LABEL}>Indirizzo della pagina di prenotazione</label>
        <div className="mt-1.5 flex items-center rounded-xl border border-line bg-white focus-within:border-bottle">
          <span className="pl-3.5 text-ink-soft">/p/</span>
          <input
            id="slug"
            name="slug"
            required
            maxLength={60}
            defaultValue={salon.slug}
            disabled={!canEdit}
            aria-describedby="slug-hint"
            className="w-full rounded-xl bg-transparent py-2.5 pr-3.5 outline-none"
          />
        </div>
        <p id="slug-hint" className="mt-1.5 text-sm text-ink-soft">
          Se lo cambi dopo averlo condiviso, il vecchio link smetterà di funzionare.
        </p>
      </div>
      {canEdit && (
        <div className="flex items-center gap-4">
          <SubmitButton>Salva impostazioni</SubmitButton>
          <FormMessage state={state} />
        </div>
      )}
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { saveSalonSettings } from "@/app/app/actions";
import { FormMessage, INPUT, LABEL, SubmitButton } from "@/components/app/ui";
import type { Salon } from "@/lib/auth";
import { BusinessTypeSelect } from "@/components/app/BusinessTypeSelect";
import { businessType } from "@/lib/business-types";

export function SettingsForm({ salon, canEdit }: { salon: Salon; canEdit: boolean }) {
  const [state, action] = useActionState(saveSalonSettings, {});

  return (
    <form action={action} className="max-w-xl space-y-5 rounded-2xl border border-line bg-white p-6">
      <div>
        <label htmlFor="business_type" className={LABEL}>Tipo di attività</label>
        <BusinessTypeSelect
          id="business_type"
          defaultValue={businessType(salon.business_type).id}
          disabled={!canEdit}
          className={`${INPUT} mt-1.5`}
        />
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

      <fieldset className="space-y-4 border-t border-line pt-5">
        <legend className="font-display text-lg font-bold">Messaggi automatici ai clienti</legend>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="reminders_enabled" defaultChecked={salon.reminders_enabled} disabled={!canEdit} className="mt-0.5 h-4 w-4 accent-bottle" />
          <span>
            <span className="font-semibold">Promemoria il giorno prima</span>
            <span className="block text-ink-soft">Con i pulsanti Confermo, Sposta e Annullo. Solo a chi ha lasciato l&apos;email.</span>
          </span>
        </label>
        <div>
          <label htmlFor="cancel_hours" className={LABEL}>Il cliente può spostare o annullare online fino a</label>
          <select id="cancel_hours" name="cancel_hours" defaultValue={salon.cancel_hours} disabled={!canEdit} className={`${INPUT} mt-1.5`}>
            {[0, 2, 6, 12, 24, 48, 72].map((h) => (
              <option key={h} value={h}>{h === 0 ? "l'inizio dell'appuntamento" : `${h} ore prima`}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="recall_days" className={LABEL}>Richiama i clienti che non tornano</label>
          <select id="recall_days" name="recall_days" defaultValue={salon.recall_days ?? ""} disabled={!canEdit} className={`${INPUT} mt-1.5`}>
            <option value="">Mai</option>
            {[21, 28, 35, 42, 56, 90].map((d) => (
              <option key={d} value={d}>Dopo {d / 7 === Math.round(d / 7) ? `${d / 7} settimane` : `${d} giorni`} dall&apos;ultima visita</option>
            ))}
          </select>
          <p className="mt-1.5 text-sm text-ink-soft">Email automatica &quot;È ora di tornare?&quot;, solo a chi ha accettato i messaggi promozionali.</p>
        </div>
        <div>
          <label htmlFor="google_review_url" className={LABEL}>Link per le recensioni Google <span className="font-normal text-ink-soft">(facoltativo)</span></label>
          <input
            id="google_review_url"
            name="google_review_url"
            type="url"
            maxLength={300}
            defaultValue={salon.google_review_url ?? ""}
            disabled={!canEdit}
            placeholder="https://g.page/r/..."
            className={`${INPUT} mt-1.5`}
          />
          <p className="mt-1.5 text-sm text-ink-soft">
            Lo trovi su Google Business Profile → &quot;Chiedi recensioni&quot;. Il giorno dopo un appuntamento completato, il cliente riceve
            l&apos;invito a lasciare una recensione (solo con il consenso ai messaggi promozionali).
          </p>
        </div>
      </fieldset>

      <fieldset className="space-y-3 border-t border-line pt-5">
        <legend className="font-display text-lg font-bold">Per te</legend>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="daily_summary" defaultChecked={salon.daily_summary} disabled={!canEdit} className="mt-0.5 h-4 w-4 accent-bottle" />
          <span>
            <span className="font-semibold">Riepilogo della giornata ogni mattina</span>
            <span className="block text-ink-soft">Un&apos;email con gli appuntamenti del giorno, all&apos;indirizzo del titolare.</span>
          </span>
        </label>
      </fieldset>

      {canEdit && (
        <div className="flex items-center gap-4">
          <SubmitButton>Salva impostazioni</SubmitButton>
          <FormMessage state={state} />
        </div>
      )}
    </form>
  );
}

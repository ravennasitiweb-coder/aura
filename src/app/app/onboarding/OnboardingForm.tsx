"use client";

import { useActionState, useState } from "react";
import { BusinessTypeSelect } from "@/components/app/BusinessTypeSelect";
import { DEFAULT_BUSINESS_TYPE, businessType, placeWith } from "@/lib/business-types";
import { formatDuration } from "@/lib/format";
import { slugDraft, slugify } from "@/lib/slug";
import { createSalon } from "./actions";

const INPUT = "mt-1.5 w-full rounded-xl border border-line bg-white px-4 py-3 outline-none focus:border-bottle";

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(createSalon, {});
  const [type, setType] = useState(state.values?.businessType ?? DEFAULT_BUSINESS_TYPE);
  const [name, setName] = useState(state.values?.name ?? "");
  const [slug, setSlug] = useState(state.values?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(false);

  const shownSlug = slugEdited ? slug : slugify(name);
  const config = businessType(type);

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <label htmlFor="business_type" className="block text-sm font-semibold">Che attività hai?</label>
        <BusinessTypeSelect id="business_type" value={type} onChange={setType} className={INPUT} />
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-semibold">
          Nome {placeWith(config, "of")}
        </label>
        <input
          id="name"
          name="name"
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`Es. ${config.exampleName}`}
          className={INPUT}
        />
      </div>
      <div>
        <label htmlFor="city" className="block text-sm font-semibold">
          Città <span className="font-normal text-ink-soft">(facoltativa)</span>
        </label>
        <input id="city" name="city" maxLength={80} defaultValue={state.values?.city} placeholder="Es. Ravenna" className={INPUT} />
      </div>
      <div>
        <label htmlFor="slug" className="block text-sm font-semibold">Indirizzo della pagina di prenotazione</label>
        <div className="mt-1.5 flex items-center rounded-xl border border-line bg-white focus-within:border-bottle">
          <span className="pl-4 text-ink-soft">/p/</span>
          <input
            id="slug"
            name="slug"
            maxLength={60}
            value={shownSlug}
            onChange={(e) => {
              setSlugEdited(true);
              setSlug(slugDraft(e.target.value));
            }}
            aria-describedby="slug-hint"
            className="w-full rounded-xl bg-transparent py-3 pr-4 outline-none"
          />
        </div>
        <p id="slug-hint" className="mt-1.5 text-sm text-ink-soft">Solo lettere minuscole, numeri e trattini.</p>
      </div>

      <label className="flex items-start gap-3 rounded-xl bg-mint p-4 text-sm">
        <input
          type="checkbox"
          name="with_services"
          defaultChecked={state.values?.withServices ?? true}
          className="mt-0.5 h-4 w-4 accent-bottle"
        />
        <span>
          <span className="font-semibold text-bottle-dark">Parti con i servizi tipici del settore</span>
          <span className="mt-1 block text-bottle-dark">
            {config.services.map((s) => `${s.name} (${formatDuration(s.durationMin)})`).join(", ")}.
          </span>
          <span className="mt-1 block text-xs text-ink-soft">Prezzi di esempio: li cambi quando vuoi in Servizi.</span>
        </span>
      </label>

      {state.error && (
        <p role="alert" className="rounded-xl border border-cherry/30 bg-cherry/5 px-4 py-3 text-sm text-cherry">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-bottle px-6 py-3 font-semibold text-white hover:bg-bottle-dark disabled:opacity-60"
      >
        {pending ? "Creazione in corso…" : `Crea ${placeWith(config, "the")}`}
      </button>
    </form>
  );
}

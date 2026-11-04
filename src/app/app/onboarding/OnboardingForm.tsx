"use client";

import { useActionState, useState } from "react";
import { slugDraft, slugify } from "@/lib/slug";
import { createSalon } from "./actions";

const INPUT = "mt-1.5 w-full rounded-xl border border-line bg-white px-4 py-3 outline-none focus:border-bottle";

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(createSalon, {});
  const [name, setName] = useState(state.values?.name ?? "");
  const [slug, setSlug] = useState(state.values?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(false);

  const shownSlug = slugEdited ? slug : slugify(name);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="name" className="block text-sm font-semibold">Nome del salone</label>
        <input
          id="name"
          name="name"
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Es. Salone Aurora"
          className={INPUT}
        />
      </div>
      <div>
        <label htmlFor="city" className="block text-sm font-semibold">
          Città <span className="font-normal text-ink-soft">(facoltativa)</span>
        </label>
        <input id="city" name="city" maxLength={80} defaultValue={state.values?.city} placeholder="Es. Bologna" className={INPUT} />
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
        {pending ? "Creazione in corso…" : "Crea il salone"}
      </button>
    </form>
  );
}

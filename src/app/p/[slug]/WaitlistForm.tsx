"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Turnstile, resetTurnstile } from "@/components/Turnstile";
import { joinWaitlist } from "./actions";

const INPUT = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2.5 outline-none focus:border-bottle";

// "Avvisami se si libera un posto": se qualcuno annulla, parte un'email automatica
export function WaitlistForm({ slug, serviceId, staffId, date }: { slug: string; serviceId: string; staffId: string; date: string }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <p role="status" className="rounded-xl bg-mint px-4 py-3 text-sm text-bottle-dark">
        Fatto! Se si libera un orario in questo giorno ti mandiamo subito un&apos;email.
      </p>
    );
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-full border border-bottle px-4 py-2 text-sm font-semibold text-bottle hover:bg-mint">
        Avvisami se si libera un posto
      </button>
    );
  }

  return (
    <form
      action={(fd) => {
        fd.set("service_id", serviceId);
        fd.set("staff_id", staffId);
        fd.set("date", date);
        setError(null);
        start(async () => {
          const r = await joinWaitlist(slug, fd);
          if (!r.ok) resetTurnstile();
          if (r.ok) setDone(true);
          else setError(r.error);
        });
      }}
      className="space-y-3 rounded-xl border border-line p-4"
    >
      <p className="text-sm font-semibold">Lista d&apos;attesa</p>
      <div>
        <label htmlFor="wl-name" className="text-sm">Nome e cognome</label>
        <input id="wl-name" name="name" required maxLength={80} autoComplete="name" className={INPUT} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="wl-phone" className="text-sm">Telefono</label>
          <input id="wl-phone" name="phone" type="tel" required maxLength={30} autoComplete="tel" className={INPUT} />
        </div>
        <div>
          <label htmlFor="wl-email" className="text-sm">Email</label>
          <input id="wl-email" name="email" type="email" required maxLength={254} autoComplete="email" className={INPUT} />
        </div>
      </div>
      <div aria-hidden="true" className="absolute -left-[9999px]">
        <input name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="privacy" required className="mt-0.5 h-4 w-4 accent-bottle" />
        <span>
          Ho letto l&apos;<Link href="/privacy" target="_blank" className="text-bottle underline">informativa sulla privacy</Link>.
        </span>
      </label>
      {error && <p role="alert" className="text-sm text-cherry">{error}</p>}
      <Turnstile />
      <button type="submit" disabled={pending} className="rounded-full bg-bottle px-5 py-2.5 text-sm font-semibold text-white hover:bg-bottle-dark disabled:opacity-60">
        {pending ? "Iscrizione…" : "Avvisami"}
      </button>
    </form>
  );
}

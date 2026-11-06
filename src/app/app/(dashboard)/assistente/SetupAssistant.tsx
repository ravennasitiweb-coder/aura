"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { applySetup, proposeSetup, type Proposal } from "@/app/app/setup-actions";
import { WEEKDAYS, formatDuration } from "@/lib/format";

const BUTTON = "rounded-full bg-bottle px-5 py-2.5 font-semibold text-white hover:bg-bottle-dark disabled:opacity-60";

export function SetupAssistant({ aiEnabled, tables, staffLabel, placeholder }: { aiEnabled: boolean; tables: boolean; staffLabel: string; placeholder: string }) {
  const [text, setText] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [parts, setParts] = useState({ services: true, staff: true, hours: true });
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const propose = () =>
    start(async () => {
      setMessage(null);
      const r = await proposeSetup(text);
      if (r.ok) setProposal(r.proposal);
      else setMessage({ ok: false, text: r.error });
    });

  const apply = () =>
    start(async () => {
      if (!proposal) return;
      const r = await applySetup(proposal, parts);
      setMessage({ ok: r.ok, text: r.message });
      if (r.ok) setProposal(null);
    });

  // Togli una voce dalla proposta prima di applicarla
  const drop = <K extends "services" | "staff" | "tables" | "hours">(key: K, i: number) =>
    setProposal((p) => (p ? { ...p, [key]: p[key].filter((_, j) => j !== i) } : p));

  const staffCount = proposal ? (tables ? proposal.tables.length : proposal.staff.length) : 0;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-white p-5">
        {aiEnabled ? (
          <>
            <label htmlFor="setup-text" className="font-semibold">Descrivi la tua attività</label>
            <textarea id="setup-text" rows={5} maxLength={1500} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} className="mt-2 w-full rounded-xl border border-line px-4 py-3 outline-none focus:border-bottle" />
            <button type="button" disabled={pending || text.trim().length < 10} onClick={propose} className={`${BUTTON} mt-3`}>
              {pending && !proposal ? "Preparo la proposta…" : "Prepara la proposta"}
            </button>
          </>
        ) : (
          <>
            <p className="text-ink-soft">Ti preparo una configurazione tipica del tuo settore da cui partire.</p>
            <button type="button" disabled={pending} onClick={propose} className={`${BUTTON} mt-3`}>Prepara la proposta</button>
          </>
        )}
      </section>

      {proposal && (
        <section className="space-y-5 rounded-2xl border border-bottle bg-white p-5">
          <h2 className="font-display text-xl font-bold">Ecco la proposta</h2>
          <p className="text-sm text-ink-soft">Togli quello che non ti serve con ✕, scegli cosa applicare. Potrai sempre modificare tutto dopo.</p>

          <Group title={tables ? "Turni" : "Servizi"} checked={parts.services} onCheck={(v) => setParts({ ...parts, services: v })} empty={proposal.services.length === 0}>
            {proposal.services.map((s, i) => (
              <Row key={i} onDrop={() => drop("services", i)}>
                <strong>{s.name}</strong> · {formatDuration(s.duration_min)}
                {s.price_eur > 0 && ` · ${s.price_eur.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}`}
              </Row>
            ))}
          </Group>

          <Group title={tables ? "Tavoli" : staffLabel.charAt(0).toUpperCase() + staffLabel.slice(1)} checked={parts.staff} onCheck={(v) => setParts({ ...parts, staff: v })} empty={staffCount === 0}>
            {tables
              ? proposal.tables.map((t, i) => (
                  <Row key={i} onDrop={() => drop("tables", i)}>
                    {t.count} tavoli da {t.seats} posti
                  </Row>
                ))
              : proposal.staff.map((s, i) => (
                  <Row key={i} onDrop={() => drop("staff", i)}>
                    <strong>{s.name}</strong>
                    {s.role_title && ` · ${s.role_title}`}
                  </Row>
                ))}
          </Group>

          <Group title="Orari di apertura (sostituiscono quelli attuali)" checked={parts.hours} onCheck={(v) => setParts({ ...parts, hours: v })} empty={proposal.hours.length === 0}>
            {proposal.hours.map((h, i) => (
              <Row key={i} onDrop={() => drop("hours", i)}>
                {WEEKDAYS[h.weekday - 1] ?? h.weekday} {h.opens_at}–{h.closes_at}
              </Row>
            ))}
          </Group>

          {proposal.tips.length > 0 && (
            <div className="rounded-xl bg-mint px-4 py-3 text-sm text-bottle-dark">
              <p className="font-semibold">Consigli</p>
              <ul className="mt-1 list-disc pl-5">
                {proposal.tips.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={pending} onClick={apply} className={BUTTON}>{pending ? "Applico…" : "Applica"}</button>
            <button type="button" onClick={() => setProposal(null)} className="rounded-full border border-line px-5 py-2.5 font-semibold hover:border-ink">Scarta</button>
          </div>
        </section>
      )}

      {message && (
        <div role="status" className={`rounded-xl px-4 py-3 text-sm ${message.ok ? "bg-mint text-bottle-dark" : "border border-cherry/30 bg-cherry/5 text-cherry"}`}>
          {message.text}
          {message.ok && (
            <span>
              {" "}Controlla in <Link href="/app" className="underline">Panoramica</Link>
              {tables && <>, poi sistema la pianta in <Link href="/app/sala" className="underline">Sala e tavoli</Link></>}.
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function Group({ title, checked, onCheck, empty, children }: { title: string; checked: boolean; onCheck: (v: boolean) => void; empty: boolean; children: React.ReactNode }) {
  if (empty) return null;
  return (
    <fieldset>
      <legend className="flex items-center gap-2 font-semibold">
        <input type="checkbox" checked={checked} onChange={(e) => onCheck(e.target.checked)} className="h-4 w-4 accent-bottle" /> {title}
      </legend>
      <ul className={`mt-2 space-y-1 ${checked ? "" : "opacity-40"}`}>{children}</ul>
    </fieldset>
  );
}

function Row({ children, onDrop }: { children: React.ReactNode; onDrop: () => void }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg bg-paper px-3 py-2 text-sm">
      <span>{children}</span>
      <button type="button" onClick={onDrop} aria-label="Togli" className="text-ink-soft hover:text-cherry">✕</button>
    </li>
  );
}

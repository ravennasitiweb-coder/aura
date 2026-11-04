"use client";

import { useActionState, useEffect, useRef } from "react";
import { createService, deleteService, updateService } from "@/app/app/actions";
import { FormMessage, INPUT, LABEL, SubmitButton } from "@/components/app/ui";
import { centsToInput } from "@/lib/format";

export type ServiceItem = { id: string; name: string; duration_min: number; price_cents: number; active: boolean };

const DURATIONS = [15, 20, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240];

function DurationSelect({ id, defaultValue, disabled }: { id: string; defaultValue: number; disabled?: boolean }) {
  const options = DURATIONS.includes(defaultValue) ? DURATIONS : [...DURATIONS, defaultValue].sort((a, b) => a - b);
  return (
    <select id={id} name="duration_min" defaultValue={defaultValue} disabled={disabled} className={INPUT}>
      {options.map((d) => (
        <option key={d} value={d}>
          {d < 60 ? `${d} min` : `${Math.floor(d / 60)} h${d % 60 ? ` ${d % 60} min` : ""}`}
        </option>
      ))}
    </select>
  );
}

export function NewServiceForm() {
  const [state, action] = useActionState(createService, {});
  const formRef = useRef<HTMLFormElement>(null);

  // Svuota il modulo dopo un'aggiunta riuscita
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="rounded-2xl bg-mint p-5">
      <h2 className="mb-4 font-semibold text-bottle-dark">Aggiungi un servizio</h2>
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="new-name" className={LABEL}>Nome</label>
          <input id="new-name" name="name" required maxLength={80} placeholder="Es. Taglio e piega" className={`${INPUT} mt-1.5`} />
        </div>
        <div>
          <label htmlFor="new-duration" className={LABEL}>Durata</label>
          <div className="mt-1.5">
            <DurationSelect id="new-duration" defaultValue={30} />
          </div>
        </div>
        <div>
          <label htmlFor="new-price" className={LABEL}>Prezzo (€)</label>
          <input id="new-price" name="price" inputMode="decimal" placeholder="25" className={`${INPUT} mt-1.5`} />
        </div>
        <SubmitButton pendingLabel="Aggiunta…">Aggiungi</SubmitButton>
      </div>
      <div className="mt-3 min-h-5">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function ServiceRow({ service, canEdit }: { service: ServiceItem; canEdit: boolean }) {
  const [saveState, saveAction] = useActionState(updateService, {});
  const [deleteState, deleteAction] = useActionState(deleteService, {});
  const state = deleteState.error ? deleteState : saveState;

  return (
    <form
      action={saveAction}
      className={`rounded-2xl border border-line bg-white p-4 ${service.active ? "" : "opacity-70"}`}
    >
      <input type="hidden" name="id" value={service.id} />
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr] sm:items-end">
        <div>
          <label htmlFor={`name-${service.id}`} className="text-xs text-ink-soft">Nome</label>
          <input id={`name-${service.id}`} name="name" required defaultValue={service.name} disabled={!canEdit} className={`${INPUT} mt-1`} />
        </div>
        <div>
          <label htmlFor={`duration-${service.id}`} className="text-xs text-ink-soft">Durata</label>
          <div className="mt-1">
            <DurationSelect id={`duration-${service.id}`} defaultValue={service.duration_min} disabled={!canEdit} />
          </div>
        </div>
        <div>
          <label htmlFor={`price-${service.id}`} className="text-xs text-ink-soft">Prezzo (€)</label>
          <input
            id={`price-${service.id}`}
            name="price"
            inputMode="decimal"
            defaultValue={centsToInput(service.price_cents)}
            disabled={!canEdit}
            className={`${INPUT} mt-1`}
          />
        </div>
      </div>

      {canEdit && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={service.active} className="h-4 w-4 accent-bottle" />
            Prenotabile
          </label>
          <div className="flex-1">
            <FormMessage state={state} />
          </div>
          <SubmitButton
            variant="danger"
            pendingLabel="…"
            formAction={(fd) => {
              if (confirm(`Eliminare "${service.name}"? Non si può annullare.`)) deleteAction(fd);
            }}
          >
            Elimina
          </SubmitButton>
          <SubmitButton variant="secondary">Salva</SubmitButton>
        </div>
      )}
    </form>
  );
}

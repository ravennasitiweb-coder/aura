"use client";

import { useActionState } from "react";
import { createStaff, deleteStaff, updateStaff } from "@/app/app/actions";
import { FormMessage, INPUT, LABEL, SubmitButton } from "@/components/app/ui";

export type StaffItem = {
  id: string;
  name: string;
  role_title: string | null;
  active: boolean;
  serviceIds: string[];
  user_id: string | null;
  calendar_token: string;
};

export function NewStaffForm() {
  const [state, action] = useActionState(createStaff, {});
  return (
    <form action={action} className="rounded-2xl bg-mint p-5">
      <h2 className="mb-4 font-semibold text-bottle-dark">Aggiungi un collaboratore</h2>
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="new-staff-name" className={LABEL}>Nome</label>
          <input id="new-staff-name" name="name" required maxLength={60} placeholder="Es. Giulia" className={`${INPUT} mt-1.5`} />
        </div>
        <div>
          <label htmlFor="new-staff-role" className={LABEL}>
            Ruolo <span className="font-normal text-ink-soft">(facoltativo)</span>
          </label>
          <input id="new-staff-role" name="role_title" maxLength={60} placeholder="Es. Hair stylist" className={`${INPUT} mt-1.5`} />
        </div>
        <SubmitButton pendingLabel="Aggiunta…">Aggiungi</SubmitButton>
      </div>
      <div className="mt-3 min-h-5">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function StaffRow({
  member,
  services,
  canEdit,
}: {
  member: StaffItem;
  services: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const [saveState, saveAction] = useActionState(updateStaff, {});
  const [deleteState, deleteAction] = useActionState(deleteStaff, {});
  const state = deleteState.error ? deleteState : saveState;

  return (
    <form action={saveAction} className={`rounded-2xl border border-line bg-white p-4 ${member.active ? "" : "opacity-70"}`}>
      <input type="hidden" name="id" value={member.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`staff-name-${member.id}`} className="text-xs text-ink-soft">Nome</label>
          <input id={`staff-name-${member.id}`} name="name" required defaultValue={member.name} disabled={!canEdit} className={`${INPUT} mt-1`} />
        </div>
        <div>
          <label htmlFor={`staff-role-${member.id}`} className="text-xs text-ink-soft">Ruolo</label>
          <input
            id={`staff-role-${member.id}`}
            name="role_title"
            defaultValue={member.role_title ?? ""}
            disabled={!canEdit}
            className={`${INPUT} mt-1`}
          />
        </div>
      </div>

      {services.length > 0 && (
        <fieldset className="mt-4">
          <legend className="text-xs text-ink-soft">Servizi che sa fare</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {services.map((s) => (
              <label
                key={s.id}
                className="flex cursor-pointer items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm has-[:checked]:border-bottle has-[:checked]:bg-mint"
              >
                <input
                  type="checkbox"
                  name="service_ids"
                  value={s.id}
                  defaultChecked={member.serviceIds.includes(s.id)}
                  disabled={!canEdit}
                  className="h-4 w-4 accent-bottle"
                />
                {s.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {canEdit && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={member.active} className="h-4 w-4 accent-bottle" />
            Riceve appuntamenti
          </label>
          <div className="flex-1">
            <FormMessage state={state} />
          </div>
          <SubmitButton
            variant="danger"
            pendingLabel="…"
            formAction={(fd) => {
              if (confirm(`Eliminare ${member.name}? Non si può annullare.`)) deleteAction(fd);
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

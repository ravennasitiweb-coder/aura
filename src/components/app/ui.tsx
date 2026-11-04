"use client";

import { useFormStatus } from "react-dom";
import type { ActionState } from "@/app/app/actions";

// Pezzi comuni ai moduli dell'area riservata

export const INPUT =
  "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 outline-none focus:border-bottle disabled:bg-paper disabled:text-ink-soft";
export const LABEL = "block text-sm font-semibold";

export function SubmitButton({
  children,
  pendingLabel = "Salvataggio…",
  variant = "primary",
  formAction,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger";
  formAction?: (formData: FormData) => void;
}) {
  const { pending } = useFormStatus();
  const styles = {
    primary: "bg-bottle text-white hover:bg-bottle-dark",
    secondary: "border border-line bg-white hover:border-ink",
    danger: "text-cherry hover:bg-cherry/5",
  }[variant];
  return (
    <button
      type="submit"
      formAction={formAction}
      disabled={pending}
      className={`rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60 ${styles}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (state.error)
    return (
      <p role="alert" className="text-sm text-cherry">
        {state.error}
      </p>
    );
  if (state.ok)
    return (
      <p role="status" className="text-sm text-bottle">
        {state.ok}
      </p>
    );
  return null;
}

export function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-8">
      <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-1 max-w-2xl text-ink-soft">{description}</p>
    </div>
  );
}

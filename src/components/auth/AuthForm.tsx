"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { FormState } from "@/app/(auth)/actions";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  pendingLabel: string;
  passwordHint?: string;
  footer: { text: string; linkLabel: string; href: string };
};

export function AuthForm({ action, submitLabel, pendingLabel, passwordHint, footer }: Props) {
  const [state, formAction, pending] = useActionState(action, {});

  if (state.message) {
    return (
      <div role="status" className="rounded-2xl bg-mint p-5 text-bottle-dark">
        <p className="font-semibold">Controlla la posta</p>
        <p className="mt-1">{state.message}</p>
        <p className="mt-3 text-sm">Non la trovi? Guarda anche nello spam.</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <div>
        <label htmlFor="email" className="block text-sm font-semibold">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          className="mt-1.5 w-full rounded-xl border border-line bg-white px-4 py-3 outline-none focus:border-bottle"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-semibold">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={passwordHint ? "new-password" : "current-password"}
          required
          minLength={passwordHint ? 8 : undefined}
          aria-describedby={passwordHint ? "password-hint" : undefined}
          className="mt-1.5 w-full rounded-xl border border-line bg-white px-4 py-3 outline-none focus:border-bottle"
        />
        {passwordHint && <p id="password-hint" className="mt-1.5 text-sm text-ink-soft">{passwordHint}</p>}
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
        {pending ? pendingLabel : submitLabel}
      </button>

      <p className="text-center text-sm text-ink-soft">
        {footer.text}{" "}
        <Link href={footer.href} className="font-semibold text-bottle underline-offset-2 hover:underline">
          {footer.linkLabel}
        </Link>
      </p>
    </form>
  );
}

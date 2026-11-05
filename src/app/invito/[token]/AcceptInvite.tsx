"use client";

import { useState, useTransition } from "react";
import { acceptInvite } from "./actions";

export function AcceptInvite({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="mt-5">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await acceptInvite(token);
            if (r) setError(r);
          })
        }
        className="rounded-full bg-bottle px-6 py-3 font-semibold text-white hover:bg-bottle-dark disabled:opacity-60"
      >
        {pending ? "Un attimo…" : "Accetta l'invito"}
      </button>
      {error && <p role="alert" className="mt-3 text-sm text-cherry">{error}</p>}
    </div>
  );
}

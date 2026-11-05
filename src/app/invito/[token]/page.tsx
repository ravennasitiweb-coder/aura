import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { createClient } from "@/lib/supabase/server";
import { AcceptInvite } from "./AcceptInvite";

export const metadata: Metadata = { title: "Invito — SmartBooking", robots: { index: false } };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function InvitePage({ params }: PageProps<"/invito/[token]">) {
  return (
    <div className="mx-auto min-h-screen max-w-lg px-4 py-8">
      <Logo />
      <Suspense fallback={<p className="mt-8 text-ink-soft">Caricamento…</p>}>
        <Invite params={params} />
      </Suspense>
    </div>
  );
}

async function Invite({ params }: { params: PageProps<"/invito/[token]">["params"] }) {
  const { token } = await params;
  if (!UUID_RE.test(token)) notFound();

  const supabase = await createClient();
  const [{ data: info }, { data: auth }] = await Promise.all([
    supabase.rpc("invite_info", { p_token: token }),
    supabase.auth.getUser(),
  ]);
  if (!info) notFound();
  const invite = info as { salon_name: string; email: string; accepted: boolean };
  const user = auth.user;
  const next = encodeURIComponent(`/invito/${token}`);

  return (
    <div className="mt-8 rounded-2xl border border-line bg-white p-6">
      <p className="text-sm text-ink-soft">Invito</p>
      <h1 className="font-display text-2xl font-bold">Entra nel team di {invite.salon_name}</h1>
      <p className="mt-2 text-ink-soft">
        L&apos;invito è per <strong>{invite.email}</strong>: vedrai l&apos;agenda e potrai gestire gli appuntamenti.
      </p>

      {invite.accepted && !user ? (
        <p className="mt-5">
          Invito già accettato. <Link href="/accedi" className="text-bottle underline">Accedi</Link> per entrare.
        </p>
      ) : user ? (
        user.email?.toLowerCase() === invite.email.toLowerCase() ? (
          <AcceptInvite token={token} />
        ) : (
          <p className="mt-5 rounded-xl bg-paper px-4 py-3 text-sm">
            Sei entrato come <strong>{user.email}</strong>, ma l&apos;invito è per {invite.email}. Esci e accedi con l&apos;indirizzo giusto.
          </p>
        )
      ) : (
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={`/registrati?next=${next}`} className="rounded-full bg-bottle px-5 py-2.5 font-semibold text-white hover:bg-bottle-dark">
            Crea il tuo account
          </Link>
          <Link href={`/accedi?next=${next}`} className="rounded-full border border-line px-5 py-2.5 font-semibold hover:border-ink">
            Ho già un account
          </Link>
        </div>
      )}
    </div>
  );
}

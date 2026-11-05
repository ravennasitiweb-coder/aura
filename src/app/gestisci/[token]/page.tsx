import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { businessType, placeWith } from "@/lib/business-types";
import { createClient } from "@/lib/supabase/server";
import { ManageAppointment, type ManagedAppointment } from "./ManageAppointment";

export const metadata: Metadata = { title: "Il tuo appuntamento — SmartBooking", robots: { index: false } };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ManagePage({ params, searchParams }: PageProps<"/gestisci/[token]">) {
  return (
    <div className="mx-auto min-h-screen max-w-lg px-4 py-8">
      <Logo />
      <Suspense fallback={<p className="mt-8 text-ink-soft">Caricamento…</p>}>
        <Manage params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Manage({
  params,
  searchParams,
}: {
  params: PageProps<"/gestisci/[token]">["params"];
  searchParams: PageProps<"/gestisci/[token]">["searchParams"];
}) {
  const { token } = await params;
  const { azione } = await searchParams;
  if (!UUID_RE.test(token)) notFound();

  const supabase = await createClient();
  const { data } = await supabase.rpc("public_appointment", { p_token: token });
  if (!data) notFound();
  const appt = data as ManagedAppointment;

  return (
    <ManageAppointment
      token={token}
      appointment={appt}
      place={placeWith(businessType(appt.business_type), "the")}
      highlightConfirm={azione === "conferma"}
    />
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/ui";
import { getCurrentSalon } from "@/lib/auth";
import { SettingsForm } from "./SettingsForm";

export const metadata: Metadata = { title: "Impostazioni — SmartBooking AI" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Impostazioni" description="I dati del salone che vedranno i tuoi clienti." />
      <Suspense fallback={<p className="text-ink-soft">Caricamento…</p>}>
        <Settings />
      </Suspense>
    </>
  );
}

async function Settings() {
  const { salon, role } = await getCurrentSalon();
  return <SettingsForm salon={salon} canEdit={role === "owner"} />;
}

import "server-only";
import { getCurrentSalon } from "@/lib/auth";

// Clienti ricavati dagli appuntamenti (vedi customer_list nel database)

export type CustomerRow = {
  customer_key: string;
  name: string;
  phone: string | null;
  email: string | null;
  visits: number;
  no_shows: number;
  last_visit: string | null;
  next_appointment: string | null;
};

export type CustomerVisit = {
  id: string;
  starts_at: string;
  ends_at: string;
  service_name: string;
  staff_name: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  notes: string | null;
  status: "confirmed" | "completed" | "cancelled" | "no_show";
  source: "manual" | "online" | "chatbot";
};

export async function listCustomers(search: string) {
  const { supabase, salon } = await getCurrentSalon();
  const { data, error } = await supabase.rpc("customer_list", { p_salon_id: salon.id, p_search: search || null });
  if (error) throw new Error(`Impossibile leggere i clienti: ${error.message}`);
  return (data ?? []) as CustomerRow[];
}

export async function getCustomerHistory(key: string) {
  const { supabase, salon, role } = await getCurrentSalon();
  const { data, error } = await supabase.rpc("customer_history", { p_salon_id: salon.id, p_customer_key: key });
  if (error) throw new Error(`Impossibile leggere lo storico: ${error.message}`);
  return { visits: (data ?? []) as CustomerVisit[], canForget: role === "owner" };
}

const dateTime = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });
const dateOnly = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Rome" });

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
export const formatDate = (iso: string) => dateOnly.format(new Date(iso));
// Giorno locale "2026-11-04" per aprire l'agenda su quella data
export const localDay = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date(iso));

// Legge le variabili di Supabase e dà un errore chiaro se mancano,
// invece di un malfunzionamento misterioso più avanti.

export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Mancano NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Controlla il file .env.local (vedi .env.example).",
    );
  }
  return { url, key };
}

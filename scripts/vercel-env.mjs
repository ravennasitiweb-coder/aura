// Copia su Vercel le chiavi facoltative presenti in .env.local
// (email, Stripe, chiave segreta di Supabase) e ripubblica il sito.
// Uso:  npm run env:vercel
// Le chiavi passano direttamente dal file a Vercel, senza comparire a schermo.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { readEnv } from "./env-file.mjs";

const KEYS = [
  { name: "SUPABASE_SECRET_KEY", sensitive: true },
  { name: "STRIPE_SECRET_KEY", sensitive: true },
  { name: "STRIPE_WEBHOOK_SECRET", sensitive: true },
  { name: "RESEND_API_KEY", sensitive: true },
  { name: "STRIPE_PRICE_SOLO" },
  { name: "STRIPE_PRICE_SALONE" },
  { name: "STRIPE_PRICE_STUDIO" },
  { name: "STRIPE_PORTAL_CONFIGURATION" },
  { name: "EMAIL_FROM" },
];
const TARGETS = ["production", "preview"];

const env = readEnv();

// Il comando "vercel" sta nella cartella dei programmi globali di npm,
// che non sempre è nel percorso del terminale: lo si cerca lì direttamente.
// Se non c'è in nessuna cartella nota, la si esegue al volo con npx.
const WIN = process.platform === "win32";
const VERCEL_VERSION = "65.11.0";

function findVercel() {
  const prefix = spawnSync("npm", ["prefix", "-g"], { encoding: "utf8", shell: WIN }).stdout?.trim();
  const candidates = WIN
    ? [prefix && join(prefix, "vercel.cmd"), process.env.APPDATA && join(process.env.APPDATA, "npm", "vercel.cmd")]
    : [prefix && join(prefix, "bin", "vercel")];
  const found = candidates.find((c) => c && existsSync(c));
  if (found) return { command: WIN ? `"${found}"` : found, prefixArgs: [] };
  return { command: "npx", prefixArgs: ["--yes", `vercel@${VERCEL_VERSION}`] };
}

const { command, prefixArgs } = findVercel();
const vercel = (args, input) => spawnSync(command, [...prefixArgs, ...args], { input, encoding: "utf8", shell: WIN });

const check = vercel(["whoami"]);
if (check.status !== 0) {
  console.error(`✗ La CLI di Vercel non risponde o non hai fatto l'accesso.\n  Prova: npx vercel login\n  Dettaglio: ${(check.stderr || check.stdout).trim()}`);
  process.exit(1);
}
console.log(`Collegato a Vercel come ${check.stdout.trim().split("\n").pop()}\n`);

let added = 0;
for (const { name, sensitive } of KEYS) {
  const value = env[name];
  if (!value) {
    console.log(`– ${name}: vuota in .env.local, la salto`);
    continue;
  }
  for (const target of TARGETS) {
    vercel(["env", "rm", name, target, "--yes"]); // se esiste già, la sostituisce
    const res = vercel(["env", "add", name, target, "--yes", ...(sensitive ? ["--sensitive"] : [])], value);
    if (res.status !== 0) {
      console.error(`✗ ${name} (${target}): ${res.stderr || res.stdout}`);
      process.exit(1);
    }
  }
  console.log(`✓ ${name}`);
  added++;
}

if (added === 0) {
  console.log("\nNessuna chiave da copiare: compila prima .env.local.\n");
  process.exit(0);
}

// Le nuove variabili valgono dal prossimo deploy: ripubblica la versione attuale
console.log("\nRipubblico il sito con le nuove impostazioni…");
const deploy = vercel(["deploy", "--prod", "--yes"]);
if (deploy.status !== 0) {
  console.error(`✗ Ripubblicazione non riuscita: ${deploy.stderr}`);
  process.exit(1);
}
console.log("✓ Fatto. Il sito online usa le nuove chiavi.\n");

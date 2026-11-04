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
function findVercel() {
  const prefix = spawnSync("npm", ["prefix", "-g"], { encoding: "utf8", shell: process.platform === "win32" }).stdout.trim();
  const candidate = join(prefix, process.platform === "win32" ? "vercel.cmd" : "bin/vercel");
  return prefix && existsSync(candidate) ? candidate : null;
}
const vercelBin = findVercel();
if (!vercelBin) {
  console.error('✗ Non trovo la CLI di Vercel. Installala con: npm install --global vercel');
  process.exit(1);
}
const vercel = (args, input) =>
  spawnSync(process.platform === "win32" ? `"${vercelBin}"` : vercelBin, args, {
    input,
    encoding: "utf8",
    shell: process.platform === "win32",
  });

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

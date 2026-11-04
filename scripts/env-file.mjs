// Lettura e scrittura di .env.local, conservando commenti e ordine delle righe.
import { readFileSync, writeFileSync } from "node:fs";

export const ENV_PATH = new URL("../.env.local", import.meta.url);

export function readEnv() {
  const values = {};
  for (const line of readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) values[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1");
  }
  return values;
}

export function writeEnvValues(updates) {
  let text = readFileSync(ENV_PATH, "utf8");
  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}=${value}`;
    const re = new RegExp(`^${key}=.*$`, "m");
    text = re.test(text) ? text.replace(re, line) : `${text.trimEnd()}\n${line}\n`;
  }
  writeFileSync(ENV_PATH, text);
}

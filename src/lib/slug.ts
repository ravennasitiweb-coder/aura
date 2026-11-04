// Versione "mentre scrivi": lascia il trattino finale, così si può digitare "salone-"
export function slugDraft(input: string) {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/g, "")
    .slice(0, 60);
}

// Versione definitiva: "Salone Aurora – Bologna" → "salone-aurora-bologna"
export function slugify(input: string) {
  return slugDraft(input).replace(/-+$/g, "");
}

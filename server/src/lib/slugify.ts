// Slug URL: minúsculas, sin acentos, guiones entre palabras, máx 60 chars.
// Ej: 'EcoSolar Panamá' → 'ecosolar-panama'
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export const SLUG_REGEX = /^[a-z0-9-]{2,60}$/;

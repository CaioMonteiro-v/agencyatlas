/** Espelho da lógica server/dobra-deputy.js — Deputado Estadual ≠ coordenador. */

function fold(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function inferDeputyFromGroupName(name) {
  const u = fold(name);
  if (!u) return null;
  if (
    u.includes('BETO DOIS A UM')
    || u.includes('BETO 2 A 1')
    || u.includes('BETO DOIS A 1')
    || u.includes('BETO 2A1')
    || u.includes('BETO DOIS-A-UM')
  ) {
    return 'Beto Dois a Um';
  }
  return null;
}

export function deputyDisplayName(g) {
  return String(
    g?.deputy_name
    || inferDeputyFromGroupName(g?.name)
    || '',
  ).trim() || 'Sem deputado';
}

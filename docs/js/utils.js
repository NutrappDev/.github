/**
 * Helpers compartidos entre componentes.
 * Sin dependencias externas.
 */

const JIRA_BASE = 'https://nutrabiotics.atlassian.net/browse';

/** Formatea una fecha ISO como "14 ene 2025" o "hace 3 días" */
export function formatDate(isoString, { relative = false } = {}) {
  if (!isoString) return null;
  const date = new Date(isoString);
  if (isNaN(date)) return null;

  if (relative) {
    const diffMs = Date.now() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return 'hoy';
    if (diffDays === 1) return 'ayer';
    if (diffDays < 7) return `hace ${diffDays} días`;
    if (diffDays < 30) return `hace ${Math.floor(diffDays / 7)} sem.`;
    if (diffDays < 365) return `hace ${Math.floor(diffDays / 30)} meses`;
    return `hace ${Math.floor(diffDays / 365)} año(s)`;
  }

  return date.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Construye la URL de un ticket Jira */
export function jiraUrl(ticket) {
  return `${JIRA_BASE}/${ticket}`;
}

/**
 * Determina el estado visual de un repo.
 * @returns {'green'|'pending'|'migrating'|'gray'}
 *
 * green     — al día (prod tag + 0 commits pendientes a main)
 * pending   — actualización pendiente (prod tag + >0 commits o rama inexistente)
 * migrating — activo pero sin tag de producción (en migración a política de releases)
 * gray      — sin actividad en >90 días y sin pendientes (o error al procesar)
 */
export function repoStatus(repo) {
  if (repo.error) return 'gray';

  if (!repo.production) {
    const daysSinceLastPush = repo.last_push
      ? Math.floor((Date.now() - new Date(repo.last_push).getTime()) / 86400000)
      : 999;
    const hasPendingToQa = (repo.pending?.to_qa?.count ?? 0) > 0;
    return (daysSinceLastPush < 90 || hasPendingToQa) ? 'migrating' : 'gray';
  }

  const pendingToProd = repo.pending?.to_production?.count ?? null;
  if (pendingToProd === null || pendingToProd > 0) return 'pending';
  return 'green';
}

const STATUS_LABELS = {
  green:     'Al día',
  pending:   'Actualización pendiente',
  migrating: 'En migración',
  gray:      'Inactivo',
};

export function statusLabel(status) {
  return STATUS_LABELS[status] ?? status;
}

/**
 * Peso para ordenar por urgencia (menor = más urgente).
 */
export const STATUS_WEIGHT = {
  pending:   1,
  migrating: 2,
  green:     3,
  gray:      4,
};

/**
 * Indica si el nombre del repo sigue la nomenclatura oficial.
 * Patrón: [raiz|tronco|ramas|fruto]-[servicio]-[proyecto]
 */
export function repoNombreCompliant(repo) {
  return /^(raiz|tronco|ramas|fruto)-/.test(repo.name);
}

/**
 * Extrae la fase del repo desde sus topics GitHub.
 * @returns {'raiz'|'tronco'|'ramas'|'fruto'|null}
 */
export function repoFase(repo) {
  const faseTopic = (repo.topics ?? []).find(t => t.startsWith('fase-'));
  return faseTopic ? faseTopic.replace('fase-', '') : null;
}

export const FASE_LABELS = {
  raiz:   'Raíz',
  tronco: 'Tronco',
  ramas:  'Ramas',
  fruto:  'Fruto',
};

/**
 * Extrae el equipo del repo desde sus topics GitHub.
 * @returns {'roble'|'sakura'|'manglar'|null}
 */
export function repoTeam(repo) {
  const teamTopic = (repo.topics ?? []).find(t => t.startsWith('team-'));
  return teamTopic ? teamTopic.replace('team-', '') : null;
}

export const TEAM_LABELS = {
  roble:   'Roble',
  sakura:  'Sakura',
  manglar: 'Manglar',
};

/**
 * Parsea el cuerpo de un tag anotado con el formato NutrappDev.
 *
 * Formato esperado:
 *   Release qa-YYYY-MM-DD
 *
 *   Features (N):
 *   PR #XXX by Autor - Resumen del cambio [TICKET-123]
 *
 *   Fixes (N):
 *   PR #YYY by Autor - Resumen del fix
 *
 *   Other (N):
 *   PR #ZZZ by Autor - Resumen
 *
 * @returns {{ features: PR[], fixes: PR[], other: PR[] } | null}
 */
export function parseTagBody(body) {
  if (!body) return null;

  const result = { features: [], fixes: [], other: [] };
  let section = null;

  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/^features?\s*\(\d+\)\s*:/i.test(line)) { section = 'features'; continue; }
    if (/^fixes?\s*\(\d+\)\s*:/i.test(line))    { section = 'fixes';    continue; }
    if (/^other\s*\(\d+\)\s*:/i.test(line))     { section = 'other';    continue; }

    if (!section || !line.startsWith('PR #')) continue;

    // "PR #123 by Autor Name - Resumen del cambio [TICKET-123]"
    // Partir en "PR #NNN", " by ", primer " - " después del autor
    const byIdx   = line.indexOf(' by ');
    const dashIdx = line.indexOf(' - ', byIdx + 4);
    if (byIdx === -1 || dashIdx === -1) continue;

    const number = parseInt(line.slice(4, byIdx), 10);
    const author = line.slice(byIdx + 4, dashIdx).trim();
    const rest   = line.slice(dashIdx + 3).trim();

    // Ticket opcional al final: [ALCO-123]
    const ticketMatch = rest.match(/\[([A-Z]{2,}-\d+)\]$/);
    const ticket  = ticketMatch ? ticketMatch[1] : null;
    const summary = ticket ? rest.slice(0, rest.lastIndexOf(' [')).trim() : rest;

    if (!isNaN(number) && author && summary) {
      result[section].push({ number, author, summary, ticket });
    }
  }

  const total = result.features.length + result.fixes.length + result.other.length;
  return total > 0 ? result : null;
}

/** Escapa HTML para evitar XSS al insertar strings en innerHTML */
export function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Versión corta de un nombre de repo para mostrar (sin prefijo de org) */
export function shortName(fullName) {
  return fullName?.split('/').pop() ?? fullName;
}

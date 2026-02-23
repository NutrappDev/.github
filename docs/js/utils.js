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
 * @returns {'green'|'amber'|'red'|'gray'}
 */
export function repoStatus(repo) {
  if (repo.error) return 'gray';
  if (!repo.production) return 'gray';

  const pendingToProd = repo.pending?.to_production?.count ?? null;

  if (pendingToProd === null) return 'amber'; // no se pudo calcular
  if (pendingToProd === 0) return 'green';
  if (pendingToProd <= 10) return 'amber';
  return 'red';
}

const STATUS_LABELS = {
  green: 'Al día',
  amber: 'Cambios pendientes',
  red:   'Muy desactualizado',
  gray:  'Sin releases',
};

export function statusLabel(status) {
  return STATUS_LABELS[status] ?? status;
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

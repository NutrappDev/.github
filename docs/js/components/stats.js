import { repoStatus } from '../utils.js';

/**
 * Renderiza la barra de estadísticas.
 * @param {HTMLElement} root
 * @param {Array} repos
 */
export function renderStats(root, repos) {
  const total     = repos.length;
  const inProd    = repos.filter(r => r.production).length;
  const upToDate  = repos.filter(r => repoStatus(r) === 'green').length;
  const pending   = repos.filter(r => ['amber', 'red'].includes(repoStatus(r))).length;
  const noRelease = repos.filter(r => repoStatus(r) === 'gray').length;

  root.innerHTML = `
    <div class="stats-bar">
      ${stat(total,     'Total de repositorios', '')}
      ${stat(inProd,    'Con release en producción', 'green')}
      ${stat(upToDate,  'Al día (sin cambios pendientes)', 'green')}
      ${stat(pending,   'Con cambios pendientes', 'amber')}
      ${stat(noRelease, 'Sin releases publicados', 'gray')}
    </div>
  `;
}

function stat(number, label, colorClass) {
  return `
    <div class="stat-card">
      <div class="stat-card__number ${colorClass}">${number}</div>
      <div class="stat-card__label">${label}</div>
    </div>
  `;
}

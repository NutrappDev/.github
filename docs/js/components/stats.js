import { repoStatus } from '../utils.js';

/**
 * Renderiza la barra de estadísticas.
 * @param {HTMLElement} root
 * @param {Array} repos
 */
export function renderStats(root, repos) {
  const total      = repos.length;
  const upToDate   = repos.filter(r => repoStatus(r) === 'green').length;
  const pending    = repos.filter(r => repoStatus(r) === 'pending').length;
  const migrating  = repos.filter(r => repoStatus(r) === 'migrating').length;
  const inactive   = repos.filter(r => repoStatus(r) === 'gray').length;

  root.innerHTML = `
    <div class="stats-bar">
      ${stat(total,     'Total',                    '')}
      ${stat(upToDate,  'Al día',                   'green')}
      ${stat(pending,   'Actualización pendiente',  'amber')}
      ${stat(migrating, 'En migración',             'violet')}
      ${stat(inactive,  'Inactivos',                'gray')}
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

import { repoStatus } from '../utils.js';

/**
 * Renderiza la barra de estadísticas.
 * @param {HTMLElement} root
 * @param {Array} repos
 */
export function renderStats(root, repos) {
  const total        = repos.length;
  const inProd       = repos.filter(r => r.production).length;
  const upToDate     = repos.filter(r => repoStatus(r) === 'green').length;
  const pending      = repos.filter(r => ['amber', 'red'].includes(repoStatus(r))).length;
  const needsRelease = repos.filter(r => repoStatus(r) === 'needs-release').length;
  const inactive     = repos.filter(r => repoStatus(r) === 'gray').length;

  root.innerHTML = `
    <div class="stats-bar">
      ${stat(total,        'Total',                    '')}
      ${stat(inProd,       'En producción',            'green')}
      ${stat(upToDate,     'Al día',                   'green')}
      ${stat(pending,      'Cambios pendientes',       'amber')}
      ${stat(needsRelease, 'Sin sistema de releases',  'violet')}
      ${stat(inactive,     'Inactivos',                'gray')}
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

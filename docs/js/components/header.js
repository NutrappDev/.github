import { formatDate } from '../utils.js';
import { repoStatus } from '../utils.js';

/**
 * Header con logo, pulse bar animado y metadata.
 */
export function renderHeader(root, { generatedAt, totalRepos, repos = [] }) {
  const updated     = generatedAt ? formatDate(generatedAt, { relative: true }) : 'desconocida';
  const updatedFull = generatedAt
    ? new Date(generatedAt).toLocaleString('es-CO', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '';

  const inProd = repos.filter(r => r.production).length;

  // Pulso: 22 barras con alturas variadas y delays escalonados
  const heights  = [12,6,20,8,28,10,24,5,30,14,26,7,22,9,28,11,18,6,24,8,16,10];
  const pulseBars = heights.map((h, i) =>
    `<div class="pulse-bar" style="height:${h}px;--delay:${(i * 0.11).toFixed(2)}s"></div>`
  ).join('');

  root.innerHTML = `
    <header class="site-header">
      <div class="site-header__brand">
        <div class="site-header__logo">ND</div>
        <div>
          <div class="site-header__title">NutrappDev</div>
          <div class="site-header__subtitle">Estado de Releases · ${totalRepos} repos</div>
        </div>
      </div>
      <div class="site-header__pulse" aria-hidden="true">${pulseBars}</div>
      <div class="site-header__meta">
        <div>Actualizado <strong title="${updatedFull}">${updated}</strong></div>
        <div>Centro de Operaciones</div>
      </div>
    </header>
  `;
}

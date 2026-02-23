import { formatDate } from '../utils.js';

/**
 * Renderiza el header de la página.
 * @param {HTMLElement} root
 * @param {{ generatedAt: string, totalRepos: number }} data
 */
export function renderHeader(root, { generatedAt, totalRepos }) {
  const updated = generatedAt
    ? formatDate(generatedAt, { relative: true })
    : 'desconocida';

  const updatedFull = generatedAt
    ? new Date(generatedAt).toLocaleString('es-CO', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '';

  root.innerHTML = `
    <header class="site-header">
      <div class="site-header__brand">
        <div class="site-header__logo">N</div>
        <div>
          <div class="site-header__title">Estado de Releases</div>
          <div class="site-header__subtitle">NutrappDev · ${totalRepos} repositorios</div>
        </div>
      </div>
      <div class="site-header__meta">
        <div>Actualizado <strong title="${updatedFull}">${updated}</strong></div>
        <div>Datos generados automáticamente</div>
      </div>
    </header>
  `;
}

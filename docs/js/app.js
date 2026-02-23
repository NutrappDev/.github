/**
 * app.js — punto de entrada del dashboard.
 * Carga repos.json y orquesta los componentes.
 */

import { renderHeader }  from './components/header.js';
import { renderStats }   from './components/stats.js';
import { renderFilters } from './components/filters.js';
import { repoCardHtml }  from './components/card.js';
import { repoStatus, repoFase, shortName } from './utils.js';

// ─── DOM roots ────────────────────────────────────────────────────────────────
const headerRoot  = document.getElementById('header-root');
const statsRoot   = document.getElementById('stats-root');
const filtersRoot = document.getElementById('filters-root');
const gridRoot    = document.getElementById('grid-root');

// ─── Estado de filtros ────────────────────────────────────────────────────────
let allRepos = [];
let filtersCtrl = null;

// ─── Carga de datos ───────────────────────────────────────────────────────────
async function loadData() {
  showSkeletons();

  let data;
  try {
    const res = await fetch('data/repos.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    showError(err.message);
    return;
  }

  if (!data.repos?.length) {
    showEmpty('El dashboard aún no tiene datos. El workflow se ejecuta diariamente.');
    return;
  }

  allRepos = data.repos;

  renderHeader(headerRoot, {
    generatedAt: data.generated_at,
    totalRepos: data.total_repos,
  });

  renderStats(statsRoot, allRepos);

  filtersCtrl = renderFilters(filtersRoot, handleFilterChange);

  renderGrid(allRepos);
  filtersCtrl.setCount(allRepos.length, allRepos.length);
}

// ─── Filtrado ─────────────────────────────────────────────────────────────────
function handleFilterChange({ search, status, fase }) {
  const query = search.trim().toLowerCase();

  const visible = allRepos.filter(repo => {
    const name = shortName(repo.full_name).toLowerCase();
    const desc = (repo.description ?? '').toLowerCase();

    const matchesSearch = !query || name.includes(query) || desc.includes(query);
    const matchesStatus = status === 'all' || repoStatus(repo) === status;
    const matchesFase   = !fase || fase === 'all' || repoFase(repo) === fase;

    return matchesSearch && matchesStatus && matchesFase;
  });

  renderGrid(visible);
  filtersCtrl?.setCount(visible.length, allRepos.length);
}

// ─── Render del grid ──────────────────────────────────────────────────────────
function renderGrid(repos) {
  if (!repos.length) {
    gridRoot.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">🔍</div>
        <div class="empty-state__title">Sin resultados</div>
        <div>Intenta con otro filtro o término de búsqueda.</div>
      </div>
    `;
    return;
  }

  gridRoot.innerHTML = repos.map(repoCardHtml).join('');
}

// ─── Estados de UI ────────────────────────────────────────────────────────────
function showSkeletons() {
  gridRoot.innerHTML = Array.from({ length: 9 }, () =>
    '<div class="skeleton-card"><div class="skeleton" style="height:100%;border-radius:8px"></div></div>'
  ).join('');
}

function showEmpty(message) {
  gridRoot.innerHTML = `
    <div class="empty-state">
      <div class="empty-state__icon">📭</div>
      <div class="empty-state__title">Sin datos todavía</div>
      <div>${message}</div>
    </div>
  `;
}

function showError(message) {
  gridRoot.innerHTML = `
    <div class="empty-state">
      <div class="empty-state__icon">⚠️</div>
      <div class="empty-state__title">No se pudo cargar el dashboard</div>
      <div>${message}</div>
    </div>
  `;
}

// ─── Init ─────────────────────────────────────────────────────────────────────
loadData();

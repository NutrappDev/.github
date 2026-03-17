/**
 * app.js — orquestador principal del dashboard.
 * Carga datos, gestiona navegación por tabs y delega el render a cada vista.
 */

import { renderHeader }   from './components/header.js';
import { renderNav }      from './components/nav.js';
import { initDetailPanel, openDetailPanel, closeDetailPanel } from './components/detail.js';
import { renderResumen }  from './views/resumen.js';
import { renderRepos }    from './views/repos.js';
import { renderEquipo }   from './views/equipo.js';
import { renderDeployments, bindDeploymentEvents } from './views/deployments.js';
import { repoStatus, STATUS_WEIGHT, shortName } from './utils.js';

// ─── DOM roots ────────────────────────────────────────────────────────────────
const headerRoot = document.getElementById('header-root');
const navRoot    = document.getElementById('nav-root');
const mainRoot   = document.getElementById('main-root');

// ─── Estado ───────────────────────────────────────────────────────────────────
let allRepos    = [];
let jiraTickets = {};
let activeTab   = 'resumen';
let navCtrl     = null;

// ─── Carga de datos ───────────────────────────────────────────────────────────
async function loadData() {
  mainRoot.innerHTML = skeletonsHtml();

  let data;
  try {
    const res = await fetch('data/repos.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    mainRoot.innerHTML = errorHtml(err.message);
    return;
  }

  if (!data.repos?.length) {
    mainRoot.innerHTML = emptyHtml();
    return;
  }

  jiraTickets = data.jira_tickets ?? {};

  allRepos = data.repos.slice().sort((a, b) => {
    const wa = STATUS_WEIGHT[repoStatus(a)] ?? 9;
    const wb = STATUS_WEIGHT[repoStatus(b)] ?? 9;
    if (wa !== wb) return wa - wb;
    const da = a.last_push ? new Date(a.last_push).getTime() : 0;
    const db = b.last_push ? new Date(b.last_push).getTime() : 0;
    return db - da;
  });

  renderHeader(headerRoot, {
    generatedAt: data.generated_at,
    totalRepos:  data.total_repos,
    repos:       allRepos,
  });

  // Leer tab inicial desde hash (e.g. #tab-repos)
  const hashTab  = location.hash.startsWith('#tab-') ? location.hash.slice(5) : null;
  const repoSlug = (!location.hash.startsWith('#tab-') && location.hash.length > 1)
    ? location.hash.slice(1)
    : null;

  activeTab = ['resumen','repos','equipo','deployments'].includes(hashTab)
    ? hashTab
    : 'resumen';

  navCtrl = renderNav(navRoot, activeTab, handleTabChange);
  initDetailPanel();

  renderView();

  // Hash routing: abrir panel de detalle si hay slug de repo
  if (repoSlug) {
    const repo = allRepos.find(r => shortName(r.full_name) === repoSlug);
    if (repo) openDetailPanel(repo, jiraTickets);
  }
}

// ─── Tab routing ──────────────────────────────────────────────────────────────
function handleTabChange(tab) {
  activeTab = tab;
  navCtrl?.setActive(tab);
  renderView();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderView() {
  switch (activeTab) {
    case 'resumen':
      mainRoot.innerHTML = renderResumen(allRepos);
      bindResumenEvents();
      break;

    case 'repos':
      renderRepos(mainRoot, allRepos, jiraTickets, (repo, tickets) => {
        openDetailPanel(repo, tickets);
      });
      break;

    case 'equipo':
      mainRoot.innerHTML = renderEquipo(allRepos);
      break;

    case 'deployments':
      mainRoot.innerHTML = renderDeployments(allRepos);
      bindDeploymentEvents(mainRoot, allRepos);
      bindRepoOpenEvents(mainRoot);
      break;
  }
}

function bindResumenEvents() {
  mainRoot.querySelectorAll('[data-repo-open]').forEach(el => {
    el.addEventListener('click', () => {
      const name = el.dataset.repoOpen;
      const repo = allRepos.find(r => shortName(r.full_name) === name);
      if (repo) openDetailPanel(repo, jiraTickets);
    });
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') el.click();
    });
  });
}

function bindRepoOpenEvents(root) {
  root.querySelectorAll('[data-repo-open]').forEach(el => {
    el.addEventListener('click', () => {
      const name = el.dataset.repoOpen;
      const repo = allRepos.find(r => shortName(r.full_name) === name);
      if (repo) openDetailPanel(repo, jiraTickets);
    });
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') el.click();
    });
  });
}

// ─── Hash / popstate ──────────────────────────────────────────────────────────
window.addEventListener('popstate', e => {
  if (e.state?.repo) {
    const repo = allRepos.find(r => r.full_name === e.state.repo);
    if (repo) openDetailPanel(repo, jiraTickets);
  } else {
    closeDetailPanel();
  }
});

// ─── UI states ────────────────────────────────────────────────────────────────
function skeletonsHtml() {
  return Array.from({ length: 9 }, () =>
    '<div class="skeleton-card"><div class="skeleton" style="height:100%;border-radius:8px"></div></div>'
  ).join('');
}

function emptyHtml() {
  return `
    <div class="empty-state">
      <div class="empty-state__icon">📭</div>
      <div class="empty-state__title">Sin datos todavía</div>
      <div>El workflow se ejecuta automáticamente con cada despliegue.</div>
    </div>
  `;
}

function errorHtml(msg) {
  return `
    <div class="empty-state">
      <div class="empty-state__icon">⚠️</div>
      <div class="empty-state__title">No se pudo cargar el dashboard</div>
      <div>${msg}</div>
    </div>
  `;
}

// ─── Init ─────────────────────────────────────────────────────────────────────
loadData();

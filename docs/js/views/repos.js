import { renderFilters }  from '../components/filters.js';
import { repoCardHtml }   from '../components/card.js';
import { repoStatus, shortName, STATUS_WEIGHT } from '../utils.js';

/**
 * Vista Repositorios — grid filtrable de repos.
 * @param {HTMLElement} root
 * @param {Array}       repos
 * @param {Object}      jiraTickets
 * @param {Function}    onOpenDetail
 */
export function renderRepos(root, repos, jiraTickets, onOpenDetail) {
  // Estructura con filtros + grid
  root.innerHTML = `
    <div id="repos-filters-root"></div>
    <div id="repos-grid-root" class="repos-grid"></div>
  `;

  const filtersRoot = root.querySelector('#repos-filters-root');
  const gridRoot    = root.querySelector('#repos-grid-root');

  // Ordenar: por urgencia y luego por actividad reciente
  const sorted = repos.slice().sort((a, b) => {
    const wa = STATUS_WEIGHT[repoStatus(a)] ?? 9;
    const wb = STATUS_WEIGHT[repoStatus(b)] ?? 9;
    if (wa !== wb) return wa - wb;
    const da = a.last_push ? new Date(a.last_push).getTime() : 0;
    const db = b.last_push ? new Date(b.last_push).getTime() : 0;
    return db - da;
  });

  let filtersCtrl = renderFilters(filtersRoot, ({ search, status, fase, team }) => {
    const query = search.trim().toLowerCase();
    const visible = sorted.filter(repo => {
      const name = shortName(repo.full_name).toLowerCase();
      const desc = (repo.description ?? '').toLowerCase();
      return (
        (!query  || name.includes(query) || desc.includes(query)) &&
        (status === 'all' || repoStatus(repo) === status) &&
        (!fase   || fase  === 'all' || (repo.topics ?? []).includes(`fase-${fase}`)) &&
        (!team   || team  === 'all' || (repo.topics ?? []).includes(`team-${team}`))
      );
    });
    renderGrid(gridRoot, visible, jiraTickets, onOpenDetail);
    filtersCtrl.setCount(visible.length, sorted.length);
  });

  renderGrid(gridRoot, sorted, jiraTickets, onOpenDetail);
  filtersCtrl.setCount(sorted.length, sorted.length);
}

function renderGrid(gridRoot, repos, jiraTickets, onOpenDetail) {
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

  gridRoot.addEventListener('click', e => {
    const card = e.target.closest('.repo-card');
    if (!card || e.target.closest('a')) return;
    const repo = repos.find(r => r.full_name === card.dataset.fullname);
    if (repo) onOpenDetail(repo, jiraTickets);
  }, { once: true });

  // Re-bind on each render (event delegation on fresh HTML)
  gridRoot.onclick = e => {
    const card = e.target.closest('.repo-card');
    if (!card || e.target.closest('a')) return;
    const repo = repos.find(r => r.full_name === card.dataset.fullname);
    if (repo) onOpenDetail(repo, jiraTickets);
  };
}

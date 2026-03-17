import { repoStatus, shortName } from '../utils.js';

/**
 * Vista Equipo — actividad de desarrolladores.
 * Muestra placeholder hasta que activity.json esté disponible.
 */
export function renderEquipo(repos) {
  const stats = computeBasicStats(repos);

  return `
    <div class="equipo-coming-soon">
      <div class="equipo-coming-soon__icon">👥</div>
      <div class="equipo-coming-soon__title">Panel de actividad — Próximamente</div>
      <div class="equipo-coming-soon__desc">
        Esta vista mostrará métricas de actividad por desarrollador (PRs mergeados,
        última actividad, breakdown por repo) una vez que el workflow genere
        <code>activity.json</code>.
      </div>
      ${basicStatsPanel(stats)}
    </div>
  `;
}

function computeBasicStats(repos) {
  const activeRepos  = repos.filter(r => repoStatus(r) !== 'gray').length;
  const totalPending = repos.reduce((acc, r) => {
    return acc + (r.pending?.to_qa?.count ?? 0) + (r.pending?.to_production?.count ?? 0);
  }, 0);

  // Autores únicos extraídos de commits pendientes (dato aproximado)
  const authors = new Set();
  for (const repo of repos) {
    for (const commit of [
      ...(repo.pending?.to_qa?.recent_commits ?? []),
      ...(repo.pending?.to_production?.recent_commits ?? []),
    ]) {
      if (commit.author) authors.add(commit.author);
    }
  }

  return { activeRepos, totalPending, uniqueAuthors: authors.size };
}

function basicStatsPanel(stats) {
  return `
    <div class="equipo-preview">
      <div class="equipo-preview__label">Lo que estará disponible</div>
      <div class="equipo-metric-row">
        <span class="equipo-metric-label">PRs mergeados por dev (últimos 30/90 días)</span>
        <span class="equipo-metric-value">—</span>
      </div>
      <div class="equipo-metric-row">
        <span class="equipo-metric-label">Última actividad por dev</span>
        <span class="equipo-metric-value">—</span>
      </div>
      <div class="equipo-metric-row">
        <span class="equipo-metric-label">Breakdown por repo y rama</span>
        <span class="equipo-metric-value">—</span>
      </div>
      <div class="equipo-metric-row">
        <span class="equipo-metric-label">Timeline semanal de contribuciones</span>
        <span class="equipo-metric-value">—</span>
      </div>
      <div class="equipo-metric-row">
        <span class="equipo-metric-label">Repos activos ahora mismo</span>
        <span class="equipo-metric-value">${stats.activeRepos}</span>
      </div>
      <div class="equipo-metric-row">
        <span class="equipo-metric-label">Commits pendientes (total org)</span>
        <span class="equipo-metric-value">${stats.totalPending}</span>
      </div>
    </div>
  `;
}

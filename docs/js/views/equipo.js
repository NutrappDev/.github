import { formatDate, escHtml } from '../utils.js';

/**
 * Vista Equipo — actividad de desarrolladores.
 * Requiere activity.json generado por generate-activity.yml.
 */
export function renderEquipo(repos, activity) {
  if (!activity) return renderPlaceholder();
  if (!activity.developers?.length) return renderEmpty();

  const { developers, generated_at } = activity;
  const totalPrs30d = developers.reduce((s, d) => s + d.prs_30d, 0);
  const activeDevs  = developers.filter(d => d.prs_30d > 0).length;
  const avgPrs      = activeDevs > 0 ? Math.round(totalPrs30d / activeDevs) : 0;
  const topDev      = developers[0];

  return `
    <div class="equipo-view">
      ${kpiStrip(activeDevs, totalPrs30d, avgPrs, topDev)}
      <div class="equipo-controls">
        <span class="equipo-sort-label">Ordenar por:</span>
        <button class="equipo-sort-btn active" data-sort="prs_30d">PRs 30 días</button>
        <button class="equipo-sort-btn" data-sort="prs_90d">PRs 90 días</button>
        <button class="equipo-sort-btn" data-sort="last_activity">Actividad reciente</button>
        <span class="equipo-updated">Actualizado ${formatDate(generated_at, { relative: true })}</span>
      </div>
      <div class="equipo-grid" id="equipo-grid">
        ${renderDevCards(developers, 'prs_30d')}
      </div>
    </div>
  `;
}

export function bindEquipoEvents(root, activity) {
  if (!activity) return;

  root.querySelectorAll('.equipo-sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('.equipo-sort-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const grid = root.querySelector('#equipo-grid');
      if (grid) grid.innerHTML = renderDevCards(activity.developers, btn.dataset.sort);
    });
  });
}

// ─── KPI strip ────────────────────────────────────────────────────────────────

function kpiStrip(activeDevs, totalPrs30d, avgPrs, topDev) {
  return `
    <div class="equipo-kpi-strip">
      <div class="equipo-kpi">
        <div class="equipo-kpi__number">${activeDevs}</div>
        <div class="equipo-kpi__label">Devs activos (30d)</div>
      </div>
      <div class="equipo-kpi">
        <div class="equipo-kpi__number accent">${totalPrs30d}</div>
        <div class="equipo-kpi__label">PRs mergeados (30d)</div>
      </div>
      <div class="equipo-kpi">
        <div class="equipo-kpi__number">${avgPrs}</div>
        <div class="equipo-kpi__label">Promedio por dev</div>
      </div>
      ${topDev ? `
        <div class="equipo-kpi equipo-kpi--top">
          <img class="equipo-kpi__avatar" src="${escHtml(topDev.avatar_url)}" alt="${escHtml(topDev.login)}" />
          <div>
            <div class="equipo-kpi__name">${escHtml(topDev.login)}</div>
            <div class="equipo-kpi__label">Más activo · ${topDev.prs_30d} PRs este mes</div>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

// ─── Dev cards ────────────────────────────────────────────────────────────────

function renderDevCards(developers, sortKey) {
  const sorted = [...developers].sort((a, b) => {
    if (sortKey === 'last_activity') {
      return new Date(b.last_activity ?? 0) - new Date(a.last_activity ?? 0);
    }
    return (b[sortKey] ?? 0) - (a[sortKey] ?? 0);
  });
  return sorted.map(devCard).join('');
}

function devCard(dev) {
  const lastActive  = dev.last_activity ? formatDate(dev.last_activity, { relative: true }) : null;
  const totalBranch = dev.by_branch.develop + dev.by_branch.qa + dev.by_branch.main;

  return `
    <div class="dev-card">
      <div class="dev-card__header">
        <img class="dev-card__avatar" src="${escHtml(dev.avatar_url)}" alt="${escHtml(dev.login)}" loading="lazy" />
        <div class="dev-card__identity">
          <a class="dev-card__login" href="https://github.com/${escHtml(dev.login)}" target="_blank" rel="noopener">${escHtml(dev.login)}</a>
          ${lastActive ? `<div class="dev-card__last-active">${lastActive}</div>` : ''}
        </div>
        <div class="dev-card__pr-badges">
          <span class="dev-pr-badge dev-pr-badge--30d" title="PRs mergeados últimos 30 días">
            ${dev.prs_30d}<span class="dev-pr-badge__label">30d</span>
          </span>
          <span class="dev-pr-badge dev-pr-badge--90d" title="PRs mergeados últimos 90 días">
            ${dev.prs_90d}<span class="dev-pr-badge__label">90d</span>
          </span>
        </div>
      </div>

      ${totalBranch > 0 ? branchSection(dev.by_branch, totalBranch) : ''}

      <div class="dev-sparkline" title="PRs por semana (últimas 13 semanas)">
        ${sparkline(dev.weekly)}
      </div>

      ${dev.by_repo.length > 0 ? repoList(dev.by_repo) : ''}
    </div>
  `;
}

function branchSection(by_branch, total) {
  const pct = n => (n / total * 100).toFixed(1);
  return `
    <div class="dev-branch-bar" title="develop: ${by_branch.develop} · qa: ${by_branch.qa} · main: ${by_branch.main}">
      ${by_branch.develop ? `<div class="dev-branch-seg dev-branch-seg--develop" style="width:${pct(by_branch.develop)}%"></div>` : ''}
      ${by_branch.qa      ? `<div class="dev-branch-seg dev-branch-seg--qa"      style="width:${pct(by_branch.qa)}%"></div>`      : ''}
      ${by_branch.main    ? `<div class="dev-branch-seg dev-branch-seg--main"    style="width:${pct(by_branch.main)}%"></div>`    : ''}
    </div>
    <div class="dev-branch-labels">
      ${by_branch.develop ? `<span class="dev-branch-label dev-branch-label--develop">dev&nbsp;${by_branch.develop}</span>` : ''}
      ${by_branch.qa      ? `<span class="dev-branch-label dev-branch-label--qa">qa&nbsp;${by_branch.qa}</span>`             : ''}
      ${by_branch.main    ? `<span class="dev-branch-label dev-branch-label--main">main&nbsp;${by_branch.main}</span>`       : ''}
    </div>
  `;
}

function sparkline(weekly) {
  const maxPrs = Math.max(...weekly.map(w => w.prs), 1);
  return weekly.map(w => {
    const h = w.prs > 0 ? Math.max(Math.round((w.prs / maxPrs) * 100), 12) : 4;
    return `<div class="spark-bar${w.prs === 0 ? ' spark-bar--empty' : ''}" style="height:${h}%" title="${w.week}: ${w.prs} PR${w.prs !== 1 ? 's' : ''}"></div>`;
  }).join('');
}

function repoList(byRepo) {
  const visible = byRepo.slice(0, 4);
  const more    = byRepo.length > 4 ? byRepo.length - 4 : 0;
  return `
    <div class="dev-repos">
      ${visible.map(r => `
        <div class="dev-repo-item">
          <span class="dev-repo-name">${escHtml(r.repo)}</span>
          <span class="dev-repo-count">${r.prs}</span>
        </div>
      `).join('')}
      ${more ? `<div class="dev-repo-more">+${more} repos más</div>` : ''}
    </div>
  `;
}

// ─── Estados vacíos ───────────────────────────────────────────────────────────

function renderPlaceholder() {
  return `
    <div class="equipo-coming-soon">
      <div class="equipo-coming-soon__icon">👥</div>
      <div class="equipo-coming-soon__title">Panel de actividad — Próximamente</div>
      <div class="equipo-coming-soon__desc">
        Esta vista se activará automáticamente cuando el workflow
        genere <code>activity.json</code>. Se ejecuta semanalmente
        y con cada merge a develop, qa o main.
      </div>
    </div>
  `;
}

function renderEmpty() {
  return `
    <div class="equipo-coming-soon">
      <div class="equipo-coming-soon__icon">📊</div>
      <div class="equipo-coming-soon__title">Sin actividad registrada</div>
      <div class="equipo-coming-soon__desc">No hay PRs mergeados en los últimos 90 días.</div>
    </div>
  `;
}

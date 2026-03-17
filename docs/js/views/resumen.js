import { repoStatus, formatDate, escHtml, shortName } from '../utils.js';

/**
 * Vista Resumen — landing para directivas.
 * Muestra KPIs, estado general, actividad reciente y pendientes.
 */
export function renderResumen(repos) {
  const total     = repos.length;
  const upToDate  = repos.filter(r => repoStatus(r) === 'green').length;
  const pending   = repos.filter(r => repoStatus(r) === 'pending').length;
  const migrating = repos.filter(r => repoStatus(r) === 'migrating').length;
  const inactive  = repos.filter(r => repoStatus(r) === 'gray').length;
  const inProd    = repos.filter(r => r.production).length;

  const recentDeploys = getRecentDeploys(repos).slice(0, 7);
  const pendingToProd = repos
    .filter(r => (r.pending?.to_production?.count ?? 0) > 0)
    .slice(0, 6);

  return `
    ${kpiStrip(total, inProd, pending, inactive)}
    <div class="resumen-layout">
      <div class="resumen-status-section">
        <div class="resumen-section-title">Estado de repositorios</div>
        ${statusBar(upToDate, pending, migrating, inactive, total)}
        <div class="resumen-status-rows">
          ${statusRow('green',  'Al día',          upToDate,  total)}
          ${statusRow('amber',  'Con pendientes',  pending,   total)}
          ${statusRow('violet', 'Sin releases',    migrating, total)}
          ${statusRow('gray',   'Inactivos',       inactive,  total)}
        </div>
      </div>
      <div class="resumen-side">
        ${activityPanel(recentDeploys)}
        ${pendingPanel(pendingToProd)}
      </div>
    </div>
  `;
}

function kpiStrip(total, inProd, pending, inactive) {
  return `
    <div class="kpi-strip">
      <div class="kpi-card kpi-card--accent">
        <div class="kpi-card__number accent">${total}</div>
        <div class="kpi-card__label">Repositorios activos</div>
      </div>
      <div class="kpi-card kpi-card--green">
        <div class="kpi-card__number green">${inProd}</div>
        <div class="kpi-card__label">En producción</div>
      </div>
      <div class="kpi-card kpi-card--amber">
        <div class="kpi-card__number amber">${pending}</div>
        <div class="kpi-card__label">Con pendientes de deploy</div>
      </div>
      <div class="kpi-card kpi-card--gray">
        <div class="kpi-card__number gray">${inactive}</div>
        <div class="kpi-card__label">Inactivos</div>
      </div>
    </div>
  `;
}

function statusBar(upToDate, pending, migrating, inactive, total) {
  if (!total) return '';
  const pct = n => ((n / total) * 100).toFixed(1);
  return `
    <div class="resumen-bar-track">
      <div class="resumen-bar-segment resumen-bar-segment--green"  style="width:${pct(upToDate)}%"  title="${upToDate} al día"></div>
      <div class="resumen-bar-segment resumen-bar-segment--amber"  style="width:${pct(pending)}%"   title="${pending} con pendientes"></div>
      <div class="resumen-bar-segment resumen-bar-segment--violet" style="width:${pct(migrating)}%" title="${migrating} sin releases"></div>
      <div class="resumen-bar-segment resumen-bar-segment--gray"   style="width:${pct(inactive)}%"  title="${inactive} inactivos"></div>
    </div>
  `;
}

function statusRow(color, label, count, total) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return `
    <div class="resumen-status-row">
      <span class="resumen-status-dot resumen-status-dot--${color}"></span>
      <span class="resumen-status-label">${label}</span>
      <span class="resumen-status-count">${count}</span>
      <span class="resumen-status-pct">${pct}%</span>
    </div>
  `;
}

function activityPanel(deploys) {
  const items = deploys.length
    ? deploys.map(d => {
        const repoName = escHtml(d.repo);
        const type     = d.type === 'prod' ? 'Producción' : 'QA';
        const date     = formatDate(d.tag.date, { relative: true }) ?? '';
        return `
          <div class="activity-item">
            <span class="activity-item__dot activity-item__dot--${d.type}"></span>
            <span class="activity-item__text">
              <strong>${repoName}</strong> — ${type}
            </span>
            <span class="activity-item__time">${escHtml(date)}</span>
          </div>
        `;
      }).join('')
    : '<p class="activity-empty">Sin deployments recientes.</p>';

  return `
    <div class="resumen-panel">
      <div class="resumen-section-title">Actividad reciente</div>
      <div class="activity-list">${items}</div>
    </div>
  `;
}

function pendingPanel(repos) {
  if (!repos.length) {
    return `
      <div class="resumen-panel">
        <div class="resumen-section-title">Listos para producción</div>
        <p class="activity-empty">No hay cambios pendientes de deploy.</p>
      </div>
    `;
  }

  const items = repos.map(r => {
    const count = r.pending?.to_production?.count ?? 0;
    const name  = shortName(r.full_name);
    return `
      <div class="pending-item" data-repo-open="${escHtml(name)}" role="button" tabindex="0">
        <span class="pending-item__name">${escHtml(name)}</span>
        <span class="pending-item__count">${count} pendiente${count !== 1 ? 's' : ''}</span>
      </div>
    `;
  }).join('');

  return `
    <div class="resumen-panel">
      <div class="resumen-section-title">Listos para producción</div>
      <div class="pending-list">${items}</div>
    </div>
  `;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRecentDeploys(repos) {
  const events = [];
  for (const repo of repos) {
    const name = shortName(repo.full_name);
    for (const tag of [repo.production, ...(repo.production_history ?? [])]) {
      if (tag?.date) events.push({ repo: name, type: 'prod', tag });
    }
    for (const tag of [repo.qa, ...(repo.qa_history ?? [])]) {
      if (tag?.date) events.push({ repo: name, type: 'qa', tag });
    }
  }
  return events.sort((a, b) => new Date(b.tag.date) - new Date(a.tag.date));
}

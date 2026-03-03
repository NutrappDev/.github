import { formatDate, repoStatus, statusLabel, repoFase, FASE_LABELS, repoTeam, TEAM_LABELS, repoNombreCompliant, escHtml, shortName } from '../utils.js';

/**
 * Genera el HTML de una tarjeta de repositorio.
 * @param {object} repo  Entrada de repos.json
 * @returns {string} HTML string
 */
export function repoCardHtml(repo) {
  const status = repoStatus(repo);
  const name   = shortName(repo.full_name);

  return `
    <article class="repo-card status-${status}" data-name="${escHtml(name.toLowerCase())}" data-fullname="${escHtml(repo.full_name)}">
      ${cardHeader(repo, name, status)}
      <div class="card-body">
        ${releaseRow('prod', repo.production, 'Producción')}
        ${releaseRow('qa',   repo.qa,         'QA')}
        ${pendingSection(repo)}
      </div>
      ${cardFooter(repo)}
    </article>
  `;
}

function cardHeader(repo, name, status) {
  const fase = repoFase(repo);
  const team = repoTeam(repo);

  const faseBadge = fase
    ? `<span class="fase-badge fase-badge--${escHtml(fase)}">${escHtml(FASE_LABELS[fase] ?? fase)}</span>`
    : '';

  const teamBadge = team
    ? `<span class="team-badge team-badge--${escHtml(team)}">${escHtml(TEAM_LABELS[team] ?? team)}</span>`
    : '';

  const namingBadge = !repoNombreCompliant(repo)
    ? `<span class="naming-badge" title="El nombre del repo no sigue la nomenclatura oficial (fase-tipo-proyecto)">⚠ Nombre</span>`
    : '';

  const desc = repo.description
    ? `<div class="card-header__desc">${escHtml(repo.description)}</div>`
    : '';

  return `
    <div class="card-header">
      <div>
        <div class="card-header__name">
          <a href="${escHtml(repo.url)}" target="_blank" rel="noopener">${escHtml(name)}</a>
        </div>
        ${desc}
        <div class="card-header__badges">${faseBadge}${teamBadge}${namingBadge}</div>
      </div>
      <span class="status-badge ${status}">${escHtml(statusLabel(status))}</span>
    </div>
  `;
}

function releaseRow(type, release, label) {
  if (!release) {
    const msg = type === 'prod' ? 'Sin release de producción' : 'Sin release de QA';
    return `
      <div class="release-row none">
        <span class="release-row__label">${label}</span>
        <span>${msg}</span>
      </div>
    `;
  }

  const date = formatDate(release.date, { relative: true });
  const dateFull = formatDate(release.date);
  const version = type === 'qa'
    ? release.version.replace(/^qa-/, '') // "2025-01-14" es más legible que "qa-2025-01-14"
    : release.version;

  return `
    <div class="release-row ${type}">
      <span class="release-row__label">${label}</span>
      <span class="release-row__version">${escHtml(version)}</span>
      <span class="release-row__date" title="${dateFull ?? ''}">${date ?? ''}</span>
      <a class="release-row__link" href="${escHtml(release.url)}" target="_blank" rel="noopener" title="Ver en GitHub">↗</a>
    </div>
  `;
}

function pendingSection(repo) {
  const toQa   = repo.pending?.to_qa;
  const toProd = repo.pending?.to_production;

  if (toQa === null && toProd === null) return '';

  return `
    <div class="pending-section">
      ${pendingChip(toQa,   'to-qa',   'pendiente(s) a QA')}
      ${pendingChip(toProd, 'to-prod', 'pendiente(s) a producción')}
    </div>
  `;
}

function pendingChip(data, cssClass, label) {
  if (data === null || data === undefined) {
    return `
      <div class="pending-chip unknown">
        <span class="pending-chip__count">—</span>
        <span>${label}</span>
      </div>
    `;
  }

  const count = data.count ?? 0;
  const chipClass = count === 0 ? 'ok' : cssClass;

  return `
    <div class="pending-chip ${chipClass}">
      <span class="pending-chip__count">${count}</span>
      <span>${count === 1 ? label.replace('(s)', '') : label}</span>
    </div>
  `;
}

function cardFooter(repo) {
  const pushed = formatDate(repo.last_push, { relative: true });

  return `
    <div class="card-footer">
      <a class="card-footer__link" href="${escHtml(repo.url)}" target="_blank" rel="noopener">
        Ver en GitHub →
      </a>
      ${repo.ci ? ciBadge(repo.ci) : ''}
      ${pushed ? `<span class="card-footer__push">Última actividad: ${pushed}</span>` : ''}
    </div>
  `;
}

function ciBadge(ci) {
  const running = ci.status !== 'completed';
  const cls     = running ? 'running' : (ci.conclusion ?? 'unknown');
  const LABELS  = {
    success:         'CI ✓',
    failure:         'CI ✗',
    timed_out:       'CI ✗',
    action_required: 'CI !',
    running:         'CI …',
    cancelled:       'CI —',
    skipped:         'CI —',
    neutral:         'CI —',
    unknown:         'CI ?',
  };
  const label = LABELS[cls] ?? `CI: ${cls}`;
  const title = running ? 'CI en progreso' : `CI: ${ci.conclusion ?? 'desconocido'}`;

  return `<a class="ci-badge ci-badge--${escHtml(cls)}" href="${escHtml(ci.url)}" target="_blank" rel="noopener" title="${escHtml(title)}">${label}</a>`;
}

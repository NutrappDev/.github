/**
 * Panel lateral de detalle de repositorio.
 * Muestra PRs del último release (prod y QA), commits pendientes e historial de tags.
 */

import { parseTagBody, formatDate, jiraUrl, escHtml, shortName } from '../utils.js';

let panelEl     = null;
let jiraTickets = {}; // mapa { "NCOL-586": { summary, status, assignee } }

// ─── Init ──────────────────────────────────────────────────────────────────────

export function initDetailPanel() {
  panelEl = document.createElement('div');
  panelEl.className = 'detail-panel';
  panelEl.setAttribute('aria-hidden', 'true');
  panelEl.innerHTML = `
    <div class="detail-panel__backdrop"></div>
    <aside class="detail-panel__content" role="complementary">
      <div class="detail-panel__header">
        <div class="detail-panel__title"></div>
        <div class="detail-panel__header-actions">
          <a class="detail-panel__gh-link" target="_blank" rel="noopener">GitHub ↗</a>
          <button class="detail-panel__copy-link" aria-label="Copiar enlace directo">⎘ Copiar</button>
          <button class="detail-panel__close" aria-label="Cerrar panel">✕</button>
        </div>
      </div>
      <div class="detail-panel__body"></div>
    </aside>
  `;

  document.body.appendChild(panelEl);

  panelEl.querySelector('.detail-panel__backdrop').addEventListener('click', closeDetailPanel);
  panelEl.querySelector('.detail-panel__close').addEventListener('click', closeDetailPanel);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDetailPanel(); });

  panelEl.querySelector('.detail-panel__copy-link').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      const btn = panelEl.querySelector('.detail-panel__copy-link');
      const orig = btn.textContent;
      btn.textContent = '✓ Copiado';
      setTimeout(() => { btn.textContent = orig; }, 1500);
    } catch { /* clipboard no disponible */ }
  });
}

export function openDetailPanel(repo, jiraMap) {
  if (!panelEl) initDetailPanel();
  if (jiraMap !== undefined) jiraTickets = jiraMap;

  panelEl.querySelector('.detail-panel__title').textContent = shortName(repo.full_name);
  panelEl.querySelector('.detail-panel__gh-link').href = repo.url;
  panelEl.querySelector('.detail-panel__body').innerHTML = renderBody(repo);

  panelEl.setAttribute('aria-hidden', 'false');
  panelEl.classList.add('open');
  document.body.style.overflow = 'hidden';

  const slug = shortName(repo.full_name);
  if (location.hash !== `#${slug}`) {
    history.pushState({ repo: repo.full_name }, '', `#${slug}`);
  }
}

export function closeDetailPanel() {
  if (!panelEl) return;
  panelEl.classList.remove('open');
  panelEl.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';

  if (location.hash) {
    history.replaceState(null, '', location.pathname + location.search);
  }
}

// ─── Render ────────────────────────────────────────────────────────────────────

function renderBody(repo) {
  const parts = [];

  if (repo.description) {
    parts.push(`<p class="detail-desc">${escHtml(repo.description)}</p>`);
  }

  if (repo.ci) {
    parts.push(ciSection(repo.ci));
  }

  parts.push(releaseSection('Producción', repo.production, 'prod', repo.url, repo.production_history ?? []));
  parts.push(releaseSection('QA',         repo.qa,         'qa',   repo.url, repo.qa_history         ?? []));
  parts.push(pendingSection(repo));

  return parts.join('');
}

function ciSection(ci) {
  const running = ci.status !== 'completed';
  const cls     = running ? 'running' : (ci.conclusion ?? 'unknown');
  const LABELS  = {
    success:         'CI pasando',
    failure:         'CI fallando',
    timed_out:       'CI timeout',
    action_required: 'CI requiere acción',
    running:         'CI en progreso',
    cancelled:       'CI cancelado',
    skipped:         'CI omitido',
    neutral:         'CI neutral',
    unknown:         'CI desconocido',
  };
  const label = LABELS[cls] ?? `CI: ${cls}`;
  const date  = ci.updated_at ? formatDate(ci.updated_at, { relative: true }) : null;

  return `
    <div class="detail-ci detail-ci--${cls}">
      <span class="detail-ci__dot">●</span>
      <a class="detail-ci__label" href="${escHtml(ci.url)}" target="_blank" rel="noopener">${escHtml(label)}</a>
      ${date   ? `<span class="detail-ci__date">${date}</span>`        : ''}
      ${ci.name ? `<span class="detail-ci__name">${escHtml(ci.name)}</span>` : ''}
    </div>
  `;
}

function releaseSection(label, release, type, repoUrl, history = []) {
  const heading = `<div class="detail-heading detail-heading--${type}">${label}</div>`;

  if (!release) {
    return `<div class="detail-section">${heading}<p class="detail-empty">Sin release</p></div>`;
  }

  const version  = type === 'qa' ? release.version.replace(/^qa-/, '') : release.version;
  const date     = formatDate(release.date);
  const parsed   = parseTagBody(release.body);

  const meta = `
    <div class="detail-release-meta">
      <span class="detail-release-tag">${escHtml(version)}</span>
      ${date ? `<span class="detail-release-date">${date}</span>` : ''}
      <a class="detail-release-link" href="${escHtml(release.url)}" target="_blank" rel="noopener">Ver tag ↗</a>
    </div>
  `;

  const content = parsed
    ? prGroups(parsed, repoUrl)
    : `<p class="detail-empty">Tag sin detalle de PRs (formato libre o tag ligero)</p>`;

  const histHtml = history.length ? historySection(history, type, repoUrl) : '';

  return `<div class="detail-section">${heading}${meta}${content}${histHtml}</div>`;
}

function historySection(history, type, repoUrl) {
  const items = history.map(rel => {
    const version = type === 'qa' ? rel.version.replace(/^qa-/, '') : rel.version;
    const date    = formatDate(rel.date);
    const parsed  = parseTagBody(rel.body);
    const prCount = parsed
      ? parsed.features.length + parsed.fixes.length + parsed.other.length
      : 0;

    const summaryText = [
      escHtml(version),
      date,
      prCount ? `${prCount} PRs` : null,
    ].filter(Boolean).join(' · ');

    const content = parsed
      ? prGroups(parsed, repoUrl)
      : `<p class="detail-empty">Sin detalle de PRs</p>`;

    return `
      <details class="detail-history-item">
        <summary class="detail-history-item__summary">${summaryText}</summary>
        <div class="detail-history-item__body">${content}</div>
      </details>
    `;
  }).join('');

  return `
    <details class="detail-history">
      <summary class="detail-history__toggle">Historial (${history.length} release${history.length !== 1 ? 's' : ''} anterior${history.length !== 1 ? 'es' : ''})</summary>
      <div class="detail-history__items">${items}</div>
    </details>
  `;
}

function prGroups(parsed, repoUrl) {
  const parts = [];
  if (parsed.features.length) parts.push(prGroup('Features', parsed.features, 'feat', repoUrl));
  if (parsed.fixes.length)    parts.push(prGroup('Fixes',    parsed.fixes,    'fix',  repoUrl));
  if (parsed.other.length)    parts.push(prGroup('Otros',    parsed.other,    'other', repoUrl));
  return `<div class="detail-pr-groups">${parts.join('')}</div>`;
}

function jiraStatusClass(status) {
  return status.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function prGroup(title, prs, type, repoUrl) {
  const items = prs.map(pr => {
    const prUrl = `${repoUrl}/pull/${pr.number}`;
    const ticket = pr.ticket
      ? `<a class="detail-ticket" href="${escHtml(jiraUrl(pr.ticket))}" target="_blank" rel="noopener">${escHtml(pr.ticket)}</a>`
      : '';

    const jira       = pr.ticket ? jiraTickets[pr.ticket] : null;
    const statusPill = jira?.status
      ? `<span class="jira-status jira-status--${escHtml(jiraStatusClass(jira.status))}" title="${escHtml(jira.summary ?? '')}">${escHtml(jira.status)}</span>`
      : '';
    const assignee = jira?.assignee
      ? `<span class="detail-pr-assignee">${escHtml(jira.assignee)}</span>`
      : '';

    return `
      <div class="detail-pr-item">
        <a class="detail-pr-number" href="${escHtml(prUrl)}" target="_blank" rel="noopener">#${pr.number}</a>
        <div class="detail-pr-info">
          <div class="detail-pr-summary">${escHtml(pr.summary)}</div>
          <div class="detail-pr-meta">
            <span class="detail-pr-author">${escHtml(pr.author)}</span>
            ${ticket}${statusPill}${assignee}
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="detail-pr-group detail-pr-group--${type}">
      <div class="detail-pr-group-title">${title} <span>(${prs.length})</span></div>
      ${items}
    </div>
  `;
}

function pendingSection(repo) {
  const toQa   = repo.pending?.to_qa;
  const toProd = repo.pending?.to_production;

  const parts = [];

  if (toQa?.count > 0 && toQa.recent_commits?.length) {
    parts.push(commitList('Pendientes a QA', toQa.count, toQa.recent_commits, 'qa'));
  }
  if (toProd?.count > 0 && toProd.recent_commits?.length) {
    parts.push(commitList('Pendientes a producción', toProd.count, toProd.recent_commits, 'prod'));
  }

  if (!parts.length) return '';
  return `<div class="detail-section">${parts.join('')}</div>`;
}

function commitList(title, count, commits, type) {
  const MAX = 8;
  const items = commits.slice(0, MAX).map(c => {
    const tickets = (c.tickets ?? []).map(t =>
      `<a class="detail-ticket" href="${escHtml(t.url)}" target="_blank" rel="noopener">${escHtml(t.id)}</a>`
    ).join('');

    return `
      <div class="detail-commit-item">
        <code class="detail-commit-sha">${escHtml(c.sha)}</code>
        <div class="detail-commit-info">
          <div class="detail-commit-msg">${escHtml(c.message)}</div>
          ${tickets ? `<div class="detail-commit-tickets">${tickets}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  const more = count > MAX
    ? `<p class="detail-commits-more">+${count - MAX} commits más no mostrados</p>`
    : '';

  return `
    <div class="detail-heading detail-heading--${type}">${escHtml(title)} (${count})</div>
    <div class="detail-commit-list">${items}</div>
    ${more}
  `;
}

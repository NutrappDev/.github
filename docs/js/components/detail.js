/**
 * Panel lateral de detalle de repositorio.
 * Muestra PRs del último release (prod y QA), commits pendientes y tickets Jira.
 */

import { parseTagBody, formatDate, jiraUrl, escHtml, shortName } from '../utils.js';

let panelEl = null;

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
          <button class="detail-panel__close" aria-label="Cerrar panel">✕</button>
        </div>
      </div>
      <div class="detail-panel__body"></div>
    </aside>
  `;

  document.body.appendChild(panelEl);

  panelEl.querySelector('.detail-panel__backdrop').addEventListener('click', close);
  panelEl.querySelector('.detail-panel__close').addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}

export function openDetailPanel(repo) {
  if (!panelEl) initDetailPanel();

  panelEl.querySelector('.detail-panel__title').textContent = shortName(repo.full_name);
  panelEl.querySelector('.detail-panel__gh-link').href = repo.url;
  panelEl.querySelector('.detail-panel__body').innerHTML = renderBody(repo);

  panelEl.setAttribute('aria-hidden', 'false');
  panelEl.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function close() {
  if (!panelEl) return;
  panelEl.classList.remove('open');
  panelEl.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

// ─── Render ────────────────────────────────────────────────────────────────────

function renderBody(repo) {
  const parts = [];

  if (repo.description) {
    parts.push(`<p class="detail-desc">${escHtml(repo.description)}</p>`);
  }

  parts.push(releaseSection('Producción', repo.production, 'prod', repo.url));
  parts.push(releaseSection('QA', repo.qa, 'qa', repo.url));
  parts.push(pendingSection(repo));

  return parts.join('');
}

function releaseSection(label, release, type, repoUrl) {
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

  return `<div class="detail-section">${heading}${meta}${content}</div>`;
}

function prGroups(parsed, repoUrl) {
  const parts = [];
  if (parsed.features.length) parts.push(prGroup('Features', parsed.features, 'feat', repoUrl));
  if (parsed.fixes.length)    parts.push(prGroup('Fixes',    parsed.fixes,    'fix',  repoUrl));
  if (parsed.other.length)    parts.push(prGroup('Otros',    parsed.other,    'other', repoUrl));
  return `<div class="detail-pr-groups">${parts.join('')}</div>`;
}

function prGroup(title, prs, type, repoUrl) {
  const items = prs.map(pr => {
    const prUrl = `${repoUrl}/pull/${pr.number}`;
    const ticket = pr.ticket
      ? `<a class="detail-ticket" href="${escHtml(jiraUrl(pr.ticket))}" target="_blank" rel="noopener">${escHtml(pr.ticket)}</a>`
      : '';

    return `
      <div class="detail-pr-item">
        <a class="detail-pr-number" href="${escHtml(prUrl)}" target="_blank" rel="noopener">#${pr.number}</a>
        <div class="detail-pr-info">
          <div class="detail-pr-summary">${escHtml(pr.summary)}</div>
          <div class="detail-pr-meta">
            <span class="detail-pr-author">${escHtml(pr.author)}</span>
            ${ticket}
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

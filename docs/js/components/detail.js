/**
 * Panel lateral de detalle de repositorio.
 * Estructura: CI → Ruta a producción (pipeline) → Pendientes (con antigüedad) → Releases (colapsados)
 */

import { parseTagBody, formatDate, jiraUrl, escHtml, shortName } from '../utils.js';

let panelEl     = null;
let jiraTickets = {};

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

// ─── Render principal ─────────────────────────────────────────────────────────

function renderBody(repo) {
  const parts = [];

  if (repo.description) {
    parts.push(`<p class="detail-desc">${escHtml(repo.description)}</p>`);
  }

  if (repo.ci) {
    parts.push(ciSection(repo.ci));
  }

  // Ruta a producción — siempre presente, es la sección principal
  parts.push(routeSection(repo));

  // Releases anteriores — colapsados (información histórica)
  parts.push(releaseSectionCollapsed('Producción', repo.production, 'prod', repo.url, repo.production_history ?? []));
  parts.push(releaseSectionCollapsed('QA',         repo.qa,         'qa',   repo.url, repo.qa_history         ?? []));

  return parts.join('');
}

// ─── CI ───────────────────────────────────────────────────────────────────────

function ciSection(ci) {
  const running = ci.status !== 'completed';
  const cls     = running ? 'running' : (ci.conclusion ?? 'unknown');
  const LABELS  = {
    success: 'CI pasando', failure: 'CI fallando', timed_out: 'CI timeout',
    action_required: 'CI requiere acción', running: 'CI en progreso',
    cancelled: 'CI cancelado', skipped: 'CI omitido',
    neutral: 'CI neutral', unknown: 'CI desconocido',
  };
  const label = LABELS[cls] ?? `CI: ${cls}`;
  const date  = ci.updated_at ? formatDate(ci.updated_at, { relative: true }) : null;

  return `
    <div class="detail-ci detail-ci--${cls}">
      <span class="detail-ci__dot">●</span>
      <a class="detail-ci__label" href="${escHtml(ci.url)}" target="_blank" rel="noopener">${escHtml(label)}</a>
      ${date    ? `<span class="detail-ci__date">${date}</span>`         : ''}
      ${ci.name ? `<span class="detail-ci__name">${escHtml(ci.name)}</span>` : ''}
    </div>
  `;
}

// ─── Ruta a producción ────────────────────────────────────────────────────────

function routeSection(repo) {
  const toQa   = repo.pending?.to_qa;
  const toProd = repo.pending?.to_production;

  const pipeline = pipelineHtml(repo, toQa, toProd);
  const pending  = pendingBlocks(repo, toQa, toProd);
  const nextStep = nextStepHtml(toQa, toProd);

  return `
    <div class="detail-route">
      <div class="detail-route__title">Ruta a producción</div>
      ${pipeline}
      ${pending}
      ${nextStep}
    </div>
  `;
}

function pipelineHtml(repo, toQa, toProd) {
  // Nodo develop
  const devActive   = repo.last_push && daysSince(repo.last_push) < 60;
  const devDate     = repo.last_push ? formatDate(repo.last_push, { relative: true }) : null;
  const devStatus   = devActive ? 'ok' : 'idle';
  const devLabel    = devDate ? `activo ${devDate}` : 'sin actividad reciente';

  // Nodo QA
  let qaStatus, qaLabel;
  if (repo.qa) {
    const version = repo.qa.version.replace(/^qa-/, '');
    const date    = formatDate(repo.qa.date, { relative: true });
    const hasPending = (toQa?.count ?? 0) > 0;
    qaStatus = hasPending ? 'pending' : 'ok';
    qaLabel  = `${escHtml(version)}${date ? ` · ${date}` : ''}`;
  } else {
    qaStatus = 'missing';
    qaLabel  = 'sin tag de QA';
  }

  // Nodo Producción
  let prodStatus, prodLabel;
  if (repo.production) {
    const version = repo.production.version.replace(/^prod-/, '');
    const date    = formatDate(repo.production.date, { relative: true });
    const count   = toProd?.count ?? 0;
    if (count === 0) {
      prodStatus = 'ok';
      prodLabel  = `${escHtml(version)}${date ? ` · ${date}` : ''} · al día`;
    } else {
      const days = oldestCommitDays(toProd?.recent_commits);
      prodStatus = 'pending';
      prodLabel  = `${count} commit${count !== 1 ? 's' : ''} pendiente${count !== 1 ? 's' : ''}${days !== null ? ` · más antiguo: ${ageBadgeText(days)}` : ''}`;
    }
  } else {
    prodStatus = 'missing';
    prodLabel  = 'sin tag de producción';
  }

  const node = (icon, label, status, name) => `
    <div class="pipeline-node pipeline-node--${status}">
      <span class="pipeline-node__icon">${icon}</span>
      <div class="pipeline-node__info">
        <span class="pipeline-node__name">${name}</span>
        <span class="pipeline-node__label">${label}</span>
      </div>
    </div>
  `;
  const arrow = `<div class="pipeline-arrow">↓</div>`;

  return `
    <div class="pipeline">
      ${node(devStatus === 'ok' ? '✅' : '○', devLabel, devStatus, 'develop')}
      ${arrow}
      ${node(qaStatus === 'ok' ? '✅' : qaStatus === 'pending' ? '⏳' : '○', qaLabel, qaStatus, 'QA')}
      ${arrow}
      ${node(prodStatus === 'ok' ? '✅' : prodStatus === 'pending' ? '⏳' : '○', prodLabel, prodStatus, 'Producción')}
    </div>
  `;
}

function pendingBlocks(repo, toQa, toProd) {
  const parts      = [];
  const repoUrl    = repo.url;

  if ((toProd?.count ?? 0) > 0 && toProd.recent_commits?.length) {
    const compareUrl = `${repoUrl}/compare/main...qa`;
    parts.push(pendingCommitList('Pendientes a producción', toProd.count, toProd.recent_commits, 'prod', repoUrl, compareUrl));
  }
  if ((toQa?.count ?? 0) > 0 && toQa.recent_commits?.length) {
    const compareUrl = `${repoUrl}/compare/qa...develop`;
    parts.push(pendingCommitList('Pendientes a QA', toQa.count, toQa.recent_commits, 'qa', repoUrl, compareUrl));
  }

  return parts.join('');
}

function pendingCommitList(title, count, commits, type, repoUrl, compareUrl) {
  const items = commits.map(c => {
    const days    = c.date ? daysSince(c.date) : null;
    const ageCls  = days === null ? '' : days > 14 ? 'age--urgent' : days > 6 ? 'age--warn' : '';
    const ageText = days !== null ? ageBadgeText(days) : null;

    // Extraer #PR del final del mensaje (squash merge de GitHub: "título (#NNN)")
    const prMatch  = c.message.match(/\(#(\d+)\)\s*$/);
    const prNum    = prMatch ? prMatch[1] : null;
    const cleanMsg = prMatch ? c.message.replace(/\s*\(#\d+\)\s*$/, '').trim() : c.message;

    const prLink = prNum
      ? `<a class="pending-commit__pr" href="${escHtml(`${repoUrl}/pull/${prNum}`)}" target="_blank" rel="noopener">#${prNum}</a>`
      : '';

    const tickets = (c.tickets ?? []).map(t =>
      `<a class="detail-ticket" href="${escHtml(t.url)}" target="_blank" rel="noopener">${escHtml(t.id)}</a>`
    ).join('');

    return `
      <div class="pending-commit">
        <div class="pending-commit__left">
          <code class="detail-commit-sha">${escHtml(c.sha)}</code>
          ${ageText ? `<span class="pending-commit__age ${ageCls}">${ageText}</span>` : ''}
        </div>
        <div class="pending-commit__body">
          <div class="pending-commit__msg">${escHtml(cleanMsg)}</div>
          <div class="pending-commit__meta">
            ${c.author ? `<span class="pending-commit__author">${escHtml(c.author)}</span>` : ''}
            ${prLink}
            ${tickets}
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Si count > commits mostrados, hay más que el generador no incluyó
  const hiddenCount = count - commits.length;
  const moreHtml = hiddenCount > 0
    ? `<div class="pending-block__more">
        +${hiddenCount} commits más —
        <a href="${escHtml(compareUrl)}" target="_blank" rel="noopener">ver todos en GitHub ↗</a>
      </div>`
    : '';

  return `
    <div class="pending-block pending-block--${type}">
      <div class="pending-block__title">
        <span class="pending-block__dot">●</span>
        ${escHtml(title)}
        <span class="pending-block__count">${count}</span>
        <a class="pending-block__compare" href="${escHtml(compareUrl)}" target="_blank" rel="noopener">Ver en GitHub ↗</a>
      </div>
      <div class="pending-block__commits">${items}</div>
      ${moreHtml}
    </div>
  `;
}

function nextStepHtml(toQa, toProd) {
  const today = new Date().toISOString().slice(0, 10);

  if ((toProd?.count ?? 0) > 0) {
    return `
      <div class="detail-next-step">
        <span class="detail-next-step__label">Próximo paso</span>
        Crear <code>release/prod-${today}</code> con cherry-picks de los commits de arriba
      </div>
    `;
  }
  if ((toQa?.count ?? 0) > 0) {
    return `
      <div class="detail-next-step">
        <span class="detail-next-step__label">Próximo paso</span>
        Crear <code>release/qa-${today}</code> con cherry-picks de los commits de arriba
      </div>
    `;
  }
  return '';
}

// ─── Releases colapsados ──────────────────────────────────────────────────────

function releaseSectionCollapsed(label, release, type, repoUrl, history = []) {
  const version  = release
    ? (type === 'qa' ? release.version.replace(/^qa-/, '') : release.version.replace(/^prod-/, ''))
    : null;
  const date   = release ? formatDate(release.date) : null;
  const parsed = release ? parseTagBody(release.body) : null;
  const prCount = parsed ? parsed.features.length + parsed.fixes.length + parsed.other.length : 0;

  const summaryLabel = version
    ? [escHtml(version), date, prCount ? `${prCount} PRs` : null].filter(Boolean).join(' · ')
    : 'Sin release';

  const content = !release
    ? `<p class="detail-empty">Sin release</p>`
    : parsed
      ? prGroups(parsed, repoUrl)
      : `<p class="detail-empty">Sin detalle de PRs — tag creado sin el flujo automático.</p>`;

  const histHtml = history.length ? historySection(history, type, repoUrl) : '';

  return `
    <details class="detail-release-block">
      <summary class="detail-release-block__summary">
        <span class="detail-release-block__type detail-release-block__type--${type}">${label}</span>
        <span class="detail-release-block__meta">${summaryLabel}</span>
      </summary>
      <div class="detail-release-block__body">
        ${content}
        ${histHtml}
      </div>
    </details>
  `;
}

function historySection(history, type, repoUrl) {
  const items = history.map(rel => {
    const version = type === 'qa' ? rel.version.replace(/^qa-/, '') : rel.version;
    const date    = formatDate(rel.date);
    const parsed  = parseTagBody(rel.body);
    const prCount = parsed ? parsed.features.length + parsed.fixes.length + parsed.other.length : 0;

    const summaryText = [escHtml(version), date, prCount ? `${prCount} PRs` : null]
      .filter(Boolean).join(' · ');

    return `
      <details class="detail-history-item">
        <summary class="detail-history-item__summary">${summaryText}</summary>
        <div class="detail-history-item__body">
          ${parsed ? prGroups(parsed, repoUrl) : '<p class="detail-empty">Sin detalle de PRs</p>'}
        </div>
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

// ─── PR groups ────────────────────────────────────────────────────────────────

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
    const prUrl      = `${repoUrl}/pull/${pr.number}`;
    const ticket     = pr.ticket
      ? `<a class="detail-ticket" href="${escHtml(jiraUrl(pr.ticket))}" target="_blank" rel="noopener">${escHtml(pr.ticket)}</a>`
      : '';
    const jira       = pr.ticket ? jiraTickets[pr.ticket] : null;
    const statusPill = jira?.status
      ? `<span class="jira-status jira-status--${escHtml(jiraStatusClass(jira.status))}" title="${escHtml(jira.summary ?? '')}">${escHtml(jira.status)}</span>`
      : '';
    const assignee   = jira?.assignee
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysSince(isoString) {
  if (!isoString) return null;
  const d = new Date(isoString);
  if (isNaN(d)) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function ageBadgeText(days) {
  if (days === 0) return 'hoy';
  if (days === 1) return '1 día';
  return `${days} días`;
}

function oldestCommitDays(commits) {
  if (!commits?.length) return null;
  const dates = commits.map(c => c.date ? daysSince(c.date) : null).filter(d => d !== null);
  return dates.length ? Math.max(...dates) : null;
}

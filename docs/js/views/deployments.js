import { formatDate, parseTagBody, escHtml, shortName } from '../utils.js';

/**
 * Vista Deployments — timeline cronológico de todos los deploys prod + QA.
 */
export function renderDeployments(repos) {
  const allEvents = getAllDeployEvents(repos);

  if (!allEvents.length) {
    return `<div class="timeline-empty">No hay deployments registrados aún.</div>`;
  }

  return `
    <div class="deployments-header">
      <div class="deploy-type-toggle" id="deploy-type-toggle">
        <button class="deploy-type-btn active" data-type="all">Todos</button>
        <button class="deploy-type-btn" data-type="prod">Producción</button>
        <button class="deploy-type-btn" data-type="qa">QA</button>
      </div>
    </div>
    <div id="deploy-timeline">${renderTimeline(allEvents, 'all')}</div>
  `;
}

export function bindDeploymentEvents(root, repos) {
  const allEvents = getAllDeployEvents(repos);
  const toggle    = root.querySelector('#deploy-type-toggle');
  const timeline  = root.querySelector('#deploy-timeline');
  if (!toggle || !timeline) return;

  toggle.addEventListener('click', e => {
    const btn = e.target.closest('[data-type]');
    if (!btn) return;
    toggle.querySelectorAll('[data-type]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    timeline.innerHTML = renderTimeline(allEvents, btn.dataset.type);
  });
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderTimeline(events, typeFilter) {
  const filtered = typeFilter === 'all'
    ? events
    : events.filter(e => e.type === typeFilter);

  if (!filtered.length) {
    return `<div class="timeline-empty">No hay deployments de este tipo.</div>`;
  }

  // Agrupar por día
  const byDay = new Map();
  for (const event of filtered) {
    const day = event.tag.date ? event.tag.date.slice(0, 10) : 'sin-fecha';
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(event);
  }

  return `<div class="timeline">${
    [...byDay.entries()].map(([day, dayEvents]) => `
      <div class="timeline-day">
        <div class="timeline-day-header">${formatDay(day)}</div>
        <div class="timeline-events">
          ${dayEvents.map(e => timelineEvent(e)).join('')}
        </div>
      </div>
    `).join('')
  }</div>`;
}

function timelineEvent(event) {
  const { repo, type, tag } = event;
  const typeLabel = type === 'prod' ? 'Producción' : 'QA';
  const version   = type === 'qa'
    ? tag.version.replace(/^qa-/, '')
    : tag.version;
  const time      = tag.date
    ? new Date(tag.date).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
    : '';

  const parsed   = parseTagBody(tag.body);
  const prCount  = parsed
    ? parsed.features.length + parsed.fixes.length + parsed.other.length
    : 0;

  const prSummary = prCount
    ? `<span class="timeline-event__pr-count">${prCount} PR${prCount !== 1 ? 's' : ''}</span>`
    : '';

  return `
    <div class="timeline-event" data-repo-open="${escHtml(repo)}" role="button" tabindex="0">
      <span class="timeline-event__indicator timeline-event__indicator--${type}"></span>
      <div class="timeline-event__body">
        <div class="timeline-event__repo">${escHtml(repo)}</div>
        <div class="timeline-event__meta">
          <span class="timeline-event__type timeline-event__type--${type}">${typeLabel}</span>
          <span class="timeline-event__tag">${escHtml(version)}</span>
          ${prSummary}
        </div>
      </div>
      ${time ? `<span class="timeline-event__time">${time}</span>` : ''}
    </div>
  `;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAllDeployEvents(repos) {
  const events = [];
  for (const repo of repos) {
    const name = shortName(repo.full_name);
    for (const tag of [repo.production, ...(repo.production_history ?? [])]) {
      if (tag) events.push({ repo: name, fullName: repo.full_name, type: 'prod', tag });
    }
    for (const tag of [repo.qa, ...(repo.qa_history ?? [])]) {
      if (tag) events.push({ repo: name, fullName: repo.full_name, type: 'qa', tag });
    }
  }
  return events
    .filter(e => e.tag.date)
    .sort((a, b) => new Date(b.tag.date) - new Date(a.tag.date));
}

function formatDay(dayStr) {
  if (dayStr === 'sin-fecha') return 'Fecha desconocida';
  const date = new Date(dayStr + 'T12:00:00');
  if (isNaN(date)) return dayStr;

  const today     = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate();

  if (sameDay(date, today))     return 'Hoy';
  if (sameDay(date, yesterday)) return 'Ayer';

  return date.toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

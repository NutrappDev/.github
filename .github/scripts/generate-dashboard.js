#!/usr/bin/env node
/**
 * generate-dashboard.js
 *
 * Consulta la API de GitHub para todos los repos de NutrappDev y genera
 * docs/data/repos.json con el estado de producción, QA y cambios pendientes.
 *
 * Uso:
 *   GH_TOKEN=<token> node .github/scripts/generate-dashboard.js [output-path]
 *
 * El token necesita: read:org + contents:read en todos los repos de la org.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

// ─── Configuración ────────────────────────────────────────────────────────────

const ORG = 'NutrappDev';
const JIRA_BASE     = 'https://nutrabiotics.atlassian.net/browse';
const JIRA_BASE_API = 'https://nutrabiotics.atlassian.net/rest/api/3';
const OUTPUT = process.argv[2] || 'docs/data/repos.json';
const TOKEN       = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const JIRA_EMAIL  = process.env.JIRA_EMAIL;
const JIRA_TOKEN  = process.env.JIRA_TOKEN;
const CONCURRENCY = 8; // repos procesados en paralelo

const PROD_TAG_PATTERN = /^(v\d|prod-\d{4}-\d{2}-\d{2})/;
const QA_TAG_PATTERN = /^qa-\d{4}-\d{2}-\d{2}$/;
const PENDING_COMMITS_LIMIT = 25; // commits recientes a incluir en "pending"

if (!TOKEN) {
  console.error('Error: GH_TOKEN o GITHUB_TOKEN requerido');
  process.exit(1);
}

// ─── Cliente HTTP ─────────────────────────────────────────────────────────────

async function ghFetch(path, { paginated = false } = {}) {
  const base = 'https://api.github.com';
  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  if (!paginated) {
    const res = await fetch(`${base}${path}`, { headers });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${res.statusText}`);
    return res.json();
  }

  // Paginación automática
  const results = [];
  let page = 1;
  while (true) {
    const sep = path.includes('?') ? '&' : '?';
    const res = await fetch(`${base}${path}${sep}per_page=100&page=${page}`, { headers });
    if (res.status === 404) break;
    if (!res.ok) throw new Error(`GET ${path} (page ${page}) → ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    results.push(...data);
    if (data.length < 100) break;
    page++;
  }
  return results;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extrae tickets Jira de un string (ej. "NUTRI-123, NUTRI-456") */
function extractJiraTickets(text) {
  return [...new Set((text || '').match(/[A-Z]+-\d+/g) || [])];
}

/** Construye URL de Jira a partir de un ticket */
function jiraUrl(ticket) {
  return `${JIRA_BASE}/${ticket}`;
}

// ─── Jira ──────────────────────────────────────────────────────────────────────

/** Recopila todos los ticket IDs únicos de los cuerpos de los tags y commits pendientes */
function collectTicketIds(repos) {
  const tickets = new Set();
  const pattern = /\[([A-Z]{2,}-\d+)\]/g;
  for (const repo of repos) {
    for (const tag of [
      repo.production,
      repo.qa,
      ...(repo.production_history ?? []),
      ...(repo.qa_history ?? []),
    ]) {
      if (tag?.body) {
        for (const m of tag.body.matchAll(pattern)) tickets.add(m[1]);
      }
    }
    for (const pending of [repo.pending?.to_qa, repo.pending?.to_production]) {
      for (const commit of pending?.recent_commits ?? []) {
        for (const t of commit.tickets ?? []) tickets.add(t.id);
      }
    }
  }
  return [...tickets];
}

/**
 * Consulta la API de Jira Cloud (v3) para obtener estado de los tickets.
 * @returns {Record<string, { summary, status, assignee }>}
 */
async function getJiraTickets(ticketIds) {
  if (!JIRA_EMAIL || !JIRA_TOKEN) {
    console.log('  Jira: JIRA_EMAIL o JIRA_TOKEN no configurado — omitiendo enriquecimiento.');
    return {};
  }
  if (!ticketIds.length) return {};

  const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString('base64');
  console.log(`  Jira: consultando ${ticketIds.length} tickets únicos...`);

  try {
    const res = await fetch(`${JIRA_BASE_API}/search/jql`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type':  'application/json',
        'Accept':        'application/json',
      },
      body: JSON.stringify({
        jql:        `key in (${ticketIds.join(', ')})`,
        fields:     ['summary', 'status', 'assignee'],
        maxResults: 200,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn(`  ⚠ Jira API: ${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 120)}` : ''}`);
      return {};
    }

    const data = await res.json();
    const result = {};
    for (const issue of data.issues ?? []) {
      result[issue.key] = {
        summary:  issue.fields.summary ?? null,
        status:   issue.fields.status?.name ?? null,
        assignee: issue.fields.assignee?.displayName ?? null,
      };
    }
    console.log(`  Jira: ✅ ${Object.keys(result).length} tickets enriquecidos`);
    return result;
  } catch (err) {
    console.warn(`  ⚠ Jira API error: ${err.message}`);
    return {};
  }
}

/** Estado del último workflow run en la rama principal del repo */
async function getCiStatus(owner, repo, branch) {
  const data = await ghFetch(
    `/repos/${owner}/${repo}/actions/runs?branch=${encodeURIComponent(branch)}&per_page=1`
  );
  if (!data?.workflow_runs?.length) return null;
  const run = data.workflow_runs[0];
  return {
    status:     run.status,
    conclusion: run.conclusion,
    url:        run.html_url,
    updated_at: run.updated_at,
    name:       run.name,
  };
}

/** Obtiene la fecha de un commit a partir de su SHA */
async function getCommitDate(owner, repo, sha) {
  const commit = await ghFetch(`/repos/${owner}/${repo}/git/commits/${sha}`);
  return commit?.committer?.date ?? commit?.author?.date ?? null;
}

// ─── Datos por repo ────────────────────────────────────────────────────────────

/**
 * Resuelve fecha y body de un único tag (anotado o ligero).
 */
async function fetchTagInfo(owner, repo, match) {
  let body = null;
  let date = null;

  const ref = await ghFetch(
    `/repos/${owner}/${repo}/git/ref/tags/${encodeURIComponent(match.name)}`
  );
  if (ref?.object?.type === 'tag') {
    const tagObj = await ghFetch(`/repos/${owner}/${repo}/git/tags/${ref.object.sha}`);
    if (tagObj) {
      body = tagObj.message ?? null;
      date = tagObj.tagger?.date ?? null;
    }
  }

  if (!date) {
    date = await getCommitDate(owner, repo, match.commit.sha);
  }

  return {
    version: match.name,
    sha: match.commit.sha,
    date,
    url: `https://github.com/${owner}/${repo}/releases/tag/${match.name}`,
    body,
  };
}

/**
 * Historial de los últimos N tags que cumplen el patrón.
 * Recibe la lista ya obtenida para evitar doble paginación.
 * El índice 0 es el más reciente.
 */
async function getTagHistory(owner, repo, allTags, pattern, limit = 5) {
  if (!allTags?.length) return [];
  const matching = allTags.filter(t => pattern.test(t.name)).slice(0, limit);
  if (!matching.length) return [];
  return Promise.all(matching.map(match => fetchTagInfo(owner, repo, match)));
}

/**
 * Compara dos branches y devuelve cuántos commits tiene `head` que no tiene `base`,
 * más un resumen de los más recientes.
 */
async function compareBranches(owner, repo, base, head) {
  const data = await ghFetch(`/repos/${owner}/${repo}/compare/${base}...${head}`);
  if (!data) return null;

  const recentCommits = (data.commits ?? [])
    .slice(0, PENDING_COMMITS_LIMIT)
    .map(c => {
      const message = c.commit.message.split('\n')[0];
      const tickets = extractJiraTickets(message);
      return {
        sha: c.sha.slice(0, 7),
        message,
        date: c.commit.committer?.date ?? c.commit.author?.date ?? null,
        author: c.commit.author?.name ?? c.author?.login ?? null,
        tickets: tickets.map(t => ({ id: t, url: jiraUrl(t) })),
      };
    });

  return {
    count: data.ahead_by,
    recent_commits: recentCommits,
  };
}

/** Procesa un repo completo */
async function processRepo(repo) {
  const owner = repo.owner.login;
  const name = repo.name;

  console.log(`  Processing ${name}...`);

  // Obtener lista de tags una vez (compartida para prod y qa)
  let allTags = [];
  try {
    allTags = await ghFetch(`/repos/${owner}/${name}/tags`, { paginated: true }) ?? [];
  } catch (err) {
    console.warn(`  ⚠ ${name}: error fetching tags: ${err.message}`);
  }

  // Lanzar el resto de llamadas en paralelo
  const [prodHistory, qaHistory, pendingToQa, pendingToProd, ciStatus] =
    await Promise.allSettled([
      getTagHistory(owner, name, allTags, PROD_TAG_PATTERN, 5),
      getTagHistory(owner, name, allTags, QA_TAG_PATTERN, 5),
      compareBranches(owner, name, 'qa', 'develop'),
      compareBranches(owner, name, 'main', 'qa'),
      getCiStatus(owner, name, repo.default_branch),
    ]);

  const get = result => (result.status === 'fulfilled' ? result.value : null);
  const getErr = result => (result.status === 'rejected' ? result.reason?.message : null);

  const prodHist = get(prodHistory) ?? [];
  const qaHist   = get(qaHistory)   ?? [];

  return {
    name,
    full_name: repo.full_name,
    description: repo.description ?? null,
    url: repo.html_url,
    is_archived: repo.archived,
    is_fork: repo.fork,
    default_branch: repo.default_branch,
    last_push: repo.pushed_at,
    topics: repo.topics ?? [],

    production:         prodHist[0] ?? null,
    production_history: prodHist.slice(1),

    qa:         qaHist[0] ?? null,
    qa_history: qaHist.slice(1),

    pending: {
      to_qa:          get(pendingToQa),
      to_production:  get(pendingToProd),
    },

    ci: get(ciStatus),

    // Errores no fatales para debugging
    _errors: {
      production:            getErr(prodHistory),
      qa:                    getErr(qaHistory),
      pending_to_qa:         getErr(pendingToQa),
      pending_to_production: getErr(pendingToProd),
      ci:                    getErr(ciStatus),
    },
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nFetching repos for ${ORG}...`);

  // type=sources excluye forks desde la API (evita paginar repos que no usaremos)
  const allRepos = await ghFetch(`/orgs/${ORG}/repos?type=sources`, { paginated: true });
  const repos = allRepos.filter(r => !r.archived && r.name !== '.github');

  console.log(`Found ${repos.length} active repos (${allRepos.length} non-fork total, archived excluded)\n`);

  // Procesar en lotes para respetar rate limit (5000 req/h con PAT)
  const results = [];
  for (let i = 0; i < repos.length; i += CONCURRENCY) {
    const batch = repos.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(r =>
        processRepo(r).catch(err => {
          console.error(`  ✗ ${r.name}: ${err.message}`);
          return {
            name: r.name,
            full_name: r.full_name,
            url: r.html_url,
            is_archived: r.archived,
            error: err.message,
          };
        })
      )
    );
    results.push(...batchResults);

    // Pausa entre lotes para no saturar la API
    if (i + CONCURRENCY < repos.length) {
      await new Promise(res => setTimeout(res, 500));
    }
  }

  // Ordenar: primero repos con actividad reciente
  results.sort((a, b) => {
    const dateA = a.production?.date ?? a.qa?.date ?? a.last_push ?? '';
    const dateB = b.production?.date ?? b.qa?.date ?? b.last_push ?? '';
    return dateB.localeCompare(dateA);
  });

  // Enriquecer con datos de Jira
  console.log('\nFetching Jira ticket data...');
  const allTicketIds = collectTicketIds(results);
  const jiraTickets  = await getJiraTickets(allTicketIds);

  const output = {
    generated_at:  new Date().toISOString(),
    organization:  ORG,
    jira_base_url: JIRA_BASE,
    total_repos:   results.length,
    jira_tickets:  jiraTickets,
    repos:         results,
  };

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, JSON.stringify(output, null, 2), 'utf8');

  const withProd   = results.filter(r => r.production).length;
  const withQa     = results.filter(r => r.qa).length;
  const withErrors = results.filter(r => r.error).length;
  const withHistory = results.filter(r => r.production_history?.length).length;

  console.log(`\n✅ Generado: ${OUTPUT}`);
  console.log(`   ${results.length} repos | ${withProd} con prod | ${withQa} con QA | ${withHistory} con historial${withErrors ? ` | ⚠️  ${withErrors} con errores` : ''}`);
}

main().catch(err => {
  console.error('\n✗ Error fatal:', err.message);
  process.exit(1);
});

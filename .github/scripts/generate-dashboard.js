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
const JIRA_BASE = 'https://nutrabiotics.atlassian.net/browse';
const OUTPUT = process.argv[2] || 'docs/data/repos.json';
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const CONCURRENCY = 8; // repos procesados en paralelo

const PROD_TAG_PATTERN = /^v\d+/;
const QA_TAG_PATTERN = /^qa-\d{4}-\d{2}-\d{2}$/;
const PENDING_COMMITS_LIMIT = 10; // commits recientes a incluir en "pending"

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

/** Obtiene la fecha de un commit a partir de su SHA */
async function getCommitDate(owner, repo, sha) {
  const commit = await ghFetch(`/repos/${owner}/${repo}/git/commits/${sha}`);
  return commit?.committer?.date ?? commit?.author?.date ?? null;
}

// ─── Datos por repo ────────────────────────────────────────────────────────────

/** Último tag que cumple el patrón (los tags vienen ordenados: newest first) */
async function getLatestTag(owner, repo, pattern) {
  const tags = await ghFetch(`/repos/${owner}/${repo}/tags`, { paginated: true });
  if (!tags?.length) return null;

  const match = tags.find(t => pattern.test(t.name));
  if (!match) return null;

  const date = await getCommitDate(owner, repo, match.commit.sha);
  return {
    version: match.name,
    sha: match.commit.sha,
    date,
    url: `https://github.com/${owner}/${repo}/releases/tag/${match.name}`,
  };
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

/** Últimas N releases creadas (GitHub Releases, no solo tags) */
async function getRecentReleases(owner, repo, limit = 5) {
  const releases = await ghFetch(`/repos/${owner}/${repo}/releases?per_page=${limit}`);
  if (!releases?.length) return [];

  return releases.slice(0, limit).map(r => {
    const tickets = extractJiraTickets(r.body ?? '');
    return {
      tag: r.tag_name,
      name: r.name ?? r.tag_name,
      date: r.published_at ?? r.created_at,
      url: r.html_url,
      is_prerelease: r.prerelease,
      tickets: tickets.map(t => ({ id: t, url: jiraUrl(t) })),
      // body del release: si sigue el formato "Features (N): / Fixes (N):" lo preservamos
      body: r.body ? r.body.slice(0, 2000) : null,
    };
  });
}

/** Procesa un repo completo */
async function processRepo(repo) {
  const owner = repo.owner.login;
  const name = repo.name;

  console.log(`  Processing ${name}...`);

  // Lanzar todas las llamadas en paralelo — si alguna falla, no bloquea las demás
  const [prodTag, qaTag, pendingToQa, pendingToProd, recentReleases] =
    await Promise.allSettled([
      getLatestTag(owner, name, PROD_TAG_PATTERN),
      getLatestTag(owner, name, QA_TAG_PATTERN),
      compareBranches(owner, name, 'qa', 'develop'),
      compareBranches(owner, name, 'main', 'qa'),
      getRecentReleases(owner, name, 5),
    ]);

  const get = result => (result.status === 'fulfilled' ? result.value : null);
  const getErr = result => (result.status === 'rejected' ? result.reason?.message : null);

  return {
    name,
    full_name: repo.full_name,
    description: repo.description ?? null,
    url: repo.html_url,
    is_archived: repo.archived,
    is_fork: repo.fork,
    default_branch: repo.default_branch,
    last_push: repo.pushed_at,

    production: get(prodTag),
    qa: get(qaTag),

    pending: {
      to_qa: get(pendingToQa),
      to_production: get(pendingToProd),
    },

    recent_releases: get(recentReleases) ?? [],

    // Errores no fatales: se incluyen para debugging sin romper el JSON
    _errors: {
      production: getErr(prodTag),
      qa: getErr(qaTag),
      pending_to_qa: getErr(pendingToQa),
      pending_to_production: getErr(pendingToProd),
      recent_releases: getErr(recentReleases),
    },
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nFetching repos for ${ORG}...`);

  const allRepos = await ghFetch(`/orgs/${ORG}/repos?type=all`, { paginated: true });
  const repos = allRepos.filter(
    r => !r.archived && !r.fork && r.name !== '.github'
  );

  console.log(`Found ${repos.length} active repos (${allRepos.length} total, forks/archived excluded)\n`);

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

  const output = {
    generated_at: new Date().toISOString(),
    organization: ORG,
    jira_base_url: JIRA_BASE,
    total_repos: results.length,
    repos: results,
  };

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, JSON.stringify(output, null, 2), 'utf8');

  const withProd = results.filter(r => r.production).length;
  const withQa = results.filter(r => r.qa).length;
  const withErrors = results.filter(r => r.error).length;

  console.log(`\n✅ Generado: ${OUTPUT}`);
  console.log(`   ${results.length} repos | ${withProd} con prod | ${withQa} con QA${withErrors ? ` | ⚠️  ${withErrors} con errores` : ''}`);
}

main().catch(err => {
  console.error('\n✗ Error fatal:', err.message);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * generate-activity.js
 *
 * Consulta la API de GitHub para todos los repos de NutrappDev y genera
 * docs/data/activity.json con métricas de actividad por desarrollador.
 *
 * Fuente: PRs mergeados en los últimos 90 días (todas las ramas).
 *
 * Uso:
 *   GH_TOKEN=<token> node .github/scripts/generate-activity.js [output-path]
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname }          from 'node:path';

const ORG          = 'NutrappDev';
const WINDOW_DAYS  = 90;
const OUTPUT       = process.argv[2] || 'docs/data/activity.json';
const TOKEN        = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const CONCURRENCY  = 6;

if (!TOKEN) {
  console.error('Error: GH_TOKEN o GITHUB_TOKEN requerido');
  process.exit(1);
}

const NOW       = new Date();
const CUTOFF_90 = new Date(NOW - WINDOW_DAYS * 24 * 60 * 60 * 1000);
const CUTOFF_30 = new Date(NOW - 30 * 24 * 60 * 60 * 1000);

// ─── Cliente HTTP ─────────────────────────────────────────────────────────────

const GH_HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

async function ghGet(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers: GH_HEADERS });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${res.statusText}`);
  return res.json();
}

async function ghPaginate(path) {
  const results = [];
  let page = 1;
  while (true) {
    const sep = path.includes('?') ? '&' : '?';
    const res = await fetch(`https://api.github.com${path}${sep}per_page=100&page=${page}`, {
      headers: GH_HEADERS,
    });
    if (!res.ok || res.status === 404) break;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    results.push(...data);
    if (data.length < 100) break;
    page++;
  }
  return results;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  const wn = 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  return `${d.getFullYear()}-W${String(wn).padStart(2, '0')}`;
}

// Últimas 13 semanas (semana actual + 12 anteriores)
const last13Weeks = Array.from({ length: 13 }, (_, i) => {
  const d = new Date(NOW - (12 - i) * 7 * 24 * 60 * 60 * 1000);
  return isoWeek(d);
});

async function runConcurrent(items, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

// ─── Procesamiento ────────────────────────────────────────────────────────────

async function procesRepo(repoName) {
  const prs = await ghPaginate(
    `/repos/${ORG}/${repoName}/pulls?state=closed&sort=updated&direction=desc`
  );

  const entries = [];
  for (const pr of prs) {
    if (!pr.merged_at) continue;
    const mergedAt = new Date(pr.merged_at);
    if (mergedAt < CUTOFF_90) continue;

    const login = pr.user?.login;
    if (!login || login.includes('[bot]')) continue;

    entries.push({
      login,
      avatar_url: pr.user.avatar_url,
      merged_at:  pr.merged_at,
      base_ref:   pr.base?.ref ?? '',
      repo:       repoName,
    });
  }
  return entries;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log(`Obteniendo repos de ${ORG}…`);
const repos = await ghPaginate(`/orgs/${ORG}/repos?type=all`);
console.log(`  ${repos.length} repos encontrados`);

console.log('Procesando PRs mergeados (últimos 90 días)…');
const repoEntries = await runConcurrent(repos.map(r => r.name), procesRepo);
const allEntries  = repoEntries.flat();
console.log(`  ${allEntries.length} PRs mergeados en total`);

// Agregar por developer
const devMap = new Map();

for (const entry of allEntries) {
  if (!devMap.has(entry.login)) {
    devMap.set(entry.login, {
      login:         entry.login,
      avatar_url:    entry.avatar_url,
      prs_30d:       0,
      prs_90d:       0,
      last_activity: null,
      by_repo:       {},
      by_branch:     { develop: 0, qa: 0, main: 0 },
      weekly:        {},
    });
  }
  const dev = devMap.get(entry.login);
  const mergedAt = new Date(entry.merged_at);

  dev.prs_90d++;
  if (mergedAt >= CUTOFF_30) dev.prs_30d++;

  if (!dev.last_activity || mergedAt > new Date(dev.last_activity)) {
    dev.last_activity = entry.merged_at;
  }

  dev.by_repo[entry.repo] = (dev.by_repo[entry.repo] ?? 0) + 1;

  if (['develop', 'qa', 'main'].includes(entry.base_ref)) {
    dev.by_branch[entry.base_ref]++;
  }

  const week = isoWeek(mergedAt);
  dev.weekly[week] = (dev.weekly[week] ?? 0) + 1;
}

// Convertir a array ordenado
const developers = Array.from(devMap.values())
  .filter(d => d.prs_90d > 0)
  .map(d => ({
    login:         d.login,
    avatar_url:    d.avatar_url,
    prs_30d:       d.prs_30d,
    prs_90d:       d.prs_90d,
    last_activity: d.last_activity,
    by_repo:       Object.entries(d.by_repo)
                     .map(([repo, prs]) => ({ repo, prs }))
                     .sort((a, b) => b.prs - a.prs),
    by_branch: d.by_branch,
    weekly:    last13Weeks.map(w => ({ week: w, prs: d.weekly[w] ?? 0 })),
  }))
  .sort((a, b) => b.prs_30d - a.prs_30d || b.prs_90d - a.prs_90d);

const output = {
  generated_at: NOW.toISOString(),
  window_days:  WINDOW_DAYS,
  developers,
};

await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, JSON.stringify(output, null, 2));

console.log(`\nGenerado ${OUTPUT}: ${developers.length} desarrolladores`);
developers.forEach(d =>
  console.log(`  ${d.login}: ${d.prs_30d} PRs (30d) · ${d.prs_90d} PRs (90d)`)
);

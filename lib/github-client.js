// ============================================================================
// github-client.js — Cliente para la API de GitHub (comentarios en PRs/commits)
// ============================================================================
import { getGitHubToken } from './config-loader.js';

const GITHUB_API = 'https://api.github.com';

/**
 * Realiza una petición autenticada a la API de GitHub.
 */
async function githubFetch(url, options = {}) {
  const token = getGitHubToken();
  if (!token) {
    console.log('[GITHUB] No hay PAT configurado, saltando petición a API.');
    return null;
  }

  const headers = {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...options.headers
  };

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    console.error(`[GITHUB] Error ${response.status}: ${await response.text()}`);
    return null;
  }
  return response.json();
}

/**
 * Obtiene el diff de un Pull Request.
 * @param {string} owner - Dueño del repo
 * @param {string} repo  - Nombre del repo
 * @param {number} prNumber - Número del PR
 * @returns {Promise<string|null>} Diff en texto plano
 */
export async function getPRDiff(owner, repo, prNumber) {
  const token = getGitHubToken();
  if (!token) return null;

  const url = `${GITHUB_API}/repos/${owner}/${repo}/pulls/${prNumber}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3.diff',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });

  if (!response.ok) {
    console.error(`[GITHUB] Error obteniendo diff: ${response.status}`);
    return null;
  }
  return response.text();
}

/**
 * Publica un comentario en un Pull Request.
 */
export async function commentOnPR(owner, repo, prNumber, body) {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/issues/${prNumber}/comments`;
  return githubFetch(url, {
    method: 'POST',
    body: JSON.stringify({ body })
  });
}

/**
 * Publica un comentario en un commit.
 */
export async function commentOnCommit(owner, repo, sha, body) {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/commits/${sha}/comments`;
  return githubFetch(url, {
    method: 'POST',
    body: JSON.stringify({ body })
  });
}

/**
 * Obtiene el contenido de un archivo del repo.
 * @returns {Promise<string|null>} Contenido decodificado del archivo
 */
export async function getFileContent(owner, repo, path, ref) {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}?ref=${ref}`;
  const data = await githubFetch(url);
  if (!data || !data.content) return null;
  return Buffer.from(data.content, 'base64').toString('utf-8');
}

/**
 * Obtiene los logs de un workflow run.
 * @returns {Promise<string|null>} URL de descarga de logs (ZIP)
 */
export async function getWorkflowLogs(owner, repo, runId) {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/actions/runs/${runId}/logs`;
  const token = getGitHubToken();
  if (!token) return null;

  const response = await fetch(url, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    redirect: 'manual'
  });

  // La API de GitHub retorna un 302 con la URL del ZIP de logs
  if (response.status === 302) {
    return response.headers.get('location');
  }
  return null;
}

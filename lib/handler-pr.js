// ============================================================================
// handler-pr.js — Manejador de eventos Pull Request (Auditoría de Seguridad)
// ============================================================================
import { getRepoConfig } from './config-loader.js';
import { queryOllama } from './ollama-client.js';
import { loadPrompt, loadTemplate, fillTemplate } from './prompt-loader.js';
import { getPRDiff, commentOnPR } from './github-client.js';

/**
 * Maneja eventos de Pull Request (opened, synchronize, reopened).
 * Ejecuta auditoría de seguridad CDK si pre_synth_audit está habilitado.
 *
 * @param {object} payload - Webhook payload de GitHub
 * @returns {Promise<{handled: boolean, report?: string}>}
 */
export async function handlePullRequest(payload) {
  const { action, pull_request, repository } = payload;
  const fullName = repository.full_name;
  const prNumber = pull_request.number;

  console.log(`\n${'='.repeat(70)}`);
  console.log(`[PR] Evento recibido: ${action} en ${fullName}#${prNumber}`);
  console.log(`[PR] Título: ${pull_request.title}`);
  console.log(`[PR] Autor: ${pull_request.user?.login}`);
  console.log(`${'='.repeat(70)}`);

  // 1. Verificar si el repo está registrado y tiene auditoría habilitada
  const repoConfig = getRepoConfig(fullName);
  if (!repoConfig) {
    console.log(`[PR] Repositorio ${fullName} no registrado en ai-core.yml. Ignorando.`);
    return { handled: false };
  }
  if (!repoConfig.ai_features?.pre_synth_audit) {
    console.log(`[PR] pre_synth_audit deshabilitado para ${fullName}. Ignorando.`);
    return { handled: false };
  }

  // 2. Obtener el diff del PR
  console.log(`[PR] Obteniendo diff del PR #${prNumber}...`);
  let diff = null;

  // Intentar con la API de GitHub (si hay token)
  const [owner, repo] = fullName.split('/');
  diff = await getPRDiff(owner, repo, prNumber);

  // Fallback: usar la diff_url del payload
  if (!diff && pull_request.diff_url) {
    console.log(`[PR] Usando diff_url del payload...`);
    try {
      const response = await fetch(pull_request.diff_url);
      diff = await response.text();
    } catch (err) {
      console.error(`[PR] Error obteniendo diff:`, err.message);
    }
  }

  if (!diff || diff.length < 10) {
    console.log(`[PR] No se pudo obtener un diff válido. Abortando.`);
    return { handled: false };
  }

  console.log(`[PR] Diff obtenido: ${diff.length} caracteres`);

  // 3. Cargar el system prompt de seguridad
  const systemPrompt = loadPrompt('cdk-security-expert');

  // 4. Construir el prompt de usuario con contexto
  const userPrompt = [
    `## Contexto del Pull Request`,
    `- **Repositorio:** ${fullName}`,
    `- **PR:** #${prNumber} — ${pull_request.title}`,
    `- **Autor:** ${pull_request.user?.login}`,
    `- **Branch:** ${pull_request.head?.ref} → ${pull_request.base?.ref}`,
    ``,
    `## Diff del Código`,
    '```diff',
    diff.substring(0, 8000), // Limitar para no exceder contexto del modelo
    '```'
  ].join('\n');

  // 5. Consultar al LLM
  console.log(`[PR] Enviando análisis de seguridad a Ollama...`);
  const aiResponse = await queryOllama(systemPrompt, userPrompt);

  // 6. Formatear el reporte con la plantilla
  const template = loadTemplate('security-report');
  const report = fillTemplate(template, {
    REPO_NAME: fullName,
    PR_NUMBER: String(prNumber),
    PR_TITLE: pull_request.title,
    PR_AUTHOR: pull_request.user?.login || 'unknown',
    TIMESTAMP: new Date().toISOString(),
    MODEL_NAME: 'qwen2.5-coder:7b (Ollama local)',
    EXECUTIVE_SUMMARY: aiResponse,
    FINDINGS_TABLE_ROWS: '_(Incluido en el análisis arriba)_',
    CORRECTED_CODE_BLOCKS: '_(Incluido en el análisis arriba)_',
    COUNT_CRITICAL: '—',
    COUNT_HIGH: '—',
    COUNT_MEDIUM: '—',
    VERDICT: 'Revisión humana requerida'
  });

  console.log(`\n${'─'.repeat(70)}`);
  console.log(`[PR] REPORTE DE SEGURIDAD:`);
  console.log(`${'─'.repeat(70)}`);
  console.log(report);
  console.log(`${'─'.repeat(70)}\n`);

  // 7. Publicar en GitHub si hay token
  const commented = await commentOnPR(owner, repo, prNumber, report);
  if (commented) {
    console.log(`[PR] ✅ Comentario publicado en GitHub PR #${prNumber}`);
  } else {
    console.log(`[PR] ℹ️ Reporte solo en consola (sin GitHub PAT configurado).`);
  }

  return { handled: true, report };
}

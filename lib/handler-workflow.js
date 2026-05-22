// ============================================================================
// handler-workflow.js — Manejador de fallos en GitHub Actions (Log Analyzer)
// ============================================================================
import { getRepoConfig, loadConfig } from './config-loader.js';
import { queryOllama } from './ollama-client.js';
import { loadPrompt, loadTemplate, fillTemplate } from './prompt-loader.js';
import { commentOnCommit } from './github-client.js';

/**
 * Maneja eventos workflow_run (completed con failure) y workflow_job (completed con failure).
 * Analiza los logs de error con el LLM para diagnóstico de causa raíz.
 *
 * @param {object} payload - Webhook payload de GitHub
 * @returns {Promise<{handled: boolean, report?: string}>}
 */
export async function handleWorkflowFailure(payload) {
  const { action, workflow_run, workflow_job, repository } = payload; //
  const run = workflow_run || workflow_job; //
  const fullName = repository.full_name; //

  // ── 0. Solo procesar fallos (Filtro temprano de control) ──
  const conclusion = run?.conclusion; //
  if (conclusion !== 'failure') { //
    console.log(`[WORKFLOW] Conclusión: ${conclusion}. Solo se procesan fallos. Ignorando.`); //
    return { handled: false }; //
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`[WORKFLOW] Fallo detectado en ${fullName}`); //
  console.log(`[WORKFLOW] Workflow: ${run.name || run.workflow_name || 'N/A'}`); //
  console.log(`[WORKFLOW] Run ID: ${run.id}`); //
  console.log(`[WORKFLOW] Conclusión: ${conclusion}`); //
  console.log(`${'='.repeat(70)}`);

  // ── 1. Verificar configuración de gobernanza del repo ──
  const repoConfig = getRepoConfig(fullName); //
  if (!repoConfig) {
    console.log(`[WORKFLOW] Repositorio ${fullName} no registrado en ai-core.yml. Ignorando.`); //
    return { handled: false }; //
  }
  if (!repoConfig.ai_features?.log_analysis) { //
    console.log(`[WORKFLOW] log_analysis deshabilitado para ${fullName}. Ignorando.`); //
    return { handled: false }; //
  }

  // PASO DE GOBERNANZA: Selección dinámica del modelo (Mapeo desde ai-core.yml)
  const globalConfig = loadConfig(); //
  const aliasModelo = repoConfig.model || 'default'; //
  const nombreModeloReal = globalConfig.models?.[aliasModelo] || globalConfig.models?.default || "qwen2.5-coder:7b"; //

  // ── 2. Extraer información del error disponible en el payload ──
  let errorContext = ''; //

  if (workflow_job?.steps) { //
    const failedSteps = workflow_job.steps.filter(s => s.conclusion === 'failure'); //
    errorContext = failedSteps.map(s =>
      `Step fallido: "${s.name}" (status: ${s.status}, conclusion: ${s.conclusion})` //
    ).join('\n');
  }

  errorContext += [
    '',
    `Workflow: ${run.name || run.workflow_name || 'N/A'}`, //
    `Branch: ${run.head_branch || 'N/A'}`, //
    `Commit: ${run.head_sha || 'N/A'}`, //
    `Evento desencadenante: ${run.event || 'N/A'}`, //
    `Run attempt: ${run.run_attempt || 1}`, //
    `URL del run: ${run.html_url || 'N/A'}`, //
    '',
    `--- Logs disponibles (resumen del payload) ---`,
    JSON.stringify(run, null, 2).substring(0, 4000) //
  ].join('\n');

  // ── 3. Cargar prompt de sistema (Obliga al LLM a responder en formato JSON estricto) ──
  const systemPrompt = loadPrompt('log-analyzer'); //

  // ── 4. Construir prompt de usuario ──
  const userPrompt = [
    `## Contexto del Fallo en CI/CD`, //
    `- **Repositorio:** ${fullName}`, //
    `- **Workflow:** ${run.name || run.workflow_name || 'N/A'}`, //
    `- **Branch:** ${run.head_branch || 'N/A'}`, //
    `- **Conclusión:** ${conclusion}`, //
    ``,
    `## Información del Error`, //
    '```', //
    errorContext, //
    '```', //
    '',
    'IMPORTANTE: Devuelve exclusivamente una estructura JSON válida que contenga de manera explícita las siguientes claves obligatorias: executive_summary, root_cause_category, key_error_message, affected_component, technical_explanation, action_plan_steps, y references. No incluyas explicaciones fuera del JSON.'
  ].join('\n');

  // ── 5. Consultar al LLM pasándole dinámicamente el modelo asignado por Gobernanza ──
  console.log(`[WORKFLOW] Enviando logs a Ollama utilizando el modelo [${nombreModeloReal}]...`);
  const aiResponse = await queryOllama(systemPrompt, userPrompt, nombreModeloReal);

  // ── 6. Parsear la respuesta estructurada e inyectarla en la plantilla Markdown ──
  let parsedData = {};
  try {
    // Limpiar posibles bloques de código markdown que devuelva el modelo (```json ... ```)
    const cleanJsonString = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    parsedData = JSON.parse(cleanJsonString);
  } catch (parseError) {
    console.error(`[WORKFLOW] No se pudo parsear la respuesta del LLM como JSON estructurado. Usando fallback de texto plano.`);
    // Fallback por si el modelo local no sigue el formato estructurado JSON rigurosamente
    parsedData = {
      executive_summary: aiResponse,
      root_cause_category: 'No clasificado',
      key_error_message: 'Ver log ejecutor',
      affected_component: 'Infraestructura General',
      technical_explanation: 'El análisis no devolvió un JSON parseable.',
      action_plan_steps: '- Revisar manualmente las trazas del build.',
      references: '- [AWS CDK Official Docs](https://docs.aws.amazon.com/cdk/v2/guide/home.html)'
    };
  }

  // Cargar plantilla definitiva 'log-analysis' asignando cada variable de forma granular
  const template = loadTemplate('log-analysis'); //
  const report = fillTemplate(template, {
    REPO_NAME: fullName, //
    WORKFLOW_NAME: run.name || run.workflow_name || 'N/A', //
    RUN_ID: String(run.id || 'N/A'), //
    CONCLUSION: conclusion, //
    TIMESTAMP: new Date().toISOString(), //
    MODEL_NAME: `${nombreModeloReal} (Ollama Local)`,
    EXECUTIVE_SUMMARY: parsedData.executive_summary || 'N/A',
    ROOT_CAUSE_CATEGORY: parsedData.root_cause_category || 'N/A',
    KEY_ERROR_MESSAGE: parsedData.key_error_message || 'N/A',
    AFFECTED_COMPONENT: parsedData.affected_component || 'N/A',
    TECHNICAL_EXPLANATION: parsedData.technical_explanation || 'N/A',
    ACTION_PLAN_STEPS: parsedData.action_plan_steps || 'N/A',
    REFERENCES: parsedData.references || 'N/A'
  });

  console.log(`\n${'─'.repeat(70)}`);
  console.log(`[WORKFLOW] DIAGNÓSTICO DE FALLO GENERADO:`);
  console.log(`${'─'.repeat(70)}`);
  console.log(report); //
  console.log(`${'─'.repeat(70)}\n`);

  // ── 7. Comentar el reporte directamente en el Commit afectado en GitHub ──
  const [owner, repo] = fullName.split('/'); //
  const sha = run.head_sha; //
  if (sha) { //
    const commented = await commentOnCommit(owner, repo, sha, report); //
    if (commented) { //
      console.log(`[WORKFLOW] Comentario de gobernanza publicado en commit ${sha.substring(0, 7)}`); //
    }
  }

  return { handled: true, report }; //
}
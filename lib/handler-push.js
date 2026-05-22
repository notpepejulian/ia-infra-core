// ============================================================================
// handler-push.js — Manejador de eventos Push (Documentación Mermaid Dinámica)
// ============================================================================
import { getRepoConfig } from './config-loader.js';
import { queryOllama } from './ollama-client.js';
import { loadPrompt, loadTemplate, fillTemplate } from './prompt-loader.js';
import { getFileContent, commentOnCommit } from './github-client.js';

/**
 * Maneja eventos push. Detecta archivos .ts modificados y genera diagramas Mermaid.
 *
 * @param {object} payload - Webhook payload de GitHub
 * @returns {Promise<{handled: boolean, report?: string}>}
 */
export async function handlePush(payload) {
  const { ref, commits, repository, head_commit, pusher } = payload;
  const fullName = repository.full_name;
  const branch = ref?.replace('refs/heads/', '') || 'unknown';

  console.log(`\n${'='.repeat(70)}`);
  console.log(`[PUSH] Evento recibido en ${fullName} (branch: ${branch})`);
  console.log(`[PUSH] Pusher: ${pusher?.name || 'unknown'}`);
  console.log(`[PUSH] Commits: ${commits?.length || 0}`);
  console.log(`${'='.repeat(70)}`);

  // 1. Verificar configuración
  const repoConfig = getRepoConfig(fullName);
  if (!repoConfig) {
    console.log(`[PUSH] Repositorio ${fullName} no registrado. Ignorando.`);
    return { handled: false };
  }
  if (!repoConfig.ai_features?.auto_mermaid) {
    console.log(`[PUSH] auto_mermaid deshabilitado para ${fullName}. Ignorando.`);
    return { handled: false };
  }

  // 2. Extraer archivos .ts modificados/añadidos de los commits
  const tsFiles = new Set();
  for (const commit of (commits || [])) {
    for (const file of [...(commit.added || []), ...(commit.modified || [])]) {
      if (file.endsWith('.ts') && !file.endsWith('.d.ts') && !file.includes('node_modules')) {
        tsFiles.add(file);
      }
    }
  }

  if (tsFiles.size === 0) {
    console.log(`[PUSH] No se encontraron archivos .ts modificados. Ignorando.`);
    return { handled: false };
  }

  console.log(`[PUSH] Archivos TypeScript detectados: ${[...tsFiles].join(', ')}`);

  // 3. Obtener el contenido de los archivos .ts
  const [owner, repo] = fullName.split('/');
  const sha = head_commit?.id || payload.after;
  let allCode = '';
  const analyzedFiles = [];

  for (const filePath of tsFiles) {
    console.log(`[PUSH] Obteniendo contenido de ${filePath}...`);
    const content = await getFileContent(owner, repo, filePath, sha);
    if (content) {
      allCode += `\n// ===== Archivo: ${filePath} =====\n${content}\n`;
      analyzedFiles.push(filePath);
    } else {
      console.log(`[PUSH] No se pudo obtener ${filePath} (¿sin token GitHub?). Usando info del commit.`);
      // Fallback: incluir patches del commit si están disponibles
      for (const commit of (commits || [])) {
        if (commit.message) {
          allCode += `\n// ===== Commit: ${commit.id?.substring(0, 7)} — ${commit.message} =====\n`;
          allCode += `// Archivos modificados: ${[...(commit.added || []), ...(commit.modified || [])].join(', ')}\n`;
        }
      }
      analyzedFiles.push(`${filePath} (info parcial)`);
    }
  }

  if (allCode.length < 20) {
    console.log(`[PUSH] Código insuficiente para generar diagrama.`);
    return { handled: false };
  }

  // 4. Cargar prompt de arquitectura Mermaid
  const systemPrompt = loadPrompt('mermaid-architect');

  // 5. Construir prompt de usuario
  const userPrompt = [
    `## Contexto del Repositorio`,
    `- **Repositorio:** ${fullName}`,
    `- **Branch:** ${branch}`,
    `- **Commit:** ${sha?.substring(0, 7) || 'N/A'}`,
    ``,
    `## Código CDK TypeScript a Analizar`,
    '```typescript',
    allCode.substring(0, 8000),
    '```',
    '',
    'Genera un diagrama Mermaid.js que represente la arquitectura de infraestructura definida en este código.'
  ].join('\n');

  // 6. Consultar al LLM
  console.log(`[PUSH] Enviando código a Ollama para generar diagrama Mermaid...`);
  const aiResponse = await queryOllama(systemPrompt, userPrompt);

  // 7. Formatear con plantilla
  const template = loadTemplate('mermaid-doc');
  const report = fillTemplate(template, {
    REPO_NAME: fullName,
    BRANCH: branch,
    COMMIT_SHA: sha?.substring(0, 7) || 'N/A',
    COMMIT_AUTHOR: pusher?.name || head_commit?.author?.name || 'unknown',
    TIMESTAMP: new Date().toISOString(),
    MODEL_NAME: 'qwen2.5-coder:7b (Ollama local)',
    MERMAID_DIAGRAM: aiResponse,
    COMPONENTS_LEGEND: '_(Incluido en el diagrama arriba)_',
    ANALYZED_FILES_LIST: analyzedFiles.map(f => `- \`${f}\``).join('\n')
  });

  console.log(`\n${'─'.repeat(70)}`);
  console.log(`[PUSH] DOCUMENTACIÓN VISUAL GENERADA:`);
  console.log(`${'─'.repeat(70)}`);
  console.log(report);
  console.log(`${'─'.repeat(70)}\n`);

  // 8. Comentar en el commit
  if (sha) {
    const commented = await commentOnCommit(owner, repo, sha, report);
    if (commented) {
      console.log(`[PUSH] ✅ Diagrama publicado en commit ${sha.substring(0, 7)}`);
    }
  }

  return { handled: true, report };
}

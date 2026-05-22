// ============================================================================
// ollama-client.js — Cliente para la API de Ollama (LLM local)
// ============================================================================
import { getOllamaConfig } from './config-loader.js';

/**
 * Envía un prompt al modelo Ollama configurado en ai-core.yml.
 * @param {string} systemPrompt - Instrucciones del sistema (cargadas desde prompts-library/)
 * @param {string} userContent  - Contenido del usuario (diff, logs, código TS, etc.)
 * @param {string} [modelOverride] - Nombre del modelo a usar (si se omite, usa el global)
 * @returns {Promise<string>} Respuesta del modelo
 */
export async function queryOllama(systemPrompt, userContent, modelOverride) {
  const config = getOllamaConfig();
  const model = modelOverride || config.model;
  const url = `${config.base_url}/api/generate`;

  console.log(`[OLLAMA] Enviando prompt al modelo ${model}...`);
  console.log(`[OLLAMA] System prompt: ${systemPrompt.substring(0, 80)}...`);
  console.log(`[OLLAMA] User content length: ${userContent.length} chars`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeout_ms);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        system: systemPrompt,
        prompt: userContent,
        stream: false,
        options: {
          temperature: 0.3,       // Bajo para análisis determinístico
          num_predict: 4096       // Respuestas largas para reportes completos
        }
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Ollama HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    console.log(`[OLLAMA] Respuesta recibida (${data.response?.length || 0} chars, ${data.total_duration ? (data.total_duration / 1e9).toFixed(1) + 's' : 'N/A'})`);
    return data.response || '';
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error(`[OLLAMA] Timeout alcanzado (${config.timeout_ms}ms)`);
      return '⚠️ Error: El modelo no respondió dentro del tiempo límite configurado.';
    }
    console.error(`[OLLAMA] Error:`, err.message);
    return `⚠️ Error al comunicarse con Ollama: ${err.message}`;
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================================
// prompt-loader.js — Carga los system prompts desde prompts-library/
// ============================================================================
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROMPTS_DIR = resolve(__dirname, '..', 'prompts-library');
const TEMPLATES_DIR = resolve(__dirname, '..', 'templates');

const cache = {};

/**
 * Carga un system prompt desde prompts-library/{name}.md
 * @param {string} name - Nombre del archivo sin extensión
 * @returns {string} Contenido del prompt
 */
export function loadPrompt(name) {
  const key = `prompt:${name}`;
  if (cache[key]) return cache[key];
  const path = resolve(PROMPTS_DIR, `${name}.md`);
  cache[key] = readFileSync(path, 'utf-8');
  console.log(`[PROMPTS] Cargado: ${name}.md (${cache[key].length} chars)`);
  return cache[key];
}

/**
 * Carga una plantilla de salida desde templates/{name}.md
 * @param {string} name - Nombre del archivo sin extensión
 * @returns {string} Contenido de la plantilla
 */
export function loadTemplate(name) {
  const key = `template:${name}`;
  if (cache[key]) return cache[key];
  const path = resolve(TEMPLATES_DIR, `${name}.md`);
  cache[key] = readFileSync(path, 'utf-8');
  console.log(`[TEMPLATES] Cargado: ${name}.md (${cache[key].length} chars)`);
  return cache[key];
}

/**
 * Rellena los placeholders {{KEY}} de una plantilla con valores.
 * @param {string} template - Contenido de la plantilla
 * @param {object} values   - { KEY: 'valor', ... }
 * @returns {string} Plantilla con placeholders reemplazados
 */
export function fillTemplate(template, values) {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    result = result.replaceAll(`{{${key}}}`, value || '');
  }
  return result;
}

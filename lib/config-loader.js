// ============================================================================
// config-loader.js — Carga y valida la configuración de gobernanza (ai-core.yml)
// ============================================================================
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

let _config = null;

/**
 * Carga ai-core.yml y lo cachea en memoria.
 * @returns {object} Configuración parseada
 */
export function loadConfig() {
  if (_config) return _config;
  const raw = readFileSync(resolve(ROOT, 'ai-core.yml'), 'utf-8');
  _config = yaml.load(raw);
  console.log(`[CONFIG] Cargados ${_config.repositories?.length || 0} repositorios desde ai-core.yml`);
  return _config;
}

/**
 * Busca la configuración de un repositorio por nombre completo (owner/name).
 * @param {string} fullName - e.g. "notpepejulian/infra-satellite-demo"
 * @returns {object|null} Config del repo o null si no está registrado
 */
export function getRepoConfig(fullName) {
  const config = loadConfig();
  const [owner, name] = fullName.toLowerCase().split('/');
  return config.repositories?.find(
    r => r.name === name && r.owner === owner
  ) || null;
}

/**
 * Resuelve un alias de modelo (e.g. "default") al nombre real del modelo
 * usando el mapa `models:` del ai-core.yml.
 * Si no es un alias, devuelve el valor tal cual.
 * @param {string} alias - Nombre o alias del modelo
 * @returns {string} Nombre real del modelo
 */
export function resolveModel(alias) {
  const config = loadConfig();
  const models = config.models || {};
  return models[alias] || alias;
}

/**
 * Devuelve la configuración global de Ollama con el modelo resuelto.
 */
export function getOllamaConfig() {
  const config = loadConfig();
  const ollama = config.global?.ollama || {
    base_url: 'http://localhost:11434',
    model: 'qwen2.5-coder:7b',
    timeout_ms: 300000
  };
  return {
    ...ollama,
    model: resolveModel(ollama.model)
  };
}

/**
 * Devuelve el nombre real del modelo asignado a un repositorio.
 * Si el repo tiene un model override, lo resuelve; si no, usa el global.
 * @param {string} fullName - e.g. "notpepejulian/infra-satellite-demo"
 * @returns {string} Nombre real del modelo
 */
export function getModelForRepo(fullName) {
  const repoConfig = getRepoConfig(fullName);
  if (repoConfig?.ai_features?.model) {
    return resolveModel(repoConfig.ai_features.model);
  }
  return getOllamaConfig().model;
}

/**
 * Devuelve el token de GitHub del env si está configurado.
 */
export function getGitHubToken() {
  const config = loadConfig();
  const envVar = config.global?.github?.pat_env_var || 'GITHUB_TOKEN';
  return process.env[envVar] || null;
}

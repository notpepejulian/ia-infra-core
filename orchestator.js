// ============================================================================
// orchestator.js — Orquestador Central de Gobernanza IA (API Gateway Local)
// ============================================================================
//
// Este script actúa como el punto de entrada para todos los webhooks de GitHub.
// Emula conceptualmente el comportamiento de EPAM DIAL en el entorno corporativo,
// adaptado a un ecosistema local con GitHub + Ollama.
//
// Flujo:
//   1. Recibe webhook de GitHub vía ngrok
//   2. Carga reglas de gobernanza desde ai-core.yml
//   3. Identifica el tipo de evento (PR, workflow_run, push)
//   4. Delega al handler correspondiente
//   5. El handler carga el system prompt, consulta a Ollama, y formatea el reporte
//
// Uso:  node orchestator.js
// URL:  https://backspin-folk-sanitary.ngrok-free.dev/webhook
// ============================================================================

import 'dotenv/config';

import express from 'express';
import { loadConfig } from './lib/config-loader.js';
import { handlePullRequest } from './lib/handler-pr.js';
import { handleWorkflowFailure } from './lib/handler-workflow.js';
import { handlePush } from './lib/handler-push.js';

const app = express();
app.use(express.json({ limit: '10mb' }));

// ── Startup: cargar configuración ──────────────────────────────────────────
const config = loadConfig();
const PORT = process.env.PORT || 3000;

// ── Health Check ───────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status: 'active',
    service: 'ia-infra-core — Orquestador de Gobernanza IA',
    version: '1.0.0',
    ollama: config.global?.ollama?.model || 'N/A',
    repos_registrados: config.repositories?.length || 0,
    endpoints: {
      health: '/',
      webhook: '/webhook',
      config: '/config'
    }
  });
});

// ── Config viewer (debug) ──────────────────────────────────────────────────
app.get('/config', (req, res) => {
  res.json({
    global: config.global,
    repositories: config.repositories?.map(r => ({
      name: `${r.owner}/${r.name}`,
      features: r.ai_features
    }))
  });
});

// ── Webhook principal ──────────────────────────────────────────────────────
app.post('/webhook', async (req, res) => {
  const event = req.headers['x-github-event'] || 'unknown';
  const delivery = req.headers['x-github-delivery'] || 'N/A';
  const payload = req.body;

  console.log(`\n${'█'.repeat(70)}`);
  console.log(`[WEBHOOK] Evento recibido: ${event}`);
  console.log(`[WEBHOOK] Delivery ID: ${delivery}`);
  console.log(`[WEBHOOK] Repo: ${payload.repository?.full_name || 'N/A'}`);
  console.log(`[WEBHOOK] Action: ${payload.action || 'N/A'}`);
  console.log(`${'█'.repeat(70)}`);

  // Responder inmediatamente a GitHub (evitar timeout de 10s)
  res.status(200).json({ received: true, event, delivery });

  // Procesar en background
  try {
    let result = { handled: false };

    switch (event) {
      // ── Pull Request: Auditoría de seguridad CDK ──
      case 'pull_request':
        if (['opened', 'synchronize', 'reopened'].includes(payload.action)) {
          result = await handlePullRequest(payload);
        } else {
          console.log(`[WEBHOOK] PR action "${payload.action}" no procesable. Ignorando.`);
        }
        break;

      // ── Workflow Run/Job: Diagnóstico de fallos CI/CD ──
      case 'workflow_run':
      case 'workflow_job':
        if (payload.action === 'completed') {
          result = await handleWorkflowFailure(payload);
        }
        break;

      // ── Push: Documentación visual dinámica ──
      case 'push':
        result = await handlePush(payload);
        break;

      // ── Ping: verificación de webhook ──
      case 'ping':
        console.log(`[WEBHOOK] 🏓 Ping recibido. Hook ID: ${payload.hook_id}. Webhook activo.`);
        break;

      default:
        console.log(`[WEBHOOK] Evento "${event}" no soportado. Ignorando.`);
    }

    if (result.handled) {
      console.log(`[WEBHOOK] ✅ Evento procesado exitosamente.`);
    }
  } catch (error) {
    console.error(`[WEBHOOK] ❌ Error procesando evento:`, error);
  }
});

// ── Iniciar servidor ───────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  🚀 Orquestador IA activo en puerto ${PORT}`);
  console.log(`  📡 Webhook URL: ${config.global?.ngrok?.tunnel_url || 'N/A'}/webhook`);
  console.log(`  🤖 Modelo: ${config.global?.ollama?.model || 'N/A'}`);
  console.log(`  📂 Repos registrados: ${config.repositories?.length || 0}`);
  console.log(`  🔑 GitHub Token: ${process.env.GITHUB_TOKEN ? '✅ Configurado' : '❌ No configurado (solo consola)'}`);
  console.log(`${'═'.repeat(70)}\n`);
});
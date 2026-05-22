// ============================================================================
// orchestator.js — Orquestador Central de Gobernanza IA (API Gateway Local)
// ============================================================================

import 'dotenv/config'; // Asegura la inyección inmediata de variables

import express from 'express';
import { loadConfig } from './lib/config-loader.js';
import { handlePullRequest } from './lib/handler-pr.js';
import { handleWorkflowFailure } from './lib/handler-workflow.js';
import { handlePush } from './lib/handler-push.js';

const app = express();
app.use(express.json({ limit: '10mb' }));

// ── Startup: cargar configuración de forma segura ──────────────────────────
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
  process.stdout.write('...');

  const event = req.headers['x-github-event'] || 'unknown';
  const delivery = req.headers['x-github-delivery'] || 'N/A';
  const payload = req.body;

  console.log(`\n${'█'.repeat(70)}`);
  console.log(`[WEBHOOK] Evento recibido: ${event}`);
  console.log(`[WEBHOOK] Delivery ID: ${delivery}`);
  console.log(`[WEBHOOK] Repo: ${payload.repository?.full_name || 'N/A'}`);
  console.log(`[WEBHOOK] Action: ${payload.action || 'N/A'}`);
  console.log(`${'█'.repeat(70)}`);

  res.status(200).json({ received: true, event, delivery });

  try {
    let result = { handled: false };

    switch (event) {
      case 'pull_request':
        if (['opened', 'synchronize', 'reopened'].includes(payload.action)) {
          result = await handlePullRequest(payload);
        } else {
          console.log(`[WEBHOOK] PR action "${payload.action}" no procesable. Ignorando.`);
        }
        break;

      case 'workflow_run':
      case 'workflow_job':
        if (payload.action === 'completed') {
          result = await handleWorkflowFailure(payload);
        }
        break;

      case 'push':
        result = await handlePush(payload);
        break;

      case 'ping':
        console.log(`[WEBHOOK] Ping recibido. Hook ID: ${payload.hook_id}. Webhook activo.`);
        break;

      default:
        console.log(`[WEBHOOK] Evento "${event}" no soportado. Ignorando.`);
    }

    if (result.handled) {
      console.log(`[WEBHOOK] Evento procesado exitosamente.`);
    }
  } catch (error) {
    console.error(`[WEBHOOK] Error procesando evento:`, error);
  }
});

// ── Iniciar servidor y Bloquear Event Loop (Anti-Cierre Linux) ───────────────
const server = app.listen(PORT, () => {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  IA Infra Core activo en puerto ${PORT}`);
  console.log(`  Webhook URL: ${config.global?.ngrok?.tunnel_url || 'N/A'}/webhook`);
  console.log(`  Modelo: ${config.global?.ollama?.model || 'N/A'}`);
  console.log(`  Repositorios registrados: ${config.repositories?.length || 0}`);
  console.log(`  GitHub Token: ${process.env.GITHUB_TOKEN ? 'Configurado' : 'No configurado (solo consola)'}`);
  console.log(`${'═'.repeat(70)}\n`);
});

// Esto evita que recolectores de basura o cierres de sockets de clientes limpien el bucle de eventos.
setInterval(() => {
  // Mantiene vivo el proceso de forma nativa sin consumir CPU
}, 1 << 30);
process.on('unhandledRejection', (reason, promise) => {
  console.error('[SISTEMA] Rechazo no manejado en promesa:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[SISTEMA] Excepción no capturada:', error);
});
#!/bin/bash

echo "####################################################################################################"
echo "##                         Iniciando setup del entorno IA-INFRA-CORE                              ##"
echo "####################################################################################################"
echo ""

# 1. Limpieza preventiva de servicios colgados en el puerto 3000
echo "[SISTEMA] Liberando puerto 3000..."
fuser -k 3000/tcp 2>/dev/null || killall -9 node 2>/dev/null

# 2. Iniciar el demonio/modelo de Ollama en segundo plano de forma segura
echo "[OLLAMA] Asegurando modelo qwen2.5-coder:7b..."
ollama run qwen2.5-coder:7b "Acknowledge" > /dev/null 2>&1 &

# 3. Levantar primero el Orquestador Node en segundo plano
echo "[NODE] Iniciando orchestrator.js de fondo..."
node orchestator.js &
NODE_PID=$!

# Esperar un par de segundos para que los sockets de red se estabilicen
echo "[SISTEMA] Esperando 3 segundos a que los servicios de red respondan..."
sleep 3

# 4. Lanzar el Orquestador en primer plano (este mantendrá la terminal ocupada)
echo "[NODE] Arrancando orchestator.js..."
echo "----------------------------------------------------------------------"
node orchestator.js

# Código de salida: si cierras el orquestador con Ctrl+C, limpiamos ngrok de fondo
echo ""
echo "[SISTEMA] Cerrando túneles de fondo..."
kill $NGROK_PID 2>/dev/null
echo "[SISTEMA] Setup finalizado."
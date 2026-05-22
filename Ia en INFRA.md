# Estrategia de IA Generativa para Operaciones de Infraestructura

## Visión General

El objetivo estratégico es eliminar la fricción operativa en el ciclo de vida del desarrollo de software (SDLC) mediante la integración de IA Generativa en nuestro ecosistema de trabajo (**Atlassian, AWS, CDK**).

Esta implementación se apoya en **EPAM DIAL** y **Codemie** como orquestadores fundamentales. DIAL actúa como el API Gateway de modelos, garantizando seguridad empresarial, gobernanza de costes y abstracción tecnológica (capacidad de intercambiar LLMs como Claude, GPT o Gemini sin modificar la lógica de integración) mientras que CodeMie tomaría un rol más específico para el SDLC, así como para el desarrollo de las skills y assistants necesarios.

**Ventajas de la integración:**

- Orquestación de múltiples agentes y flujos de trabajo complejos.
- Acceso unificado y seguro a modelos de IA.
- Gobernanza centralizada, control de costes y trazabilidad.
- Flexibilidad para cambiar de modelo sin modificar la lógica de integración.
- Seguridad y cumplimiento normativo empresarial.

---

## Propuestas de implementación
### 1. Infraestructura como Código (IaC) y Desarrollo

Al operar con **CDK** y **TypeScript**, transformamos la infraestructura en activos programáticos que la IA puede razonar bajo la estricta supervisión del equipo técnico.

#### Generación y Refactorización

Mediante CodeMie se pueden generar las skills necesarias para la ayudarnos con la transformación de stacks de Cloudformation a AWS CDK, proponiendo cambios que el equipo validará antes de ejecutarlos. Esto agilizará la migración de infraestructura de Bamboo a BitBucket pipelines.

- **Capacidad:** Creación de constructs y migración asistida a TypeScript estandarizado.
    
- **Control técnico:** El repositorio `infra-ai-core` proporcionará las skills y prompts. La IA propone, pero el equipo debe validar y ejecutar la integración en los repositorios de infraestructura.
    
- **Control de versiones:** La IA puede revisar las últimas versiones de paquetes, lenguajes o frameworks que se estén utilizando, mediante el uso del contexto puede hacer recomendaciones para actualizar el código evitando vulnerabilidades. 
	
#### Validación de Políticas y Seguridad 

- **Capacidad:** Identificación proactiva de riesgos (ej. buckets S3 públicos o roles de IAM excesivos) antes de la síntesis de CloudFormation.
    
- **Mecanismo de control:** Se establece un paso de "Pre-Synthesize". El código se audita contra políticas globales almacenadas en Confluence, devolviendo reportes de riesgos. **La IA no bloquea el despliegue automáticamente; genera un informe técnico para que el equipo tome la decisión final.**
    

#### Documentación Visual Dinámica

- **Capacidad:** Generación automatizada de diagramas (Mermaid/PlantUML/Draw.io) sincronizados con el código.
    
- **Centralización:** El SDK procesa los archivos `.ts` locales y solicita al asistente de IA la sintaxis visual para su inserción en READMEs o Confluence.
    

---

### 2. Diagnóstico Asistido en CI/CD

Optimización del diagnóstico de fallos en pipelines mediante el análisis inteligente de logs.

- **Análisis de logs:** Diferenciación técnica entre errores de infraestructura y fallos de aplicación.
    
- **Intervención humana:** La IA no corrige el pipeline de forma autónoma. Proporciona una recomendación de corrección basada en el contexto histórico y el error actual para que el operador de infraestructura aplique el fix correspondiente mediante referencias a fuentes y documentación **oficiales**.
    
- **Control de versiones:** La IA puede revisar las ultimas versiones de las imágenes utilizadas en las pipelines o infraestructura, dando recomendaciones para actualizar el código evitando vulnerabilidades. 
	
---

### 3. Integración con Jira

- **Reporting inteligente de despliegues desde Jira:** Generación automatizada de reportes semanales que agrupen los tickets desplegados en los distintos entornos (producción, preproducción, desarrollo), proporcionando visibilidad estructurada de los cambios realizados en cada aplicación.
El sistema permitirá:
  - Identificar tickets desplegados en un rango temporal (ej. última semana)
  - Agrupar cambios por aplicación
  - Diferenciar por entorno de despliegue (pro, pre, dev)
  - Presentar un resumen claro de los cambios realizados
 

- **Asistente conversacional para consultas dinámicas sobre despliegues:** Implementación de un asistente conversacional que permita al equipo realizar consultas en lenguaje natural sobre despliegues y cambios registrados en Jira, facilitando el acceso a información sin necesidad de llevar a cabo una búsqueda manual. El sistema permitirá:
  - Consultar despliegues por fecha (ej. “¿qué se desplegó ayer?”)
  - Filtrar por aplicación o servicio
  - Diferenciar por entorno (producción, preproducción, desarrollo)
  - Consultar el estado o historial de tickets específicos
  - Obtener respuestas estructuradas y contextualizadas

---
## Repositorio Centralizado: `infra-ai-core`

Toda la inteligencia y las directrices de ejecución residen en este repositorio central, que actúa como el **motor de órdenes** de la estrategia será en las pipelines donde se llama a este repositorio para evitar una .

> **Nota de organización:** Este repositorio se gestionará internamente a nivel de organización (e.j.  **GitHub o Git de EPAM**), sirviendo como la única fuente de verdad para los hooks y prompts de IA.

### 1. Estructura del Repositorio

```Plaintext
infra-ai-core/
├── AI-core.yaml                 # Gobernanza y mapeo de reglas por repositorio
├── prompts-library/             # Librería centralizada de System Prompts
│   ├── cdk-security-expert.md   # Instrucciones de auditoría IAM/S3
│   ├── log-analyzer.md          # Instrucciones para diagnóstico de fallos
│   └── mermaid-architect.md     # Reglas de generación de diagramas
├── sdk-hooks/                   # Scripts que encapsulan la API de DIAL
│   ├── dial-client.ts           # Wrapper de comunicación con DIAL
│   ├── analyze-logs.ts          # Script de análisis para pipelines
│   └── pr-summarizer.ts         # Integración con herramientas de Git
└── templates/                   # Formatos de salida para revisión humana
│   ├── triage-report.json
│   └── engineer-brief.md
└── references/                  # Fuentes oficiales a revisar por los LLMs
│	└── llm-references.md
```

### 2. Gobernanza: `AI-core.yaml`

Define qué capacidades se activan y qué modelo se utiliza, manteniendo el control total sobre el comportamiento de la IA en cada proyecto.

```YAML
projects:
  - name: "npm-pes-infra"
    ai_features:
      pre_synth_audit: true        # Habilita reporte de seguridad
      auto_mermaid: true           # Habilita generación de diagramas
      log_analysis: "expert"       # Nivel de profundidad del diagnóstico
    dial_config:
      preferred_model: "claude-4-5-sonnet"

  - name: "npm-gpd-infra"
    ai_features:
      pre_synth_audit: true
      security_policies: true      # Validación estricta de cumplimiento
    dial_config:
      preferred_model: "gemini-1.5-pro"
```

---

### 3. Flujo de Ejecución y Responsabilidades

Cuando un repositorio de infraestructura ejecuta sus procesos, el flujo se rige por las órdenes especificadas en el repo central:

1. **Carga de órdenes:** El pipeline consume el SDK de `infra-ai-core`.
    
2. **Validación de reglas:** Se identifican las capacidades activas en `AI-core.yaml`.
    
3. **Ejecución de hooks de IA:**
    
    - **Fase de synthesize:** Se audita el código CDK contra el prompt de seguridad global.
        
    - **Fase de post-fallo:** Si el pipeline falla, se procesa el log con el prompt especializado.
        
4. **Entrega de resultados:** La IA devuelve un análisis detallado. **La decisión de proceder, bloquear o modificar el código recae exclusivamente en el equipo**, quien utiliza la información de la IA como soporte técnico avanzado.
    

#### Responsabilidades del SDK central:

- **Inyección de contexto:** Adjuntar automáticamente archivos de código y logs al prompt de forma segura.
    
- **Orquestación DIAL:** Gestionar la conectividad, reintentos y tokens.
    
- **Normalización:** Formatear las respuestas para que sean legibles y accionables por humanos en Bitbucket, Jira o Teams.
    

---

### 4. Beneficios Estratégicos

- **Centralización del control:** El equipo técnico define las "órdenes" en un solo lugar; cualquier mejora en un prompt se propaga a todos los repositorios.
    
- **Seguridad de datos:** Aislamiento total de datos sensibles mediante DIAL.
    
- **Agnosticismo de modelos:** El cambio de LLMs se gestiona en la gobernanza central sin tocar los repositorios de despliegue.
    
- **Eficiencia operativa:** Se elimina el tiempo perdido en el triaje inicial de errores comunes de infraestructura.


 

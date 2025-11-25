# SearchBrand - Análisis de Competidores con IA

## Demo en Vivo

**[https://searchbrand-challenge-production.up.railway.app/](https://searchbrand-challenge-production.up.railway.app/)**

Herramienta automatizada de inteligencia competitiva que identifica competidores relevantes de una marca utilizando inteligencia artificial.

## El Problema

Los equipos de Marketing Intelligence necesitan identificar competidores de forma manual, un proceso que consume tiempo y recursos. Esta herramienta automatiza esa búsqueda, manejando dos escenarios distintos:

### Caso A: Marcas Globales (Alta Disponibilidad de Datos)

Marcas establecidas con abundante información pública disponible (ej: Spotify, Nike, Coca-Cola).

**Desafío**: Filtrar el ruido y evitar falsos positivos en medio de una sobrecarga de información.

**Output esperado**:
- 3-5 competidores directos
- Score de similitud transparente (0-100%)
- Justificación técnica de cada match

### Caso B: Marcas "Fantasma" (Baja Disponibilidad de Datos)

Marcas nicho, locales o startups muy nuevas con poca presencia digital (ej: panadería vegana local, consultora boutique, SaaS B2B específico).

**Desafío**: Descubrir competidores donde apenas existen datos públicos estructurados.

**Output esperado**:
- 2-3 competidores potenciales
- Evidencia clara de por qué son competidores

## Requerimientos del Challenge

1. **Input**: Nombre de marca o sitio web
2. **Output**: Lista de competidores con justificación técnica
3. **Despliegue**: Plataforma cloud (Railway)
4. **Base de datos**: PostgreSQL (Supabase)

---

## Solución Implementada

Esta implementación utiliza **Anthropic Claude** como fuente única para el análisis inteligente de marcas. Sin APIs de scraping externas, sin pipelines complejos multi-fuente - solo el conocimiento de Claude combinado con caching inteligente.

### Interfaz Web

La aplicación incluye una **interfaz web responsive** (mobile-first) servida en el puerto **3000**:

- Diseño moderno con gradientes y animaciones
- Campo de búsqueda para ingresar marcas
- Ejemplos clickeables (Spotify, Nike, Coca-Cola, etc.)
- Visualización de resultados con cards de competidores
- Indicador de tiempo de procesamiento
- Soporte completo para móviles y desktop

### Cómo Funciona

1. **Usuario ingresa una marca** en la interfaz web
2. **Claude analiza la marca** usando su conocimiento pre-entrenado
3. **Resultados se cachean** en PostgreSQL por 7 días
4. **Consultas posteriores** retornan resultados cacheados instantáneamente

### Rendimiento

| Tipo de Query | Tiempo de Respuesta |
|---------------|---------------------|
| Nueva marca (primera consulta) | 5-15 segundos |
| Marca cacheada | < 100ms |

### Output del Análisis

Para cada marca, el sistema proporciona:

- **Clasificación de marca**: Global vs Nicho
- **Industria**: Sector principal
- **Ubicación** (si aplica): Para marcas nicho/locales
- **Top 5 Competidores** con:
  - Score de similitud (0-100%)
  - Evidencias específicas

## Stack Tecnológico

- **Runtime**: Node.js 20+
- **Lenguaje**: TypeScript
- **IA**: Anthropic Claude (claude-sonnet-4-20250514)
- **Base de datos**: PostgreSQL (Supabase)
- **API**: Express.js
- **Frontend**: Single-page HTML/CSS/JS (mobile-first)
- **Despliegue**: Railway (Docker)
- **Puerto**: 3000

## API Endpoints

El servidor corre en `http://localhost:3000` (desarrollo) o la URL de Railway (producción).

### Endpoints Públicos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/` | Interfaz web (index.html) |
| GET | `/health` | Health check del servidor |
| POST | `/api/v1/analysis/quick` | Análisis rápido de marca (público para demo) |

### Endpoints Protegidos (requieren JWT)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/v1/auth/login` | Autenticación (obtener JWT) |
| POST | `/api/v1/analysis` | Crear análisis completo |
| GET | `/api/v1/analysis/history` | Historial de análisis del usuario |
| GET | `/api/v1/analysis/:id` | Obtener análisis por ID |

### Ejemplo de Request

```bash
# Análisis rápido (público)
curl -X POST http://localhost:3000/api/v1/analysis/quick \
  -H "Content-Type: application/json" \
  -d '{"brand": "Spotify"}'

# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'

# Análisis protegido
curl -X POST http://localhost:3000/api/v1/analysis \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"brand": "Tesla"}'
```

### Ejemplo de Response

```json
{
  "success": true,
  "data": {
    "status": "completed",
    "brand_name": "Tesla",
    "brand_type": "global",
    "industry": "Electric Vehicles & Clean Energy",
    "competitors": [
      {
        "name": "Rivian",
        "similarityScore": 85,
        "evidence": [
          "Fabricante de vehículos eléctricos premium",
          "Enfoque en trucks y SUVs eléctricos",
          "Competidor directo en mercado estadounidense"
        ]
      },
      {
        "name": "BYD",
        "similarityScore": 82,
        "evidence": [
          "Mayor fabricante de EVs del mundo",
          "Expansión global agresiva",
          "Competidor en múltiples segmentos"
        ]
      }
    ]
  }
}
```

## Arquitectura

```
searchbrand-challenge/
├── public/
│   └── index.html            # Interfaz web (mobile-first)
├── src/
│   ├── api/
│   │   ├── controllers/      # Handlers de requests
│   │   │   ├── analysis.controller.ts
│   │   │   └── auth.controller.ts
│   │   ├── middleware/       # Auth, rate-limit, error handling
│   │   ├── routes/           # Definición de rutas
│   │   │   ├── analysis.routes.ts
│   │   │   └── auth.routes.ts
│   │   └── server.ts         # Configuración Express
│   ├── services/
│   │   ├── analysis/         # Servicio de análisis (Claude)
│   │   ├── auth/             # Autenticación JWT
│   │   └── database/         # Cliente PostgreSQL
│   ├── utils/                # Config, logger
│   ├── index.ts              # Entry point API
│   └── cli.ts                # Entry point CLI (legacy)
├── database/
│   ├── schema.sql            # Schema de la BD
│   └── clean-data.sql        # Script de limpieza
├── Dockerfile                # Configuración Docker
└── docker-compose.yml        # PostgreSQL local
```

## Quick Start

Ver [INSTALL.md](INSTALL.md) para instrucciones detalladas.

```bash
# Clonar e instalar
git clone <repository-url>
cd searchbrand-challenge
npm install

# Configurar entorno
cp .env.example .env
# Agregar ANTHROPIC_API_KEY y DATABASE_URL

# Ejecutar en desarrollo
npm run dev

# Abrir http://localhost:3000
```

## Comandos Disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo (hot reload) |
| `npm run build` | Compilar TypeScript |
| `npm start` | Servidor de producción |
| `npm run cli` | CLI interactivo (legacy) |
| `npm run db:start` | Iniciar PostgreSQL local |
| `npm run db:stop` | Detener PostgreSQL local |

## Decisiones de Diseño

1. **Enfoque Claude-only**: Arquitectura simple, desarrollo rápido, resultados confiables
2. **Caching agresivo**: Cache de 7 días reduce costos de API y mejora UX
3. **UI Single-page**: Frontend mínimo, diseño mobile-first
4. **Docker deployment**: Builds consistentes entre entornos
5. **Endpoint público `/quick`**: Permite demo sin autenticación

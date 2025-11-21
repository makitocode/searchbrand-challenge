# SearchBrand - Competitor Intelligence Tool

Herramienta automatizada de inteligencia competitiva que identifica competidores relevantes de una marca utilizando web scraping, análisis de datos y Large Language Models (LLMs).

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
- Evidencia clara de por qué son competidores (keywords, ubicación, meta-tags, etc)

## Requerimientos del Challenge

1. **Input**: Nombre de marca o sitio web
2. **Output**: Lista de competidores con justificación técnica
3. **Formato**:
   - Aplicación de consola (CLI interactivo)
   - API REST (opcional)
   - Archivo `results.json` con resultados estructurados
4. **Despliegue**: Plataforma cloud (Railway, Vercel, Render)
5. **Base de datos**: Integración simple (Supabase, Firebase, PostgreSQL)

## Diferenciador: Integración con LLMs

Esta solución va más allá del scraping tradicional al integrar **Anthropic Claude** y **OpenAI GPT-5** en momentos clave del análisis:

1. **Análisis de Input** (Claude): Comprensión semántica de la marca, detección de ambigüedad
2. **Enriquecimiento de Datos** (GPT-5): Extracción inteligente de insights de datos scraped
3. **Análisis Competitivo** (GPT-5): Evaluación con structured outputs y scoring transparente

## Sistema de Scoring Transparente

Cada competidor es evaluado en **10 criterios ponderados** (total 100 puntos):

| Criterio | Peso | Descripción |
|----------|------|-------------|
| Industry | 15 pts | Misma industria/categoría |
| Business Model | 15 pts | Modelo de negocio similar |
| Product Offering | 15 pts | Productos/servicios comparables |
| Target Audience | 10 pts | Mismo público objetivo |
| Geography | 10 pts | Región/alcance geográfico |
| Market Size | 10 pts | Tamaño de mercado similar |
| Price Range | 10 pts | Rango de precios comparable |
| Digital Presence | 5 pts | Presencia digital similar |
| Brand Maturity | 5 pts | Madurez de marca |
| Keywords | 5 pts | Keywords SEO compartidas |

Ejemplo de resultado:

```json
{
  "competitor": "Apple Music",
  "similarity_score": 92,
  "breakdown": {
    "industry": 15,
    "businessModel": 15,
    "targetAudience": 10,
    "geography": 10,
    "priceRange": 9,
    "productOffering": 14,
    "marketSize": 10,
    "digitalPresence": 5,
    "brandMaturity": 5,
    "keywords": 9
  },
  "evidence": [
    "Ambos operan en la industria de streaming musical",
    "Modelo de suscripción mensual similar ($9.99 vs $10.99)",
    "Catálogo de >70M canciones",
    "100M+ suscriptores pagos"
  ]
}
```

## Stack Tecnológico

- **Runtime**: Node.js 20+
- **Lenguaje**: TypeScript
- **Framework**: Express
- **Base de Datos**: Supabase (PostgreSQL)
- **LLMs**: Anthropic Claude + OpenAI GPT-5
- **Scraping**: Cheerio, Axios
- **CLI**: Inquirer, Chalk, Ora
- **Autenticación**: JWT
- **Deploy**: Railway

## Arquitectura

El proyecto sigue el patrón **Strategy** para manejar los dos casos de análisis de forma modular:

```
src/
├── core/              # Lógica central (orchestrator, scraper, scorer)
├── strategies/        # GlobalBrandStrategy, NicheBrandStrategy
├── services/
│   ├── llm/          # Integración con Claude y GPT-5
│   ├── scraping/     # Wikipedia, Google Search, metadata
│   └── database/     # Repositorios Supabase
├── api/              # Controllers, routes, middlewares
├── cli/              # Comandos y prompts interactivos
├── utils/            # Logger, validators, config
├── cli.ts            # Entry point - Aplicación de consola
└── server.ts         # Entry point - API REST
```

## Características

- Análisis automático de marcas globales y nicho
- Detección inteligente de ambigüedad con LLMs
- Scoring transparente basado en 10 criterios
- CLI interactivo con spinners y colores
- API REST con autenticación JWT
- Persistencia en Supabase
- Export de resultados en JSON estructurado
- Deploy en Railway

## Casos de Prueba

### Caso A: Spotify
```bash
$ npm run cli
¿Qué marca quieres analizar? Spotify

Tipo: Global Brand
Competidores encontrados:
1. Apple Music (92%)
2. YouTube Music (88%)
3. Amazon Music (85%)
```

### Caso B: Herbívoro
```bash
$ npm run cli
¿Qué marca quieres analizar? Herbívoro

⚠️ Categorías sugeridas:
1. Restaurante/Gastronomía
2. Productos retail
Selecciona: 1

Tipo: Niche Brand
Competidores encontrados:
1. El Huerto (85%)
2. Verde Sazón (78%)
3. Terra Vegana (72%)
```



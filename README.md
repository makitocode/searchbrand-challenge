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

Esta solución va más allá del scraping tradicional al integrar **Anthropic Claude** en momentos clave del análisis:

1. **Análisis de Input** (Claude): Comprensión semántica de la marca, detección de ambigüedad
2. **Clasificación de Marca**: Multi-source approach con 5 fuentes de datos (Wikipedia, Google Search/SerpAPI, Geographic Trends via SerpAPI, Website Analyzer, LLM Directo)
3. **Filtrado de Competidores** (Claude): Validación inteligente para excluir blogs, guías y plataformas agregadoras
4. **Análisis Competitivo** (Claude): Evaluación detallada en 10 criterios con evidencias específicas y verificables

### Clasificación de Marca: Global vs Nicho

El sistema clasifica cada marca en dos categorías usando un enfoque multi-fuente:

**GLOBAL**: Reconocimiento y operación en múltiples continentes (3+)
- Opera en 10+ países
- Wikipedia en 3+ idiomas
- Presencia en medios internacionales (BBC, CNN, Reuters)
- Millones de seguidores en redes sociales
- Interés distribuido en 3+ continentes (Google Trends)

**NICHO**: Todo lo que NO es global (incluye nacional, regional, local, especializado)

**Fuentes de Datos (5)**:
1. **Wikipedia** (25%): Idiomas disponibles, categorías, notabilidad
2. **Google Search/SerpAPI** (20%): Presencia web multi-idioma, medios internacionales, detección automática de ubicación
3. **Geographic Trends via SerpAPI** (20%): Distribución geográfica de interés simulada mediante búsquedas multi-país (US, GB, DE, FR, ES, BR, JP, AU) + LLM inference
4. **Website Analyzer** (15%): Idiomas disponibles, selector de país, estructura del sitio
5. **LLM Directo** (20%): Conocimiento pre-entrenado del LLM sobre la marca

El sistema ejecuta las 5 fuentes en **paralelo** para optimizar el tiempo de análisis. Claude realiza un análisis final que:
- Valida la clasificación basada en todas las evidencias
- Actúa como tie-breaker en casos ambiguos (score 45-55)
- Genera justificación en lenguaje natural

**Mejora importante**: Sistema de búsqueda de competidores con estrategias diferenciadas:
- **Global Brands**: Búsqueda de "{brand} competitors alternative" con filtrado anti-ruido
- **Niche Brands**: Búsqueda contextual con ubicación "{industry} {location}"
- **Detección automática de ubicación** desde Google Search, LLM y dominios geográficos
- **Filtrado LLM**: Excluye blogs (tuliorecomienda), guías (losinsaciables), plataformas agregadoras (TripAdvisor)

Ver [BRAND-CLASSIFICATION-STRATEGY.md](BRAND-CLASSIFICATION-STRATEGY.md) para detalles completos.

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

**Características del Sistema de Scoring**:
- Scoring REAL generado por Claude (no placeholder)
- Validación automática de puntuaciones dentro de los límites permitidos
- Display visual con barras de progreso ASCII
- Colores según score: verde (>60), amarillo (40-60), rojo (<40)
- Evidencias específicas y verificables por cada competidor
- Fallback conservador en caso de error del LLM

Ejemplo de resultado:

```json
{
  "competitor": "Apple Music",
  "similarity_score": 92,
  "breakdown": {
    "industry": 15,
    "businessModel": 15,
    "productOffering": 14,
    "targetAudience": 10,
    "geography": 10,
    "marketSize": 10,
    "priceRange": 9,
    "digitalPresence": 5,
    "brandMaturity": 5,
    "keywords": 4
  },
  "evidence": [
    "Ambos operan en la industria de streaming musical",
    "Modelo de suscripción mensual similar ($9.99 vs $10.99)",
    "Catálogo de >70M canciones",
    "Presencia global en 180+ países",
    "Apps disponibles en iOS, Android, Web"
  ]
}
```

**Export automático a JSON**:
- Archivo: `results_[brand]_[date].json`
- Estructura completa: análisis, competidores (con rank, breakdown, evidencias), metadata
- Guardado automático en el directorio actual

## Stack Tecnológico

- **Runtime**: Node.js 20+
- **Lenguaje**: TypeScript
- **LLM**: Anthropic Claude (claude-3-5-sonnet-20241022)
- **APIs**: SerpAPI (Google Search), Google Trends API
- **Scraping**: Cheerio, Axios
- **CLI**: Inquirer, Chalk, Ora
- **Base de Datos**: Supabase (PostgreSQL) - Pendiente Fase 5
- **API REST**: Express - Pendiente Fase 6
- **Autenticación**: JWT - Pendiente Fase 7
- **Deploy**: Railway - Pendiente Fase 7

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

## Características Implementadas

### Fase 1-4 (Completadas)
- ✅ Análisis automático de marcas globales y nicho
- ✅ Detección inteligente de ambigüedad con Claude
- ✅ Clasificación multi-fuente (5 fuentes en paralelo)
- ✅ Búsqueda de competidores con estrategias diferenciadas (Global vs Niche)
- ✅ Filtrado LLM para excluir blogs, guías y plataformas
- ✅ Scoring transparente REAL basado en 10 criterios (no placeholder)
- ✅ Display visual con barras de progreso y colores
- ✅ Evidencias específicas y verificables por competidor
- ✅ Export automático a JSON estructurado
- ✅ CLI interactivo con spinners, colores y feedback en tiempo real
- ✅ Detección automática de ubicación (Google Search, LLM, dominios)

### Fase 5-7 (Pendientes)
- ⏳ API REST con Express
- ⏳ Autenticación JWT
- ⏳ Persistencia en Supabase
- ⏳ Deploy en Railway

## Mejoras y Fixes Implementados

### Fix Crítico: Error de SerpAPI (Fase 2-3)
**Problema**: SerpAPI devuelve `local_results` y `organic_results` como objetos individuales en algunos casos, no siempre como arrays.

**Solución**: Helper function `getArrayData()` en `google-search.ts` que normaliza la respuesta:
```typescript
function getArrayData(data: any): any[] {
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}
```

### Mejoras en Búsqueda de Competidores (Fase 3)
1. **Filtrado LLM Balanceado**: Prompts menos agresivos que mantienen competidores legítimos pero excluyen blogs/guías
2. **Límite aumentado**: De 8 a 10 competidores para mayor cobertura
3. **Extracción multi-sección**: AI Overview, organic results y local results de SerpAPI
4. **Detección de ubicación multi-nivel**:
   - Google Search detected location
   - LLM primary_country
   - Dominios geográficos (.cl, .ar, .mx, etc)

### Sistema de Scoring Real (Fase 4)
**Antes**: Placeholder fijo de 85% para todos los competidores

**Ahora**:
- Scoring REAL generado por Claude en 10 criterios
- Validación automática de puntuaciones
- Evidencias específicas y verificables
- Display visual con barras de progreso
- Colores según calidad del match

## Casos de Prueba

### Caso A: Spotify (Global Brand)
```bash
$ npm run cli
¿Qué marca quieres analizar? Spotify

🤔 Analizando "Spotify" con Claude AI...
✅ Análisis completado - No ambiguo

📊 Clasificando tipo de marca...
   ✓ Wikipedia: 25 pts
   ✓ LLM Directo: 20 pts
   ✓ Google Search: 20 pts
   ✓ Google Trends: 18 pts
   ✓ Website Analyzer: 12 pts

📋 Tipo: GLOBAL BRAND (Score: 95/100)

🔍 Buscando competidores con estrategia GLOBAL...
✅ Encontrados 10 candidatos

🧠 Analizando competidores con Claude AI...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 TOP 5 COMPETIDORES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🥇 1. Apple Music - 92% similitud
   Industry:          15/15 ███████████████
   Business Model:    15/15 ███████████████
   Product Offering:  14/15 ██████████████
   Target Audience:   10/10 ██████████
   Geography:         10/10 ██████████
   Market Size:       10/10 ██████████
   Price Range:        9/10 █████████
   Digital Presence:   5/5  █████
   Brand Maturity:     5/5  █████
   Keywords:           4/5  ████

   📌 Evidencias:
   • Ambos son servicios de streaming musical
   • Modelo de suscripción mensual similar
   • Catálogo de >70M canciones

💾 Resultados guardados en: results_spotify_20251122.json
```

### Caso B: Herbívoro (Niche Brand)
```bash
$ npm run cli
¿Qué marca quieres analizar? Herbívoro

🤔 Analizando "Herbívoro" con Claude AI...

⚠️  Marca ambigua detectada
Categorías sugeridas:
1. Restaurante/Gastronomía
2. Productos retail/comercio
Selecciona: 1

✅ Categoría seleccionada: Restaurante/Gastronomía

📊 Clasificando tipo de marca...
   ✓ Wikipedia: 0 pts
   ✓ LLM Directo: 5 pts
   ✓ Google Search: 8 pts
   ✓ Google Trends: 3 pts
   ✓ Website Analyzer: 7 pts

📋 Tipo: NICHE BRAND (Score: 23/100)
📍 Ubicación detectada: Santiago, Chile

🔍 Buscando competidores con estrategia NICHO...
✅ Encontrados 10 candidatos

🧠 Analizando competidores con Claude AI...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 TOP 5 COMPETIDORES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🥇 1. El Huerto - 78% similitud
   Industry:          13/15 █████████████
   Business Model:    12/15 ████████████
   Product Offering:  12/15 ████████████
   [... más criterios ...]

💾 Resultados guardados en: results_herbivoro_20251122.json
```



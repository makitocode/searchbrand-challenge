# Estrategia de Clasificación: Global vs Nicho

## Definiciones Claras

### GLOBAL
Marca con **reconocimiento y operación en múltiples continentes (3+)**

**Características clave:**
- Opera y vende en 10+ países
- Wikipedia en 3+ idiomas
- Presencia en medios internacionales (BBC, CNN, Reuters, Bloomberg)
- Millones de seguidores en redes sociales (2M+ combinados)
- Google Trends muestra interés en 3+ continentes

**Ejemplos:** Nike, Coca-Cola, Apple, Real Madrid, Netflix, Spotify

### NICHO
**TODO lo que NO es global**

Incluye: nacional, regional, local, especializado

**Ejemplos:** Atlético Nacional (club local), Bancolombia (banco nacional), Juan Valdez (café colombiano), Herbívoro (restaurante local)

---

## Fuentes de Datos Prioritarias

### 1. Wikipedia (Peso: 25%)
**Por qué:** Indicador de notabilidad documentada

**Datos a extraer:**
-  Existe página: Sí/No
-  Número de idiomas disponibles
-  Primer párrafo completo
-  Categorías (buscar: "multinational", "international", "global")
-  Infobox (países de operación, si existe)

**Señales GLOBAL:**
- Wikipedia en **3+ idiomas** (crítico)
- Categorías internacionales
- Descripción menciona "global/internacional/mundial"

**Señales NICHO:**
- No existe Wikipedia
- Solo 1 idioma
- Categorías locales ("Empresas de Colombia", "Marcas mexicanas")

---

### 2. Google Search (Peso: 20%)
**Por qué:** Refleja presencia web y alcance geográfico

**Queries estratégicas:**
```
1. "[marca]" + "internacional" OR "global"
2. "[marca]" site:wikipedia.org
3. "[marca]" + "official" OR "site"
```

**Datos a extraer (Top 10 resultados):**
- URLs y dominios (.com, .uk, .br, .mx, .de, etc.)
- Idiomas de las páginas
- Tipo de sitios (medios internacionales vs locales)
- Menciones de presencia internacional

**Señales GLOBAL:**
- Resultados en múltiples idiomas
- Dominios de diferentes países
- Medios internacionales (BBC, CNN, Bloomberg)

**Señales NICHO:**
- Solo resultados en 1 idioma
- Solo sitios de 1 país/región
- Medios exclusivamente locales

---

### 3. Google Trends (Peso: 20%)
**Por qué:** Distribución geográfica real de interés

**Período:** Últimos 12 meses

**Datos a extraer:**
- Top 10-15 países por interés
- Distribución por continentes
- Concentración en país principal (%)

**Señales GLOBAL:**
- Interés en 3+ continentes
- Top 10 incluye países de diferentes regiones
- Distribución amplia (<70% en un solo país)

**Señales NICHO:**
- Interés concentrado en 1 país (>70%)
- Solo 1 continente representado
- Búsquedas muy localizadas

---

### 4. Sitio Web Oficial (Peso: 15%)
**Por qué:** Indica intención y capacidad de operación internacional

**Datos a extraer:**
- Selector de país/idioma visible
- Número de idiomas disponibles
- Múltiples dominios (.com, .mx, .br, etc.)
- Descripción menciona presencia internacional

**Señales GLOBAL:**
- 3+ idiomas disponibles
- Selector de país/región
- Menciona operación internacional

**Señales NICHO:**
- Solo 1 idioma
- Sin selector de país
- Enfoque local/nacional claro

---

### 5. Análisis LLM Directo (Peso: 20%)
**Por qué:** El LLM posee conocimiento pre-entrenado sobre marcas globales conocidas

**Implementación:**
Preguntarle directamente a Claude o GPT-5:

```
Prompt:
"¿Conoces la marca '{brandName}'? Responde en formato JSON con:
{
  "knows_brand": true/false,
  "classification": "global" | "local" | "unknown",
  "confidence": 0-100,
  "known_countries": ["país1", "país2", ...],
  "continental_presence": ["continente1", "continente2", ...],
  "reasoning": "explicación breve"
}
"
```

**Señales GLOBAL:**
- LLM conoce la marca sin contexto adicional
- `knows_brand: true` + `confidence > 70%`
- `known_countries >= 10`
- `continental_presence >= 3`

**Señales NICHO:**
- LLM no conoce la marca o solo tiene conocimiento local
- `knows_brand: false` o `confidence < 50%`
- `known_countries <= 2`
- `continental_presence <= 1`

**Ventaja clave:**
- Evita scraping innecesario para marcas universales (Nike, Coca-Cola, Spotify)
- Puede detectar marcas globales incluso sin Wikipedia en múltiples idiomas
- Reduce falsos positivos para marcas locales con Wikipedia

---

## Sistema de Scoring

### Puntuación (0-100 puntos)

| Fuente | Condición | Puntos |
|--------|-----------|--------|
| **Wikipedia** | Existe en 3+ idiomas | +25 |
| | Existe en 1-2 idiomas | +8 |
| | Categorías globales | +5 |
| | No existe | 0 |
| **Google Search** | Resultados en 3+ idiomas | +12 |
| | Medios internacionales | +8 |
| | Dominios multi-país | +5 |
| **Google Trends** | Interés en 3+ continentes | +15 |
| | Top 10 multi-región | +10 |
| **Sitio Web** | 3+ idiomas disponibles | +10 |
| | Selector de país | +8 |
| **LLM Directo** | LLM conoce marca (confianza >70%) | +15 |
| | Presencia 3+ continentes según LLM | +10 |
| | LLM no conoce o baja confianza | 0 |

### Clasificación Final

```
Score >= 50 → GLOBAL
Score < 50  → NICHO
```

### Niveles de Confianza

| Score | Confianza | Descripción |
|-------|-----------|-------------|
| 70-100 | ALTA (80-95%) | Evidencia clara y consistente |
| 40-69 | MEDIA (50-79%) | Evidencia suficiente con matices |
| 0-39 | BAJA (<50%) | Evidencia insuficiente o contradictoria |

**Confianza BAJA:** Solicitar contexto adicional al usuario o marcar para revisión manual

---

## Criterios de Decisión para LLM

**Para clasificar como GLOBAL, debe cumplir AL MENOS 3 de estos:**

- [ ] Wikipedia en 3+ idiomas
- [ ] Google Trends: interés en 3+ continentes
- [ ] Sitio web en 3+ idiomas
- [ ] Medios internacionales cubren la marca
- [ ] Google Search: resultados en múltiples idiomas/países
- [ ] LLM conoce la marca con confianza >70% y presencia en 3+ continentes

**Si NO cumple 3+ criterios → NICHO**

**Nota sobre LLM:**
El análisis directo del LLM sirve como:
1. **Validación rápida**: Si LLM conoce bien la marca, probablemente es global
2. **Tie-breaker**: En casos ambiguos (score entre 45-55), el LLM decide
3. **Justificación final**: Genera explicación humana del razonamiento

---

## Consideraciones Especiales

### 1. Equipos Deportivos
- **GLOBAL:** Fanbase en múltiples continentes, torneos internacionales principales
- **NICHO:** Club local aunque sea exitoso nacionalmente (ej: Atlético Nacional)

### 2. Empresas B2B
- Pueden ser GLOBAL aunque consumidor promedio no las conozca
- Evaluar por operación internacional documentada

### 3. Ambigüedad (palabra común vs marca)
- Si Google Search muestra ruido significativo
- Claude detectará esto en FASE 1
- Si no se resuelve: Confianza < 50%

### 4. Regla de Oro
**Ante duda razonable → Clasificar como NICHO**

Es mejor subestimar que sobreestimar alcance global

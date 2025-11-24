# Quick Start Guide

## 🚀 Inicio Rápido (5 minutos)

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar API Keys
```bash
# Copiar ejemplo
cp .env.example .env

# Editar y agregar tus API keys
nano .env
```

**Edita estas líneas en `.env`:**
```bash
ANTHROPIC_API_KEY=sk-ant-api03-TU_API_KEY_AQUI
OPENAI_API_KEY=sk-proj-TU_API_KEY_AQUI
SERP_API_KEY=tu_serpapi_key_aqui  # Opcional pero recomendado
```

### 3. Iniciar base de datos
```bash
npm run db:start
```

**Espera ~10 segundos** para que PostgreSQL inicialice.

Verifica que está corriendo:
```bash
npm run db:logs
```

Deberías ver: `database system is ready to accept connections`

### 4. Compilar proyecto
```bash
npm run build
```

### 5. ¡Ejecutar análisis!
```bash
npm run cli -- analyze
```

El CLI te preguntará qué marca analizar. Prueba con:
- `Starbucks` (marca global)
- `Cafe Soca` (marca nicho colombiana)
- `https://www.nike.com` (URL de marca)

---

## 📊 Resultado Esperado

El sistema:
1. ✅ Analiza la marca con Claude
2. ✅ Clasifica como Global o Nicho
3. ✅ Busca competidores en Google
4. ✅ Puntúa competidores con GPT-4
5. ✅ Muestra top 5 competidores
6. ✅ Exporta resultados a JSON
7. ✅ Guarda en base de datos

**Archivo generado:**
```
results_<marca>_<fecha>.json
```

---

## 🛠️ Comandos Útiles

### Base de Datos
```bash
npm run db:start      # Iniciar PostgreSQL
npm run db:stop       # Detener PostgreSQL
npm run db:logs       # Ver logs
npm run db:shell      # Acceder a psql
npm run db:reset      # Resetear (elimina datos)
```

### Desarrollo
```bash
npm run dev -- analyze    # Modo desarrollo (hot-reload)
npm run build            # Compilar
npm run build:watch      # Compilar con auto-reload
```



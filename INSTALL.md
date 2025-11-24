# Guía de Instalación - SearchBrand Challenge

Esta guía te ayudará a configurar y ejecutar el proyecto localmente.

## Requisitos Previos

- **Node.js** 18+ y npm
- **Docker** y Docker Compose (para base de datos local)
- **Git** (para clonar el repositorio)

## Instalación Paso a Paso

### 1. Clonar el repositorio e instalar dependencias

```bash
# Clonar el repositorio
git clone <repository-url>
cd searchbrand-challenge

# Instalar dependencias
npm install
```

### 2. Configurar variables de entorno

```bash
# Copiar el archivo de ejemplo
cp .env.example .env

# Editar el archivo .env con tus credenciales
nano .env  # o usa tu editor preferido
```

**Variables requeridas:**

```bash
# Base de datos local (Docker PostgreSQL)
DATABASE_URL=postgresql://searchbrand:searchbrand_dev_password@localhost:5432/searchbrand

# LLM APIs (REQUERIDAS)
ANTHROPIC_API_KEY=sk-ant-api03-xxx  # Tu API key de Anthropic (Claude)
OPENAI_API_KEY=sk-proj-xxx           # Tu API key de OpenAI (GPT-4)

# Opcional: SerpAPI para búsquedas de Google
SERP_API_KEY=your-serpapi-key-optional

# Otras configuraciones (opcional)
PORT=3000
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key-change-this
```

**Importante:** Sin `ANTHROPIC_API_KEY` y `OPENAI_API_KEY` el sistema NO funcionará.

### 3. Iniciar la base de datos local

```bash
# Iniciar PostgreSQL con Docker Compose
npm run db:start

# Esto ejecutará:
# - PostgreSQL 15 en puerto 5432
# - Creará la base de datos "searchbrand"
# - Ejecutará automáticamente schema.sql y seed.sql
```

**Verificar que la base de datos está corriendo:**

```bash
# Ver logs de la base de datos
npm run db:logs

# O verificar que el contenedor está corriendo
docker ps | grep searchbrand
```

### 4. Compilar el proyecto

```bash
# Compilar TypeScript a JavaScript
npm run build
```

### 5. Ejecutar el CLI

```bash
# Ejecutar el comando analyze
npm run cli

# O en modo desarrollo (con hot-reload)
npm run dev
```

## Comandos Disponibles

### Comandos de Base de Datos

```bash
# Iniciar PostgreSQL (Docker)
npm run db:start

# Detener PostgreSQL
npm run db:stop

# Reiniciar PostgreSQL
npm run db:restart

# Ver logs de PostgreSQL
npm run db:logs

# Resetear base de datos (CUIDADO: elimina todos los datos)
npm run db:reset

# Acceder a la base de datos con psql
npm run db:shell
```

### Comandos de Desarrollo

```bash
# Compilar TypeScript
npm run build

# Compilar en modo watch (auto-recompila al guardar)
npm run build:watch

# Ejecutar CLI en modo desarrollo
npm run dev -- analyze

# Ejecutar CLI en modo producción
npm run cli -- analyze
```

### Comandos de Linting y Formato

```bash
# Ejecutar ESLint
npm run lint

# Corregir problemas de ESLint automáticamente
npm run lint:fix
```

## Estructura del Proyecto

```
searchbrand-challenge/
├── database/
│   ├── schema.sql          # Schema de la base de datos
│   ├── seed.sql            # Datos iniciales
│   └── reset.sql           # Script para resetear la BD
├── src/
│   ├── cli/                # Comandos CLI
│   ├── services/           # Lógica de negocio
│   │   ├── analysis/       # Análisis de marcas
│   │   ├── database/       # Cliente y repositorios DB
│   │   ├── llm/            # Clientes LLM (Claude, GPT-4)
│   │   └── scraping/       # Scraping y búsqueda
│   ├── types/              # Definiciones TypeScript
│   └── utils/              # Utilidades
├── docker-compose.yml      # Configuración Docker
├── .env                    # Variables de entorno (NO commitear)
└── .env.example            # Ejemplo de variables
```

## Flujo de Trabajo Típico

### Primera vez (setup completo)

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar .env
cp .env.example .env
# Editar .env con tus API keys

# 3. Iniciar base de datos
npm run db:start

# 4. Compilar proyecto
npm run build

# 5. Ejecutar análisis
npm run cli
```

---
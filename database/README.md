# Database Files

Este directorio contiene los archivos SQL para la base de datos PostgreSQL.

## Archivos

### `schema.sql`
**Propósito:** Define la estructura completa de la base de datos.

**Incluye:**
- Tablas: `users`, `brand_cache`, `competitor_cache`, `brand_analyses`, `competitors`, `auth_tokens`
- Índices para optimización de queries
- Triggers para auto-limpieza de cache expirado
- Extensiones (UUID)

**Ejecución:** Automática al crear el contenedor Docker por primera vez.

### `seed.sql`
**Propósito:** Datos iniciales para desarrollo y testing.

**Incluye:**
- Usuario demo: `demo@searchbrand.com`
- Password: `demo123` (hash bcrypt)

**Ejecución:** Automática después de `schema.sql`.

### `reset.sql`
**Propósito:** Elimina todas las tablas para reiniciar desde cero.

**⚠️ CUIDADO:** Elimina TODOS los datos de la base de datos.

**Uso:**
```bash
npm run db:reset
```

**Ejecución:** Manual, solo cuando necesites resetear.

## Estructura de Tablas

### `users`
Usuarios del sistema (para futuro sistema de autenticación).

### `brand_cache`
Cache de clasificaciones de marca (TTL: 7 días).
- Normaliza nombres de marca
- Guarda resultado completo de clasificación
- Analytics: hit_count, last_hit_at

### `competitor_cache`
Cache de búsquedas de competidores (TTL: 3 días).
- Key compuesto: brand_name + industry + brand_type + location
- Guarda lista de competidores sin scoring
- Analytics: hit_count, last_hit_at

### `brand_analyses`
Historial de análisis realizados.
- Status: pending → processing → completed/failed
- Timestamps: created_at, started_at, completed_at
- Datos LLM: input_analysis, enriched_data

### `competitors`
Competidores puntuados por análisis.
- Relación: N competidores por 1 análisis
- Scoring completo: similarity_score, breakdown
- Evidence array con justificaciones

### `auth_tokens`
Tokens JWT para autenticación (futuro).

## Migraciones

Para cambios futuros en el schema, crear archivos:
```
database/migrations/
  001_initial.sql        (ya existe, es schema.sql)
  002_add_new_field.sql
  003_add_index.sql
```

## Ver Datos

```bash
# Entrar a la base de datos
npm run db:shell

# Queries útiles
SELECT COUNT(*) FROM brand_cache;
SELECT COUNT(*) FROM competitor_cache;
SELECT COUNT(*) FROM brand_analyses;
SELECT * FROM brand_analyses ORDER BY created_at DESC LIMIT 5;
```

## Limpieza

### Cache expirado
Automático via trigger SQL. No requiere acción manual.

### Eliminar todo
```bash
npm run db:reset
```

### Eliminar volumen completo
```bash
npm run db:stop
docker volume rm searchbrand-challenge_postgres_data
npm run db:start
```

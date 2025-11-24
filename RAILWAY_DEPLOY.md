# Guía de Despliegue a Railway

Esta guía te ayudará a desplegar el API de SearchBrand a Railway con Supabase como base de datos.

## 📋 Pre-requisitos

1. **Cuenta en Railway** - [railway.app](https://railway.app)
2. **Cuenta en Supabase** - [supabase.com](https://supabase.com)
3. **Repositorio Git** - El código debe estar en GitHub/GitLab/Bitbucket

## 🗄️ Paso 1: Configurar Supabase

### 1.1. Crear proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea un nuevo proyecto
2. Espera a que el proyecto se inicialice (~2 minutos)
3. Anota las credenciales:
   - **Project URL**: `https://your-project.supabase.co`
   - **Anon/Public Key**: `eyJhbGc...`

### 1.2. Ejecutar schema en Supabase

1. Ve a SQL Editor en tu proyecto Supabase
2. Copia el contenido de `database/schema.sql`
3. Pégalo en el editor y ejecuta
4. Verifica que las tablas se crearon correctamente

### 1.3. Crear usuario inicial (opcional)

```sql
-- Ejecutar en SQL Editor de Supabase
-- Reemplaza con tu email y contraseña

-- Hash de la contraseña "password123" (ejemplo)
-- En producción, genera el hash con bcrypt desde Node.js

INSERT INTO users (email, password_hash)
VALUES (
  'admin@example.com',
  '$2a$10$rXKopjhhuC3FhVXXWmQIUeDXhH4jG0DVE/KDV.vEZ7lNQ5W6EaZ2y'
);
```

**Para generar un hash de contraseña:**
```javascript
// Ejecuta esto en Node.js
const bcrypt = require('bcryptjs');
const hash = await bcrypt.hash('tu_contraseña', 10);
console.log(hash);
```

## 🚂 Paso 2: Desplegar a Railway

### 2.1. Crear proyecto en Railway

1. Ve a [railway.app](https://railway.app)
2. Click en "New Project"
3. Selecciona "Deploy from GitHub repo"
4. Autoriza Railway a acceder a tu repositorio
5. Selecciona el repositorio `searchbrand-challenge`

### 2.2. Configurar variables de entorno

Railway detectará automáticamente el `Dockerfile` y lo usará. Ahora configura las variables de entorno:

1. Ve a tu proyecto en Railway
2. Click en "Variables"
3. Agrega las siguientes variables:

```bash
# Base de datos Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=eyJhbGc...tu-anon-key

# LLM APIs (REQUERIDAS)
ANTHROPIC_API_KEY=sk-ant-api03-xxx
OPENAI_API_KEY=sk-proj-xxx

# Autenticación JWT
JWT_SECRET=un-secreto-super-seguro-cambialo-en-produccion

# Configuración de la aplicación
NODE_ENV=production
PORT=3000

# Opcional: SerpAPI
SERP_API_KEY=tu-serpapi-key-opcional

# Opcional: CORS (dominio de tu frontend)
CORS_ORIGIN=https://tu-frontend.com
```

### 2.3. Desplegar

1. Railway automáticamente iniciará el build
2. El proceso tomará ~2-5 minutos
3. Una vez completado, Railway te dará una URL pública

**URL del API:**
```
https://searchbrand-challenge-production.up.railway.app
```

### 2.4. Verificar despliegue

```bash
# Health check
curl https://tu-app.up.railway.app/health

# Debería retornar:
{
  "status": "ok",
  "timestamp": "2024-01-24T15:00:00.000Z",
  "uptime": 123.45,
  "environment": "production"
}
```

## 🔧 Paso 3: Configuración adicional

### 3.1. Dominio personalizado (opcional)

1. Ve a tu servicio en Railway
2. Click en "Settings" → "Networking"
3. Click en "Custom Domain"
4. Agrega tu dominio y configura el DNS

### 3.2. Logs y monitoreo

**Ver logs en tiempo real:**
1. Ve a tu servicio en Railway
2. Click en "Deployments"
3. Click en el deployment activo
4. Verás los logs en tiempo real

**Comandos útiles:**
```bash
# Instalar Railway CLI (opcional)
npm install -g @railway/cli

# Login
railway login

# Ver logs
railway logs

# Conectar a proyecto
railway link
```

## 📊 Paso 4: Probar el API

### 4.1. Health check
```bash
curl https://tu-app.up.railway.app/health
```

### 4.2. Login
```bash
curl -X POST https://tu-app.up.railway.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "password123"
  }'
```

**Respuesta esperada:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "admin@example.com"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 4.3. Crear análisis
```bash
# Guarda el token de la respuesta anterior
TOKEN="tu-token-jwt"

curl -X POST https://tu-app.up.railway.app/api/v1/analysis \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "brand": "Starbucks"
  }'
```

## 🐛 Troubleshooting

### Error: "Database not available"
- Verifica que `SUPABASE_URL` y `SUPABASE_KEY` estén configurados correctamente
- Verifica que el schema se haya ejecutado en Supabase

### Error: "JWT_SECRET is required"
- Agrega la variable `JWT_SECRET` en Railway
- Reinicia el deployment

### Error: "ANTHROPIC_API_KEY is required"
- Verifica que las API keys de LLM estén configuradas
- Las keys son obligatorias para que el sistema funcione

### El servidor no arranca
- Revisa los logs en Railway
- Verifica que todas las variables de entorno estén configuradas
- Verifica que el Dockerfile se haya construido correctamente

### 502 Bad Gateway
- El servidor está arrancando, espera ~30 segundos
- Si persiste, revisa los logs para ver errores de inicio

## 🔄 Actualizar el deployment

Railway automáticamente desplegará cuando hagas push a tu rama principal:

```bash
git add .
git commit -m "Update API"
git push origin main
```

Railway detectará el cambio y iniciará un nuevo deployment automáticamente.

## 📱 Endpoints disponibles

Una vez desplegado, tu API tendrá estos endpoints:

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET | `/health` | ❌ | Health check |
| POST | `/api/v1/auth/login` | ❌ | Login |
| POST | `/api/v1/analysis` | ✅ | Crear análisis |
| GET | `/api/v1/analysis/history` | ✅ | Historial |
| GET | `/api/v1/analysis/:id` | ✅ | Obtener análisis |

## 🔐 Seguridad en producción

1. **Cambia JWT_SECRET**: Usa un secreto seguro y único
2. **Configura CORS**: Limita el origen a tu dominio frontend
3. **Variables de entorno**: Nunca commitees las API keys
4. **Rate limiting**: Ya está configurado (10 análisis/hora)
5. **HTTPS**: Railway provee HTTPS automáticamente

## 💰 Costos estimados

**Railway:**
- Free tier: $5 de crédito gratis/mes
- Pro plan: $20/mes (recomendado para producción)

**Supabase:**
- Free tier: 500 MB de base de datos, 2 GB de transferencia
- Pro plan: $25/mes (ilimitado)

**APIs externas:**
- Anthropic (Claude): ~$0.015 por análisis
- OpenAI (GPT-4): ~$0.03 por análisis
- SerpAPI: 100 búsquedas gratis/mes

**Estimado total por mes (100 análisis/mes):**
- Railway: $20
- Supabase: $0 (free tier suficiente)
- LLM APIs: ~$5
- **Total: ~$25/mes**

---

## ✅ Checklist de despliegue

- [ ] Proyecto creado en Supabase
- [ ] Schema ejecutado en Supabase
- [ ] Usuario inicial creado
- [ ] Proyecto creado en Railway
- [ ] Variables de entorno configuradas
- [ ] Deployment completado exitosamente
- [ ] Health check responde OK
- [ ] Login funciona correctamente
- [ ] Análisis endpoint funciona
- [ ] CORS configurado (si aplica)
- [ ] Logs de errores revisados

---

¿Necesitas ayuda? Revisa los logs en Railway o contacta al equipo de desarrollo.

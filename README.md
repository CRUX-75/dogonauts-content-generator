# Dogonauts Content Agent

Pipeline automatizado de generación de posts (IG/FB) para dogonauts.de
usando Supabase + n8n + OpenAI.

## Scripts

- `npm run dev` - Ejecuta en modo desarrollo (ts-node-dev).
- `npm run build` - Compila a `dist/`.
- `npm start` - Ejecuta versión compilada.

## Setup

1. Copia `.env.example` a `.env` y rellena valores.
2. Ejecuta `db/schema.sql` en el SQL editor de Supabase.
3. `npm install`
4. `npm run dev`
5. Abre `http://localhost:4000/healthz`

Para crear un job de prueba:

```bash
curl -X POST http://localhost:4000/jobs/create \
  -H "Content-Type: application/json" \
  -d '{"type":"CREATE_POST","payload":{"target_channel":"IG_FB"}}'
```

import dotenv from 'dotenv';
import { resolve } from 'path';

// Cargar .env desde la raíz del proyecto
dotenv.config({ path: resolve(__dirname, '../.env') });

// Validar variables de entorno requeridas
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  supabase: {
    url: requireEnv('SUPABASE_URL'),
    serviceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  },
  openai: {
    apiKey: requireEnv('OPENAI_API_KEY'),
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  worker: {
    pollInterval: parseInt(process.env.WORKER_POLL_INTERVAL || '10000', 10),
  },
};

// Log de configuración (sin mostrar secrets)
console.log('[CONFIG] Environment loaded:', {
  supabaseUrl: config.supabase.url,
  nodeEnv: config.server.nodeEnv,
  port: config.server.port,
});
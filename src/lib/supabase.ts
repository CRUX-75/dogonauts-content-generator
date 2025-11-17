import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

// Validar que las credenciales están presentes antes de crear el cliente
if (!config.supabase.url || !config.supabase.serviceRoleKey) {
  throw new Error('Supabase credentials are not properly configured');
}

// Validar formato de URL
try {
  new URL(config.supabase.url);
} catch (error) {
  throw new Error(`Invalid SUPABASE_URL: ${config.supabase.url}`);
}

export const supabaseAdmin = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

console.log('[SUPABASE] Client initialized successfully');
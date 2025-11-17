import express from 'express';
import { config } from './config';
import { log, logError } from './lib/logger';
import { supabaseAdmin } from './lib/supabase';

const app = express();
app.use(express.json());

// Health check mejorado
app.get('/healthz', async (req, res) => {
  try {
    // Test Supabase connection con timeout
    const { data, error } = await supabaseAdmin
      .from('jobs')
      .select('count')
      .limit(1)
      .single();
    
    if (error) {
      // Si la tabla no existe, es OK para el health check inicial
      if (error.code === 'PGRST116') {
        return res.json({ 
          status: 'ok', 
          timestamp: new Date().toISOString(),
          service: 'dogonauts-content-generator',
          message: 'Database connected (table not found - run migrations)'
        });
      }
      throw error;
    }

    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      service: 'dogonauts-content-generator',
      database: 'connected'
    });
  } catch (error) {
    logError('Health check failed', error);
    res.status(500).json({ 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Database connection failed' 
    });
  }
});

// Endpoint para verificar configuración (sin exponer secrets)
app.get('/config', (req, res) => {
  res.json({
    environment: config.server.nodeEnv,
    supabaseConfigured: !!config.supabase.url,
    openaiConfigured: !!config.openai.apiKey,
  });
});

// Manejo de errores global
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logError('Unhandled error', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = config.server.port;
app.listen(PORT, () => {
  log(`✅ Server running on http://localhost:${PORT}`);
  log(`Environment: ${config.server.nodeEnv}`);
  log(`Health check: http://localhost:${PORT}/healthz`);
});
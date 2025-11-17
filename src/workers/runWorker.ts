import { startWorker } from './handleJob';
import { logError } from '../lib/logger';

// Archivo dedicado para ejecutar el worker
startWorker().catch((error) => {
  logError('[WORKER] Failed to start worker', error);
  process.exit(1);
});
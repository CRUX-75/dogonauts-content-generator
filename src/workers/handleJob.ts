import { supabaseAdmin } from '../lib/supabase';
import { log, logError } from '../lib/logger';
import { createPostJob } from './createPost';
import { config } from '../config';

async function pollJobs() {
  try {
    const { data: job, error } = await supabaseAdmin
      .from('jobs')
      .select('*')
      .eq('status', 'PENDING')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (error || !job) {
      return;
    }

    log(`[WORKER] Processing job ${job.id} of type ${job.job_type}`);

    await supabaseAdmin
      .from('jobs')
      .update({ status: 'IN_PROGRESS' })
      .eq('id', job.id);

    if (job.job_type === 'CREATE_POST') {
      await createPostJob(job.payload || {});
    }

    await supabaseAdmin
      .from('jobs')
      .update({ 
        status: 'COMPLETED',
        completed_at: new Date().toISOString()
      })
      .eq('id', job.id);

    log(`[WORKER] Job ${job.id} completed successfully`);

  } catch (error) {
    logError('[WORKER] Job processing failed', error);
  }
}

export async function startWorker() {
  log('[WORKER] Starting job worker...');
  
  setInterval(async () => {
    await pollJobs();
  }, config.worker.pollInterval);

  await pollJobs();
}
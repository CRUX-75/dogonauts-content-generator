// scripts/run-feedback-collect-job.ts
import { feedbackCollectJob } from '../src/jobs/handlers/feedbackCollectJob';

async function main() {
  const fakeJob = {
    id: 'local-feedback-job',
    attempts: 0,
    payload: {}
  };

  await feedbackCollectJob(fakeJob);

  console.log('✅ feedbackCollectJob ejecutado en modo local');
}

main().catch((err) => {
  console.error('❌ Error ejecutando feedbackCollectJob local:', err);
  process.exit(1);
});

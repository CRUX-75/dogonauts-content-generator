// scripts/run-publish-post-job.ts
import { publishPostJob } from '../src/jobs/handlers/publishPostJob';

async function main() {
  const job = {
    id: 'local-publish-job',
    attempts: 0,
    payload: {
      // 👇 ID del DRAFT que quieres publicar
      postId: '355e8b29-bebc-49f1-8e3e-1651e9b10cb1',
    },
  };

  await publishPostJob(job as any);

  console.log('✅ publishPostJob ejecutado en modo local');
}

main().catch((err) => {
  console.error('❌ Error ejecutando publishPostJob local:', err);
  process.exit(1);
});

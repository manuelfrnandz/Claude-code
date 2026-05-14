import { createApp, config } from './app';
import { logger } from './utils/logger';
import { createBullConnection } from './services/redis';
import { processMessageJob } from './services/queue/messageProcessor';
import { getRedisClient } from './services/redis';
import { Worker } from 'bullmq';

async function start(): Promise<void> {
  // Warm up the Redis client so the fallback warning appears at startup if needed
  await getRedisClient();

  const app = createApp();

  // BullMQ worker — runs in-process unless DISABLE_WORKER=true
  if (config.DISABLE_WORKER !== 'true') {
    const workerConn = createBullConnection();
    const worker = new Worker('message-processing', processMessageJob, {
      connection: workerConn,
      concurrency: config.WORKER_CONCURRENCY,
    });
    worker.on('failed', (job, err) =>
      logger.error({ jobId: job?.id, err: err.message, attempts: job?.attemptsMade }, 'job_failed'),
    );
    logger.info({ concurrency: config.WORKER_CONCURRENCY }, 'message_worker_started');
  }

  app.listen(config.PORT, () => {
    logger.info({ port: config.PORT, env: config.NODE_ENV }, 'API server started');
  });
}

start().catch((err: Error) => {
  logger.error({ err: err.message }, 'startup_failed');
  process.exit(1);
});

import { Job } from 'bullmq';
import { logger } from '../../utils/logger';
import type { MessageJobData } from './messageQueue';

/**
 * Core message processing pipeline.
 * Day 3: stub that logs receipt and session interaction.
 * Days 4-6: will add tenant load, AI, Supabase persistence, WhatsApp reply.
 */
export async function processMessageJob(job: Job<MessageJobData>): Promise<void> {
  const { tenantId, parsedMessage } = job.data;

  logger.info(
    {
      jobId: job.id,
      tenantId,
      type: parsedMessage.type,
      from: parsedMessage.from,
      attempt: job.attemptsMade + 1,
    },
    'message_job_received',
  );

  // TODO Day 4: load TenantConfig from Supabase
  // TODO Day 4: dedup check via Redis
  // TODO Day 5: audio transcription
  // TODO Day 6: AI response + Supabase persistence + WhatsApp send
}

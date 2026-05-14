import { Queue } from 'bullmq';
import { createBullConnection } from '../redis';
import type { ParsedMessage } from '../whatsapp/parser';

export interface MessageJobData {
  tenantId: string; // wa_phone_number_id — resolved to tenant in processor
  parsedMessage: ParsedMessage & { type: 'text' | 'audio' };
}

// Shared IORedis connection for the Queue (worker uses a separate connection)
export const bullConnection = createBullConnection();

export const messageQueue = new Queue<MessageJobData>('message-processing', {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

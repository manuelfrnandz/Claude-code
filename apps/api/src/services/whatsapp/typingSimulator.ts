import { markAsRead } from './sender';
import { logger } from '../../utils/logger';

const MAX_DELAY_MS = 3000;

/**
 * Mark a message as read (shows blue ticks) then wait briefly to mimic
 * a human typing. Never blocks longer than MAX_DELAY_MS regardless of
 * the requested duration.
 *
 * Failures are swallowed — a missing read receipt must never stall the worker.
 */
export async function simulateTyping(
  phoneNumberId: string,
  accessToken: string,
  phone: string,
  waMessageId: string,
  delayMs = 1200,
): Promise<void> {
  try {
    await markAsRead(phoneNumberId, accessToken, waMessageId);
  } catch (err) {
    logger.warn({ err: (err as Error).message, phone }, 'typing_simulator_mark_read_failed');
  }

  await new Promise<void>((resolve) =>
    setTimeout(resolve, Math.min(delayMs, MAX_DELAY_MS)),
  );
}

import { Router, Request, Response } from 'express';
import { config } from '../config';
import { validateSignature } from '../middleware/validateSignature';
import { parseWebhookBody } from '../services/whatsapp/parser';
import { messageQueue } from '../services/queue/messageQueue';
import { logger } from '../utils/logger';

export const webhookRouter = Router();

// GET /webhook — Meta hub verification handshake
webhookRouter.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.META_VERIFY_TOKEN) {
    logger.info('webhook_verified');
    res.send(challenge);
    return;
  }

  logger.warn({ mode, ip: req.ip }, 'webhook_verification_failed');
  res.sendStatus(403);
});

// POST /webhook — incoming WhatsApp messages
webhookRouter.post('/webhook', validateSignature, (req: Request, res: Response) => {
  // Meta retries if response takes > 5s — always 200 before queuing
  res.sendStatus(200);

  const messages = parseWebhookBody(req.body);

  for (const msg of messages) {
    if (msg.type === 'unsupported') {
      logger.debug({ original: msg.original }, 'webhook_unsupported_message');
      continue;
    }

    messageQueue
      .add('process', { tenantId: msg.phoneNumberId, parsedMessage: msg })
      .catch((err: Error) =>
        logger.error({ err: err.message, waMessageId: msg.waMessageId }, 'queue_add_failed'),
      );
  }
});

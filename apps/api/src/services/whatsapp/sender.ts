import axios from 'axios';
import { config } from '../../config';
import { logger } from '../../utils/logger';

const BASE = `${config.META_GRAPH_URL}/${config.META_API_VERSION}`;

function headers(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

export async function sendText(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  text: string,
): Promise<void> {
  await axios.post(
    `${BASE}/${phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body: text, preview_url: false },
    },
    { headers: headers(accessToken) },
  );

  logger.info({ phoneNumberId, to }, 'whatsapp_message_sent');
}

export async function markAsRead(
  phoneNumberId: string,
  accessToken: string,
  waMessageId: string,
): Promise<void> {
  await axios.post(
    `${BASE}/${phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: waMessageId,
    },
    { headers: headers(accessToken) },
  );
}

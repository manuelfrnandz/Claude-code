import { getRedisClient } from '../redis';
import { config } from '../../config';

export interface Session {
  conversationId: string;
  lastActivity: number; // Date.now()
  messageCount: number;
}

function key(tenantId: string, phone: string): string {
  return `session:${tenantId}:${phone}`;
}

export async function getSession(tenantId: string, phone: string): Promise<Session | null> {
  const client = await getRedisClient();
  const raw = await client.get(key(tenantId, phone));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export async function setSession(tenantId: string, phone: string, data: Session): Promise<void> {
  const client = await getRedisClient();
  await client.set(key(tenantId, phone), JSON.stringify(data), config.SESSION_TTL_SECONDS);
}

export async function deleteSession(tenantId: string, phone: string): Promise<void> {
  const client = await getRedisClient();
  await client.del(key(tenantId, phone));
}

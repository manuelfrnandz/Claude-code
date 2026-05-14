import axios from 'axios';
import { toFile } from 'openai';
import { openai } from '../ai/openaiClient';
import { config } from '../../config';

/**
 * Download a WhatsApp audio message and transcribe it with Whisper.
 * Throws on any failure — caller decides whether to skip or retry.
 */
export async function transcribeAudio(audioId: string, accessToken: string): Promise<string> {
  // Step 1: resolve the actual download URL from Meta
  const metaUrl = `${config.META_GRAPH_URL}/${config.META_API_VERSION}/${audioId}`;
  const { data: mediaInfo } = await axios.get<{ url: string }>(metaUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!mediaInfo.url) {
    throw new Error(`Meta did not return a download URL for audioId=${audioId}`);
  }

  // Step 2: download the binary audio file
  const { data: audioBuffer } = await axios.get<Buffer>(mediaInfo.url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    responseType: 'arraybuffer',
  });

  // Step 3: transcribe with Whisper
  const transcription = await openai.audio.transcriptions.create({
    file: await toFile(Buffer.from(audioBuffer), 'audio.ogg', { type: 'audio/ogg' }),
    model: 'whisper-1',
    language: 'es',
  });

  return transcription.text;
}

import { apiClient } from './client';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export interface TTSResponse {
  audio: string;
  format: string;
}

export async function getSpeech(
  text: string,
  voice: string = 'marin',
  language?: string
): Promise<TTSResponse> {
  return apiClient.post<TTSResponse>('/tts', { text, voice, language });
}

export function getSpeechStreamUrl(
  text: string,
  voice: string = 'marin',
  language?: string
): string {
  const params = new URLSearchParams({ text, voice });
  if (language) params.set('language', language);
  return `${API_URL}/tts/stream?${params.toString()}`;
}

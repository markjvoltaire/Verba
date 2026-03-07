import { apiClient } from './client';

export interface TranslateResponse {
  translation: string;
  note?: string;
}

export async function translate(text: string, targetLang: string): Promise<TranslateResponse> {
  return apiClient.post<TranslateResponse>('/translate', { text, targetLang });
}

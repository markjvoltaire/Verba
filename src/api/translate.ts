import { apiClient } from './client';

export interface TranslateResponse {
  translation: string;
  note?: string;
}

export interface TranslateOptions {
  literal?: boolean;
}

/**
 * Request translation. When literal is true (default), backend should translate
 * word-for-word and preserve structure rather than natural/idiomatic phrasing.
 */
export async function translate(
  text: string,
  targetLang: string,
  options?: TranslateOptions
): Promise<TranslateResponse> {
  return apiClient.post<TranslateResponse>('/translate', {
    text,
    targetLang,
    literal: options?.literal ?? true,
  });
}

import { apiClient } from './client';

export interface Phrase {
  id: string;
  target_lang: string;
  phrase: string;
  translation: string;
  scenario?: string;
  difficulty?: string;
}

export async function getPhrases(
  lang?: string,
  scenario?: string,
  difficulty?: string,
  limit?: number
): Promise<Phrase[]> {
  const params = new URLSearchParams();
  if (lang) params.set('lang', lang);
  if (scenario) params.set('scenario', scenario);
  if (difficulty) params.set('difficulty', difficulty);
  if (limit != null) params.set('limit', String(limit));
  const query = params.toString();
  return apiClient.get<Phrase[]>(`/phrases${query ? `?${query}` : ''}`);
}

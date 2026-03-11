import { apiClient } from './client';

export interface LessonIntroResponse {
  greeting: string;
  explanation: string;
}

export async function getLessonIntro(
  scenario: string,
  nativeLang: string,
  targetLang: string,
): Promise<LessonIntroResponse> {
  const params = new URLSearchParams({
    scenario,
    nativeLang,
    targetLang,
  });
  return apiClient.get<LessonIntroResponse>(`/lesson/intro?${params.toString()}`);
}

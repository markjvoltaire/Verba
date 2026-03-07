import { apiClient } from './client';

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ConversationResponse {
  aiMessage: string;
  feedback?: string | null;
  transcription?: string | null;
}

export async function getOpeningMessage(scenario: string, language: string): Promise<{ aiMessage: string }> {
  return apiClient.get<{ aiMessage: string }>(
    `/conversation/opening?scenario=${encodeURIComponent(scenario)}&language=${encodeURIComponent(language)}`
  );
}

export async function sendMessage(
  scenario: string,
  messages: ConversationMessage[],
  userAudio?: string,
  language?: string
): Promise<ConversationResponse> {
  return apiClient.post<ConversationResponse>('/conversation', {
    scenario,
    messages,
    userAudio,
    language,
  });
}

import { apiClient } from './client';

export interface SpeechEvaluateResponse {
  transcription: string;
  expectedPhrase: string;
  feedback: string;
  score: number;
}

export async function evaluateSpeech(audioBase64: string, expectedPhrase: string): Promise<SpeechEvaluateResponse> {
  return apiClient.post<SpeechEvaluateResponse>('/speech-evaluate', {
    audio: audioBase64,
    expectedPhrase,
  });
}

import { apiClient } from './client';

export interface ProgressData {
  todayUsageSeconds: number;
  todayPhraseCount: number;
  dailyGoal: number;
  streak: number;
  practiceDates: string[];
}

export async function logProgress(
  revenueCatUserId: string,
  usageSeconds: number,
  phraseCount: number
): Promise<void> {
  try {
    await apiClient.post('/progress', {
      revenue_cat_user_id: revenueCatUserId,
      usage_seconds: usageSeconds,
      phrase_count: phraseCount,
    });
  } catch (err) {
    console.warn('Failed to log progress:', err);
  }
}

export async function getProgressFromBackend(
  revenueCatUserId: string
): Promise<ProgressData | null> {
  try {
    const data = await apiClient.get<ProgressData>(
      `/progress?revenue_cat_user_id=${encodeURIComponent(revenueCatUserId)}`
    );
    return data;
  } catch {
    return null;
  }
}

import { apiClient } from './client';
import type { OnboardingProfile } from '../context/AppContext';

export async function syncUserToBackend(
  revenueCatUserId: string,
  profile: OnboardingProfile
): Promise<void> {
  try {
    await apiClient.post('/users', {
      revenue_cat_user_id: revenueCatUserId,
      name: profile.name,
      learning_language: profile.learningLanguage,
      language_level: profile.languageLevel,
      motivation: profile.motivation,
      native_language: profile.nativeLanguage,
      age_range: profile.ageRange,
      learning_speed: profile.learningSpeed ?? null,
    });
  } catch (err) {
    // Log but don't block onboarding - sync is best-effort
    console.warn('Failed to sync user to backend:', err);
  }
}

export async function updatePlanToPro(revenueCatUserId: string): Promise<void> {
  try {
    await apiClient.post('/users/plan', {
      revenue_cat_user_id: revenueCatUserId,
    });
  } catch (err) {
    console.warn('Failed to update plan to pro:', err);
  }
}

export async function getPlanFromBackend(
  revenueCatUserId: string
): Promise<'free' | 'pro'> {
  try {
    const res = await apiClient.get<{ plan: string }>(
      `/users/plan?revenue_cat_user_id=${encodeURIComponent(revenueCatUserId)}`
    );
    return res.plan === 'pro' ? 'pro' : 'free';
  } catch {
    return 'free';
  }
}

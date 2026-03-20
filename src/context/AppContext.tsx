import React, { createContext, useContext, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGE_KEY = '@verba_language';
const ONBOARDING_KEY = '@verba_onboarding_done';
const ONBOARDING_PROFILE_KEY = '@verba_onboarding_profile';
const USER_ID_KEY = '@verba_user_id';
const USER_EMAIL_KEY = '@verba_user_email';
const AI_DATA_CONSENT_KEY = '@verba_ai_data_consent_v1';

/** Bump when disclosure copy changes so you can re-prompt if needed. */
export const AI_DATA_CONSENT_VERSION = '1';

export type Language = 'es' | 'fr' | 'it' | 'en';

export type LanguageLevel = 'beginner' | 'intermediate' | 'advanced';

export type AgeRange = 'under_20' | '20s' | '30s' | '40s' | '50s' | '60_plus';

export type LearningSpeed = 'relaxed' | 'moderate' | 'fast';

export interface OnboardingProfile {
  name: string;
  learningLanguage: Language;
  languageLevel: LanguageLevel;
  motivation: string;
  nativeLanguage: Language;
  ageRange: AgeRange;
  learningSpeed?: LearningSpeed;
}

interface AppContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  hasCompletedOnboarding: boolean;
  setHasCompletedOnboarding: (done: boolean) => void;
  onboardingProfile: OnboardingProfile | null;
  setOnboardingProfile: (profile: OnboardingProfile) => Promise<void>;
  setNativeLanguage: (lang: Language) => Promise<void>;
  setLanguageLevel: (level: LanguageLevel) => Promise<void>;
  loadStoredData: () => Promise<void>;
  user: string | null;
  userChecked: boolean;
  userEmail: string | null;
  setUserEmail: (email: string | null) => Promise<void>;
  /** User agreed to share personal data with third-party AI (e.g. OpenAI) for app features. */
  hasAiDataConsent: boolean;
  setAiDataConsent: (accepted: boolean) => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('es');
  const [hasCompletedOnboarding, setHasCompletedOnboardingState] = useState(false);
  const [onboardingProfile, setOnboardingProfileState] = useState<OnboardingProfile | null>(null);
  const [user, setUserState] = useState<string | null>(null);
  const [userEmail, setUserEmailState] = useState<string | null>(null);
  const [hasAiDataConsent, setHasAiDataConsentState] = useState(false);
  const [userChecked, setUserChecked] = useState(false);

  const setAiDataConsent = useCallback(async (accepted: boolean) => {
    setHasAiDataConsentState(accepted);
    if (accepted) {
      await AsyncStorage.setItem(AI_DATA_CONSENT_KEY, AI_DATA_CONSENT_VERSION);
    } else {
      await AsyncStorage.removeItem(AI_DATA_CONSENT_KEY);
    }
  }, []);

  const setUserEmail = useCallback(async (email: string | null) => {
    setUserEmailState(email);
    if (email) {
      await AsyncStorage.setItem(USER_EMAIL_KEY, email);
    } else {
      await AsyncStorage.removeItem(USER_EMAIL_KEY);
    }
  }, []);

  const setOnboardingProfile = useCallback(async (profile: OnboardingProfile) => {
    setOnboardingProfileState(profile);
    await AsyncStorage.setItem(ONBOARDING_PROFILE_KEY, JSON.stringify(profile));
  }, []);

  const setNativeLanguage = useCallback(async (lang: Language) => {
    const prev = onboardingProfile;
    if (!prev) return;
    const next = { ...prev, nativeLanguage: lang };
    setOnboardingProfileState(next);
    await AsyncStorage.setItem(ONBOARDING_PROFILE_KEY, JSON.stringify(next));
  }, [onboardingProfile]);

  const setLanguageLevel = useCallback(async (level: LanguageLevel) => {
    const prev = onboardingProfile;
    if (!prev) return;
    const next = { ...prev, languageLevel: level };
    setOnboardingProfileState(next);
    await AsyncStorage.setItem(ONBOARDING_PROFILE_KEY, JSON.stringify(next));
  }, [onboardingProfile]);

  const setLanguage = useCallback(async (lang: Language) => {
    setLanguageState(lang);
    await AsyncStorage.setItem(LANGUAGE_KEY, lang);
  }, []);

  const setHasCompletedOnboarding = useCallback(async (done: boolean) => {
    setHasCompletedOnboardingState(done);
    await AsyncStorage.setItem(ONBOARDING_KEY, done ? '1' : '0');
  }, []);

  const loadStoredData = useCallback(async () => {
    try {
      const [storedLang, storedOnboarding, storedProfile, storedUserId, storedEmail, storedAiConsent] =
        await Promise.all([
        AsyncStorage.getItem(LANGUAGE_KEY),
        AsyncStorage.getItem(ONBOARDING_KEY),
        AsyncStorage.getItem(ONBOARDING_PROFILE_KEY),
        AsyncStorage.getItem(USER_ID_KEY),
        AsyncStorage.getItem(USER_EMAIL_KEY),
        AsyncStorage.getItem(AI_DATA_CONSENT_KEY),
      ]);
      if (storedLang && ['es', 'fr', 'it', 'en'].includes(storedLang)) {
        setLanguageState(storedLang as Language);
      }
      if (storedProfile) {
        try {
          const profile = JSON.parse(storedProfile) as OnboardingProfile;
          setOnboardingProfileState(profile);
          setHasCompletedOnboardingState(true);
        } catch {
          setHasCompletedOnboardingState(false);
        }
      } else {
        setHasCompletedOnboardingState(false);
      }
      setUserState(storedUserId);
      setUserEmailState(storedEmail);
      setHasAiDataConsentState(storedAiConsent === AI_DATA_CONSENT_VERSION);
    } catch {
      // ignore
    } finally {
      setUserChecked(true);
    }
  }, []);

  return (
    <AppContext.Provider
      value={{
        language,
        setLanguage,
        hasCompletedOnboarding,
        setHasCompletedOnboarding,
        onboardingProfile,
        setOnboardingProfile,
        setNativeLanguage,
        setLanguageLevel,
        loadStoredData,
        user,
        userChecked,
        userEmail,
        setUserEmail,
        hasAiDataConsent,
        setAiDataConsent,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

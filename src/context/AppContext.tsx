import React, { createContext, useContext, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGE_KEY = '@verba_language';
const ONBOARDING_KEY = '@verba_onboarding_done';
const ONBOARDING_PROFILE_KEY = '@verba_onboarding_profile';
const USER_ID_KEY = '@verba_user_id';

export type Language = 'es' | 'fr' | 'it' | 'en';

export type LanguageLevel = 'beginner' | 'intermediate' | 'advanced';

export type Gender = 'male' | 'female' | 'non_binary' | 'prefer_not_to_say';

export type AgeRange = 'under_20' | '20s' | '30s' | '40s' | '50s' | '60_plus';

export interface OnboardingProfile {
  name: string;
  learningLanguage: Language;
  languageLevel: LanguageLevel;
  motivation: string;
  nativeLanguage: Language;
  gender: Gender;
  ageRange: AgeRange;
}

interface AppContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  hasCompletedOnboarding: boolean;
  setHasCompletedOnboarding: (done: boolean) => void;
  onboardingProfile: OnboardingProfile | null;
  setOnboardingProfile: (profile: OnboardingProfile) => Promise<void>;
  loadStoredData: () => Promise<void>;
  user: string | null;
  userChecked: boolean;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('es');
  const [hasCompletedOnboarding, setHasCompletedOnboardingState] = useState(false);
  const [onboardingProfile, setOnboardingProfileState] = useState<OnboardingProfile | null>(null);
  const [user, setUserState] = useState<string | null>(null);
  const [userChecked, setUserChecked] = useState(false);

  const setOnboardingProfile = useCallback(async (profile: OnboardingProfile) => {
    setOnboardingProfileState(profile);
    await AsyncStorage.setItem(ONBOARDING_PROFILE_KEY, JSON.stringify(profile));
  }, []);

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
      const [storedLang, storedOnboarding, storedProfile, storedUserId] = await Promise.all([
        AsyncStorage.getItem(LANGUAGE_KEY),
        AsyncStorage.getItem(ONBOARDING_KEY),
        AsyncStorage.getItem(ONBOARDING_PROFILE_KEY),
        AsyncStorage.getItem(USER_ID_KEY),
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
        loadStoredData,
        user,
        userChecked,
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

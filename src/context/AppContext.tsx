import React, { createContext, useContext, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGE_KEY = '@verba_language';
const ONBOARDING_KEY = '@verba_onboarding_done';

type Language = 'es' | 'fr' | 'it' | 'en';

interface AppContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  hasCompletedOnboarding: boolean;
  setHasCompletedOnboarding: (done: boolean) => void;
  loadStoredData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('es');
  const [hasCompletedOnboarding, setHasCompletedOnboardingState] = useState(false);

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
      const [storedLang, storedOnboarding] = await Promise.all([
        AsyncStorage.getItem(LANGUAGE_KEY),
        AsyncStorage.getItem(ONBOARDING_KEY),
      ]);
      if (storedLang && ['es', 'fr', 'it', 'en'].includes(storedLang)) {
        setLanguageState(storedLang as Language);
      }
      setHasCompletedOnboardingState(storedOnboarding === '1');
    } catch {
      // ignore
    }
  }, []);

  return (
    <AppContext.Provider
      value={{
        language,
        setLanguage,
        hasCompletedOnboarding,
        setHasCompletedOnboarding,
        loadStoredData,
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

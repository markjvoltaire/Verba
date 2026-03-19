import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@verba_lesson_progress';

interface LessonProgressContextType {
  completedByScenario: Record<string, Record<string, boolean>>;
  getCompletedCount: (scenario: string) => number;
  recordPhraseCompleted: (scenario: string, phraseId: string) => Promise<void>;
  loadProgress: () => Promise<void>;
}

const LessonProgressContext = createContext<LessonProgressContextType | null>(null);

export function LessonProgressProvider({ children }: { children: React.ReactNode }) {
  const [completedByScenario, setCompletedByScenario] = useState<
    Record<string, Record<string, boolean>>
  >({});

  const loadProgress = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, Record<string, boolean>>;
        setCompletedByScenario(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  const getCompletedCount = useCallback(
    (scenario: string) => {
      const scenarioData = completedByScenario[scenario];
      if (!scenarioData) return 0;
      return Object.keys(scenarioData).filter(Boolean).length;
    },
    [completedByScenario]
  );

  const recordPhraseCompleted = useCallback(
    async (scenario: string, phraseId: string) => {
      if (!scenario || !phraseId) return;
      let next: Record<string, Record<string, boolean>> = {};
      setCompletedByScenario((prev) => {
        next = { ...prev };
        next[scenario] = { ...(next[scenario] || {}), [phraseId]: true };
        return next;
      });
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
    },
    []
  );

  return (
    <LessonProgressContext.Provider
      value={{
        completedByScenario,
        getCompletedCount,
        recordPhraseCompleted,
        loadProgress,
      }}
    >
      {children}
    </LessonProgressContext.Provider>
  );
}

export function useLessonProgress() {
  const ctx = useContext(LessonProgressContext);
  if (!ctx) throw new Error('useLessonProgress must be used within LessonProgressProvider');
  return ctx;
}

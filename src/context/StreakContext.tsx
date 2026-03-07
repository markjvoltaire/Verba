import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STREAK_KEY = '@verba_streak';
const DAILY_COUNT_KEY = '@verba_daily_count';
const DAILY_DATE_KEY = '@verba_daily_date';

interface StreakData {
  currentStreak: number;
  lastPracticeDate: string | null;
}

interface StreakContextType {
  streak: number;
  todayPhraseCount: number;
  dailyGoal: number;
  recordPhrasePractice: () => Promise<void>;
  loadStreakData: () => Promise<void>;
}

const StreakContext = createContext<StreakContextType | null>(null);

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayString() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function StreakProvider({ children }: { children: React.ReactNode }) {
  const [streak, setStreak] = useState(0);
  const [todayPhraseCount, setTodayPhraseCount] = useState(0);
  const dailyGoal = 5;

  const loadStreakData = useCallback(async () => {
    try {
      const [streakJson, countStr, dateStr] = await Promise.all([
        AsyncStorage.getItem(STREAK_KEY),
        AsyncStorage.getItem(DAILY_COUNT_KEY),
        AsyncStorage.getItem(DAILY_DATE_KEY),
      ]);
      if (streakJson) {
        const data: StreakData = JSON.parse(streakJson);
        setStreak(data.currentStreak);
      }
      const today = todayString();
      if (dateStr === today && countStr) {
        setTodayPhraseCount(parseInt(countStr, 10) || 0);
      } else {
        setTodayPhraseCount(0);
      }
    } catch {
      // ignore
    }
  }, []);

  const recordPhrasePractice = useCallback(async () => {
    const today = todayString();
    const yesterday = yesterdayString();

    const [streakJson] = await Promise.all([
      AsyncStorage.getItem(STREAK_KEY),
      AsyncStorage.getItem(DAILY_COUNT_KEY),
      AsyncStorage.getItem(DAILY_DATE_KEY),
    ]);

    let newStreak = 0;
    let lastDate: string | null = null;
    if (streakJson) {
      const data: StreakData = JSON.parse(streakJson);
      newStreak = data.currentStreak;
      lastDate = data.lastPracticeDate;
    }

    if (lastDate === today) {
      // Already practiced today, streak unchanged
    } else if (lastDate === yesterday) {
      newStreak += 1;
    } else if (lastDate === null || lastDate < yesterday) {
      newStreak = 1;
    }
    lastDate = today;

    const storedDate = await AsyncStorage.getItem(DAILY_DATE_KEY);
    const storedCount = parseInt((await AsyncStorage.getItem(DAILY_COUNT_KEY)) || '0', 10);
    const newCount = storedDate === today ? storedCount + 1 : 1;

    await Promise.all([
      AsyncStorage.setItem(STREAK_KEY, JSON.stringify({ currentStreak: newStreak, lastPracticeDate: lastDate })),
      AsyncStorage.setItem(DAILY_COUNT_KEY, String(newCount)),
      AsyncStorage.setItem(DAILY_DATE_KEY, today),
    ]);

    setStreak(newStreak);
    setTodayPhraseCount(newCount);
  }, []);

  useEffect(() => {
    loadStreakData();
  }, [loadStreakData]);

  return (
    <StreakContext.Provider
      value={{
        streak,
        todayPhraseCount,
        dailyGoal,
        recordPhrasePractice,
        loadStreakData,
      }}
    >
      {children}
    </StreakContext.Provider>
  );
}

export function useStreak() {
  const ctx = useContext(StreakContext);
  if (!ctx) throw new Error('useStreak must be used within StreakProvider');
  return ctx;
}

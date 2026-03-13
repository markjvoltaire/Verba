import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Purchases from 'react-native-purchases';
import { logProgress } from '../api/progress';
import { useUserId } from './UserContext';

const STREAK_KEY = '@verba_streak';
const DAILY_COUNT_KEY = '@verba_daily_count';
const DAILY_DATE_KEY = '@verba_daily_date';
const PRACTICE_DATES_KEY = '@verba_practice_dates';
const MAX_PRACTICE_DATES = 365;

interface StreakData {
  currentStreak: number;
  lastPracticeDate: string | null;
}

interface StreakContextType {
  streak: number;
  todayPhraseCount: number;
  dailyGoal: number;
  practiceDates: string[];
  recordPhrasePractice: () => Promise<void>;
  recordPhrasesPracticed: (count: number) => Promise<void>;
  recordPracticeDate: () => Promise<void>;
  loadStreakData: () => Promise<void>;
  clearStats: () => Promise<void>;
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
  const [practiceDates, setPracticeDates] = useState<string[]>([]);
  const dailyGoal = 5;
  const { userId: revenueCatUserId } = useUserId();

  const loadStreakData = useCallback(async () => {
    try {
      const [streakJson, countStr, dateStr, datesJson] = await Promise.all([
        AsyncStorage.getItem(STREAK_KEY),
        AsyncStorage.getItem(DAILY_COUNT_KEY),
        AsyncStorage.getItem(DAILY_DATE_KEY),
        AsyncStorage.getItem(PRACTICE_DATES_KEY),
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
      if (datesJson) {
        try {
          const dates: string[] = JSON.parse(datesJson);
          setPracticeDates(Array.isArray(dates) ? dates : []);
        } catch {
          setPracticeDates([]);
        }
      } else {
        setPracticeDates([]);
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

    const datesJson = await AsyncStorage.getItem(PRACTICE_DATES_KEY);
    const dates: string[] = datesJson ? JSON.parse(datesJson) : [];
    const datesToStore =
      Array.isArray(dates) && !dates.includes(today)
        ? [...dates, today].sort().slice(-MAX_PRACTICE_DATES)
        : null;

    await Promise.all([
      AsyncStorage.setItem(STREAK_KEY, JSON.stringify({ currentStreak: newStreak, lastPracticeDate: lastDate })),
      AsyncStorage.setItem(DAILY_COUNT_KEY, String(newCount)),
      AsyncStorage.setItem(DAILY_DATE_KEY, today),
      ...(datesToStore ? [AsyncStorage.setItem(PRACTICE_DATES_KEY, JSON.stringify(datesToStore))] : []),
    ]);

    setStreak(newStreak);
    setTodayPhraseCount(newCount);
    if (datesToStore) setPracticeDates(datesToStore);
    const rcUserId = revenueCatUserId ?? (await Purchases.getAppUserID().catch(() => null));
    if (rcUserId) {
      logProgress(rcUserId, 0, 1);
    }
  }, [revenueCatUserId]);

  const recordPhrasesPracticed = useCallback(async (count: number) => {
    if (count <= 0) return;
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
    const newCount = storedDate === today ? storedCount + count : count;

    const datesJson = await AsyncStorage.getItem(PRACTICE_DATES_KEY);
    const dates: string[] = datesJson ? JSON.parse(datesJson) : [];
    const datesToStore =
      Array.isArray(dates) && !dates.includes(today)
        ? [...dates, today].sort().slice(-MAX_PRACTICE_DATES)
        : null;

    await Promise.all([
      AsyncStorage.setItem(STREAK_KEY, JSON.stringify({ currentStreak: newStreak, lastPracticeDate: lastDate })),
      AsyncStorage.setItem(DAILY_COUNT_KEY, String(newCount)),
      AsyncStorage.setItem(DAILY_DATE_KEY, today),
      ...(datesToStore ? [AsyncStorage.setItem(PRACTICE_DATES_KEY, JSON.stringify(datesToStore))] : []),
    ]);

    setStreak(newStreak);
    setTodayPhraseCount(newCount);
    if (datesToStore) setPracticeDates(datesToStore);
    const rcUserId = revenueCatUserId ?? (await Purchases.getAppUserID().catch(() => null));
    if (rcUserId && count > 0) {
      logProgress(rcUserId, 0, count);
    }
  }, [revenueCatUserId]);

  const recordPracticeDate = useCallback(async () => {
    const today = todayString();
    try {
      const datesJson = await AsyncStorage.getItem(PRACTICE_DATES_KEY);
      const dates: string[] = datesJson ? JSON.parse(datesJson) : [];
      if (!Array.isArray(dates)) return;
      if (dates.includes(today)) return;
      const updated = [...dates, today].sort().slice(-MAX_PRACTICE_DATES);
      await AsyncStorage.setItem(PRACTICE_DATES_KEY, JSON.stringify(updated));
      setPracticeDates(updated);
    } catch {
      // ignore
    }
  }, []);

  const clearStats = useCallback(async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(STREAK_KEY),
        AsyncStorage.removeItem(DAILY_COUNT_KEY),
        AsyncStorage.removeItem(DAILY_DATE_KEY),
        AsyncStorage.removeItem(PRACTICE_DATES_KEY),
      ]);
      setStreak(0);
      setTodayPhraseCount(0);
      setPracticeDates([]);
    } catch {
      // ignore
    }
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
        practiceDates,
        recordPhrasePractice,
        recordPhrasesPracticed,
        recordPracticeDate,
        loadStreakData,
        clearStats,
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

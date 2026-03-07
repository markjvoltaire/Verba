import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const USAGE_KEY = '@verba_usage_seconds';
const USAGE_DATE_KEY = '@verba_usage_date';
const PLAN_KEY = '@verba_plan';

const FREE_DAILY_LIMIT_SECONDS = 180; // 3 minutes

interface UsageContextType {
  plan: 'free' | 'pro';
  todayUsageSeconds: number;
  freeLimitSeconds: number;
  canPractice: boolean;
  recordUsage: (seconds: number) => Promise<void>;
  loadUsageData: () => Promise<void>;
}

const UsageContext = createContext<UsageContextType | null>(null);

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export function UsageProvider({ children }: { children: React.ReactNode }) {
  const [plan, setPlan] = useState<'free' | 'pro'>('free');
  const [todayUsageSeconds, setTodayUsageSeconds] = useState(0);

  const loadUsageData = useCallback(async () => {
    try {
      const [storedPlan, storedDate, storedSeconds] = await Promise.all([
        AsyncStorage.getItem(PLAN_KEY),
        AsyncStorage.getItem(USAGE_DATE_KEY),
        AsyncStorage.getItem(USAGE_KEY),
      ]);
      if (storedPlan === 'pro') setPlan('pro');
      const today = todayString();
      if (storedDate === today && storedSeconds) {
        setTodayUsageSeconds(parseInt(storedSeconds, 10) || 0);
      } else {
        setTodayUsageSeconds(0);
      }
    } catch {
      // ignore
    }
  }, []);

  const recordUsage = useCallback(async (seconds: number) => {
    const today = todayString();
    const [storedDate, storedSeconds] = await Promise.all([
      AsyncStorage.getItem(USAGE_DATE_KEY),
      AsyncStorage.getItem(USAGE_KEY),
    ]);
    const current = storedDate === today ? parseInt(storedSeconds || '0', 10) : 0;
    const newTotal = current + seconds;
    await Promise.all([
      AsyncStorage.setItem(USAGE_DATE_KEY, today),
      AsyncStorage.setItem(USAGE_KEY, String(newTotal)),
    ]);
    setTodayUsageSeconds(newTotal);
  }, []);

  const canPractice = plan === 'pro' || todayUsageSeconds < FREE_DAILY_LIMIT_SECONDS;

  useEffect(() => {
    loadUsageData();
  }, [loadUsageData]);

  return (
    <UsageContext.Provider
      value={{
        plan,
        todayUsageSeconds,
        freeLimitSeconds: FREE_DAILY_LIMIT_SECONDS,
        canPractice,
        recordUsage,
        loadUsageData,
      }}
    >
      {children}
    </UsageContext.Provider>
  );
}

export function useUsage() {
  const ctx = useContext(UsageContext);
  if (!ctx) throw new Error('useUsage must be used within UsageProvider');
  return ctx;
}

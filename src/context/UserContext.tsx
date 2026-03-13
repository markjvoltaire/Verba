import React, { createContext, useContext, useEffect, useState } from 'react';
import Constants from 'expo-constants';
import Purchases from 'react-native-purchases';

interface UserContextType {
  userId: string | null;
  isLoading: boolean;
}

const UserContext = createContext<UserContextType | null>(null);

const REVENUECAT_API_KEY =
  Constants.expoConfig?.extra?.revenueCatApiKeyTest ||
  process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_TEST ||
  '';

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const isExpoGo = Constants.appOwnership === 'expo';
        if (!REVENUECAT_API_KEY || isExpoGo) {
          setUserId(null);
          return;
        }
        await Purchases.setLogLevel(Purchases.LOG_LEVEL.ERROR);
        Purchases.configure({ apiKey: REVENUECAT_API_KEY });
        const id = await Purchases.getAppUserID();
        setUserId(id);
        console.log(id);
      } catch {
        setUserId(null);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  return (
    <UserContext.Provider value={{ userId, isLoading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUserId() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUserId must be used within UserProvider');
  return ctx;
}

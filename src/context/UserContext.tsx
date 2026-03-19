import React, { createContext, useContext, useEffect, useState } from 'react';
import Constants from 'expo-constants';
import Purchases from 'react-native-purchases';

interface UserContextType {
  userId: string | null;
  isLoading: boolean;
  isPro: boolean;
}

const UserContext = createContext<UserContextType | null>(null);

const IS_DEV = false; // Force production key locally — revert before shipping

const REVENUECAT_API_KEY = IS_DEV
  ? (Constants.expoConfig?.extra?.revenueCatApiKeyTest ||
     process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_TEST ||
     '')
  : (Constants.expoConfig?.extra?.revenueCatApiKey ||
     process.env.REVENUECAT_API_KEY ||
     '');

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    const listener = Purchases.addCustomerInfoUpdateListener((info) => {
      const hasPro = typeof info.entitlements?.active?.['pro'] !== 'undefined';
      setIsPro(hasPro);
      console.log('[RevenueCat] Customer info updated — isPro:', hasPro);
    });
    return () => listener.remove();
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const isExpoGo = Constants.appOwnership === 'expo';
        if (isExpoGo) {
          setUserId(null);
          return;
        }
        if (!REVENUECAT_API_KEY) {
          setUserId(null);
          return;
        }
        await Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
        Purchases.configure({ apiKey: REVENUECAT_API_KEY });
        console.log('[RevenueCat] Using key:', REVENUECAT_API_KEY.slice(0, 10) + '...');
        console.log('[RevenueCat] IS_DEV:', IS_DEV);
        const id = await Purchases.getAppUserID();
        setUserId(id);
        try {
          const customerInfo = await Purchases.getCustomerInfo();
          const hasPro = typeof customerInfo.entitlements?.active?.['pro'] !== 'undefined';
          setIsPro(hasPro);
          console.log('[RevenueCat] User ID:', id);
          console.log('[RevenueCat] Is Pro:', hasPro);
          console.log('[RevenueCat] Active entitlements:', Object.keys(customerInfo.entitlements?.active ?? {}));
          console.log('[RevenueCat] Active subscriptions:', customerInfo.activeSubscriptions);
        } catch (custErr) {
          console.log('[RevenueCat] Error fetching customer info:', custErr);
        }
        try {
          const offerings = await Purchases.getOfferings();
          console.log('[RevenueCat] Current offering:', offerings.current?.identifier ?? 'NONE');
          console.log('[RevenueCat] Packages:', offerings.current?.availablePackages.map(p => ({
            id: p.identifier,
            product: p.product.identifier,
            price: p.product.priceString,
          })));
        } catch (offerErr) {
          console.log('[RevenueCat] Error fetching offerings:', offerErr);
        }
      } catch (e) {
        setUserId(null);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  return (
    <UserContext.Provider value={{ userId, isLoading, isPro }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUserId() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUserId must be used within UserProvider');
  return ctx;
}

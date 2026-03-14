import { useCallback } from "react";

export type PaywallCheckResult =
  | { granted: true; justPurchased: boolean }
  | { granted: false; error?: boolean };

export function usePaywallCheck() {
  const requireProAccess = useCallback(async (): Promise<PaywallCheckResult> => {
    return { granted: true, justPurchased: false };
  }, []);

  return { requireProAccess, isChecking: false };
}

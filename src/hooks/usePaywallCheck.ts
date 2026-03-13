import { useState, useCallback } from "react";
import Constants from "expo-constants";
import Purchases from "react-native-purchases";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";
import { PRO_ENTITLEMENT_ID } from "../navigation/paywallNavigation";
import { getPlanFromBackend } from "../api/users";
import { useUserId } from "../context/UserContext";

export type PaywallCheckResult =
  | { granted: true; justPurchased: boolean }
  | { granted: false; error?: boolean };

export function usePaywallCheck() {
  const [isChecking, setIsChecking] = useState(false);
  const { userId: revenueCatUserId } = useUserId();

  const requireProAccess = useCallback(async (): Promise<PaywallCheckResult> => {
    if (Constants.appOwnership === "expo") {
      return { granted: true, justPurchased: false };
    }

    setIsChecking(true);
    try {
      const rcUserId =
        revenueCatUserId ?? (await Purchases.getAppUserID().catch(() => null));
      if (rcUserId) {
        const plan = await getPlanFromBackend(rcUserId);
        if (plan === "pro") {
          return { granted: true, justPurchased: false };
        }
      }

      const result = await RevenueCatUI.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: PRO_ENTITLEMENT_ID,
      });

      const hasAccess =
        result === PAYWALL_RESULT.NOT_PRESENTED ||
        result === PAYWALL_RESULT.PURCHASED ||
        result === PAYWALL_RESULT.RESTORED;

      if (hasAccess) {
        const justPurchased =
          result === PAYWALL_RESULT.PURCHASED ||
          result === PAYWALL_RESULT.RESTORED;
        return { granted: true, justPurchased };
      }
      return { granted: false };
    } catch {
      return { granted: false, error: true };
    } finally {
      setIsChecking(false);
    }
  }, [revenueCatUserId]);

  return { requireProAccess, isChecking };
}

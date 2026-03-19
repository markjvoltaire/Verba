import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import Purchases, {
  type PurchasesPackage,
  type PurchasesOffering,
  PACKAGE_TYPE,
} from "react-native-purchases";
import { PRO_ENTITLEMENT_ID } from "../navigation/paywallNavigation";

const PACKAGE_LABELS: Record<string, string> = {
  [PACKAGE_TYPE.MONTHLY]: "Monthly",
  [PACKAGE_TYPE.ANNUAL]: "Annual",
  [PACKAGE_TYPE.SIX_MONTH]: "6 Months",
  [PACKAGE_TYPE.THREE_MONTH]: "3 Months",
  [PACKAGE_TYPE.TWO_MONTH]: "2 Months",
  [PACKAGE_TYPE.WEEKLY]: "Weekly",
  [PACKAGE_TYPE.LIFETIME]: "Lifetime",
  [PACKAGE_TYPE.CUSTOM]: "Pro",
  [PACKAGE_TYPE.UNKNOWN]: "Pro",
};

function getPackageLabel(pkg: PurchasesPackage): string {
  return PACKAGE_LABELS[pkg.packageType] ?? pkg.identifier;
}

export interface CustomPaywallProps {
  onDismiss: () => void;
  onPurchaseCompleted?: () => void;
}

export default function CustomPaywall({
  onDismiss,
  onPurchaseCompleted,
}: CustomPaywallProps) {
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchOfferings = async () => {
      try {
        setError(null);
        const offerings = await Purchases.getOfferings();
        if (!cancelled && offerings.current) {
          setOffering(offerings.current);
        } else if (!cancelled && !offerings.current) {
          setError(
            "No offerings available. Configure your products in the RevenueCat dashboard.",
          );
        }
      } catch (e) {
        if (!cancelled) {
          const rawMsg =
            e instanceof Error ? e.message : "Failed to load products";
          const isConfigError =
            rawMsg.includes("singleton instance") ||
            rawMsg.includes("configure");
          const msg = isConfigError
            ? "Subscription options will be available in the full app. You can continue to explore Verba for now."
            : rawMsg;
          setError(msg);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    fetchOfferings();
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePurchase = async (pkg: PurchasesPackage) => {
    try {
      setPurchasingId(pkg.identifier);
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const hasPro =
        typeof customerInfo.entitlements?.active?.[PRO_ENTITLEMENT_ID] !==
        "undefined";
      if (hasPro) {
        onPurchaseCompleted?.();
        onDismiss();
      }
    } catch (e: unknown) {
      const err = e as { userCancelled?: boolean };
      if (err?.userCancelled) return;

      // StoreKit 2 can throw STORE_PROBLEM while the transaction still
      // completes in the background. Re-check entitlements before alerting.
      try {
        await new Promise((r) => setTimeout(r, 1500));
        const info = await Purchases.getCustomerInfo();
        const hasPro =
          typeof info.entitlements?.active?.[PRO_ENTITLEMENT_ID] !==
          "undefined";
        if (hasPro) {
          onPurchaseCompleted?.();
          onDismiss();
          return;
        }
      } catch {
        // fall through to the alert
      }

      Alert.alert(
        "Purchase Failed",
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again.",
        [{ text: "OK" }],
      );
    } finally {
      setPurchasingId(null);
    }
  };

  const handleRestore = async () => {
    try {
      setRestoring(true);
      const customerInfo = await Purchases.restorePurchases();
      const hasPro =
        typeof customerInfo.entitlements?.active?.[PRO_ENTITLEMENT_ID] !==
        "undefined";
      if (hasPro) {
        onPurchaseCompleted?.();
        onDismiss();
      } else {
        Alert.alert(
          "No Purchases Found",
          "We couldn't find any previous purchases to restore.",
          [{ text: "OK" }],
        );
      }
    } catch (e) {
      Alert.alert(
        "Restore Failed",
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again.",
        [{ text: "OK" }],
      );
    } finally {
      setRestoring(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#29B6F6" style={styles.loader} />
        <Text style={styles.loadingText}>Loading plans...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>Unlock Pro</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.fallbackHint}>
            You can continue without subscribing and upgrade later.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={onDismiss}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Continue</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  const packages = offering?.availablePackages ?? [];

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onDismiss}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Unlock Verba Pro</Text>
        <Text style={styles.subtitle}>
          Get unlimited practice, personalized lessons, and track your progress.
        </Text>

        {packages.length > 0 ? (
          <View style={styles.packages}>
            {packages.map((pkg) => {
              const label = getPackageLabel(pkg);
              const isPurchasing = purchasingId === pkg.identifier;
              const isAnnual = pkg.packageType === PACKAGE_TYPE.ANNUAL;
              return (
                <TouchableOpacity
                  key={pkg.identifier}
                  style={[
                    styles.packageCard,
                    isAnnual && styles.packageCardFeatured,
                  ]}
                  onPress={() => handlePurchase(pkg)}
                  disabled={isPurchasing || restoring}
                  activeOpacity={0.8}
                >
                  {isAnnual && <Text style={styles.bestValue}>Best Value</Text>}
                  <Text style={styles.packageLabel}>{label}</Text>
                  <Text style={styles.packagePrice}>
                    {pkg.product.priceString}
                  </Text>
                  {pkg.product.introPrice && (
                    <Text style={styles.introPrice}>
                      Start with {pkg.product.introPrice.priceString}, then{" "}
                      {pkg.product.priceString}
                    </Text>
                  )}
                  {pkg.product.pricePerMonthString &&
                    pkg.packageType !== PACKAGE_TYPE.MONTHLY && (
                      <Text style={styles.perMonth}>
                        {pkg.product.pricePerMonthString}/month
                      </Text>
                    )}
                  <Text style={styles.purchaseButtonText}>
                    {isPurchasing ? "Processing..." : "Subscribe"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <Text style={styles.noPackages}>
            No plans available at the moment.
          </Text>
        )}

        <TouchableOpacity
          style={styles.restoreButton}
          onPress={handleRestore}
          disabled={restoring}
          activeOpacity={0.7}
        >
          <Text style={styles.restoreButtonText}>
            {restoring ? "Restoring..." : "Restore Purchases"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={onDismiss}
          activeOpacity={0.7}
        >
          <Text style={styles.skipButtonText}>
            Continue without subscribing
          </Text>
        </TouchableOpacity>

        <View style={styles.legalRow}>
          <TouchableOpacity
            onPress={() => Linking.openURL("https://verbatalk.carrd.co/")}
            activeOpacity={0.7}
          >
            <Text style={styles.legalLink}>Terms of Use</Text>
          </TouchableOpacity>
          <Text style={styles.legalDot}>·</Text>
          <TouchableOpacity
            onPress={() => Linking.openURL("https://verbatalk.carrd.co/")}
            activeOpacity={0.7}
          >
            <Text style={styles.legalLink}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    padding: 24,
    paddingTop: 52,
    paddingBottom: 40,
  },
  loader: {
    marginTop: 120,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#57534E",
    textAlign: "center",
  },
  closeButton: {
    position: "absolute",
    top: 52,
    right: 24,
    zIndex: 1,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: {
    fontSize: 18,
    color: "#1C1917",
    fontWeight: "600",
  },
  title: {
    fontFamily: "Georgia",
    fontSize: 28,
    fontWeight: "700",
    color: "#1C1917",
    marginBottom: 12,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: "#57534E",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 24,
  },
  packages: {
    gap: 12,
  },
  packageCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: "rgba(41, 182, 246, 0.2)",
    position: "relative",
  },
  packageCardFeatured: {
    borderColor: "#29B6F6",
    backgroundColor: "rgba(41, 182, 246, 0.06)",
  },
  bestValue: {
    position: "absolute",
    top: -10,
    right: 16,
    backgroundColor: "#29B6F6",
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: "hidden",
  },
  packageLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1C1917",
    marginBottom: 4,
  },
  packagePrice: {
    fontSize: 24,
    fontWeight: "700",
    color: "#29B6F6",
    marginBottom: 4,
  },
  introPrice: {
    fontSize: 14,
    color: "#57534E",
    marginBottom: 4,
  },
  perMonth: {
    fontSize: 14,
    color: "#78716C",
    marginBottom: 12,
  },
  purchaseButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#29B6F6",
  },
  restoreButton: {
    marginTop: 24,
    paddingVertical: 14,
    alignItems: "center",
  },
  restoreButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#57534E",
  },
  skipButton: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  skipButtonText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#94A3B8",
  },
  errorText: {
    fontSize: 16,
    color: "#57534E",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 24,
  },
  fallbackHint: {
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: "#29B6F6",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  noPackages: {
    fontSize: 16,
    color: "#57534E",
    textAlign: "center",
    marginBottom: 24,
  },
  legalRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
    gap: 8,
  },
  legalLink: {
    fontSize: 13,
    color: "#94A3B8",
    textDecorationLine: "underline",
  },
  legalDot: {
    fontSize: 13,
    color: "#94A3B8",
  },
});

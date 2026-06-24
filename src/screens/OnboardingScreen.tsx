import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  Keyboard,
  ScrollView,
} from "react-native";
import Purchases from "react-native-purchases";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../context/AppContext";
import type { Language, OnboardingProfile } from "../context/AppContext";
import { syncUserToBackend } from "../api/users";
import { useUserId } from "../context/UserContext";

const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: "es", label: "Spanish", flag: "🇪🇸" },
  { code: "fr", label: "French", flag: "🇫🇷" },
  { code: "it", label: "Italian", flag: "🇮🇹" },
  { code: "en", label: "English", flag: "🇺🇸" },
];

const STEPS = ["name", "native", "learning"] as const;
type Step = (typeof STEPS)[number];

const COLORS = {
  bg: "#FAFAFA",
  text: "#0A0A0A",
  textMuted: "rgba(0, 0, 0, 0.48)",
  border: "rgba(0, 0, 0, 0.08)",
  borderStrong: "rgba(0, 0, 0, 0.14)",
  cta: "#0B0B0B",
  selected: "#0A0A0A",
  selectedBg: "#F0F0F0",
};

const FONT =
  Platform.OS === "ios" ? "Helvetica Neue" : "sans-serif-medium";

const STEP_EASING = Easing.bezier(0.16, 1, 0.3, 1);
const EXIT_EASING = Easing.bezier(0.4, 0, 1, 1);
const STEP_EXIT_MS = 240;
const STEP_ENTER_MS = 420;
const STEP_SLIDE = 18;

function StepDots({ progress }: { progress: Animated.Value }) {
  return (
    <View style={styles.stepDots}>
      {STEPS.map((_, i) => {
        const fillOpacity = progress.interpolate({
          inputRange: [i - 0.35, i],
          outputRange: [0, 1],
          extrapolate: "clamp",
        });

        return (
          <View key={i} style={styles.stepDot}>
            <Animated.View
              style={[styles.stepDotFill, { opacity: fillOpacity }]}
            />
          </View>
        );
      })}
    </View>
  );
}

function LanguageOption({
  flag,
  label,
  selected,
  disabled,
  onPress,
}: {
  flag: string;
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.langOption,
        selected && styles.langOptionSelected,
        disabled && styles.langOptionDisabled,
        pressed && !disabled && styles.langOptionPressed,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.langFlag}>{flag}</Text>
      <Text
        style={[
          styles.langLabel,
          selected && styles.langLabelSelected,
          disabled && styles.langLabelDisabled,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function OnboardingScreen({ navigation }: { navigation: any }) {
  const insets = useSafeAreaInsets();
  const { userId: revenueCatUserId } = useUserId();
  const {
    setLanguage,
    setHasCompletedOnboarding,
    setOnboardingProfile,
    setAiDataConsent,
  } = useApp();

  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState("");
  const [nativeLanguage, setNativeLanguage] = useState<Language | null>(null);
  const [learningLanguage, setLearningLanguage] = useState<Language | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);

  const slideAnim = useRef(new Animated.Value(0.35)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const stepProgress = useRef(new Animated.Value(0)).current;
  const isAnimating = useRef(false);

  const step = STEPS[stepIndex];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 480,
        easing: STEP_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 480,
        easing: STEP_EASING,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const animateToStep = (nextIndex: number) => {
    if (isAnimating.current || nextIndex === stepIndex) return;

    isAnimating.current = true;
    const direction = nextIndex > stepIndex ? 1 : -1;

    if (step === "name") {
      Keyboard.dismiss();
    }

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: STEP_EXIT_MS,
        easing: EXIT_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -direction,
        duration: STEP_EXIT_MS,
        easing: EXIT_EASING,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setStepIndex(nextIndex);
      slideAnim.setValue(direction);
      fadeAnim.setValue(0);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: STEP_ENTER_MS,
          easing: STEP_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: STEP_ENTER_MS,
          easing: STEP_EASING,
          useNativeDriver: true,
        }),
      ]).start(() => {
        isAnimating.current = false;
      });

      Animated.timing(stepProgress, {
        toValue: nextIndex,
        duration: STEP_ENTER_MS,
        easing: STEP_EASING,
        useNativeDriver: false,
      }).start();
    });
  };

  const canContinue = () => {
    if (step === "name") return name.trim().length > 0;
    if (step === "native") return nativeLanguage !== null;
    if (step === "learning") {
      return (
        learningLanguage !== null && learningLanguage !== nativeLanguage
      );
    }
    return false;
  };

  const handleBack = () => {
    if (stepIndex === 0) {
      navigation.goBack();
      return;
    }
    animateToStep(stepIndex - 1);
  };

  const handleContinue = async () => {
    if (!canContinue()) return;

    if (stepIndex < STEPS.length - 1) {
      animateToStep(stepIndex + 1);
      return;
    }

    if (!nativeLanguage || !learningLanguage) return;

    setSubmitting(true);
    try {
      const profile: OnboardingProfile = {
        name: name.trim(),
        nativeLanguage,
        learningLanguage,
        languageLevel: "beginner",
        motivation: "",
        ageRange: "20s",
        learningSpeed: "moderate",
      };

      await setOnboardingProfile(profile);
      await setLanguage(learningLanguage);
      await setHasCompletedOnboarding(true);
      await setAiDataConsent(true);

      const rcUserId =
        revenueCatUserId ?? (await Purchases.getAppUserID().catch(() => null));
      if (rcUserId) {
        syncUserToBackend(rcUserId, profile);
      }

      navigation.reset({
        index: 0,
        routes: [{ name: "Main" }],
      });
    } finally {
      setSubmitting(false);
    }
  };

  const translateX = slideAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-STEP_SLIDE, 0, STEP_SLIDE],
  });

  const stepTitle =
    step === "name"
      ? "What's your name?"
      : step === "native"
        ? "What language do you speak?"
        : "What are you learning?";

  const stepSubtitle =
    step === "name"
      ? "We'll use this to personalize your practice."
      : step === "native"
        ? "Your primary language for translations and feedback."
        : "Pick the language you want to practice speaking.";

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + 12 }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Pressable onPress={handleBack} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.backText}>{stepIndex === 0 ? "←" : "Back"}</Text>
        </Pressable>
        <StepDots progress={stepProgress} />
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateX }],
          }}
        >
          <Text style={styles.title}>{stepTitle}</Text>
          <Text style={styles.subtitle}>{stepSubtitle}</Text>

          {step === "name" && (
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={COLORS.textMuted}
              autoFocus
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => canContinue() && handleContinue()}
            />
          )}

          {step === "native" && (
            <View style={styles.langGrid}>
              {LANGUAGES.map(({ code, label, flag }) => (
                <LanguageOption
                  key={code}
                  flag={flag}
                  label={label}
                  selected={nativeLanguage === code}
                  onPress={() => setNativeLanguage(code)}
                />
              ))}
            </View>
          )}

          {step === "learning" && (
            <>
              <View style={styles.langGrid}>
                {LANGUAGES.map(({ code, label, flag }) => (
                  <LanguageOption
                    key={code}
                    flag={flag}
                    label={label}
                    selected={learningLanguage === code}
                    disabled={code === nativeLanguage}
                    onPress={() => setLearningLanguage(code)}
                  />
                ))}
              </View>
              {learningLanguage === nativeLanguage && (
                <Text style={styles.hint}>
                  Choose a different language than the one you speak.
                </Text>
              )}
            </>
          )}
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={({ pressed }) => [
            styles.cta,
            (!canContinue() || submitting) && styles.ctaDisabled,
            pressed && canContinue() && !submitting && styles.ctaPressed,
          ]}
          onPress={handleContinue}
          disabled={!canContinue() || submitting}
        >
          <Text style={styles.ctaText}>
            {submitting
              ? "Starting..."
              : stepIndex === STEPS.length - 1
                ? "Start learning"
                : "Continue"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  backBtn: {
    width: 56,
  },
  backText: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: "500",
    color: COLORS.textMuted,
  },
  stepDots: {
    flexDirection: "row",
    gap: 6,
  },
  stepDot: {
    width: 24,
    height: 4,
    borderRadius: 999,
    backgroundColor: COLORS.borderStrong,
    overflow: "hidden",
  },
  stepDotFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.text,
    borderRadius: 999,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 24,
  },
  title: {
    fontFamily: FONT,
    fontSize: 28,
    fontWeight: "400",
    color: COLORS.text,
    letterSpacing: -0.8,
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: "400",
    color: COLORS.textMuted,
    lineHeight: 24,
    letterSpacing: -0.16,
    marginBottom: 32,
  },
  input: {
    fontFamily: FONT,
    fontSize: 17,
    fontWeight: "500",
    color: COLORS.text,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  langGrid: {
    gap: 10,
  },
  langOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#FFFFFF",
  },
  langOptionSelected: {
    borderColor: COLORS.selected,
    backgroundColor: COLORS.selectedBg,
  },
  langOptionDisabled: {
    opacity: 0.35,
  },
  langOptionPressed: {
    opacity: 0.85,
  },
  langFlag: {
    fontSize: 28,
  },
  langLabel: {
    fontFamily: FONT,
    fontSize: 17,
    fontWeight: "500",
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  langLabelSelected: {
    fontWeight: "600",
  },
  langLabelDisabled: {
    color: COLORS.textMuted,
  },
  hint: {
    fontFamily: FONT,
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 14,
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: 28,
    paddingTop: 12,
  },
  cta: {
    height: 44,
    borderRadius: 999,
    backgroundColor: COLORS.cta,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 30,
    elevation: 8,
  },
  ctaDisabled: {
    opacity: 0.35,
  },
  ctaPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  ctaText: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: "500",
    color: "#FFFFFF",
    letterSpacing: -0.16,
  },
});

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Image,
} from "react-native";
import Purchases from "react-native-purchases";
import RevenueCatUI from "react-native-purchases-ui";
import * as Notifications from "expo-notifications";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SLIDE_DISTANCE = SCREEN_WIDTH * 0.15;
import LottieView from "lottie-react-native";
import { useApp } from "../context/AppContext";
import type {
  Language,
  LanguageLevel,
  AgeRange,
  LearningSpeed,
  OnboardingProfile,
} from "../context/AppContext";
import { getPhrases } from "../api/phrases";
import type { Phrase } from "../api/phrases";
import OnboardingPronunciationStep from "../components/OnboardingPronunciationStep";
import { getLearningPlan } from "../lib/learningPlan";
import { syncUserToBackend, updatePlanToPro } from "../api/users";
import { useUserId } from "../context/UserContext";

const LEVEL_TO_DIFFICULTY: Record<LanguageLevel, string> = {
  beginner: "easy",
  intermediate: "medium",
  advanced: "hard",
};

const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: "es", label: "Spanish", flag: "🇪🇸" },
  { code: "fr", label: "French", flag: "🇫🇷" },
  { code: "it", label: "Italian", flag: "🇮🇹" },
  { code: "en", label: "English", flag: "🇺🇸" },
];

const LEVELS: { value: LanguageLevel; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

const MOTIVATIONS = [
  "Travel",
  "Work",
  "Family & friends",
  "School",
  "Personal growth",
  "Other",
];

const AGE_RANGES: { value: AgeRange; label: string }[] = [
  { value: "under_20", label: "Under 20" },
  { value: "20s", label: "20s" },
  { value: "30s", label: "30s" },
  { value: "40s", label: "40s" },
  { value: "50s", label: "50s" },
  { value: "60_plus", label: "60 and above" },
];

const LEARNING_SPEED_OPTIONS: { value: LearningSpeed; label: string }[] = [
  { value: "relaxed", label: "Take it easy – learn at your own pace" },
  { value: "moderate", label: "Steady progress – a few sessions per week" },
  { value: "fast", label: "Learn fast – daily practice" },
];

const LANGUAGE_LABELS: Record<Language, string> = {
  es: "Spanish",
  fr: "French",
  it: "Italian",
  en: "English",
};

const TOTAL_STEPS = 16;
const WELCOME_STEP = 1;
const LANGUAGE_FADE_STEP = 3;
const NATIVE_LANGUAGE_STEP = 5;
const PRONUNCIATION_PREP_STEP = 6;
const PRONUNCIATION_STEP = 7;
const SPEAKING_INSIGHT_STEP = 8;
const PLAN_DISPLAY_STEP = 12;
const NOTIFICATION_STEP = 13;
const PRE_PAYWALL_STEP = 14;
const PAYWALL_STEP = 15;
const WELCOME_DURATION_MS = 2700;
const FADE_SCREEN_DURATION_MS = 3500;

const LANGUAGE_FADE_TEXTS: Record<Language, string> = {
  es: "Over 600 million total Spanish speakers globally, Spanish is the world's second most spoken native language.",
  fr: "French is spoken on five continents and is an official language in 29 countries.",
  it: "Italian is the closest living language to Latin and is spoken by over 85 million people worldwide.",
  en: "English is the most widely spoken language in the world, with over 1.5 billion speakers.",
};

export default function OnboardingScreen({ navigation }: { navigation: any }) {
  const { setLanguage, setHasCompletedOnboarding, setOnboardingProfile } =
    useApp();
  const { userId: revenueCatUserId } = useUserId();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [learningLanguage, setLearningLanguage] = useState<Language | null>(
    null,
  );
  const [languageLevel, setLanguageLevel] = useState<LanguageLevel | null>(
    null,
  );
  const [motivation, setMotivation] = useState("");
  const [nativeLanguage, setNativeLanguage] = useState<Language | null>(null);
  const [ageRange, setAgeRange] = useState<AgeRange | null>(null);
  const [learningSpeed, setLearningSpeed] = useState<LearningSpeed | null>(
    null,
  );
  const [pronunciationPhrase, setPronunciationPhrase] = useState<Phrase | null>(
    null,
  );
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const stepSlideAnim = useRef(new Animated.Value(0)).current;
  const stepOpacityAnim = useRef(new Animated.Value(1)).current;
  const welcomeFadeAnim = useRef(new Animated.Value(0)).current;
  const languageFadeAnim = useRef(new Animated.Value(0)).current;
  const prevStepRef = useRef(0);
  const welcomeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const languageFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const planTitleOpacity = useRef(new Animated.Value(0)).current;
  const planTitleTranslateY = useRef(new Animated.Value(16)).current;
  const planSubtitleOpacity = useRef(new Animated.Value(0)).current;
  const planCardOpacity = useRef(new Animated.Value(0)).current;
  const planCardTranslateY = useRef(new Animated.Value(24)).current;
  const planItemOpacities = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;
  const planItemTranslateX = useRef([
    new Animated.Value(20),
    new Animated.Value(20),
    new Animated.Value(20),
  ]).current;
  const paywallLoaderOpacity = useRef(new Animated.Value(1)).current;
  const paywallPurchasedRef = useRef(false);
  const [paywallLoading, setPaywallLoading] = useState(false);
  const prepEmojiScale = useRef(new Animated.Value(0)).current;
  const prepTitleOpacity = useRef(new Animated.Value(0)).current;
  const prepTitleTranslateY = useRef(new Animated.Value(20)).current;
  const prepSubtitleOpacity = useRef(new Animated.Value(0)).current;
  const prepSubtitleTranslateY = useRef(new Animated.Value(16)).current;
  const prepBtnOpacity = useRef(new Animated.Value(0)).current;
  const prepBtnTranslateY = useRef(new Animated.Value(20)).current;
  const insightIconScale = useRef(new Animated.Value(0)).current;
  const insightStatOpacities = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;
  const insightStatTranslateY = useRef([
    new Animated.Value(18),
    new Animated.Value(18),
    new Animated.Value(18),
  ]).current;
  const insightBtnOpacity = useRef(new Animated.Value(0)).current;
  const notifIconScale = useRef(new Animated.Value(0)).current;
  const notifTitleOpacity = useRef(new Animated.Value(0)).current;
  const notifTitleTranslateY = useRef(new Animated.Value(20)).current;
  const notifSubtitleOpacity = useRef(new Animated.Value(0)).current;
  const notifBtnOpacity = useRef(new Animated.Value(0)).current;
  const notifBtnTranslateY = useRef(new Animated.Value(20)).current;
  const prePayEmojiScale = useRef(new Animated.Value(0)).current;
  const prePayTitleOpacity = useRef(new Animated.Value(0)).current;
  const prePayTitleTranslateY = useRef(new Animated.Value(20)).current;
  const prePaySubtitleOpacity = useRef(new Animated.Value(0)).current;
  const prePayBadgeOpacity = useRef(new Animated.Value(0)).current;
  const prePayBadgeScale = useRef(new Animated.Value(0.8)).current;
  const prePayBtnOpacity = useRef(new Animated.Value(0)).current;
  const prePayBtnTranslateY = useRef(new Animated.Value(20)).current;

  const canProceed = () => {
    switch (step) {
      case 0:
        return name.trim().length > 0;
      case WELCOME_STEP:
        return true;
      case 2:
        return learningLanguage !== null;
      case LANGUAGE_FADE_STEP:
        return true;
      case 4:
        return languageLevel !== null;
      case NATIVE_LANGUAGE_STEP:
        return nativeLanguage !== null;
      case PRONUNCIATION_PREP_STEP:
        return true;
      case PRONUNCIATION_STEP:
        return true;
      case SPEAKING_INSIGHT_STEP:
        return true;
      case 9:
        return motivation.trim().length > 0;
      case 10:
        return ageRange !== null;
      case 11:
        return learningSpeed !== null;
      case PLAN_DISPLAY_STEP:
        return true;
      case NOTIFICATION_STEP:
        return true;
      case PRE_PAYWALL_STEP:
        return true;
      default:
        return false;
    }
  };

  const handleBack = () => {
    if (step === 2) {
      prevStepRef.current = step;
      setStep(0);
    } else if (step === 4) {
      prevStepRef.current = step;
      setStep(2);
    } else if (step === PLAN_DISPLAY_STEP) {
      prevStepRef.current = step;
      setStep(11);
    } else if (step === NOTIFICATION_STEP) {
      prevStepRef.current = step;
      setStep(PLAN_DISPLAY_STEP);
    } else if (step === PRE_PAYWALL_STEP) {
      prevStepRef.current = step;
      setStep(NOTIFICATION_STEP);
    } else if (step === PAYWALL_STEP) {
      prevStepRef.current = step;
      setStep(PRE_PAYWALL_STEP);
    } else if (
      step > 0 &&
      step !== WELCOME_STEP &&
      step !== LANGUAGE_FADE_STEP &&
      step !== PAYWALL_STEP
    ) {
      prevStepRef.current = step;
      setStep(step - 1);
    } else if (step === WELCOME_STEP || step === LANGUAGE_FADE_STEP) {
      prevStepRef.current = step;
      setStep(step === WELCOME_STEP ? 0 : 2);
    } else {
      navigation.goBack();
    }
  };

  const completeOnboardingAndGoToMain = async () => {
    if (
      !learningLanguage ||
      !languageLevel ||
      !nativeLanguage ||
      !ageRange ||
      !learningSpeed
    )
      return;
    const profile: OnboardingProfile = {
      name: name.trim(),
      learningLanguage,
      languageLevel,
      motivation: motivation.trim(),
      nativeLanguage,
      ageRange,
      learningSpeed,
    };
    await setOnboardingProfile(profile);
    await setLanguage(learningLanguage);
    await setHasCompletedOnboarding(true);
    const rcUserId =
      revenueCatUserId ?? (await Purchases.getAppUserID().catch(() => null));
    if (rcUserId) {
      syncUserToBackend(rcUserId, profile);
    }
    navigation.reset({
      index: 0,
      routes: [{ name: "Main" }],
    });
  };

  const completeOnboardingAndGoToCongrats = async () => {
    if (
      !learningLanguage ||
      !languageLevel ||
      !nativeLanguage ||
      !ageRange ||
      !learningSpeed
    )
      return;
    const profile: OnboardingProfile = {
      name: name.trim(),
      learningLanguage,
      languageLevel,
      motivation: motivation.trim(),
      nativeLanguage,
      ageRange,
      learningSpeed,
    };
    await setOnboardingProfile(profile);
    await setLanguage(learningLanguage);
    await setHasCompletedOnboarding(true);
    const rcUserId =
      revenueCatUserId ?? (await Purchases.getAppUserID().catch(() => null));
    if (rcUserId) {
      syncUserToBackend(rcUserId, profile);
    }
    navigation.reset({
      index: 0,
      routes: [{ name: "Congrats" }],
    });
  };

  const handleNext = async () => {
    if (step === PLAN_DISPLAY_STEP) {
      if (
        !learningLanguage ||
        !languageLevel ||
        !nativeLanguage ||
        !ageRange ||
        !learningSpeed
      )
        return;
      const profile: OnboardingProfile = {
        name: name.trim(),
        learningLanguage,
        languageLevel,
        motivation: motivation.trim(),
        nativeLanguage,
        ageRange,
        learningSpeed,
      };
      const rcUserId =
        revenueCatUserId ?? (await Purchases.getAppUserID().catch(() => null));
      if (rcUserId) {
        await syncUserToBackend(rcUserId, profile);
      }
      prevStepRef.current = step;
      setStep(NOTIFICATION_STEP);
    } else if (step === PRE_PAYWALL_STEP) {
      prevStepRef.current = step;
      setPaywallLoading(true);
      setStep(PAYWALL_STEP);
    } else if (step < TOTAL_STEPS - 1) {
      prevStepRef.current = step;
      setStep(step + 1);
    }
  };

  useEffect(() => {
    if (
      step === PAYWALL_STEP ||
      step === PLAN_DISPLAY_STEP ||
      step === WELCOME_STEP ||
      step === LANGUAGE_FADE_STEP ||
      step === PRONUNCIATION_PREP_STEP ||
      step === SPEAKING_INSIGHT_STEP ||
      step === NOTIFICATION_STEP ||
      step === PRE_PAYWALL_STEP ||
      step < 0 ||
      step >= TOTAL_STEPS
    )
      return;
    const prevStep = prevStepRef.current;
    const isForward = step > prevStep;
    const isInitial = step === 0 && prevStep === 0;
    const fromX = isInitial
      ? SLIDE_DISTANCE
      : isForward
        ? SLIDE_DISTANCE
        : -SLIDE_DISTANCE;
    stepSlideAnim.setValue(fromX);
    stepOpacityAnim.setValue(0);
    Animated.parallel([
      Animated.timing(stepSlideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(stepOpacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
    prevStepRef.current = step;
  }, [step, stepSlideAnim, stepOpacityAnim]);

  useEffect(() => {
    if (step === WELCOME_STEP) {
      welcomeFadeAnim.setValue(0);
      Animated.sequence([
        Animated.timing(welcomeFadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.delay(WELCOME_DURATION_MS - 1200),
        Animated.timing(welcomeFadeAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();
      welcomeTimerRef.current = setTimeout(() => {
        prevStepRef.current = WELCOME_STEP;
        setStep(2);
      }, WELCOME_DURATION_MS);
      return () => {
        if (welcomeTimerRef.current) {
          clearTimeout(welcomeTimerRef.current);
          welcomeTimerRef.current = null;
        }
      };
    }
  }, [step, welcomeFadeAnim]);

  useEffect(() => {
    if (step === LANGUAGE_FADE_STEP && learningLanguage) {
      languageFadeAnim.setValue(0);
      Animated.sequence([
        Animated.timing(languageFadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.delay(FADE_SCREEN_DURATION_MS - 1200),
        Animated.timing(languageFadeAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();
      languageFadeTimerRef.current = setTimeout(() => {
        prevStepRef.current = LANGUAGE_FADE_STEP;
        setStep(4);
      }, FADE_SCREEN_DURATION_MS);
      return () => {
        if (languageFadeTimerRef.current) {
          clearTimeout(languageFadeTimerRef.current);
          languageFadeTimerRef.current = null;
        }
      };
    }
  }, [step, learningLanguage, languageFadeAnim]);

  useEffect(() => {
    if (
      (step === PRONUNCIATION_PREP_STEP || step === PRONUNCIATION_STEP) &&
      learningLanguage &&
      languageLevel
    ) {
      if (!pronunciationPhrase) {
        const apiDifficulty = LEVEL_TO_DIFFICULTY[languageLevel];
        getPhrases(learningLanguage, undefined, apiDifficulty, 1)
          .then((phrases) => setPronunciationPhrase(phrases[0] ?? null))
          .catch(() => setPronunciationPhrase(null));
      }
    } else if (
      step !== PRONUNCIATION_PREP_STEP &&
      step !== PRONUNCIATION_STEP
    ) {
      setPronunciationPhrase(null);
    }
  }, [step, learningLanguage, languageLevel]);

  useEffect(() => {
    if (step !== PRONUNCIATION_PREP_STEP) return;
    prepEmojiScale.setValue(0);
    prepTitleOpacity.setValue(0);
    prepTitleTranslateY.setValue(20);
    prepSubtitleOpacity.setValue(0);
    prepSubtitleTranslateY.setValue(16);
    prepBtnOpacity.setValue(0);
    prepBtnTranslateY.setValue(20);

    Animated.sequence([
      Animated.spring(prepEmojiScale, {
        toValue: 1,
        friction: 4,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(prepTitleOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(prepTitleTranslateY, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(prepSubtitleOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(prepSubtitleTranslateY, {
          toValue: 0,
          duration: 350,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(prepBtnOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(prepBtnTranslateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [step]);

  useEffect(() => {
    if (step !== SPEAKING_INSIGHT_STEP) return;
    insightIconScale.setValue(0);
    insightStatOpacities.forEach((a) => a.setValue(0));
    insightStatTranslateY.forEach((a) => a.setValue(18));
    insightBtnOpacity.setValue(0);

    const statAnimations = insightStatOpacities.map((opacity, i) =>
      Animated.sequence([
        Animated.delay(i * 200),
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.timing(insightStatTranslateY[i], {
            toValue: 0,
            duration: 350,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    Animated.sequence([
      Animated.spring(insightIconScale, {
        toValue: 1,
        friction: 5,
        tension: 70,
        useNativeDriver: true,
      }),
      Animated.parallel(statAnimations),
      Animated.timing(insightBtnOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [step]);

  useEffect(() => {
    if (step !== NOTIFICATION_STEP) return;
    notifIconScale.setValue(0);
    notifTitleOpacity.setValue(0);
    notifTitleTranslateY.setValue(20);
    notifSubtitleOpacity.setValue(0);
    notifBtnOpacity.setValue(0);
    notifBtnTranslateY.setValue(20);

    Animated.sequence([
      Animated.spring(notifIconScale, {
        toValue: 1,
        friction: 4,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(notifTitleOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(notifTitleTranslateY, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(notifSubtitleOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(notifBtnOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(notifBtnTranslateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [step]);

  useEffect(() => {
    if (step !== PRE_PAYWALL_STEP) return;
    prePayEmojiScale.setValue(0);
    prePayTitleOpacity.setValue(0);
    prePayTitleTranslateY.setValue(20);
    prePaySubtitleOpacity.setValue(0);
    prePayBadgeOpacity.setValue(0);
    prePayBadgeScale.setValue(0.8);
    prePayBtnOpacity.setValue(0);
    prePayBtnTranslateY.setValue(20);

    Animated.sequence([
      Animated.spring(prePayEmojiScale, {
        toValue: 1,
        friction: 4,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(prePayTitleOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(prePayTitleTranslateY, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(prePaySubtitleOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(prePayBadgeOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.spring(prePayBadgeScale, {
          toValue: 1,
          friction: 5,
          tension: 70,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(prePayBtnOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(prePayBtnTranslateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [step]);

  useEffect(() => {
    if (step !== PLAN_DISPLAY_STEP) return;
    planTitleOpacity.setValue(0);
    planTitleTranslateY.setValue(16);
    planSubtitleOpacity.setValue(0);
    planCardOpacity.setValue(0);
    planCardTranslateY.setValue(24);
    planItemOpacities.forEach((a) => a.setValue(0));
    planItemTranslateX.forEach((a) => a.setValue(20));

    Animated.sequence([
      Animated.parallel([
        Animated.timing(planTitleOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(planTitleTranslateY, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(150),
      Animated.timing(planSubtitleOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.delay(100),
      Animated.parallel([
        Animated.timing(planCardOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(planCardTranslateY, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(80),
      Animated.parallel([
        Animated.timing(planItemOpacities[0], {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(planItemTranslateX[0], {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(120),
      Animated.parallel([
        Animated.timing(planItemOpacities[1], {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(planItemTranslateX[1], {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(120),
      Animated.parallel([
        Animated.timing(planItemOpacities[2], {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(planItemTranslateX[2], {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [
    step,
    planTitleOpacity,
    planTitleTranslateY,
    planSubtitleOpacity,
    planCardOpacity,
    planCardTranslateY,
    planItemOpacities,
    planItemTranslateX,
  ]);

  useEffect(() => {
    if (step === PAYWALL_STEP) {
      paywallPurchasedRef.current = false;
      paywallLoaderOpacity.setValue(1);
      const minLoaderMs = 1200;
      const start = Date.now();
      Purchases.getOfferings()
        .then((offerings) => {
          if (offerings.current?.availablePackages) {
            const products = offerings.current.availablePackages.map((p) => ({
              identifier: p.identifier,
              packageType: p.packageType,
              price: p.product.priceString,
              title: p.product.title,
            }));
            console.log("[Paywall] Products:", products);
          }
        })
        .catch((e) => console.warn("[Paywall] Failed to fetch offerings:", e))
        .finally(() => {
          const elapsed = Date.now() - start;
          const remaining = Math.max(0, minLoaderMs - elapsed);
          setTimeout(() => {
            setPaywallLoading(false);
            Animated.timing(paywallLoaderOpacity, {
              toValue: 0,
              duration: 350,
              useNativeDriver: true,
            }).start();
          }, remaining);
        });
    } else {
      setPaywallLoading(false);
    }
  }, [step, paywallLoaderOpacity]);

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <>
            <Text style={styles.title}>What should Verba call you?</Text>
            <TextInput
              style={styles.input}
              placeholder="Your name"
              placeholderTextColor="#94a3b8"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </>
        );
      case WELCOME_STEP:
        return (
          <View style={styles.welcomeContainer}>
            <LottieView
              source={require("../../assets/lottie/hi.json")}
              autoPlay
              loop
              style={styles.welcomeLottie}
            />
            <Animated.Text
              style={[styles.welcomeTitle, { opacity: welcomeFadeAnim }]}
            >
              Hi {name.trim()},
            </Animated.Text>
            <Animated.Text
              style={[styles.welcomeSubtitle, { opacity: welcomeFadeAnim }]}
            >
              Let's get started
            </Animated.Text>
          </View>
        );
      case 2:
        return (
          <>
            <Text style={styles.title}>What language are you learning?</Text>
            {LANGUAGES.map(({ code, label, flag }) => (
              <TouchableOpacity
                key={code}
                style={[
                  styles.option,
                  learningLanguage === code && styles.optionSelected,
                ]}
                onPress={() => setLearningLanguage(code)}
                activeOpacity={0.7}
              >
                <Text style={styles.optionFlag}>{flag}</Text>
                <Text
                  style={[
                    styles.optionText,
                    learningLanguage === code && styles.optionTextSelected,
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </>
        );
      case LANGUAGE_FADE_STEP:
        return (
          <View style={styles.welcomeContainer}>
            <Animated.Text
              style={[styles.fadeScreenText, { opacity: languageFadeAnim }]}
            >
              {learningLanguage ? LANGUAGE_FADE_TEXTS[learningLanguage] : ""}
            </Animated.Text>
          </View>
        );
      case 4:
        return (
          <>
            <Text style={styles.title}>
              What is your{" "}
              {learningLanguage
                ? LANGUAGE_LABELS[learningLanguage]
                : "language"}{" "}
              level?
            </Text>
            {LEVELS.map(({ value, label }) => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.option,
                  languageLevel === value && styles.optionSelected,
                ]}
                onPress={() => setLanguageLevel(value)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.optionText,
                    languageLevel === value && styles.optionTextSelected,
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </>
        );
      case NATIVE_LANGUAGE_STEP:
        return (
          <>
            <Text style={styles.title}>What is your native language?</Text>
            {LANGUAGES.map(({ code, label, flag }) => (
              <TouchableOpacity
                key={code}
                style={[
                  styles.option,
                  nativeLanguage === code && styles.optionSelected,
                ]}
                onPress={() => setNativeLanguage(code)}
                activeOpacity={0.7}
              >
                <Text style={styles.optionFlag}>{flag}</Text>
                <Text
                  style={[
                    styles.optionText,
                    nativeLanguage === code && styles.optionTextSelected,
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </>
        );
      case 9:
        return (
          <>
            <Text style={styles.title}>
              Why do you want to improve speaking{" "}
              {learningLanguage
                ? LANGUAGE_LABELS[learningLanguage]
                : "your language"}
              ?
            </Text>
            {MOTIVATIONS.map((m) => (
              <TouchableOpacity
                key={m}
                style={[
                  styles.option,
                  motivation === m && styles.optionSelected,
                ]}
                onPress={() => setMotivation(m)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.optionText,
                    motivation === m && styles.optionTextSelected,
                  ]}
                >
                  {m}
                </Text>
              </TouchableOpacity>
            ))}
          </>
        );
      case 10:
        return (
          <>
            <Text style={styles.title}>What is your age?</Text>
            {AGE_RANGES.map(({ value, label }) => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.option,
                  ageRange === value && styles.optionSelected,
                ]}
                onPress={() => setAgeRange(value)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.optionText,
                    ageRange === value && styles.optionTextSelected,
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </>
        );
      case 11:
        return (
          <>
            <Text style={styles.title}>
              How fast do you want to learn{" "}
              {learningLanguage
                ? LANGUAGE_LABELS[learningLanguage]
                : "your language"}
              ?
            </Text>
            {LEARNING_SPEED_OPTIONS.map(({ value, label }) => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.option,
                  learningSpeed === value && styles.optionSelected,
                ]}
                onPress={() => setLearningSpeed(value)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.optionText,
                    learningSpeed === value && styles.optionTextSelected,
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </>
        );
      case PLAN_DISPLAY_STEP: {
        if (!languageLevel || !learningSpeed || !learningLanguage) return null;
        const plan = getLearningPlan(languageLevel, learningSpeed);
        const langLabel = LANGUAGE_LABELS[learningLanguage];
        const planItems = [
          `${plan.practiceMinutes} per day`,
          `${plan.phrasesPerWeek} per week`,
          plan.sessionsPerWeek === "Daily"
            ? "Practice daily"
            : `${plan.sessionsPerWeek} per week`,
        ];
        const userName = name.trim();
        return (
          <>
            <Animated.Text
              style={[
                styles.title,
                {
                  opacity: planTitleOpacity,
                  transform: [{ translateY: planTitleTranslateY }],
                },
              ]}
            >
              {userName ? `${userName}'s ` : "Your "}
              {langLabel} Learning Plan
            </Animated.Text>
            <Animated.Text
              style={[styles.planSubtitle, { opacity: planSubtitleOpacity }]}
            >
              {plan.summary}
            </Animated.Text>
            <Animated.View
              style={[
                styles.planCard,
                {
                  opacity: planCardOpacity,
                  transform: [{ translateY: planCardTranslateY }],
                },
              ]}
            >
              {planItems.map((item, i) => (
                <Animated.Text
                  key={i}
                  style={[
                    styles.planItem,
                    {
                      opacity: planItemOpacities[i],
                      transform: [{ translateX: planItemTranslateX[i] }],
                    },
                  ]}
                >
                  • {item}
                </Animated.Text>
              ))}
            </Animated.View>
          </>
        );
      }
      default:
        return null;
    }
  };

  if (step === WELCOME_STEP) {
    return (
      <TouchableOpacity
        style={[styles.container, styles.fadeScreenContainer]}
        activeOpacity={1}
        onPress={() => {
          if (welcomeTimerRef.current) {
            clearTimeout(welcomeTimerRef.current);
            welcomeTimerRef.current = null;
          }
          prevStepRef.current = WELCOME_STEP;
          setStep(2);
        }}
      >
        {renderStep()}
      </TouchableOpacity>
    );
  }

  if (step === LANGUAGE_FADE_STEP) {
    return (
      <TouchableOpacity
        style={[styles.container, styles.fadeScreenContainer]}
        activeOpacity={1}
        onPress={() => {
          if (languageFadeTimerRef.current) {
            clearTimeout(languageFadeTimerRef.current);
            languageFadeTimerRef.current = null;
          }
          prevStepRef.current = LANGUAGE_FADE_STEP;
          setStep(4);
        }}
      >
        {renderStep()}
      </TouchableOpacity>
    );
  }

  if (step === PRONUNCIATION_PREP_STEP) {
    const langName = learningLanguage
      ? LANGUAGE_LABELS[learningLanguage]
      : "your new language";
    return (
      <View style={styles.prepScreen}>
        <SafeAreaView style={styles.prepSafeArea}>
          <TouchableOpacity
            style={styles.prepBackBtn}
            onPress={handleBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <Text style={styles.prepBackBtnText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.prepContent}>
            <Animated.Text
              style={[
                styles.prepEmoji,
                { transform: [{ scale: prepEmojiScale }] },
              ]}
            >
              🎙️
            </Animated.Text>
            <Animated.Text
              style={[
                styles.prepTitle,
                {
                  opacity: prepTitleOpacity,
                  transform: [{ translateY: prepTitleTranslateY }],
                },
              ]}
            >
              Let's hear you speak {langName}
            </Animated.Text>
            <Animated.Text
              style={[
                styles.prepSubtitle,
                {
                  opacity: prepSubtitleOpacity,
                  transform: [{ translateY: prepSubtitleTranslateY }],
                },
              ]}
            >
              You'll see a phrase, listen to how it sounds, then hold the mic to
              say it yourself. Verba will give you instant feedback.
            </Animated.Text>
            <Animated.View
              style={[
                styles.prepBtnWrap,
                {
                  opacity: prepBtnOpacity,
                  transform: [{ translateY: prepBtnTranslateY }],
                },
              ]}
            >
              <TouchableOpacity
                style={styles.prepBtn}
                activeOpacity={0.85}
                onPress={handleNext}
              >
                <Text style={styles.prepBtnText}>I'm ready</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (step === PRONUNCIATION_STEP) {
    return (
      <OnboardingPronunciationStep
        phrase={pronunciationPhrase}
        nativeLanguage={nativeLanguage ?? "en"}
        targetLang={learningLanguage ?? "es"}
        onBack={handleBack}
        onSkip={handleNext}
        onContinue={handleNext}
      />
    );
  }

  if (step === SPEAKING_INSIGHT_STEP) {
    const langName = learningLanguage
      ? LANGUAGE_LABELS[learningLanguage]
      : "a new language";
    const INSIGHT_STATS = [
      {
        number: "2×",
        text: `Speaking practice doubles retention compared to passive study`,
      },
      {
        number: "68%",
        text: `of learners say speaking is the hardest skill — Verba makes it easy`,
      },
      {
        number: "10 min",
        text: `a day of speaking builds real fluency faster than hours of reading`,
      },
    ];
    return (
      <View style={styles.insightScreen}>
        <SafeAreaView style={styles.prepSafeArea}>
          <TouchableOpacity
            style={styles.prepBackBtn}
            onPress={handleBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <Text style={styles.prepBackBtnText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.insightContent}>
            <Animated.Text
              style={[
                styles.insightIcon,
                { transform: [{ scale: insightIconScale }] },
              ]}
            >
              🧠
            </Animated.Text>
            <Text style={styles.insightTitle}>
              Speaking is the fastest path to fluency
            </Text>
            <View style={styles.insightStatsWrap}>
              {INSIGHT_STATS.map((stat, i) => (
                <Animated.View
                  key={i}
                  style={[
                    styles.insightStatRow,
                    {
                      opacity: insightStatOpacities[i],
                      transform: [{ translateY: insightStatTranslateY[i] }],
                    },
                  ]}
                >
                  <Text style={styles.insightStatNumber}>{stat.number}</Text>
                  <Text style={styles.insightStatText}>{stat.text}</Text>
                </Animated.View>
              ))}
            </View>
            <Animated.View style={{ opacity: insightBtnOpacity }}>
              <TouchableOpacity
                style={styles.prepBtn}
                activeOpacity={0.85}
                onPress={handleNext}
              >
                <Text style={styles.prepBtnText}>Continue</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (step === NOTIFICATION_STEP) {
    return (
      <View style={styles.notifScreen}>
        <SafeAreaView style={styles.prepSafeArea}>
          <TouchableOpacity
            style={styles.prepBackBtn}
            onPress={handleBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <Text style={styles.prepBackBtnText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.notifContent}>
            <Animated.Text
              style={[
                styles.notifIcon,
                { transform: [{ scale: notifIconScale }] },
              ]}
            >
              🔔
            </Animated.Text>
            <Animated.Text
              style={[
                styles.notifTitle,
                {
                  opacity: notifTitleOpacity,
                  transform: [{ translateY: notifTitleTranslateY }],
                },
              ]}
            >
              Don't lose your streak
            </Animated.Text>
            <Animated.Text
              style={[styles.notifSubtitle, { opacity: notifSubtitleOpacity }]}
            >
              We send notifications to help track your progress and keep you on
              schedule. Get a friendly reminder each day to keep practicing —
              learners who enable notifications are 3× more likely to stick with
              it.
            </Animated.Text>
            <Animated.View
              style={[
                styles.notifBtnWrap,
                {
                  opacity: notifBtnOpacity,
                  transform: [{ translateY: notifBtnTranslateY }],
                },
              ]}
            >
              <TouchableOpacity
                style={styles.notifAllowBtn}
                activeOpacity={0.85}
                onPress={async () => {
                  await Notifications.requestPermissionsAsync();
                  handleNext();
                }}
              >
                <Text style={styles.notifAllowBtnText}>Enable Reminders</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.notifSkipBtn}
                activeOpacity={0.7}
                onPress={handleNext}
              >
                <Text style={styles.notifSkipBtnText}>Maybe later</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (step === PRE_PAYWALL_STEP) {
    const langName = learningLanguage
      ? LANGUAGE_LABELS[learningLanguage]
      : "your new language";
    return (
      <View style={styles.prePayScreen}>
        <SafeAreaView style={styles.prepSafeArea}>
          <TouchableOpacity
            style={styles.prePayCloseBtn}
            onPress={handleBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <Text style={styles.prePayCloseBtnText}>✕</Text>
          </TouchableOpacity>
          <View style={styles.prePayContent}>
            <Animated.Text
              style={[
                styles.prePayTitle,
                {
                  opacity: prePayTitleOpacity,
                  transform: [{ translateY: prePayTitleTranslateY }],
                },
              ]}
            >
              We want you to{"\n"}try Verba for free.
            </Animated.Text>
            <Animated.View
              style={[
                styles.prePayPhoneWrap,
                { transform: [{ scale: prePayEmojiScale }] },
              ]}
            >
              <Image
                source={require("../../assets/app-preview.png")}
                style={styles.prePayPhoneImage}
                resizeMode="cover"
              />
            </Animated.View>
            <Animated.View
              style={[
                styles.prePayBadge,
                {
                  opacity: prePayBadgeOpacity,
                  transform: [{ scale: prePayBadgeScale }],
                },
              ]}
            >
              <Text style={styles.prePayBadgeCheck}>✓</Text>
              <Text style={styles.prePayBadgeText}>No Payment Due Now</Text>
            </Animated.View>
            <Animated.View
              style={[
                styles.prePayBtnWrap,
                {
                  opacity: prePayBtnOpacity,
                  transform: [{ translateY: prePayBtnTranslateY }],
                },
              ]}
            >
              <TouchableOpacity
                style={styles.prePayBtn}
                activeOpacity={0.85}
                onPress={handleNext}
              >
                <Text style={styles.prePayBtnText}>Try for Free</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (step === PAYWALL_STEP) {
    return (
      <View style={styles.paywallScreen}>
        <RevenueCatUI.Paywall
          options={{ displayCloseButton: true }}
          onDismiss={() => {
            // Delay to let onPurchaseCompleted/onRestoreCompleted fire first
            // (native bridge can dispatch dismiss before purchase callback)
            setTimeout(() => {
              if (paywallPurchasedRef.current) return;
              completeOnboardingAndGoToMain();
            }, 300);
          }}
          onPurchaseCompleted={async () => {
            paywallPurchasedRef.current = true;
            const rcUserId =
              revenueCatUserId ??
              (await Purchases.getAppUserID().catch(() => null));
            if (rcUserId) await updatePlanToPro(rcUserId);
            completeOnboardingAndGoToCongrats();
          }}
          onRestoreCompleted={async () => {
            paywallPurchasedRef.current = true;
            const rcUserId =
              revenueCatUserId ??
              (await Purchases.getAppUserID().catch(() => null));
            if (rcUserId) await updatePlanToPro(rcUserId);
            completeOnboardingAndGoToCongrats();
          }}
        />
        <Animated.View
          pointerEvents={paywallLoading ? "auto" : "none"}
          style={[
            StyleSheet.absoluteFill,
            styles.paywallLoader,
            { opacity: paywallLoaderOpacity },
          ]}
        >
          <ActivityIndicator size="large" color="#29B6F6" />
          <Text style={styles.paywallLoaderText}>Loading...</Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.progress}>
          <View
            style={[
              styles.progressBar,
              { width: `${((step + 1) / TOTAL_STEPS) * 100}%` as any },
            ]}
          />
        </View>
        <Animated.View
          style={{
            opacity: stepOpacityAnim,
            transform: [{ translateX: stepSlideAnim }],
          }}
        >
          {renderStep()}
        </Animated.View>
      </ScrollView>
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, !canProceed() && styles.buttonDisabled]}
          onPress={handleNext}
          disabled={!canProceed()}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>
            {step === PLAN_DISPLAY_STEP ? "Get Started" : "Continue"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  fadeScreenContainer: {
    backgroundColor: "#29B6F6",
  },
  scrollContent: {
    padding: 20,
    paddingTop: 52,
    paddingBottom: 24,
  },
  backButton: {
    alignSelf: "flex-start",
    marginBottom: 16,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#29B6F6",
  },
  progress: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(28,25,23,0.1)",
    marginBottom: 32,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#29B6F6",
    borderRadius: 2,
  },
  title: {
    fontFamily: "Georgia",
    fontSize: 26,
    fontWeight: "700",
    color: "#1C1917",
    marginBottom: 24,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  planSubtitle: {
    fontSize: 16,
    color: "#57534E",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 24,
  },
  planCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    borderWidth: 2,
    borderColor: "rgba(41, 182, 246, 0.15)",
  },
  planItem: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1C1917",
    marginBottom: 12,
    lineHeight: 26,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    fontSize: 18,
    color: "#1C1917",
    borderWidth: 2,
    borderColor: "rgba(41, 182, 246, 0.15)",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "rgba(41, 182, 246, 0.0)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  optionSelected: {
    borderColor: "#29B6F6",
    backgroundColor: "rgba(41, 182, 246, 0.08)",
  },
  optionFlag: {
    fontSize: 24,
    marginRight: 12,
  },
  optionText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1C1917",
  },
  optionTextSelected: {
    color: "#29B6F6",
  },
  footer: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  button: {
    backgroundColor: "#29B6F6",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#29B6F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: "#A8A29E",
    shadowOpacity: 0.1,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  creatingPlanOverlay: {
    flex: 1,
    backgroundColor: "#29B6F6",
    alignItems: "center",
    justifyContent: "center",
  },
  paywallScreen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  paywallLoader: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  paywallLoaderText: {
    marginTop: 16,
    fontSize: 16,
    color: "#57534E",
  },
  paywallView: {
    flex: 1,
  },
  paywallContinueButton: {
    marginTop: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: "#1C1917",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  paywallContinueText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#29B6F6",
  },
  welcomeContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  welcomeLottie: {
    width: 160,
    height: 160,
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
    marginBottom: 12,
  },
  welcomeSubtitle: {
    fontSize: 22,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
  },
  fadeScreenText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
    lineHeight: 30,
    paddingHorizontal: 16,
  },
  creatingPlanText: {
    marginTop: 32,
    fontSize: 20,
    fontWeight: "600",
    color: "#F8F9FA",
    fontFamily: "Georgia",
  },
  prepScreen: {
    flex: 1,
    backgroundColor: "#1D4ED8",
  },
  prepSafeArea: {
    flex: 1,
  },
  prepBackBtn: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 4,
    alignSelf: "flex-start",
  },
  prepBackBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
  },
  prepContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 36,
  },
  prepEmoji: {
    fontSize: 72,
    marginBottom: 32,
  },
  prepTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
    fontFamily: "Georgia",
    lineHeight: 40,
    marginBottom: 16,
  },
  prepSubtitle: {
    fontSize: 17,
    fontWeight: "500",
    color: "rgba(255,255,255,0.82)",
    textAlign: "center",
    lineHeight: 26,
    marginBottom: 48,
  },
  prepBtnWrap: {
    width: "100%",
    alignItems: "center",
  },
  prepBtn: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 18,
    paddingHorizontal: 56,
    borderRadius: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  prepBtnText: {
    fontSize: 19,
    fontWeight: "700",
    color: "#1D4ED8",
    letterSpacing: 0.3,
  },
  insightScreen: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  insightContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  insightIcon: {
    fontSize: 64,
    marginBottom: 24,
  },
  insightTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
    fontFamily: "Georgia",
    lineHeight: 36,
    marginBottom: 36,
  },
  insightStatsWrap: {
    width: "100%",
    marginBottom: 44,
    gap: 20,
  },
  insightStatRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 16,
  },
  insightStatNumber: {
    fontSize: 28,
    fontWeight: "900",
    color: "#60A5FA",
    minWidth: 70,
    textAlign: "center",
  },
  insightStatText: {
    fontSize: 15,
    fontWeight: "500",
    color: "rgba(255,255,255,0.82)",
    lineHeight: 22,
    flex: 1,
  },
  notifScreen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  notifContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 36,
  },
  notifIcon: {
    fontSize: 72,
    marginBottom: 28,
  },
  notifTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1C1917",
    textAlign: "center",
    fontFamily: "Georgia",
    lineHeight: 38,
    marginBottom: 16,
  },
  notifSubtitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#57534E",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 48,
  },
  notifBtnWrap: {
    width: "100%",
    alignItems: "center",
    gap: 16,
  },
  notifAllowBtn: {
    backgroundColor: "#29B6F6",
    paddingVertical: 18,
    paddingHorizontal: 56,
    borderRadius: 32,
    width: "100%",
    alignItems: "center",
    shadowColor: "#29B6F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  notifAllowBtnText: {
    fontSize: 19,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  notifSkipBtn: {
    paddingVertical: 12,
  },
  notifSkipBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#94A3B8",
  },
  prePayScreen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  prePayCloseBtn: {
    position: "absolute",
    top: 42,
    right: 20,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  prePayCloseBtnText: {
    fontSize: 18,
    color: "#1C1917",
    fontWeight: "600",
  },
  prePayContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  prePayTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: "#1C1917",
    textAlign: "center",
    fontFamily: "Georgia",
    lineHeight: 40,
    marginBottom: 32,
  },
  prePayPhoneWrap: {
    marginBottom: 28,
    alignItems: "center",
  },
  prePayPhoneImage: {
    width: 250,
    height: 420,
    borderRadius: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
  },
  prePayBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 32,
    gap: 8,
  },
  prePayBadgeCheck: {
    fontSize: 18,
    fontWeight: "700",
    color: "#22C55E",
  },
  prePayBadgeText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1C1917",
  },
  prePayBtnWrap: {
    width: "100%",
    alignItems: "center",
  },
  prePayBtn: {
    backgroundColor: "#29B6F6",
    paddingVertical: 18,
    borderRadius: 32,
    width: "100%",
    alignItems: "center",
    shadowColor: "#29B6F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  prePayBtnText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
});

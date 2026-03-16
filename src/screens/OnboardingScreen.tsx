import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import Purchases from 'react-native-purchases';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLIDE_DISTANCE = SCREEN_WIDTH * 0.15;
import LottieView from 'lottie-react-native';
import { useApp } from '../context/AppContext';
import type { Language, LanguageLevel, AgeRange, LearningSpeed, OnboardingProfile } from '../context/AppContext';
import { getPhrases } from '../api/phrases';
import type { Phrase } from '../api/phrases';
import OnboardingPronunciationStep from '../components/OnboardingPronunciationStep';
import { getLearningPlan } from '../lib/learningPlan';
import { syncUserToBackend } from '../api/users';
import { useUserId } from '../context/UserContext';

const LEVEL_TO_DIFFICULTY: Record<LanguageLevel, string> = {
  beginner: 'easy',
  intermediate: 'medium',
  advanced: 'hard',
};

const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: 'es', label: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', label: 'French', flag: '🇫🇷' },
  { code: 'it', label: 'Italian', flag: '🇮🇹' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
];

const LEVELS: { value: LanguageLevel; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

const MOTIVATIONS = [
  'Travel',
  'Work',
  'Family & friends',
  'School',
  'Personal growth',
  'Other',
];

const AGE_RANGES: { value: AgeRange; label: string }[] = [
  { value: 'under_20', label: 'Under 20' },
  { value: '20s', label: '20s' },
  { value: '30s', label: '30s' },
  { value: '40s', label: '40s' },
  { value: '50s', label: '50s' },
  { value: '60_plus', label: '60 and above' },
];

const LEARNING_SPEED_OPTIONS: { value: LearningSpeed; label: string }[] = [
  { value: 'relaxed', label: 'Take it easy – learn at your own pace' },
  { value: 'moderate', label: 'Steady progress – a few sessions per week' },
  { value: 'fast', label: 'Learn fast – daily practice' },
];

const LANGUAGE_LABELS: Record<Language, string> = {
  es: 'Spanish',
  fr: 'French',
  it: 'Italian',
  en: 'English',
};

const TOTAL_STEPS = 12;
const WELCOME_STEP = 1;
const LANGUAGE_FADE_STEP = 3;
const NATIVE_LANGUAGE_STEP = 5;
const PRONUNCIATION_STEP = 6;
const PLAN_DISPLAY_STEP = 10;
const CREATING_PLAN_STEP = 11;
const WELCOME_DURATION_MS = 2700;
const FADE_SCREEN_DURATION_MS = 3500;

const LANGUAGE_FADE_TEXTS: Record<Language, string> = {
  es: "Over 600 million total Spanish speakers globally, Spanish is the world's second most spoken native language.",
  fr: "French is spoken on five continents and is an official language in 29 countries.",
  it: "Italian is the closest living language to Latin and is spoken by over 85 million people worldwide.",
  en: "English is the most widely spoken language in the world, with over 1.5 billion speakers.",
};

export default function OnboardingScreen({ navigation }: { navigation: any }) {
  const { setLanguage, setHasCompletedOnboarding, setOnboardingProfile } = useApp();
  const { userId: revenueCatUserId } = useUserId();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [learningLanguage, setLearningLanguage] = useState<Language | null>(null);
  const [languageLevel, setLanguageLevel] = useState<LanguageLevel | null>(null);
  const [motivation, setMotivation] = useState('');
  const [nativeLanguage, setNativeLanguage] = useState<Language | null>(null);
  const [ageRange, setAgeRange] = useState<AgeRange | null>(null);
  const [learningSpeed, setLearningSpeed] = useState<LearningSpeed | null>(null);
  const [pronunciationPhrase, setPronunciationPhrase] = useState<Phrase | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const stepSlideAnim = useRef(new Animated.Value(0)).current;
  const stepOpacityAnim = useRef(new Animated.Value(1)).current;
  const welcomeFadeAnim = useRef(new Animated.Value(0)).current;
  const languageFadeAnim = useRef(new Animated.Value(0)).current;
  const prevStepRef = useRef(0);
  const welcomeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const languageFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const canProceed = () => {
    switch (step) {
      case 0: return name.trim().length > 0;
      case WELCOME_STEP: return true;
      case 2: return learningLanguage !== null;
      case LANGUAGE_FADE_STEP: return true;
      case 4: return languageLevel !== null;
      case NATIVE_LANGUAGE_STEP: return nativeLanguage !== null;
      case PRONUNCIATION_STEP: return true;
      case 7: return motivation.trim().length > 0;
      case 8: return ageRange !== null;
      case 9: return learningSpeed !== null;
      case PLAN_DISPLAY_STEP: return true;
      default: return false;
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
      setStep(9);
    } else if (step > 0 && step !== WELCOME_STEP && step !== LANGUAGE_FADE_STEP && step !== CREATING_PLAN_STEP) {
      prevStepRef.current = step;
      setStep(step - 1);
    } else if (step === WELCOME_STEP || step === LANGUAGE_FADE_STEP) {
      prevStepRef.current = step;
      setStep(step === WELCOME_STEP ? 0 : 2);
    } else {
      navigation.goBack();
    }
  };

  const handleNext = async () => {
    if (step === PLAN_DISPLAY_STEP) {
      if (!learningLanguage || !languageLevel || !nativeLanguage || !ageRange || !learningSpeed) return;
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
      const rcUserId = revenueCatUserId ?? (await Purchases.getAppUserID().catch(() => null));
      if (rcUserId) {
        syncUserToBackend(rcUserId, profile);
      }
      navigation.navigate('Congrats');
    } else if (step < TOTAL_STEPS - 1) {
      prevStepRef.current = step;
      setStep(step + 1);
    }
  };

  useEffect(() => {
    if (step === CREATING_PLAN_STEP || step === PLAN_DISPLAY_STEP || step === WELCOME_STEP || step === LANGUAGE_FADE_STEP || step < 0 || step >= TOTAL_STEPS) return;
    const prevStep = prevStepRef.current;
    const isForward = step > prevStep;
    const isInitial = step === 0 && prevStep === 0;
    const fromX = isInitial ? SLIDE_DISTANCE : isForward ? SLIDE_DISTANCE : -SLIDE_DISTANCE;
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
    if (step === PRONUNCIATION_STEP && learningLanguage && languageLevel) {
      const apiDifficulty = LEVEL_TO_DIFFICULTY[languageLevel];
      getPhrases(learningLanguage, undefined, apiDifficulty, 1)
        .then((phrases) => setPronunciationPhrase(phrases[0] ?? null))
        .catch(() => setPronunciationPhrase(null));
    } else if (step !== PRONUNCIATION_STEP) {
      setPronunciationPhrase(null);
    }
  }, [step, learningLanguage, languageLevel]);

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
        Animated.timing(planItemOpacities[0], { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(planItemTranslateX[0], { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
      Animated.delay(120),
      Animated.parallel([
        Animated.timing(planItemOpacities[1], { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(planItemTranslateX[1], { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
      Animated.delay(120),
      Animated.parallel([
        Animated.timing(planItemOpacities[2], { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(planItemTranslateX[2], { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    ]).start();
  }, [step, planTitleOpacity, planTitleTranslateY, planSubtitleOpacity, planCardOpacity, planCardTranslateY, planItemOpacities, planItemTranslateX]);

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
              source={require('../../assets/lottie/hi.json')}
              autoPlay
              loop
              style={styles.welcomeLottie}
            />
            <Animated.Text style={[styles.welcomeTitle, { opacity: welcomeFadeAnim }]}>
              Hi {name.trim()},
            </Animated.Text>
            <Animated.Text style={[styles.welcomeSubtitle, { opacity: welcomeFadeAnim }]}>
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
                style={[styles.option, learningLanguage === code && styles.optionSelected]}
                onPress={() => setLearningLanguage(code)}
                activeOpacity={0.7}
              >
                <Text style={styles.optionFlag}>{flag}</Text>
                <Text style={[styles.optionText, learningLanguage === code && styles.optionTextSelected]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </>
        );
      case LANGUAGE_FADE_STEP:
        return (
          <View style={styles.welcomeContainer}>
            <Animated.Text style={[styles.fadeScreenText, { opacity: languageFadeAnim }]}>
              {learningLanguage ? LANGUAGE_FADE_TEXTS[learningLanguage] : ''}
            </Animated.Text>
          </View>
        );
      case 4:
        return (
          <>
            <Text style={styles.title}>
              What is your {learningLanguage ? LANGUAGE_LABELS[learningLanguage] : 'language'} level?
            </Text>
            {LEVELS.map(({ value, label }) => (
              <TouchableOpacity
                key={value}
                style={[styles.option, languageLevel === value && styles.optionSelected]}
                onPress={() => setLanguageLevel(value)}
                activeOpacity={0.7}
              >
                <Text style={[styles.optionText, languageLevel === value && styles.optionTextSelected]}>{label}</Text>
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
                style={[styles.option, nativeLanguage === code && styles.optionSelected]}
                onPress={() => setNativeLanguage(code)}
                activeOpacity={0.7}
              >
                <Text style={styles.optionFlag}>{flag}</Text>
                <Text style={[styles.optionText, nativeLanguage === code && styles.optionTextSelected]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </>
        );
      case 7:
        return (
          <>
            <Text style={styles.title}>
              Why do you want to improve speaking {learningLanguage ? LANGUAGE_LABELS[learningLanguage] : 'your language'}?
            </Text>
            {MOTIVATIONS.map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.option, motivation === m && styles.optionSelected]}
                onPress={() => setMotivation(m)}
                activeOpacity={0.7}
              >
                <Text style={[styles.optionText, motivation === m && styles.optionTextSelected]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </>
        );
      case 8:
        return (
          <>
            <Text style={styles.title}>What is your age?</Text>
            {AGE_RANGES.map(({ value, label }) => (
              <TouchableOpacity
                key={value}
                style={[styles.option, ageRange === value && styles.optionSelected]}
                onPress={() => setAgeRange(value)}
                activeOpacity={0.7}
              >
                <Text style={[styles.optionText, ageRange === value && styles.optionTextSelected]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </>
        );
      case 9:
        return (
          <>
            <Text style={styles.title}>
              How fast do you want to learn {learningLanguage ? LANGUAGE_LABELS[learningLanguage] : 'your language'}?
            </Text>
            {LEARNING_SPEED_OPTIONS.map(({ value, label }) => (
              <TouchableOpacity
                key={value}
                style={[styles.option, learningSpeed === value && styles.optionSelected]}
                onPress={() => setLearningSpeed(value)}
                activeOpacity={0.7}
              >
                <Text style={[styles.optionText, learningSpeed === value && styles.optionTextSelected]}>{label}</Text>
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
          plan.sessionsPerWeek === 'Daily' ? 'Practice daily' : `${plan.sessionsPerWeek} per week`,
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
              {userName ? `${userName}'s ` : 'Your '}{langLabel} Learning Plan
            </Animated.Text>
            <Animated.Text
              style={[
                styles.planSubtitle,
                { opacity: planSubtitleOpacity },
              ]}
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
      case CREATING_PLAN_STEP:
        return null;
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

  if (step === PRONUNCIATION_STEP) {
    return (
      <OnboardingPronunciationStep
        phrase={pronunciationPhrase}
        nativeLanguage={nativeLanguage ?? 'en'}
        targetLang={learningLanguage ?? 'es'}
        onBack={handleBack}
        onSkip={handleNext}
        onContinue={handleNext}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
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
          <View style={[styles.progressBar, { width: `${((step + 1) / TOTAL_STEPS) * 100}%` as any }]} />
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
              {step === PLAN_DISPLAY_STEP ? 'Get Started' : 'Continue'}
            </Text>
          </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  fadeScreenContainer: {
    backgroundColor: '#29B6F6',
  },
  scrollContent: {
    padding: 20,
    paddingTop: 52,
    paddingBottom: 24,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#29B6F6',
  },
  progress: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(28,25,23,0.1)',
    marginBottom: 32,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#29B6F6',
    borderRadius: 2,
  },
  title: {
    fontFamily: 'Georgia',
    fontSize: 26,
    fontWeight: '700',
    color: '#1C1917',
    marginBottom: 24,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  planSubtitle: {
    fontSize: 16,
    color: '#57534E',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    borderWidth: 2,
    borderColor: 'rgba(41, 182, 246, 0.15)',
  },
  planItem: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1917',
    marginBottom: 12,
    lineHeight: 26,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    fontSize: 18,
    color: '#1C1917',
    borderWidth: 2,
    borderColor: 'rgba(41, 182, 246, 0.15)',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'rgba(41, 182, 246, 0.0)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  optionSelected: {
    borderColor: '#29B6F6',
    backgroundColor: 'rgba(41, 182, 246, 0.08)',
  },
  optionFlag: {
    fontSize: 24,
    marginRight: 12,
  },
  optionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1917',
  },
  optionTextSelected: {
    color: '#29B6F6',
  },
  footer: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  button: {
    backgroundColor: '#29B6F6',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#29B6F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: '#A8A29E',
    shadowOpacity: 0.1,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  creatingPlanOverlay: {
    flex: 1,
    backgroundColor: '#29B6F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paywallScreen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  paywallView: {
    flex: 1,
  },
  paywallContinueButton: {
    marginTop: 24,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  paywallContinueText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#29B6F6',
  },
  welcomeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  welcomeLottie: {
    width: 160,
    height: 160,
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  welcomeSubtitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  fadeScreenText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 30,
    paddingHorizontal: 16,
  },
  creatingPlanText: {
    marginTop: 32,
    fontSize: 20,
    fontWeight: '600',
    color: '#F8F9FA',
    fontFamily: 'Georgia',
  },
});

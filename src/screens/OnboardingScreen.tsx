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
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLIDE_DISTANCE = SCREEN_WIDTH * 0.15;
import LottieView from 'lottie-react-native';
import { useApp } from '../context/AppContext';
import type { Language, LanguageLevel, Gender, AgeRange, OnboardingProfile } from '../context/AppContext';
import WaveLogo from '../components/WaveLogo';

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

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const AGE_RANGES: { value: AgeRange; label: string }[] = [
  { value: 'under_20', label: 'Under 20' },
  { value: '20s', label: '20s' },
  { value: '30s', label: '30s' },
  { value: '40s', label: '40s' },
  { value: '50s', label: '50s' },
  { value: '60_plus', label: '60 and above' },
];

const LANGUAGE_LABELS: Record<Language, string> = {
  es: 'Spanish',
  fr: 'French',
  it: 'Italian',
  en: 'English',
};

const TOTAL_STEPS = 9;
const WELCOME_STEP = 1;
const LANGUAGE_FADE_STEP = 3;
const CREATING_PLAN_STEP = 9;
const CREATING_PLAN_DURATION_MS = 2800;
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
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [learningLanguage, setLearningLanguage] = useState<Language | null>(null);
  const [languageLevel, setLanguageLevel] = useState<LanguageLevel | null>(null);
  const [motivation, setMotivation] = useState('');
  const [nativeLanguage, setNativeLanguage] = useState<Language | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  const [ageRange, setAgeRange] = useState<AgeRange | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const stepSlideAnim = useRef(new Animated.Value(0)).current;
  const stepOpacityAnim = useRef(new Animated.Value(1)).current;
  const welcomeFadeAnim = useRef(new Animated.Value(0)).current;
  const languageFadeAnim = useRef(new Animated.Value(0)).current;
  const prevStepRef = useRef(0);
  const welcomeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const languageFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canProceed = () => {
    switch (step) {
      case 0: return name.trim().length > 0;
      case WELCOME_STEP: return true;
      case 2: return learningLanguage !== null;
      case LANGUAGE_FADE_STEP: return true;
      case 4: return languageLevel !== null;
      case 5: return motivation.trim().length > 0;
      case 6: return nativeLanguage !== null;
      case 7: return gender !== null;
      case 8: return ageRange !== null;
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
    } else if (step > 0 && step !== WELCOME_STEP && step !== LANGUAGE_FADE_STEP) {
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
    if (step < TOTAL_STEPS - 1) {
      prevStepRef.current = step;
      setStep(step + 1);
    } else {
      if (!learningLanguage || !languageLevel || !nativeLanguage || !gender || !ageRange) return;
      const profile: OnboardingProfile = {
        name: name.trim(),
        learningLanguage,
        languageLevel,
        motivation: motivation.trim(),
        nativeLanguage,
        gender,
        ageRange,
      };
      await setOnboardingProfile(profile);
      await setLanguage(learningLanguage);
      await setHasCompletedOnboarding(true);
      setStep(CREATING_PLAN_STEP);
    }
  };

  useEffect(() => {
    if (step === CREATING_PLAN_STEP || step === WELCOME_STEP || step === LANGUAGE_FADE_STEP || step < 0 || step >= TOTAL_STEPS) return;
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
    if (step !== CREATING_PLAN_STEP) return;
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(() => {
      navigation.reset({ routes: [{ name: 'Main' }] });
    }, CREATING_PLAN_DURATION_MS);
    return () => clearTimeout(timer);
  }, [step, navigation, fadeAnim]);

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
      case 5:
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
      case 6:
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
            <Text style={styles.title}>What is your gender?</Text>
            {GENDERS.map(({ value, label }) => (
              <TouchableOpacity
                key={value}
                style={[styles.option, gender === value && styles.optionSelected]}
                onPress={() => setGender(value)}
                activeOpacity={0.7}
              >
                <Text style={[styles.optionText, gender === value && styles.optionTextSelected]}>{label}</Text>
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
      case CREATING_PLAN_STEP:
        return (
          <View style={styles.creatingPlan}>
            <WaveLogo />
            <Text style={styles.creatingPlanText}>Creating your personalized plan...</Text>
          </View>
        );
      default:
        return null;
    }
  };

  if (step === CREATING_PLAN_STEP) {
    return (
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.creatingPlanOverlay,
            { opacity: fadeAnim },
          ]}
          pointerEvents="none"
        >
          {renderStep()}
        </Animated.View>
      </View>
    );
  }

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
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View
              key={i}
              style={[styles.progressDot, i <= step && styles.progressDotActive]}
            />
          ))}
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
            {step === TOTAL_STEPS - 1 ? 'Get Started' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  fadeScreenContainer: {
    backgroundColor: '#00877B',
  },
  scrollContent: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 24,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00877B',
  },
  progress: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 32,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e2e8f0',
  },
  progressDotActive: {
    backgroundColor: '#00877B',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
    fontSize: 18,
    color: '#0f172a',
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  optionSelected: {
    borderColor: '#00877B',
    backgroundColor: '#e6f7f6',
  },
  optionFlag: {
    fontSize: 24,
    marginRight: 12,
  },
  optionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  optionTextSelected: {
    color: '#00877B',
  },
  footer: {
    padding: 24,
    paddingBottom: 40,
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  button: {
    backgroundColor: '#00877B',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#94a3b8',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  creatingPlanOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#00877B',
    alignItems: 'center',
    justifyContent: 'center',
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
  creatingPlan: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatingPlanText: {
    marginTop: 32,
    fontSize: 20,
    fontWeight: '600',
    color: '#F8F9FA',
    fontFamily: 'Georgia',
  },
});

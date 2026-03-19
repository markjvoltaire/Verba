import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Pressable,
  Alert,
  ScrollView,
  Animated,
  Dimensions,
} from "react-native";
import React, { useEffect, useRef, useState, useCallback } from "react";
import LottieView from "lottie-react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useAudioPlayer,
  useAudioRecorder,
  RecordingPresets,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
} from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { Asset } from "expo-asset";
import WaveLogo from "../components/WaveLogo";
import { getPhrases, Phrase } from "../api/phrases";
import { getLessonIntro } from "../api/lesson";
import { getSpeechStreamUrl } from "../api/tts";
import { evaluateSpeech } from "../api/speech";
import { getFeedbackPhrases } from "../constants/feedbackPhrases";
import { useApp } from "../context/AppContext";
import { useSavedPhrases } from "../context/SavedPhrasesContext";
import { useLessonProgress } from "../context/LessonProgressContext";
import { useStreak } from "../context/StreakContext";
import { useUsage } from "../context/UsageContext";

const GOOD_JOB_SOUND = require("../../assets/sound/Verba-GoodJob.wav");
const TRY_AGAIN_SOUND = require("../../assets/sound/Verba-TryAgain.wav");
const LESSON_LOADER_SOUND = require("../../assets/sound/LessonLoader1.wav");
const CONFETTI_LOTTIE = require("../../assets/lottie/confetti.json");

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const LESSON_LABELS: Record<string, string> = {
  small_talk: "First connection",
  restaurant: "Ordering a meal",
  airport: "At the airport",
  hotel: "At the hotel",
  dating: "Dating",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

const TTS_LANG: Record<string, string> = {
  es: "es",
  fr: "fr",
  it: "it",
  en: "en",
};

const SCORE_THRESHOLD = 70;
const INTRO_SPEAKING_BLUE = "#1D4ED8";
const CORRECT_BG_GREEN = "#16A34A";

function LoaderDot({ delay }: { delay: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: -7,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.delay(Math.max(0, 560 - delay)),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim, delay]);
  return (
    <Animated.View
      style={[loaderDotStyle, { transform: [{ translateY: anim }] }]}
    />
  );
}
const loaderDotStyle = {
  width: 8,
  height: 8,
  borderRadius: 4,
  backgroundColor: "#FFFFFF",
  opacity: 0.9,
};

type Phase =
  | "loading"
  | "intro"
  | "prompt"
  | "listening"
  | "evaluating"
  | "correct"
  | "incorrect"
  | "complete";

function handleBack(navigation: {
  goBack: () => void;
  canGoBack?: () => boolean;
  navigate: (screen: string) => void;
}) {
  if (navigation.canGoBack?.()) {
    navigation.goBack();
  } else {
    navigation.navigate("LessonSelect");
  }
}

function safePause(p: { pause?: () => void } | null | undefined) {
  try {
    p?.pause?.();
  } catch {
    // Native object may be disposed on unmount
  }
}

export default function PracticeScreen({
  navigation,
  route,
}: {
  navigation: {
    goBack: () => void;
    canGoBack?: () => boolean;
    navigate: (screen: string) => void;
  };
  route: { params?: { scenario?: string; difficulty?: string } };
}) {
  const insets = useSafeAreaInsets();
  const { language, onboardingProfile } = useApp();
  const {
    addToFlashcards,
    removeFromFlashcards,
    isInFlashcards,
    getFlashcardForPhrase,
  } = useSavedPhrases();
  const { recordUsage } = useUsage();
  const { recordPhrasePractice } = useStreak();
  const { completedByScenario, recordPhraseCompleted } = useLessonProgress();
  const completedByScenarioRef = useRef(completedByScenario);
  const scenario = route.params?.scenario ?? "";
  const difficulty = route.params?.difficulty ?? "medium";
  const lessonLabel = LESSON_LABELS[scenario] ?? scenario;
  const difficultyLabel = DIFFICULTY_LABELS[difficulty] ?? difficulty;

  const nativeLang = onboardingProfile?.nativeLanguage ?? "en";
  const targetLang = language;

  const [phase, setPhase] = useState<Phase>("loading");
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [intro, setIntro] = useState<{
    greeting: string;
    explanation: string;
  } | null>(null);
  const [feedback, setFeedback] = useState<{
    transcription: string;
    feedback: string;
    score: number;
  } | null>(null);
  const [ttsUri, setTtsUri] = useState<string | null>(null);
  const [buttonScale, setButtonScale] = useState(1);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [replayLoading, setReplayLoading] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [introWordIndex, setIntroWordIndex] = useState(-1);
  const introStartRef = useRef<number | null>(null);
  const [goodJobUri, setGoodJobUri] = useState<string | null>(null);
  const [tryAgainUri, setTryAgainUri] = useState<string | null>(null);
  const [lessonLoaderUri, setLessonLoaderUri] = useState<string | null>(null);

  const promptOpacity = useRef(new Animated.Value(0)).current;
  const promptTranslateY = useRef(new Animated.Value(16)).current;
  const orbitRotation = useRef(new Animated.Value(0)).current;
  const speakingBgOpacity = useRef(new Animated.Value(0)).current;
  const correctBgOpacity = useRef(new Animated.Value(0)).current;
  const evaluatingSpin = useRef(new Animated.Value(0)).current;
  const idleHoldPulse = useRef(new Animated.Value(1)).current;
  const idleHoldPulseAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const player = useAudioPlayer(ttsUri ? { uri: ttsUri } : null);
  const goodJobPlayer0 = useAudioPlayer(
    goodJobUri ? { uri: goodJobUri } : null,
  );
  const goodJobPlayer1 = useAudioPlayer(
    goodJobUri ? { uri: goodJobUri } : null,
  );
  const tryAgainPlayer0 = useAudioPlayer(
    tryAgainUri ? { uri: tryAgainUri } : null,
  );
  const tryAgainPlayer1 = useAudioPlayer(
    tryAgainUri ? { uri: tryAgainUri } : null,
  );
  const lessonLoaderPlayer = useAudioPlayer(
    lessonLoaderUri ? { uri: lessonLoaderUri } : null,
  );
  const goodJobPlayIndexRef = useRef(0);
  const tryAgainPlayIndexRef = useRef(0);
  const goodJobPlayerToPlayRef = useRef<{ play: () => void } | null>(null);
  const tryAgainPlayerToPlayRef = useRef<{ play: () => void } | null>(null);

  useEffect(() => {
    Asset.loadAsync(GOOD_JOB_SOUND).then(([asset]) => {
      setGoodJobUri(asset.localUri ?? asset.uri);
    });
    Asset.loadAsync(TRY_AGAIN_SOUND).then(([asset]) => {
      setTryAgainUri(asset.localUri ?? asset.uri);
    });
    Asset.loadAsync(LESSON_LOADER_SOUND).then(([asset]) => {
      setLessonLoaderUri(asset.localUri ?? asset.uri);
    });
  }, []);

  const showLoader =
    phase === "loading" || (phase === "intro" && !ttsPlaying && intro != null);

  useEffect(() => {
    if (!lessonLoaderUri || !lessonLoaderPlayer) return;
    if (showLoader) {
      let cancelled = false;
      setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldRouteThroughEarpiece: false,
      }).then(() => {
        if (!cancelled) {
          lessonLoaderPlayer.loop = true;
          lessonLoaderPlayer.seekTo(0);
          lessonLoaderPlayer.play();
        }
      });
      return () => {
        cancelled = true;
        safePause(lessonLoaderPlayer);
      };
    } else {
      safePause(lessonLoaderPlayer);
    }
  }, [showLoader, lessonLoaderUri, lessonLoaderPlayer]);

  const ttsQueueRef = useRef<{ text: string; lang: string }[]>([]);
  const isPlayingRef = useRef(false);
  const onTtsCompleteRef = useRef<(() => void) | null>(null);
  const phraseIndexRef = useRef(0);
  const hasStartedIntroRef = useRef(false);
  const phraseCacheRef = useRef<{
    text: string;
    fileUri: string;
    index: number;
  } | null>(null);
  const recordStartTimeRef = useRef<number | null>(null);
  phraseIndexRef.current = phraseIndex;

  const phrase = phrases[phraseIndex];
  const feedbackPhrases = getFeedbackPhrases(nativeLang);

  useEffect(() => {
    if (phase === "prompt") {
      promptOpacity.setValue(0);
      promptTranslateY.setValue(16);
      Animated.parallel([
        Animated.timing(promptOpacity, {
          toValue: 1,
          duration: 320,
          useNativeDriver: true,
        }),
        Animated.timing(promptTranslateY, {
          toValue: 0,
          duration: 320,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [phase, phraseIndex, promptOpacity, promptTranslateY]);

  // When the user starts speaking, show the phrase card immediately.
  // (The prompt animation only runs for `phase === "prompt"`, so `phase === "listening"`
  // could otherwise render with `opacity=0`.)
  useEffect(() => {
    if (phase === "listening") {
      promptOpacity.setValue(1);
      promptTranslateY.setValue(0);
    }
  }, [phase, promptOpacity, promptTranslateY]);

  useEffect(() => {
    const isBlueBackground =
      phase === "prompt" ||
      phase === "listening" ||
      phase === "evaluating" ||
      (phase === "intro" && ttsPlaying && intro != null);
    Animated.timing(speakingBgOpacity, {
      toValue: isBlueBackground ? 1 : 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [phase, ttsPlaying, intro, speakingBgOpacity]);

  useEffect(() => {
    Animated.timing(correctBgOpacity, {
      toValue: phase === "correct" ? 1 : 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [phase, correctBgOpacity]);

  useEffect(() => {
    if (phase === "listening") {
      orbitRotation.setValue(0);
      const loop = Animated.loop(
        Animated.timing(orbitRotation, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      );
      loop.start();
      return () => loop.stop();
    }
  }, [phase, orbitRotation]);

  useEffect(() => {
    if (phase !== "evaluating") {
      evaluatingSpin.stopAnimation();
      evaluatingSpin.setValue(0);
      return;
    }

    evaluatingSpin.setValue(0);
    const loop = Animated.loop(
      Animated.timing(evaluatingSpin, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
    );

    loop.start();
    return () => loop.stop();
  }, [phase, evaluatingSpin]);

  useEffect(() => {
    const shouldPulse =
      phase === "prompt" && !ttsPlaying && !replayLoading && Boolean(phrase);

    if (!shouldPulse) {
      idleHoldPulseAnimRef.current?.stop();
      idleHoldPulseAnimRef.current = null;
      idleHoldPulse.setValue(phase === "listening" ? 1.1 : 1);
      return;
    }

    idleHoldPulse.setValue(1);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(idleHoldPulse, {
          toValue: 1.01,
          duration: 950,
          useNativeDriver: true,
        }),
        Animated.timing(idleHoldPulse, {
          toValue: 0.995,
          duration: 950,
          useNativeDriver: true,
        }),
      ]),
    );

    idleHoldPulseAnimRef.current = loop;
    loop.start();

    return () => {
      loop.stop();
      if (idleHoldPulseAnimRef.current === loop) {
        idleHoldPulseAnimRef.current = null;
      }
    };
  }, [phase, ttsPlaying, replayLoading, idleHoldPulse, phrase]);

  const playTts = useCallback(async (text: string, lang: string) => {
    if (!text.trim()) return;
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      shouldRouteThroughEarpiece: false,
    });
    const uri = getSpeechStreamUrl(
      text.trim(),
      "marin",
      TTS_LANG[lang] || lang,
    );
    setTtsUri(uri);
    isPlayingRef.current = true;
  }, []);

  const queueTts = useCallback((text: string, lang: string) => {
    if (!text.trim()) return;
    ttsQueueRef.current.push({ text: text.trim(), lang });
  }, []);

  const playNextInQueue = useCallback(() => {
    const next = ttsQueueRef.current.shift();
    if (next) {
      playTts(next.text, next.lang);
    } else {
      isPlayingRef.current = false;
      setTtsPlaying(false);
      onTtsCompleteRef.current?.();
      onTtsCompleteRef.current = null;
    }
  }, [playTts]);

  useEffect(() => {
    completedByScenarioRef.current = completedByScenario;
  }, [completedByScenario]);

  useEffect(() => {
    if (scenario) {
      hasStartedIntroRef.current = false;
      Promise.all([
        getPhrases(language, scenario, difficulty),
        getLessonIntro(scenario, nativeLang, targetLang),
      ])
        .then(([phrasesData, introData]) => {
          const completed = completedByScenarioRef.current[scenario] || {};
          const reordered = [
            ...phrasesData.filter((p) => !completed[p.id]),
            ...phrasesData.filter((p) => completed[p.id]),
          ];
          setPhrases(reordered);
          setIntro(introData);
          setPhase("intro");
        })
        .catch((err) => {
          console.error(err);
          Alert.alert("Error", "Could not load lesson. Please try again.");
        });
    }
  }, [scenario, difficulty, language, nativeLang, targetLang]);

  useEffect(() => {
    (async () => {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert(
          "Permission needed",
          "Microphone access is required for speaking practice.",
        );
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldRouteThroughEarpiece: false,
      });
    })();
  }, []);

  useEffect(() => {
    if (!player || !ttsUri) return;
    const sub = player.addListener("playbackStatusUpdate", (status) => {
      if (status.isLoaded && !status.playing && !status.didJustFinish) {
        player.play();
      }
      if (status.playing) {
        setTtsPlaying(true);
        setReplayLoading(false);
      }
      if (status.didJustFinish) {
        setTtsPlaying(false);
        setReplayLoading(false);
        setCurrentWordIndex(-1);
        setTtsUri(null);
        isPlayingRef.current = false;
        playNextInQueue();
      }
    });
    return () => sub.remove();
  }, [player, ttsUri, playNextInQueue]);

  useEffect(() => {
    if (!goodJobPlayer0 || !goodJobUri) return;
    const sub = goodJobPlayer0.addListener("playbackStatusUpdate", (status) => {
      if (
        goodJobPlayerToPlayRef.current === goodJobPlayer0 &&
        status.isLoaded &&
        !status.playing &&
        !status.didJustFinish
      ) {
        goodJobPlayer0.play();
        goodJobPlayerToPlayRef.current = null;
      }
      if (status.playing) setTtsPlaying(true);
      if (status.didJustFinish) setTtsPlaying(false);
    });
    return () => sub.remove();
  }, [goodJobPlayer0, goodJobUri]);

  useEffect(() => {
    if (!goodJobPlayer1 || !goodJobUri) return;
    const sub = goodJobPlayer1.addListener("playbackStatusUpdate", (status) => {
      if (
        goodJobPlayerToPlayRef.current === goodJobPlayer1 &&
        status.isLoaded &&
        !status.playing &&
        !status.didJustFinish
      ) {
        goodJobPlayer1.play();
        goodJobPlayerToPlayRef.current = null;
      }
      if (status.playing) setTtsPlaying(true);
      if (status.didJustFinish) setTtsPlaying(false);
    });
    return () => sub.remove();
  }, [goodJobPlayer1, goodJobUri]);

  useEffect(() => {
    if (!tryAgainPlayer0 || !tryAgainUri) return;
    const sub = tryAgainPlayer0.addListener(
      "playbackStatusUpdate",
      (status) => {
        if (
          tryAgainPlayerToPlayRef.current === tryAgainPlayer0 &&
          status.isLoaded &&
          !status.playing &&
          !status.didJustFinish
        ) {
          tryAgainPlayer0.play();
          tryAgainPlayerToPlayRef.current = null;
        }
        if (status.playing) setTtsPlaying(true);
        if (status.didJustFinish) {
          setTtsPlaying(false);
          onTtsCompleteRef.current?.();
          onTtsCompleteRef.current = null;
        }
      },
    );
    return () => sub.remove();
  }, [tryAgainPlayer0, tryAgainUri]);

  useEffect(() => {
    if (!tryAgainPlayer1 || !tryAgainUri) return;
    const sub = tryAgainPlayer1.addListener(
      "playbackStatusUpdate",
      (status) => {
        if (
          tryAgainPlayerToPlayRef.current === tryAgainPlayer1 &&
          status.isLoaded &&
          !status.playing &&
          !status.didJustFinish
        ) {
          tryAgainPlayer1.play();
          tryAgainPlayerToPlayRef.current = null;
        }
        if (status.playing) setTtsPlaying(true);
        if (status.didJustFinish) {
          setTtsPlaying(false);
          onTtsCompleteRef.current?.();
          onTtsCompleteRef.current = null;
        }
      },
    );
    return () => sub.remove();
  }, [tryAgainPlayer1, tryAgainUri]);

  const playGoodJobSound = useCallback(async () => {
    if (!goodJobUri) return;
    const idx = goodJobPlayIndexRef.current % 2;
    const p = idx === 0 ? goodJobPlayer0 : goodJobPlayer1;
    if (!p) return;
    safePause(player);
    safePause(tryAgainPlayer0);
    safePause(tryAgainPlayer1);
    setTtsUri(null);
    ttsQueueRef.current = [];
    isPlayingRef.current = false;
    setTtsPlaying(false);
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      shouldRouteThroughEarpiece: false,
    });
    goodJobPlayIndexRef.current += 1;
    goodJobPlayerToPlayRef.current = p;
    p.seekTo(0);
  }, [
    goodJobUri,
    goodJobPlayer0,
    goodJobPlayer1,
    player,
    tryAgainPlayer0,
    tryAgainPlayer1,
  ]);

  const playTryAgainSound = useCallback(async () => {
    if (!tryAgainUri) return;
    const idx = tryAgainPlayIndexRef.current % 2;
    const p = idx === 0 ? tryAgainPlayer0 : tryAgainPlayer1;
    if (!p) return;
    safePause(player);
    safePause(goodJobPlayer0);
    safePause(goodJobPlayer1);
    setTtsUri(null);
    ttsQueueRef.current = [];
    isPlayingRef.current = false;
    setTtsPlaying(false);
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      shouldRouteThroughEarpiece: false,
    });
    tryAgainPlayIndexRef.current += 1;
    tryAgainPlayerToPlayRef.current = p;
    p.seekTo(0);
  }, [
    tryAgainUri,
    tryAgainPlayer0,
    tryAgainPlayer1,
    player,
    goodJobPlayer0,
    goodJobPlayer1,
  ]);

  const sayPhrasePrefix = getFeedbackPhrases(targetLang).sayPhrase;
  const phraseStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (ttsPlaying && phase === "prompt" && phrase) {
      phraseStartRef.current = Date.now();
    } else {
      phraseStartRef.current = null;
    }
  }, [ttsPlaying, phase, phrase]);

  useEffect(() => {
    if (!ttsPlaying || phase !== "prompt" || !phrase) {
      setCurrentWordIndex(-1);
      return;
    }
    const words = phrase.phrase.split(/\s+/).filter(Boolean);
    if (words.length === 0) return;

    const msPerChar = 100;
    const prefixMs = sayPhrasePrefix.length * msPerChar;
    const phraseMs = phrase.phrase.length * msPerChar;
    const wordMs = phraseMs / words.length;

    const interval = setInterval(() => {
      const start = phraseStartRef.current;
      if (!start) return;

      const elapsed = Date.now() - start;
      const elapsedInPhrase = elapsed - prefixMs;

      if (elapsedInPhrase < 0) {
        setCurrentWordIndex(-1);
        return;
      }

      const newIndex = Math.min(
        Math.floor(elapsedInPhrase / wordMs),
        words.length - 1,
      );
      setCurrentWordIndex(Math.max(0, newIndex));
    }, 70);

    return () => clearInterval(interval);
  }, [ttsPlaying, phase, phrase, sayPhrasePrefix]);

  const playPromptForPhrase = useCallback(
    (index: number) => {
      const p = phrases[index];
      if (!p) return;
      const sayPhrase = getFeedbackPhrases(targetLang).sayPhrase;
      const text = sayPhrase + p.phrase;
      queueTts(text, targetLang);
      playNextInQueue();

      const streamUrl = getSpeechStreamUrl(
        text,
        "marin",
        TTS_LANG[targetLang] || targetLang,
      );
      const cachePath = `${FileSystem.cacheDirectory}phrase_replay.mp3`;
      FileSystem.downloadAsync(streamUrl, cachePath)
        .then(({ uri }) => {
          phraseCacheRef.current = { text, fileUri: uri, index };
        })
        .catch(() => {
          phraseCacheRef.current = null;
        });
    },
    [phrases, targetLang, queueTts, playNextInQueue],
  );

  const handleContinue = useCallback(async () => {
    const next = phraseIndex + 1;
    if (next < phrases.length) {
      setPhraseIndex(next);
      setFeedback(null);
      setPhase("prompt");
      playPromptForPhrase(next);
    } else {
      setPhase("complete");
    }
  }, [phraseIndex, phrases.length, playPromptForPhrase]);

  const handleFlashcardsToggle = useCallback(async () => {
    if (!phrase) return;
    const saved = getFlashcardForPhrase(phrase.id);
    if (saved) {
      await removeFromFlashcards(saved.id);
    } else {
      await addToFlashcards(phrase);
    }
  }, [phrase, addToFlashcards, removeFromFlashcards, getFlashcardForPhrase]);

  const handleReplay = useCallback(() => {
    if (ttsPlaying || phase === "listening" || !phrase) return;
    setReplayLoading(true);
    const sayPhrase = getFeedbackPhrases(targetLang).sayPhrase;
    const text = sayPhrase + phrase.phrase;
    const cached = phraseCacheRef.current;
    if (cached && cached.text === text && cached.index === phraseIndex) {
      setTtsUri(cached.fileUri);
    } else {
      playPromptForPhrase(phraseIndex);
    }
  }, [ttsPlaying, phase, phrase, phraseIndex, targetLang, playPromptForPhrase]);

  useEffect(() => {
    if (
      phase === "intro" &&
      intro &&
      !hasStartedIntroRef.current &&
      ttsQueueRef.current.length === 0 &&
      !isPlayingRef.current
    ) {
      hasStartedIntroRef.current = true;
      introStartRef.current = Date.now();
      setIntroWordIndex(-1);
      const combinedIntro = [intro.greeting, intro.explanation]
        .filter(Boolean)
        .join(" ");
      queueTts(combinedIntro, nativeLang);
      onTtsCompleteRef.current = () => {
        setPhase("prompt");
        setPhraseIndex(0);
        playPromptForPhrase(0);
      };
      playNextInQueue();
    }
  }, [
    phase,
    intro,
    nativeLang,
    queueTts,
    playNextInQueue,
    playPromptForPhrase,
  ]);

  // Track which intro word is currently being spoken
  useEffect(() => {
    if (phase !== "intro" || !ttsPlaying || !intro) {
      setIntroWordIndex(-1);
      introStartRef.current = null;
      return;
    }
    const fullText = [intro.greeting, intro.explanation]
      .filter(Boolean)
      .join(" ");
    const words = fullText.split(/\s+/).filter(Boolean);
    if (words.length === 0) return;

    const msPerChar = 95;
    const totalMs = fullText.length * msPerChar;
    const wordMs = totalMs / words.length;

    const interval = setInterval(() => {
      const start = introStartRef.current;
      if (!start) return;
      const elapsed = Date.now() - start;
      const idx = Math.min(Math.floor(elapsed / wordMs), words.length - 1);
      setIntroWordIndex(Math.max(0, idx));
    }, 60);

    return () => clearInterval(interval);
  }, [phase, ttsPlaying, intro]);

  const handlePressIn = async () => {
    if (phase !== "prompt" || !phrase || ttsPlaying) return;
    setPhase("listening");
    idleHoldPulse.setValue(1.1); // Make the hold button subtly “pop” while pressing.
    setFeedback(null);
    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldRouteThroughEarpiece: false,
      });
      await audioRecorder.prepareToRecordAsync();
      recordStartTimeRef.current = Date.now();
      audioRecorder.record();
    } catch (err) {
      console.error("Failed to start recording:", err);
      Alert.alert("Error", "Could not start recording.");
      setPhase("prompt");
    }
  };

  const handlePressOut = async () => {
    if (phase !== "listening" || !audioRecorder.isRecording) return;
    idleHoldPulse.setValue(1); // Reset when user releases.
    setPhase("evaluating");
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (!uri) throw new Error("No recording URI");
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: "base64",
      });
      if (recordStartTimeRef.current != null) {
        const seconds = Math.ceil(
          (Date.now() - recordStartTimeRef.current) / 1000,
        );
        await recordUsage(seconds);
        recordStartTimeRef.current = null;
      }
      const result = await evaluateSpeech(base64, phrase!.phrase);
      setFeedback(result);
      if (result.score >= SCORE_THRESHOLD) {
        await recordPhrasePractice();
        if (scenario && phrase?.id) {
          await recordPhraseCompleted(scenario, phrase.id);
        }
        setPhase("correct");
        if (goodJobUri) {
          playGoodJobSound();
        } else {
          queueTts(feedbackPhrases.correct, nativeLang);
          playNextInQueue();
        }
      } else {
        setPhase("incorrect");
        if (tryAgainUri) {
          playTryAgainSound();
        } else {
          queueTts(result.feedback || feedbackPhrases.tryAgain, nativeLang);
          playNextInQueue();
        }
      }
    } catch (err) {
      console.error("Evaluate error:", err);
      Alert.alert(
        "Error",
        "Could not evaluate pronunciation. Please try again.",
      );
      setPhase("prompt");
    }
  };

  if (showLoader) {
    return (
      <View
        style={[styles.container, { backgroundColor: INTRO_SPEAKING_BLUE }]}
      >
        <TouchableOpacity
          style={[
            styles.backButton,
            styles.backButtonAbsolute,
            { top: insets.top + 8 },
          ]}
          onPress={() => handleBack(navigation)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={[styles.backText, { color: "#FFFFFF" }]}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.loadingContainer}>
          <View style={styles.loaderCard}>
            <WaveLogo fill="#FFFFFF" animated />

            <Text style={[styles.loaderLesson, { color: "#FFFFFF" }]}>
              {lessonLabel}
            </Text>

            <View
              style={[
                styles.loaderBadge,
                difficulty === "easy" && styles.loaderBadgeEasy,
                difficulty === "medium" && styles.loaderBadgeMedium,
                difficulty === "hard" && styles.loaderBadgeHard,
              ]}
            >
              <Text
                style={[
                  styles.loaderBadgeText,
                  difficulty === "easy" && styles.loaderBadgeTextEasy,
                  difficulty === "medium" && styles.loaderBadgeTextMedium,
                  difficulty === "hard" && styles.loaderBadgeTextHard,
                ]}
              >
                {difficultyLabel}
              </Text>
            </View>

            <Text style={styles.loaderStatus}>
              {phase === "intro" ? "Preparing audio…" : "Loading lesson…"}
            </Text>

            <View style={styles.loaderDots}>
              {[0, 1, 2].map((i) => (
                <LoaderDot key={i} delay={i * 160} />
              ))}
            </View>
          </View>
        </View>
      </View>
    );
  }

  const isBlueBackground =
    phase === "prompt" ||
    phase === "listening" ||
    phase === "evaluating" ||
    (phase === "intro" && ttsPlaying && intro != null);
  const isCorrectBackground = phase === "correct";

  return (
    <View
      style={[
        styles.container,
        (isBlueBackground || isCorrectBackground) && {
          // Prevent a white/gray flash before the animated overlay opacity updates.
          backgroundColor: INTRO_SPEAKING_BLUE,
        },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: INTRO_SPEAKING_BLUE, opacity: speakingBgOpacity },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: CORRECT_BG_GREEN, opacity: correctBgOpacity },
        ]}
      />
      {/* ── TOP BAR ── */}
      <View
        style={[
          styles.topBar,
          { paddingTop: insets.top },
          (isBlueBackground || isCorrectBackground) && {
            backgroundColor: "transparent",
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => handleBack(navigation)}
          hitSlop={12}
          activeOpacity={0.7}
          style={styles.backBtn}
        >
          <Ionicons
            name="chevron-back"
            size={20}
            color={
              isBlueBackground || isCorrectBackground ? "#FFFFFF" : "#374151"
            }
          />
        </TouchableOpacity>
        <View style={styles.topBarCenter}>
          <Text
            style={[
              styles.topBarText,
              isBlueBackground || isCorrectBackground
                ? { color: "#FFFFFF" }
                : null,
            ]}
          >
            {lessonLabel}
          </Text>
          {phrases.length > 0 && phase !== "complete" && (
            <Text
              style={[
                styles.topBarSub,
                isBlueBackground || isCorrectBackground
                  ? { color: "#BFDBFE" }
                  : null,
              ]}
            >
              {Math.min(phraseIndex + 1, phrases.length)} / {phrases.length}
            </Text>
          )}
        </View>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.mainContent}>
        {phase === "intro" && ttsPlaying && intro ? (
          <ScrollView
            style={styles.introSpeakingContainer}
            contentContainerStyle={styles.introSpeakingContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.speakingWaveWrapper}>
              <WaveLogo fill="#FFFFFF" animated={ttsPlaying} />
            </View>
          </ScrollView>
        ) : (
          <View style={[styles.scrollContent, { paddingBottom: 24 }]}>
            {/* During "prompt" we already have the phrase card on screen, so
            we don't need a separate speaking indicator pills. */}

            {/* ── PHRASE CARD ── */}
            {(phase === "prompt" || phase === "listening") && phrase && (
              <Animated.View
                style={[
                  styles.phraseCard,
                  {
                    opacity: promptOpacity,
                    transform: [{ translateY: promptTranslateY }],
                  },
                ]}
              >
                {/* Card header: label + listen icon */}
                <View style={styles.phraseCardHeader}>
                  {!ttsPlaying || phase === "listening" ? (
                    <Text style={styles.phraseLabel}>
                      {phase === "listening" ? "Listening…" : "Say this"}
                    </Text>
                  ) : null}
                  <TouchableOpacity
                    style={[
                      styles.listenIconBtn,
                      (ttsPlaying || phase === "listening") &&
                        styles.listenIconBtnDisabled,
                    ]}
                    onPress={handleReplay}
                    disabled={ttsPlaying || phase === "listening"}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={
                        replayLoading && !ttsPlaying
                          ? "hourglass-outline"
                          : "volume-high"
                      }
                      size={18}
                      color={
                        ttsPlaying || phase === "listening"
                          ? "#D1D5DB"
                          : "#29B6F6"
                      }
                    />
                  </TouchableOpacity>
                </View>

                {/* The phrase (target language) */}
                <Text style={styles.phraseText}>
                  {(phrase.phrase.split(/\s+/).filter(Boolean) as string[]).map(
                    (word, i, words) => (
                      <Text
                        key={i}
                        style={
                          ttsPlaying && i === currentWordIndex
                            ? [styles.phraseText, styles.phraseWordHighlight]
                            : styles.phraseText
                        }
                      >
                        {word}
                        {i < words.length - 1 ? " " : ""}
                      </Text>
                    ),
                  )}
                </Text>

                {/* Divider + translation */}
                {phrase.translation && (
                  <>
                    <View style={styles.phraseDivider} />
                    <Text style={styles.translationLabel}>Translation</Text>
                    <Text style={styles.phraseTranslation}>
                      {phrase.translation}
                    </Text>
                  </>
                )}
              </Animated.View>
            )}

            {/* ── EVALUATING ── */}
            {phase === "evaluating" && (
              <View style={styles.evaluatingSection}>
                <View style={styles.evaluatingIcon}>
                  <Animated.View
                    style={[
                      styles.evaluatingSpinner,
                      {
                        transform: [
                          {
                            rotate: evaluatingSpin.interpolate({
                              inputRange: [0, 1],
                              outputRange: ["0deg", "360deg"],
                            }),
                          },
                        ],
                      },
                    ]}
                  />

                  <View style={styles.evaluatingDotsRow}>
                    <Animated.View
                      style={[
                        styles.evaluatingDot,
                        {
                          opacity: evaluatingSpin.interpolate({
                            inputRange: [0, 0.33, 0.66, 1],
                            outputRange: [0.25, 1, 0.25, 0.25],
                          }),
                        },
                      ]}
                    />
                    <Animated.View
                      style={[
                        styles.evaluatingDot,
                        {
                          opacity: evaluatingSpin.interpolate({
                            inputRange: [0, 0.33, 0.66, 1],
                            outputRange: [0.25, 0.25, 1, 0.25],
                          }),
                        },
                      ]}
                    />
                    <Animated.View
                      style={[
                        styles.evaluatingDot,
                        {
                          opacity: evaluatingSpin.interpolate({
                            inputRange: [0, 0.33, 0.66, 1],
                            outputRange: [0.25, 0.25, 0.25, 1],
                          }),
                        },
                      ]}
                    />
                  </View>
                </View>
                <Text style={styles.evaluatingTitle}>Checking…</Text>
                <Text style={styles.evaluatingSub}>
                  Scoring your pronunciation
                </Text>
              </View>
            )}

            {/* ── FEEDBACK ── */}
            {(phase === "correct" || phase === "incorrect") && feedback && (
              <View style={styles.feedbackCard}>
                {/* Score badge */}
                <View
                  style={[
                    styles.scoreBadge,
                    feedback.score >= SCORE_THRESHOLD
                      ? styles.scoreBadgeGood
                      : styles.scoreBadgePoor,
                  ]}
                >
                  <Text
                    style={[
                      styles.scoreNum,
                      feedback.score >= SCORE_THRESHOLD
                        ? styles.scoreNumGood
                        : styles.scoreNumPoor,
                    ]}
                  >
                    {feedback.score}
                  </Text>
                  <Text
                    style={[
                      styles.scoreLabel,
                      feedback.score >= SCORE_THRESHOLD
                        ? styles.scoreNumGood
                        : styles.scoreNumPoor,
                    ]}
                  >
                    / 100
                  </Text>
                </View>

                <Text
                  style={[
                    styles.feedbackHeadline,
                    feedback.score >= SCORE_THRESHOLD
                      ? styles.feedbackHeadlineGood
                      : styles.feedbackHeadlinePoor,
                  ]}
                >
                  {feedback.score >= SCORE_THRESHOLD
                    ? feedbackPhrases.correct
                    : feedback.feedback}
                </Text>

                {feedback.transcription ? (
                  <Text style={styles.feedbackHeard}>
                    Heard: "{feedback.transcription}"
                  </Text>
                ) : null}
              </View>
            )}

            {/* ── COMPLETE ── */}
            {phase === "complete" && (
              <View style={styles.completeSection}>
                <Text style={styles.completeEmoji}>🎉</Text>
                <Text style={styles.completeTitle}>Lesson complete!</Text>
                <Text style={styles.completeSubtitle}>
                  You practiced {phrases.length} phrase
                  {phrases.length !== 1 ? "s" : ""}.
                </Text>
              </View>
            )}
          </View>
        )}

        {(phase === "prompt" || phase === "listening") && (
          <Animated.View
            style={[
              styles.holdButtonFooter,
              { paddingBottom: insets.bottom + 24 },
              {
                opacity: promptOpacity,
                transform: [{ translateY: 0 }],
              },
            ]}
          >
            <View style={styles.holdButtonContainer}>
              {phase === "listening" || (phase === "prompt" && !ttsPlaying) ? (
                <>
                  {phase === "listening" && (
                    <Animated.View
                      style={[
                        styles.orbitRing,
                        {
                          transform: [
                            {
                              rotate: orbitRotation.interpolate({
                                inputRange: [0, 1],
                                outputRange: ["0deg", "360deg"],
                              }),
                            },
                          ],
                        },
                      ]}
                    />
                  )}
                  <Animated.View
                    style={[
                      styles.holdButtonWrapper,
                      {
                        transform: [{ scale: idleHoldPulse }],
                        opacity: ttsPlaying || replayLoading ? 0.5 : 1,
                      },
                    ]}
                  >
                    <Pressable
                      onPressIn={handlePressIn}
                      onPressOut={handlePressOut}
                      disabled={ttsPlaying || replayLoading}
                    >
                      <View style={styles.holdButton} />
                    </Pressable>
                  </Animated.View>
                </>
              ) : null}
            </View>
            <Text style={styles.holdButtonHint}>
              {phase === "listening"
                ? "Release when done"
                : ttsPlaying
                  ? "Listen..."
                  : "Hold to speak"}
            </Text>
          </Animated.View>
        )}
      </View>

      {phase === "correct" && phrase && (
        <View
          style={[styles.bottomSection, { paddingBottom: insets.bottom + 32 }]}
        >
          <View style={styles.correctActions}>
            <TouchableOpacity
              style={styles.tryAgainButton}
              onPress={() => {
                setPhase("prompt");
                setFeedback(null);
                playPromptForPhrase(phraseIndexRef.current);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.tryAgainButtonText}>Try again</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.flashcardsButton,
                isInFlashcards(phrase.id) && styles.flashcardsButtonActive,
              ]}
              onPress={handleFlashcardsToggle}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.flashcardsButtonText,
                  isInFlashcards(phrase.id) &&
                    styles.flashcardsButtonTextActive,
                ]}
              >
                {isInFlashcards(phrase.id)
                  ? "Remove from Flashcards"
                  : "Add to Flashcards"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.continueButton}
              onPress={handleContinue}
              activeOpacity={0.7}
            >
              <Text style={styles.continueButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {phase === "incorrect" && phrase && (
        <View
          style={[styles.bottomSection, { paddingBottom: insets.bottom + 32 }]}
        >
          <TouchableOpacity
            style={styles.continueButton}
            onPress={() => {
              setPhase("prompt");
              playPromptForPhrase(phraseIndexRef.current);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.continueButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === "complete" && (
        <View
          style={[styles.bottomSection, { paddingBottom: insets.bottom + 32 }]}
        >
          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => handleBack(navigation)}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === "correct" && (
        <View style={styles.confettiOverlay} pointerEvents="none">
          <LottieView
            source={CONFETTI_LOTTIE}
            autoPlay
            loop={false}
            style={styles.confettiLottie}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0F4F8",
  },
  confettiOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  confettiLottie: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  loaderCard: {
    backgroundColor: "transparent",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    width: "100%",
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    gap: 12,
  },
  loaderLesson: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: -0.3,
    marginTop: 4,
  },
  loaderBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
  },
  loaderBadgeEasy: { backgroundColor: "rgba(22, 163, 74, 0.18)" },
  loaderBadgeMedium: { backgroundColor: "rgba(217, 119, 6, 0.18)" },
  loaderBadgeHard: { backgroundColor: "rgba(220, 38, 38, 0.18)" },
  loaderBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.92)",
  },
  loaderBadgeTextEasy: { color: "#86EFAC" },
  loaderBadgeTextMedium: { color: "#FDBA74" },
  loaderBadgeTextHard: { color: "#FCA5A5" },
  loaderStatus: {
    fontSize: 14,
    color: "#BFDBFE",
    marginTop: 4,
  },
  loaderDots: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  // ── TOP BAR ──────────────────────────────────────────────────────────────────
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#F0F4F8",
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarCenter: {
    flex: 1,
    alignItems: "center",
  },
  topBarText: {
    fontSize: 15,
    color: "#111827",
    fontWeight: "700",
  },
  topBarSub: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 1,
  },
  backButton: {
    minHeight: 36,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonAbsolute: {
    position: "absolute",
    left: 16,
    zIndex: 10,
  },
  backText: {
    fontSize: 16,
    color: "#29B6F6",
    fontWeight: "600",
  },

  // ── SCROLL ───────────────────────────────────────────────────────────────────
  logoSection: {
    marginBottom: 20,
  },

  speakingWaveWrapper: {
    alignItems: "center",
    marginBottom: 0,
  },
  speakingIndicator: {
    alignItems: "center",
    marginBottom: 20,
    gap: 12,
  },
  speakingIndicatorLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#29B6F6",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  introSpeakingContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  introSpeakingContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 0,
    paddingBottom: 0,
  },
  introSpeakingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
  },
  introSpeakingLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#29B6F6",
    letterSpacing: 0.3,
  },
  introWordsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  introWord: {
    fontFamily: "Georgia",
    fontSize: 26,
    lineHeight: 40,
    fontWeight: "400",
    color: "#D1D5DB",
  },
  introWordActive: {
    color: "#1E293B",
    fontWeight: "600",
  },

  // ── PHRASE CARD ───────────────────────────────────────────────────────────────
  phraseCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 16,
  },
  phraseCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  phraseLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  listenIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(41, 182, 246, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  listenIconBtnDisabled: {
    backgroundColor: "#F3F4F6",
  },
  phraseText: {
    fontFamily: "Georgia",
    fontSize: 30,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    letterSpacing: -0.5,
    lineHeight: 40,
  },
  phraseWordHighlight: {
    color: "#29B6F6",
    backgroundColor: "rgba(41, 182, 246, 0.12)",
  },
  phraseDivider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 20,
  },
  translationLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  phraseTranslation: {
    fontSize: 22,
    color: "#374151",
    textAlign: "center",
    lineHeight: 30,
    fontWeight: "500",
  },

  // ── EVALUATING ────────────────────────────────────────────────────────────────
  evaluatingSection: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 16,
  },
  evaluatingIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(41, 182, 246, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  evaluatingSpinner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 4,
    borderColor: "rgba(41, 182, 246, 0.18)",
    borderTopColor: "#29B6F6",
    borderRightColor: "rgba(41, 182, 246, 0.55)",
    backgroundColor: "transparent",
  },
  evaluatingDotsRow: {
    position: "absolute",
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  evaluatingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#29B6F6",
    marginHorizontal: 4,
  },
  evaluatingTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "white",
  },
  evaluatingSub: {
    fontSize: 14,
    color: "#9CA3AF",
  },

  // ── FEEDBACK CARD ─────────────────────────────────────────────────────────────
  feedbackCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
    gap: 12,
    marginBottom: 16,
  },
  scoreBadge: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 2,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 16,
  },
  scoreBadgeGood: { backgroundColor: "rgba(34, 197, 94, 0.1)" },
  scoreBadgePoor: { backgroundColor: "rgba(239, 68, 68, 0.08)" },
  scoreNum: {
    fontSize: 36,
    fontWeight: "800",
  },
  scoreLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  scoreNumGood: { color: "#16A34A" },
  scoreNumPoor: { color: "#DC2626" },
  feedbackHeadline: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  feedbackHeadlineGood: { color: "#111827" },
  feedbackHeadlinePoor: { color: "#374151" },
  feedbackHeard: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    fontStyle: "italic",
  },

  // ── COMPLETE ──────────────────────────────────────────────────────────────────
  completeSection: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  completeEmoji: {
    fontSize: 48,
  },
  completeTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#111827",
  },
  completeSubtitle: {
    fontSize: 16,
    color: "#6B7280",
  },
  mainContent: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  holdButtonFooter: {
    alignItems: "center",
    paddingTop: 16,
    backgroundColor: "transparent",
  },
  bottomSection: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 1,
  },
  holdButtonContainer: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  orbitRing: {
    position: "absolute",
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 2,
    borderColor: "#29B6F6",
    borderStyle: "dashed",
    opacity: 0.8,
  },
  holdButtonWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  holdButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#FFFFFF",
  },
  holdButtonHint: {
    marginTop: 12,
    fontSize: 14,
    color: "white",
    fontWeight: "500",
  },
  correctActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  tryAgainButton: {
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 28,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderWidth: 1.5,
    borderColor: "rgba(41, 182, 246, 0.5)",
  },
  tryAgainButtonText: {
    fontSize: 16,
    color: "#0284C7",
    fontWeight: "600",
  },
  flashcardsButton: {
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 28,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderWidth: 1.5,
    borderColor: "rgba(41, 182, 246, 0.5)",
  },
  flashcardsButtonActive: {
    backgroundColor: "#0EA5E9",
    borderColor: "#0EA5E9",
  },
  flashcardsButtonText: {
    fontSize: 16,
    color: "#0284C7",
    fontWeight: "600",
  },
  flashcardsButtonTextActive: {
    color: "#fff",
  },
  continueButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 28,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  continueButtonText: {
    fontSize: 17,
    color: "#0284C7",
    fontWeight: "700",
  },
  doneButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    backgroundColor: "#29B6F6",
    borderRadius: 24,
  },
  doneButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
});

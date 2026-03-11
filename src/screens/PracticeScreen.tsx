import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  Animated,
  Dimensions,
} from "react-native";
import React, { useEffect, useRef, useState, useCallback } from "react";
import LottieView from "lottie-react-native";
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

const GOOD_JOB_SOUND = require("../../assets/sound/Verba-GoodJob.wav");
const TRY_AGAIN_SOUND = require("../../assets/sound/Verba-TryAgain.wav");
const CONFETTI_LOTTIE = require("../../assets/lottie/confetti.json");

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const LESSON_LABELS: Record<string, string> = {
  small_talk: "First connection",
  restaurant: "Ordering a meal",
  airport: "At the airport",
  hotel: "At the hotel",
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

type Phase =
  | "loading"
  | "intro"
  | "prompt"
  | "listening"
  | "evaluating"
  | "correct"
  | "incorrect"
  | "complete";

export default function PracticeScreen({
  navigation,
  route,
}: {
  navigation: { goBack: () => void };
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
  const [goodJobUri, setGoodJobUri] = useState<string | null>(null);
  const [tryAgainUri, setTryAgainUri] = useState<string | null>(null);

  const promptOpacity = useRef(new Animated.Value(0)).current;
  const promptTranslateY = useRef(new Animated.Value(16)).current;
  const orbitRotation = useRef(new Animated.Value(0)).current;

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const player = useAudioPlayer(ttsUri ? { uri: ttsUri } : null);
  const goodJobPlayer0 = useAudioPlayer(
    goodJobUri ? { uri: goodJobUri } : null
  );
  const goodJobPlayer1 = useAudioPlayer(
    goodJobUri ? { uri: goodJobUri } : null
  );
  const tryAgainPlayer0 = useAudioPlayer(
    tryAgainUri ? { uri: tryAgainUri } : null
  );
  const tryAgainPlayer1 = useAudioPlayer(
    tryAgainUri ? { uri: tryAgainUri } : null
  );
  const goodJobPlayIndexRef = useRef(0);
  const tryAgainPlayIndexRef = useRef(0);

  useEffect(() => {
    Asset.loadAsync(GOOD_JOB_SOUND).then(([asset]) => {
      setGoodJobUri(asset.localUri ?? asset.uri);
    });
    Asset.loadAsync(TRY_AGAIN_SOUND).then(([asset]) => {
      setTryAgainUri(asset.localUri ?? asset.uri);
    });
  }, []);
  const ttsQueueRef = useRef<{ text: string; lang: string }[]>([]);
  const isPlayingRef = useRef(false);
  const onTtsCompleteRef = useRef<(() => void) | null>(null);
  const phraseIndexRef = useRef(0);
  const hasStartedIntroRef = useRef(false);
  const phraseCacheRef = useRef<{ text: string; fileUri: string; index: number } | null>(null);
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

  useEffect(() => {
    if (phase === "listening") {
      orbitRotation.setValue(0);
      const loop = Animated.loop(
        Animated.timing(orbitRotation, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        })
      );
      loop.start();
      return () => loop.stop();
    }
  }, [phase, orbitRotation]);

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
    if (scenario) {
      hasStartedIntroRef.current = false;
      Promise.all([
        getPhrases(language, scenario),
        getLessonIntro(scenario, nativeLang, targetLang),
      ])
        .then(([phrasesData, introData]) => {
          setPhrases(phrasesData);
          setIntro(introData);
          setPhase("intro");
        })
        .catch((err) => {
          console.error(err);
          Alert.alert("Error", "Could not load lesson. Please try again.");
        });
    }
  }, [scenario, language, nativeLang, targetLang]);

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
      if (status.playing) setTtsPlaying(true);
      if (status.didJustFinish) setTtsPlaying(false);
    });
    return () => sub.remove();
  }, [goodJobPlayer0, goodJobUri]);

  useEffect(() => {
    if (!goodJobPlayer1 || !goodJobUri) return;
    const sub = goodJobPlayer1.addListener("playbackStatusUpdate", (status) => {
      if (status.playing) setTtsPlaying(true);
      if (status.didJustFinish) setTtsPlaying(false);
    });
    return () => sub.remove();
  }, [goodJobPlayer1, goodJobUri]);

  useEffect(() => {
    if (!tryAgainPlayer0 || !tryAgainUri) return;
    const sub = tryAgainPlayer0.addListener("playbackStatusUpdate", (status) => {
      if (status.playing) setTtsPlaying(true);
      if (status.didJustFinish) {
        setTtsPlaying(false);
        onTtsCompleteRef.current?.();
        onTtsCompleteRef.current = null;
      }
    });
    return () => sub.remove();
  }, [tryAgainPlayer0, tryAgainUri]);

  useEffect(() => {
    if (!tryAgainPlayer1 || !tryAgainUri) return;
    const sub = tryAgainPlayer1.addListener("playbackStatusUpdate", (status) => {
      if (status.playing) setTtsPlaying(true);
      if (status.didJustFinish) {
        setTtsPlaying(false);
        onTtsCompleteRef.current?.();
        onTtsCompleteRef.current = null;
      }
    });
    return () => sub.remove();
  }, [tryAgainPlayer1, tryAgainUri]);

  useEffect(() => {
    if (ttsUri && player) {
      player.play();
    }
  }, [ttsUri]);

  const playGoodJobSound = useCallback(async () => {
    if (!goodJobUri) return;
    const idx = goodJobPlayIndexRef.current % 2;
    const p = idx === 0 ? goodJobPlayer0 : goodJobPlayer1;
    if (!p) return;
    player?.pause();
    tryAgainPlayer0?.pause();
    tryAgainPlayer1?.pause();
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
    p.seekTo(0);
    p.play();
  }, [goodJobUri, goodJobPlayer0, goodJobPlayer1, player, tryAgainPlayer0, tryAgainPlayer1]);

  const playTryAgainSound = useCallback(async () => {
    if (!tryAgainUri) return;
    const idx = tryAgainPlayIndexRef.current % 2;
    const p = idx === 0 ? tryAgainPlayer0 : tryAgainPlayer1;
    if (!p) return;
    player?.pause();
    goodJobPlayer0?.pause();
    goodJobPlayer1?.pause();
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
    p.seekTo(0);
    p.play();
  }, [tryAgainUri, tryAgainPlayer0, tryAgainPlayer1, player, goodJobPlayer0, goodJobPlayer1]);

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
        words.length - 1
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

      const streamUrl = getSpeechStreamUrl(text, "marin", TTS_LANG[targetLang] || targetLang);
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

  const handleContinue = useCallback(() => {
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

  const handlePressIn = async () => {
    if (phase !== "prompt" || !phrase || ttsPlaying) return;
    setPhase("listening");
    setButtonScale(1.1);
    setFeedback(null);
    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldRouteThroughEarpiece: false,
      });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (err) {
      console.error("Failed to start recording:", err);
      Alert.alert("Error", "Could not start recording.");
      setPhase("prompt");
    }
  };

  const handlePressOut = async () => {
    if (phase !== "listening" || !audioRecorder.isRecording) return;
    setButtonScale(1);
    setPhase("evaluating");
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (!uri) throw new Error("No recording URI");
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: "base64",
      });
      const result = await evaluateSpeech(base64, phrase!.phrase);
      setFeedback(result);
      if (result.score >= SCORE_THRESHOLD) {
        setPhase("correct");
        if (goodJobUri) {
          playGoodJobSound();
        } else {
          queueTts(feedbackPhrases.correct, nativeLang);
          playNextInQueue();
        }
      } else {
        setPhase("incorrect");
        onTtsCompleteRef.current = () => {
          setPhase("prompt");
          playPromptForPhrase(phraseIndexRef.current);
        };
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

  const showLoader =
    phase === "loading" || (phase === "intro" && !ttsPlaying && intro != null);

  if (showLoader) {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={[styles.backButton, { top: insets.top }]}
          onPress={() => navigation.goBack()}
          hitSlop={12}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00877B" />
          <Text style={styles.loadingText}>
            {phase === "intro" ? "Preparing audio..." : "Loading lesson..."}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View
        style={[styles.topBar, { top: insets.top }]}
        pointerEvents="box-none"
      >
        <Text style={styles.topBarText}>{lessonLabel}</Text>
        <Text style={styles.topBarDivider}>•</Text>
        <Text style={styles.topBarText}>{difficultyLabel}</Text>
      </View>

      <TouchableOpacity
        style={[styles.backButton, { top: insets.top }]}
        onPress={() => navigation.goBack()}
        hitSlop={12}
        activeOpacity={0.7}
      >
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoSection}>
          {(phase === "intro" ||
            phase === "prompt" ||
            phase === "listening" ||
            phase === "evaluating" ||
            phase === "correct" ||
            phase === "incorrect" ||
            phase === "complete") && (
            <WaveLogo
              fill="#00877B"
              animated={phase !== "complete" && (ttsPlaying || replayLoading)}
            />
          )}
        </View>

        <View style={styles.mainContentSlot}>
          {(phase === "prompt" || phase === "listening") && phrase && (
            <Animated.View
              style={[
                styles.phraseSection,
                {
                  opacity: promptOpacity,
                  transform: [{ translateY: promptTranslateY }],
                },
              ]}
            >
              <Text style={styles.phraseLabel}>
                {phase === "listening" ? "Listening..." : "Say this:"}
              </Text>
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
                  )
                )}
              </Text>
              {phrase.translation && (
                <Text style={styles.phraseTranslation}>{phrase.translation}</Text>
              )}
              <TouchableOpacity
                style={styles.replayButton}
                onPress={handleReplay}
                disabled={ttsPlaying || phase === "listening"}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.replayButtonText,
                    (ttsPlaying || phase === "listening") &&
                      styles.replayButtonTextDisabled,
                  ]}
                >
                  {replayLoading && !ttsPlaying ? "Loading..." : "Listen again"}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {phase === "evaluating" && (
            <View style={styles.evaluatingSection}>
              <ActivityIndicator size="large" color="#00877B" />
              <Text style={styles.statusText}>
                Checking your pronunciation...
              </Text>
            </View>
          )}

          {(phase === "correct" || phase === "incorrect") && feedback && (
            <View style={styles.feedbackSection}>
              {feedback.score >= SCORE_THRESHOLD ? (
                <>
                  <Text style={styles.feedbackCorrect}>
                    {feedbackPhrases.correct}
                  </Text>
                  <Text style={styles.feedbackScore}>
                    Score: {feedback.score}/100
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.feedbackIncorrect}>{feedback.feedback}</Text>
                  <Text style={styles.feedbackScore}>
                    Score: {feedback.score}/100
                  </Text>
                  <Text style={styles.tryAgainHint}>{feedbackPhrases.tryAgain}</Text>
                </>
              )}
            </View>
          )}

          {phase === "complete" && (
            <View style={styles.completeSection}>
              <Text style={styles.completeTitle}>Lesson complete!</Text>
              <Text style={styles.completeSubtitle}>
                You practiced {phrases.length} phrase
                {phrases.length !== 1 ? "s" : ""}.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {(phase === "prompt" || phase === "listening") && (
        <Animated.View
          style={[
            styles.bottomSection,
            { paddingBottom: insets.bottom + 32 },
            {
              opacity: promptOpacity,
              transform: [{ translateY: promptTranslateY }],
            },
          ]}
        >
          <View style={styles.holdButtonContainer}>
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
            <Pressable
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              style={[
                styles.holdButtonWrapper,
                { transform: [{ scale: buttonScale }] },
              ]}
            >
              <View style={styles.holdButton} />
            </Pressable>
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

      {phase === "correct" && phrase && (
        <View
          style={[styles.bottomSection, { paddingBottom: insets.bottom + 32 }]}
        >
          <View style={styles.correctActions}>
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
                  isInFlashcards(phrase.id) && styles.flashcardsButtonTextActive,
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

      {phase === "complete" && (
        <View
          style={[styles.bottomSection, { paddingBottom: insets.bottom + 32 }]}
        >
          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => navigation.goBack()}
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
    backgroundColor: "#fff",
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
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingTop: 100,
    paddingBottom: 120,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#64748b",
  },
  backButton: {
    position: "absolute",
    left: 20,
    zIndex: 10,
  },
  backText: {
    fontSize: 16,
    color: "#00877B",
    fontWeight: "600",
  },
  topBar: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: 36,
    zIndex: 1,
  },
  topBarText: {
    fontSize: 15,
    color: "#0f172a",
    fontWeight: "600",
  },
  topBarDivider: {
    fontSize: 12,
    color: "#64748b",
  },
  logoSection: {
    marginBottom: 24,
  },
  mainContentSlot: {
    height: 220,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  phraseSection: {
    alignItems: "center",
  },
  phraseLabel: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  phraseText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
  },
  phraseWordHighlight: {
    color: "#00877B",
    backgroundColor: "rgba(0, 135, 123, 0.15)",
  },
  phraseTranslation: {
    fontSize: 16,
    color: "#64748b",
    marginTop: 8,
  },
  replayButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  replayButtonText: {
    fontSize: 15,
    color: "#00877B",
    fontWeight: "600",
  },
  replayButtonTextDisabled: {
    color: "#94a3b8",
  },
  statusText: {
    fontSize: 18,
    color: "#64748b",
    marginTop: 16,
  },
  evaluatingSection: {
    alignItems: "center",
  },
  feedbackSection: {
    alignItems: "center",
    paddingHorizontal: 24,
  },
  feedbackCorrect: {
    fontSize: 22,
    fontWeight: "700",
    color: "#00877B",
  },
  feedbackIncorrect: {
    fontSize: 18,
    color: "#0f172a",
    textAlign: "center",
  },
  feedbackScore: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 8,
  },
  tryAgainHint: {
    fontSize: 16,
    color: "#00877B",
    marginTop: 12,
    fontWeight: "600",
  },
  completeSection: {
    alignItems: "center",
  },
  completeTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0f172a",
  },
  completeSubtitle: {
    fontSize: 16,
    color: "#64748b",
    marginTop: 8,
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
    borderColor: "#00877B",
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
    backgroundColor: "#00877B",
  },
  holdButtonHint: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
  },
  correctActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  flashcardsButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "#00877B",
  },
  flashcardsButtonActive: {
    backgroundColor: "#00877B",
    borderColor: "#00877B",
  },
  flashcardsButtonText: {
    fontSize: 16,
    color: "#00877B",
    fontWeight: "600",
  },
  flashcardsButtonTextActive: {
    color: "#fff",
  },
  continueButton: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    backgroundColor: "#00877B",
    borderRadius: 24,
  },
  continueButtonText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
  },
  doneButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    backgroundColor: "#00877B",
    borderRadius: 24,
  },
  doneButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
});

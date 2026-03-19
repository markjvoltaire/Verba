import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Alert,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import {
  useAudioRecorder,
  useAudioPlayer,
  RecordingPresets,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';

const GOOD_JOB_SOUND = require('../../assets/sound/Verba-GoodJob.wav');
const TRY_AGAIN_SOUND = require('../../assets/sound/Verba-TryAgain.wav');
const CONFETTI_LOTTIE = require('../../assets/lottie/confetti.json');

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
import type { Phrase } from '../api/phrases';
import { evaluateSpeech } from '../api/speech';
import { getSpeechStreamUrl } from '../api/tts';
import { getFeedbackPhrases } from '../constants/feedbackPhrases';

const SCORE_THRESHOLD = 70;
const BLUE_BG = '#1D4ED8';
const GREEN_BG = '#16A34A';

const TTS_LANG: Record<string, string> = { es: 'es', fr: 'fr', it: 'it', en: 'en' };

const PRONUNCIATION_STRINGS: Record<string, {
  sayThis: string;
  listening: string;
  listenAgain: string;
  holdToSpeak: string;
  releaseWhenDone: string;
  listenDot: string;
  checking: string;
  correct: string;
  tryAgain: string;
}> = {
  en: { sayThis: 'Say this', listening: 'Listening…', listenAgain: 'Listen again', holdToSpeak: 'Hold to speak', releaseWhenDone: 'Release when done', listenDot: 'Listen...', checking: 'Checking…', correct: 'Great job!', tryAgain: 'Try again' },
  es: { sayThis: 'Di esto', listening: 'Escuchando…', listenAgain: 'Escuchar de nuevo', holdToSpeak: 'Mantén para hablar', releaseWhenDone: 'Suelta cuando termines', listenDot: 'Escucha...', checking: 'Comprobando…', correct: '¡Muy bien!', tryAgain: 'Inténtalo de nuevo' },
  fr: { sayThis: 'Dis ceci', listening: 'Écoute…', listenAgain: 'Écouter à nouveau', holdToSpeak: 'Maintenez pour parler', releaseWhenDone: 'Relâchez quand c\'est fini', listenDot: 'Écoutez...', checking: 'Vérification…', correct: 'Très bien!', tryAgain: 'Réessayez' },
  it: { sayThis: 'Di questo', listening: 'In ascolto…', listenAgain: 'Ascolta di nuovo', holdToSpeak: 'Tieni premuto per parlare', releaseWhenDone: 'Rilascia quando hai finito', listenDot: 'Ascolta...', checking: 'Controllo…', correct: 'Molto bene!', tryAgain: 'Riprova' },
};

type Phase = 'loading' | 'prompt' | 'listening' | 'evaluating' | 'correct' | 'incorrect';

interface OnboardingPronunciationStepProps {
  phrase: Phrase | null;
  nativeLanguage: string;
  targetLang: string;
  onBack: () => void;
  onSkip: () => void;
  onContinue: () => void;
}

export default function OnboardingPronunciationStep({
  phrase,
  nativeLanguage,
  targetLang,
  onBack,
  onSkip,
  onContinue,
}: OnboardingPronunciationStepProps) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [feedback, setFeedback] = useState<{ transcription: string; feedback: string; score: number } | null>(null);
  const [ttsUri, setTtsUri] = useState<string | null>(null);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [replayLoading, setReplayLoading] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [goodJobUri, setGoodJobUri] = useState<string | null>(null);
  const [tryAgainUri, setTryAgainUri] = useState<string | null>(null);

  const promptOpacity = useRef(new Animated.Value(0)).current;
  const promptTranslateY = useRef(new Animated.Value(16)).current;
  const orbitRotation = useRef(new Animated.Value(0)).current;
  const speakingBgOpacity = useRef(new Animated.Value(0)).current;
  const correctBgOpacity = useRef(new Animated.Value(0)).current;
  const idleHoldPulse = useRef(new Animated.Value(1)).current;
  const idleHoldPulseAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const evaluatingSpin = useRef(new Animated.Value(0)).current;
  const phraseStartRef = useRef<number | null>(null);
  const phraseCacheRef = useRef<{ text: string; fileUri: string } | null>(null);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const player = useAudioPlayer(ttsUri ? { uri: ttsUri } : null);
  const goodJobPlayer0 = useAudioPlayer(goodJobUri ? { uri: goodJobUri } : null);
  const goodJobPlayer1 = useAudioPlayer(goodJobUri ? { uri: goodJobUri } : null);
  const tryAgainPlayer0 = useAudioPlayer(tryAgainUri ? { uri: tryAgainUri } : null);
  const tryAgainPlayer1 = useAudioPlayer(tryAgainUri ? { uri: tryAgainUri } : null);
  const goodJobPlayIndexRef = useRef(0);
  const tryAgainPlayIndexRef = useRef(0);
  const goodJobPlayerToPlayRef = useRef<{ play: () => void; seekTo: (pos: number) => void } | null>(null);
  const tryAgainPlayerToPlayRef = useRef<{ play: () => void; seekTo: (pos: number) => void } | null>(null);

  const insets = useSafeAreaInsets();
  const pStrings = PRONUNCIATION_STRINGS[nativeLanguage] ?? PRONUNCIATION_STRINGS.en;
  const feedbackPhrases = getFeedbackPhrases(nativeLanguage);
  const sayPhrase = getFeedbackPhrases(targetLang).sayPhrase;

  const isBlueBackground =
    phase === 'prompt' || phase === 'listening' || phase === 'evaluating';
  const isCorrectBackground = phase === 'correct';

  useEffect(() => {
    Asset.loadAsync(GOOD_JOB_SOUND).then(([asset]) => {
      setGoodJobUri(asset.localUri ?? asset.uri);
    });
    Asset.loadAsync(TRY_AGAIN_SOUND).then(([asset]) => {
      setTryAgainUri(asset.localUri ?? asset.uri);
    });
  }, []);

  useEffect(() => {
    requestRecordingPermissionsAsync().then(({ granted }) => {
      if (!granted) {
        Alert.alert('Permission needed', 'Microphone access is required to try pronunciation.');
      }
    });
  }, []);

  useEffect(() => {
    if (phrase) {
      setPhase('prompt');
      setFeedback(null);
    } else {
      setPhase('loading');
    }
  }, [phrase]);

  // Background transitions
  useEffect(() => {
    Animated.timing(speakingBgOpacity, {
      toValue: isBlueBackground ? 1 : 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [isBlueBackground, speakingBgOpacity]);

  useEffect(() => {
    Animated.timing(correctBgOpacity, {
      toValue: isCorrectBackground ? 1 : 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [isCorrectBackground, correctBgOpacity]);

  // Prompt fade-in
  useEffect(() => {
    if (phase === 'prompt' && phrase) {
      promptOpacity.setValue(0);
      promptTranslateY.setValue(16);
      Animated.parallel([
        Animated.timing(promptOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.timing(promptTranslateY, { toValue: 0, duration: 320, useNativeDriver: true }),
      ]).start();
    }
  }, [phase, phrase, promptOpacity, promptTranslateY]);

  useEffect(() => {
    if (phase === 'listening') {
      promptOpacity.setValue(1);
      promptTranslateY.setValue(0);
    }
  }, [phase, promptOpacity, promptTranslateY]);

  // Orbit ring for listening
  useEffect(() => {
    if (phase === 'listening') {
      orbitRotation.setValue(0);
      const loop = Animated.loop(
        Animated.timing(orbitRotation, { toValue: 1, duration: 1500, useNativeDriver: true }),
      );
      loop.start();
      return () => loop.stop();
    }
  }, [phase, orbitRotation]);

  // Idle hold pulse
  useEffect(() => {
    const shouldPulse =
      phase === 'prompt' && !ttsPlaying && !replayLoading && Boolean(phrase);

    if (!shouldPulse) {
      idleHoldPulseAnimRef.current?.stop();
      idleHoldPulseAnimRef.current = null;
      idleHoldPulse.setValue(phase === 'listening' ? 1.1 : 1);
      return;
    }

    idleHoldPulse.setValue(1);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(idleHoldPulse, { toValue: 1.01, duration: 950, useNativeDriver: true }),
        Animated.timing(idleHoldPulse, { toValue: 0.995, duration: 950, useNativeDriver: true }),
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

  // Evaluating spinner
  useEffect(() => {
    if (phase !== 'evaluating') {
      evaluatingSpin.stopAnimation();
      evaluatingSpin.setValue(0);
      return;
    }
    evaluatingSpin.setValue(0);
    const loop = Animated.loop(
      Animated.timing(evaluatingSpin, { toValue: 1, duration: 1000, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [phase, evaluatingSpin]);

  const playPhrase = useCallback(async () => {
    if (!phrase) return;
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      shouldRouteThroughEarpiece: false,
    });
    const text = sayPhrase + phrase.phrase;
    const uri = getSpeechStreamUrl(text, 'marin', TTS_LANG[targetLang] || targetLang);
    setTtsUri(uri);
    const cachePath = `${FileSystem.cacheDirectory}onboarding_phrase_replay.mp3`;
    FileSystem.downloadAsync(uri, cachePath).then(({ uri: fileUri }) => {
      phraseCacheRef.current = { text, fileUri };
    }).catch(() => {
      phraseCacheRef.current = null;
    });
  }, [phrase, sayPhrase, targetLang]);

  useEffect(() => {
    if (phase === 'prompt' && phrase && !ttsPlaying && !replayLoading) {
      playPhrase();
    }
  }, [phase, phrase, playPhrase]);

  useEffect(() => {
    if (!player || !ttsUri) return;
    const sub = player.addListener('playbackStatusUpdate', (status) => {
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
      }
    });
    return () => sub.remove();
  }, [player, ttsUri]);

  useEffect(() => {
    if (!goodJobPlayer0 || !goodJobUri) return;
    const sub = goodJobPlayer0.addListener('playbackStatusUpdate', (status) => {
      if (
        goodJobPlayerToPlayRef.current === goodJobPlayer0 &&
        status.isLoaded && !status.playing && !status.didJustFinish
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
    const sub = goodJobPlayer1.addListener('playbackStatusUpdate', (status) => {
      if (
        goodJobPlayerToPlayRef.current === goodJobPlayer1 &&
        status.isLoaded && !status.playing && !status.didJustFinish
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
    const sub = tryAgainPlayer0.addListener('playbackStatusUpdate', (status) => {
      if (
        tryAgainPlayerToPlayRef.current === tryAgainPlayer0 &&
        status.isLoaded && !status.playing && !status.didJustFinish
      ) {
        tryAgainPlayer0.play();
        tryAgainPlayerToPlayRef.current = null;
      }
      if (status.playing) setTtsPlaying(true);
      if (status.didJustFinish) setTtsPlaying(false);
    });
    return () => sub.remove();
  }, [tryAgainPlayer0, tryAgainUri]);

  useEffect(() => {
    if (!tryAgainPlayer1 || !tryAgainUri) return;
    const sub = tryAgainPlayer1.addListener('playbackStatusUpdate', (status) => {
      if (
        tryAgainPlayerToPlayRef.current === tryAgainPlayer1 &&
        status.isLoaded && !status.playing && !status.didJustFinish
      ) {
        tryAgainPlayer1.play();
        tryAgainPlayerToPlayRef.current = null;
      }
      if (status.playing) setTtsPlaying(true);
      if (status.didJustFinish) setTtsPlaying(false);
    });
    return () => sub.remove();
  }, [tryAgainPlayer1, tryAgainUri]);

  const playGoodJobSound = useCallback(async () => {
    if (!goodJobUri) return;
    const idx = goodJobPlayIndexRef.current % 2;
    const p = idx === 0 ? goodJobPlayer0 : goodJobPlayer1;
    if (!p) return;
    player?.pause();
    tryAgainPlayer0?.pause();
    tryAgainPlayer1?.pause();
    setTtsUri(null);
    setTtsPlaying(false);
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, shouldRouteThroughEarpiece: false });
    goodJobPlayIndexRef.current += 1;
    goodJobPlayerToPlayRef.current = p;
    p.seekTo(0);
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
    setTtsPlaying(false);
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, shouldRouteThroughEarpiece: false });
    tryAgainPlayIndexRef.current += 1;
    tryAgainPlayerToPlayRef.current = p;
    p.seekTo(0);
  }, [tryAgainUri, tryAgainPlayer0, tryAgainPlayer1, player, goodJobPlayer0, goodJobPlayer1]);

  // Word highlight tracking
  useEffect(() => {
    if (ttsPlaying && phase === 'prompt' && phrase) {
      phraseStartRef.current = Date.now();
    } else {
      phraseStartRef.current = null;
    }
  }, [ttsPlaying, phase, phrase]);

  useEffect(() => {
    if (!ttsPlaying || phase !== 'prompt' || !phrase) {
      setCurrentWordIndex(-1);
      return;
    }
    const words = phrase.phrase.split(/\s+/).filter(Boolean);
    if (words.length === 0) return;
    const msPerChar = 100;
    const prefixMs = sayPhrase.length * msPerChar;
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
      const newIndex = Math.min(Math.floor(elapsedInPhrase / wordMs), words.length - 1);
      setCurrentWordIndex(Math.max(0, newIndex));
    }, 70);
    return () => clearInterval(interval);
  }, [ttsPlaying, phase, phrase, sayPhrase]);

  const handleReplay = useCallback(() => {
    if (ttsPlaying || phase === 'listening' || !phrase) return;
    setReplayLoading(true);
    const text = sayPhrase + phrase.phrase;
    const cached = phraseCacheRef.current;
    if (cached && cached.text === text) {
      setTtsUri(cached.fileUri);
    } else {
      playPhrase();
    }
  }, [ttsPlaying, phase, phrase, sayPhrase, playPhrase]);

  const handlePressIn = async () => {
    if (phase !== 'prompt' || !phrase || ttsPlaying) return;
    setPhase('listening');
    idleHoldPulse.setValue(1.1);
    setFeedback(null);
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, shouldRouteThroughEarpiece: false });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (err) {
      console.error('Failed to start recording:', err);
      Alert.alert('Error', 'Could not start recording.');
      setPhase('prompt');
    }
  };

  const handlePressOut = async () => {
    if (phase !== 'listening' || !audioRecorder.isRecording || !phrase) return;
    idleHoldPulse.setValue(1);
    setPhase('evaluating');
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (!uri) throw new Error('No recording URI');
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      const result = await evaluateSpeech(base64, phrase.phrase);
      setFeedback(result);
      if (result.score >= SCORE_THRESHOLD) {
        setPhase('correct');
        if (goodJobUri) playGoodJobSound();
      } else {
        setPhase('incorrect');
        if (tryAgainUri) playTryAgainSound();
      }
    } catch (err) {
      console.error('Evaluate error:', err);
      Alert.alert('Error', 'Could not evaluate pronunciation. Please try again.');
      setPhase('prompt');
    }
  };

  const handleTryAgain = () => {
    setPhase('prompt');
    setFeedback(null);
    playPhrase();
  };

  if (phase === 'loading') {
    return (
      <View style={[styles.container, { backgroundColor: BLUE_BG }]}>
        <TouchableOpacity
          style={[styles.backBtn, { top: insets.top + 8 }]}
          onPress={onBack}
          hitSlop={12}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        (isBlueBackground || isCorrectBackground) && { backgroundColor: BLUE_BG },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, { backgroundColor: BLUE_BG, opacity: speakingBgOpacity }]}
      />
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, { backgroundColor: GREEN_BG, opacity: correctBgOpacity }]}
      />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={onBack} hitSlop={12} activeOpacity={0.7} style={styles.backBtn}>
          <Ionicons
            name="chevron-back"
            size={20}
            color={(isBlueBackground || isCorrectBackground) ? '#FFFFFF' : '#374151'}
          />
        </TouchableOpacity>
        <View style={styles.topBarCenter}>
          <Text
            style={[
              styles.topBarText,
              (isBlueBackground || isCorrectBackground) ? { color: '#FFFFFF' } : null,
            ]}
          >
            Practice
          </Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.mainContent}>
        {/* Phrase card */}
        {(phase === 'prompt' || phase === 'listening') && phrase && (
          <Animated.View
            style={[
              styles.phraseCard,
              { opacity: promptOpacity, transform: [{ translateY: promptTranslateY }] },
            ]}
          >
            <View style={styles.phraseCardHeader}>
              {!ttsPlaying || phase === 'listening' ? (
                <Text style={styles.phraseLabel}>
                  {phase === 'listening' ? pStrings.listening : pStrings.sayThis}
                </Text>
              ) : null}
              <TouchableOpacity
                style={[
                  styles.listenIconBtn,
                  (ttsPlaying || phase === 'listening') && styles.listenIconBtnDisabled,
                ]}
                onPress={handleReplay}
                disabled={ttsPlaying || phase === 'listening'}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={replayLoading && !ttsPlaying ? 'hourglass-outline' : 'volume-high'}
                  size={18}
                  color={ttsPlaying || phase === 'listening' ? '#D1D5DB' : '#29B6F6'}
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.phraseText}>
              {(phrase.phrase.split(/\s+/).filter(Boolean) as string[]).map((word, i, words) => (
                <Text
                  key={i}
                  style={
                    ttsPlaying && i === currentWordIndex
                      ? [styles.phraseText, styles.phraseWordHighlight]
                      : styles.phraseText
                  }
                >
                  {word}
                  {i < words.length - 1 ? ' ' : ''}
                </Text>
              ))}
            </Text>

            {phrase.translation && (
              <>
                <View style={styles.phraseDivider} />
                <Text style={styles.translationLabel}>Translation</Text>
                <Text style={styles.phraseTranslation}>{phrase.translation}</Text>
              </>
            )}
          </Animated.View>
        )}

        {/* Evaluating spinner */}
        {phase === 'evaluating' && (
          <View style={styles.evaluatingSection}>
            <View style={styles.evaluatingIcon}>
              <Animated.View
                style={[
                  styles.evaluatingSpinner,
                  {
                    transform: [{
                      rotate: evaluatingSpin.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '360deg'],
                      }),
                    }],
                  },
                ]}
              />
              <View style={styles.evaluatingDotsRow}>
                {[0, 1, 2].map((i) => (
                  <Animated.View
                    key={i}
                    style={[
                      styles.evaluatingDot,
                      {
                        opacity: evaluatingSpin.interpolate({
                          inputRange: [0, 0.33, 0.66, 1],
                          outputRange: i === 0
                            ? [0.25, 1, 0.25, 0.25]
                            : i === 1
                              ? [0.25, 0.25, 1, 0.25]
                              : [0.25, 0.25, 0.25, 1],
                        }),
                      },
                    ]}
                  />
                ))}
              </View>
            </View>
            <Text style={styles.evaluatingTitle}>{pStrings.checking}</Text>
            <Text style={styles.evaluatingSub}>Scoring your pronunciation</Text>
          </View>
        )}

        {/* Feedback card */}
        {(phase === 'correct' || phase === 'incorrect') && feedback && (
          <View style={styles.feedbackCard}>
            <View
              style={[
                styles.scoreBadge,
                feedback.score >= SCORE_THRESHOLD ? styles.scoreBadgeGood : styles.scoreBadgePoor,
              ]}
            >
              <Text
                style={[
                  styles.scoreNum,
                  feedback.score >= SCORE_THRESHOLD ? styles.scoreNumGood : styles.scoreNumPoor,
                ]}
              >
                {feedback.score}
              </Text>
              <Text
                style={[
                  styles.scoreLabel,
                  feedback.score >= SCORE_THRESHOLD ? styles.scoreNumGood : styles.scoreNumPoor,
                ]}
              >
                / 100
              </Text>
            </View>
            <Text
              style={[
                styles.feedbackHeadline,
                feedback.score >= SCORE_THRESHOLD ? styles.feedbackHeadlineGood : styles.feedbackHeadlinePoor,
              ]}
            >
              {feedback.score >= SCORE_THRESHOLD ? feedbackPhrases.correct : feedback.feedback}
            </Text>
            {feedback.transcription ? (
              <Text style={styles.feedbackHeard}>Heard: "{feedback.transcription}"</Text>
            ) : null}
          </View>
        )}
      </View>

      {/* Hold button footer */}
      {(phase === 'prompt' || phase === 'listening') && (
        <Animated.View
          style={[
            styles.holdButtonFooter,
            { paddingBottom: insets.bottom + 24 },
            { opacity: promptOpacity },
          ]}
        >
          <View style={styles.holdButtonContainer}>
            {phase === 'listening' && (
              <Animated.View
                style={[
                  styles.orbitRing,
                  {
                    transform: [{
                      rotate: orbitRotation.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '360deg'],
                      }),
                    }],
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
          </View>
          <Text style={styles.holdButtonHint}>
            {phase === 'listening'
              ? pStrings.releaseWhenDone
              : ttsPlaying
                ? pStrings.listenDot
                : pStrings.holdToSpeak}
          </Text>
        </Animated.View>
      )}

      {/* Confetti */}
      {phase === 'correct' && (
        <View style={styles.confettiOverlay} pointerEvents="none">
          <LottieView source={CONFETTI_LOTTIE} autoPlay loop={false} style={styles.confettiLottie} />
        </View>
      )}

      {/* Correct actions */}
      {phase === 'correct' && (
        <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 32 }]}>
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.tryAgainButton} onPress={handleTryAgain} activeOpacity={0.7}>
              <Text style={styles.tryAgainButtonText}>{pStrings.tryAgain}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.continueButton} onPress={onContinue} activeOpacity={0.7}>
              <Text style={styles.continueButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Incorrect actions */}
      {phase === 'incorrect' && (
        <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 32 }]}>
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.tryAgainButton} onPress={handleTryAgain} activeOpacity={0.7}>
              <Text style={styles.tryAgainButtonText}>{pStrings.tryAgain}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.continueButton} onPress={onSkip} activeOpacity={0.7}>
              <Text style={styles.continueButtonText}>Skip</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F4F8',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarCenter: {
    flex: 1,
    alignItems: 'center',
  },
  topBarText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 24,
    fontSize: 16,
    color: '#BFDBFE',
    fontWeight: '500',
  },
  mainContent: {
    flex: 1,
  },
  phraseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 20,
    marginTop: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
    gap: 4,
  },
  phraseCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
    width: '100%',
  },
  phraseLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listenIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(41, 182, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listenIconBtnDisabled: {
    backgroundColor: 'rgba(209, 213, 219, 0.2)',
  },
  phraseText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    lineHeight: 36,
  },
  phraseWordHighlight: {
    color: '#29B6F6',
    backgroundColor: 'rgba(41, 182, 246, 0.15)',
  },
  phraseDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    width: '100%',
    marginVertical: 12,
  },
  translationLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  phraseTranslation: {
    fontSize: 22,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 30,
    fontWeight: '500',
  },
  evaluatingSection: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 16,
  },
  evaluatingIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  evaluatingSpinner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    borderTopColor: '#FFFFFF',
    borderRightColor: 'rgba(255, 255, 255, 0.55)',
    backgroundColor: 'transparent',
  },
  evaluatingDotsRow: {
    position: 'absolute',
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  evaluatingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 4,
  },
  evaluatingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  evaluatingSub: {
    fontSize: 14,
    color: '#BFDBFE',
  },
  feedbackCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
    gap: 12,
    marginTop: 40,
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 16,
  },
  scoreBadgeGood: { backgroundColor: 'rgba(34, 197, 94, 0.1)' },
  scoreBadgePoor: { backgroundColor: 'rgba(239, 68, 68, 0.08)' },
  scoreNum: {
    fontSize: 36,
    fontWeight: '800',
  },
  scoreLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  scoreNumGood: { color: '#16A34A' },
  scoreNumPoor: { color: '#DC2626' },
  feedbackHeadline: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  feedbackHeadlineGood: { color: '#111827' },
  feedbackHeadlinePoor: { color: '#374151' },
  feedbackHeard: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  holdButtonFooter: {
    alignItems: 'center',
    paddingTop: 16,
    backgroundColor: 'transparent',
  },
  holdButtonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  orbitRing: {
    position: 'absolute',
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderStyle: 'dashed',
    opacity: 0.8,
  },
  holdButtonWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  holdButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FFFFFF',
  },
  holdButtonHint: {
    marginTop: 12,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  bottomSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  tryAgainButton: {
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  tryAgainButtonText: {
    fontSize: 16,
    color: '#0284C7',
    fontWeight: '600',
  },
  continueButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 28,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  continueButtonText: {
    fontSize: 17,
    color: '#0284C7',
    fontWeight: '700',
  },
  confettiOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confettiLottie: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
});

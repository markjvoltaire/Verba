import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import WaveLogo from './WaveLogo';

const GOOD_JOB_SOUND = require('../../assets/sound/Verba-GoodJob.wav');
const TRY_AGAIN_SOUND = require('../../assets/sound/Verba-TryAgain.wav');
const CONFETTI_LOTTIE = require('../../assets/lottie/confetti.json');

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
import type { Phrase } from '../api/phrases';
import { evaluateSpeech } from '../api/speech';
import { getSpeechStreamUrl } from '../api/tts';
import { getFeedbackPhrases } from '../constants/feedbackPhrases';

const SCORE_THRESHOLD = 70;

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
  en: { sayThis: 'Say this:', listening: 'Listening...', listenAgain: 'Listen again', holdToSpeak: 'Hold to speak', releaseWhenDone: 'Release when done', listenDot: 'Listen...', checking: 'Checking your pronunciation...', correct: 'Great job!', tryAgain: 'Try again' },
  es: { sayThis: 'Di esto:', listening: 'Escuchando...', listenAgain: 'Escuchar de nuevo', holdToSpeak: 'Mantén para hablar', releaseWhenDone: 'Suelta cuando termines', listenDot: 'Escucha...', checking: 'Comprobando tu pronunciación...', correct: '¡Muy bien!', tryAgain: 'Inténtalo de nuevo' },
  fr: { sayThis: 'Dis ceci:', listening: 'Écoute...', listenAgain: 'Écouter à nouveau', holdToSpeak: 'Maintenez pour parler', releaseWhenDone: 'Relâchez quand c\'est fini', listenDot: 'Écoutez...', checking: 'Vérification de votre prononciation...', correct: 'Très bien!', tryAgain: 'Réessayez' },
  it: { sayThis: 'Di questo:', listening: 'In ascolto...', listenAgain: 'Ascolta di nuovo', holdToSpeak: 'Tieni premuto per parlare', releaseWhenDone: 'Rilascia quando hai finito', listenDot: 'Ascolta...', checking: 'Controllo della pronuncia...', correct: 'Molto bene!', tryAgain: 'Riprova' },
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
  const [buttonScale, setButtonScale] = useState(1);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [replayLoading, setReplayLoading] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [goodJobUri, setGoodJobUri] = useState<string | null>(null);
  const [tryAgainUri, setTryAgainUri] = useState<string | null>(null);

  const promptOpacity = useRef(new Animated.Value(0)).current;
  const promptTranslateY = useRef(new Animated.Value(16)).current;
  const orbitRotation = useRef(new Animated.Value(0)).current;
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
      orbitRotation.setValue(0);
      const loop = Animated.loop(
        Animated.timing(orbitRotation, { toValue: 1, duration: 1500, useNativeDriver: true }),
      );
      loop.start();
      return () => loop.stop();
    }
  }, [phase, orbitRotation]);

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
    const sub = goodJobPlayer1.addListener('playbackStatusUpdate', (status) => {
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
    const sub = tryAgainPlayer0.addListener('playbackStatusUpdate', (status) => {
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
      if (status.didJustFinish) setTtsPlaying(false);
    });
    return () => sub.remove();
  }, [tryAgainPlayer0, tryAgainUri]);

  useEffect(() => {
    if (!tryAgainPlayer1 || !tryAgainUri) return;
    const sub = tryAgainPlayer1.addListener('playbackStatusUpdate', (status) => {
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
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      shouldRouteThroughEarpiece: false,
    });
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
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      shouldRouteThroughEarpiece: false,
    });
    tryAgainPlayIndexRef.current += 1;
    tryAgainPlayerToPlayRef.current = p;
    p.seekTo(0);
  }, [tryAgainUri, tryAgainPlayer0, tryAgainPlayer1, player, goodJobPlayer0, goodJobPlayer1]);

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
      console.error('Failed to start recording:', err);
      Alert.alert('Error', 'Could not start recording.');
      setPhase('prompt');
    }
  };

  const handlePressOut = async () => {
    if (phase !== 'listening' || !audioRecorder.isRecording || !phrase) return;
    setButtonScale(1);
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
        if (goodJobUri) {
          playGoodJobSound();
        }
      } else {
        setPhase('incorrect');
        if (tryAgainUri) {
          playTryAgainSound();
        }
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
      <View style={styles.container}>
        <TouchableOpacity style={[styles.backButton, { top: insets.top }]} onPress={onBack} hitSlop={12}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#29B6F6" />
          <Text style={styles.loadingText}>Loading phrase...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={[styles.backButton, { top: insets.top }]} onPress={onBack} hitSlop={12} activeOpacity={0.7}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.logoSection}>
          <WaveLogo
            fill="#29B6F6"
            animated={ttsPlaying || replayLoading}
          />
        </View>

        <View style={styles.mainContentSlot}>
          {(phase === 'prompt' || phase === 'listening') && phrase && (
            <Animated.View
              style={[
                styles.phraseSection,
                { opacity: promptOpacity, transform: [{ translateY: promptTranslateY }] },
              ]}
            >
              <Text style={styles.phraseLabel}>
                {phase === 'listening' ? pStrings.listening : pStrings.sayThis}
              </Text>
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
                <Text style={styles.phraseTranslation}>{phrase.translation}</Text>
              )}
              <TouchableOpacity
                style={styles.replayButton}
                onPress={handleReplay}
                disabled={ttsPlaying || phase === 'listening'}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.replayButtonText,
                    (ttsPlaying || phase === 'listening') && styles.replayButtonTextDisabled,
                  ]}
                >
                  {replayLoading && !ttsPlaying ? 'Loading...' : pStrings.listenAgain}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {phase === 'evaluating' && (
            <View style={styles.evaluatingSection}>
              <ActivityIndicator size="large" color="#29B6F6" />
              <Text style={styles.statusText}>{pStrings.checking}</Text>
            </View>
          )}

          {(phase === 'correct' || phase === 'incorrect') && feedback && (
            <View style={styles.feedbackSection}>
              {feedback.score >= SCORE_THRESHOLD ? (
                <>
                  {feedback.transcription ? (
                    <Text style={styles.feedbackHeard}>Heard: "{feedback.transcription}"</Text>
                  ) : null}
                  <Text style={styles.feedbackCorrect}>{feedbackPhrases.correct}</Text>
                  <Text style={styles.feedbackScore}>Score: {feedback.score}/100</Text>
                </>
              ) : (
                <>
                  {feedback.transcription ? (
                    <Text style={styles.feedbackHeard}>Heard: "{feedback.transcription}"</Text>
                  ) : null}
                  <Text style={styles.feedbackIncorrect}>{feedback.feedback}</Text>
                  <Text style={styles.feedbackScore}>Score: {feedback.score}/100</Text>
                </>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {(phase === 'prompt' || phase === 'listening') && (
        <Animated.View
          style={[
            styles.bottomSection,
            { paddingBottom: insets.bottom + 32, opacity: promptOpacity, transform: [{ translateY: promptTranslateY }] },
          ]}
        >
          <View style={styles.holdButtonContainer}>
            {phase === 'listening' && (
              <Animated.View
                style={[
                  styles.orbitRing,
                  {
                    transform: [
                      {
                        rotate: orbitRotation.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '360deg'],
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
              disabled={ttsPlaying || replayLoading}
              style={[
                styles.holdButtonWrapper,
                { transform: [{ scale: buttonScale }], opacity: ttsPlaying || replayLoading ? 0.5 : 1 },
              ]}
            >
              <View style={styles.holdButton} />
            </Pressable>
          </View>
          <Text style={styles.holdButtonHint}>
            {phase === 'listening'
              ? pStrings.releaseWhenDone
              : ttsPlaying
                ? pStrings.listenDot
                : pStrings.holdToSpeak}
          </Text>
          <View style={styles.skipContinueRow}>
            <TouchableOpacity style={styles.skipButton} onPress={onSkip} activeOpacity={0.7}>
              <Text style={styles.skipButtonText}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.continueButton} onPress={onContinue} activeOpacity={0.7}>
              <Text style={styles.continueButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {phase === 'correct' && (
        <View style={styles.confettiOverlay} pointerEvents="none">
          <LottieView
            source={CONFETTI_LOTTIE}
            autoPlay
            loop={false}
            style={styles.confettiLottie}
          />
        </View>
      )}

      {(phase === 'correct' || phase === 'incorrect') && (
        <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 32 }]}>
          <View style={styles.actionsRow}>
            {phase === 'incorrect' && (
              <TouchableOpacity
                style={styles.tryAgainButton}
                onPress={handleTryAgain}
                activeOpacity={0.7}
              >
                <Text style={styles.tryAgainButtonText}>{pStrings.tryAgain}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.skipButton} onPress={onSkip} activeOpacity={0.7}>
              <Text style={styles.skipButtonText}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.continueButton} onPress={onContinue} activeOpacity={0.7}>
              <Text style={styles.continueButtonText}>Continue</Text>
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
    backgroundColor: '#fff',
  },
  backButton: {
    position: 'absolute',
    left: 20,
    top: 60,
    zIndex: 10,
  },
  backText: {
    fontSize: 16,
    color: '#29B6F6',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 100,
    paddingBottom: 340,
  },
  logoSection: {
    marginBottom: 24,
  },
  mainContentSlot: {
    height: 220,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phraseSection: {
    alignItems: 'center',
  },
  phraseLabel: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  phraseText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  phraseWordHighlight: {
    color: '#29B6F6',
    backgroundColor: 'rgba(41, 182, 246, 0.15)',
  },
  phraseTranslation: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 8,
  },
  replayButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  replayButtonText: {
    fontSize: 15,
    color: '#29B6F6',
    fontWeight: '600',
  },
  replayButtonTextDisabled: {
    color: '#94a3b8',
  },
  evaluatingSection: {
    alignItems: 'center',
  },
  statusText: {
    fontSize: 18,
    color: '#64748b',
    marginTop: 16,
  },
  feedbackSection: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  feedbackCorrect: {
    fontSize: 22,
    fontWeight: '700',
    color: '#29B6F6',
  },
  feedbackHeard: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  feedbackIncorrect: {
    fontSize: 18,
    color: '#0f172a',
    textAlign: 'center',
  },
  feedbackScore: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
  },
  bottomSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: 24,
    backgroundColor: '#fff',
    zIndex: 1,
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
    borderColor: '#29B6F6',
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
    backgroundColor: '#29B6F6',
  },
  holdButtonHint: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  skipContinueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 24,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  tryAgainButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#29B6F6',
  },
  tryAgainButtonText: {
    fontSize: 16,
    color: '#29B6F6',
    fontWeight: '600',
  },
  skipButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#29B6F6',
  },
  skipButtonText: {
    fontSize: 16,
    color: '#29B6F6',
    fontWeight: '600',
  },
  continueButton: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    backgroundColor: '#29B6F6',
    borderRadius: 24,
  },
  continueButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
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

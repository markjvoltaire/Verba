import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Alert,
} from "react-native";
import {
  useAudioRecorder,
  useAudioPlayer,
  RecordingPresets,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
} from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { evaluateSpeech } from "../api/speech";
import { getSpeechStreamUrl } from "../api/tts";
import { getPhrases, Phrase } from "../api/phrases";
import { useApp } from "../context/AppContext";
import { useStreak } from "../context/StreakContext";
import { useUsage } from "../context/UsageContext";
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PRIMARY = "#29B6F6";
const SCORE_THRESHOLD = 70;

function PhraseLoader() {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={loaderStyles.container}>
      <Animated.View style={[loaderStyles.iconRing, { transform: [{ scale: pulse }] }]}>
        <Text style={loaderStyles.iconEmoji}>🎤</Text>
      </Animated.View>
      <Text style={loaderStyles.title}>Loading phrases</Text>
      <Text style={loaderStyles.subtitle}>Getting your practice session ready…</Text>
    </View>
  );
}

const loaderStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 40,
  },
  iconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(41, 182, 246, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  iconEmoji: {
    fontSize: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
  },
});

const TTS_LANG: Record<string, string> = {
  es: "es",
  fr: "fr",
  it: "it",
  en: "en",
};

export default function PhrasePracticeScreen({
  navigation,
  route,
}: {
  navigation: any;
  route: {
    params?: {
      phrase?: Phrase | null;
      phraseIndex?: number;
      scenario?: string;
      difficulty?: string;
    };
  };
}) {
  const { language } = useApp();
  const { recordPhrasePractice } = useStreak();
  const { recordUsage } = useUsage();
  const insets = useSafeAreaInsets();
  const scenario = route.params?.scenario;
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [currentIndex, setCurrentIndex] = useState(
    route.params?.phraseIndex ?? 0,
  );
  const [isRecording, setIsRecording] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [recordStartTime, setRecordStartTime] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{
    transcription: string;
    expectedPhrase: string;
    feedback: string;
    score: number;
  } | null>(null);
  const [ttsUri, setTtsUri] = useState<string | null>(null);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const player = useAudioPlayer(ttsUri ? { uri: ttsUri } : null);

  const phrase = phrases[currentIndex] ?? route.params?.phrase;

  useEffect(() => {
    getPhrases(language, scenario)
      .then(setPhrases)
      .catch(() => setPhrases([]));
  }, [language, scenario]);

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
    if (ttsUri && player) {
      player.play();
    }
  }, [ttsUri, player]);

  useEffect(() => {
    if (!player || !ttsUri) return;
    const sub = player.addListener("playbackStatusUpdate", (status) => {
      if (status.playing) setTtsPlaying(true);
      if (status.didJustFinish) {
        setTtsUri(null);
        setTtsPlaying(false);
      }
    });
    return () => sub.remove();
  }, [player, ttsUri]);

  const handleSpeakPress = () => {
    startRecording();
  };

  const handleListen = async () => {
    if (!phrase) return;
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      shouldRouteThroughEarpiece: false,
    });
    const uri = getSpeechStreamUrl(
      phrase.phrase,
      "marin",
      TTS_LANG[phrase.target_lang] || phrase.target_lang,
    );
    setTtsUri(uri);
  };

  const startRecording = async () => {
    try {
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setIsRecording(true);
      setFeedback(null);
      setRecordStartTime(Date.now());
    } catch (err) {
      console.error("Failed to start recording:", err);
      Alert.alert("Error", "Could not start recording.");
    }
  };

  const stopRecordingAndEvaluate = async () => {
    if (!audioRecorder.isRecording || !phrase) return;
    setIsRecording(false);
    setIsEvaluating(true);
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;

      if (!uri) throw new Error("No recording URI");

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: "base64",
      });

      const result = await evaluateSpeech(base64, phrase.phrase);
      setFeedback(result);
      if (result.score >= SCORE_THRESHOLD) {
        await recordPhrasePractice();
      }
      if (recordStartTime) {
        const seconds = Math.ceil((Date.now() - recordStartTime) / 1000);
        await recordUsage(seconds);
      }
      setRecordStartTime(null);
    } catch (err) {
      console.error("Evaluate error:", err);
      Alert.alert(
        "Error",
        "Could not evaluate pronunciation. Please try again.",
      );
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleNext = () => {
    setFeedback(null);
    if (phrases.length > 0 && currentIndex < phrases.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      navigation.goBack();
    }
  };

  if (!phrase && phrases.length === 0) {
    return (
      <View style={styles.container}>
        <View style={[styles.blueHeader, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.headerBackText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Phrase Practice</Text>
          <View style={styles.headerSpacer} />
        </View>
        <PhraseLoader />
      </View>
    );
  }

  if (!phrase) {
    return (
      <View style={styles.container}>
        <View style={[styles.blueHeader, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.headerBackText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Phrase Practice</Text>
          <View style={styles.headerSpacer} />
        </View>
        <Text style={styles.errorText}>No phrases available</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.blueHeader, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.headerBackText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Phrase Practice</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.phraseCard}>
        <Text style={styles.phraseText}>{phrase.phrase}</Text>
        <Text style={styles.translationText}>{phrase.translation}</Text>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.listenButton}
            onPress={handleListen}
            disabled={ttsPlaying}
          >
            <Text
              style={[
                styles.listenButtonText,
                ttsPlaying && styles.listenButtonTextDisabled,
              ]}
            >
              {ttsPlaying ? "Playing..." : "🔊 Listen"}
            </Text>
          </TouchableOpacity>
        </View>

        {!feedback ? (
          <View style={styles.recordSection}>
            {isRecording ? (
              <TouchableOpacity
                style={styles.stopButton}
                onPress={stopRecordingAndEvaluate}
              >
                <Text style={styles.stopButtonText}>⏹ Stop</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.speakButton}
                onPress={handleSpeakPress}
                disabled={isEvaluating}
              >
                {isEvaluating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.speakButtonText}>🎤 Speak</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.feedbackSection}>
            <Text style={styles.feedbackLabel}>You said:</Text>
            <Text style={styles.feedbackValue}>{feedback.transcription}</Text>
            <Text style={styles.feedbackLabel}>Better:</Text>
            <Text style={styles.feedbackValue}>{feedback.expectedPhrase}</Text>
            <Text style={styles.feedbackComment}>{feedback.feedback}</Text>
            <View style={styles.scoreBadge}>
              <Text style={styles.scoreText}>
                Pronunciation: {feedback.score}%
              </Text>
            </View>
            <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
              <Text style={styles.nextButtonText}>Next phrase</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 0,
    backgroundColor: "#F0F4F8",
  },
  blueHeader: {
    backgroundColor: '#29B6F6',
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBackText: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 22,
  },
  errorText: {
    fontSize: 18,
    color: "#57534E",
    marginBottom: 24,
    marginHorizontal: 20,
  },
  backButton: {
    alignSelf: "flex-start",
    marginBottom: 24,
    marginHorizontal: 20,
  },
  backButtonText: {
    fontSize: 16,
    color: "#29B6F6",
    fontWeight: "600",
  },
  phraseCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 24,
    marginHorizontal: 20,
    borderWidth: 2,
    borderColor: "rgba(41,182,246,0.08)",
    shadowColor: "#1C1917",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  phraseText: {
    fontFamily: "Georgia",
    fontSize: 28,
    fontWeight: "700",
    color: "#1C1917",
    marginBottom: 8,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  translationText: {
    fontSize: 16,
    color: "#57534E",
    marginBottom: 24,
    textAlign: "center",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 24,
  },
  listenButton: {
    backgroundColor: "rgba(41, 182, 246, 0.1)",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  listenButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#29B6F6",
  },
  listenButtonTextDisabled: {
    color: "#A8A29E",
  },
  recordSection: {
    alignItems: "center",
  },
  speakButton: {
    backgroundColor: "#29B6F6",
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#29B6F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  speakButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  stopButton: {
    backgroundColor: "#ef4444",
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  stopButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  feedbackSection: {
    marginTop: 16,
  },
  feedbackLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#78716C",
    marginTop: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  feedbackValue: {
    fontSize: 16,
    color: "#1C1917",
    marginTop: 4,
    fontWeight: "600",
  },
  feedbackComment: {
    fontSize: 14,
    color: "#57534E",
    marginTop: 12,
    fontStyle: "italic",
  },
  scoreBadge: {
    backgroundColor: "rgba(41, 182, 246, 0.12)",
    padding: 14,
    borderRadius: 14,
    marginTop: 16,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(41, 182, 246, 0.2)",
  },
  scoreText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#29B6F6",
  },
  nextButton: {
    backgroundColor: "#29B6F6",
    padding: 18,
    borderRadius: 16,
    marginTop: 24,
    alignItems: "center",
    shadowColor: "#29B6F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  nextButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
});

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
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

const SCORE_THRESHOLD = 70;

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
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00877B" />
          <Text style={styles.loadingText}>Loading phrases...</Text>
        </View>
      </View>
    );
  }

  if (!phrase) {
    return (
      <View style={styles.container}>
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
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

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
    padding: 24,
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
  errorText: {
    fontSize: 18,
    color: "#64748b",
    marginBottom: 24,
  },
  backButton: {
    alignSelf: "flex-start",
    marginBottom: 24,
  },
  backButtonText: {
    fontSize: 16,
    color: "#00877B",
    fontWeight: "600",
  },
  phraseCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  phraseText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 8,
    textAlign: "center",
  },
  translationText: {
    fontSize: 16,
    color: "#64748b",
    marginBottom: 24,
    textAlign: "center",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 24,
  },
  listenButton: {
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  listenButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#475569",
  },
  listenButtonTextDisabled: {
    color: "#94a3b8",
  },
  recordSection: {
    alignItems: "center",
  },
  speakButton: {
    backgroundColor: "#00877B",
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  speakButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
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
    fontWeight: "600",
  },
  feedbackSection: {
    marginTop: 16,
  },
  feedbackLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
    marginTop: 12,
  },
  feedbackValue: {
    fontSize: 16,
    color: "#0f172a",
    marginTop: 4,
  },
  feedbackComment: {
    fontSize: 14,
    color: "#475569",
    marginTop: 12,
    fontStyle: "italic",
  },
  scoreBadge: {
    backgroundColor: "#e6f7f6",
    padding: 12,
    borderRadius: 10,
    marginTop: 16,
    alignItems: "center",
  },
  scoreText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#006d63",
  },
  nextButton: {
    backgroundColor: "#00877B",
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
    alignItems: "center",
  },
  nextButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

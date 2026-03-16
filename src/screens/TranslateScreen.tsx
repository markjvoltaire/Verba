import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  Platform,
  Animated,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import {
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioSampleListener,
  setAudioModeAsync,
} from "expo-audio";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { translate } from "../api/translate";
import { getSpeech, getSpeechStreamUrl } from "../api/tts";
import { useApp, type Language } from "../context/AppContext";
import { useSavedPhrases } from "../context/SavedPhrasesContext";
import type { Phrase } from "../api/phrases";

const PRIMARY = "#29B6F6";

const TTS_LANG: Record<string, string> = {
  es: "es",
  fr: "fr",
  it: "it",
  en: "en",
};

const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: "es", label: "Spanish", flag: "🇪🇸" },
  { code: "fr", label: "French", flag: "🇫🇷" },
  { code: "it", label: "Italian", flag: "🇮🇹" },
  { code: "en", label: "English", flag: "🇬🇧" },
];

const WAVEFORM_BAR_COUNT = 8;
const WAVEFORM_UPDATE_MS = 50;

function amplitudeFromSample(channels: { frames: number[] }[]): number {
  if (!channels?.length || !channels[0]?.frames?.length) return 0;
  const frames = channels[0].frames;
  let max = 0;
  for (let i = 0; i < frames.length; i++) {
    const v = Math.abs(frames[i]);
    if (v > max) max = v;
  }
  return Math.min(1, max);
}

function translationPhraseId(
  input: string,
  translation: string,
  lang: string,
): string {
  const str = `${lang}:${input.trim()}:${translation.trim()}`;
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h = h & h;
  }
  return `translation_${Math.abs(h).toString(36)}`;
}

export default function TranslateScreen() {
  const insets = useSafeAreaInsets();
  const { language, setLanguage } = useApp();
  const { addToFlashcards, removeFromFlashcards, isInFlashcards, getFlashcardForPhrase } =
    useSavedPhrases();

  const [inputText, setInputText] = useState("");
  const [translation, setTranslation] = useState("");
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [playingTTS, setPlayingTTS] = useState(false);
  const [preloadedAudio, setPreloadedAudio] = useState<string | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);

  const preloadRef = useRef<string | null>(null);
  const pendingTranslateRef = useRef<string | null>(null);

  const [waveformLevels, setWaveformLevels] = useState<number[]>(() =>
    Array(WAVEFORM_BAR_COUNT).fill(0),
  );
  const waveformLevelsRef = useRef<number[]>(Array(WAVEFORM_BAR_COUNT).fill(0));
  const waveformIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardY = useRef(new Animated.Value(16)).current;

  const showCard = !!(translation || translateError || translating);

  useEffect(() => {
    if (showCard) {
      cardOpacity.setValue(0);
      cardY.setValue(16);
      Animated.parallel([
        Animated.timing(cardOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(cardY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
      ]).start();
    }
  }, [showCard]);

  const streamUrl =
    translation && !translateError
      ? getSpeechStreamUrl(translation, "marin", TTS_LANG[language] || language)
      : null;
  const playSourceUrl = preloadedAudio || streamUrl;
  const player = useAudioPlayer(playingTTS && playSourceUrl ? { uri: playSourceUrl } : null);

  useEffect(() => {
    if (!player) return;
    const interval = setInterval(() => {
      const t = (player.currentTime ?? 0) + 0.08;
      const d = player.duration ?? 0;
      setPlaybackProgress(d > 0 ? Math.min(1, t / d) : 0);
    }, 50);
    return () => clearInterval(interval);
  }, [player]);

  useEffect(() => {
    if (!player) return;
    const sub = player.addListener("playbackStatusUpdate", (status) => {
      if (status.didJustFinish) {
        setPlayingTTS(false);
        setPlaybackProgress(1);
      }
    });
    return () => sub.remove();
  }, [player]);

  useEffect(() => {
    if (playingTTS && player) {
      player.seekTo(0).then(() => player.play());
    }
  }, [playingTTS, player]);

  useEffect(() => {
    if (playingTTS) setPlaybackProgress(0);
  }, [playingTTS]);

  useEffect(() => {
    if (translation) setPlaybackProgress(0);
  }, [translation]);

  useAudioSampleListener(player, (sample) => {
    const amp = amplitudeFromSample(sample.channels);
    const next = [...waveformLevelsRef.current.slice(1), amp];
    waveformLevelsRef.current = next;
  });

  useEffect(() => {
    if (playingTTS) {
      waveformLevelsRef.current = Array(WAVEFORM_BAR_COUNT).fill(0);
      waveformIntervalRef.current = setInterval(() => {
        setWaveformLevels([...waveformLevelsRef.current]);
      }, WAVEFORM_UPDATE_MS);
    }
    return () => {
      if (waveformIntervalRef.current) {
        clearInterval(waveformIntervalRef.current);
        waveformIntervalRef.current = null;
      }
      if (!playingTTS) setWaveformLevels(Array(WAVEFORM_BAR_COUNT).fill(0));
    };
  }, [playingTTS]);

  // Preload audio when translation arrives
  useEffect(() => {
    if (!translation?.trim() || translateError) {
      setPreloadedAudio(null);
      preloadRef.current = null;
      return;
    }
    preloadRef.current = translation;
    setPreloadedAudio(null);
    getSpeech(translation, "marin", TTS_LANG[language] || language)
      .then((res) => {
        if (preloadRef.current !== translation) return;
        setPreloadedAudio(`data:audio/mpeg;base64,${res.audio}`);
      })
      .catch(() => {});
  }, [translation, translateError, language]);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true });
  }, []);

  const handleTranslate = () => {
    const text = inputText.trim();
    if (!text || translating) return;
    pendingTranslateRef.current = text;
    setTranslating(true);
    setTranslateError(null);
    setTranslation("");
    translate(text, language)
      .then((res) => {
        if (pendingTranslateRef.current === text) setTranslation(res.translation);
      })
      .catch((err) => {
        if (pendingTranslateRef.current === text)
          setTranslateError(err instanceof Error ? err.message : "Translation failed");
      })
      .finally(() => {
        if (pendingTranslateRef.current === text) pendingTranslateRef.current = null;
        setTranslating(false);
      });
  };

  const handleInputChange = (text: string) => {
    setInputText(text);
    if (translation || translateError) {
      setTranslation("");
      setTranslateError(null);
    }
  };

  const handleSaveToFlashcards = async () => {
    const phraseText = inputText.trim();
    if (!phraseText || !translation || translateError) return;
    const phrase: Phrase = {
      id: translationPhraseId(phraseText, translation, language),
      target_lang: language,
      phrase: phraseText,
      translation,
    };
    const existing = getFlashcardForPhrase(phrase.id);
    if (existing) {
      await removeFromFlashcards(existing.id);
    } else {
      await addToFlashcards(phrase);
      Alert.alert("Saved", "Added to your flashcards.");
    }
  };

  const isSaved = isInFlashcards(
    translationPhraseId(inputText.trim(), translation, language),
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* ── HEADER ── */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>Translate</Text>

        {/* Language tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.langTabsRow}
        >
          {LANGUAGES.map((lang) => {
            const isActive = language === lang.code;
            return (
              <TouchableOpacity
                key={lang.code}
                style={[styles.langTab, isActive && styles.langTabActive]}
                onPress={() => setLanguage(lang.code)}
                activeOpacity={0.8}
              >
                <Text style={styles.langTabFlag}>{lang.flag}</Text>
                <Text style={[styles.langTabLabel, isActive && styles.langTabLabelActive]}>
                  {lang.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── CONTENT ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Input card */}
        <View style={styles.inputCard}>
          <TextInput
            style={styles.input}
            placeholder="Type a word or phrase..."
            placeholderTextColor="#9CA3AF"
            value={inputText}
            onChangeText={handleInputChange}
            onSubmitEditing={handleTranslate}
            returnKeyType="go"
            returnKeyLabel={Platform.OS === "android" ? "Translate" : undefined}
            autoCapitalize="none"
            autoCorrect
            multiline
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[
              styles.translateBtn,
              (!inputText.trim() || translating) && styles.translateBtnDisabled,
            ]}
            onPress={handleTranslate}
            disabled={!inputText.trim() || translating}
            activeOpacity={0.85}
          >
            {translating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.translateBtnText}>Translate</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Result card */}
        {showCard && (
          <Animated.View
            style={[styles.resultCard, { opacity: cardOpacity, transform: [{ translateY: cardY }] }]}
          >
            {translating ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={PRIMARY} />
                <Text style={styles.loadingText}>Translating…</Text>
              </View>
            ) : (
              <>
                <Text style={styles.resultLabel}>Translation</Text>

                {translateError ? (
                  <>
                    <Text style={styles.errorText}>{translateError}</Text>
                    <Text style={styles.errorHint}>Check your connection</Text>
                  </>
                ) : (
                  <View style={styles.resultRow}>
                    {/* Word-by-word highlight */}
                    <View style={styles.translationWords}>
                      {translation.match(/\S+/g)?.map((word, i, arr) => {
                        const isSaid = playbackProgress * arr.length > i;
                        return (
                          <Text
                            key={i}
                            style={[styles.word, isSaid ? styles.wordSaid : styles.wordUnsaid]}
                          >
                            {word}
                            {i < arr.length - 1 ? " " : ""}
                          </Text>
                        );
                      })}
                    </View>

                    {/* Actions */}
                    <View style={styles.resultActions}>
                      <TouchableOpacity
                        style={[styles.iconBtn, playingTTS && styles.iconBtnActive]}
                        onPress={() => !playingTTS && setPlayingTTS(true)}
                        disabled={playingTTS}
                        activeOpacity={0.7}
                      >
                        {playingTTS ? (
                          <View style={styles.miniWaveform}>
                            {waveformLevels.slice(0, 4).map((level, i) => (
                              <View key={i} style={[styles.miniWaveBar, { height: 3 + level * 10 }]} />
                            ))}
                          </View>
                        ) : (
                          <Ionicons name="volume-high-outline" size={18} color={PRIMARY} />
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.iconBtn, isSaved && styles.iconBtnSaved]}
                        onPress={handleSaveToFlashcards}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={isSaved ? "bookmark" : "bookmark-outline"}
                          size={18}
                          color={isSaved ? PRIMARY : "#9CA3AF"}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </>
            )}
          </Animated.View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0F4F8",
  },

  // ── HEADER ──────────────────────────────────────────────────────────────────
  header: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.3,
    marginBottom: 14,
  },
  langTabsRow: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 20,
  },
  langTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  langTabActive: {
    backgroundColor: "#FFFFFF",
  },
  langTabFlag: {
    fontSize: 14,
  },
  langTabLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.85)",
  },
  langTabLabelActive: {
    color: PRIMARY,
  },

  // ── SCROLL ──────────────────────────────────────────────────────────────────
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 16,
  },

  // Input card
  inputCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  input: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    fontSize: 16,
    color: "#111827",
    minHeight: 80,
    maxHeight: 160,
  },
  translateBtn: {
    backgroundColor: PRIMARY,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  translateBtnDisabled: {
    backgroundColor: "#D1D5DB",
  },
  translateBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // Result card
  resultCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  loadingText: {
    fontSize: 14,
    color: "#6B7280",
  },
  resultLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  translationWords: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  word: {
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 28,
  },
  wordSaid: {
    color: "#111827",
  },
  wordUnsaid: {
    color: "#D1D5DB",
  },
  resultActions: {
    flexDirection: "row",
    gap: 8,
    flexShrink: 0,
  },
  errorText: {
    fontSize: 15,
    color: "#EF4444",
    marginBottom: 4,
  },
  errorHint: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(41, 182, 246, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnActive: {
    backgroundColor: "rgba(41, 182, 246, 0.15)",
  },
  iconBtnSaved: {
    backgroundColor: "rgba(41, 182, 246, 0.15)",
  },
  miniWaveform: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    height: 16,
  },
  miniWaveBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: PRIMARY,
    minHeight: 3,
    maxHeight: 14,
  },
});

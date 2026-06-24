import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Pressable,
  Platform,
  Animated,
  Easing,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import {
  useAudioPlayer,
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

const COLORS = {
  bg: "#FAFAFA",
  surface: "#FFFFFF",
  text: "#0A0A0A",
  textMuted: "rgba(0, 0, 0, 0.48)",
  textSubtle: "rgba(0, 0, 0, 0.32)",
  border: "rgba(0, 0, 0, 0.08)",
  borderStrong: "rgba(0, 0, 0, 0.14)",
  cta: "#0B0B0B",
  ctaDisabled: "rgba(0, 0, 0, 0.18)",
  error: "#B91C1C",
};

const FONT =
  Platform.OS === "ios" ? "Helvetica Neue" : "sans-serif-medium";

const ENTRANCE_EASING = Easing.bezier(0.16, 1, 0.3, 1);

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
  const cardY = useRef(new Animated.Value(12)).current;

  const showCard = !!(translation || translateError || translating);
  const canTranslate = inputText.trim().length > 0 && !translating;

  useEffect(() => {
    if (showCard) {
      cardOpacity.setValue(0);
      cardY.setValue(12);
      Animated.parallel([
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 380,
          easing: ENTRANCE_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(cardY, {
          toValue: 0,
          duration: 380,
          easing: ENTRANCE_EASING,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showCard, cardOpacity, cardY]);

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

  const activeLang = LANGUAGES.find((l) => l.code === language);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 32,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Translate</Text>
          {activeLang ? (
            <View style={styles.targetPill}>
              <Text style={styles.targetFlag}>{activeLang.flag}</Text>
              <Text style={styles.targetLabel}>to {activeLang.label}</Text>
            </View>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.langRow}
          style={styles.langScroll}
        >
          {LANGUAGES.map((lang) => {
            const isActive = language === lang.code;
            return (
              <Pressable
                key={lang.code}
                style={({ pressed }) => [
                  styles.langChip,
                  isActive && styles.langChipActive,
                  pressed && styles.langChipPressed,
                ]}
                onPress={() => setLanguage(lang.code)}
              >
                <Text style={styles.langFlag}>{lang.flag}</Text>
                <Text
                  style={[
                    styles.langLabel,
                    isActive && styles.langLabelActive,
                  ]}
                >
                  {lang.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.inputCard}>
          <TextInput
            style={styles.input}
            placeholder="Type a word or phrase..."
            placeholderTextColor={COLORS.textMuted}
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
          <Pressable
            style={({ pressed }) => [
              styles.translateBtn,
              !canTranslate && styles.translateBtnDisabled,
              pressed && canTranslate && styles.translateBtnPressed,
            ]}
            onPress={handleTranslate}
            disabled={!canTranslate}
          >
            {translating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.translateBtnText}>Translate</Text>
            )}
          </Pressable>
        </View>

        {showCard ? (
          <Animated.View
            style={[
              styles.resultCard,
              { opacity: cardOpacity, transform: [{ translateY: cardY }] },
            ]}
          >
            {translating ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={COLORS.text} />
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
                    <View style={styles.translationWords}>
                      {translation.match(/\S+/g)?.map((word, i, arr) => {
                        const isSaid = playbackProgress * arr.length > i;
                        return (
                          <Text
                            key={i}
                            style={[
                              styles.word,
                              isSaid ? styles.wordSaid : styles.wordUnsaid,
                            ]}
                          >
                            {word}
                            {i < arr.length - 1 ? " " : ""}
                          </Text>
                        );
                      })}
                    </View>

                    <View style={styles.resultActions}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.actionBtn,
                          playingTTS && styles.actionBtnActive,
                          pressed && styles.actionBtnPressed,
                        ]}
                        onPress={() => !playingTTS && setPlayingTTS(true)}
                        disabled={playingTTS}
                      >
                        {playingTTS ? (
                          <View style={styles.miniWaveform}>
                            {waveformLevels.slice(0, 4).map((level, i) => (
                              <View
                                key={i}
                                style={[
                                  styles.miniWaveBar,
                                  { height: 3 + level * 10 },
                                  styles.miniWaveBarActive,
                                ]}
                              />
                            ))}
                          </View>
                        ) : (
                          <Ionicons
                            name="volume-medium-outline"
                            size={17}
                            color={COLORS.text}
                          />
                        )}
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [
                          styles.actionBtn,
                          isSaved && styles.actionBtnSaved,
                          pressed && styles.actionBtnPressed,
                        ]}
                        onPress={handleSaveToFlashcards}
                      >
                        <Ionicons
                          name={isSaved ? "bookmark" : "bookmark-outline"}
                          size={17}
                          color={isSaved ? COLORS.text : COLORS.textMuted}
                        />
                      </Pressable>
                    </View>
                  </View>
                )}
              </>
            )}
          </Animated.View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 20,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  headerTitle: {
    fontFamily: FONT,
    fontSize: 28,
    fontWeight: "500",
    color: COLORS.text,
    letterSpacing: -0.8,
  },
  targetPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  targetFlag: {
    fontSize: 14,
  },
  targetLabel: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.textMuted,
    letterSpacing: -0.13,
  },

  langScroll: {
    marginHorizontal: -20,
    flexGrow: 0,
    flexShrink: 0,
  },
  langRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingRight: 36,
  },
  langChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  langChipActive: {
    backgroundColor: COLORS.text,
    borderColor: COLORS.text,
  },
  langChipPressed: {
    opacity: 0.88,
  },
  langFlag: {
    fontSize: 14,
  },
  langLabel: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.textMuted,
    letterSpacing: -0.14,
  },
  langLabelActive: {
    color: "#FFFFFF",
  },

  inputCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    gap: 14,
  },
  input: {
    fontFamily: FONT,
    fontSize: 17,
    fontWeight: "400",
    color: COLORS.text,
    minHeight: 96,
    maxHeight: 160,
    letterSpacing: -0.2,
    lineHeight: 24,
  },
  translateBtn: {
    height: 44,
    borderRadius: 999,
    backgroundColor: COLORS.cta,
    alignItems: "center",
    justifyContent: "center",
  },
  translateBtnDisabled: {
    backgroundColor: COLORS.ctaDisabled,
  },
  translateBtnPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  translateBtnText: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: "500",
    color: "#FFFFFF",
    letterSpacing: -0.16,
  },

  resultCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  loadingText: {
    fontFamily: FONT,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  resultLabel: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: "500",
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 12,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  translationWords: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  word: {
    fontFamily: FONT,
    fontSize: 22,
    fontWeight: "500",
    lineHeight: 30,
    letterSpacing: -0.44,
  },
  wordSaid: {
    color: COLORS.text,
  },
  wordUnsaid: {
    color: COLORS.textSubtle,
  },
  resultActions: {
    flexDirection: "row",
    gap: 6,
    flexShrink: 0,
    paddingTop: 2,
  },
  errorText: {
    fontFamily: FONT,
    fontSize: 15,
    color: COLORS.error,
    marginBottom: 4,
    letterSpacing: -0.15,
  },
  errorHint: {
    fontFamily: FONT,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnActive: {
    backgroundColor: COLORS.text,
    borderColor: COLORS.text,
  },
  actionBtnSaved: {
    backgroundColor: "#F0F0F0",
    borderColor: COLORS.borderStrong,
  },
  actionBtnPressed: {
    opacity: 0.85,
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
    backgroundColor: COLORS.text,
    minHeight: 3,
    maxHeight: 14,
  },
  miniWaveBarActive: {
    backgroundColor: "#FFFFFF",
  },
});

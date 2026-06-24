import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  ScrollView,
  Alert,
  Platform,
} from "react-native";
import {
  useAudioPlayer,
  useAudioSampleListener,
  setAudioModeAsync,
} from "expo-audio";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getSpeechStreamUrl } from "../api/tts";
import { getPhrases, Phrase } from "../api/phrases";
import { useSavedPhrases } from "../context/SavedPhrasesContext";
import { LanguageSelector } from "../components/LanguageSelector";

const COLORS = {
  bg: "#FAFAFA",
  surface: "#FFFFFF",
  text: "#0A0A0A",
  textMuted: "rgba(0, 0, 0, 0.48)",
  textSubtle: "rgba(0, 0, 0, 0.32)",
  border: "rgba(0, 0, 0, 0.08)",
  borderStrong: "rgba(0, 0, 0, 0.14)",
};

const FONT =
  Platform.OS === "ios" ? "Helvetica Neue" : "sans-serif-medium";

const TTS_LANG: Record<string, string> = {
  es: "es",
  fr: "fr",
  it: "it",
  en: "en",
  pt: "pt",
};

type PhraseFilter = "all" | "es" | "fr" | "it" | "en";

const PHRASE_FILTERS: { value: PhraseFilter; label: string; flag: string }[] = [
  { value: "all", label: "All", flag: "🌐" },
  { value: "es", label: "Spanish", flag: "🇪🇸" },
  { value: "fr", label: "French", flag: "🇫🇷" },
  { value: "it", label: "Italian", flag: "🇮🇹" },
  { value: "en", label: "English", flag: "🇬🇧" },
];

const LANG_STYLES: Record<string, { bg: string; text: string }> = {
  es: { bg: "#FFF0ED", text: "#9A3412" },
  fr: { bg: "#EEF4FF", text: "#1D4ED8" },
  it: { bg: "#F0FFF4", text: "#166534" },
  en: { bg: "#F5F0FF", text: "#6D28D9" },
  pt: { bg: "#ECFDF5", text: "#047857" },
};

const LANG_LABELS: Record<string, string> = {
  es: "ES",
  fr: "FR",
  it: "IT",
  en: "EN",
  pt: "PT",
};

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

function PhraseRow({
  phrase,
  saved,
  isPlaying,
  playingTTS,
  waveformLevels,
  onPlay,
  onToggleSave,
}: {
  phrase: Phrase;
  saved: boolean;
  isPlaying: boolean;
  playingTTS: boolean;
  waveformLevels: number[];
  onPlay: () => void;
  onToggleSave: () => void;
}) {
  const langStyle =
    LANG_STYLES[phrase.target_lang] ?? { bg: "#F5F5F4", text: COLORS.text };
  const langLabel =
    LANG_LABELS[phrase.target_lang] ?? phrase.target_lang.toUpperCase().slice(0, 2);

  return (
    <View style={styles.phraseRow}>
      <View style={[styles.langBadge, { backgroundColor: langStyle.bg }]}>
        <Text style={[styles.langBadgeText, { color: langStyle.text }]}>
          {langLabel}
        </Text>
      </View>

      <View style={styles.phraseBody}>
        <Text style={styles.phraseText}>{phrase.phrase}</Text>
        <Text style={styles.phraseTranslation}>{phrase.translation}</Text>
      </View>

      <View style={styles.phraseActions}>
        <Pressable
          style={({ pressed }) => [
            styles.actionBtn,
            isPlaying && styles.actionBtnActive,
            pressed && styles.actionBtnPressed,
          ]}
          onPress={onPlay}
          disabled={playingTTS && !isPlaying}
        >
          {isPlaying ? (
            <View style={styles.miniWaveform}>
              {waveformLevels.slice(0, 4).map((level, i) => (
                <View
                  key={i}
                  style={[
                    styles.miniWaveBar,
                    { height: 3 + level * 10 },
                    isPlaying && styles.miniWaveBarActive,
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
            saved && styles.actionBtnSaved,
            pressed && styles.actionBtnPressed,
          ]}
          onPress={onToggleSave}
        >
          <Ionicons
            name={saved ? "bookmark" : "bookmark-outline"}
            size={17}
            color={saved ? COLORS.text : COLORS.textMuted}
          />
        </Pressable>
      </View>
    </View>
  );
}

export default function GlossaryScreen() {
  const insets = useSafeAreaInsets();
  const { addToFlashcards, removeFromFlashcards, isInFlashcards, getFlashcardForPhrase } =
    useSavedPhrases();

  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [phrasesLoading, setPhrasesLoading] = useState(true);
  const [phraseFilter, setPhraseFilter] = useState<PhraseFilter>("all");
  const [playingTTS, setPlayingTTS] = useState(false);
  const [playingPhraseId, setPlayingPhraseId] = useState<string | null>(null);

  const [waveformLevels, setWaveformLevels] = useState<number[]>(() =>
    Array(WAVEFORM_BAR_COUNT).fill(0),
  );
  const waveformLevelsRef = useRef<number[]>(Array(WAVEFORM_BAR_COUNT).fill(0));
  const waveformIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const playingPhrase = playingPhraseId
    ? phrases.find((p) => p.id === playingPhraseId)
    : null;
  const phraseStreamUrl = playingPhrase
    ? getSpeechStreamUrl(
        playingPhrase.phrase,
        "marin",
        TTS_LANG[playingPhrase.target_lang] || playingPhrase.target_lang,
      )
    : null;

  const player = useAudioPlayer(phraseStreamUrl ? { uri: phraseStreamUrl } : null);

  useEffect(() => {
    if (!phraseStreamUrl || !player) return;
    const sub = player.addListener("playbackStatusUpdate", (status) => {
      if (status.didJustFinish) {
        setPlayingTTS(false);
        setPlayingPhraseId(null);
      }
    });
    return () => sub.remove();
  }, [phraseStreamUrl, player]);

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
    setAudioModeAsync({ playsInSilentMode: true });
  }, []);

  useEffect(() => {
    setPhrasesLoading(true);
    const lang = phraseFilter === "all" ? undefined : phraseFilter;
    const limit = phraseFilter === "all" ? 250 : 100;
    getPhrases(lang, undefined, undefined, limit)
      .then(setPhrases)
      .catch(() => setPhrases([]))
      .finally(() => setPhrasesLoading(false));
  }, [phraseFilter]);

  useEffect(() => {
    if (playingTTS && player) {
      player.seekTo(0).then(() => player.play());
    }
  }, [playingTTS, player]);

  const handlePlayPhrase = (phrase: Phrase) => {
    if (playingTTS) return;
    setPlayingPhraseId(phrase.id);
    setPlayingTTS(true);
  };

  const handleFlashcardToggle = async (phrase: Phrase) => {
    const flashcard = getFlashcardForPhrase(phrase.id);
    if (flashcard) {
      await removeFromFlashcards(flashcard.id);
    } else {
      await addToFlashcards(phrase);
      Alert.alert("Added to flashcards", "You can practice this phrase in the Cards tab.");
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Vocabulary</Text>
          <LanguageSelector variant="pill" />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersRow}
          style={styles.filtersScroll}
        >
          {PHRASE_FILTERS.map(({ value, label, flag }) => {
            const isSelected = phraseFilter === value;
            return (
              <Pressable
                key={value}
                style={({ pressed }) => [
                  styles.filterChip,
                  isSelected && styles.filterChipSelected,
                  pressed && styles.filterChipPressed,
                ]}
                onPress={() => setPhraseFilter(value)}
              >
                <Text style={styles.filterFlag}>{flag}</Text>
                <Text
                  style={[
                    styles.filterLabel,
                    isSelected && styles.filterLabelSelected,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Top phrases</Text>
          {!phrasesLoading ? (
            <Text style={styles.sectionCount}>{phrases.length} phrases</Text>
          ) : null}
        </View>

        {phrasesLoading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="small" color={COLORS.text} />
            <Text style={styles.loaderText}>Loading phrases…</Text>
          </View>
        ) : phrases.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>📚</Text>
            <Text style={styles.emptyText}>
              {phraseFilter === "all"
                ? "No phrases yet"
                : "No phrases for this language"}
            </Text>
          </View>
        ) : (
          <View style={styles.phraseList}>
            {phrases.map((phrase) => (
              <PhraseRow
                key={phrase.id}
                phrase={phrase}
                saved={isInFlashcards(phrase.id)}
                isPlaying={playingPhraseId === phrase.id && playingTTS}
                playingTTS={playingTTS}
                waveformLevels={waveformLevels}
                onPlay={() => handlePlayPhrase(phrase)}
                onToggleSave={() => handleFlashcardToggle(phrase)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
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

  filtersScroll: {
    marginHorizontal: -20,
    flexGrow: 0,
    flexShrink: 0,
  },
  filtersRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingRight: 36,
  },
  filterChip: {
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
  filterChipSelected: {
    backgroundColor: COLORS.text,
    borderColor: COLORS.text,
  },
  filterChipPressed: {
    opacity: 0.88,
  },
  filterFlag: {
    fontSize: 14,
  },
  filterLabel: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.textMuted,
    letterSpacing: -0.14,
  },
  filterLabelSelected: {
    color: "#FFFFFF",
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontFamily: FONT,
    fontSize: 18,
    fontWeight: "500",
    color: COLORS.text,
    letterSpacing: -0.36,
  },
  sectionCount: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: "400",
    color: COLORS.textMuted,
    letterSpacing: -0.13,
  },

  phraseList: {
    gap: 10,
  },
  phraseRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  langBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  langBadgeText: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  phraseBody: {
    flex: 1,
    gap: 4,
    paddingTop: 1,
  },
  phraseText: {
    fontFamily: FONT,
    fontSize: 17,
    fontWeight: "500",
    color: COLORS.text,
    lineHeight: 23,
    letterSpacing: -0.34,
  },
  phraseTranslation: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: "400",
    color: COLORS.textMuted,
    lineHeight: 20,
    letterSpacing: -0.14,
  },
  phraseActions: {
    flexDirection: "row",
    gap: 6,
    flexShrink: 0,
    paddingTop: 2,
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

  loaderWrap: {
    paddingVertical: 48,
    alignItems: "center",
    gap: 10,
  },
  loaderText: {
    fontFamily: FONT,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  emptyWrap: {
    paddingVertical: 56,
    alignItems: "center",
    gap: 8,
  },
  emptyIcon: {
    fontSize: 36,
  },
  emptyText: {
    fontFamily: FONT,
    fontSize: 15,
    color: COLORS.textMuted,
  },
});

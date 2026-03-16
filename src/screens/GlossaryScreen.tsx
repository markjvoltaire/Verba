import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Alert,
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
import { useApp } from "../context/AppContext";
import { useSavedPhrases } from "../context/SavedPhrasesContext";
import { LanguageSelector } from "../components/LanguageSelector";

const PRIMARY = "#29B6F6";

const TTS_LANG: Record<string, string> = {
  es: "es",
  fr: "fr",
  it: "it",
  en: "en",
};

type PhraseFilter = "all" | "es" | "fr" | "it" | "en";

const PHRASE_FILTERS: { value: PhraseFilter; label: string; flag: string }[] = [
  { value: "all", label: "All", flag: "🌐" },
  { value: "es", label: "Spanish", flag: "🇪🇸" },
  { value: "fr", label: "French", flag: "🇫🇷" },
  { value: "it", label: "Italian", flag: "🇮🇹" },
  { value: "en", label: "English", flag: "🇬🇧" },
];

const LANG_COLORS: Record<string, string> = {
  es: "#EF4444",
  fr: "#3B82F6",
  it: "#22C55E",
  en: "#8B5CF6",
};

const LANG_LABELS: Record<string, string> = {
  es: "ES",
  fr: "FR",
  it: "IT",
  en: "EN",
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

export default function GlossaryScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useApp();
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

  const renderPhraseItem = (phrase: Phrase) => {
    const saved = isInFlashcards(phrase.id);
    const langColor = LANG_COLORS[phrase.target_lang] ?? PRIMARY;
    const langLabel = LANG_LABELS[phrase.target_lang] ?? phrase.target_lang.toUpperCase();
    const isPlaying = playingPhraseId === phrase.id && playingTTS;

    return (
      <View style={styles.phraseCard}>
        <View style={[styles.langBadge, { backgroundColor: langColor + "18" }]}>
          <Text style={[styles.langBadgeText, { color: langColor }]}>{langLabel}</Text>
        </View>
        <View style={styles.phraseContent}>
          <Text style={styles.phraseText}>{phrase.phrase}</Text>
          <Text style={styles.phraseTranslation}>{phrase.translation}</Text>
        </View>
        <View style={styles.phraseActions}>
          <TouchableOpacity
            style={[styles.iconBtn, isPlaying && styles.iconBtnActive]}
            onPress={() => handlePlayPhrase(phrase)}
            disabled={playingTTS && !isPlaying}
            activeOpacity={0.7}
          >
            {isPlaying ? (
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
            style={[styles.iconBtn, saved && styles.iconBtnSaved]}
            onPress={() => handleFlashcardToggle(phrase)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={saved ? "bookmark" : "bookmark-outline"}
              size={18}
              color={saved ? PRIMARY : "#9CA3AF"}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* ── HEADER ── */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Vocabulary</Text>
          <LanguageSelector />
        </View>
      </View>

      {/* ── CONTENT ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Filter pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsRow}
          style={styles.pillsScroll}
        >
          {PHRASE_FILTERS.map(({ value, label, flag }) => {
            const isSelected = phraseFilter === value;
            return (
              <TouchableOpacity
                key={value}
                style={[styles.pill, isSelected && styles.pillSelected]}
                onPress={() => setPhraseFilter(value)}
                activeOpacity={0.8}
              >
                <Text style={styles.pillFlag}>{flag}</Text>
                <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Section label */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>Top Phrases</Text>
          {!phrasesLoading && (
            <Text style={styles.sectionCount}>{phrases.length} phrases</Text>
          )}
        </View>

        {/* Phrase list */}
        {phrasesLoading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text style={styles.loaderText}>Loading phrases…</Text>
          </View>
        ) : phrases.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>📚</Text>
            <Text style={styles.emptyText}>
              {phraseFilter === "all" ? "No phrases yet" : "No phrases for this language"}
            </Text>
          </View>
        ) : (
          phrases.map((phrase) => (
            <View key={phrase.id}>{renderPhraseItem(phrase)}</View>
          ))
        )}
      </ScrollView>
    </View>
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
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },

  // ── SCROLL ───────────────────────────────────────────────────────────────────
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  // ── FILTER PILLS ─────────────────────────────────────────────────────────────
  pillsScroll: {
    marginHorizontal: -20,
    marginBottom: 20,
    flexGrow: 0,
    flexShrink: 0,
  },
  pillsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 4,
    paddingRight: 40,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  pillSelected: {
    backgroundColor: PRIMARY,
  },
  pillFlag: {
    fontSize: 14,
  },
  pillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  pillTextSelected: {
    color: "#FFFFFF",
  },

  // ── SECTION HEADER ────────────────────────────────────────────────────────────
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  sectionCount: {
    fontSize: 13,
    color: "#9CA3AF",
  },

  // ── PHRASE CARDS ──────────────────────────────────────────────────────────────
  phraseCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  langBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  langBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  phraseContent: {
    flex: 1,
    gap: 4,
  },
  phraseText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    lineHeight: 24,
  },
  phraseTranslation: {
    fontSize: 15,
    color: "#6B7280",
    lineHeight: 20,
  },
  phraseActions: {
    flexDirection: "row",
    gap: 6,
    flexShrink: 0,
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
  loaderWrap: {
    paddingVertical: 48,
    alignItems: "center",
    gap: 10,
  },
  loaderText: {
    fontSize: 14,
    color: "#9CA3AF",
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
    fontSize: 15,
    color: "#9CA3AF",
  },
});

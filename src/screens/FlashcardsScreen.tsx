import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  Animated,
  ActivityIndicator,
} from "react-native";
import { useAudioPlayer, setAudioModeAsync } from "expo-audio";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getSpeechStreamUrl } from "../api/tts";
import { useApp } from "../context/AppContext";
import { useSavedPhrases } from "../context/SavedPhrasesContext";
import type { SavedPhrase } from "../context/SavedPhrasesContext";

const PRIMARY = "#29B6F6";
const FLIP_DURATION = 380;

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

function FlipCard({
  isFlipped,
  onFlip,
  phrase,
  translation,
  showTranslationFirst,
  onPlay,
  onRemove,
  isLoading,
  langColor,
  langFlag,
}: {
  isFlipped: boolean;
  onFlip: () => void;
  phrase: string;
  translation: string;
  showTranslationFirst?: boolean;
  onPlay: () => void;
  onRemove: () => void;
  isLoading: boolean;
  langColor: string;
  langFlag: string;
}) {
  const { width } = useWindowDimensions();
  const cardWidth = width - 48;

  const frontText = showTranslationFirst ? translation : phrase;
  const backText = showTranslationFirst ? phrase : translation;
  const frontHint = showTranslationFirst ? "Tap to see phrase" : "Tap to see translation";

  const flipAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(flipAnim, {
      toValue: isFlipped ? 1 : 0,
      duration: FLIP_DURATION,
      useNativeDriver: true,
    }).start();
  }, [isFlipped, flipAnim]);

  const frontRotate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });
  const backRotate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["180deg", "360deg"],
  });
  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 0.45, 0.5, 1],
    outputRange: [1, 1, 0, 0],
  });
  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 0.45, 0.5, 1],
    outputRange: [0, 0, 1, 1],
  });

  return (
    <TouchableOpacity
      style={[styles.cardWrapper, { width: cardWidth }]}
      onPress={onFlip}
      activeOpacity={0.97}
    >
      {/* Back face (translation) — blue */}
      <Animated.View
        style={[
          styles.cardFace,
          styles.cardBack,
          {
            width: cardWidth,
            opacity: backOpacity,
            transform: [{ perspective: 1200 }, { rotateY: backRotate }],
          },
        ]}
      >
        <View style={styles.cardTopRow}>
          <View style={[styles.cardLangDot, { backgroundColor: "rgba(255,255,255,0.3)" }]} />
          <Text style={styles.cardBackHint}>Tap to flip back</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardBackText}>{backText}</Text>
        </View>
        <View style={styles.cardBottomRow}>
          <TouchableOpacity
            style={styles.cardIconBtn}
            onPress={(e) => { e.stopPropagation(); onPlay(); }}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="rgba(255,255,255,0.9)" />
            ) : (
              <Ionicons name="volume-high" size={20} color="rgba(255,255,255,0.9)" />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cardIconBtn}
            onPress={(e) => { e.stopPropagation(); onRemove(); }}
          >
            <Ionicons name="trash-outline" size={20} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Front face (phrase) — white */}
      <Animated.View
        style={[
          styles.cardFace,
          styles.cardFront,
          {
            width: cardWidth,
            opacity: frontOpacity,
            transform: [{ perspective: 1200 }, { rotateY: frontRotate }],
          },
        ]}
      >
        <View style={styles.cardTopRow}>
          <View style={[styles.cardLangDot, { backgroundColor: langColor + "30" }]}>
            <Text style={styles.cardLangFlag}>{langFlag}</Text>
          </View>
          <Text style={styles.cardFrontHint}>{frontHint}</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardFrontText}>{frontText}</Text>
        </View>
        <View style={styles.cardBottomRow}>
          <TouchableOpacity
            style={[styles.cardIconBtnLight, { backgroundColor: langColor + "15" }]}
            onPress={(e) => { e.stopPropagation(); onPlay(); }}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={langColor} />
            ) : (
              <Ionicons name="volume-high-outline" size={20} color={langColor} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cardIconBtnLight}
            onPress={(e) => { e.stopPropagation(); onRemove(); }}
          >
            <Ionicons name="trash-outline" size={20} color="#D1D5DB" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function FlashcardsScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useApp();
  const { getFlashcards, removeFromFlashcards } = useSavedPhrases();
  const allFlashcards = getFlashcards();
  const [phraseFilter, setPhraseFilter] = useState<PhraseFilter>("all");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flippedId, setFlippedId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const flashcards =
    phraseFilter === "all"
      ? allFlashcards
      : allFlashcards.filter((c) => c.phrase.target_lang === phraseFilter);

  // Reset index when filter changes
  useEffect(() => {
    setCurrentIndex(0);
    setFlippedId(null);
  }, [phraseFilter]);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true });
  }, []);

  const currentCard = flashcards[currentIndex] ?? null;
  const playText = currentCard
    ? currentCard.phrase.id.startsWith("translation_")
      ? currentCard.phrase.translation
      : currentCard.phrase.phrase
    : null;
  const playLang = currentCard?.phrase.target_lang ?? language;
  const ttsUri =
    playingId && playText
      ? getSpeechStreamUrl(playText, "marin", TTS_LANG[playLang] || playLang)
      : null;

  const player = useAudioPlayer(ttsUri ? { uri: ttsUri } : null);

  useEffect(() => {
    if (playingId && player) {
      player.seekTo(0).then(() => player.play());
    }
  }, [playingId, player]);

  useEffect(() => {
    if (!player) return;
    const sub = player.addListener("playbackStatusUpdate", (status) => {
      if (status.didJustFinish) setPlayingId(null);
    });
    return () => sub.remove();
  }, [player]);

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setFlippedId(null);
    }
  };

  const handleNext = () => {
    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex((i) => i + 1);
      setFlippedId(null);
    }
  };

  const handleRemove = async (id: string) => {
    await removeFromFlashcards(id);
    setFlippedId(null);
    setCurrentIndex((i) => Math.max(0, Math.min(i, flashcards.length - 2)));
  };

  const getLangInfo = (card: SavedPhrase) => {
    const lang = card.phrase.target_lang;
    return {
      color: LANG_COLORS[lang] ?? PRIMARY,
      flag: PHRASE_FILTERS.find((f) => f.value === lang)?.flag ?? "🌐",
    };
  };

  // ── EMPTY STATE ──
  if (allFlashcards.length === 0) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.headerTitle}>Flashcards</Text>
          <Text style={styles.headerSubtitle}>Review your saved phrases</Text>
        </View>
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Text style={styles.emptyIcon}>🃏</Text>
          </View>
          <Text style={styles.emptyTitle}>No cards yet</Text>
          <Text style={styles.emptyText}>
            Save phrases from the Vocab tab and they'll appear here for review.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── BLUE HEADER ── */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Flashcards</Text>
            <Text style={styles.headerSubtitle}>
              {allFlashcards.length} phrase{allFlashcards.length !== 1 ? "s" : ""} saved
            </Text>
          </View>
          {flashcards.length > 0 && (
            <View style={styles.progressBadge}>
              <Text style={styles.progressBadgeText}>
                {currentIndex + 1} / {flashcards.length}
              </Text>
            </View>
          )}
        </View>

        {/* Filter pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsRow}
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
      </View>

      {/* ── CONTENT ── */}
      {flashcards.length === 0 ? (
        <View style={styles.filterEmpty}>
          <Text style={styles.filterEmptyIcon}>🔍</Text>
          <Text style={styles.filterEmptyText}>No cards for this language</Text>
        </View>
      ) : (
        <View style={styles.studyArea}>
          {/* Progress bar */}
          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${((currentIndex + 1) / flashcards.length) * 100}%`,
                },
              ]}
            />
          </View>

          {/* Flip card */}
          {currentCard && (() => {
            const { color, flag } = getLangInfo(currentCard);
            return (
              <View style={styles.cardArea}>
                <FlipCard
                  key={currentCard.id}
                  isFlipped={flippedId === currentCard.id}
                  onFlip={() =>
                    setFlippedId((prev) =>
                      prev === currentCard.id ? null : currentCard.id
                    )
                  }
                  phrase={currentCard.phrase.phrase}
                  translation={currentCard.phrase.translation}
                  showTranslationFirst={currentCard.phrase.id.startsWith("translation_")}
                  onPlay={() => setPlayingId(currentCard.id)}
                  onRemove={() => handleRemove(currentCard.id)}
                  isLoading={playingId === currentCard.id}
                  langColor={color}
                  langFlag={flag}
                />
              </View>
            );
          })()}

          {/* Navigation */}
          <View style={styles.navRow}>
            <TouchableOpacity
              style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
              onPress={handlePrev}
              disabled={currentIndex === 0}
              activeOpacity={0.7}
            >
              <Ionicons
                name="arrow-back"
                size={20}
                color={currentIndex === 0 ? "#D1D5DB" : "#111827"}
              />
              <Text
                style={[
                  styles.navBtnText,
                  currentIndex === 0 && styles.navBtnTextDisabled,
                ]}
              >
                Previous
              </Text>
            </TouchableOpacity>

            <View style={styles.navCenter}>
              <Text style={styles.navCounter}>
                {currentIndex + 1} of {flashcards.length}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.navBtn,
                styles.navBtnNext,
                currentIndex === flashcards.length - 1 && styles.navBtnDisabled,
              ]}
              onPress={handleNext}
              disabled={currentIndex === flashcards.length - 1}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.navBtnText,
                  styles.navBtnTextNext,
                  currentIndex === flashcards.length - 1 && styles.navBtnTextDisabled,
                ]}
              >
                Next
              </Text>
              <Ionicons
                name="arrow-forward"
                size={20}
                color={
                  currentIndex === flashcards.length - 1 ? "#D1D5DB" : PRIMARY
                }
              />
            </TouchableOpacity>
          </View>

          {/* All done state */}
          {currentIndex === flashcards.length - 1 && flashcards.length > 1 && (
            <TouchableOpacity
              style={styles.restartBtn}
              onPress={() => { setCurrentIndex(0); setFlippedId(null); }}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh" size={16} color={PRIMARY} />
              <Text style={styles.restartBtnText}>Start over</Text>
            </TouchableOpacity>
          )}
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
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
    marginTop: 2,
  },
  progressBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  progressBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // Filter pills
  pillsRow: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 20,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  pillSelected: {
    backgroundColor: "#FFFFFF",
  },
  pillFlag: {
    fontSize: 13,
  },
  pillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.85)",
  },
  pillTextSelected: {
    color: PRIMARY,
  },

  // ── STUDY AREA ───────────────────────────────────────────────────────────────
  studyArea: {
    flex: 1,
    paddingTop: 20,
    paddingHorizontal: 24,
    alignItems: "center",
  },

  // Progress bar
  progressBarTrack: {
    width: "100%",
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 16,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: PRIMARY,
    borderRadius: 2,
  },

  // Dots
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 20,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#D1D5DB",
  },
  dotActive: {
    width: 18,
    backgroundColor: PRIMARY,
  },
  dotsMore: {
    fontSize: 11,
    color: "#9CA3AF",
    marginLeft: 2,
  },

  // Card area
  cardArea: {
    width: "100%",
    alignItems: "center",
    marginBottom: 28,
  },
  cardWrapper: {
    height: 220,
  },
  cardFace: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 20,
    padding: 22,
    justifyContent: "space-between",
  },
  cardFront: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
    zIndex: 1,
  },
  cardBack: {
    backgroundColor: PRIMARY,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
    zIndex: 0,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardLangDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cardLangFlag: {
    fontSize: 16,
  },
  cardFrontHint: {
    fontSize: 11,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  cardBackHint: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "500",
  },
  cardBody: {
    flex: 1,
    justifyContent: "center",
  },
  cardFrontText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    letterSpacing: -0.3,
    lineHeight: 30,
  },
  cardBackText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.3,
    lineHeight: 30,
  },
  cardBottomRow: {
    flexDirection: "row",
    gap: 10,
  },
  cardIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardIconBtnLight: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },

  // ── NAVIGATION ───────────────────────────────────────────────────────────────
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    gap: 8,
  },
  navBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  navBtnNext: {
    backgroundColor: "rgba(41, 182, 246, 0.1)",
  },
  navBtnDisabled: {
    opacity: 0.45,
  },
  navBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  navBtnTextNext: {
    color: PRIMARY,
  },
  navBtnTextDisabled: {
    color: "#9CA3AF",
  },
  navCenter: {
    flex: 1,
    alignItems: "center",
  },
  navCounter: {
    fontSize: 13,
    color: "#9CA3AF",
    fontWeight: "500",
  },

  // Restart
  restartBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: PRIMARY,
  },
  restartBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: PRIMARY,
  },

  // ── EMPTY STATES ─────────────────────────────────────────────────────────────
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 48,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(41, 182, 246, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyIcon: {
    fontSize: 36,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 10,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
  },
  filterEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  filterEmptyIcon: {
    fontSize: 32,
  },
  filterEmptyText: {
    fontSize: 15,
    color: "#9CA3AF",
  },
});

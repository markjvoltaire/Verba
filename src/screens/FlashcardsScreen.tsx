import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { useAudioPlayer, setAudioModeAsync } from "expo-audio";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getSpeechStreamUrl } from "../api/tts";
import { useApp } from "../context/AppContext";
import { useSavedPhrases } from "../context/SavedPhrasesContext";
import type { SavedPhrase } from "../context/SavedPhrasesContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = 120;
const SWIPE_OUT_DURATION = 300;
const FLIP_DURATION = 350;

const BG = "#0F172A";
const CARD_BG = "#1E293B";
const CARD_BORDER = "#334155";
const ACCENT = "#29B6F6";
const CORRECT_COLOR = "#22C55E";
const WRONG_COLOR = "#EF4444";

const TTS_LANG: Record<string, string> = {
  es: "es",
  fr: "fr",
  it: "it",
  en: "en",
};

function SwipeCard({
  phrase,
  translation,
  showTranslationFirst,
  isFlipped,
  onFlip,
  onPlay,
  isPlayLoading,
  onSwipeLeft,
  onSwipeRight,
  isFavorited,
  onToggleFavorite,
}: {
  phrase: string;
  translation: string;
  showTranslationFirst?: boolean;
  isFlipped: boolean;
  onFlip: () => void;
  onPlay: () => void;
  isPlayLoading: boolean;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  isFavorited: boolean;
  onToggleFavorite: () => void;
}) {
  const position = useRef(new Animated.ValueXY()).current;
  const flipAnim = useRef(new Animated.Value(0)).current;

  const frontText = showTranslationFirst ? translation : phrase;
  const backText = showTranslationFirst ? phrase : translation;

  useEffect(() => {
    Animated.timing(flipAnim, {
      toValue: isFlipped ? 1 : 0,
      duration: FLIP_DURATION,
      useNativeDriver: true,
    }).start();
  }, [isFlipped, flipAnim]);

  const frontRotateY = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });
  const backRotateY = flipAnim.interpolate({
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

  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ["-12deg", "0deg", "12deg"],
    extrapolate: "clamp",
  });

  const correctOverlayOpacity = position.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 0.35],
    extrapolate: "clamp",
  });

  const wrongOverlayOpacity = position.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [0.35, 0],
    extrapolate: "clamp",
  });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: 0 });
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          Animated.timing(position, {
            toValue: { x: SCREEN_WIDTH + 100, y: 0 },
            duration: SWIPE_OUT_DURATION,
            useNativeDriver: true,
          }).start(() => onSwipeRight());
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          Animated.timing(position, {
            toValue: { x: -SCREEN_WIDTH - 100, y: 0 },
            duration: SWIPE_OUT_DURATION,
            useNativeDriver: true,
          }).start(() => onSwipeLeft());
        } else {
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            friction: 6,
            tension: 80,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const cardTransform = {
    transform: [
      { translateX: position.x },
      { rotate },
    ],
  };

  return (
    <Animated.View
      style={[styles.swipeCardOuter, cardTransform]}
      {...panResponder.panHandlers}
    >
      {/* Correct overlay (green, right swipe) */}
      <Animated.View
        style={[styles.swipeOverlay, styles.swipeOverlayCorrect, { opacity: correctOverlayOpacity }]}
        pointerEvents="none"
      />
      {/* Wrong overlay (red, left swipe) */}
      <Animated.View
        style={[styles.swipeOverlay, styles.swipeOverlayWrong, { opacity: wrongOverlayOpacity }]}
        pointerEvents="none"
      />

      <TouchableOpacity
        style={styles.cardTouchable}
        onPress={onFlip}
        activeOpacity={1}
      >
        {/* Back face */}
        <Animated.View
          style={[
            styles.flipFace,
            {
              opacity: backOpacity,
              transform: [{ perspective: 1200 }, { rotateY: backRotateY }],
            },
          ]}
        >
          <View style={styles.cardInnerTop}>
            <TouchableOpacity
              style={styles.cardActionBtn}
              onPress={(e) => { e.stopPropagation(); onPlay(); }}
              disabled={isPlayLoading}
            >
              {isPlayLoading ? (
                <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" />
              ) : (
                <Ionicons name="volume-high" size={22} color="rgba(255,255,255,0.7)" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cardActionBtn}
              onPress={(e) => { e.stopPropagation(); onToggleFavorite(); }}
            >
              <Ionicons
                name={isFavorited ? "star" : "star-outline"}
                size={22}
                color={isFavorited ? "#FBBF24" : "rgba(255,255,255,0.4)"}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.cardTextArea}>
            <Text style={styles.cardText}>{backText}</Text>
          </View>
          <Text style={styles.flipHint}>tap to flip</Text>
        </Animated.View>

        {/* Front face */}
        <Animated.View
          style={[
            styles.flipFace,
            {
              opacity: frontOpacity,
              transform: [{ perspective: 1200 }, { rotateY: frontRotateY }],
              zIndex: 1,
            },
          ]}
        >
          <View style={styles.cardInnerTop}>
            <TouchableOpacity
              style={styles.cardActionBtn}
              onPress={(e) => { e.stopPropagation(); onPlay(); }}
              disabled={isPlayLoading}
            >
              {isPlayLoading ? (
                <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" />
              ) : (
                <Ionicons name="volume-high-outline" size={22} color="rgba(255,255,255,0.5)" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cardActionBtn}
              onPress={(e) => { e.stopPropagation(); onToggleFavorite(); }}
            >
              <Ionicons
                name={isFavorited ? "star" : "star-outline"}
                size={22}
                color={isFavorited ? "#FBBF24" : "rgba(255,255,255,0.3)"}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.cardTextArea}>
            <Text style={styles.cardText}>{frontText}</Text>
          </View>
          <Text style={styles.flipHint}>tap to flip</Text>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function FlashcardsScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useApp();
  const { getFlashcards, removeFromFlashcards } = useSavedPhrases();
  const allFlashcards = getFlashcards();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [flippedId, setFlippedId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, "correct" | "wrong">>({});
  const [cardKey, setCardKey] = useState(0);

  const flashcards = allFlashcards;

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true });
  }, []);

  const currentCard = flashcards[currentIndex] ?? null;
  const isFinished = currentIndex >= flashcards.length;

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
    const sub = player.addListener("playbackStatusUpdate", (status: any) => {
      if (status.didJustFinish) setPlayingId(null);
    });
    return () => sub.remove();
  }, [player]);

  const advanceCard = useCallback((direction: "correct" | "wrong") => {
    if (!currentCard) return;
    setResults((prev) => ({ ...prev, [currentCard.id]: direction }));
    setFlippedId(null);
    setCurrentIndex((i) => i + 1);
    setCardKey((k) => k + 1);
  }, [currentCard]);

  const handleUndo = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setFlippedId(null);
      setCardKey((k) => k + 1);
    }
  }, [currentIndex]);

  const handleRestart = useCallback(() => {
    setCurrentIndex(0);
    setFlippedId(null);
    setResults({});
    setCardKey((k) => k + 1);
  }, []);

  const correctCount = useMemo(
    () => Object.values(results).filter((r) => r === "correct").length,
    [results]
  );
  const wrongCount = useMemo(
    () => Object.values(results).filter((r) => r === "wrong").length,
    [results]
  );

  const progressPercent =
    flashcards.length > 0
      ? Math.round((currentIndex / flashcards.length) * 100)
      : 0;

  if (allFlashcards.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
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

  if (isFinished) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.summaryContainer}>
          <Text style={styles.summaryEmoji}>🎉</Text>
          <Text style={styles.summaryTitle}>Session Complete!</Text>
          <Text style={styles.summarySubtitle}>
            You reviewed {flashcards.length} card{flashcards.length !== 1 ? "s" : ""}
          </Text>
          <View style={styles.summaryStatsRow}>
            <View style={styles.summaryStat}>
              <View style={[styles.summaryDot, { backgroundColor: CORRECT_COLOR }]} />
              <Text style={styles.summaryStatLabel}>Correct</Text>
              <Text style={[styles.summaryStatValue, { color: CORRECT_COLOR }]}>{correctCount}</Text>
            </View>
            <View style={styles.summaryStat}>
              <View style={[styles.summaryDot, { backgroundColor: WRONG_COLOR }]} />
              <Text style={styles.summaryStatLabel}>Wrong</Text>
              <Text style={[styles.summaryStatValue, { color: WRONG_COLOR }]}>{wrongCount}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.restartBtn}
            onPress={handleRestart}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={18} color="#FFFFFF" />
            <Text style={styles.restartBtnText}>Study Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBarBtn} onPress={handleRestart}>
          <Ionicons name="close" size={24} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
        <Text style={styles.topBarCounter}>
          {currentIndex + 1} / {flashcards.length}
        </Text>
        <View style={styles.topBarBtn}>
          <Ionicons name="settings-outline" size={22} color="rgba(255,255,255,0.7)" />
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
      </View>

      {/* Swipe labels */}
      <View style={styles.swipeLabelsRow}>
        <View style={[styles.swipeLabel, styles.swipeLabelWrong]}>
          <Text style={[styles.swipeLabelText, { color: WRONG_COLOR }]}>Wrong</Text>
        </View>
        <View style={[styles.swipeLabel, styles.swipeLabelCorrect]}>
          <Text style={[styles.swipeLabelText, { color: CORRECT_COLOR }]}>Correct</Text>
        </View>
      </View>

      {/* Card area */}
      <View style={styles.cardContainer}>
        {currentCard && (
          <SwipeCard
            key={`${currentCard.id}-${cardKey}`}
            phrase={currentCard.phrase.phrase}
            translation={currentCard.phrase.translation}
            showTranslationFirst={currentCard.phrase.id.startsWith("translation_")}
            isFlipped={flippedId === currentCard.id}
            onFlip={() =>
              setFlippedId((prev) =>
                prev === currentCard.id ? null : currentCard.id
              )
            }
            onPlay={() => setPlayingId(currentCard.id)}
            isPlayLoading={playingId === currentCard.id}
            onSwipeLeft={() => advanceCard("wrong")}
            onSwipeRight={() => advanceCard("correct")}
            isFavorited={true}
            onToggleFavorite={() => removeFromFlashcards(currentCard.id)}
          />
        )}
      </View>

      {/* Bottom bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[styles.bottomBtn, currentIndex === 0 && styles.bottomBtnDisabled]}
          onPress={handleUndo}
          disabled={currentIndex === 0}
          activeOpacity={0.7}
        >
          <Ionicons
            name="arrow-undo"
            size={24}
            color={currentIndex === 0 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.7)"}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomBtn}
          onPress={() => advanceCard("correct")}
          activeOpacity={0.7}
        >
          <Ionicons name="play" size={24} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  topBarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarCounter: {
    fontSize: 16,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
    letterSpacing: 0.5,
  },

  progressTrack: {
    height: 3,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginHorizontal: 16,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: ACCENT,
    borderRadius: 2,
  },

  swipeLabelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginTop: 12,
  },
  swipeLabel: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  swipeLabelWrong: {
    backgroundColor: "rgba(239,68,68,0.12)",
  },
  swipeLabelCorrect: {
    backgroundColor: "rgba(34,197,94,0.12)",
  },
  swipeLabelText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  cardContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  swipeCardOuter: {
    width: SCREEN_WIDTH - 40,
    height: "85%",
    maxHeight: 580,
  },
  swipeOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    zIndex: 10,
  },
  swipeOverlayCorrect: {
    backgroundColor: CORRECT_COLOR,
  },
  swipeOverlayWrong: {
    backgroundColor: WRONG_COLOR,
  },

  cardTouchable: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    overflow: "hidden",
  },

  flipFace: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 24,
    justifyContent: "space-between",
  },

  cardInnerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },

  cardTextArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  cardText: {
    fontSize: 26,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 36,
    letterSpacing: -0.3,
  },

  flipHint: {
    fontSize: 12,
    color: "rgba(255,255,255,0.25)",
    textAlign: "center",
    fontWeight: "500",
  },

  bottomBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 40,
    paddingTop: 12,
  },
  bottomBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  bottomBtnDisabled: {
    opacity: 0.35,
  },

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
    backgroundColor: "rgba(41,182,246,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyIcon: {
    fontSize: 36,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 10,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 15,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    lineHeight: 22,
  },

  summaryContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  summaryEmoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  summarySubtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 32,
  },
  summaryStatsRow: {
    flexDirection: "row",
    gap: 32,
    marginBottom: 40,
  },
  summaryStat: {
    alignItems: "center",
    gap: 6,
  },
  summaryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  summaryStatLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
  },
  summaryStatValue: {
    fontSize: 32,
    fontWeight: "800",
  },
  restartBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: ACCENT,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16,
  },
  restartBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});

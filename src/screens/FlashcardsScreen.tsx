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
  Alert,
} from "react-native";
import { useAudioPlayer, setAudioModeAsync } from "expo-audio";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getSpeechStreamUrl } from "../api/tts";
import { useApp } from "../context/AppContext";
import { useSavedPhrases } from "../context/SavedPhrasesContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = 120;
const SWIPE_OUT_DURATION = 300;
const FLIP_DURATION = 350;

const BG = "#F0F4F8";
const CARD_BG = "#FFFFFF";
const CARD_BORDER = "#E5E7EB";
const TEXT_PRIMARY = "#1E293B";
const TEXT_MUTED = "#64748B";
const TEXT_HINT = "#94A3B8";
const ACCENT = "#29B6F6";
const ACCENT_SOFT = "rgba(41, 182, 246, 0.12)";
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
  onDelete,
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
  onDelete: () => void;
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
            styles.flipFaceBack,
            {
              opacity: backOpacity,
              transform: [{ perspective: 1200 }, { rotateY: backRotateY }],
            },
          ]}
        >
          <View style={styles.cardInnerTop}>
            <TouchableOpacity
              style={[styles.cardActionBtn, styles.cardActionBtnBack]}
              onPress={(e) => { e.stopPropagation(); onPlay(); }}
              disabled={isPlayLoading}
            >
              {isPlayLoading ? (
                <ActivityIndicator size="small" color={ACCENT} />
              ) : (
                <Ionicons name="volume-high" size={22} color={ACCENT} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cardActionBtn, styles.cardActionBtnBack]}
              onPress={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <Ionicons name="trash-outline" size={22} color={WRONG_COLOR} />
            </TouchableOpacity>
          </View>
          <View style={styles.cardTextArea}>
            <Text style={styles.cardTextBack}>{backText}</Text>
          </View>
          <Text style={styles.flipHintBack}>tap to flip</Text>
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
                <ActivityIndicator size="small" color={ACCENT} />
              ) : (
                <Ionicons name="volume-high-outline" size={22} color={ACCENT} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cardActionBtn}
              onPress={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <Ionicons name="trash-outline" size={22} color={TEXT_MUTED} />
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

  const confirmDeleteCard = useCallback(() => {
    if (!currentCard) return;
    Alert.alert(
      "Remove card",
      "Remove this phrase from your flashcards? You can save it again from Vocab.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const idx = currentIndex;
            const len = flashcards.length;
            await removeFromFlashcards(currentCard.id);
            setFlippedId(null);
            setCardKey((k) => k + 1);
            if (len <= 1) {
              setCurrentIndex(0);
            } else if (idx >= len - 1) {
              setCurrentIndex(idx - 1);
            }
          },
        },
      ]
    );
  }, [currentCard, currentIndex, flashcards.length, removeFromFlashcards]);

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
      <View style={styles.container}>
        <View style={[styles.blueHeader, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.emptyHeaderTitle}>Flashcards</Text>
          <Text style={styles.emptyHeaderSubtitle}>Review saved phrases</Text>
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

  if (isFinished) {
    return (
      <View style={styles.container}>
        <View style={[styles.blueHeader, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.emptyHeaderTitle}>Flashcards</Text>
        </View>
        <View style={styles.summaryContainer}>
          <Text style={styles.summaryEmoji}>🎉</Text>
          <Text style={styles.summaryTitle}>Session complete</Text>
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
    <View style={styles.container}>
      {/* Blue header (matches Progress / Home accent) */}
      <View style={[styles.blueHeader, { paddingTop: insets.top + 12 }]}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.topBarBtn} onPress={handleRestart}>
            <Ionicons name="close" size={24} color="rgba(255,255,255,0.9)" />
          </TouchableOpacity>
          <Text style={styles.topBarCounterOnBlue}>
            {currentIndex + 1} / {flashcards.length}
          </Text>
          <View style={styles.topBarBtn}>
            <Ionicons name="settings-outline" size={22} color="rgba(255,255,255,0.85)" />
          </View>
        </View>
        <View style={styles.progressTrackOnBlue}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>
      </View>

      <View style={styles.mainBody}>
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
            onDelete={confirmDeleteCard}
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
            color={currentIndex === 0 ? TEXT_HINT : TEXT_MUTED}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomBtn}
          onPress={() => advanceCard("correct")}
          activeOpacity={0.7}
        >
          <Ionicons name="play" size={24} color={ACCENT} />
        </TouchableOpacity>
      </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },

  emptyHeaderTitle: {
    fontFamily: "Georgia",
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  emptyHeaderSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
  },

  blueHeader: {
    backgroundColor: ACCENT,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  progressTrackOnBlue: {
    height: 3,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 2,
    overflow: "hidden",
    marginTop: 4,
  },
  mainBody: {
    flex: 1,
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
  topBarCounterOnBlue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },

  progressFill: {
    height: "100%",
    backgroundColor: "#FFFFFF",
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },

  flipFace: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 24,
    justifyContent: "space-between",
    backgroundColor: CARD_BG,
  },
  flipFaceBack: {
    backgroundColor: ACCENT_SOFT,
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
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  cardActionBtnBack: {
    backgroundColor: "rgba(255,255,255,0.85)",
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
    color: TEXT_PRIMARY,
    textAlign: "center",
    lineHeight: 36,
    letterSpacing: -0.3,
  },
  cardTextBack: {
    fontSize: 26,
    fontWeight: "600",
    color: ACCENT,
    textAlign: "center",
    lineHeight: 36,
    letterSpacing: -0.3,
  },

  flipHint: {
    fontSize: 12,
    color: TEXT_HINT,
    textAlign: "center",
    fontWeight: "500",
  },
  flipHintBack: {
    fontSize: 12,
    color: TEXT_MUTED,
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
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: CARD_BORDER,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
    color: TEXT_PRIMARY,
    marginBottom: 10,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 15,
    color: TEXT_MUTED,
    textAlign: "center",
    lineHeight: 22,
  },

  summaryContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingBottom: 24,
  },
  summaryEmoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: TEXT_PRIMARY,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  summarySubtitle: {
    fontSize: 16,
    color: TEXT_MUTED,
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
    color: TEXT_MUTED,
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

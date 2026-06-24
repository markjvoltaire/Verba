import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  PanResponder,
  Dimensions,
  ActivityIndicator,
  Alert,
  Platform,
  Easing,
} from "react-native";
import { useAudioPlayer, setAudioModeAsync } from "expo-audio";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getSpeechStreamUrl } from "../api/tts";
import { useApp } from "../context/AppContext";
import { useSavedPhrases } from "../context/SavedPhrasesContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = 120;
const SWIPE_OUT_DURATION = 340;
const FLIP_DURATION = 420;

const COLORS = {
  bg: "#FAFAFA",
  surface: "#FFFFFF",
  surfaceMuted: "#F5F5F4",
  text: "#0A0A0A",
  textMuted: "rgba(0, 0, 0, 0.48)",
  textSubtle: "rgba(0, 0, 0, 0.32)",
  border: "rgba(0, 0, 0, 0.08)",
  borderStrong: "rgba(0, 0, 0, 0.14)",
  cta: "#0B0B0B",
  correct: "#15803D",
  correctSoft: "rgba(21, 128, 61, 0.08)",
  wrong: "#B91C1C",
  wrongSoft: "rgba(185, 28, 28, 0.08)",
};

const FONT =
  Platform.OS === "ios" ? "Helvetica Neue" : "sans-serif-medium";

const MOTION_EASING = Easing.bezier(0.16, 1, 0.3, 1);
const SWIPE_EASING = Easing.bezier(0.4, 0, 0.2, 1);

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
      easing: MOTION_EASING,
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
    inputRange: [0, 0.48, 0.52, 1],
    outputRange: [1, 1, 0, 0],
  });
  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 0.48, 0.52, 1],
    outputRange: [0, 0, 1, 1],
  });

  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ["-8deg", "0deg", "8deg"],
    extrapolate: "clamp",
  });

  const correctOverlayOpacity = position.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 0.22],
    extrapolate: "clamp",
  });

  const wrongOverlayOpacity = position.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [0.22, 0],
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
            easing: SWIPE_EASING,
            useNativeDriver: true,
          }).start(() => onSwipeRight());
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          Animated.timing(position, {
            toValue: { x: -SCREEN_WIDTH - 100, y: 0 },
            duration: SWIPE_OUT_DURATION,
            easing: SWIPE_EASING,
            useNativeDriver: true,
          }).start(() => onSwipeLeft());
        } else {
          Animated.timing(position, {
            toValue: { x: 0, y: 0 },
            duration: 280,
            easing: MOTION_EASING,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  const cardTransform = {
    transform: [{ translateX: position.x }, { rotate }],
  };

  return (
    <Animated.View
      style={[styles.swipeCardOuter, cardTransform]}
      {...panResponder.panHandlers}
    >
      <Animated.View
        style={[
          styles.swipeOverlay,
          styles.swipeOverlayCorrect,
          { opacity: correctOverlayOpacity },
        ]}
        pointerEvents="none"
      />
      <Animated.View
        style={[
          styles.swipeOverlay,
          styles.swipeOverlayWrong,
          { opacity: wrongOverlayOpacity },
        ]}
        pointerEvents="none"
      />

      <Pressable style={styles.cardTouchable} onPress={onFlip}>
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
            <Pressable
              style={({ pressed }) => [
                styles.cardActionBtn,
                pressed && styles.cardActionBtnPressed,
              ]}
              onPress={(e) => {
                e.stopPropagation();
                onPlay();
              }}
              disabled={isPlayLoading}
            >
              {isPlayLoading ? (
                <ActivityIndicator size="small" color={COLORS.text} />
              ) : (
                <Ionicons name="volume-medium-outline" size={20} color={COLORS.text} />
              )}
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.cardActionBtn,
                pressed && styles.cardActionBtnPressed,
              ]}
              onPress={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Ionicons name="trash-outline" size={20} color={COLORS.wrong} />
            </Pressable>
          </View>
          <View style={styles.cardTextArea}>
            <Text style={styles.cardTextBack}>{backText}</Text>
          </View>
          <Text style={styles.flipHint}>tap to flip</Text>
        </Animated.View>

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
            <Pressable
              style={({ pressed }) => [
                styles.cardActionBtn,
                pressed && styles.cardActionBtnPressed,
              ]}
              onPress={(e) => {
                e.stopPropagation();
                onPlay();
              }}
              disabled={isPlayLoading}
            >
              {isPlayLoading ? (
                <ActivityIndicator size="small" color={COLORS.text} />
              ) : (
                <Ionicons name="volume-medium-outline" size={20} color={COLORS.text} />
              )}
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.cardActionBtn,
                pressed && styles.cardActionBtnPressed,
              ]}
              onPress={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Ionicons name="trash-outline" size={20} color={COLORS.textMuted} />
            </Pressable>
          </View>
          <View style={styles.cardTextArea}>
            <Text style={styles.cardText}>{frontText}</Text>
          </View>
          <Text style={styles.flipHint}>tap to flip</Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

function ScreenHeader({
  title,
  subtitle,
  paddingTop,
  rightSlot,
  progressPercent,
}: {
  title: string;
  subtitle?: string;
  paddingTop: number;
  rightSlot?: React.ReactNode;
  progressPercent?: number;
}) {
  return (
    <View style={[styles.header, { paddingTop }]}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>{title}</Text>
          {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
        </View>
        {rightSlot}
      </View>
      {progressPercent !== undefined ? (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>
      ) : null}
    </View>
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
    const sub = player.addListener("playbackStatusUpdate", (status: { didJustFinish?: boolean }) => {
      if (status.didJustFinish) setPlayingId(null);
    });
    return () => sub.remove();
  }, [player]);

  const advanceCard = useCallback(
    (direction: "correct" | "wrong") => {
      if (!currentCard) return;
      setResults((prev) => ({ ...prev, [currentCard.id]: direction }));
      setFlippedId(null);
      setCurrentIndex((i) => i + 1);
      setCardKey((k) => k + 1);
    },
    [currentCard],
  );

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
      ],
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
    [results],
  );
  const wrongCount = useMemo(
    () => Object.values(results).filter((r) => r === "wrong").length,
    [results],
  );

  const progressPercent =
    flashcards.length > 0
      ? Math.round((currentIndex / flashcards.length) * 100)
      : 0;

  if (allFlashcards.length === 0) {
    return (
      <View style={styles.container}>
        <ScreenHeader
          title="Flashcards"
          subtitle="Review saved phrases"
          paddingTop={insets.top + 12}
        />
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
        <ScreenHeader title="Flashcards" paddingTop={insets.top + 12} />
        <View style={styles.summaryContainer}>
          <Text style={styles.summaryEmoji}>🎉</Text>
          <Text style={styles.summaryTitle}>Session complete</Text>
          <Text style={styles.summarySubtitle}>
            You reviewed {flashcards.length} card{flashcards.length !== 1 ? "s" : ""}
          </Text>
          <View style={styles.summaryStatsRow}>
            <View style={styles.summaryStat}>
              <View style={[styles.summaryDot, styles.summaryDotCorrect]} />
              <Text style={styles.summaryStatLabel}>Correct</Text>
              <Text style={[styles.summaryStatValue, styles.summaryValueCorrect]}>
                {correctCount}
              </Text>
            </View>
            <View style={styles.summaryStat}>
              <View style={[styles.summaryDot, styles.summaryDotWrong]} />
              <Text style={styles.summaryStatLabel}>Wrong</Text>
              <Text style={[styles.summaryStatValue, styles.summaryValueWrong]}>
                {wrongCount}
              </Text>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.restartBtn,
              pressed && styles.restartBtnPressed,
            ]}
            onPress={handleRestart}
          >
            <Ionicons name="refresh" size={18} color="#FFFFFF" />
            <Text style={styles.restartBtnText}>Study again</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.sessionHeader, { paddingTop: insets.top + 12 }]}>
        <View style={styles.topBar}>
          <Pressable
            style={({ pressed }) => [styles.topBarBtn, pressed && styles.topBarBtnPressed]}
            onPress={handleRestart}
          >
            <Ionicons name="close" size={22} color={COLORS.textMuted} />
          </Pressable>
          <Text style={styles.topBarCounter}>
            {currentIndex + 1} / {flashcards.length}
          </Text>
          <View style={styles.topBarSpacer} />
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>
      </View>

      <View style={styles.mainBody}>
        <View style={styles.swipeLabelsRow}>
          <View style={[styles.swipeLabel, styles.swipeLabelWrong]}>
            <Text style={styles.swipeLabelTextWrong}>Wrong</Text>
          </View>
          <View style={[styles.swipeLabel, styles.swipeLabelCorrect]}>
            <Text style={styles.swipeLabelTextCorrect}>Correct</Text>
          </View>
        </View>

        <View style={styles.cardContainer}>
          {currentCard ? (
            <SwipeCard
              key={`${currentCard.id}-${cardKey}`}
              phrase={currentCard.phrase.phrase}
              translation={currentCard.phrase.translation}
              showTranslationFirst={currentCard.phrase.id.startsWith("translation_")}
              isFlipped={flippedId === currentCard.id}
              onFlip={() =>
                setFlippedId((prev) =>
                  prev === currentCard.id ? null : currentCard.id,
                )
              }
              onPlay={() => setPlayingId(currentCard.id)}
              isPlayLoading={playingId === currentCard.id}
              onSwipeLeft={() => advanceCard("wrong")}
              onSwipeRight={() => advanceCard("correct")}
              onDelete={confirmDeleteCard}
            />
          ) : null}
        </View>

        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable
            style={({ pressed }) => [
              styles.bottomBtn,
              currentIndex === 0 && styles.bottomBtnDisabled,
              pressed && currentIndex > 0 && styles.bottomBtnPressed,
            ]}
            onPress={handleUndo}
            disabled={currentIndex === 0}
          >
            <Ionicons
              name="arrow-undo"
              size={22}
              color={currentIndex === 0 ? COLORS.textSubtle : COLORS.textMuted}
            />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.bottomBtnPrimary,
              pressed && styles.bottomBtnPrimaryPressed,
            ]}
            onPress={() => advanceCard("correct")}
          >
            <Ionicons name="play" size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  headerTitle: {
    fontFamily: FONT,
    fontSize: 28,
    fontWeight: "500",
    color: COLORS.text,
    letterSpacing: -0.8,
  },
  headerSubtitle: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: "400",
    color: COLORS.textMuted,
    letterSpacing: -0.15,
  },

  sessionHeader: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 14,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topBarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarBtnPressed: {
    opacity: 0.7,
  },
  topBarSpacer: {
    width: 40,
    height: 40,
  },
  topBarCounter: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: "500",
    color: COLORS.textMuted,
    letterSpacing: -0.15,
  },
  progressTrack: {
    height: 3,
    backgroundColor: "rgba(0, 0, 0, 0.06)",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.text,
    borderRadius: 999,
  },

  mainBody: {
    flex: 1,
  },
  swipeLabelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginTop: 4,
  },
  swipeLabel: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  swipeLabelWrong: {
    backgroundColor: COLORS.wrongSoft,
    borderColor: "rgba(185, 28, 28, 0.12)",
  },
  swipeLabelCorrect: {
    backgroundColor: COLORS.correctSoft,
    borderColor: "rgba(21, 128, 61, 0.12)",
  },
  swipeLabelTextWrong: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.wrong,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  swipeLabelTextCorrect: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.correct,
    textTransform: "uppercase",
    letterSpacing: 0.6,
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
    backgroundColor: COLORS.correct,
  },
  swipeOverlayWrong: {
    backgroundColor: COLORS.wrong,
  },

  cardTouchable: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    backgroundColor: COLORS.surface,
  },
  flipFaceBack: {
    backgroundColor: COLORS.surfaceMuted,
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
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  cardActionBtnPressed: {
    opacity: 0.85,
  },
  cardTextArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  cardText: {
    fontFamily: FONT,
    fontSize: 28,
    fontWeight: "500",
    color: COLORS.text,
    textAlign: "center",
    lineHeight: 36,
    letterSpacing: -0.7,
  },
  cardTextBack: {
    fontFamily: FONT,
    fontSize: 28,
    fontWeight: "500",
    color: COLORS.text,
    textAlign: "center",
    lineHeight: 36,
    letterSpacing: -0.7,
  },
  flipHint: {
    fontFamily: FONT,
    fontSize: 12,
    color: COLORS.textSubtle,
    textAlign: "center",
    fontWeight: "500",
    letterSpacing: -0.12,
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
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomBtnDisabled: {
    opacity: 0.35,
  },
  bottomBtnPressed: {
    opacity: 0.85,
  },
  bottomBtnPrimary: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.cta,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomBtnPrimaryPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },

  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 48,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyTitle: {
    fontFamily: FONT,
    fontSize: 22,
    fontWeight: "500",
    color: COLORS.text,
    marginBottom: 10,
    textAlign: "center",
    letterSpacing: -0.44,
  },
  emptyText: {
    fontFamily: FONT,
    fontSize: 15,
    color: COLORS.textMuted,
    textAlign: "center",
    lineHeight: 22,
    letterSpacing: -0.15,
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
    fontFamily: FONT,
    fontSize: 28,
    fontWeight: "500",
    color: COLORS.text,
    marginBottom: 8,
    letterSpacing: -0.8,
  },
  summarySubtitle: {
    fontFamily: FONT,
    fontSize: 16,
    color: COLORS.textMuted,
    marginBottom: 32,
    letterSpacing: -0.16,
  },
  summaryStatsRow: {
    flexDirection: "row",
    gap: 40,
    marginBottom: 40,
  },
  summaryStat: {
    alignItems: "center",
    gap: 6,
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  summaryDotCorrect: {
    backgroundColor: COLORS.correct,
  },
  summaryDotWrong: {
    backgroundColor: COLORS.wrong,
  },
  summaryStatLabel: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.textMuted,
  },
  summaryStatValue: {
    fontFamily: FONT,
    fontSize: 32,
    fontWeight: "500",
    letterSpacing: -0.8,
  },
  summaryValueCorrect: {
    color: COLORS.correct,
  },
  summaryValueWrong: {
    color: COLORS.wrong,
  },
  restartBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.cta,
    paddingHorizontal: 24,
    height: 44,
    borderRadius: 999,
  },
  restartBtnPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  restartBtnText: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: "500",
    color: "#FFFFFF",
    letterSpacing: -0.16,
  },
});

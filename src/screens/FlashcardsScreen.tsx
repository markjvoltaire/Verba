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
import {
  useAudioPlayer,
  setAudioModeAsync,
} from "expo-audio";
import { getSpeechStreamUrl } from "../api/tts";
import { useApp } from "../context/AppContext";
import { useSavedPhrases } from "../context/SavedPhrasesContext";
import type { SavedPhrase } from "../context/SavedPhrasesContext";

const TTS_LANG: Record<string, string> = {
  es: "es",
  fr: "fr",
  it: "it",
  en: "en",
};

const FLIP_DURATION = 400;

function FlipCard({
  isFlipped,
  onFlip,
  phrase,
  translation,
  showTranslationFirst,
  onPlay,
  onRemove,
  isLoading,
  cardWidth,
}: {
  isFlipped: boolean;
  onFlip: () => void;
  phrase: string;
  translation: string;
  showTranslationFirst?: boolean;
  onPlay: () => void;
  onRemove: () => void;
  isLoading: boolean;
  cardWidth: number;
}) {
  const frontText = showTranslationFirst ? translation : phrase;
  const backText = showTranslationFirst ? phrase : translation;
  const frontHint = showTranslationFirst ? "Tap to reveal phrase" : "Tap to reveal translation";
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
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1, 0],
  });

  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  const cardActions = (
    <View style={styles.cardActions}>
      <TouchableOpacity
        style={styles.cardActionBtn}
        onPress={(e) => {
          e.stopPropagation();
          onPlay();
        }}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#00877B" />
        ) : (
          <Text style={styles.cardActionIcon}>🔊</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.cardActionBtn}
        onPress={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      >
        <Text style={styles.cardActionIcon}>🗑️</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <TouchableOpacity
      style={[styles.cardWrapper, { width: cardWidth }]}
      onPress={onFlip}
      activeOpacity={1}
    >
      <View style={styles.cardFlipContainer}>
        <Animated.View
          style={[
            styles.cardFace,
            styles.cardBackFace,
            {
              opacity: backOpacity,
              transform: [{ perspective: 1200 }, { rotateY: backRotate }],
            },
          ]}
        >
          <View style={styles.cardInner}>
            <Text style={styles.cardTranslation}>{backText}</Text>
            <Text style={styles.cardHint}>Tap to flip back</Text>
          </View>
          {cardActions}
        </Animated.View>
        <Animated.View
          style={[
            styles.cardFace,
            styles.cardFrontFace,
            {
              opacity: frontOpacity,
              transform: [{ perspective: 1200 }, { rotateY: frontRotate }],
            },
          ]}
        >
          <View style={styles.cardInner}>
            <Text style={styles.cardPhrase}>{frontText}</Text>
            <Text style={styles.cardHint}>{frontHint}</Text>
          </View>
          {cardActions}
        </Animated.View>
      </View>
    </TouchableOpacity>
  );
}

export default function FlashcardsScreen() {
  const { language } = useApp();
  const { getFlashcards, removeFromFlashcards } = useSavedPhrases();
  const flashcards = getFlashcards();
  const [flippedId, setFlippedId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const { width } = useWindowDimensions();

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true });
  }, []);

  const playingCard = playingId
    ? flashcards.find((c) => c.id === playingId)
    : null;
  const playText = playingCard
    ? playingCard.phrase.id.startsWith("translation_")
      ? playingCard.phrase.translation
      : playingCard.phrase.phrase
    : null;
  const ttsUri = playText
    ? getSpeechStreamUrl(playText, "marin", TTS_LANG[language] || language)
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
      if (status.didJustFinish) {
        setPlayingId(null);
      }
    });
    return () => sub.remove();
  }, [player]);

  const handleFlip = (id: string) => {
    setFlippedId((prev) => (prev === id ? null : id));
  };

  const handlePlay = (id: string) => {
    setPlayingId(id);
  };

  const handleRemove = async (id: string) => {
    await removeFromFlashcards(id);
    if (flippedId === id) setFlippedId(null);
  };

  if (flashcards.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Flashcards</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📚</Text>
          <Text style={styles.emptyTitle}>No flashcards yet</Text>
          <Text style={styles.emptyText}>
            Save phrases from the Vocab tab to practice them here.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Flashcards</Text>
      <Text style={styles.subtitle}>
        {flashcards.length} phrase{flashcards.length !== 1 ? "s" : ""} saved
      </Text>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {flashcards.map((card) => (
          <FlipCard
            key={card.id}
            isFlipped={flippedId === card.id}
            onFlip={() => handleFlip(card.id)}
            phrase={card.phrase.phrase}
            translation={card.phrase.translation}
            showTranslationFirst={card.phrase.id.startsWith("translation_")}
            onPlay={() => handlePlay(card.id)}
            onRemove={() => handleRemove(card.id)}
            isLoading={playingId === card.id}
            cardWidth={width - 48}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0f172a",
    paddingHorizontal: 24,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: "#64748b",
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 16,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 48,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 24,
  },
  cardWrapper: {
    marginBottom: 16,
  },
  cardFlipContainer: {
    height: 180,
  },
  cardFace: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#e2e8f0",
    padding: 24,
    justifyContent: "space-between",
  },
  cardBackFace: {
    zIndex: 0,
  },
  cardFrontFace: {
    zIndex: 1,
  },
  cardInner: {
    flex: 1,
  },
  cardPhrase: {
    fontSize: 22,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 8,
  },
  cardTranslation: {
    fontSize: 20,
    fontWeight: "600",
    color: "#00877B",
    marginBottom: 8,
  },
  cardHint: {
    fontSize: 12,
    color: "#94a3b8",
  },
  cardActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  cardActionBtn: {
    padding: 8,
    minWidth: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  cardActionIcon: {
    fontSize: 22,
  },
});

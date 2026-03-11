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
  ScrollView,
  Alert,
} from "react-native";
import {
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioSampleListener,
  setAudioModeAsync,
} from "expo-audio";
import { translate } from "../api/translate";
import { getSpeech, getSpeechStreamUrl } from "../api/tts";
import { getPhrases, Phrase } from "../api/phrases";
import { useApp } from "../context/AppContext";
import { useSavedPhrases } from "../context/SavedPhrasesContext";
import { LanguageSelector } from "../components/LanguageSelector";

const TTS_LANG: Record<string, string> = {
  es: "es",
  fr: "fr",
  it: "it",
  en: "en",
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

function translationPhraseId(input: string, translation: string, lang: string): string {
  const str = `${lang}:${input.trim()}:${translation.trim()}`;
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h = h & h;
  }
  return `translation_${Math.abs(h).toString(36)}`;
}

export default function GlossaryScreen() {
  const { language } = useApp();
  const {
    addToFlashcards,
    removeFromFlashcards,
    isInFlashcards,
    getFlashcardForPhrase,
  } = useSavedPhrases();
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [phrasesLoading, setPhrasesLoading] = useState(true);
  const [inputText, setInputText] = useState("");
  const [translation, setTranslation] = useState("");
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [playingTTS, setPlayingTTS] = useState(false);
  const [playingPhraseId, setPlayingPhraseId] = useState<string | null>(null);
  const [ttsUri, setTtsUri] = useState<string | null>(null);
  const [preloadedTranslationAudio, setPreloadedTranslationAudio] = useState<
    string | null
  >(null);
  const translationForPreloadRef = useRef<string | null>(null);
  const [waveformLevels, setWaveformLevels] = useState<number[]>(() =>
    Array(WAVEFORM_BAR_COUNT).fill(0),
  );
  const waveformLevelsRef = useRef<number[]>(Array(WAVEFORM_BAR_COUNT).fill(0));
  const waveformIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerY = useRef(new Animated.Value(-20)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleY = useRef(new Animated.Value(12)).current;
  const inputOpacity = useRef(new Animated.Value(0)).current;
  const inputY = useRef(new Animated.Value(16)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonY = useRef(new Animated.Value(20)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardY = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.stagger(80, [
      Animated.parallel([
        Animated.timing(headerOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(headerY, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(subtitleOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(subtitleY, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(inputOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(inputY, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(buttonY, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [
    headerOpacity,
    headerY,
    subtitleOpacity,
    subtitleY,
    inputOpacity,
    inputY,
    buttonOpacity,
    buttonY,
  ]);

  const showCard = !!(translation || translateError || translating);
  useEffect(() => {
    if (showCard) {
      cardOpacity.setValue(0);
      cardY.setValue(24);
      Animated.parallel([
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.spring(cardY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
      ]).start();
    }
  }, [showCard]);

  const translationStreamUrl =
    translation && !translateError
      ? getSpeechStreamUrl(translation, "marin", TTS_LANG[language] || language)
      : null;
  const playingPhrase = playingPhraseId
    ? phrases.find((p) => p.id === playingPhraseId)
    : null;
  const phraseStreamUrl = playingPhrase
    ? getSpeechStreamUrl(
        playingPhrase.phrase,
        "marin",
        TTS_LANG[language] || language,
      )
    : null;
  const playSourceUrl =
    ttsUri ||
    (playingPhraseId ? phraseStreamUrl : null) ||
    preloadedTranslationAudio ||
    translationStreamUrl;
  const player = useAudioPlayer(playSourceUrl ? { uri: playSourceUrl } : null);
  const playbackStatus = useAudioPlayerStatus(player);
  const [playbackProgress, setPlaybackProgress] = useState(0);

  useEffect(() => {
    if (!player) return;
    const interval = setInterval(() => {
      const t = (player.currentTime ?? 0) + 0.08;
      const d = player.duration ?? 0;
      const progress = d > 0 ? Math.min(1, t / d) : 0;
      setPlaybackProgress(progress);
    }, 50);
    return () => clearInterval(interval);
  }, [player]);

  useEffect(() => {
    if (!playSourceUrl || !player) return;
    const sub = player.addListener("playbackStatusUpdate", (status) => {
      if (status.didJustFinish) {
        setPlayingTTS(false);
        setPlayingPhraseId(null);
        setTtsUri(null);
        setPlaybackProgress(1);
      }
    });
    return () => sub.remove();
  }, [playSourceUrl, player]);

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
      setPreloadedTranslationAudio(null);
      translationForPreloadRef.current = null;
      return;
    }
    translationForPreloadRef.current = translation;
    setPreloadedTranslationAudio(null);
    getSpeech(translation, "marin", TTS_LANG[language] || language)
      .then((res) => {
        if (translationForPreloadRef.current !== translation) return;
        const dataUrl = `data:audio/mpeg;base64,${res.audio}`;
        setPreloadedTranslationAudio(dataUrl);
      })
      .catch(() => {});
  }, [translation, translateError, language]);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true });
  }, []);

  useEffect(() => {
    setPhrasesLoading(true);
    getPhrases(language, undefined, 100)
      .then(setPhrases)
      .catch(() => setPhrases([]))
      .finally(() => setPhrasesLoading(false));
  }, [language]);

  useEffect(() => {
    if (playingTTS && player) {
      player.seekTo(0).then(() => player.play());
    }
  }, [playingTTS, player]);

  const pendingTranslateRef = useRef<string | null>(null);

  const handleTranslate = () => {
    const text = inputText.trim();
    if (!text || translating) return;
    pendingTranslateRef.current = text;
    setTranslating(true);
    setTranslateError(null);
    setTranslation("");
    translate(text, language)
      .then((res) => {
        if (pendingTranslateRef.current === text)
          setTranslation(res.translation);
      })
      .catch((err) => {
        if (pendingTranslateRef.current === text) {
          setTranslateError(
            err instanceof Error ? err.message : "Translation failed",
          );
        }
      })
      .finally(() => {
        if (pendingTranslateRef.current === text)
          pendingTranslateRef.current = null;
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

  const handlePlayTranslation = () => {
    if (!translation || translateError || playingTTS) return;
    setPlayingPhraseId(null);
    setPlayingTTS(true);
  };

  const handlePlayPhrase = (phrase: Phrase) => {
    if (playingTTS) return;
    setTtsUri(null);
    setPlayingPhraseId(phrase.id);
    setPlayingTTS(true);
  };

  const handleFlashcardToggle = async (phrase: Phrase) => {
    const flashcard = getFlashcardForPhrase(phrase.id);
    if (flashcard) {
      await removeFromFlashcards(flashcard.id);
    } else {
      await addToFlashcards(phrase);
      Alert.alert(
        "Added to flashcards",
        "You can practice this phrase in the Flashcards tab.",
      );
    }
  };

  const handleTranslationFlashcardToggle = async () => {
    const phraseText = inputText.trim();
    if (!phraseText || !translation || translateError) return;
    const phrase: Phrase = {
      id: translationPhraseId(phraseText, translation, language),
      target_lang: language,
      phrase: phraseText,
      translation,
    };
    const flashcard = getFlashcardForPhrase(phrase.id);
    if (flashcard) {
      await removeFromFlashcards(flashcard.id);
    } else {
      await addToFlashcards(phrase);
      Alert.alert(
        "Added to flashcards",
        "You can practice this phrase in the Flashcards tab.",
      );
    }
  };

  const renderPhraseItem = (phrase: Phrase) => {
    const saved = isInFlashcards(phrase.id);
    return (
      <View style={styles.phraseCard}>
        <View style={styles.phraseContent}>
          <Text style={styles.phraseText}>{phrase.phrase}</Text>
          <Text style={styles.phraseTranslation}>{phrase.translation}</Text>
        </View>
        <View style={styles.phraseActions}>
          <TouchableOpacity
            style={styles.phraseActionBtn}
            onPress={() => handlePlayPhrase(phrase)}
            disabled={playingTTS}
            hitSlop={8}
          >
            <Text style={styles.phraseActionIcon}>🔊</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.phraseActionBtn}
            onPress={() => handleFlashcardToggle(phrase)}
            hitSlop={8}
          >
            <Text style={styles.phraseActionIcon}>{saved ? "📕" : "📖"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerSection}>
        <Animated.View
          style={[
            styles.header,
            {
              opacity: headerOpacity,
              transform: [{ translateY: headerY }],
            },
          ]}
        >
          <Text style={styles.title}>Vocab</Text>
          <LanguageSelector />
        </Animated.View>
        <Animated.Text
          style={[
            styles.subtitle,
            {
              opacity: subtitleOpacity,
              transform: [{ translateY: subtitleY }],
            },
          ]}
        >
          Type a word or phrase, then tap Translate
        </Animated.Text>

        <Animated.View
          style={{
            opacity: inputOpacity,
            transform: [{ translateY: inputY }],
          }}
        >
          <TextInput
            style={styles.input}
            placeholder="Type a word or phrase..."
            placeholderTextColor="#94a3b8"
            value={inputText}
            onChangeText={handleInputChange}
            onSubmitEditing={handleTranslate}
            returnKeyType="go"
            returnKeyLabel={Platform.OS === "android" ? "Translate" : undefined}
            autoCapitalize="none"
            autoCorrect={true}
            multiline
            textAlignVertical="top"
          />
        </Animated.View>

        {(translation || translateError || translating) && (
          <Animated.View
            style={[
              styles.translationCard,
              {
                opacity: cardOpacity,
                transform: [{ translateY: cardY }],
              },
            ]}
          >
            {translating ? (
              <ActivityIndicator size="small" color="#00877B" />
            ) : (
              <>
                <Text style={styles.translationLabel}>Translation</Text>
                <View style={styles.translationRow}>
                  {translateError ? (
                    <Text style={styles.translationText}>{translateError}</Text>
                  ) : translation ? (
                    <View style={styles.translationWords}>
                      {(translation || "")
                        .match(/\S+/g)
                        ?.map((word, i, arr) => {
                          const n = arr.length;
                          const isSaid = playbackProgress * n > i;
                          return (
                            <Text
                              key={i}
                              style={[
                                styles.translationWord,
                                isSaid ? styles.wordSaid : styles.wordUnsaid,
                              ]}
                            >
                              {word}
                              {i < n - 1 ? " " : ""}
                            </Text>
                          );
                        }) ?? (
                        <Text style={styles.translationText}>
                          {translation}
                        </Text>
                      )}
                    </View>
                  ) : (
                    <Text style={styles.translationText}>—</Text>
                  )}
                  {!translateError && translation ? (
                    <View style={styles.translationActions}>
                      <TouchableOpacity
                        style={[styles.speakButton, { flexShrink: 0 }]}
                        onPress={handlePlayTranslation}
                        disabled={playingTTS}
                        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                        activeOpacity={0.6}
                        accessible
                        accessibilityLabel="Play pronunciation"
                        accessibilityRole="button"
                      >
                        {playingTTS ? (
                          <View style={styles.waveform}>
                            {waveformLevels.map((level, i) => (
                              <View
                                key={i}
                                style={[
                                  styles.waveformBar,
                                  {
                                    height: 4 + level * 16,
                                  },
                                ]}
                              />
                            ))}
                          </View>
                        ) : (
                          <Text style={styles.speakIcon}>🔊</Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.phraseActionBtn}
                        onPress={handleTranslationFlashcardToggle}
                        hitSlop={8}
                        accessible
                        accessibilityLabel={
                          isInFlashcards(
                            translationPhraseId(inputText.trim(), translation, language)
                          )
                            ? "Remove from flashcards"
                            : "Add to flashcards"
                        }
                        accessibilityRole="button"
                      >
                        <Text style={styles.phraseActionIcon}>
                          {isInFlashcards(
                            translationPhraseId(inputText.trim(), translation, language)
                          )
                            ? "📕"
                            : "📖"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
                {translateError && (
                  <Text style={styles.translationHint}>
                    Is the backend running? Check EXPO_PUBLIC_API_URL in .env
                  </Text>
                )}
              </>
            )}
          </Animated.View>
        )}

        <Animated.View
          style={{
            opacity: buttonOpacity,
            transform: [{ translateY: buttonY }],
          }}
        >
          <TouchableOpacity
            style={[
              styles.translateButton,
              (!inputText.trim() || translating) &&
                styles.translateButtonDisabled,
            ]}
            onPress={handleTranslate}
            disabled={!inputText.trim() || translating}
          >
            {translating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.translateButtonText}>Translate</Text>
            )}
          </TouchableOpacity>
        </Animated.View>

        <Text style={styles.phrasesSectionLabel}>Top phrases</Text>
      </View>

      <ScrollView
        style={styles.phrasesScroll}
        contentContainerStyle={styles.phrasesScrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {phrasesLoading ? (
          <ActivityIndicator
            size="small"
            color="#00877B"
            style={styles.phrasesLoader}
          />
        ) : phrases.length === 0 ? (
          <Text style={styles.phrasesEmpty}>
            No phrases for this language yet
          </Text>
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
    backgroundColor: "#f8fafc",
  },
  headerSection: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: "#f8fafc",
  },
  phrasesScroll: {
    flex: 1,
  },
  phrasesScrollContent: {
    paddingHorizontal: 24,

    paddingBottom: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 16,
    color: "#64748b",
    marginBottom: 20,
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    paddingTop: 16,
    paddingBottom: 16,
    fontSize: 18,
    color: "#0f172a",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 12,
    minHeight: 56,
    maxHeight: 200,
  },
  translateButton: {
    backgroundColor: "#00877B",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  translateButtonDisabled: {
    backgroundColor: "#94a3b8",
    opacity: 0.8,
  },
  translateButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  translationCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    minHeight: 60,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  translationLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 4,
  },
  translationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  translationActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  translationText: {
    flex: 1,
    fontSize: 20,
    fontWeight: "600",
    color: "#0f172a",
  },
  translationWords: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  translationWord: {
    fontSize: 20,
    fontWeight: "600",
  },
  wordSaid: {
    color: "#0f172a",
  },
  wordUnsaid: {
    color: "#94a3b8",
  },
  speakButton: {
    padding: 12,
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  speakIcon: {
    fontSize: 24,
  },
  waveform: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 24,
    gap: 3,
  },
  waveformBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: "#00877B",
    minHeight: 4,
    maxHeight: 20,
  },
  translationHint: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 8,
  },
  phrasesSectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
    marginTop: 12,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  phrasesLoader: {
    marginVertical: 24,
  },
  phrasesEmpty: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
    marginVertical: 24,
  },
  phraseList: {
    marginBottom: 24,
  },
  phraseCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  phraseContent: {
    flex: 1,
  },
  phraseText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 4,
  },
  phraseTranslation: {
    fontSize: 14,
    color: "#64748b",
  },
  phraseActions: {
    flexDirection: "row",
    gap: 8,
  },
  phraseActionBtn: {
    padding: 8,
  },
  phraseActionIcon: {
    fontSize: 20,
  },
});

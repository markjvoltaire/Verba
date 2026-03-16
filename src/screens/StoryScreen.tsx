import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import { setAudioModeAsync } from 'expo-audio';
import { getSpeechStreamUrl } from '../api/tts';
import { useApp } from '../context/AppContext';
import type { Story } from '../constants/stories';

const TTS_LANG: Record<string, string> = {
  es: 'es',
  fr: 'fr',
  it: 'it',
  en: 'en',
};

export default function StoryScreen({
  navigation,
  route,
}: {
  navigation: { goBack: () => void };
  route: { params?: { story: Story } };
}) {
  const { language } = useApp();
  const story = route.params?.story;
  const { height } = useWindowDimensions();

  if (!story) {
    return (
      <View style={[styles.container, { padding: 20, paddingTop: 52 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.storyTitle, { marginTop: 24 }]}>No story selected</Text>
      </View>
    );
  }

  const [chunkIndex, setChunkIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const currentChunk = story.paragraphs[chunkIndex] ?? '';
  const ttsUri = currentChunk
    ? getSpeechStreamUrl(currentChunk, 'marin', TTS_LANG[language] || language)
    : null;

  const player = useAudioPlayer(ttsUri ? { uri: ttsUri } : null);

  useEffect(() => {
    setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      shouldRouteThroughEarpiece: false,
    });
  }, []);

  useEffect(() => {
    if (ttsUri && player && isPlaying) {
      player.play();
    }
  }, [ttsUri, isPlaying, player]);

  useEffect(() => {
    if (!player || !ttsUri) return;
    const sub = player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) {
        if (chunkIndex < story.paragraphs.length - 1) {
          setChunkIndex((i) => i + 1);
        } else {
          setIsPlaying(false);
        }
      }
    });
    return () => sub.remove();
  }, [player, ttsUri, chunkIndex, story.paragraphs.length]);

  useEffect(() => {
    const approxChunkHeight = 60;
    const offset = Math.max(0, chunkIndex * approxChunkHeight - height * 0.25);
    scrollRef.current?.scrollTo({ y: offset, animated: true });
  }, [chunkIndex, height]);

  const handlePlayPause = useCallback(async () => {
    if (!hasStarted) {
      setHasStarted(true);
      setChunkIndex(0);
    }
    if (isPlaying && player) {
      player.pause();
      setIsPlaying(false);
    } else {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldRouteThroughEarpiece: false,
      });
      setIsPlaying(true);
    }
  }, [hasStarted, isPlaying, player]);

  const handleRestart = useCallback(() => {
    setChunkIndex(0);
    setHasStarted(true);
    setIsPlaying(true);
  }, []);

  const handlePrev = useCallback(() => {
    if (chunkIndex > 0) {
      setChunkIndex((i) => i - 1);
      setIsPlaying(true);
    }
  }, [chunkIndex]);

  const handleNext = useCallback(() => {
    if (chunkIndex < story.paragraphs.length - 1) {
      setChunkIndex((i) => i + 1);
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  }, [chunkIndex, story.paragraphs.length]);

  const isFirst = chunkIndex === 0;
  const isLast = chunkIndex === story.paragraphs.length - 1;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.storyTitle} numberOfLines={1}>
          {story.title}
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {story.paragraphs.map((chunk, i) => (
          <View
            key={i}
            style={[
              styles.chunkWrap,
              i === chunkIndex && styles.chunkActive,
            ]}
          >
            <Text
              style={[
                styles.chunkText,
                i < chunkIndex && styles.chunkRead,
                i === chunkIndex && styles.chunkCurrent,
                i > chunkIndex && styles.chunkUpcoming,
              ]}
            >
              {chunk}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.controls}>
        <View style={styles.progressRow}>
          <Text style={styles.progressText}>
            {chunkIndex + 1} / {story.paragraphs.length}
          </Text>
        </View>
        <View style={styles.buttonsRow}>
          <TouchableOpacity
            style={[styles.controlBtn, isFirst && styles.controlBtnDisabled]}
            onPress={handlePrev}
            disabled={isFirst}
          >
            <Text style={styles.controlBtnText}>⏮</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.playButton}
            onPress={handlePlayPause}
          >
            <Text style={styles.playButtonText}>
              {isPlaying ? '⏸' : '▶'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.controlBtn, isLast && styles.controlBtnDisabled]}
            onPress={handleNext}
            disabled={isLast}
          >
            <Text style={styles.controlBtnText}>⏭</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.restartBtn} onPress={handleRestart}>
          <Text style={styles.restartBtnText}>Restart from beginning</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 16,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(28, 25, 23, 0.08)',
  },
  backText: {
    fontSize: 16,
    color: '#29B6F6',
    fontWeight: '600',
  },
  storyTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1917',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 180,
  },
  chunkWrap: {
    marginBottom: 20,
  },
  chunkActive: {},
  chunkText: {
    fontSize: 22,
    lineHeight: 34,
    color: '#57534E',
  },
  chunkRead: {
    color: '#A8A29E',
  },
  chunkCurrent: {
    color: '#1C1917',
    fontWeight: '700',
  },
  chunkUpcoming: {
    color: '#D6D3D1',
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    paddingBottom: 40,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: 'rgba(28, 25, 23, 0.08)',
  },
  progressRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  progressText: {
    fontSize: 14,
    color: '#57534E',
    fontWeight: '500',
  },
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  controlBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(41, 182, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlBtnDisabled: {
    opacity: 0.4,
  },
  controlBtnText: {
    fontSize: 20,
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: '#29B6F6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#29B6F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  playButtonText: {
    fontSize: 28,
    color: '#fff',
  },
  restartBtn: {
    marginTop: 16,
    alignItems: 'center',
  },
  restartBtnText: {
    fontSize: 14,
    color: '#29B6F6',
    fontWeight: '600',
  },
});

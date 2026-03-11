import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WaveLogo from '../components/WaveLogo';
import {
  useAudioRecorder,
  useAudioPlayer,
  RecordingPresets,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { getOpeningMessage, sendMessage, ConversationMessage } from '../api/conversation';
import { getSpeechStreamUrl } from '../api/tts';
import { useApp } from '../context/AppContext';
import { useStreak } from '../context/StreakContext';
import { useUsage } from '../context/UsageContext';

const SCENARIOS = [
  { id: 'restaurant', label: 'Restaurant' },
  { id: 'airport', label: 'Airport' },
  { id: 'hotel', label: 'Hotel' },
  { id: 'small_talk', label: 'Small talk' },
];

export default function ScenarioScreen({ navigation }: { navigation: any }) {
  const insets = useSafeAreaInsets();
  const { language } = useApp();
  const [scenario, setScenario] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recordStartRef = useRef<number | null>(null);
  const { recordPracticeDate } = useStreak();
  const { canPractice, recordUsage } = useUsage();
  const scrollRef = useRef<ScrollView>(null);
  const [playingMsgIndex, setPlayingMsgIndex] = useState<number | null>(null);
  const [ttsUri, setTtsUri] = useState<string | null>(null);
  const player = useAudioPlayer(ttsUri ? { uri: ttsUri } : null);

  const TTS_LANG: Record<string, string> = { es: 'es', fr: 'fr', it: 'it', en: 'en' };

  useEffect(() => {
    if (ttsUri && player) {
      player.play();
    }
  }, [ttsUri]);

  useEffect(() => {
    if (!player || !ttsUri) return;
    const sub = player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) {
        setTtsUri(null);
        setPlayingMsgIndex(null);
      }
    });
    return () => sub.remove();
  }, [player, ttsUri]);

  const handlePlayMessage = async (content: string, index: number) => {
    if (!content.trim() || playingMsgIndex !== null) return;
    setPlayingMsgIndex(index);
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      shouldRouteThroughEarpiece: false,
    });
    const uri = getSpeechStreamUrl(content, 'marin', TTS_LANG[language] || language);
    setTtsUri(uri);
    setTimeout(() => {
      setTtsUri(null);
      setPlayingMsgIndex(null);
    }, 30000);
  };

  useEffect(() => {
    (async () => {
      await requestRecordingPermissionsAsync();
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldRouteThroughEarpiece: false,
      });
    })();
  }, []);

  const loadOpening = async (scenarioId: string) => {
    setIsLoading(true);
    try {
      const { aiMessage } = await getOpeningMessage(scenarioId, language);
      setMessages([{ role: 'assistant', content: aiMessage }]);
      setScenario(scenarioId);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Could not load scenario. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendText = async () => {
    if (!scenario || !inputText.trim() || isLoading) return;
    const userMsg: ConversationMessage = { role: 'user', content: inputText.trim() };
    setMessages((m) => [...m, userMsg]);
    setInputText('');
    setIsLoading(true);
    try {
      const { aiMessage } = await sendMessage(scenario, [...messages, userMsg], undefined, language);
      setMessages((m) => [...m, { role: 'assistant', content: aiMessage }]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      console.error(err);
      setMessages((m) => m.slice(0, -1));
      Alert.alert('Error', 'Could not get response. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = async () => {
    if (!canPractice) {
      Alert.alert(
        'Daily limit reached',
        'You have used your 3 minutes of free practice today. Upgrade to Pro for unlimited practice!',
        [{ text: 'OK' }]
      );
      return;
    }
    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldRouteThroughEarpiece: false,
      });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      recordStartRef.current = Date.now();
      setIsRecording(true);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Could not start recording.');
    }
  };

  const stopRecordingAndSend = async () => {
    if (!audioRecorder.isRecording || !scenario || isLoading) return;
    setIsRecording(false);
    setIsLoading(true);
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (!uri) throw new Error('No recording URI');
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });
      const newMessages = [...messages];
      const { aiMessage, transcription } = await sendMessage(scenario, messages, base64, language);
      if (transcription) {
        newMessages.push({ role: 'user', content: transcription });
      }
      newMessages.push({ role: 'assistant', content: aiMessage });
      setMessages(newMessages);
      if (recordStartRef.current) {
        const seconds = Math.ceil((Date.now() - recordStartRef.current) / 1000);
        await recordUsage(seconds);
        await recordPracticeDate();
        recordStartRef.current = null;
      }
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Could not process voice. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!scenario) {
    return (
      <View style={[styles.container, { padding: 24, paddingTop: 60 + insets.top }]}>
        <TouchableOpacity
          style={[styles.backButton, { top: insets.top }]}
          onPress={() => navigation.goBack()}
          hitSlop={12}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Choose a scenario</Text>
        <Text style={styles.subtitle}>Practice conversations in real-life situations</Text>
        {SCENARIOS.map((s) => (
          <TouchableOpacity
            key={s.id}
            style={styles.scenarioOption}
            onPress={() => loadOpening(s.id)}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#00877B" />
            ) : (
              <Text style={styles.scenarioOptionText}>{s.label}</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  const scenarioLabel = SCENARIOS.find((s) => s.id === scenario)?.label || scenario;

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { top: insets.top }]} pointerEvents="box-none">
        <Text style={styles.topBarText}>{scenarioLabel}</Text>
      </View>

      <TouchableOpacity
        style={[styles.backButton, { top: insets.top }]}
        onPress={() => {
          setScenario(null);
          setMessages([]);
        }}
        hitSlop={12}
        activeOpacity={0.7}
      >
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      <ScrollView
        ref={scrollRef}
        style={styles.messagesScroll}
        contentContainerStyle={[styles.messagesContent, { paddingTop: 100, paddingBottom: 140 }]}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        <View style={styles.logoSection}>
          <WaveLogo fill="#00877B" animated={false} size={140} />
        </View>
        {messages.map((msg, i) => (
          <View
            key={i}
            style={[styles.messageBubble, msg.role === 'user' ? styles.userBubble : styles.aiBubble]}
          >
            <View style={styles.messageRow}>
              <Text style={styles.messageText}>{msg.content}</Text>
              {msg.role === 'assistant' && (
                <TouchableOpacity
                  style={styles.speakMsgButton}
                  onPress={() => handlePlayMessage(msg.content, i)}
                  disabled={playingMsgIndex !== null}
                >
                  <Text style={styles.speakMsgIcon}>
                    {playingMsgIndex === i ? '⏳' : '🔊'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
        {isLoading && (
          <View style={[styles.messageBubble, styles.aiBubble]}>
            <ActivityIndicator size="small" color="#00877B" />
          </View>
        )}
      </ScrollView>

      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Type your response..."
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSendText}
          editable={!isLoading}
          returnKeyType="send"
        />
        {isRecording ? (
          <TouchableOpacity style={styles.recordButton} onPress={stopRecordingAndSend}>
            <Text style={styles.recordButtonText}>⏹</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.micButton}
            onPress={startRecording}
            disabled={isLoading}
          >
            <Text style={styles.micButtonText}>🎤</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || isLoading) && styles.sendButtonDisabled]}
          onPress={handleSendText}
          disabled={!inputText.trim() || isLoading}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  backButton: {
    position: 'absolute',
    left: 20,
    zIndex: 10,
  },
  backButtonText: {
    fontSize: 16,
    color: '#00877B',
    fontWeight: '600',
  },
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 36,
    zIndex: 1,
  },
  topBarText: {
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '600',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 32,
  },
  scenarioOption: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  scenarioOptionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 24,
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#00877B',
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  messageText: {
    flex: 1,
    fontSize: 16,
    color: '#0f172a',
  },
  speakMsgButton: {
    padding: 4,
  },
  speakMsgIcon: {
    fontSize: 18,
  },
  bottomSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    zIndex: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sendButton: {
    backgroundColor: '#00877B',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  micButton: {
    backgroundColor: '#e2e8f0',
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonText: {
    fontSize: 20,
  },
  recordButton: {
    backgroundColor: '#ef4444',
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButtonText: {
    fontSize: 20,
  },
});

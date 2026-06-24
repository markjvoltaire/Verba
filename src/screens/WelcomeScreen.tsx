import React, { useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Animated,
  Easing,
  Dimensions,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { useApp } from "../context/AppContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const MOSAIC_HEIGHT = Math.min(SCREEN_HEIGHT * 0.46, 360);
const TILE_GAP = 3;
const TILE_SIZE = (SCREEN_WIDTH - 28 - TILE_GAP) / 2;
const ROW_HEIGHT = (MOSAIC_HEIGHT - TILE_GAP) / 2;
const HEADLINE_SIZE = Math.min(SCREEN_WIDTH * 0.095, 44);

const GREETINGS = ["Hello", "Hola", "Bonjour", "Ciao", "Hallo", "こんにちは"];
const GREETING_INTERVAL_MS = 2400;
const WORD_TRANSITION_MS = 420;
const FLAG_TRANSITION_MS = 420;
const START_DELAY_MS = 280;

const FLAG_POOL = [
  { flag: "🇪🇸", bg: "#FFF0ED" },
  { flag: "🇫🇷", bg: "#EEF4FF" },
  { flag: "🇮🇹", bg: "#F0FFF4" },
  { flag: "🇺🇸", bg: "#F5F0FF" },
  { flag: "🇩🇪", bg: "#F5F5F4" },
  { flag: "🇯🇵", bg: "#FFF5F5" },
  { flag: "🇧🇷", bg: "#F0FFF4" },
  { flag: "🇰🇷", bg: "#EEF2FF" },
  { flag: "🇲🇽", bg: "#FFFBEB" },
  { flag: "🇨🇳", bg: "#FEF2F2" },
] as const;

const COLORS = {
  bg: "#FAFAFA",
  bgBottom: "#F5F5F4",
  text: "#0A0A0A",
  textMuted: "rgba(0, 0, 0, 0.48)",
  tileBorder: "#F0F0F0",
  cta: "#0B0B0B",
};

const FONT =
  Platform.OS === "ios" ? "Helvetica Neue" : "sans-serif-medium";

const WORD_EASING = Easing.bezier(0.4, 0, 0.2, 1);
const ENTRANCE_EASING = Easing.bezier(0.16, 1, 0.3, 1);

function LanguageTile({
  flag,
  bg,
  tileIndex,
  entranceDelay,
}: {
  flag: string;
  bg: string;
  tileIndex: number;
  entranceDelay: number;
}) {
  const [displayFlag, setDisplayFlag] = useState(flag);
  const [displayBg, setDisplayBg] = useState(bg);
  const tileOpacity = useRef(new Animated.Value(0)).current;
  const tileScale = useRef(new Animated.Value(1.06)).current;
  const flagOpacity = useRef(new Animated.Value(1)).current;
  const flagScale = useRef(new Animated.Value(1)).current;
  const isFirstRender = useRef(true);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(tileOpacity, {
        toValue: 1,
        duration: 850,
        delay: entranceDelay,
        easing: ENTRANCE_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(tileScale, {
        toValue: 1,
        duration: 850,
        delay: entranceDelay,
        easing: ENTRANCE_EASING,
        useNativeDriver: true,
      }),
    ]).start();
  }, [tileOpacity, tileScale, entranceDelay]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (displayFlag === flag) return;

    Animated.parallel([
      Animated.timing(flagOpacity, {
        toValue: 0,
        duration: FLAG_TRANSITION_MS,
        delay: tileIndex * 60,
        easing: WORD_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(flagScale, {
        toValue: 0.88,
        duration: FLAG_TRANSITION_MS,
        delay: tileIndex * 60,
        easing: WORD_EASING,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setDisplayFlag(flag);
      setDisplayBg(bg);
      flagScale.setValue(1.08);
      Animated.parallel([
        Animated.timing(flagOpacity, {
          toValue: 1,
          duration: FLAG_TRANSITION_MS,
          easing: WORD_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(flagScale, {
          toValue: 1,
          duration: FLAG_TRANSITION_MS,
          easing: WORD_EASING,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [flag, bg, displayFlag, flagOpacity, flagScale, tileIndex]);

  return (
    <Animated.View
      style={[
        styles.tile,
        {
          backgroundColor: displayBg,
          opacity: tileOpacity,
          transform: [{ scale: tileScale }],
        },
      ]}
    >
      <Animated.Text
        style={[
          styles.tileFlag,
          { opacity: flagOpacity, transform: [{ scale: flagScale }] },
        ]}
      >
        {displayFlag}
      </Animated.Text>
    </Animated.View>
  );
}

export default function WelcomeScreen() {
  const navigation = useNavigation();
  const { userChecked } = useApp();
  const insets = useSafeAreaInsets();

  const handleGetStarted = () => {
    (navigation as any).navigate("Onboarding");
  };

  const [greetingIndex, setGreetingIndex] = useState(0);
  const [slotWord, setSlotWord] = useState(GREETINGS[0]);
  const [animateWords, setAnimateWords] = useState(false);
  const [flagCycle, setFlagCycle] = useState(0);

  const wordTranslateY = useRef(new Animated.Value(0)).current;
  const wordOpacity = useRef(new Animated.Value(1)).current;
  const copyOpacity = useRef(new Animated.Value(0)).current;
  const copyTranslateY = useRef(new Animated.Value(12)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;
  const ctaTranslateY = useRef(new Animated.Value(12)).current;
  const ctaScale = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    const startTimer = setTimeout(() => setAnimateWords(true), START_DELAY_MS);
    return () => clearTimeout(startTimer);
  }, []);

  useEffect(() => {
    if (!animateWords) return;

    const interval = setInterval(() => {
      Animated.parallel([
        Animated.timing(wordTranslateY, {
          toValue: -28,
          duration: WORD_TRANSITION_MS,
          easing: WORD_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(wordOpacity, {
          toValue: 0,
          duration: WORD_TRANSITION_MS,
          easing: WORD_EASING,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setGreetingIndex((i) => {
          const next = (i + 1) % GREETINGS.length;
          setSlotWord(GREETINGS[next]);
          return next;
        });
        setFlagCycle((c) => c + 1);
        wordTranslateY.setValue(28);
        Animated.parallel([
          Animated.timing(wordTranslateY, {
            toValue: 0,
            duration: WORD_TRANSITION_MS,
            easing: WORD_EASING,
            useNativeDriver: true,
          }),
          Animated.timing(wordOpacity, {
            toValue: 1,
            duration: WORD_TRANSITION_MS,
            easing: WORD_EASING,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }, GREETING_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [animateWords, wordTranslateY, wordOpacity]);

  const tileFlags = [0, 1, 2, 3].map(
    (i) => FLAG_POOL[(flagCycle + i) % FLAG_POOL.length],
  );

  useEffect(() => {
    Animated.parallel([
      Animated.timing(copyOpacity, {
        toValue: 1,
        duration: 700,
        delay: START_DELAY_MS,
        easing: ENTRANCE_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(copyTranslateY, {
        toValue: 0,
        duration: 700,
        delay: START_DELAY_MS,
        easing: ENTRANCE_EASING,
        useNativeDriver: true,
      }),
    ]).start();
  }, [copyOpacity, copyTranslateY]);

  useEffect(() => {
    if (!userChecked) return;
    Animated.parallel([
      Animated.timing(ctaOpacity, {
        toValue: 1,
        duration: 900,
        delay: 650,
        easing: ENTRANCE_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(ctaTranslateY, {
        toValue: 0,
        duration: 900,
        delay: 650,
        easing: ENTRANCE_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(ctaScale, {
        toValue: 1,
        duration: 900,
        delay: 650,
        easing: ENTRANCE_EASING,
        useNativeDriver: true,
      }),
    ]).start();
  }, [userChecked, ctaOpacity, ctaTranslateY, ctaScale]);

  const headlineLabel = `say ${GREETINGS[greetingIndex]} with Verba`;

  return (
    <View style={styles.container}>
      <View style={[styles.mosaic, { paddingTop: insets.top + 14 }]}>
        <View style={styles.mosaicRow}>
          {tileFlags.slice(0, 2).map((tile, index) => (
            <LanguageTile
              key={index}
              tileIndex={index}
              flag={tile.flag}
              bg={tile.bg}
              entranceDelay={index * 80}
            />
          ))}
        </View>
        <View style={styles.mosaicRow}>
          {tileFlags.slice(2).map((tile, index) => (
            <LanguageTile
              key={index + 2}
              tileIndex={index + 2}
              flag={tile.flag}
              bg={tile.bg}
              entranceDelay={(index + 2) * 80}
            />
          ))}
        </View>
      </View>

      <LinearGradient
        colors={["rgba(250,250,250,0)", COLORS.bg, COLORS.bgBottom]}
        locations={[0, 0.18, 1]}
        style={styles.copyGradient}
        pointerEvents="none"
      />

      <Animated.View
        style={[
          styles.copy,
          {
            opacity: copyOpacity,
            transform: [{ translateY: copyTranslateY }],
            paddingBottom: insets.bottom + 32,
          },
        ]}
      >
        <View style={styles.landingCopy} accessibilityLabel={headlineLabel}>
          <View style={styles.headline}>
            <Text style={styles.headlinePrefix}>say</Text>

            <View style={styles.wordSlot} accessibilityElementsHidden>
              <Text style={styles.wordMeasure}>{slotWord}</Text>
              <Animated.Text
                style={[
                  styles.headlineWord,
                  {
                    opacity: wordOpacity,
                    transform: [{ translateY: wordTranslateY }],
                  },
                ]}
              >
                {GREETINGS[greetingIndex]}
              </Animated.Text>
            </View>

            <Text style={styles.headlineTail}>with Verba</Text>
          </View>

          <Text style={styles.subtext}>
            your ai language tutor for real conversation
          </Text>
        </View>

        {userChecked && (
          <Animated.View
            style={{
              opacity: ctaOpacity,
              transform: [
                { translateY: ctaTranslateY },
                { scale: ctaScale },
              ],
            }}
          >
            <Pressable
              style={({ pressed }) => [
                styles.cta,
                pressed && styles.ctaPressed,
              ]}
              onPress={handleGetStarted}
            >
              <Text style={styles.ctaText}>Get Started</Text>
            </Pressable>
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  mosaic: {
    paddingHorizontal: 14,
    gap: TILE_GAP,
  },
  mosaicRow: {
    flexDirection: "row",
    gap: TILE_GAP,
  },
  tile: {
    width: TILE_SIZE,
    height: ROW_HEIGHT,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  tileFlag: {
    fontSize: 44,
  },
  copyGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    top: MOSAIC_HEIGHT - 20,
    height: MOSAIC_HEIGHT * 0.45,
  },
  copy: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    marginTop: -20,
    gap: 16,
  },
  landingCopy: {
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
    gap: 16,
  },
  headline: {
    alignItems: "center",
    gap: 2,
  },
  headlinePrefix: {
    fontFamily: FONT,
    fontSize: HEADLINE_SIZE,
    fontWeight: "400",
    color: COLORS.text,
    letterSpacing: -1.5,
    lineHeight: HEADLINE_SIZE * 1.04,
  },
  wordSlot: {
    overflow: "hidden",
    height: HEADLINE_SIZE * 1.08,
    alignItems: "center",
    justifyContent: "center",
  },
  wordMeasure: {
    position: "absolute",
    opacity: 0,
    fontFamily: FONT,
    fontSize: HEADLINE_SIZE,
    fontWeight: "400",
    letterSpacing: -1.5,
  },
  headlineWord: {
    fontFamily: FONT,
    fontSize: HEADLINE_SIZE,
    fontWeight: "400",
    color: COLORS.text,
    letterSpacing: -1.5,
    lineHeight: HEADLINE_SIZE * 1.04,
  },
  headlineTail: {
    fontFamily: FONT,
    fontSize: HEADLINE_SIZE,
    fontWeight: "400",
    color: COLORS.text,
    letterSpacing: -1.5,
    lineHeight: HEADLINE_SIZE * 1.04,
  },
  subtext: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: "400",
    color: COLORS.textMuted,
    textAlign: "center",
    lineHeight: 24,
    letterSpacing: -0.16,
    maxWidth: 256,
  },
  cta: {
    height: 44,
    minWidth: 256,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: COLORS.cta,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 30,
    elevation: 8,
  },
  ctaPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  ctaText: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: "500",
    color: "#FFFFFF",
    letterSpacing: -0.16,
  },
});

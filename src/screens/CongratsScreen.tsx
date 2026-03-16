import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import LottieView from "lottie-react-native";
import {
  getMainResetState,
  getMainWithLessonResetState,
  type CongratsParams,
} from "../navigation/paywallNavigation";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const CONFETTI_LOTTIE = require("../../assets/lottie/confetti.json");

const CONFETTI_DURATION_MS = 3000;

export default function CongratsScreen({
  navigation,
  route,
}: {
  navigation: { reset: (params: object) => void };
  route: { params?: CongratsParams };
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { scenario, difficulty } = route.params ?? {};

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      const resetState =
        scenario && difficulty
          ? getMainWithLessonResetState(scenario, difficulty)
          : getMainResetState();
      navigation.reset(resetState);
    }, CONFETTI_DURATION_MS);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [navigation, scenario, difficulty]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emoji}>🎉</Text>
        <Text style={styles.title}>Welcome to Pro!</Text>
        <Text style={styles.subtitle}>You're all set to unlock your full potential.</Text>
      </View>
      <View style={styles.confettiOverlay} pointerEvents="none">
        <LottieView
          source={CONFETTI_LOTTIE}
          autoPlay
          loop={false}
          style={styles.confettiLottie}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#29B6F6",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    alignItems: "center",
    paddingHorizontal: 32,
    zIndex: 1,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontFamily: "Georgia",
    fontSize: 30,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "500",
    color: "rgba(253, 251, 247, 0.9)",
    textAlign: "center",
  },
  confettiOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  confettiLottie: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
});

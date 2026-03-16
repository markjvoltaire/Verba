import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, Pressable, Animated } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useApp } from "../context/AppContext";
import WaveLogo from "../components/WaveLogo";
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const GREETINGS = ["Hello", "Hola", "Bonjour", "Ciao"];
const GREETING_INTERVAL_MS = 1800;

export default function WelcomeScreen() {
  const navigation = useNavigation();
  const { userChecked } = useApp();
  const insets = useSafeAreaInsets();

  const handleGetStarted = () => {
    (navigation as any).navigate("Onboarding");
  };
  const [isAnimating, setIsAnimating] = useState(false);
  const [greetingIndex, setGreetingIndex] = useState(0);
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonTranslateY = useRef(new Animated.Value(24)).current;
  const greetingOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(greetingOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setGreetingIndex((i) => (i + 1) % GREETINGS.length);
        Animated.timing(greetingOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }, GREETING_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [greetingOpacity]);

  useEffect(() => {
    if (!userChecked || !isAnimating) return;
    Animated.parallel([
      Animated.timing(buttonOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(buttonTranslateY, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [userChecked, isAnimating, buttonOpacity, buttonTranslateY]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Animated.Text style={[styles.title, { opacity: greetingOpacity }]}>
          {GREETINGS[greetingIndex]} Verba
        </Animated.Text>
        <View style={styles.glowCircle} />
        <WaveLogo
          startAnimatingAfterMs={1200}
          onAnimationStart={() => setIsAnimating(true)}
        />
        <Text style={styles.tagline}>Speak. Learn. Grow.</Text>
      </View>
      {userChecked && isAnimating && (
        <Animated.View
          style={[
            styles.buttonWrap,
            {
              opacity: buttonOpacity,
              transform: [{ translateY: buttonTranslateY }],
              paddingBottom: insets.bottom + 48,
            },
          ]}
        >
          <Pressable
            style={styles.button}
            onPress={handleGetStarted}
          >
            <Text style={styles.buttonText}>Get Started</Text>
          </Pressable>
        </Animated.View>
      )}
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
    justifyContent: "center",
  },
  glowCircle: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    fontFamily: "Georgia",
    fontSize: 28,
    fontWeight: "700",
    color: "#F8F9FA",
    marginBottom: 24,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  tagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 2,
    fontWeight: '600',
    marginTop: 16,
    textTransform: 'uppercase',
  },
  buttonWrap: {
    position: "absolute",
    bottom: 0,
    left: 32,
    right: 32,
  },
  button: {
    paddingVertical: 18,
    borderRadius: 100,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    shadowColor: "#1C1917",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1E90FF",
    letterSpacing: 0.3,
  },
});

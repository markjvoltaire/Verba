import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, Pressable, Animated } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useApp } from "../context/AppContext";
import WaveLogo from "../components/WaveLogo";

const GREETINGS = ["Hello", "Hola", "Bonjour", "Ciao"];
const GREETING_INTERVAL_MS = 1800;

export default function WelcomeScreen() {
  const navigation = useNavigation();
  const { userChecked } = useApp();
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
        <WaveLogo
          startAnimatingAfterMs={1200}
          onAnimationStart={() => setIsAnimating(true)}
        />
      </View>
      {userChecked && isAnimating && (
        <Animated.View
          style={[
            styles.buttonWrap,
            {
              opacity: buttonOpacity,
              transform: [{ translateY: buttonTranslateY }],
            },
          ]}
        >
          <Pressable
            style={styles.button}
            onPress={() => navigation.navigate("Onboarding")}
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
    backgroundColor: "#00877B",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: "Georgia",
    fontSize: 28,
    fontWeight: "700",
    color: "#F8F9FA",
    marginBottom: 24,
  },
  buttonWrap: {
    position: "absolute",
    bottom: 48,
    left: 32,
    right: 32,
  },
  button: {
    paddingVertical: 18,
    borderRadius: 28,
    backgroundColor: "#F8F9FA",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#00877B",
  },
});

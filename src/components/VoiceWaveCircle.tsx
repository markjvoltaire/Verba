import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Easing } from "react-native";

const RING_COUNT = 4;
const BASE_SIZE = 120;
const RING_GAP = 28;
const PULSE_DURATION = 800;
const COLOR = "#29B6F6";

interface VoiceWaveCircleProps {
  /** Whether audio is currently playing – rings animate only when true. */
  active?: boolean;
  /** Base diameter of the inner circle. Default 120. */
  size?: number;
}

export default function VoiceWaveCircle({
  active = true,
  size = BASE_SIZE,
}: VoiceWaveCircleProps) {
  const scales = useRef(
    Array.from({ length: RING_COUNT }, () => new Animated.Value(0.85)),
  ).current;
  const opacities = useRef(
    Array.from({ length: RING_COUNT }, () => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    if (!active) {
      scales.forEach((s) => s.setValue(0.85));
      opacities.forEach((o) => o.setValue(0));
      return;
    }

    const animations = scales.map((scale, i) => {
      const opacity = opacities[i];
      const delay = i * (PULSE_DURATION / RING_COUNT);
      const peakOpacity = 0.35 - i * 0.07;

      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(scale, {
              toValue: 1,
              duration: PULSE_DURATION,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.sequence([
              Animated.timing(opacity, {
                toValue: peakOpacity,
                duration: PULSE_DURATION * 0.3,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
              }),
              Animated.timing(opacity, {
                toValue: 0,
                duration: PULSE_DURATION * 0.7,
                easing: Easing.in(Easing.ease),
                useNativeDriver: true,
              }),
            ]),
          ]),
          Animated.parallel([
            Animated.timing(scale, {
              toValue: 0.85,
              duration: 0,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        ]),
      );
    });

    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [active, scales, opacities]);

  // Inner pulsing core
  const coreScale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active) {
      coreScale.setValue(1);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(coreScale, {
          toValue: 1.08,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(coreScale, {
          toValue: 0.95,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [active, coreScale]);

  const totalSize = size + RING_COUNT * RING_GAP * 2;

  return (
    <View style={[styles.wrapper, { width: totalSize, height: totalSize }]}>
      {/* Expanding rings */}
      {scales.map((scale, i) => {
        const ringSize = size + (i + 1) * RING_GAP * 2;
        return (
          <Animated.View
            key={i}
            style={[
              styles.ring,
              {
                width: ringSize,
                height: ringSize,
                borderRadius: ringSize / 2,
                borderColor: COLOR,
                opacity: opacities[i],
                transform: [{ scale }],
              },
            ]}
          />
        );
      })}

      {/* Core circle */}
      <Animated.View
        style={[
          styles.core,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            transform: [{ scale: coreScale }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    borderWidth: 2,
  },
  core: {
    backgroundColor: COLOR,
    shadowColor: COLOR,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
});

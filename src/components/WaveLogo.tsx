import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Dimensions, Animated } from "react-native";
import Svg, { Ellipse, G, Defs, ClipPath, Rect } from "react-native-svg";

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SIZE = Math.min(SCREEN_WIDTH * 0.85, 320);

const VIEWBOX_WIDTH = 850;
const VIEWBOX_HEIGHT = 874;
const PADDING = 120;
const FILL = "#F8F9FA";

const ELLIPSES = [
  { cx: 18, cy: 444, rx: 18, ry: 141 }, // 0 - far left
  { cx: 832, cy: 444, rx: 18, ry: 141 }, // 1 - far right
  { cx: 95, cy: 444, rx: 27, ry: 276 }, // 2
  { cx: 752, cy: 444, rx: 27, ry: 276 }, // 3
  { cx: 189, cy: 434.5, rx: 43, ry: 360.5 }, // 4
  { cx: 657, cy: 439.5, rx: 43, ry: 360.5 }, // 5
  { cx: 300, cy: 438, rx: 52, ry: 409 }, // 6
  { cx: 547, cy: 438, rx: 52, ry: 409 }, // 7
  { cx: 424, cy: 437, rx: 60, ry: 437 }, // 8 - center
];

// Distance from center (0 = center, 1 = outermost)
const DISTANCES = [1, 1, 0.78, 0.78, 0.56, 0.56, 0.34, 0.34, 0];

const MIN_SCALE = 0.55;
const MAX_SCALE = 1.15;

interface WaveLogoProps {
  /** Delay in ms before animation starts. Logo is still until then. */
  startAnimatingAfterMs?: number;
  /** Called when the animation begins (after the delay, if any). */
  onAnimationStart?: () => void;
  /** Fill color for the logo. Defaults to #F8F9FA. */
  fill?: string;
  /** When false, renders a static logo with no animation. */
  animated?: boolean;
  /** Override the logo size. Defaults to responsive size based on screen width. */
  size?: number;
}

export default function WaveLogo({
  startAnimatingAfterMs = 0,
  onAnimationStart,
  fill = FILL,
  animated = true,
  size,
}: WaveLogoProps) {
  const displaySize = size ?? SIZE;
  const ryAnims = useRef(ELLIPSES.map((e) => new Animated.Value(e.ry))).current;

  useEffect(() => {
    if (!animated) return;
    const INTERVAL_MS = 180;
    const DURATION = 120;

    let stopped = false;
    let frameId: ReturnType<typeof setTimeout>;
    let delayId: ReturnType<typeof setTimeout> | undefined;

    const amplitudes = [1.0, 0.7, 0.9, 0.6, 0.95, 0.75];
    let index = 0;

    const animate = () => {
      if (stopped) return;

      const amplitude = amplitudes[index % amplitudes.length];
      index++;

      ELLIPSES.forEach((e, i) => {
        const dist = DISTANCES[i];
        const outerDamp = 1 - dist * 0.4;
        const targetRy =
          e.ry * (MIN_SCALE + (MAX_SCALE - MIN_SCALE) * amplitude * outerDamp);
        const baseRy = e.ry * 0.7;

        Animated.sequence([
          Animated.timing(ryAnims[i], {
            toValue: targetRy,
            duration: DURATION,
            useNativeDriver: false,
          }),
          Animated.timing(ryAnims[i], {
            toValue: baseRy,
            duration: DURATION,
            useNativeDriver: false,
          }),
        ]).start();
      });

      frameId = setTimeout(animate, INTERVAL_MS);
    };

    const startAnimation = () => {
      onAnimationStart?.();
      animate();
    };

    if (startAnimatingAfterMs > 0) {
      delayId = setTimeout(startAnimation, startAnimatingAfterMs);
    } else {
      startAnimation();
    }

    return () => {
      stopped = true;
      clearTimeout(frameId);
      if (delayId != null) clearTimeout(delayId);
    };
  }, [animated, ryAnims, startAnimatingAfterMs, onAnimationStart]);

  return (
    <View style={[styles.container, { width: displaySize, height: displaySize }]}>
      <Svg
        width={displaySize}
        height={displaySize}
        viewBox={`${-PADDING} ${-PADDING} ${VIEWBOX_WIDTH + PADDING * 2} ${VIEWBOX_HEIGHT + PADDING * 2}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <Defs>
          <ClipPath id="clip0_1_19">
            <Rect
              x={-PADDING}
              y={-PADDING}
              width={VIEWBOX_WIDTH + PADDING * 2}
              height={VIEWBOX_HEIGHT + PADDING * 2}
              fill="white"
            />
          </ClipPath>
        </Defs>
        <G clipPath="url(#clip0_1_19)">
          {ELLIPSES.map((e, i) =>
            animated ? (
              <AnimatedEllipse
                key={i}
                cx={e.cx}
                cy={e.cy}
                rx={e.rx}
                ry={ryAnims[i]}
                fill={fill}
              />
            ) : (
              <Ellipse
                key={i}
                cx={e.cx}
                cy={e.cy}
                rx={e.rx}
                ry={e.ry}
                fill={fill}
              />
            ),
          )}
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
});

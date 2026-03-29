import { useRef, useEffect } from 'react';
import { Animated } from 'react-native';

/**
 * Fade-in animation on mount. Perfect for cards and panels.
 * @param {number} delay - ms delay before starting
 * @param {number} duration - ms duration
 * @returns {Animated.Value} opacity value to pass to Animated.View
 */
export function useFadeIn(delay = 0, duration = 400) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration,
      delay,
      useNativeDriver: true,
    }).start();
  }, []);
  return opacity;
}

/**
 * Slide-up + fade-in on mount. Great for list items.
 * @param {number} delay - ms delay (stagger by index * 80)
 * @param {number} duration - ms duration
 */
export function useSlideUp(delay = 0, duration = 350) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1, duration, delay, useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0, duration, delay, useNativeDriver: true,
      }),
    ]).start();
  }, []);
  return { opacity, transform: [{ translateY }] };
}

/**
 * Pulse animation (loop). For active indicators, XP flash, etc.
 * @param {number} minOpacity
 * @param {number} duration - full cycle duration
 */
export function usePulse(minOpacity = 0.4, duration = 1200) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: minOpacity, duration: duration / 2, useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1, duration: duration / 2, useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);
  return opacity;
}

/**
 * Scale-bounce on mount. For score numbers, level-ups.
 * @param {number} delay
 */
export function useScaleBounce(delay = 0) {
  const scale = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 4,
      tension: 60,
      delay,
      useNativeDriver: true,
    }).start();
  }, []);
  return { transform: [{ scale }] };
}

/**
 * Staggered fade-in for a list of items.
 * Call with the total count, returns an array of Animated.Values.
 * @param {number} count - number of items
 * @param {number} stagger - ms between each item
 */
export function useStaggerFadeIn(count, stagger = 60) {
  const anims = useRef(
    Array.from({ length: count }, () => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(16),
    }))
  ).current;

  useEffect(() => {
    const animations = anims.map((a, i) =>
      Animated.parallel([
        Animated.timing(a.opacity, {
          toValue: 1, duration: 300, delay: i * stagger, useNativeDriver: true,
        }),
        Animated.timing(a.translateY, {
          toValue: 0, duration: 300, delay: i * stagger, useNativeDriver: true,
        }),
      ])
    );
    Animated.parallel(animations).start();
  }, [count]);

  return anims;
}

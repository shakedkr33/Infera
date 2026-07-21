import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// inyomi-splash-logo-transparent.png: 707 × 353, transparent background,
// horizontal wordmark with Hebrew tagline below.
const LOGO_ASPECT_RATIO = 707 / 353;
const DOT_COLORS = ['#ff8a3d', '#f15f9a', '#2b086f'] as const;

export function InYomiSplashScreen() {
  const { width, height } = useWindowDimensions();
  const dotAnimations = useRef(
    DOT_COLORS.map(() => new Animated.Value(0.45))
  ).current;

  // Logo: 82 % of screen width, floored at 260, capped at 440 for tablets.
  const logoWidth = useMemo(
    () => Math.min(Math.max(width * 0.82, 260), 440),
    [width]
  );
  const logoHeight = useMemo(() => logoWidth / LOGO_ASPECT_RATIO, [logoWidth]);

  // Responsive shape dimensions derived from screen size.
  const blobSize = useMemo(() => width * 0.82, [width]);
  const pillWidth = useMemo(() => width * 1.08, [width]);
  const pillHeight = useMemo(() => height * 0.115, [height]);

  useEffect(() => {
    const animations = dotAnimations.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 180),
          Animated.timing(value, {
            toValue: 1,
            duration: 720,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0.45,
            duration: 720,
            useNativeDriver: true,
          }),
        ])
      )
    );

    Animated.parallel(animations).start();

    return () => {
      for (const animation of animations) {
        animation.stop();
      }
    };
  }, [dotAnimations]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="dark" backgroundColor="#FFF8F3" />

      {/* Warm cream gradient base */}
      <LinearGradient
        colors={['#FFF6EE', '#FFF8F3', '#FEF0E8', '#FFF5ED']}
        locations={[0, 0.4, 0.75, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* ── Background shapes ─────────────────────────────────────────────
          All shapes use warm cream / peach / beige tones at very low opacity.
          They are cropped by the screen edges via negative offsets.
      ──────────────────────────────────────────────────────────────────── */}

      {/* Top-right large peach circle */}
      <View
        pointerEvents="none"
        style={[
          styles.shapeBase,
          {
            width: blobSize,
            height: blobSize,
            top: -blobSize * 0.3,
            right: -blobSize * 0.26,
            backgroundColor: 'rgba(255, 178, 120, 0.15)',
          },
        ]}
      />

      {/* Upper pill crossing left–centre area */}
      <View
        pointerEvents="none"
        style={[
          styles.shapeBase,
          {
            width: pillWidth,
            height: pillHeight,
            top: height * 0.13,
            left: -pillWidth * 0.24,
            backgroundColor: 'rgba(255, 165, 130, 0.12)',
            transform: [{ rotate: '-12deg' }],
          },
        ]}
      />

      {/* Bottom-left warm beige circle */}
      <View
        pointerEvents="none"
        style={[
          styles.shapeBase,
          {
            width: blobSize * 0.9,
            height: blobSize * 0.9,
            bottom: -blobSize * 0.28,
            left: -blobSize * 0.3,
            backgroundColor: 'rgba(255, 196, 150, 0.14)',
          },
        ]}
      />

      {/* Bottom-right warm peach pill */}
      <View
        pointerEvents="none"
        style={[
          styles.shapeBase,
          {
            width: pillWidth,
            height: pillHeight * 0.9,
            bottom: height * 0.16,
            right: -pillWidth * 0.26,
            backgroundColor: 'rgba(255, 155, 105, 0.11)',
            transform: [{ rotate: '15deg' }],
          },
        ]}
      />

      {/* ── Logo ─────────────────────────────────────────────────────────── */}
      <View style={styles.content}>
        <Image
          source={require('../assets/images/inyomi-splash-logo-transparent.png')}
          style={[
            styles.logo,
            {
              width: logoWidth,
              height: logoHeight,
            },
          ]}
          resizeMode="contain"
          accessible
          accessibilityLabel="InYomi"
        />
      </View>

      {/* ── Loading indicators ────────────────────────────────────────────
          Behavior, timing, and logic are identical to the previous version.
      ──────────────────────────────────────────────────────────────────── */}
      <View style={styles.loaderWrap}>
        <View style={styles.dotsRow}>
          {DOT_COLORS.map((color, index) => {
            const scale = dotAnimations[index].interpolate({
              inputRange: [0.45, 1],
              outputRange: [0.82, 1.08],
            });

            return (
              <Animated.View
                key={color}
                style={[
                  styles.dot,
                  {
                    backgroundColor: color,
                    opacity: dotAnimations[index],
                    transform: [{ scale }],
                  },
                ]}
              />
            );
          })}
        </View>

        <View style={styles.progressTrack}>
          <LinearGradient
            colors={['#ff8a3d', '#f15f9a', '#2b086f']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.progressFill}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFF8F3',
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logo: {
    maxWidth: '90%',
  },
  loaderWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 70,
    alignItems: 'center',
    gap: 16,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  progressTrack: {
    width: 148,
    height: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.86)',
    overflow: 'hidden',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 54,
    borderRadius: 999,
  },
  // Shared base for all background shapes (blobs, pills, halos).
  shapeBase: {
    position: 'absolute',
    borderRadius: 999,
  },
});

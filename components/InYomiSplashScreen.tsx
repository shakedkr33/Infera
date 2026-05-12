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

// inyomi-splash-logo-transparent.png: 716×712, transparent background, vertical layout.
const LOGO_ASPECT_RATIO = 716 / 712;
const DOT_COLORS = ['#ff8a3d', '#f15f9a', '#2b086f'] as const;

export function InYomiSplashScreen() {
  const { width } = useWindowDimensions();
  const dotAnimations = useRef(
    DOT_COLORS.map(() => new Animated.Value(0.45))
  ).current;

  const logoWidth = useMemo(
    () => Math.min(Math.max(width * 0.58, 200), 260),
    [width]
  );

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
      <LinearGradient
        colors={['#FFF8F3', '#FFF9F5', '#FBE7F2', '#F4E9FF']}
        locations={[0, 0.42, 0.76, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.blob, styles.blobPeach]} />
      <View style={[styles.blob, styles.blobLavender]} />
      <View style={[styles.wave, styles.wavePink]} />
      <View style={[styles.wave, styles.waveWarm]} />

      <View style={styles.content}>
        <Image
          source={require('../assets/images/inyomi-splash-logo-transparent.png')}
          style={[
            styles.logo,
            {
              width: logoWidth,
              height: logoWidth / LOGO_ASPECT_RATIO,
            },
          ]}
          resizeMode="contain"
          accessible
          accessibilityLabel="InYomi"
        />
      </View>

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
    paddingHorizontal: 32,
  },
  logo: {
    maxWidth: '86%',
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
  blob: {
    position: 'absolute',
    borderRadius: 999,
  },
  blobPeach: {
    width: 330,
    height: 330,
    top: -126,
    right: -118,
    backgroundColor: 'rgba(255, 158, 92, 0.17)',
  },
  blobLavender: {
    width: 290,
    height: 290,
    bottom: 110,
    left: -145,
    backgroundColor: 'rgba(138, 103, 214, 0.12)',
  },
  wave: {
    position: 'absolute',
    width: 420,
    height: 150,
    borderRadius: 999,
    opacity: 0.16,
  },
  wavePink: {
    top: 116,
    left: -112,
    backgroundColor: '#F8A5C2',
    transform: [{ rotate: '-18deg' }],
  },
  waveWarm: {
    right: -155,
    bottom: 190,
    backgroundColor: '#FFC29A',
    transform: [{ rotate: '21deg' }],
  },
});

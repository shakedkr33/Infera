import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { Dimensions, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SCREEN_H = Dimensions.get('window').height;

export default function WelcomeScreen() {
  const router = useRouter();
  const isNavigating = useRef(false);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.inner}>

        <View style={styles.logoArea}>
          <Image
            source={require('@/assets/images/logo-inyomi.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="InYomi Logo"
          />
        </View>

        {/* HERO_AREA: replace Image with Video component in Phase 2 */}
        <View style={styles.heroContainer}>
          <Image
            source={require('@/assets/images/icon.png')}
            style={styles.heroImage}
            resizeMode="cover"
            accessibilityLabel=""
            accessibilityElementsHidden={true}
          />
        </View>

        <View style={styles.bottomArea}>
          <Text style={styles.title}>ברוכים הבאים ל־InYomi</Text>
          <Text style={styles.subtitle}>
            כל האירועים, המשימות והתיאומים שלך במקום אחד
          </Text>
        </View>

        <View style={styles.spacer} />

        <Pressable
          onPress={() => {
            if (isNavigating.current) return;
            isNavigating.current = true;
            router.replace('/(auth)/sign-in');
          }}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="כניסה עם מספר טלפון"
        >
          <Text style={styles.ctaText}>כניסה עם מספר טלפון</Text>
        </Pressable>

      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  inner: {
    flex: 1,
  },
  logoArea: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  logo: {
    width: 160,
    height: 94,
  },
  heroContainer: {
    height: SCREEN_H * 0.42,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#f0f7fd',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  bottomArea: {
    marginTop: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111418',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 23,
  },
  spacer: {
    flex: 1,
  },
  cta: {
    height: 56,
    backgroundColor: '#36a9e2',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#36a9e2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaPressed: {
    opacity: 0.85,
  },
  ctaText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
});

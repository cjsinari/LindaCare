import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRAND_NAME, BRAND_TAGLINE } from '../theme/brand';
import { colors, radius, space, type } from '../theme/tokens';

/*
 * The opening screen.
 *
 * ── Why this exists when expo-splash-screen already shows one ──
 *
 * The native splash is a single image, drawn by Android before any JavaScript
 * runs. It is the right thing for the first instant and the wrong thing for
 * the second: it cannot say anything, cannot move, and cannot know whether the
 * wait is over. app.json gave it a navy background and no image at all, so the
 * app opened on a blank navy rectangle and stayed there for as long as the
 * stored session took to read back.
 *
 * So the native splash now hands over the moment there is something to draw,
 * and this takes the wait from there. The two are the same navy, so the
 * handover is invisible -- the brand appears on a screen that was already the
 * right colour, rather than the screen changing.
 *
 * ── What it is for ──
 *
 * The wait is the session restore: expo-secure-store opening the keychain and
 * AuthContext confirming the token. On a mid-range Android that is a few
 * hundred milliseconds, and on a cold start after an update it is longer.
 *
 * It is also the only moment this app gets to say what it is before asking for
 * a phone number. Somebody opening it for the first time is deciding whether
 * to trust it with a parent's address, so the mark, the name and the line
 * about what this is are the content here, not decoration around a spinner.
 *
 * ── Two details that are not decoration ──
 *
 * MIN_VISIBLE_MS: a restore that resolves immediately would otherwise show
 * this for one frame, which reads as a flicker -- a defect, not a brand. Six
 * hundred milliseconds is long enough to be read as deliberate and short
 * enough that nobody waits for it.
 *
 * The fade: unmounting the splash the instant the session resolves cuts to the
 * first screen hard enough to look like a crash and a relaunch. The fade is
 * short, opacity only, and runs on the native driver so it does not compete
 * with the navigator mounting underneath it.
 */

const MIN_VISIBLE_MS = 600;
const FADE_MS = 320;

export default function BrandSplash({ ready, onFinished }) {
  const insets = useSafeAreaInsets();
  const [done, setDone] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;

  // The mark lifts in rather than appearing. It is the first motion in the
  // app and it sets the register for the rest: short, soft, never bouncy.
  const rise = useRef(new Animated.Value(0)).current;

  const held = useMinimumDuration(MIN_VISIBLE_MS);

  useEffect(() => {
    Animated.timing(rise, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [rise]);

  useEffect(() => {
    if (!ready || !held) return undefined;

    const animation = Animated.timing(opacity, {
      toValue: 0,
      duration: FADE_MS,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (!finished) return;
      setDone(true);
      onFinished?.();
    });
    return () => animation.stop();
  }, [ready, held, opacity, onFinished]);

  if (done) return null;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, { opacity }]}
      // One announcement, not four fragments, and it says what is happening
      // rather than reading out a logo.
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${BRAND_NAME}. ${BRAND_TAGLINE}. Starting.`}
      // Nothing underneath is reachable while this is up, so nothing
      // underneath should be reachable to a screen reader either.
      accessibilityViewIsModal
    >
      <Animated.View
        style={[
          styles.center,
          {
            opacity: rise,
            transform: [{
              translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }),
            }],
          },
        ]}
      >
        <View style={styles.mark}>
          <Ionicons name="shield-checkmark" size={40} color={colors.onTeal} />
        </View>

        <Text style={styles.name}>{BRAND_NAME}</Text>
        <Text style={styles.tagline}>{BRAND_TAGLINE}</Text>
      </Animated.View>

      <View style={[styles.foot, { paddingBottom: Math.max(insets.bottom, space.xl) }]}>
        <ActivityIndicator color={colors.teal} />
        {/*
          Hidden from assistive tech because the wrapper has already said
          "Starting": a screen reader should not hear the same state twice
          under two different names.
        */}
        <Text style={styles.footText} importantForAccessibility="no">
          Securing your session…
        </Text>
      </View>
    </Animated.View>
  );
}

/**
 * True once `ms` have passed since mount.
 *
 * Separate from the ready flag on purpose: the question "has the session
 * resolved" and the question "has this been on screen long enough to be seen"
 * are different, and collapsing them into one timer is how a slow restore ends
 * up waiting on a timeout it already outlasted.
 */
function useMinimumDuration(ms) {
  const [elapsed, setElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setElapsed(true), ms);
    return () => clearTimeout(timer);
  }, [ms]);

  return elapsed;
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },

  center: { alignItems: 'center', paddingHorizontal: space.xl },

  mark: {
    width: 84,
    height: 84,
    borderRadius: radius.sheet + 4,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xl,
  },

  name: {
    ...type.hero,
    fontSize: 34,
    lineHeight: 42,
    color: colors.onNavy,
    letterSpacing: 0.2,
  },
  tagline: {
    ...type.subtitle,
    color: colors.onNavyMuted,
    marginTop: space.xs,
    textAlign: 'center',
  },

  foot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    gap: space.md,
  },
  footText: { ...type.caption, color: colors.onNavyMuted },
});

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space, type, TOUCH_TARGET } from '../theme/tokens';

/*
 * The navy header every screen in the auth flow opens with.
 *
 * Four variations appear across the mockups -- the wordmark and a title on
 * registration and sign-in, a back arrow and an icon tile on the verification
 * screens -- so this takes them as props rather than existing in four copies.
 * Issues #42 and #43 render the other two.
 *
 * ── The safe area ──
 *
 * The padding comes from `useSafeAreaInsets` rather than a SafeAreaView,
 * because the header's navy has to run up behind the status bar while its
 * *content* starts below it. A SafeAreaView would inset the background too and
 * leave a white band above the navy on any phone with a notch.
 *
 * ── The card below it does not overlap it ──
 *
 * It used to. Every auth screen pulled its body up by 24dp so the first card
 * sat over the header's lower edge, which is how the mockups draw it. On a
 * real device that put the card's top border, the PHONE NUMBER label and some
 * of the field itself inside the navy, so the header looked like it had been
 * cut off rather than layered under. The pull is gone and the body starts
 * below the header; `paddingBottom` here is what sets the distance, so it is
 * one value for all five screens rather than five that drift apart.
 */
export default function HeroHeader({
  title,
  subtitle,
  brand,
  tagline,
  icon,
  onBack,
  backLabel = 'Back',
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + space.md }]}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          style={styles.back}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={backLabel}
        >
          <Ionicons name="chevron-back" size={18} color={colors.onNavyMuted} />
          <Text style={styles.backText}>{backLabel}</Text>
        </Pressable>
      ) : null}

      {brand ? (
        <View style={styles.brandRow}>
          <View style={styles.mark}>
            <Ionicons name="shield-checkmark" size={20} color={colors.navy} />
          </View>
          <View style={styles.brandText}>
            <Text style={styles.brandName}>{brand}</Text>
            {tagline ? <Text style={styles.tagline}>{tagline}</Text> : null}
          </View>
        </View>
      ) : null}

      {icon && !brand ? (
        <View style={styles.mark}>
          {/* Navy on the light accent: the mark sits on the navy header, where
              the solid accent has no usable contrast. See tokens.js. */}
          <Ionicons name={icon} size={22} color={colors.navy} />
        </View>
      ) : null}

      {/* The title is the screen's heading for assistive tech, which is what
          lets a screen-reader user jump straight to it instead of walking the
          header's decoration first. */}
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.navy,
    paddingHorizontal: space.xl,
    paddingBottom: space.xl,
    gap: space.md,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: TOUCH_TARGET - 12,
    alignSelf: 'flex-start',
    paddingRight: space.md,
  },
  backText: { ...type.caption, color: colors.onNavyMuted },

  brandRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  brandText: { flex: 1 },
  brandName: { ...type.bodyMedium, fontFamily: type.button.fontFamily, color: colors.onNavy },
  tagline: { ...type.caption, fontSize: 14, color: colors.onNavyMuted },

  mark: {
    width: 42,
    height: 42,
    borderRadius: radius.md + 2,
    backgroundColor: colors.clayOnNavy,
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: { ...type.hero, color: colors.onNavy, marginTop: space.sm },
  subtitle: { ...type.subtitle, color: colors.onNavyMuted, marginTop: -space.xs },
});

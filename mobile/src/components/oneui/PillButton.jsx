import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Touchable from './Touchable';
import { colors, oneui, space, type, TOUCH_TARGET } from '../../theme/tokens';

/*
 * The fully-round button One UI uses for everything from "+ New Report" to
 * "Submit Visit Report".
 *
 * PrimaryButton (src/components/PrimaryButton.jsx) stays exactly as it is and
 * keeps the auth screens on their 10dp corner. This is the caregiver module's
 * button and it is round, because a 10dp button inside a 26dp card is the one
 * detail that makes a One UI screen look like a Material screen wearing a hat.
 *
 * Four variants, and the reason each exists:
 *
 *   solid   the single most important action on a screen. One per screen.
 *   tonal   a secondary action that is still a real action -- "Check in" on a
 *           schedule row. Deep clay on a soft clay ground rather than white
 *           on full clay, so it does not compete with the solid one. It used
 *           to be drawn in the success green on a mint ground, because the
 *           soft tint and `successBg` were the same value; both halves of
 *           that are fixed in tokens.js.
 *   quiet   a text action with no fill: "View all →". Still 48dp tall.
 *   danger  destructive, and visually separated from the rest.
 *
 * The disabled state is never the only explanation, same rule as the auth
 * screens: every screen that disables this also says in text why.
 */
const VARIANTS = {
  solid: { bg: colors.clay, pressedBg: colors.clayPressed, fg: colors.onClay },
  tonal: { bg: colors.claySoft, pressedBg: colors.claySoftPressed, fg: colors.clayInk },
  quiet: { bg: 'transparent', pressedBg: colors.surfaceSunken, fg: colors.link },
  danger: { bg: colors.dangerBg, pressedBg: colors.dangerBgPressed, fg: colors.danger },
};

export default function PillButton({
  label,
  onPress,
  variant = 'solid',
  icon = null,
  iconRight = null,
  loading = false,
  disabled = false,
  size = 'md',
  full = false,
  accessibilityHint,
  style,
}) {
  const palette = VARIANTS[variant] || VARIANTS.solid;
  const inert = disabled || loading;
  const small = size === 'sm';

  return (
    <Touchable
      onPress={onPress}
      disabled={inert}
      style={[
        styles.base,
        small ? styles.small : styles.medium,
        { backgroundColor: inert ? colors.disabledBg : palette.bg },
        variant === 'quiet' && !inert && styles.quiet,
        full && styles.full,
        style,
      ]}
      rippleColor={variant === 'solid' ? 'rgba(255,255,255,0.22)' : 'rgba(20,40,61,0.10)'}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inert, busy: loading }}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="small" color={inert ? colors.disabledInk : palette.fg} />
        ) : icon ? (
          <Ionicons
            name={icon}
            size={small ? 14 : 16}
            color={inert ? colors.disabledInk : palette.fg}
          />
        ) : null}

        <Text
          style={[
            small ? styles.labelSmall : styles.label,
            { color: inert ? colors.disabledInk : palette.fg },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>

        {iconRight && !loading ? (
          <Ionicons
            name={iconRight}
            size={small ? 14 : 16}
            color={inert ? colors.disabledInk : palette.fg}
          />
        ) : null}
      </View>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: oneui.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    overflow: 'hidden',
  },
  medium: {
    minHeight: TOUCH_TARGET + 2,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
  },
  /*
   * A small pill is 34dp of paint, which is under the 48dp floor. It carries
   * vertical padding to make up the difference rather than being drawn bigger,
   * so the target is legal while the button still looks small.
   */
  small: {
    minHeight: 34,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm - 1,
    marginVertical: (TOUCH_TARGET - 34) / 2,
  },
  quiet: { backgroundColor: 'transparent' },
  full: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  label: { ...type.button, textAlign: 'center' },
  labelSmall: {
    ...type.captionMedium,
    fontFamily: type.button.fontFamily,
    fontSize: 13,
    lineHeight: 18,
  },
});

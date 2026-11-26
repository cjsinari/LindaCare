import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, oneui, space, type } from '../../theme/tokens';

/*
 * The small status pills: Stable, Needs attention, Active, Upcoming, Completed.
 *
 * ── Every tone carries an icon ──
 *
 * The mockups show these as coloured text on a coloured fill, and on their own
 * that fails WCAG 1.4.1: the only difference between "Stable" and "Needs
 * attention" would be mint versus amber. The words already carry the meaning
 * here, which is most of the fix, but the icon makes it survive being skimmed
 * -- a caregiver glancing down a list of twelve people is reading shape and
 * colour, not words, and the shape has to differ.
 *
 * `compact` drops the icon for the places where the chip sits next to a name
 * at 11px and an icon would crowd it. Those are the places where the chip is
 * never the only signal: the row it is on also states the status in text.
 */
const TONES = {
  neutral: { bg: colors.surfaceSunken, fg: colors.inkMuted, icon: 'ellipse-outline' },
  stable: { bg: colors.successBg, fg: colors.success, icon: 'checkmark-circle' },
  active: { bg: colors.successBg, fg: colors.success, icon: 'checkmark-circle' },
  attention: { bg: colors.warningBg, fg: colors.warning, icon: 'alert-circle' },
  upcoming: { bg: colors.infoBg, fg: colors.info, icon: 'time' },
  progress: { bg: colors.infoBg, fg: colors.info, icon: 'walk' },
  completed: { bg: colors.successBg, fg: colors.success, icon: 'checkmark-done' },
  missed: { bg: colors.dangerBg, fg: colors.danger, icon: 'close-circle' },
  danger: { bg: colors.dangerBg, fg: colors.danger, icon: 'alert-circle' },
};

/** Status strings the data uses, mapped to a tone and the words to show. */
export const RECIPIENT_STATUS = {
  stable: { tone: 'stable', label: 'Stable' },
  attention: { tone: 'attention', label: 'Needs attention' },
  inactive: { tone: 'neutral', label: 'Inactive' },
  /*
   * Nobody has assessed this person yet.
   *
   * Reached when the service knows the assignment but has no care record
   * behind it -- which is every assignment until the care module lands. A
   * care status is a judgement a human makes, so the absence of one is its
   * own state and says so, in neutral grey.
   */
  unknown: { tone: 'neutral', label: 'No status yet' },
};

/**
 * The status to draw for a value that may be null, missing or unrecognised.
 *
 * Every screen used to default those to `stable`, which printed a reassuring
 * "Stable" over a person nobody had looked at. Defaulting the other way is the
 * only safe direction for a clinical-sounding label.
 */
export const recipientStatus = (value) => RECIPIENT_STATUS[value] || RECIPIENT_STATUS.unknown;

export const VISIT_STATUS = {
  upcoming: { tone: 'upcoming', label: 'Upcoming' },
  in_progress: { tone: 'progress', label: 'In progress' },
  completed: { tone: 'completed', label: 'Completed' },
  missed: { tone: 'missed', label: 'Missed' },
};

export default function Chip({ tone = 'neutral', label, compact = false, style }) {
  const palette = TONES[tone] || TONES.neutral;

  return (
    <View
      style={[styles.chip, { backgroundColor: palette.bg }, compact && styles.compact, style]}
      // Read as one thing, not as an icon followed by a word.
      accessible
      accessibilityLabel={label}
    >
      {compact ? null : (
        <Ionicons name={palette.icon} size={12} color={palette.fg} />
      )}
      <Text style={[styles.text, { color: palette.fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 1,
    borderRadius: oneui.radius.pill,
    paddingHorizontal: space.md - 2,
    paddingVertical: space.xs + 1,
    alignSelf: 'flex-start',
  },
  compact: { paddingHorizontal: space.sm + 1, paddingVertical: 2 },
  text: {
    ...type.caption,
    fontFamily: type.captionMedium.fontFamily,
    fontSize: 13,
    lineHeight: 16,
  },
});

import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { isDemoMode } from '../config/demo';
import { colors, radius, space, type } from '../theme/tokens';

/*
 * What the service said about the last thing you did.
 *
 * The care-profile screens put every answer here -- the profile saved, the
 * edit refused, the record "not found" -- and leave it on screen until the
 * next action replaces it. A refusal that flashes and vanishes is one nobody
 * can read out loud, and one a reviewer cannot point at.
 *
 * ── Two levels of detail ──
 *
 * Normally the banner says what happened in the service's own words, and
 * nothing more: a family member has no use for "403".
 *
 * In demo mode (app.json → extra.demoMode) it also prints the HTTP status and
 * the service's error code, e.g. "403 READ_ONLY_ACCESS", above the message,
 * verbatim. That is the line a reviewer compares with the audit trail.
 *
 * ── Colour by kind of answer ──
 *
 *   2xx             green  it worked
 *   401, 429        amber  try again: sign in again, or slow down
 *   403, 404, 4xx   red    refused, or not yours to see
 *   5xx, no answer  grey   the service could not decide
 *
 * The colour is never the only signal: each tone has its own icon, and the
 * words are always there.
 */

const TONES = {
  success: { bg: colors.successBg, fg: colors.success, icon: 'checkmark-circle' },
  warning: { bg: colors.warningBg, fg: colors.warning, icon: 'time' },
  error: { bg: colors.dangerBg, fg: colors.danger, icon: 'close-circle' },
  neutral: { bg: colors.disabledBg, fg: colors.ink, icon: 'cloud-offline' },
};

export function toneFor(status) {
  if (!status) return 'neutral';
  if (status >= 200 && status < 300) return 'success';
  if (status === 401 || status === 429) return 'warning';
  if (status >= 500) return 'neutral';
  return 'error';
}

/** A success, for the banner: `ok(201, 'Profile created.')`. */
export const ok = (status, message) => ({ status, message });

/**
 * A failure, for the banner. Takes whatever was thrown: an ApiError carries the
 * service's status, code and message; anything else is "no answer".
 */
export function failed(err) {
  return {
    status: err?.status ?? null,
    code: err?.code ?? null,
    message: err?.message || 'Something went wrong. Please try again.',
  };
}

/** The status line demo mode prints: "403 READ_ONLY_ACCESS", "404", "NETWORK". */
export function statusLine({ status, code }) {
  return [status, code].filter(Boolean).join(' ') || 'No response';
}

/**
 * `quietSuccess`: outside demo mode, say nothing when a plain read worked. A
 * green "Loaded" over a list that has just appeared tells nobody anything; in
 * demo mode it is the 200 a reviewer is waiting to see.
 */
export default function ResponseBanner({ result, quietSuccess = false, style }) {
  if (!result) return null;
  const demo = isDemoMode();
  if (quietSuccess && !demo && toneFor(result.status) === 'success') return null;
  const { bg, fg, icon } = TONES[toneFor(result.status)];
  const line = statusLine(result);
  const failure = toneFor(result.status) !== 'success';

  return (
    <View
      style={[styles.wrap, { backgroundColor: bg }, style]}
      accessible
      accessibilityRole={failure ? 'alert' : 'summary'}
      accessibilityLiveRegion={failure ? 'assertive' : 'polite'}
      accessibilityLabel={demo ? `${line}. ${result.message}` : result.message}
      testID="response-banner"
    >
      <Ionicons name={icon} size={18} color={fg} style={styles.icon} />
      <View style={styles.body}>
        {demo ? <Text style={[styles.status, { color: fg }]}>{line}</Text> : null}
        <Text style={[styles.text, { color: fg }]} selectable>{result.message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    borderRadius: radius.md,
    padding: space.lg,
  },
  icon: { marginTop: 1 },
  body: { flex: 1, gap: 2 },
  status: { ...type.captionMedium, letterSpacing: 0.4 },
  text: { ...type.caption },
});

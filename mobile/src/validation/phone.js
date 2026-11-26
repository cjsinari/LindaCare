import { z } from 'zod';

/*
 * Phone normalisation, mirroring auth-service/src/utils/phone.js.
 *
 * The service normalises whatever it is sent, so this is not what makes the
 * number correct -- it is what lets the form say "that is not a phone number"
 * before spending a round trip to be told so. The two implementations have to
 * agree, or the app rejects numbers the service would have taken.
 *
 * The app's input is split into a dial-code chip and a local-number field,
 * which the service knows nothing about: it receives one joined string.
 */

/** Strip the spaces, hyphens and brackets people type into phone fields. */
export function cleanDigits(input) {
  return String(input || '').replace(/[\s\-()]/g, '');
}

/**
 * Join the dial code and the local part into one E.164 string.
 *
 * A local part is allowed to keep its national leading zero -- "0712 345 678"
 * is how every Kenyan writes their own number, and dropping it here rather
 * than refusing it is the difference between a form that works and a form
 * that is technically right.
 */
export function toE164(dialCode, localNumber) {
  const local = cleanDigits(localNumber).replace(/^0+/, '');
  const code = cleanDigits(dialCode);
  return `${code.startsWith('+') ? code : `+${code}`}${local}`;
}

/** The service's final check, applied here so the form can fail first. */
export function isValidE164(value) {
  return /^\+[1-9]\d{7,14}$/.test(value);
}

/**
 * A Kenyan mobile number, which is the only kind a caregiver can have.
 *
 * Safaricom, Airtel and Telkom mobile prefixes all sit in 7xx and 1xx after
 * the country code, so nine digits beginning 7 or 1. A landline would pass
 * isValidE164 and then never receive the SMS the whole flow depends on, so it
 * is worth catching here rather than at the OTP step.
 */
export function isKenyanMobile(localNumber) {
  return /^[71]\d{8}$/.test(cleanDigits(localNumber).replace(/^0+/, ''));
}

/** "712345678" -> "712 345 678", for display while typing. */
export function formatLocal(localNumber) {
  const d = cleanDigits(localNumber).replace(/^0+/, '').slice(0, 12);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

/**
 * One typed string to E.164, mirroring normalisePhone in
 * auth-service/src/utils/phone.js.
 *
 * Used where the app has a single free-text contact field rather than a dial
 * code and a local part — account recovery, where someone types whatever they
 * remember registering with.
 *
 * The rules are the service's, including the one worth knowing about: a bare
 * local number is assumed Kenyan, so `0712345678` becomes `+254712345678`,
 * while a foreign number typed without its country code cannot be resolved and
 * throws. The recovery screen says so rather than letting a family member
 * abroad fail silently.
 *
 * Returns null instead of throwing, because the caller is a validator.
 */
export function contactToE164(input) {
  // Not cleanDigits: that strips the leading "+", which is the one character
  // that distinguishes an international number from a local one.
  const raw = String(input || '').replace(/[\s\-()]/g, '');
  if (!raw) return null;

  let candidate;
  if (raw.startsWith('+')) candidate = raw;
  else if (raw.startsWith('254') && raw.length === 12) candidate = `+${raw}`;
  else if (raw.startsWith('0') && raw.length === 10) candidate = `+254${raw.slice(1)}`;
  else if (raw.length > 10) candidate = `+${raw}`;
  else return null;

  return isValidE164(candidate) ? candidate : null;
}

/**
 * A contact as it should appear on screen: enough of it to recognise, not
 * enough to write down.
 *
 * -- Why the verification screen masks a number the person just typed --
 *
 * Nothing is being withheld from them. The string comes from the previous
 * screen rather than from the service, and whoever reads it is holding the
 * phone that typed it, so this is not about what the account owner may know.
 * It is about the other person: the one standing behind them while they wait
 * for an SMS in a matatu, a queue or an office. Here the number is also the
 * M-Pesa identity, which makes a full MSISDN sitting on a screen for as long
 * as it takes to read a code worth rather more than a phone number usually is.
 *
 * It is also what the rest of the system already does. notifier.maskPhone
 * renders a number as +2547****5678 in every audit detail, in the care-team
 * listing and on the change-phone screen, and the verification screen was the
 * only place left printing one in full. The format below is deliberately that
 * same one, so the two never read as different numbers.
 *
 * The cost is real and worth stating: a mistyped digit in the masked middle no
 * longer shows up here, and is caught instead by an SMS that never arrives.
 * The dial code and the last four stay visible because those are what somebody
 * checks when they suspect they typed the wrong number altogether.
 */
export function maskContact(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.includes('@') ? maskEmail(raw) : maskPhone(raw);
}

/** +254712345678 -> +2547****5678, matching notifier.maskPhone in the service. */
function maskPhone(phone) {
  if (phone.length < 8) return phone;
  return `${phone.slice(0, 5)}${'*'.repeat(Math.max(phone.length - 9, 2))}${phone.slice(-4)}`;
}

/**
 * cyril@example.com -> cy***@example.com.
 *
 * The domain stays whole. It is the half that tells someone which inbox to go
 * and open, and recovery is exactly the moment when they are least sure which
 * address they used -- hiding it would withhold the one part they need.
 *
 * A single-character local part cannot be masked without disappearing, so it
 * is left as it is rather than printed as a row of stars attached to nothing.
 */
function maskEmail(email) {
  const at = email.lastIndexOf('@');
  if (at < 1) return email;
  const local = email.slice(0, at);
  const keep = local.slice(0, Math.min(2, local.length - 1)) || local.slice(0, 1);
  // A fixed run of stars, not one per hidden character: the length of an
  // address is not information this screen needs to give away, and it keeps a
  // long address from wrapping the subtitle onto a third line.
  return `${keep}***${email.slice(at)}`;
}

/**
 * The phone number as a form field, built from the dial code in force.
 *
 * Shared by registration and sign-in so the two cannot drift: a number the
 * registration form accepted must be one the sign-in form accepts, or someone
 * ends up with an account they cannot sign in to.
 *
 * ── Why this takes the dial code as an argument ──
 *
 * The obvious shape is an object-level `superRefine` that reads both halves of
 * the number. It is also wrong, and quietly: Zod skips a schema-level
 * refinement whenever any *field* in the object failed. So a form with a
 * landline number and an unticked consent box would report only the consent
 * box. The person ticks it, submits again, and only then finds out about the
 * number -- errors revealed one round trip at a time, on the one field where a
 * wrong value sends the verification code to a stranger.
 *
 * Building the field from the current dial code instead keeps the whole check
 * at field level, where it runs no matter what else on the form is wrong.
 */
export function phoneField(dialCode) {
  return z.string().superRefine((value, ctx) => {
    const local = cleanDigits(value);
    if (!local) {
      ctx.addIssue({ code: 'custom', message: 'Enter your phone number' });
      return;
    }
    // A +254 number has to be a mobile: a landline passes every generic check
    // and then never receives the SMS the entire flow depends on.
    if (dialCode === '+254' && !isKenyanMobile(local)) {
      ctx.addIssue({ code: 'custom', message: 'Enter a Kenyan mobile number, e.g. 0712 345 678' });
      return;
    }
    if (!isValidE164(toE164(dialCode, local))) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid phone number' });
    }
  });
}

/**
 * The six-digit code, matching the service's `otpField`.
 *
 * Length is checked before content so that a half-typed code says "enter the
 * 6-digit code" rather than accusing the person of typing something that is
 * not a number.
 */
export const otpField = z.string().superRefine((value, ctx) => {
  const digits = cleanDigits(value);
  if (!digits) {
    ctx.addIssue({ code: 'custom', message: 'Enter the code we sent you' });
    return;
  }
  if (!/^\d+$/.test(digits)) {
    ctx.addIssue({ code: 'custom', message: 'The code is 6 digits' });
    return;
  }
  if (digits.length !== 6) {
    ctx.addIssue({ code: 'custom', message: 'The code is 6 digits' });
  }
});

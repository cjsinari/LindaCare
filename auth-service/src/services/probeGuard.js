const crypto = require('crypto');
const redis = require('../config/redis');
const { logEvent } = require('../utils/audit');

/*
 * OTP requests that get the generic "if this number is registered" answer
 * without a code being issued: unknown number, unverified account, locked
 * account, number already registered.
 *
 * Why this exists
 * ---------------
 * utils/otp.js limits a KNOWN account to 3 codes per 15 minutes, but that check
 * lives inside issueOtp(), which these requests never reach. So an unknown
 * number was (a) never limited beyond the per-IP authLimiter, (b) never audited,
 * and (c) distinguishable from a real account: a real number answers 429 on the
 * fourth request, an unknown one answers 200 forever. That difference is an
 * enumeration oracle, and it is the opposite of what the generic message is for.
 *
 * This applies the same budget to the silent paths, so both kinds of number
 * behave identically from outside, and records what happened.
 *
 * Keys hold a keyed hash of the number and of the IP, never the values.
 * Failing open if Redis is down matches services/velocity.js: an outage in the
 * counter must not stop a real caregiver signing in.
 */

const WINDOW_SECONDS = 15 * 60;                                   // same window as otp.js
const MAX_PER_NUMBER = Number(process.env.OTP_MAX_REQUESTS) || 3; // same budget as otp.js
const SWEEP_DISTINCT = Number(process.env.OTP_SWEEP_DISTINCT) || 5;

const tag = (value) => crypto
  .createHmac('sha256', process.env.OTP_SECRET || 'dev-only')
  .update(String(value))
  .digest('hex')
  .slice(0, 16);

const masked = (phone) => `${String(phone).slice(0, 4)}****${String(phone).slice(-3)}`;

async function once(key) {
  try { return (await redis.set(key, '1', 'EX', WINDOW_SECONDS, 'NX')) === 'OK'; }
  catch { return false; }
}

/**
 * Record one silent OTP request. Returns { limited, perNumber, distinctNumbers }.
 * `limited` means the caller should answer exactly as it does for a real
 * account over budget (429 OTP_RATE_LIMITED).
 */
async function silentRequest({ phone, ip, reason }) {
  const now = Date.now();
  const cutoff = now - WINDOW_SECONDS * 1000;
  const numKey = `otpprobe:n:${tag(phone)}`;
  const ipKey = `otpprobe:ip:${tag(ip || 'unknown')}`;

  let perNumber;
  let distinctNumbers;
  try {
    const res = await redis.multi()
      .zadd(numKey, now, `${now}:${Math.random().toString(36).slice(2, 8)}`)
      .zremrangebyscore(numKey, 0, cutoff)
      .zcard(numKey)
      .expire(numKey, WINDOW_SECONDS)
      // member = the number's tag, so the set size is DISTINCT numbers from this IP
      .zadd(ipKey, now, tag(phone))
      .zremrangebyscore(ipKey, 0, cutoff)
      .zcard(ipKey)
      .expire(ipKey, WINDOW_SECONDS)
      .exec();
    const failed = res.find(([e]) => e);
    if (failed) throw failed[0];
    perNumber = Number(res[2][1]) || 1;
    distinctNumbers = Number(res[6][1]) || 1;
  } catch (err) {
    console.error('Probe guard unavailable (failing open):', err.message);
    return { limited: false, perNumber: 0, distinctNumbers: 0 };
  }

  const limited = perNumber > MAX_PER_NUMBER;
  const base = { ip, actorType: 'automated', resourceType: 'otp', action: 'request' };

  // Audit sparingly: one row per number per window, one when it is throttled,
  // one per IP per window for a sweep. An unauthenticated caller must not be
  // able to fill audit_logs by repeating a request.
  if (perNumber === 1) {
    logEvent({ ...base, eventType: 'otp_unknown_contact', severity: 'info', decision: 'allow',
      detail: { reason, number: masked(phone) },
      explanation: `An OTP was requested for ${masked(phone)}, which has no account able to receive one (${reason.replace(/_/g, ' ')}). No code was sent and the caller was given the generic response.` });
  }
  if (perNumber === MAX_PER_NUMBER + 1) {
    logEvent({ ...base, eventType: 'otp_probe_throttled', severity: 'medium', decision: 'deny',
      detail: { reason, number: masked(phone), requests: perNumber },
      explanation: `${perNumber} OTP requests for ${masked(phone)} inside 15 minutes, with no code issued. Further requests are refused the same way as for a registered number.` });
  }
  if (distinctNumbers >= SWEEP_DISTINCT && await once(`otpprobe:sweep:${tag(ip || 'unknown')}`)) {
    logEvent({ ...base, eventType: 'otp_enumeration_sweep', severity: 'high', decision: 'deny',
      detail: { distinctNumbers, windowMinutes: WINDOW_SECONDS / 60 },
      explanation: `One address requested OTPs for ${distinctNumbers} different numbers with no account behind them in 15 minutes, which looks like a sweep for registered numbers.` });
  }

  return { limited, perNumber, distinctNumbers };
}

/*
 * The lockout a number gets when it exhausts a decoy code.
 *
 * A real account that submits five wrong codes is locked for LOCK_MINUTES, and
 * every request in that window answers 423 with the seconds remaining. A
 * number with no account has no users row to lock, and its decoy is burned on
 * the fifth attempt, so without this the sixth attempt would answer
 * OTP_INVALID where a real account answers ACCOUNT_LOCKED. Same information,
 * one step further along.
 *
 * Redis rather than a table because this is the one piece of state here that
 * belongs to a number rather than to an account, and it expires on its own.
 * Failing open matches the rest of this file: a Redis outage must not invent a
 * lockout for somebody who is simply signing in.
 */
async function lockPhone(phone, minutes) {
  try { await redis.set(`otpprobe:lock:${tag(phone)}`, '1', 'EX', minutes * 60); }
  catch (err) { console.error('Probe guard could not record a lockout:', err.message); }
}

/** Seconds left on that lockout, or 0 if there is none. */
async function lockedSeconds(phone) {
  try {
    const ttl = await redis.ttl(`otpprobe:lock:${tag(phone)}`);
    return ttl > 0 ? ttl : 0;
  } catch { return 0; }
}

module.exports = { silentRequest, lockPhone, lockedSeconds, MAX_PER_NUMBER, SWEEP_DISTINCT };
import Constants from 'expo-constants';

/*
 * Demo mode: app.json → expo.extra.demoMode (default false).
 *
 * When it is on, the care-profile screens show every action to every role and
 * print each response's HTTP status and error code. That is for showing, live,
 * that the service refuses what the interface would normally never offer --
 * a caregiver's Edit, a caregiver's New profile, a pasted id that is not
 * theirs.
 *
 * It changes what is drawn and nothing else. Every refusal still comes from
 * the service: hiding a button is usability, and showing it changes nothing
 * about what the service will answer.
 */
export function isDemoMode() {
  return Constants.expoConfig?.extra?.demoMode === true;
}

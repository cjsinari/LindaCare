/*
 * Dynamic Expo config. app.json stays the source of truth; this file only layers
 * on the values that differ between a laptop and a deployed build, taken from the
 * environment at build time:
 *
 *   API_URL          https://<domain>/api   (the deployed auth service)
 *   DEMO_MODE        "true" | "false"       (overrides extra.demoMode)
 *   EAS_PROJECT_ID   the id `eas init` prints, needed for Expo push tokens
 *
 * With none of them set (npm start on a laptop) the result is exactly app.json.
 */
module.exports = ({ config }) => {
  const apiUrl = (process.env.API_URL || '').trim().replace(/\/$/, '');
  const demo = process.env.DEMO_MODE;

  // A cloud build exists to produce an installable app. One that still points at
  // a LAN address, or at the placeholder in eas.json, would install fine and
  // then time out on every request, so refuse to build it.
  if (process.env.EAS_BUILD === 'true') {
    if (!/^https:\/\//.test(apiUrl) || apiUrl.includes('REPLACE_WITH_DOMAIN')) {
      throw new Error(
        `API_URL must be the deployed HTTPS address (got "${apiUrl || 'nothing'}"). ` +
        'Edit the env block of the profile in mobile/eas.json.',
      );
    }
  }

  return {
    ...config,
    extra: {
      ...config.extra,
      ...(apiUrl ? { apiBaseUrl: apiUrl } : {}),
      ...(demo !== undefined ? { demoMode: demo === 'true' } : {}),
      ...(process.env.EAS_PROJECT_ID
        ? { eas: { ...(config.extra && config.extra.eas), projectId: process.env.EAS_PROJECT_ID } }
        : {}),
    },
  };
};

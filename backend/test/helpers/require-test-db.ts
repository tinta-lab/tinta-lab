// Hard stop before any e2e suite boots the app: these suites create and
// delete real users/servers/tickets. They are meant to run only via
// `npm run test:e2e` (DB_NAME=tinta_lab_test), but nothing enforced it —
// a direct `npx jest --config test/jest-e2e.json` silently used the
// production database from .env. That left orphan audit events from
// deleted test servers in production on 2026-09-16/17 (append-only, hash
// chained, so they can't be removed afterwards).
if (process.env.DB_NAME !== 'tinta_lab_test') {
  throw new Error(
    `Refusing to run e2e tests against DB_NAME=${process.env.DB_NAME ?? '(unset → .env, i.e. production)'}. ` +
      'Use `npm run test:e2e`, which sets DB_NAME=tinta_lab_test.',
  );
}

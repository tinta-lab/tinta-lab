// Pure unit tests for the helper itself — no HTTP, no DB, no Nest app. Named
// `.e2e-spec.ts` (not `.spec.ts`) purely so it runs under `npm run test:e2e`
// (test/jest-e2e.json matches `.e2e-spec.ts$` with rootDir "."); the unit
// jest config in package.json is scoped to `rootDir: "src"` and would never
// see a file under test/helpers. A helper this security-critical needs its
// own correctness tests before anything relies on it — see the assistant
// message that introduced this file for why (P1.3 security baseline).
import {
  assertNoForbiddenKeys,
  assertNoKey,
  CLIENT_FORBIDDEN_KEYS,
} from './assert-no-forbidden-keys';

describe('assertNoForbiddenKeys', () => {
  it('accepts a clean object', () => {
    expect(() =>
      assertNoForbiddenKeys({ id: '1', name: 'ok' }, ['tunnelToken']),
    ).not.toThrow();
  });

  it('rejects a top-level forbidden key', () => {
    expect(() =>
      assertNoForbiddenKeys({ tunnelToken: 'abc' }, ['tunnelToken']),
    ).toThrow(/tunnelToken/);
  });

  it('rejects a nested forbidden key', () => {
    expect(() =>
      assertNoForbiddenKeys(
        { server: { name: 'ok', tunnelToken: 'abc' } },
        ['tunnelToken'],
      ),
    ).toThrow(/tunnelToken/);
  });

  it('rejects a forbidden key inside an array', () => {
    expect(() =>
      assertNoForbiddenKeys(
        [{ id: '1' }, { id: '2', server: { supportPassword: 'x' } }],
        ['supportPassword'],
      ),
    ).toThrow(/supportPassword/);
  });

  it('rejects a forbidden property even when its value is null', () => {
    expect(() =>
      assertNoForbiddenKeys({ server: { supportPassword: null } }, [
        'supportPassword',
      ]),
    ).toThrow(/supportPassword/);
  });

  it('reports the complete property path for every violation', () => {
    try {
      assertNoForbiddenKeys(
        [{ ticket: { server: { supportPassword: 'x' } } }],
        ['supportPassword'],
        'response',
      );
      throw new Error('expected assertNoForbiddenKeys to throw');
    } catch (err) {
      expect((err as Error).message).toContain(
        'response[0].ticket.server.supportPassword',
      );
    }
  });

  it('reports every violation, not just the first', () => {
    try {
      assertNoForbiddenKeys(
        { tunnelToken: 'a', server: { tunnelToken: 'b' } },
        ['tunnelToken'],
      );
      throw new Error('expected assertNoForbiddenKeys to throw');
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain('response.tunnelToken');
      expect(message).toContain('response.server.tunnelToken');
    }
  });

  it('accepts similarly-named but distinct safe fields', () => {
    expect(() =>
      assertNoForbiddenKeys({ tunnelTokenStatus: 'configured' }, [
        'tunnelToken',
      ]),
    ).not.toThrow();
  });

  it('ignores primitives, null and undefined at the root', () => {
    expect(() => assertNoForbiddenKeys(null, ['tunnelToken'])).not.toThrow();
    expect(() => assertNoForbiddenKeys(undefined, ['tunnelToken'])).not.toThrow();
    expect(() => assertNoForbiddenKeys('a string', ['tunnelToken'])).not.toThrow();
  });
});

describe('assertNoKey', () => {
  it('rejects a single forbidden key anywhere in the tree', () => {
    expect(() =>
      assertNoKey({ server: { supportPassword: 'x' } }, 'supportPassword'),
    ).toThrow(/supportPassword/);
  });

  it('accepts an object without that key', () => {
    expect(() => assertNoKey({ id: '1' }, 'supportPassword')).not.toThrow();
  });
});

describe('CLIENT_FORBIDDEN_KEYS', () => {
  it('includes the fields known to have leaked in production', () => {
    expect(CLIENT_FORBIDDEN_KEYS).toEqual(
      expect.arrayContaining([
        'tunnelToken',
        'cfAccessAppId',
        'cfDnsRecordId',
        'supportPassword',
        'internalNotes',
      ]),
    );
  });
});

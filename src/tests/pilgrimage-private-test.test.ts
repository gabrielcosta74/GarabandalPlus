import { describe, expect, it } from 'vitest';

import {
  getPrivatePilgrimageTestUserId,
  isPrivatePilgrimageTest,
} from '../lib/pilgrimage-private-test';

describe('private FACT.pt pilgrimage fixtures', () => {
  it('recognizes an allowlisted account holder UUID', () => {
    const pilgrimage = {
      pricing_config: {
        private_test_user_id: '5E6A018D-09A3-4242-B171-942BA832DF61',
      },
    };

    expect(getPrivatePilgrimageTestUserId(pilgrimage)).toBe(
      '5e6a018d-09a3-4242-b171-942ba832df61',
    );
    expect(isPrivatePilgrimageTest(pilgrimage)).toBe(true);
  });

  it('does not treat missing or invalid markers as private fixtures', () => {
    expect(isPrivatePilgrimageTest({ pricing_config: null })).toBe(false);
    expect(
      isPrivatePilgrimageTest({
        pricing_config: { private_test_user_id: 'not-a-user-id' },
      }),
    ).toBe(false);
  });
});

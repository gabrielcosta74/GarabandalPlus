type PrivateTestConfig = {
  private_test_user_id?: unknown;
};

export type PrivateTestPilgrimage = {
  pricing_config?: PrivateTestConfig | null;
};

export const getPrivatePilgrimageTestUserId = (
  pilgrimage: PrivateTestPilgrimage | null | undefined,
): string | null => {
  const value = pilgrimage?.pricing_config?.private_test_user_id;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
    normalized,
  )
    ? normalized
    : null;
};

export const isPrivatePilgrimageTest = (
  pilgrimage: PrivateTestPilgrimage | null | undefined,
) => getPrivatePilgrimageTestUserId(pilgrimage) !== null;

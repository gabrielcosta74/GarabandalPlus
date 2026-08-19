import UpdatePasswordFlow from '../../../../components/auth/UpdatePasswordFlow';
import { parseRecoveryPageState, type RecoveryQueryValue } from '../../../../lib/recovery-flow';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Set a new password',
  robots: { index: false, follow: false },
};

export default async function EnglishUpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, RecoveryQueryValue>>;
}) {
  const initialState = parseRecoveryPageState(await searchParams);
  return <UpdatePasswordFlow locale="en" {...initialState} />;
}

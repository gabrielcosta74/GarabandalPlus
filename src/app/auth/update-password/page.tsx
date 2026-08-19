import UpdatePasswordFlow from '../../../components/auth/UpdatePasswordFlow';
import { parseRecoveryPageState, type RecoveryQueryValue } from '../../../lib/recovery-flow';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Definir nova password',
  robots: { index: false, follow: false },
};

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, RecoveryQueryValue>>;
}) {
  const initialState = parseRecoveryPageState(await searchParams);
  return <UpdatePasswordFlow locale="pt" {...initialState} />;
}

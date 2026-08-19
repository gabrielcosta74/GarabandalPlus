import ForgotPasswordFlow from '../../../components/auth/ForgotPasswordFlow';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Recuperar acesso',
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordFlow locale="pt" />;
}

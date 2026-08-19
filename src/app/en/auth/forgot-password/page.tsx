import ForgotPasswordFlow from '../../../../components/auth/ForgotPasswordFlow';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Recover access',
  robots: { index: false, follow: false },
};

export default function EnglishForgotPasswordPage() {
  return <ForgotPasswordFlow locale="en" />;
}

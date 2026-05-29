import type { Metadata } from 'next';
import MemberActivityTracker from '../../../components/member/MemberActivityTracker';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function EnMemberLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MemberActivityTracker />
      {children}
    </>
  );
}

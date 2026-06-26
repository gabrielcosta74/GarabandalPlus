import type { Metadata } from 'next';
import MemberActivityTracker from '../../components/member/MemberActivityTracker';
import VolunteerSurvey from '../../components/member/VolunteerSurvey';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MemberActivityTracker />
      {children}
      <VolunteerSurvey />
    </>
  );
}

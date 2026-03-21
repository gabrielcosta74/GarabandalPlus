import { Metadata } from 'next';
import MembershipClient from '../../tornar-membro/MembershipClient';
import { APP_URL } from '../../../lib/config';

export const metadata: Metadata = {
  title: 'Become a Member',
  description: 'Join the Garabandal Apostolate. Support the mission, receive exclusive content and participate in the community.',
  alternates: {
    canonical: `${APP_URL}/en/become-member`,
  },
};

export default function EnBecomeMemberPage() {
  return <MembershipClient />;
}

'use client';

import { useAuth } from '../../contexts/AuthContext';
import { QuotaWarning } from '../membership/QuotaWarning';

/** Keep the auth-dependent warning in a small client island. */
export default function HomeQuotaWarning() {
  const { memberData } = useAuth();

  return (
    <QuotaWarning
      memberData={memberData}
      className="container mx-auto mt-24 mb-4 lg:mt-28"
    />
  );
}

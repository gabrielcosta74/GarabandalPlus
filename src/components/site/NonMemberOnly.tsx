"use client";

import { ReactNode, useEffect, useState } from "react";
import { supabaseBrowser } from "../../lib/supabase-browser";
import { isActiveMember } from "../../lib/store-discounts";

type Props = {
  children: ReactNode;
};

export default function NonMemberOnly({ children }: Props) {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkMembership = async () => {
      try {
        if (!supabaseBrowser) {
          setShow(true);
          setLoading(false);
          return;
        }

        const { data: { session } } = await supabaseBrowser.auth.getSession();

        if (!session?.user?.id) {
          if (mounted) {
            setShow(true);
            setLoading(false);
          }
          return;
        }

        const { data: memberData } = await supabaseBrowser
          .from('membros')
          .select('is_membro, proxima_quota, estado_quota')
          .eq('id', session.user.id)
          .maybeSingle();

        if (mounted) {
          setShow(!isActiveMember(memberData));
          setLoading(false);
        }
      } catch (error) {
        console.error('NonMemberOnly check error:', error);
        if (mounted) {
          setShow(true);
          setLoading(false);
        }
      }
    };

    checkMembership();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return null;
  if (!show) return null;
  return <>{children}</>;
}

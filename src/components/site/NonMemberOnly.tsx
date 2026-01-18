"use client";

import { ReactNode, useEffect, useState } from "react";
import { supabaseBrowser } from "../../lib/supabase-browser";
import { isActiveMember } from "../../lib/store-discounts";

type Props = {
  children: ReactNode;
};

export default function NonMemberOnly({ children }: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkMember = async () => {
      if (!supabaseBrowser) {
        if (mounted) setShow(true);
        return;
      }
      const { data } = await supabaseBrowser.auth.getSession();
      const userId = data.session?.user?.id;
      if (!userId) {
        if (mounted) setShow(true);
        return;
      }
      const { data: member } = await supabaseBrowser
        .from("membros")
        .select("is_membro, estado_quota, tipo_subscricao")
        .eq("id", userId)
        .maybeSingle();
      if (mounted) setShow(!isActiveMember(member));
    };

    checkMember();
    const { data: listener } =
      supabaseBrowser?.auth.onAuthStateChange(() => {
        checkMember();
      }) ?? { data: { subscription: { unsubscribe() {} } } };

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (!show) return null;
  return <>{children}</>;
}

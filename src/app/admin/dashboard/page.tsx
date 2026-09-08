"use client";

import { useState } from "react";
import useSWR from "swr";
import AdminShell from "../AdminShell";
import { supabaseBrowser } from "../../../lib/supabase-browser";
import DashboardView, {
  DashboardRefresh,
} from "../../../components/admin/dashboard/DashboardView";
import {
  civilDay,
  shiftDay,
  type FinanceData,
  type OperationsData,
} from "../../../lib/admin-dashboard/model";

async function fetcher(url: string) {
  const {
    data: { session },
  } = await supabaseBrowser.auth.getSession();
  if (!session) throw new Error("A sessão expirou. Inicie sessão novamente.");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403)
      throw new Error("A sessão expirou ou não tem acesso a estes dados.");
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || "Não foi possível carregar os dados.");
  }
  return response.json();
}
export default function AdminDashboardPage() {
  const [range, setRange] = useState("30");
  const [custom, setCustom] = useState(() => ({
    from: shiftDay(civilDay(new Date()), -29),
    to: civilDay(new Date()),
  }));
  const params = new URLSearchParams({ range });
  if (range === "custom") {
    params.set("from", custom.from);
    params.set("to", custom.to);
  }
  const options = {
    refreshInterval: 60000,
    revalidateOnFocus: true,
    refreshWhenHidden: false,
    shouldRetryOnError: false,
  };
  const operations = useSWR<OperationsData>(
    "/api/admin/dashboard/operations",
    fetcher,
    options,
  );
  // Never display the previous range under a newly selected range while it is loading.
  const finance = useSWR<FinanceData>(
    `/api/admin/dashboard?${params}`,
    fetcher,
    options,
  );
  const refreshing = operations.isValidating || finance.isValidating;
  const refresh = () => {
    void Promise.allSettled([operations.mutate(), finance.mutate()]);
  };
  return (
    <AdminShell
      title="Visão geral"
      description="Prioridades, peregrinações e atividade do apostolado."
      showBackLink={false}
      toolbar={<DashboardRefresh refreshing={refreshing} onRefresh={refresh} />}
    >
      <DashboardView
        operations={operations.data}
        finance={finance.data}
        operationsError={operations.error?.message}
        financeError={finance.error?.message}
        refreshing={refreshing}
        onRefresh={refresh}
        range={range}
        onRange={setRange}
        customFrom={custom.from}
        customTo={custom.to}
        onCustom={(from, to) => setCustom({ from, to })}
      />
    </AdminShell>
  );
}

import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase";
import { verifyAdmin } from "../../../../lib/admin-auth";
import { resolvePeriod } from "../../../../lib/admin-dashboard/model";
import { loadFinance } from "../../../../lib/admin-dashboard/finance";

export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const { authorized, error } = await verifyAdmin(req);
  if (!authorized)
    return NextResponse.json(
      { error: error || "Unauthorized" },
      { status: error === "Forbidden: Not an Admin" ? 403 : 401 },
    );
  if (!supabaseServer)
    return NextResponse.json(
      { error: "Serviço indisponível." },
      { status: 503 },
    );
  let period;
  try {
    period = resolvePeriod(new URL(req.url).searchParams);
  } catch {
    return NextResponse.json(
      { error: "Escolha um período válido de até 366 dias." },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(await loadFinance(supabaseServer, period), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Dashboard finance failed", error);
    return NextResponse.json(
      {
        error:
          "Não foi possível carregar o resumo financeiro. Tente novamente.",
      },
      { status: 503 },
    );
  }
}

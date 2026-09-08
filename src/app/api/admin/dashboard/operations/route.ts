import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase";
import { verifyAdmin } from "../../../../../lib/admin-auth";
import { loadOperations } from "../../../../../lib/admin-dashboard/operations";

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
  try {
    return NextResponse.json(await loadOperations(supabaseServer), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Dashboard operations failed", error);
    return NextResponse.json(
      { error: "Não foi possível carregar a situação atual." },
      { status: 503 },
    );
  }
}

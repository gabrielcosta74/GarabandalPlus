import type { SupabaseClient } from "@supabase/supabase-js";

// Explicit ranges avoid silently reporting only the first PostgREST page.
export async function allRows<T>(
  query: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const result = await query(from, from + pageSize - 1);
    if (result.error) throw new Error(result.error.message);
    if (!Array.isArray(result.data))
      throw new Error("Resposta de dados inválida.");
    rows.push(...(result.data as T[]));
    if (result.data.length < pageSize) return rows;
    if (rows.length >= 100000)
      throw new Error(
        "Demasiados registos para este período. Escolha um intervalo menor.",
      );
  }
}
export type DashboardDatabase = SupabaseClient;

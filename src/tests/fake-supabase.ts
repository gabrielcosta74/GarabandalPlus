import type { SupabaseClient } from '@supabase/supabase-js';

type Row = Record<string, unknown>;

/** Só o que os envios usam do cliente Supabase, em memória. */
export function fakeSupabase(tables: Record<string, Row[]>, rpc: Record<string, (args: Row) => unknown>) {
  let nextId = 1;
  const from = (name: string) => {
    const rows = (tables[name] ??= []);
    const filters: ((row: Row) => boolean)[] = [];
    let action: 'select' | 'insert' | 'update' | 'delete' = 'select';
    let payload: Row[] = [];
    let order: { key: string; ascending: boolean } | null = null;
    let max = Infinity;
    const cmp = (a: unknown, b: unknown) => (String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0);
    const run = (): Row[] => {
      if (action === 'insert') {
        const added = payload.map((row) => ({ id: `id-${nextId++}`, ...row }));
        rows.push(...added);
        return added;
      }
      let found = rows.filter((row) => filters.every((filter) => filter(row)));
      if (action === 'update') found.forEach((row) => Object.assign(row, payload[0]));
      if (action === 'delete') found.forEach((row) => rows.splice(rows.indexOf(row), 1));
      if (order) { const o = order; found = [...found].sort((a, b) => cmp(a[o.key], b[o.key]) * (o.ascending ? 1 : -1)); }
      return found.slice(0, max);
    };
    const where = (filter: (row: Row) => boolean) => { filters.push(filter); return query; };
    const query = {
      select: () => query,
      insert: (value: Row | Row[]) => { action = 'insert'; payload = ([] as Row[]).concat(value); return query; },
      upsert: (value: Row | Row[]) => { action = 'insert'; payload = ([] as Row[]).concat(value); return query; },
      update: (value: Row) => { action = 'update'; payload = [value]; return query; },
      delete: () => { action = 'delete'; return query; },
      eq: (key: string, value: unknown) => where((row) => row[key] === value),
      neq: (key: string, value: unknown) => where((row) => row[key] !== value),
      in: (key: string, values: unknown[]) => where((row) => values.includes(row[key])),
      gt: (key: string, value: unknown) => where((row) => cmp(row[key], value) > 0),
      gte: (key: string, value: unknown) => where((row) => cmp(row[key], value) >= 0),
      lt: (key: string, value: unknown) => where((row) => cmp(row[key], value) < 0),
      lte: (key: string, value: unknown) => where((row) => cmp(row[key], value) <= 0),
      is: (key: string, value: unknown) => where((row) => (row[key] ?? null) === value),
      not: (key: string, _op: string, value: unknown) => where((row) => (row[key] ?? null) !== value),
      or: (text: string) => where((row) => text.split(',').some((part) => {
        const [key, , value] = part.split('.');
        return row[key] === value;
      })),
      order: (key: string, options?: { ascending?: boolean }) => { order = { key, ascending: options?.ascending !== false }; return query; },
      limit: (value: number) => { max = value; return query; },
      maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
      single: async () => ({ data: run()[0] ?? null, error: null }),
      then: (resolve: (value: { data: Row[]; error: null }) => unknown) => Promise.resolve({ data: run(), error: null }).then(resolve),
    };
    return query;
  };
  const client = {
    from,
    rpc: async (name: string, args: Row) => ({ data: rpc[name]?.(args) ?? null, error: null }),
  };
  return client as unknown as SupabaseClient;
}

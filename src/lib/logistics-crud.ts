import { NextResponse } from 'next/server';

import { verifyAdmin } from './admin-auth';
import { supabaseServer } from './supabase';

/**
 * Rotas CRUD da área de Logística.
 *
 * As quatro tabelas (custos, estadias, quartos, lugares) têm exactamente a
 * mesma forma de escrita, por isso partilham este construtor: lista branca de
 * campos, filtro obrigatório por `pilgrimage_id` e guarda de admin.
 */

export type CrudConfig = {
    table: string;
    /** Só estes campos chegam à base de dados. */
    fields: string[];
    /** Validações por campo; devolver false rejeita a linha inteira. */
    validate?: Record<string, (value: unknown) => boolean>;
    /** Campos obrigatórios ao criar. */
    requiredOnCreate?: string[];
};

const guard = async (req: Request) => {
    const { authorized, error } = await verifyAdmin(req);
    if (!authorized) return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
    if (!supabaseServer) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    return null;
};

export function makeLogisticsCrud(config: CrudConfig) {
    const allowed = new Set(config.fields);

    const pick = (body: any) => {
        const out: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(body || {})) {
            if (!allowed.has(key)) continue;
            const check = config.validate?.[key];
            if (check && !check(value)) continue;
            out[key] = value === '' ? null : value;
        }
        return out;
    };

    return {
        async POST(req: Request, { params }: { params: Promise<{ pilgrimageId: string }> }) {
            const denied = await guard(req);
            if (denied) return denied;

            const { pilgrimageId } = await params;
            const values = pick(await req.json().catch(() => ({})));

            for (const field of config.requiredOnCreate || []) {
                if (values[field] === undefined || values[field] === null) {
                    return NextResponse.json({ error: `Falta o campo obrigatório: ${field}` }, { status: 400 });
                }
            }

            const { data, error } = await supabaseServer!
                .from(config.table)
                .insert({ ...values, pilgrimage_id: pilgrimageId })
                .select()
                .single();

            if (error) return NextResponse.json({ error: error.message }, { status: 400 });
            return NextResponse.json(data);
        },

        async PATCH(req: Request, { params }: { params: Promise<{ pilgrimageId: string }> }) {
            const denied = await guard(req);
            if (denied) return denied;

            const { pilgrimageId } = await params;
            const body = await req.json().catch(() => ({}));
            const id = String(body?.id || '');
            if (!id) return NextResponse.json({ error: 'Falta o id.' }, { status: 400 });

            const values = pick(body);
            if (Object.keys(values).length === 0) {
                return NextResponse.json({ error: 'Nada para actualizar.' }, { status: 400 });
            }

            // O filtro por pilgrimage_id impede editar linhas de outra peregrinação.
            const { data, error } = await supabaseServer!
                .from(config.table)
                .update(values)
                .eq('id', id)
                .eq('pilgrimage_id', pilgrimageId)
                .select()
                .single();

            if (error) return NextResponse.json({ error: error.message }, { status: 400 });
            return NextResponse.json(data);
        },

        async DELETE(req: Request, { params }: { params: Promise<{ pilgrimageId: string }> }) {
            const denied = await guard(req);
            if (denied) return denied;

            const { pilgrimageId } = await params;
            const id = new URL(req.url).searchParams.get('id');
            if (!id) return NextResponse.json({ error: 'Falta o id.' }, { status: 400 });

            const { error } = await supabaseServer!
                .from(config.table)
                .delete()
                .eq('id', id)
                .eq('pilgrimage_id', pilgrimageId);

            if (error) return NextResponse.json({ error: error.message }, { status: 400 });
            return NextResponse.json({ ok: true });
        },
    };
}

export const STATUSES = new Set(['idea', 'requested', 'prebooked', 'confirmed', 'paid']);
export const isStatus = (v: unknown) => STATUSES.has(String(v));
export { guard as guardAdmin };

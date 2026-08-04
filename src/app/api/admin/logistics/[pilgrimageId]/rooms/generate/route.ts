import { NextResponse } from 'next/server';

import { guardAdmin } from '../../../../../../../lib/logistics-crud';
import { supabaseServer } from '../../../../../../../lib/supabase';

/**
 * Gera a planta de quartos a partir das inscrições.
 *
 *   POST { replace?: boolean }
 *
 * Regras, por ordem de prioridade:
 *   1. Quem partilha a mesma reserva fica junto (casais e famílias inscrevem-se
 *      numa reserva só).
 *   2. `roommate_name` aponta para outra pessoa — junta as duas.
 *   3. O resto é emparelhado dentro da mesma tipologia.
 *
 * `bed_preference` decide entre duplo de casal e twin. Nunca junta pessoas que
 * pediram tipologias diferentes.
 */
export const dynamic = 'force-dynamic';

type Person = {
    id: string;
    booking_id: string;
    full_name: string;
    room_type: string | null;
    bed_preference: string | null;
    roommate_name: string | null;
};

const CAPACITY: Record<string, number> = {
    single: 1, double_bed: 2, twin: 2, triple: 3, family: 4,
};

const LABEL: Record<string, string> = {
    single: 'Individual', double_bed: 'Duplo casal', twin: 'Duplo twin',
    triple: 'Triplo', family: 'Familiar',
};

const normalize = (v: string) =>
    v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

/** Palavras que não distinguem ninguém. */
const STOP = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'del', 'la', 'van', 'von']);

const tokensOf = (name: string) =>
    normalize(name).split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOP.has(w));

/**
 * Os nomes escritos à mão raramente batem certo com os da inscrição
 * ("Maria da Graça Teixeira" vs "Maria das Graças Teixeira Chaves", ou
 * "Victor" vs "Vitor"). Contamos palavras em comum, aceitando plurais e o
 * troca-troca de c/ç, em vez de exigir igualdade.
 */
const stem = (w: string) => w.replace(/(s|es)$/, '').replace(/c/g, 'k');

const nameScore = (a: string, b: string) => {
    const left = new Set(tokensOf(a).map(stem));
    const right = tokensOf(b).map(stem);
    let hits = 0;
    for (const token of right) if (left.has(token)) hits += 1;
    return hits;
};

/** A tipologia da planta para o que a pessoa pediu na inscrição. */
const planTypeOf = (person: Person): string => {
    const requested = person.room_type || 'double';
    if (requested === 'single') return 'single';
    if (requested === 'triple') return 'triple';
    if (requested === 'quadruple' || requested === 'family') return 'family';
    return person.bed_preference === 'twin_beds' ? 'twin' : 'double_bed';
};

export async function POST(
    req: Request,
    { params }: { params: Promise<{ pilgrimageId: string }> },
) {
    const denied = await guardAdmin(req);
    if (denied) return denied;

    const { pilgrimageId } = await params;
    const { replace = false } = await req.json().catch(() => ({}));

    const { data: existing } = await supabaseServer!
        .from('pilgrimage_rooms')
        .select('id')
        .eq('pilgrimage_id', pilgrimageId);

    if ((existing?.length || 0) > 0) {
        if (!replace) {
            return NextResponse.json(
                { error: 'A planta já tem quartos. Envie replace: true para a refazer.' },
                { status: 409 },
            );
        }
        await supabaseServer!.from('pilgrimage_rooms').delete().eq('pilgrimage_id', pilgrimageId);
    }

    // --- Quem há para alojar ------------------------------------------------
    const { data: bookings } = await supabaseServer!
        .from('bookings').select('id').eq('pilgrimage_id', pilgrimageId).neq('status', 'cancelled');
    const bookingIds = (bookings || []).map((b: any) => b.id);

    const { data: pilgrims } = bookingIds.length
        ? await supabaseServer!
            .from('pilgrims')
            .select('id,booking_id,full_name,room_type,bed_preference,roommate_name')
            .in('booking_id', bookingIds)
        : { data: [] as Person[] };

    const { data: seats } = await supabaseServer!
        .from('pilgrimage_seats')
        .select('id,full_name,room_type')
        .eq('pilgrimage_id', pilgrimageId);

    const people: Person[] = (pilgrims || []) as Person[];

    // --- Agrupar ------------------------------------------------------------
    // Um grupo é um conjunto de pessoas que têm de ficar no mesmo quarto.
    const groupOf = new Map<string, string>();      // pessoa -> id do grupo
    const groups = new Map<string, Person[]>();     // id do grupo -> pessoas

    const join = (person: Person, key: string) => {
        groupOf.set(person.id, key);
        groups.set(key, [...(groups.get(key) || []), person]);
    };

    // 1. Mesma reserva com mais de uma pessoa = viajam juntos.
    const byBooking = new Map<string, Person[]>();
    for (const p of people) byBooking.set(p.booking_id, [...(byBooking.get(p.booking_id) || []), p]);

    for (const [bookingId, members] of byBooking) {
        if (members.length > 1) for (const m of members) join(m, `booking:${bookingId}`);
    }

    // 2. `roommate_name` a apontar para quem também está inscrito. O campo pode
    //    trazer mais do que um nome ("Cynthia Londo, June Olson").
    for (const p of people) {
        if (groupOf.has(p.id) || !p.roommate_name) continue;

        const wanted = p.roommate_name.split(/[,;]|\se\s/).map(s => s.trim()).filter(Boolean);
        const type = planTypeOf(p);
        const capacity = CAPACITY[type] ?? 2;

        for (const raw of wanted) {
            const key = groupOf.get(p.id) || `mate:${p.id}`;
            if ((groups.get(key)?.length || 0) >= capacity) break;

            // Melhor candidato: mais palavras em comum, e pelo menos duas.
            let best: Person | null = null;
            let bestScore = 1;
            for (const other of people) {
                if (other.id === p.id || groupOf.has(other.id)) continue;
                if (planTypeOf(other) !== type) continue;
                const score = nameScore(other.full_name, raw);
                if (score > bestScore) { best = other; bestScore = score; }
            }
            if (!best) continue;

            if (!groupOf.has(p.id)) join(p, key);
            join(best, key);
        }
    }

    // 3. Sozinhos.
    for (const p of people) if (!groupOf.has(p.id)) join(p, `solo:${p.id}`);

    // --- Distribuir por quartos --------------------------------------------
    type Draft = { type: string; members: { pilgrimId?: string; seatId?: string }[] };
    const drafts: Draft[] = [];

    const grouped = [...groups.entries()].map(([key, members]) => ({ key, members }));
    // Grupos maiores primeiro: é mais fácil encaixar quem sobra depois.
    grouped.sort((a, b) => b.members.length - a.members.length);

    const openByType = new Map<string, Draft>();

    for (const { members } of grouped) {
        const type = planTypeOf(members[0]);
        const capacity = CAPACITY[type] ?? 2;

        if (members.length >= capacity || type === 'single') {
            // Grupo enche (ou transborda) um quarto: fica sozinho no seu.
            for (let i = 0; i < members.length; i += capacity) {
                drafts.push({
                    type,
                    members: members.slice(i, i + capacity).map(m => ({ pilgrimId: m.id })),
                });
            }
            continue;
        }

        // Grupo pequeno: tenta completar um quarto já aberto da mesma tipologia.
        const open = openByType.get(type);
        if (open && open.members.length + members.length <= capacity) {
            open.members.push(...members.map(m => ({ pilgrimId: m.id })));
            if (open.members.length === capacity) openByType.delete(type);
            continue;
        }

        const draft: Draft = { type, members: members.map(m => ({ pilgrimId: m.id })) };
        drafts.push(draft);
        if (draft.members.length < capacity) openByType.set(type, draft);
    }

    // Lugares especiais: cada um no seu quarto, na tipologia que tiverem.
    for (const seat of seats || []) {
        const type = seat.room_type === 'single' ? 'single' : 'double_bed';
        drafts.push({ type, members: [{ seatId: seat.id }] });
    }

    // --- Gravar -------------------------------------------------------------
    const order = ['double_bed', 'twin', 'triple', 'family', 'single'];
    drafts.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));

    const counters: Record<string, number> = {};
    const rows = drafts.map((draft, index) => {
        counters[draft.type] = (counters[draft.type] || 0) + 1;
        return {
            pilgrimage_id: pilgrimageId,
            label: `${LABEL[draft.type] || draft.type} ${counters[draft.type]}`,
            room_type: draft.type,
            capacity: CAPACITY[draft.type] ?? 2,
            display_order: index + 1,
        };
    });

    if (rows.length === 0) return NextResponse.json({ rooms: 0, placed: 0 });

    const { data: created, error } = await supabaseServer!
        .from('pilgrimage_rooms')
        .insert(rows)
        .select('id,display_order');
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const roomIdByOrder = new Map((created || []).map((r: any) => [r.display_order, r.id]));
    const members = drafts.flatMap((draft, index) =>
        draft.members.map((m, position) => ({
            room_id: roomIdByOrder.get(index + 1),
            pilgrim_id: m.pilgrimId ?? null,
            seat_id: m.seatId ?? null,
            position,
        })),
    ).filter(m => m.room_id);

    const { error: memberError } = await supabaseServer!
        .from('pilgrimage_room_members')
        .insert(members);
    if (memberError) return NextResponse.json({ error: memberError.message }, { status: 400 });

    return NextResponse.json({ rooms: rows.length, placed: members.length });
}

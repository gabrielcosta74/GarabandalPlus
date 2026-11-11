import { linesSummary, type HotelInstallment, type HotelLine } from './logistics/hotel-rules';

/**
 * Contas e cobranças de uma peregrinação, lidas da base de dados.
 *
 * Substitui os números do Excel por `bookings`, `pilgrims` e
 * `pilgrimage_payments`. Leitura apenas — esta camada nunca escreve.
 *
 * Regra do dinheiro: só conta como recebido o que tem um pagamento
 * `verified`. `bookings.paid_amount` é mantido em linha com isso pelo próprio
 * sistema de pagamentos, mas somamos os pagamentos para não depender disso.
 */

export type LogisticsSeatKind = 'pilgrim' | 'courtesy' | 'held';

export type LogisticsPerson = {
    id: string;
    bookingId: string | null;
    name: string;
    email: string | null;
    country: string | null;
    roomType: string | null;
    kind: LogisticsSeatKind;
    totalAmount: number;
    paidAmount: number;
    /** Pagamentos submetidos mas ainda por aprovar. Não contam como recebidos. */
    pendingAmount: number;
    bookingStatus: string | null;
    dietary: string | null;
    notes: string | null;
    /** Só para lugares guardados. */
    holdUntil?: string | null;
    /** Só para cortesias. */
    role?: string | null;
};

export type LogisticsAccounts = {
    pilgrimage: {
        id: string;
        title: string;
        status: string | null;
        totalVacancies: number;
        currentVacancies: number;
        basePrice: number;
        depositValue: number;
        singleSupplement: number;
        startDate: string | null;
        endDate: string | null;
    };
    people: LogisticsPerson[];
    revenue: {
        bookings: number;
        paying: number;
        courtesy: number;
        held: number;
        /** Camas ocupadas = pagantes + cortesias + guardados. */
        beds: number;
        expected: number;
        received: number;
        outstanding: number;
        /** Submetido, à espera de aprovação. */
        awaitingValidation: number;
        settled: number;
        nothingPaid: number;
        avgTicket: number;
        /** Quanto entra se os lugares guardados confirmarem. */
        heldValue: number;
    };
    /** Distribuição real de tipologias — alimenta o orçamento dos hotéis. */
    roomMix: {
        shared: number;
        single: number;
        byType: Record<string, number>;
    };
    stays: HotelStayRow[];
    hotels: {
        total: number;
        paid: number;
        due: number;
        freeRooms: number;
        freeValue: number;
        nights: number;
    };
    costs: CostRow[];
    /** Totais dos custos que não são hotel. Os voos ficam de fora do saldo. */
    services: { total: number; paid: number; due: number };
    /** Despesa por rubrica, já com os hotéis. É a única fonte para o saldo. */
    expenses: {
        hotels: number;
        restaurants: number;
        transport: number;
        museum: number;
        other: number;
        total: number;
        paid: number;
        due: number;
    };
    /** Receita menos despesa. Calculado no servidor para não divergir entre ecrãs. */
    balance: { revenue: number; expense: number; result: number; margin: number; perPax: number };
    rooms: RoomRow[];
    quotes: QuoteRow[];
    /** Nota de cobrança por pessoa, indexada pelo id do peregrino ou do lugar. */
    notes: Record<string, string>;
};

/** Total de uma linha de custo. `pax` a null segue o número de camas. */
export const costTotalOf = (cost: CostRow, beds: number) =>
    cost.unitPrice * (cost.pax ?? beds) - cost.discount;

export type CostRow = {
    id: string;
    kind: 'restaurant' | 'transport' | 'flight' | 'museum' | 'other';
    supplier: string;
    location: string;
    date: string | null;
    unitPrice: number;
    /** null = por pessoa, seguindo o total de camas. */
    pax: number | null;
    discount: number;
    status: string;
    paidAmount: number;
    dueDate: string | null;
    notes: string | null;
};

export type QuoteRow = {
    id: string;
    city: string;
    hotel: string;
    board: string;
    sharedPricePerPerson: number;
    singlePricePerPerson: number;
    cityTax: number;
    freePerN: number | null;
    status: 'chosen' | 'shortlist' | 'rejected';
    notes: string | null;
};

export type RoomRow = {
    id: string;
    label: string;
    roomType: string;
    capacity: number;
    notes: string | null;
    /** ids de `pilgrims` ou de `pilgrimage_seats`, na ordem em que foram postos. */
    memberIds: string[];
};

export type HotelStayRow = {
    id: string;
    hotel: string;
    city: string;
    checkIn: string;
    checkOut: string;
    board: string;
    status: string;
    sharedPricePerNight: number;
    singleSupplementPerNight: number;
    /** null = seguir a distribuição real das inscrições. */
    paxShared: number | null;
    paxSingle: number | null;
    cityTaxPerPersonNight: number;
    freePerN: number;
    paidAmount: number;
    dueDate: string | null;
    notes: string | null;
    /**
     * Acordo (proforma) da Contabilidade ligado a esta estadia. Quando existe,
     * o total é o da proforma e o pago vem dos movimentos do banco.
     */
    agreement: StayAgreement | null;
    /** Linhas da proforma, escritas pelo admin. Vazio = ainda só a fórmula. */
    lines: HotelLine[];
    /** Plano de pagamentos ao hotel. O estado de cada uma vem do pago. */
    installments: HotelInstallment[];
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    optionUntil: string | null;
    roomingListDue: string | null;
};

export type StayAgreement = {
    id: string;
    supplier: string;
    total: number;
    hasProforma: boolean;
    hasFinalInvoice: boolean;
};

export const eur = (v: number) =>
    new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(v);

export const eur0 = (v: number) =>
    new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

export const BOARD_OPTIONS = ['Só dormida', 'Pequeno-almoço', 'Meia pensão', 'Pensão completa'];

export type LogisticsStatus = 'idea' | 'requested' | 'prebooked' | 'confirmed' | 'paid';

/** Estados de reserva de fornecedor. Uma definição para hotéis e serviços. */
export const STATUS_LABEL: Record<LogisticsStatus, string> = {
    idea: 'A pensar',
    requested: 'Pedida',
    prebooked: 'Pré-reserva',
    confirmed: 'Confirmada',
    paid: 'Paga',
};

const isMissingTable = (error: { code?: string; message?: string }) =>
    error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message || '');

const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

const SHARED_TYPES = new Set(['double', 'twin', 'double_bed', 'triple', 'quadruple', 'family']);

const mapStay = (row: any): HotelStayRow => ({
    id: row.id,
    hotel: row.hotel || '',
    city: row.city || '',
    checkIn: row.check_in,
    checkOut: row.check_out,
    board: row.board || '',
    status: row.status || 'idea',
    sharedPricePerNight: num(row.shared_price_per_night),
    singleSupplementPerNight: num(row.single_supplement_per_night),
    paxShared: row.pax_shared === null || row.pax_shared === undefined ? null : Number(row.pax_shared),
    paxSingle: row.pax_single === null || row.pax_single === undefined ? null : Number(row.pax_single),
    cityTaxPerPersonNight: num(row.city_tax_per_person_night),
    freePerN: Number(row.free_per_n || 0),
    paidAmount: num(row.paid_amount),
    dueDate: row.due_date || null,
    notes: row.notes || null,
    agreement: null,
    lines: [],
    installments: [],
    contactName: row.contact_name || null,
    contactEmail: row.contact_email || null,
    contactPhone: row.contact_phone || null,
    optionUntil: row.option_until || null,
    roomingListDue: row.rooming_list_due || null,
});

export const nightsBetween = (checkIn: string, checkOut: string) => {
    const a = new Date(`${checkIn}T00:00:00`).getTime();
    const b = new Date(`${checkOut}T00:00:00`).getTime();
    return Math.max(0, Math.round((b - a) / 86_400_000));
};

/**
 * Custo de uma estadia.
 *
 * Por ordem de confiança:
 *   1. acordo na Contabilidade: o total da proforma (o que se transfere);
 *   2. linhas escritas pelo admin a partir da proforma;
 *   3. a fórmula (preço por pessoa × inscrições), só como estimativa.
 * O que se paga no hotel (linhas `payOnSite`) soma-se ao custo mas fica fora
 * do que se transfere.
 */
export function stayCostOf(stay: HotelStayRow, mix: { shared: number; single: number }) {
    const nights = nightsBetween(stay.checkIn, stay.checkOut);
    const shared = stay.paxShared ?? mix.shared;
    const single = stay.paxSingle ?? mix.single;
    const pax = shared + single;
    const accommodation =
        (shared * stay.sharedPricePerNight
            + single * (stay.sharedPricePerNight + stay.singleSupplementPerNight)) * nights;
    const cityTax = stay.cityTaxPerPersonNight * pax * nights;
    const freeRooms = stay.freePerN > 0 ? Math.floor(pax / stay.freePerN) : 0;
    const freeValue = freeRooms * stay.sharedPricePerNight * nights;
    const estimate = accommodation + cityTax - freeValue;

    const lines = stay.lines ?? [];
    const fromLines = lines.length > 0;
    const summary = linesSummary(lines);
    const fromProforma = !!stay.agreement;
    const transferTotal = stay.agreement ? stay.agreement.total : fromLines ? summary.transfer : estimate;
    const onSite = fromLines ? summary.onSite : 0;
    const total = transferTotal + onSite;
    return {
        nights, pax, accommodation, cityTax, freeRooms, freeValue,
        estimate, fromProforma, fromLines,
        linesTransfer: fromLines ? summary.transfer : null,
        transferTotal, onSite, total,
        due: total - stay.paidAmount,
    };
}

const hotelTotals = (rows: HotelStayRow[], shared: number, single: number) => {
    const mix = { shared, single };
    return rows.reduce(
        (acc, row) => {
            const c = stayCostOf(row, mix);
            return {
                total: acc.total + c.total,
                paid: acc.paid + row.paidAmount,
                due: acc.due + c.due,
                freeRooms: acc.freeRooms + c.freeRooms,
                freeValue: acc.freeValue + c.freeValue,
                nights: acc.nights + c.nights,
            };
        },
        { total: 0, paid: 0, due: 0, freeRooms: 0, freeValue: 0, nights: 0 },
    );
};

export async function getPilgrimageAccounts(
    supabase: any,
    pilgrimageId: string,
): Promise<LogisticsAccounts> {
    // Duas rondas em paralelo em vez de catorze consultas seguidas: o ecrã dos
    // hotéis recarrega isto depois de cada gravação.
    const none = { data: [], error: null };
    const [
        { data: pilgrimage, error: pErr },
        { data: bookings, error: bErr },
        { data: seats, error: sErr },
        { data: stays, error: stErr },
        { data: costRows, error: cErr },
        { data: roomRows, error: rErr },
        { data: agreementRows, error: aErr },
        { data: quoteRows, error: qErr },
        { data: noteRows, error: nErr },
    ] = await Promise.all([
        supabase.from('pilgrimages')
            .select('id,title,status,total_vacancies,current_vacancies,base_price,deposit_value,pricing_config,start_date,end_date')
            .eq('id', pilgrimageId).single(),
        supabase.from('bookings')
            .select('id,status,total_amount,paid_amount,notes,created_at')
            .eq('pilgrimage_id', pilgrimageId).neq('status', 'cancelled'),
        supabase.from('pilgrimage_seats')
            .select('id,kind,full_name,role,room_type,amount_due,hold_until,hold_reason,notes')
            .eq('pilgrimage_id', pilgrimageId).order('display_order'),
        supabase.from('pilgrimage_hotel_stays')
            .select('*').eq('pilgrimage_id', pilgrimageId).order('check_in').order('display_order'),
        supabase.from('pilgrimage_costs')
            .select('*').eq('pilgrimage_id', pilgrimageId).order('kind').order('display_order'),
        supabase.from('pilgrimage_rooms')
            .select('id,label,room_type,capacity,notes,display_order,pilgrimage_room_members(pilgrim_id,seat_id,position)')
            .eq('pilgrimage_id', pilgrimageId).order('display_order'),
        // Acordos da Contabilidade. Antes da migração dos acordos a tabela não
        // existe: a logística continua a funcionar só com a fórmula.
        supabase.from('supplier_agreements')
            .select('id,hotel_stay_id,supplier,total_amount')
            .eq('pilgrimage_id', pilgrimageId).eq('status', 'open').not('hotel_stay_id', 'is', null),
        supabase.from('pilgrimage_hotel_quotes')
            .select('*').eq('pilgrimage_id', pilgrimageId).order('city').order('display_order'),
        supabase.from('pilgrimage_collection_notes')
            .select('pilgrim_id,seat_id,note').eq('pilgrimage_id', pilgrimageId),
    ]);
    if (pErr) throw pErr;
    if (bErr) throw bErr;
    if (sErr) throw sErr;
    if (stErr) throw stErr;
    if (cErr) throw cErr;
    if (rErr) throw rErr;
    if (aErr && !isMissingTable(aErr)) throw aErr;
    if (qErr) throw qErr;
    if (nErr) throw nErr;

    const bookingIds = (bookings || []).map((b: any) => b.id);
    const agreementIds = (aErr ? [] : agreementRows || []).map((a: { id: string }) => a.id);
    const stayIds = (stays || []).map((row: { id: string }) => row.id);

    // Linhas e prestações: antes da migração as tabelas não existem, e os
    // hotéis continuam com a fórmula e sem plano.
    const [
        { data: pilgrims, error: piErr },
        { data: payments, error: payErr },
        { data: agreementDocs, error: adErr },
        { data: lineRows, error: lErr },
        { data: installmentRows, error: iErr },
    ] = await Promise.all([
        bookingIds.length
            ? supabase.from('pilgrims')
                .select('id,booking_id,full_name,email,country,room_type,dietary_restrictions,allergies,notes')
                .in('booking_id', bookingIds)
            : none,
        bookingIds.length
            ? supabase.from('pilgrimage_payments').select('booking_id,amount,status,deleted').in('booking_id', bookingIds)
            : none,
        agreementIds.length
            ? supabase.from('expense_documents').select('agreement_id,doc_kind').in('agreement_id', agreementIds)
            : none,
        stayIds.length ? supabase.from('pilgrimage_hotel_lines').select('*').in('stay_id', stayIds).order('display_order') : none,
        stayIds.length ? supabase.from('pilgrimage_hotel_installments').select('*').in('stay_id', stayIds).order('due_date') : none,
    ]);
    if (piErr) throw piErr;
    if (payErr) throw payErr;
    if (adErr && !isMissingTable(adErr)) throw adErr;
    if (lErr && !isMissingTable(lErr)) throw lErr;
    if (iErr && !isMissingTable(iErr)) throw iErr;

    const docKinds = new Map<string, Set<string>>();
    for (const doc of (adErr ? [] : agreementDocs || []) as { agreement_id: string; doc_kind: string }[]) {
        const set = docKinds.get(doc.agreement_id) || new Set<string>();
        set.add(doc.doc_kind);
        docKinds.set(doc.agreement_id, set);
    }

    const linesByStay = new Map<string, HotelLine[]>();
    for (const row of (lErr ? [] : lineRows || []) as Record<string, unknown>[]) {
        const list = linesByStay.get(String(row.stay_id)) || [];
        list.push({
            id: String(row.id),
            kind: (['room', 'supplement', 'discount', 'tax', 'other'].includes(String(row.kind)) ? row.kind : 'other') as HotelLine['kind'],
            label: String(row.label || ''),
            qty: num(row.qty),
            nights: num(row.nights),
            unitPrice: num(row.unit_price),
            payOnSite: !!row.pay_on_site,
            notes: (row.notes as string) || null,
        });
        linesByStay.set(String(row.stay_id), list);
    }
    const installmentsByStay = new Map<string, HotelInstallment[]>();
    for (const row of (iErr ? [] : installmentRows || []) as Record<string, unknown>[]) {
        const list = installmentsByStay.get(String(row.stay_id)) || [];
        list.push({
            id: String(row.id),
            label: String(row.label || ''),
            dueDate: String(row.due_date),
            amount: num(row.amount),
            notes: (row.notes as string) || null,
        });
        installmentsByStay.set(String(row.stay_id), list);
    }

    // --- Pagamentos por reserva -------------------------------------------
    const verifiedBy = new Map<string, number>();
    const pendingBy = new Map<string, number>();
    for (const p of payments || []) {
        if (p.deleted) continue;
        const target = p.status === 'verified' ? verifiedBy : ['verifying', 'pending'].includes(p.status) ? pendingBy : null;
        if (!target) continue; // `failed` e afins não contam
        target.set(p.booking_id, (target.get(p.booking_id) || 0) + num(p.amount));
    }

    const bookingById = new Map((bookings || []).map((b: any) => [b.id, b]));

    // --- Pessoas -----------------------------------------------------------
    // O valor da reserva é repartido pelas pessoas que ela cobre, para que uma
    // reserva de família apareça como várias linhas com o valor certo cada uma.
    const paxPerBooking = new Map<string, number>();
    for (const p of pilgrims || []) {
        paxPerBooking.set(p.booking_id, (paxPerBooking.get(p.booking_id) || 0) + 1);
    }

    const people: LogisticsPerson[] = (pilgrims || []).map((p: any) => {
        const booking: any = bookingById.get(p.booking_id);
        const share = Math.max(1, paxPerBooking.get(p.booking_id) || 1);
        const dietary = [p.dietary_restrictions, p.allergies].filter(Boolean).join(' · ') || null;
        return {
            id: p.id,
            bookingId: p.booking_id,
            name: String(p.full_name || '').trim() || 'Sem nome',
            email: p.email || null,
            country: p.country || null,
            roomType: p.room_type || null,
            kind: 'pilgrim' as const,
            totalAmount: num(booking?.total_amount) / share,
            paidAmount: (verifiedBy.get(p.booking_id) || 0) / share,
            pendingAmount: (pendingBy.get(p.booking_id) || 0) / share,
            bookingStatus: booking?.status || null,
            dietary,
            notes: p.notes || booking?.notes || null,
        };
    });

    for (const seat of seats || []) {
        people.push({
            id: seat.id,
            bookingId: null,
            name: seat.full_name,
            email: null,
            country: null,
            roomType: seat.room_type || null,
            kind: seat.kind as LogisticsSeatKind,
            totalAmount: num(seat.amount_due),
            paidAmount: 0,
            pendingAmount: 0,
            bookingStatus: null,
            dietary: null,
            notes: seat.notes || null,
            holdUntil: seat.hold_until || null,
            role: seat.role || null,
        });
    }

    // --- Agregados ---------------------------------------------------------
    const paying = people.filter((p) => p.kind === 'pilgrim');
    const courtesy = people.filter((p) => p.kind === 'courtesy');
    const held = people.filter((p) => p.kind === 'held');

    const expected = (bookings || []).reduce((a: number, b: any) => a + num(b.total_amount), 0);
    const heldValue = people.filter((p) => p.kind === 'held').reduce((a, p) => a + p.totalAmount, 0);
    const received = Array.from(verifiedBy.values()).reduce((a, v) => a + v, 0);
    const awaitingValidation = Array.from(pendingBy.values()).reduce((a, v) => a + v, 0);

    const byType: Record<string, number> = {};
    let shared = 0;
    let single = 0;
    for (const person of [...paying, ...courtesy, ...held]) {
        const type = person.roomType || '(por definir)';
        byType[type] = (byType[type] || 0) + 1;
        if (type === 'single') single += 1;
        else if (SHARED_TYPES.has(type)) shared += 1;
    }

    const beds = paying.length + courtesy.length + held.length;
    const agreementByStay = new Map<string, StayAgreement>(
        ((aErr ? [] : agreementRows || []) as { id: string; hotel_stay_id: string; supplier: string | null; total_amount: number | string }[]).map(a => [
            String(a.hotel_stay_id),
            {
                id: a.id, supplier: a.supplier || '', total: num(a.total_amount),
                hasProforma: !!docKinds.get(a.id)?.has('proforma'),
                hasFinalInvoice: !!(docKinds.get(a.id)?.has('fatura') || docKinds.get(a.id)?.has('recibo')),
            },
        ]),
    );
    const mappedStays = (stays || []).map(mapStay).map((stay: HotelStayRow) => ({
        ...stay,
        agreement: agreementByStay.get(stay.id) ?? null,
        lines: linesByStay.get(stay.id) ?? [],
        installments: installmentsByStay.get(stay.id) ?? [],
    }));
    const costs: CostRow[] = (costRows || []).map((c: any) => ({
        id: c.id,
        kind: c.kind,
        supplier: c.supplier || '',
        location: c.location || '',
        date: c.cost_date || null,
        unitPrice: num(c.unit_price),
        pax: c.pax === null || c.pax === undefined ? null : Number(c.pax),
        discount: num(c.discount),
        status: c.status || 'idea',
        paidAmount: num(c.paid_amount),
        dueDate: c.due_date || null,
        notes: c.notes || null,
    }));

    // Despesa por rubrica. Os voos ficam de fora: o bilhete é comprado por cada
    // peregrino e nunca passa pela conta da organização.
    const hotelSummary = hotelTotals(mappedStays, shared, single);
    const sumKind = (kind: string) =>
        costs.filter((c) => c.kind === kind).reduce((a, c) => a + costTotalOf(c, beds), 0);

    const billable = costs.filter((c) => c.kind !== 'flight');
    const expenses = {
        hotels: hotelSummary.total,
        restaurants: sumKind('restaurant'),
        transport: sumKind('transport'),
        museum: sumKind('museum'),
        other: sumKind('other'),
        total: hotelSummary.total + billable.reduce((a, c) => a + costTotalOf(c, beds), 0),
        paid: hotelSummary.paid + billable.reduce((a, c) => a + c.paidAmount, 0),
        due: hotelSummary.due + billable.reduce((a, c) => a + (costTotalOf(c, beds) - c.paidAmount), 0),
    };

    const config = pilgrimage.pricing_config || {};

    return {
        pilgrimage: {
            id: pilgrimage.id,
            title: pilgrimage.title,
            status: pilgrimage.status,
            totalVacancies: num(pilgrimage.total_vacancies),
            currentVacancies: num(pilgrimage.current_vacancies),
            basePrice: num(pilgrimage.base_price),
            depositValue: num(pilgrimage.deposit_value),
            singleSupplement: num(config?.room_supplements?.single),
            startDate: pilgrimage.start_date || null,
            endDate: pilgrimage.end_date || null,
        },
        people,
        revenue: {
            bookings: (bookings || []).length,
            paying: paying.length,
            courtesy: courtesy.length,
            held: held.length,
            beds,
            expected,
            received,
            outstanding: expected - received,
            awaitingValidation,
            settled: (bookings || []).filter((b: any) => (verifiedBy.get(b.id) || 0) >= num(b.total_amount) - 0.05).length,
            nothingPaid: (bookings || []).filter((b: any) => (verifiedBy.get(b.id) || 0) <= 0.005).length,
            avgTicket: paying.length ? expected / paying.length : 0,
            heldValue,
        },
        roomMix: { shared, single, byType },
        stays: mappedStays,
        hotels: hotelSummary,
        costs,
        services: costs
            .filter((c) => c.kind !== 'flight')
            .reduce(
                (acc, c) => {
                    const total = costTotalOf(c, beds);
                    return {
                        total: acc.total + total,
                        paid: acc.paid + c.paidAmount,
                        due: acc.due + (total - c.paidAmount),
                    };
                },
                { total: 0, paid: 0, due: 0 },
            ),
        expenses,
        balance: {
            revenue: expected,
            expense: expenses.total,
            result: expected - expenses.total,
            margin: expected > 0 ? ((expected - expenses.total) / expected) * 100 : 0,
            perPax: beds > 0 ? expenses.total / beds : 0,
        },
        quotes: (quoteRows || []).map((q: any) => ({
            id: q.id,
            city: q.city || '',
            hotel: q.hotel || '',
            board: q.board || '',
            sharedPricePerPerson: num(q.shared_price_per_person),
            singlePricePerPerson: num(q.single_price_per_person),
            cityTax: num(q.city_tax),
            freePerN: q.free_per_n === null || q.free_per_n === undefined ? null : Number(q.free_per_n),
            status: q.status,
            notes: q.notes || null,
        })),
        rooms: (roomRows || []).map((r: any) => ({
            id: r.id,
            label: r.label || '',
            roomType: r.room_type || 'double_bed',
            capacity: Number(r.capacity || 2),
            notes: r.notes || null,
            memberIds: (r.pilgrimage_room_members || [])
                .slice()
                .sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
                .map((m: any) => m.pilgrim_id || m.seat_id)
                .filter(Boolean),
        })),
        notes: Object.fromEntries(
            (noteRows || [])
                .map((n: any) => [n.pilgrim_id || n.seat_id, n.note])
                .filter(([key]: any[]) => Boolean(key)),
        ),
    };
}

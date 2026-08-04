import { makeLogisticsCrud, isStatus } from '../../../../../../lib/logistics-crud';

/** Restaurantes, transporte, voos, museus e extras de uma peregrinação. */
export const dynamic = 'force-dynamic';

const crud = makeLogisticsCrud({
    table: 'pilgrimage_costs',
    fields: [
        'kind', 'supplier', 'location', 'cost_date', 'unit_price', 'pax',
        'discount', 'status', 'paid_amount', 'due_date', 'notes', 'display_order',
    ],
    validate: {
        status: isStatus,
        kind: (v) => ['restaurant', 'transport', 'flight', 'museum', 'other'].includes(String(v)),
    },
    requiredOnCreate: ['kind'],
});

export const POST = crud.POST;
export const PATCH = crud.PATCH;
export const DELETE = crud.DELETE;

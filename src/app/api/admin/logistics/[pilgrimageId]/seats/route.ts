import { makeLogisticsCrud } from '../../../../../../lib/logistics-crud';

/** Cortesias (padre, motorista, organização) e lugares guardados. */
export const dynamic = 'force-dynamic';

const crud = makeLogisticsCrud({
    table: 'pilgrimage_seats',
    fields: [
        'kind', 'full_name', 'role', 'room_type', 'amount_due',
        'hold_until', 'hold_reason', 'notes', 'display_order',
    ],
    validate: {
        kind: (v) => ['courtesy', 'held'].includes(String(v)),
    },
    requiredOnCreate: ['kind', 'full_name'],
});

export const POST = crud.POST;
export const PATCH = crud.PATCH;
export const DELETE = crud.DELETE;

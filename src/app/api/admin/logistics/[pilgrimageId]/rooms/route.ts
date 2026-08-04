import { makeLogisticsCrud } from '../../../../../../lib/logistics-crud';

/** Planta de quartos. Os ocupantes vivem em /rooms/members. */
export const dynamic = 'force-dynamic';

const crud = makeLogisticsCrud({
    table: 'pilgrimage_rooms',
    fields: ['label', 'room_type', 'capacity', 'notes', 'display_order'],
    validate: {
        capacity: (v) => Number(v) >= 1 && Number(v) <= 8,
    },
    requiredOnCreate: ['room_type'],
});

export const POST = crud.POST;
export const PATCH = crud.PATCH;
export const DELETE = crud.DELETE;

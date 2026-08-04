import { makeLogisticsCrud } from '../../../../../../lib/logistics-crud';

/** Alternativas de hotel em estudo, por cidade. */
export const dynamic = 'force-dynamic';

const crud = makeLogisticsCrud({
    table: 'pilgrimage_hotel_quotes',
    fields: [
        'city', 'hotel', 'board', 'shared_price_per_person', 'single_price_per_person',
        'city_tax', 'free_per_n', 'status', 'notes', 'display_order',
    ],
    validate: {
        status: (v) => ['chosen', 'shortlist', 'rejected'].includes(String(v)),
    },
});

export const POST = crud.POST;
export const PATCH = crud.PATCH;
export const DELETE = crud.DELETE;

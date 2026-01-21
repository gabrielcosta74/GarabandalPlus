import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabase';
import { renderToBuffer } from '@react-pdf/renderer';
import { ItineraryTemplate } from '../../../../../lib/pdf/ItineraryTemplate';
import React from 'react';

export const runtime = 'nodejs';

export async function GET(
    request: Request,
    { params }: { params: { slug: string } }
) {
    const { slug } = params;

    if (!supabaseServer) {
        return NextResponse.json({ message: 'Supabase não configurado' }, { status: 500 });
    }

    try {
        // 1. Fetch Pilgrimage
        const { data: pilgrimage, error: pError } = await supabaseServer
            .from('pilgrimages')
            .select('*')
            .eq('slug', slug)
            .single();

        if (pError || !pilgrimage) {
            return NextResponse.json({ message: 'Peregrinação não encontrada' }, { status: 404 });
        }

        // 2. Fetch Itinerary Items
        const { data: itinerary, error: iError } = await supabaseServer
            .from('pilgrimage_itinerary_items')
            .select('*')
            .eq('pilgrimage_id', pilgrimage.id)
            .order('day_number', { ascending: true });

        if (iError) throw iError;

        // 3. Generate PDF
        // Note: react-pdf needs a bit of a hack to work in Node with TSX sometimes,
        // but renderToBuffer is the standard way.
        const pdfBuffer = await renderToBuffer(
            React.createElement(ItineraryTemplate, {
                pilgrimage,
                itinerary: itinerary || []
            })
        );

        // 4. Return Response
        return new NextResponse(pdfBuffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="roteiro-${slug}.pdf"`,
            },
        });

    } catch (err: any) {
        console.error('Erro ao gerar PDF do roteiro:', err);
        return NextResponse.json({ message: 'Erro interno ao gerar PDF' }, { status: 500 });
    }
}

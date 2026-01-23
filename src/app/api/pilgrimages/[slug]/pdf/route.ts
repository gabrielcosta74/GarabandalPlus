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
    const { searchParams } = new URL(request.url);
    const currency = searchParams.get('currency') || 'EUR';

    if (!supabaseServer) {
        return NextResponse.json({ message: 'Supabase não configurado' }, { status: 500 });
    }

    try {
        // 1. Fetch Pilgrimage
        const { data: pilgrimage, error: pError } = await supabaseServer
            .from('v_pilgrimages_with_occupancy')
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

        // 3. Handle Exchange Rate for BRL
        let exchangeRate = 1;
        if (currency === 'BRL') {
            try {
                const res = await fetch('https://api.exchangerate-api.com/v4/latest/EUR');
                const data = await res.json();
                exchangeRate = data.rates.BRL || 6.5;
            } catch (e) {
                console.warn("Failed to fetch rate for PDF:", e);
                exchangeRate = 6.5;
            }
        }

        // 4. Generate PDF
        const pdfBuffer = await renderToBuffer(
            React.createElement(ItineraryTemplate, {
                pilgrimage,
                itinerary: itinerary || [],
                currency: currency as any,
                exchangeRate
            }) as any
        );

        // 4. Return Response
        return new NextResponse(pdfBuffer as any, {
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

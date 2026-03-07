import { NextResponse } from 'next/server';
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(req: Request) {
    // Member APIs should use standard auth via SSR client to enforce RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            get(name: string) {
                return (cookies() as any).get(name)?.value;
            },
        },
    });

    try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // We can just rely on RLS, but let's be explicit just in case.
        // Also it would only return the ones where is_published = true per our policy!
        const { data, error } = await supabase
            .from('member_contents')
            .select(`
                *,
                member_gallery_images(*)
            `)
            .eq('is_published', true)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ contents: data });

    } catch (error: any) {
        console.error("Member API Error fetching contents:", error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

import type { SupabaseClient } from '@supabase/supabase-js';

/** Quem provocou o aviso: nome curto e foto pública, ou null quando não os há. */
export type PushSender = { name: string | null; avatar: string | null };

/** Só fotos públicas em https: é o telemóvel que as descarrega, sem sessão. */
export function safeAvatar(value: unknown): string | null {
    const url = typeof value === 'string' ? value.trim() : '';
    return url.startsWith('https://') && url.length <= 1000 ? url : null;
}

/**
 * `person_short_name` cai no início do email quando a conta não tem nome. Na app
 * isso é uma limitação antiga; num aviso, que aparece no ecrã bloqueado de outra
 * pessoa, não: sem nome verdadeiro, o texto diz "Alguém".
 */
export async function loadPushSender(supabase: SupabaseClient, userId: string): Promise<PushSender> {
    const [full, short, avatar] = await Promise.all([
        supabase.rpc('full_person_name', { p_user: userId }),
        supabase.rpc('person_short_name', { p_user: userId }),
        supabase.rpc('person_avatar', { p_user: userId }),
    ]);
    if (short.error) throw new Error(`Push sender name: ${short.error.message}`);
    const hasRealName = !full.error && typeof full.data === 'string' && full.data.trim() !== '';
    return {
        name: hasRealName && typeof short.data === 'string' ? short.data : null,
        // Uma foto que falte só custa o círculo, nunca o aviso.
        avatar: avatar.error ? null : safeAvatar(avatar.data),
    };
}

/**
 * Os campos que mostram a foto de quem interagiu:
 *  - iOS: a extensão da app descarrega-a (`mutableContent` + dados) e põe-na num
 *    círculo; como o sistema troca o título pelo nome, `senderBody` é o corpo a
 *    mostrar por baixo dele, sem repetir o nome;
 *  - Android: a Expo põe `richContent.image` como imagem do aviso.
 */
export function senderPhotoFields(
    platform: string | null | undefined,
    sender: { name: string; avatar: string | null; body: string } | null,
): { mutableContent?: true; richContent?: { image: string }; data: Record<string, string> } {
    const avatar = safeAvatar(sender?.avatar);
    if (!sender || !avatar) return { data: {} };
    if (platform === 'android') return { richContent: { image: avatar }, data: {} };
    return {
        mutableContent: true,
        data: { senderName: sender.name, senderAvatar: avatar, senderBody: sender.body },
    };
}

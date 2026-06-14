"use client";

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HandHeart, Send, Trash2, Loader2, MessageCircleHeart } from 'lucide-react';
import { supabaseBrowser } from '../../lib/supabase-browser';
import { useLocale } from '../../contexts/LocaleContext';

type Intention = {
    id: string;
    novena_id: string | null;
    display_name: string | null;
    intention: string;
    prayer_count: number;
    created_at: string;
    has_prayed: boolean;
    is_mine: boolean;
};

const MAX_LEN = 280;

function timeAgo(iso: string, isEn: boolean): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return isEn ? 'just now' : 'agora mesmo';
    if (mins < 60) return isEn ? `${mins}m ago` : `há ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return isEn ? `${hours}h ago` : `há ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return isEn ? `${days}d ago` : `há ${days}d`;
    return new Date(iso).toLocaleDateString(isEn ? 'en' : 'pt');
}

export default function IntentionsWall({ novenaId }: { novenaId?: string }) {
    const { locale } = useLocale();
    const isEn = locale === 'en';
    const [intentions, setIntentions] = useState<Intention[]>([]);
    const [loading, setLoading] = useState(true);
    const [text, setText] = useState('');
    const [anonymous, setAnonymous] = useState(false);
    const [posting, setPosting] = useState(false);
    const [praying, setPraying] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!supabaseBrowser) { setLoading(false); return; }
        const { data, error } = await supabaseBrowser.rpc('get_novena_intentions', { p_limit: 40 });
        if (!error && Array.isArray(data)) {
            setIntentions(data as Intention[]);
        }
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const submit = async () => {
        const trimmed = text.trim();
        if (!trimmed || posting || !supabaseBrowser) return;
        setPosting(true);
        const { error } = await supabaseBrowser.rpc('post_novena_intention', {
            p_text: trimmed,
            p_novena_id: novenaId ?? null,
            p_anonymous: anonymous,
        });
        if (!error) {
            setText('');
            setAnonymous(false);
            await load();
        }
        setPosting(false);
    };

    const pray = async (id: string) => {
        if (praying || !supabaseBrowser) return;
        const target = intentions.find(i => i.id === id);
        if (!target || target.has_prayed) return;
        setPraying(id);
        // Optimistic update
        setIntentions(prev => prev.map(i =>
            i.id === id ? { ...i, has_prayed: true, prayer_count: i.prayer_count + 1 } : i
        ));
        const { data, error } = await supabaseBrowser.rpc('pray_for_intention', { p_intention_id: id });
        if (error) {
            // Revert on failure
            setIntentions(prev => prev.map(i =>
                i.id === id ? { ...i, has_prayed: false, prayer_count: Math.max(0, i.prayer_count - 1) } : i
            ));
        } else if (typeof data === 'number') {
            setIntentions(prev => prev.map(i =>
                i.id === id ? { ...i, prayer_count: data } : i
            ));
        }
        setPraying(null);
    };

    const remove = async (id: string) => {
        if (!supabaseBrowser) return;
        if (!confirm(isEn ? 'Remove this intention?' : 'Remover esta intenção?')) return;
        setIntentions(prev => prev.filter(i => i.id !== id));
        await supabaseBrowser.rpc('delete_novena_intention', { p_intention_id: id });
    };

    const initials = (name: string | null) =>
        (name ? name.trim().charAt(0) : '?').toUpperCase();

    return (
        <section className="mt-12 md:mt-16">
            <div className="flex items-start gap-3 mb-5 md:mb-6">
                <div className="w-9 h-9 md:w-10 md:h-10 shrink-0 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                    <MessageCircleHeart className="w-5 h-5 text-amber-400" />
                </div>
                <div className="min-w-0">
                    <h2 className="font-serif text-xl md:text-2xl text-white leading-tight">
                        {isEn ? 'Community Intentions' : 'Intenções da Comunidade'}
                    </h2>
                    <p className="text-slate-400 text-sm">
                        {isEn ? 'Share a prayer request — the community prays with you.' : 'Partilha uma intenção — a comunidade reza contigo.'}
                    </p>
                </div>
            </div>

            {/* Composer */}
            <div className="rounded-2xl md:rounded-3xl border border-white/10 bg-slate-900 p-4 md:p-6 mb-6 md:mb-8">
                <textarea
                    value={text}
                    onChange={e => setText(e.target.value.slice(0, MAX_LEN))}
                    rows={3}
                    placeholder={isEn ? 'For what or whom shall we pray?' : 'Por que ou por quem devemos rezar?'}
                    className="w-full bg-slate-950/60 border border-white/10 rounded-xl md:rounded-2xl p-3.5 md:p-4 text-white text-base placeholder:text-slate-500 resize-none focus:outline-none focus:border-amber-400/50 transition-colors"
                />
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-3">
                    <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={anonymous}
                            onChange={e => setAnonymous(e.target.checked)}
                            className="rounded border-white/20 bg-slate-800 text-amber-500 focus:ring-amber-400/40"
                        />
                        {isEn ? 'Post anonymously' : 'Publicar anonimamente'}
                    </label>
                    <div className="flex items-center gap-3 sm:ml-auto">
                        <span className="text-xs text-slate-500 shrink-0">{text.length}/{MAX_LEN}</span>
                        <button
                            onClick={submit}
                            disabled={!text.trim() || posting}
                            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-3 sm:py-2.5 bg-amber-500 hover:bg-amber-400 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold rounded-xl transition-all text-sm"
                        >
                            {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            {isEn ? 'Share intention' : 'Partilhar intenção'}
                        </button>
                    </div>
                </div>
            </div>

            {/* List */}
            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => <div key={i} className="h-28 bg-slate-900 rounded-2xl border border-white/5 animate-pulse" />)}
                </div>
            ) : intentions.length === 0 ? (
                <div className="text-center py-14 bg-slate-900 rounded-3xl border border-white/5">
                    <HandHeart className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-500">{isEn ? 'Be the first to share an intention.' : 'Sê o primeiro a partilhar uma intenção.'}</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <AnimatePresence initial={false}>
                        {intentions.map(item => (
                            <motion.div
                                key={item.id}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, height: 0 }}
                                className="rounded-2xl border border-white/10 bg-slate-900 p-4 md:p-5 flex gap-3 md:gap-4"
                            >
                                <div className="w-9 h-9 md:w-10 md:h-10 shrink-0 rounded-full bg-amber-500/15 border border-amber-500/20 flex items-center justify-center text-amber-200 font-bold text-sm">
                                    {item.display_name ? initials(item.display_name) : '🕊'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-white font-bold text-sm truncate">
                                            {item.display_name || (isEn ? 'Anonymous' : 'Anónimo')}
                                        </span>
                                        <span className="text-slate-500 text-xs shrink-0">· {timeAgo(item.created_at, isEn)}</span>
                                        {item.is_mine && (
                                            <button
                                                onClick={() => remove(item.id)}
                                                className="ml-auto shrink-0 p-1 -m-1 text-slate-600 hover:text-red-400 transition-colors"
                                                aria-label={isEn ? 'Delete' : 'Apagar'}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-slate-300 text-sm md:text-base leading-relaxed whitespace-pre-line break-words">{item.intention}</p>

                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-3">
                                        <button
                                            onClick={() => pray(item.id)}
                                            disabled={item.has_prayed || praying === item.id}
                                            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold transition-all active:scale-[0.97] ${
                                                item.has_prayed
                                                    ? 'bg-amber-500/15 text-amber-300 border border-amber-400/30 cursor-default'
                                                    : 'bg-white/5 active:bg-amber-500/10 hover:bg-amber-500/10 text-slate-300 hover:text-amber-300 border border-white/10 hover:border-amber-400/30'
                                            }`}
                                        >
                                            <HandHeart className="w-3.5 h-3.5" />
                                            {item.has_prayed
                                                ? (isEn ? "You're praying" : 'Estás a rezar')
                                                : (isEn ? "I'm praying for you" : 'Estou a rezar por ti')}
                                        </button>
                                        {item.prayer_count > 0 && (
                                            <span className="text-xs text-slate-500">
                                                {isEn
                                                    ? `${item.prayer_count} ${item.prayer_count === 1 ? 'is praying' : 'are praying'}`
                                                    : `${item.prayer_count} a rezar`}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </section>
    );
}

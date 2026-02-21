import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Gift, Heart, UserPlus, ArrowRight } from "lucide-react";
import { supabaseServer } from "../../../lib/supabase";
import { DynamicReward } from "../../../components/store/DynamicReward";

export const dynamic = "force-dynamic";

export default async function ConvitePage({
    params,
}: {
    params: Promise<{ codigo: string }>;
}) {
    const { codigo } = await params;

    if (!supabaseServer) {
        return redirect("/tornar-membro");
    }

    // Encontrar quem é o padrinho
    const { data: padrinho, error } = await supabaseServer
        .from("membros")
        .select("nome, avatar_url")
        .eq("referral_code", codigo)
        .single();

    if (error || !padrinho) {
        // Código inválido ou utilizador não encontrado
        redirect("/tornar-membro");
    }

    const firstName = padrinho.nome
        ? padrinho.nome.split(" ")[0]
        : "Um membro amigo";

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center py-20 px-4">
            <div className="max-w-xl w-full">
                {/* O Convite Personalizado */}
                <div className="bg-white rounded-3xl shadow-2xl overflow-hidden text-center relative">
                    <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-garabandal-dark to-slate-900" />

                    <div className="relative pt-20 px-8 pb-12">
                        {/* Avatar do Padrinho */}
                        <div className="w-24 h-24 bg-slate-100 rounded-full border-4 border-white shadow-lg mx-auto mb-6 flex items-center justify-center overflow-hidden">
                            {padrinho.avatar_url ? (
                                <img
                                    src={padrinho.avatar_url}
                                    alt={firstName}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <span className="text-4xl text-garabandal-gold font-serif">
                                    {firstName.charAt(0)}
                                </span>
                            )}
                        </div>

                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-bold uppercase tracking-wider mb-6">
                            <Gift className="w-4 h-4" />
                            Convite Especial
                        </div>

                        <h1 className="text-4xl sm:text-5xl font-serif text-slate-900 mb-6 leading-tight">
                            O {firstName} convidou-te para a nossa Missão.
                        </h1>

                        <p className="text-slate-600 text-lg mb-8 leading-relaxed max-w-sm mx-auto">
                            O Apostolado de Garabandal acolhe-te com muita alegria. Regista-te
                            através deste convite e{" "}
                            <strong>ganha <DynamicReward amount={2.50} /> de Saldo imediato</strong> para a nossa Loja
                            Online.
                        </p>

                        <div className="space-y-4">
                            <Link
                                href={`/tornar-membro?ref=${codigo}`}
                                className="w-full bg-yellow-500 text-slate-900 font-bold py-4 px-6 rounded-xl hover:bg-yellow-400 transition-colors shadow-lg shadow-yellow-500/20 flex items-center justify-center gap-2 text-lg"
                            >
                                <UserPlus className="w-5 h-5" />
                                Aceitar Convite do {firstName}
                            </Link>
                        </div>
                    </div>

                    {/* Footnote */}
                    <div className="bg-slate-50 border-t border-slate-100 py-6 px-8 text-sm text-slate-500">
                        Os <DynamicReward amount={2.50} /> ficarão disponíveis na tua conta logo após o término da
                        primeira subscrição solidária.
                    </div>
                </div>

                <div className="mt-8 text-center flex items-center justify-center gap-2 text-slate-400 text-sm">
                    <Heart className="w-4 h-4" /> Feito com devoção.
                </div>
            </div>
        </div>
    );
}

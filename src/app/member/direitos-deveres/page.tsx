"use client";

import Link from 'next/link';
import VIPLayout from '../../../components/member/VIPLayout';
import {
    ArrowLeft,
    Scale,
    ShieldCheck,
    ScrollText,
    CheckCircle2,
    AlertCircle,
    Gavel,
    Users
} from 'lucide-react';

export default function RightsAndDutiesPage() {
    return (
        <VIPLayout>
            <div className="max-w-4xl mx-auto space-y-12 pb-20">
                {/* Header Section */}
                <div className="space-y-6">
                    <Link
                        href="/member"
                        className="inline-flex items-center text-sm font-bold text-slate-400 hover:text-white transition-colors gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" /> Voltar ao Painel
                    </Link>

                    <div className="relative">
                        <div className="absolute -top-10 -left-10 w-32 h-32 bg-yellow-500/20 rounded-full blur-[60px] pointer-events-none" />
                        <h1 className="font-serif text-3xl md:text-5xl font-bold text-white mb-4 relative z-10">
                            Direitos e Deveres do Membro
                        </h1>
                        <p className="text-slate-400 text-lg max-w-2xl relative z-10 leading-relaxed">
                            Como membro da Associação do Apostolado de Garabandal, fazes parte de uma comunidade unida pela fé.
                            Conhece aqui os teus benefícios e compromissos.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-12">
                    {/* SECTION: RIGHTS */}
                    <section className="relative group">
                        <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/5 to-transparent opacity-50 rounded-3xl -m-4" />

                        <div className="flex items-center gap-4 mb-8 relative">
                            <div className="w-12 h-12 bg-yellow-500/10 rounded-xl flex items-center justify-center border border-yellow-500/20 text-yellow-500 shadow-lg shadow-yellow-900/10">
                                <ShieldCheck className="w-6 h-6" />
                            </div>
                            <h2 className="text-2xl font-serif font-bold text-white">
                                Direitos dos Membros Associados
                            </h2>
                        </div>

                        <div className="grid gap-4 relative">
                            <RightCard
                                icon={<Users className="w-5 h-5" />}
                                title="Descontos na Loja Online"
                                description="Usufruir de desconto de 5% sobre livros, publicações e artigos religiosos da loja online da Associação do Apostolado de Garabandal, utilizando o código de desconto exclusivo de membro."
                            />
                            <RightCard
                                icon={<Users className="w-5 h-5" />}
                                title="Descontos em Eventos"
                                description="Usufruir de desconto de 5% do valor de entradas nos colóquios, Congressos e Conferências organizadas diretamente pela Associação."
                            />
                            <RightCard
                                icon={<Users className="w-5 h-5" />}
                                title="Ofertas de Missas Anuais"
                                description="Usufruir de ofertas de Missas anuais celebradas com a intercessão de Nossa Senhora do Carmo de Garabandal, pelas intenções dos membros Associados e seus familiares."
                            />
                            <RightCard
                                icon={<Users className="w-5 h-5" />}
                                title="Participação na Assembleia Geral"
                                description="Participar e votar na Assembleia Geral após concluírem dois anos completos como membros associados e pagamento das respetivas quotas (caso façam parte dos órgãos sociais)."
                            />
                            <RightCard
                                icon={<Gavel className="w-5 h-5" />}
                                title="Eleger e Ser Eleito"
                                description="Eleger e ser eleito para os órgãos sociais da Associação, após concluírem dois anos completos como membros associados e pagamento de quotas."
                            />
                            <RightCard
                                icon={<Users className="w-5 h-5" />}
                                title="Propor Novos Membros"
                                description="Propor a admissão de novos membros associados à direção da Associação."
                            />
                            <RightCard
                                icon={<Users className="w-5 h-5" />}
                                title="Estadia na Casa de Acolhimento"
                                description="Poder usufruir da estadia na 'casa de acolhimento' da Associação do Apostolado de Garabandal, após cumprirem 3 anos seguidos de pagamento de quotas."
                            />
                        </div>
                    </section>

                    {/* SECTION: DUTIES */}
                    <section className="relative group pt-8 border-t border-white/5">
                        <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent opacity-50 rounded-3xl -m-4 top-8" />

                        <div className="flex items-center gap-4 mb-8 relative">
                            <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20 text-blue-400 shadow-lg shadow-blue-900/10">
                                <ScrollText className="w-6 h-6" />
                            </div>
                            <h2 className="text-2xl font-serif font-bold text-white">
                                Deveres dos Membros Associados
                            </h2>
                        </div>

                        <div className="grid gap-4 relative">
                            <DutyCard
                                index="a"
                                text="Cumprir as obrigações estatutárias e regulamentares, bem como as deliberações dos órgãos sociais eleitos."
                            />
                            <DutyCard
                                index="b"
                                text="Exercer as funções nos órgãos sociais, caso sejam eleitos ou designados para os mesmos."
                            />
                            <DutyCard
                                index="c"
                                text="Pagar a quota anual estabelecida (25€) dentro do prazo (1 a 31 de janeiro). O não pagamento implica a perda automática do estatuto de membro."
                            />
                            <DutyCard
                                index="d"
                                text="Colaborar nas atividades definidas pela Associação do Apostolado de Garabandal e contribuir para a realização dos seus objetivos estatutários."
                            />
                            <DutyCard
                                index="e"
                                text="Contribuir sempre para a união da Associação e de todos os seus membros. O não cumprimento desta norma pode levar à exclusão do membro."
                            />
                        </div>

                        {/* Note Box */}
                        <div className="mt-8 p-6 bg-red-900/10 border border-red-500/20 rounded-2xl flex gap-4 relative z-10">
                            <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
                            <div>
                                <h4 className="font-bold text-red-200 mb-1">Importante</h4>
                                <p className="text-sm text-red-200/70 leading-relaxed">
                                    O incumprimento dos deveres, especialmente o pagamento da quota anual ou a quebra de união entre os membros, pode resultar na perda dos direitos e exclusão da Associação.
                                </p>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </VIPLayout>
    );
}

function RightCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
    return (
        <div className="bg-slate-900/50 hover:bg-slate-800/80 border border-white/5 hover:border-yellow-500/20 p-6 rounded-2xl transition-all group/card">
            <div className="flex flex-col md:flex-row gap-4 md:items-start">
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 group-hover/card:text-yellow-500 group-hover/card:bg-yellow-500/10 transition-colors flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-bold text-lg text-white mb-2 group-hover/card:text-yellow-100 transition-colors">{title}</h3>
                    <p className="text-slate-400 leading-relaxed text-sm md:text-base">
                        {description}
                    </p>
                </div>
            </div>
        </div>
    );
}

function DutyCard({ index, text }: { index: string, text: string }) {
    return (
        <div className="bg-slate-900/30 hover:bg-slate-800/50 border border-white/5 hover:border-blue-500/20 p-5 rounded-xl transition-all flex gap-4 items-start">
            <div className="w-8 h-8 rounded-lg bg-slate-800/50 flex items-center justify-center text-xs font-bold text-slate-500 uppercase flex-shrink-0 border border-white/5">
                {index})
            </div>
            <p className="text-slate-300 leading-relaxed text-sm md:text-base pt-1">
                {text}
            </p>
        </div>
    );
}

"use client";

import { useState } from 'react';
import VIPLayout from '../../../components/member/VIPLayout';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BookOpen,
    Quote,
    Clock,
    FileText,
    ChevronRight,
    Star,
    Calendar,
    Users
} from 'lucide-react';
import { useLocale } from '../../../contexts/LocaleContext';

type Tab = 'historia' | 'mensagens';

export default function AboutGarabandalPage() {
    const { locale } = useLocale();
    const isEn = locale === 'en';
    const [activeTab, setActiveTab] = useState<Tab>('historia');

    const tabs = [
        { id: 'historia', label: isEn ? 'History' : 'História', icon: Clock },
        { id: 'mensagens', label: isEn ? 'Messages' : 'Mensagens', icon: Quote },
    ];

    return (
        <VIPLayout>
            <div className="max-w-5xl mx-auto pb-20">

                {/* Header */}
                <div className="text-center space-y-6 mb-12">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-sm font-bold uppercase tracking-wider text-blue-400"
                    >
                        <BookOpen className="w-4 h-4" />
                        {isEn ? 'Knowledge & Revelation' : 'Conhecimento & Revelação'}
                    </motion.div>
                    <h1 className="font-serif text-4xl md:text-5xl font-bold text-white">
                        {isEn ? 'About Garabandal' : 'Sobre Garabandal'}
                    </h1>
                    <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                        {isEn ? 'Dive into the history of the apparitions of San Sebastián de Garabandal, its urgent messages and the prophetic events that will change the world.' : 'Mergulha na história das aparições de San Sebastián de Garabandal, as suas mensagens urgentes e os eventos proféticos que mudarão o mundo.'}
                    </p>
                </div>

                {/* Tab Navigation */}
                <div className="flex flex-wrap justify-center gap-2 mb-12">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as Tab)}
                            className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all duration-200
                        ${activeTab === tab.id
                                    ? 'bg-yellow-600 text-white shadow-lg shadow-yellow-600/20'
                                    : 'bg-slate-900/50 text-slate-400 hover:text-white hover:bg-slate-800'
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                    >
                        {activeTab === 'historia' && <HistoryContent isEn={isEn} />}
                        {activeTab === 'mensagens' && <MessagesContent isEn={isEn} />}
                    </motion.div>
                </AnimatePresence>

            </div>
        </VIPLayout>
    );
}

// --- Icons & Components ---

function HistoryContent({ isEn }: { isEn: boolean }) {
    const events = isEn ? [
        { year: '1961', date: 'June 18', title: 'The Beginning', desc: 'First apparition of St. Michael the Archangel to the four girls: Conchita, Mari Loli, Jacinta, and Mari Cruz.' },
        { year: '1961', date: 'July 2', title: 'Our Lady', desc: 'First apparition of the Virgin Mary under the title of Our Lady of Mount Carmel.' },
        { year: '1961', date: 'October 18', title: 'The First Message', desc: 'The Virgin gives the first public message to the world, calling for prayer and penance.' },
        { year: '1962', date: 'July', title: 'The Miracle of the Host', desc: 'St. Michael the Archangel gives visible communion to Conchita, captured in photograph.' },
        { year: '1965', date: 'June 18', title: 'The Second Message', desc: 'Last public message given through St. Michael the Archangel, warning about the crisis in the clergy.' },
        { year: '1965', date: 'November 13', title: 'The Farewell', desc: 'Last apparition of Our Lady in Garabandal.' },
    ] : [
        { year: '1961', date: '18 de Junho', title: 'O Início', desc: 'Primeira aparição do Arcanjo São Miguel às quatro meninas: Conchita, Mari Loli, Jacinta e Mari Cruz.' },
        { year: '1961', date: '2 de Julho', title: 'Nossa Senhora', desc: 'Primeira aparição da Virgem Maria sob a advocação de Nossa Senhora do Carmo.' },
        { year: '1961', date: '18 de Outubro', title: 'A Primeira Mensagem', desc: 'A Virgem dá a primeira mensagem pública ao mundo, pedindo oração e penitência.' },
        { year: '1962', date: 'Julho', title: 'O Milagre da Hóstia', desc: 'O Arcanjo Miguel dá a comunhão visível a Conchita, captada em fotografia.' },
        { year: '1965', date: '18 de Junho', title: 'A Segunda Mensagem', desc: 'Última mensagem pública dada através do Arcanjo Miguel, alertando sobre a crise no clero.' },
        { year: '1965', date: '13 de Novembro', title: 'O Adeus', desc: 'Última aparição de Nossa Senhora em Garabandal.' },
    ];

    return (
        <div className="max-w-3xl mx-auto">
            <h2 className="font-serif text-3xl text-white text-center mb-12">{isEn ? 'Timeline of Events' : 'Cronologia dos Eventos'}</h2>
            <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
                {events.map((evt, i) => (
                    <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white/10 bg-slate-900 group-hover:bg-yellow-600/20 group-hover:border-yellow-500/50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 transition-colors">
                            <Calendar className="w-5 h-5 text-slate-400 group-hover:text-yellow-500 transition-colors" />
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-slate-900/50 p-6 rounded-2xl border border-white/5 hover:border-yellow-500/20 transition-all">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-yellow-500 font-bold text-lg">{evt.year}</span>
                                <span className="text-slate-500 text-sm font-medium uppercase tracking-wider">{evt.date}</span>
                            </div>
                            <h3 className="font-serif text-xl font-bold text-white mb-2">{evt.title}</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">{evt.desc}</p>
                        </div>
                    </div>
                ))}
            </div>
            <div className="mt-16 bg-blue-900/10 border border-blue-500/20 p-8 rounded-2xl text-center">
                <p className="text-blue-200 font-serif italic text-lg">
                    "{isEn ? 'The Virgin did not come only for those four girls, but for the whole world.' : 'A Virgem não veio apenas para aquelas quatro meninas, mas para todo o mundo.'}"
                </p>
                <div className="mt-4 flex justify-center gap-2">
                    {['Conchita', 'Mari Loli', 'Jacinta', 'Mari Cruz'].map(name => (
                        <span key={name} className="px-3 py-1 rounded-full bg-blue-500/10 text-xs font-bold text-blue-300 uppercase">{name}</span>
                    ))}
                </div>
            </div>
        </div>
    );
}

function MessagesContent({ isEn }: { isEn: boolean }) {
    return (
        <div className="space-y-8 max-w-3xl mx-auto">
            <h2 className="font-serif text-3xl text-white text-center mb-8">{isEn ? 'The Messages to the World' : 'As Mensagens ao Mundo'}</h2>

            <div className="bg-slate-900/50 p-8 md:p-10 rounded-3xl border border-white/5 relative overflow-hidden group hover:border-yellow-500/30 transition-all">
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Quote className="w-24 h-24 text-white" />
                </div>
                <div className="mb-6">
                    <div className="inline-block px-3 py-1 bg-yellow-500/10 rounded-lg text-yellow-500 text-xs font-bold uppercase tracking-wider mb-2">{isEn ? 'October 18, 1961' : '18 de Outubro de 1961'}</div>
                    <h3 className="font-serif text-2xl text-white">{isEn ? 'The First Message' : 'A Primeira Mensagem'}</h3>
                </div>
                <div className="prose prose-invert prose-lg">
                    <p className="font-serif italic text-slate-300 leading-looose">
                        "{isEn ? 'We must make many sacrifices, perform much penance, and visit the Blessed Sacrament frequently... If we do not, a chastisement will befall us. The cup is already filling up, and if we do not change, a very great chastisement will come upon us.' : 'Temos de fazer muitos sacrifícios, muita penitência, visitar muito o Santíssimo Sacramento, mas antes temos de ser muito bons. Se o não fizermos virá um castigo. A taça está a encher, e se não mudarmos virá um castigo muito grande.'}"
                    </p>
                </div>
            </div>

            <div className="bg-slate-900/50 p-8 md:p-10 rounded-3xl border border-white/5 relative overflow-hidden group hover:border-yellow-500/30 transition-all">
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Quote className="w-24 h-24 text-white" />
                </div>
                <div className="mb-6">
                    <div className="inline-block px-3 py-1 bg-yellow-500/10 rounded-lg text-yellow-500 text-xs font-bold uppercase tracking-wider mb-2">{isEn ? 'June 18, 1965' : '18 de Junho de 1965'}</div>
                    <h3 className="font-serif text-2xl text-white">{isEn ? 'The Second Message' : 'A Segunda Mensagem'}</h3>
                </div>
                <div className="prose prose-invert prose-lg">
                    <p className="font-serif italic text-slate-300 leading-looose">
                        "{isEn ? 'As my message of October 18 has not been complied with and has not been made known to the world, I am advising you that this is the last one. Before, the cup was filling up. Now it is flowing over. Many cardinals, many bishops and many priests are on the road to perdition and are taking many souls with them. Less and less importance is being given to the Eucharist...' : 'Como não se cumpriu e não se deu muito a conhecer ao mundo a minha mensagem de 18 de Outubro, dir-vos-ei que esta é a última. Antes a taça estava a encher, agora está a transbordar. Muitos Sacerdotes, Bispos e Cardeais vão pelo caminho da perdição e com eles arrastam muitas almas. À Eucaristia dá-se cada vez menos importância...'}"
                    </p>
                </div>
            </div>

            <p className="text-center text-slate-500 text-sm mt-8">{isEn ? 'The messages were given for the conversion of the world.' : 'As mensagens foram dadas para a conversão do mundo.'}</p>
        </div>
    );
}

// Helper icons
function TrendingUpIcon(props: any) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
    )
}

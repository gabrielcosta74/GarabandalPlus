'use client';

import React, { useRef } from 'react';
import Image from 'next/image';
import { motion, useScroll, useTransform } from 'framer-motion';
import { BookOpen, Globe2, Image as ImageIcon, Video, Star } from 'lucide-react';

const TIMELINE_DATA = [
    {
        year: '2007',
        title: 'Como tudo começou',
        icon: <Star className="w-6 h-6" />,
        content: `Conheci as aparições de Garabandal quando tinha 16 anos através de um livro que me ofereceram. Lembro-me perfeitamente que, quando acabei de o ler, fiquei muito impressionado com o seu conteúdo e posso dizer-vos com sinceridade que acreditei logo no primeiro momento nesta história.\n\nNo entanto, só 16 anos mais tarde, a 13 de Outubro de 2007, é que senti de novo um chamamento para Garabandal. Depois, passados uns meses, fui pela primeira vez a esse lugar especial. Que transformações ou mudanças Garabandal provocou na minha vida? Muitas, a começar pela Eucaristia, pela qual comecei a ganhar mais respeito e fidelidade.\n\nQuando regressei a Portugal, senti uma necessidade urgente de dar a conhecer esta linda e maravilhosa história a mais pessoas. Foi assim que nasceu o apostolado de Garabandal em língua portuguesa.`,
        image: '/images/nossasenhoragarabandal.jpg'
    },
    {
        year: '2009',
        title: 'Primeiro Encontro de Garabandal',
        icon: <BookOpen className="w-6 h-6" />,
        content: `Em 2009, o Apostolado de Garabandal realizou em Portugal o seu primeiro encontro. Neste encontro, estiveram presentes várias pessoas ligadas à divulgação de Garabandal. Este encontro foi um grande passo para a divulgação da mensagem de Garabandal no nosso país, unindo corações e reforçando a nossa missão.`,
        image: null
    },
    {
        year: '2010',
        title: 'Viagem Divulgadora ao Brasil',
        icon: <Globe2 className="w-6 h-6" />,
        content: `O apostolado de Garabandal em língua portuguesa seguiu viagem rumo ao Brasil com o objetivo de dar a conhecer a história e as mensagens de Nossa Senhora do Carmo de Garabandal. Foram momentos inesquecíveis.\n\nPercorremos com autorização do Bispo local, várias paróquias de vários estados do Brasil onde nos foi possível apresentar o trabalho de divulgação das mensagens e da história das aparições de Garabandal.`,
        image: null
    },
    {
        year: '2011',
        title: '50 Anos dos Acontecimentos',
        icon: <ImageIcon className="w-6 h-6" />,
        content: `O apostolado de Garabandal esteve presente em Garabandal nas comemorações dos acontecimentos ocorridos em 2011 (50º aniversário). Foram momentos de grande alegria, pois tivemos oportunidade de reunirmos com muitas pessoas ligadas à divulgação da história de Garabandal a nível mundial.`,
        image: null
    },
    {
        year: '2014',
        title: 'Lançamento do Primeiro Livro',
        icon: <BookOpen className="w-6 h-6" />,
        content: `No dia 9 de Maio de 2014, o apostolado apresentou o seu novo livro em português: "Garabandal, um chamamento urgente à conversão". Durante esta apresentação foi focalizada principalmente a parte baseada no testemunho de conversão.\n\nTivemos a alegria de ter connosco o Sr. David, uma testemunha importante, além da participação do público com testemunhos intensos e sacerdotes católicos oriundos da Austrália, Brasil e Polónia. Tudo isto foi possível graças ao apoio incondicional do pároco de Garabandal.`,
        image: null
    },
    {
        year: '2019',
        title: 'O Filme e Documentário',
        icon: <Video className="w-6 h-6" />,
        content: `Participação e parceria com "Hogar de la Madre" para a tradução do texto do filme "Garabandal, só Deus sabe" e do documentário "Garabandal, cascata inesgotável" para a língua portuguesa, assegurando também a dobragem para o Brasil e legendas para Portugal.`,
        image: null
    }
];

export default function AboutClient() {
    const containerRef = useRef<HTMLElement>(null);
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start start", "end end"]
    });

    const yBackground = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
    const opacityHero = useTransform(scrollYProgress, [0, 0.2], [1, 0]);

    return (
        <main ref={containerRef} className="min-h-screen bg-garabandal-dark selection:bg-garabandal-gold selection:text-white pb-32">

            {/* Hero Section */}
            <section className="relative h-[70vh] flex items-center justify-center overflow-hidden">
                <motion.div style={{ y: yBackground }} className="absolute inset-0 z-0">
                    <Image
                        src="/images/nossasenhoragarabandal.jpg"
                        alt="Nossa Senhora de Garabandal"
                        fill
                        priority
                        className="object-cover opacity-30 grayscale-[20%]"
                        sizes="100vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-garabandal-dark/80 via-garabandal-dark/60 to-garabandal-dark" />
                </motion.div>

                <motion.div
                    style={{ opacity: opacityHero }}
                    className="relative z-10 text-center px-4 max-w-4xl mx-auto mt-20"
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8 }}
                        className="inline-flex items-center gap-3 mb-6 bg-white/5 backdrop-blur-md px-6 py-2 rounded-full border border-white/10"
                    >
                        <span className="w-2 h-2 rounded-full bg-garabandal-gold animate-pulse" />
                        <span className="text-garabandal-gold uppercase tracking-[0.2em] text-xs font-bold">A Nossa História</span>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="text-4xl md:text-6xl font-serif font-bold text-white mb-6 leading-tight"
                    >
                        Um chamamento urgente <br className="hidden md:block" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-garabandal-gold to-yellow-200 italic">à conversão.</span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.4 }}
                        className="text-lg md:text-xl text-slate-300 font-light max-w-2xl mx-auto"
                    >
                        Fundado a 13 de Outubro de 2007, temos por objetivo divulgar na língua portuguesa as
                        aparições de Nossa Senhora do Carmo de Garabandal e apoiar o peregrino.
                    </motion.p>
                </motion.div>
            </section>

            {/* Mission Statement Block */}
            <section className="relative z-20 -mt-20 max-w-5xl mx-auto px-4 mb-32">
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="bg-white rounded-3xl p-8 md:p-12 shadow-2xl shadow-black/50 border border-garabandal-gold/20 relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-64 h-64 bg-garabandal-gold/5 rounded-full blur-[80px]" />
                    <HistoryQuote />
                </motion.div>
            </section>

            {/* Vertical Timeline */}
            <section className="max-w-4xl mx-auto px-4 relative">
                {/* Timeline Line */}
                <div className="absolute left-[39px] md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-garabandal-gold/30 to-transparent -translate-x-1/2" />

                <div className="space-y-24 md:space-y-32">
                    {TIMELINE_DATA.map((item, index) => (
                        <TimelineItem key={item.year} item={item} index={index} />
                    ))}
                </div>
            </section>
        </main>
    );
}

// Subcomponents

function HistoryQuote() {
    return (
        <div className="relative z-10 text-center">
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-garabandal-dark mb-6">
                &quot;Nossa Senhora convida-nos a ingressar no caminho do seu filho...&quot;
            </h2>
            <p className="text-slate-600 text-lg leading-relaxed max-w-3xl mx-auto">
                As mensagens dadas pela Nossa Senhora em Garabandal continuam atuais. Tentemos pô-las em prática
                através da oração, do sacrifício e da caridade, visitando o Santíssimo frequentemente. Estas são as
                &quot;armas&quot; que nos protegem de todo o mal e aproximam o nosso coração do Sagrado Coração de Jesus.
            </p>
        </div>
    );
}

function TimelineItem({ item, index }: { item: typeof TIMELINE_DATA[0], index: number }) {
    const isEven = index % 2 === 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7 }}
            className={`relative flex flex-col md:flex-row items-center gap-8 ${isEven ? 'md:flex-row-reverse' : ''}`}
        >
            {/* Center Node (Year / Icon) */}
            <div className="absolute left-[39px] md:left-1/2 flex items-center justify-center -translate-x-1/2 z-10 w-20 h-20 bg-garabandal-dark border-4 border-slate-800 rounded-full shadow-[0_0_30px_rgba(234,179,8,0.15)] block">
                <div className="flex flex-col items-center justify-center text-garabandal-gold">
                    <span className="text-xs font-bold">{item.year}</span>
                </div>
            </div>

            {/* Empty space for the opposite side on desktop */}
            <div className="hidden md:block md:w-1/2" />

            {/* Content Box */}
            <div className={`w-full md:w-1/2 pl-24 md:pl-0 ${isEven ? 'md:pr-16 text-left md:text-right' : 'md:pl-16 text-left'}`}>
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 md:p-8 hover:border-garabandal-gold/30 hover:bg-slate-800/80 transition-colors group">
                    <div className={`flex items-center gap-4 mb-4 ${isEven ? 'md:justify-end' : ''}`}>
                        <div className="w-10 h-10 rounded-full bg-garabandal-gold/10 text-garabandal-gold flex items-center justify-center flex-shrink-0">
                            {item.icon}
                        </div>
                        <h3 className="text-xl font-serif font-bold text-white group-hover:text-garabandal-gold transition-colors">{item.title}</h3>
                    </div>

                    <div className="space-y-4">
                        {item.content.split('\n\n').map((paragraph, i) => (
                            <p key={i} className="text-slate-300 leading-relaxed text-sm md:text-base">
                                {paragraph}
                            </p>
                        ))}
                    </div>

                    {item.image && (
                        <div className="mt-6 relative w-full aspect-video rounded-xl overflow-hidden hidden md:block border border-white/10">
                            <Image
                                src={item.image}
                                alt={item.title}
                                fill
                                className="object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700"
                            />
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

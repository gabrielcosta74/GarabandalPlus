import { motion } from 'framer-motion';
import { ArrowRight, Heart } from 'lucide-react';
import { useCurrency } from '../providers/CurrencyProvider';
import { useLocale } from '../../contexts/LocaleContext';

interface DonationHeroProps {
    progress: {
        goal: number;
        raised: number;
    };
    onDonateClick: () => void;
}

export default function DonationHero({ progress, onDonateClick }: DonationHeroProps) {
    const { formatPrice } = useCurrency();
    const { locale } = useLocale();
    const isEn = locale === 'en';
    const percent = Math.min((progress.raised / progress.goal) * 100, 100);

    return (
        <section className="relative pt-32 pb-16 lg:py-0 lg:min-h-[90vh] flex items-center justify-center overflow-hidden bg-garabandal-dark text-white">
            {/* Background Effects */}
            {/* Background Effects */}
            <div className="absolute inset-0 z-0">
                {/* Image Background */}
                <div className="absolute inset-0">
                    <img
                        src="/images/aldeiadacasa.webp"
                        alt="Aldeia de Garabandal"
                        className="w-full h-full object-cover opacity-60"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/40" />
                </div>

                {/* Decorative Gradients */}
                <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-garabandal-gold/10 blur-[120px] rounded-full animate-pulse-slow" />
                <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-500/10 blur-[100px] rounded-full" />
            </div>

            <div className="container mx-auto px-6 relative z-10 grid lg:grid-cols-2 gap-12 items-center">

                {/* Text Content */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="text-center lg:text-left space-y-8"
                >
                    <div className="inline-flex items-center space-x-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full backdrop-blur-md">
                        <Heart className="w-4 h-4 text-garabandal-gold" fill="currentColor" />
                        <span className="text-sm font-medium text-garabandal-gold tracking-wide uppercase">{isEn ? 'House of Welcome' : 'Casa de Acolhimento'}</span>
                    </div>

                    <h1 className="text-4xl sm:text-5xl lg:text-7xl font-serif leading-tight">
                        {isEn ? 'The House of' : 'Casa de'} <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-garabandal-gold to-yellow-200">
                            {isEn ? 'Welcome' : 'Acolhimento'}
                        </span>
                    </h1>

                    <p className="text-lg text-gray-300 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                        {isEn
                            ? 'By the grace of God, the Garabandal Apostolate acquired a house in the mountains. A place chosen to serve and support pilgrims who seek to encounter God through Garabandal.'
                            : 'A Associação do Apostolado de Garabandal adquiriu, pela graça de Deus, uma casa situada nas montanhas. Um local escolhido para estar ao serviço e apoio ao peregrino que procura ir ao encontro de Deus através de Garabandal.'}
                    </p>

                    <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                        <button
                            onClick={onDonateClick}
                            className="group relative px-8 py-4 bg-garabandal-gold text-garabandal-dark font-bold rounded-full overflow-hidden transition-transform hover:scale-105 shadow-[0_0_20px_rgba(234,179,8,0.3)]"
                        >
                            <span className="relative z-10 flex items-center gap-2">
                                {isEn ? 'Donate Now' : 'Doar Agora'} <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </span>
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                        </button>
                        <a href="#historia" className="text-sm font-medium text-gray-400 hover:text-white transition-colors border-b border-transparent hover:border-gray-400">
                            {isEn ? 'See the Project' : 'Ver o Projeto'}
                        </a>
                    </div>
                </motion.div>

                {/* Progress Card */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="relative"
                >
                    <div className="absolute inset-0 bg-garabandal-gold/5 blur-3xl rounded-full" />
                    <div className="relative bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl">
                        <div className="flex justify-between items-end mb-6">
                            <div>
                                <p className="text-sm text-gray-400 uppercase tracking-widest mb-1">{isEn ? 'Raised' : 'Angariado'}</p>
                                <p className="text-3xl sm:text-4xl font-serif text-white">{formatPrice(progress.raised)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-gray-400 mb-1">{isEn ? 'Goal' : 'Meta'}</p>
                                <p className="text-xl font-medium text-white/80">{formatPrice(progress.goal)}</p>
                            </div>
                        </div>

                        <div className="relative h-4 bg-white/10 rounded-full overflow-hidden mb-4">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${percent}%` }}
                                transition={{ duration: 1.5, ease: "easeOut" }}
                                className="absolute top-0 left-0 h-full bg-gradient-to-r from-garabandal-gold to-yellow-300 shadow-[0_0_15px_rgba(234,179,8,0.5)]"
                            />
                        </div>

                        <div className="flex justify-between text-sm font-medium text-gray-300">
                            <span>{Math.round(percent)}% {isEn ? 'completed' : 'concluído'}</span>
                            <span>{isEn ? 'Phase: Materials' : 'Fase: Materiais'}</span>
                        </div>

                        <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between">
                            <div className="flex -space-x-3">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className="w-10 h-10 rounded-full bg-gray-700 border-2 border-[#1a1a1a] flex items-center justify-center text-xs text-gray-400">
                                        <Heart className="w-4 h-4" />
                                    </div>
                                ))}
                                <div className="w-10 h-10 rounded-full bg-garabandal-gold/20 border-2 border-[#1a1a1a] flex items-center justify-center text-xs text-garabandal-gold font-bold">
                                    +50
                                </div>
                            </div>
                            <p className="text-sm text-gray-400">{isEn ? 'Join this mission' : 'Junta-te a esta missão'}</p>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}

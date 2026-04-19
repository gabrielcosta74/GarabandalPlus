"use client";

import VIPLayout from '../../../components/member/VIPLayout';
import { motion } from 'framer-motion';
import { Wifi, Info, Activity, AlertCircle, Loader2, Play } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useLocale } from '../../../contexts/LocaleContext';
// import Hls from 'hls.js'; // Removed for dynamic import

export default function LivePage() {
    const { locale } = useLocale();
    const isEn = locale === 'en';
    const videoRef = useRef<HTMLVideoElement>(null);
    const [playbackStatus, setPlaybackStatus] = useState<'connecting' | 'playing' | 'buffering' | 'error'>('connecting');
    const [userInteracted, setUserInteracted] = useState(false);

    useEffect(() => {
        if (!userInteracted) return;

        const video = videoRef.current;
        if (!video) return;

        const src = "https://cdn3.wowza.com/5/cmRjeVBFRWdaQ1gx/CSTV-HTTP/garabandal.stream/playlist.m3u8";
        let hls: any = null; // Type as any for simplicity with dynamic import or use proper Hls type if accessible globally

        const handlePlaying = () => setPlaybackStatus('playing');
        const handleWaiting = () => setPlaybackStatus('buffering');
        const handleError = () => setPlaybackStatus('error');

        video.addEventListener('playing', handlePlaying);
        video.addEventListener('waiting', handleWaiting);
        video.addEventListener('error', handleError);

        // Check for native support first (Safari/Mac)
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = src;
            video.addEventListener('loadedmetadata', () => {
                video.play().catch(console.error);
            });
        }
        // Fallback to HLS.js for others (dynamically loaded)
        else {
            // Dynamic import to save bundle size
            import('hls.js').then((HlsModule) => {
                const Hls = HlsModule.default;
                if (Hls.isSupported()) {
                    hls = new Hls({
                        debug: false,
                        enableWorker: true,
                        lowLatencyMode: true,
                    });

                    hls.loadSource(src);
                    hls.attachMedia(video);

                    hls.on(Hls.Events.MEDIA_ATTACHED, () => {
                        video.play().catch(console.error);
                    });

                    hls.on(Hls.Events.ERROR, (event: any, data: any) => {
                        if (data.fatal) {
                            switch (data.type) {
                                case Hls.ErrorTypes.NETWORK_ERROR:
                                    hls?.startLoad();
                                    break;
                                case Hls.ErrorTypes.MEDIA_ERROR:
                                    hls?.recoverMediaError();
                                    break;
                                default:
                                    hls?.destroy();
                                    break;
                            }
                        }
                    });
                } else {
                    setPlaybackStatus('error');
                }
            });
        }

        return () => {
            if (hls) hls.destroy();
            video.removeEventListener('playing', handlePlaying);
            video.removeEventListener('waiting', handleWaiting);
            video.removeEventListener('error', handleError);
        };
    }, [userInteracted]);

    return (
        <VIPLayout>
            <div className="min-h-screen pb-20">
                <div className="max-w-5xl mx-auto space-y-8">

                    {/* Header */}
                    <div className="text-center space-y-4">
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-widest transition-colors ${playbackStatus === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                            playbackStatus === 'playing' ? 'bg-green-500/10 border-green-500/20 text-green-500 animate-pulse' :
                                'bg-yellow-500/10 border-yellow-500/20 text-yellow-500'
                            }`}>
                            {playbackStatus === 'playing' && <Wifi className="w-3 h-3" />}
                            {playbackStatus === 'buffering' && <Loader2 className="w-3 h-3 animate-spin" />}
                            {playbackStatus === 'error' && <AlertCircle className="w-3 h-3" />}

                            {playbackStatus === 'playing' ? (isEn ? 'Live' : 'Em Direto') :
                                playbackStatus === 'buffering' ? (isEn ? 'Loading...' : 'A Carregar...') :
                                    playbackStatus === 'error' ? 'Offline' : (isEn ? 'Connecting...' : 'A Ligar...')}
                        </div>
                        <h1 className="text-3xl md:text-5xl font-serif text-white">{isEn ? 'Garabandal Sanctuary' : 'Santuário de Garabandal'}</h1>
                        <p className="text-slate-400 max-w-xl mx-auto">
                            {isEn ? 'Follow live images from the Church and the village of San Sebastián de Garabandal.' : 'Acompanhe em tempo real as imagens da Igreja e da vila de San Sebastián de Garabandal.'}
                        </p>
                    </div>

                    {/* Video Player Container */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="relative aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10 group"
                    >
                        {!userInteracted ? (
                            <button
                                onClick={() => setUserInteracted(true)}
                                className="absolute inset-0 flex items-center justify-center bg-black/50 hover:bg-black/40 transition-colors z-20 group-hover:scale-105 duration-500"
                            >
                                <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-[0_0_30px_rgba(255,255,255,0.2)] group-hover:shadow-[0_0_50px_rgba(59,130,246,0.5)] transition-all">
                                    <Play className="w-8 h-8 text-white ml-1 fill-white" />
                                </div>
                            </button>
                        ) : null}

                        <video
                            ref={videoRef}
                            className="w-full h-full object-contain"
                            controls
                            playsInline
                            muted
                            poster="/images/igrejagarabandal.jpg"
                        />

                        {userInteracted && (playbackStatus === 'connecting' || playbackStatus === 'buffering') && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10 pointer-events-none">
                                <Loader2 className="w-10 h-10 text-white animate-spin opacity-50" />
                            </div>
                        )}
                    </motion.div>

                    {/* Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <Info className="w-5 h-5 text-yellow-500" /> {isEn ? 'About the Broadcast' : 'Sobre a Transmissão'}
                            </h3>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                {isEn ? 'This stream is provided directly from San Sebastián de Garabandal.' : 'Esta transmissão é fornecida diretamente de San Sebastián de Garabandal.'}
                            </p>
                            <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
                                <h4 className="text-sm font-bold text-white mb-2">{isEn ? 'Mass Schedule (Spain)' : 'Horário das Missas (Espanha)'}</h4>
                                <div className="flex items-center justify-between text-xs text-slate-400 bg-white/5 p-2 rounded-lg">
                                    <span>{isEn ? 'Monday to Friday' : 'Segunda a Sexta'}</span>
                                    <span className="font-mono text-white">11:00</span>
                                </div>
                                <div className="flex items-center justify-between text-xs text-slate-400 bg-white/5 p-2 rounded-lg">
                                    <span>{isEn ? 'Sunday' : 'Domingo'}</span>
                                    <span className="font-mono text-white">13:00</span>
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6 flex flex-col justify-center items-center text-center">
                            <p className="text-slate-500 text-sm mb-2">{isEn ? 'Time Zones' : 'Fusos Horários'}</p>
                            <div className="text-2xl font-mono text-white">
                                {new Date().toLocaleTimeString('pt-PT', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' })} <span className="text-xs text-slate-500">ES</span>
                            </div>
                            <div className="text-xs text-slate-600 mt-1">{isEn ? 'Local Time in Garabandal' : 'Hora Local em Garabandal'}</div>
                        </div>
                    </div>

                </div>
            </div>
        </VIPLayout>
    );
}

'use client';

import { Play, Volume2, VolumeX } from 'lucide-react';
import { useRef, useState } from 'react';
import { motion } from 'framer-motion';

export default function DonationVideo() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);

    // Placeholder for now - User needs to upload the real 157MB file to Supabase
    // We use a portrait placeholder video or just the poster until then
    const videoSrc = "https://pntzzuxzjnzksubbjfvj.supabase.co/storage/v1/object/public/site-content/Obra%20Urgente%20em%20Garabandal_%20Ajude-nos%20a%20Construir!-2-2-2.mp4";
    const posterSrc = "/video_poster_portrait.png"; // We will need to move the generated image here

    const togglePlay = () => {
        if (!videoRef.current) return;

        if (isPlaying) {
            videoRef.current.pause();
        } else {
            videoRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!videoRef.current) return;
        videoRef.current.muted = !isMuted;
        setIsMuted(!isMuted);
    };

    return (
        <section className="py-24 bg-slate-950 relative overflow-hidden">
            {/* Ambient Background */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-600/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-900/10 rounded-full blur-[100px] pointer-events-none mix-blend-overlay" />

            <div className="container mx-auto px-6 relative z-10">
                <div className="flex justify-center">

                    {/* Video - Portrait Container */}
                    <div className="relative w-full max-w-[360px] lg:max-w-[400px]">
                        {/* Decorative Frames */}
                        <div className="absolute -inset-6 bg-gradient-to-tr from-amber-500/10 to-transparent rounded-[48px] blur-2xl opacity-60 animate-pulse" />

                        <motion.div
                            initial={{ opacity: 0, y: 30, scale: 0.95 }}
                            whileInView={{ opacity: 1, y: 0, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8 }}
                            className="relative aspect-[9/16] bg-slate-900 rounded-[40px] overflow-hidden shadow-2xl border-4 border-slate-800/50 ring-1 ring-white/10 group cursor-pointer"
                            onClick={togglePlay}
                        >
                            <video
                                ref={videoRef}
                                src={videoSrc}
                                className="w-full h-full object-cover"
                                loop
                                playsInline
                                // poster={posterSrc} // Uncomment when image is moved
                                onClick={(e) => {
                                    if (isPlaying) {
                                        e.stopPropagation();
                                        togglePlay();
                                    }
                                }}
                            />

                            {/* Overlay Gradient */}
                            <div className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 transition-opacity duration-500 ${isPlaying ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`} />

                            {/* Play Button Overlay */}
                            <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${isPlaying ? 'opacity-0 scale-110 pointer-events-none' : 'opacity-100 scale-100'}`}>
                                <div className="relative group/btn">
                                    <div className="absolute inset-0 bg-amber-500 rounded-full blur-[24px] opacity-30 group-hover/btn:opacity-50 transition-opacity" />
                                    <div className="relative w-24 h-24 bg-white/5 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center group-hover/btn:scale-105 transition-transform duration-300 shadow-2xl">
                                        <div className="w-20 h-20 bg-amber-500 rounded-full flex items-center justify-center shadow-lg transform translate-x-0.5 translate-y-0.5">
                                            <Play className="w-8 h-8 text-slate-900 fill-slate-900 ml-1" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Mute Control */}
                            <button
                                onClick={toggleMute}
                                className="absolute top-8 right-8 p-3 bg-black/40 backdrop-blur-md rounded-full text-white/70 hover:text-white transition-colors z-20 hover:bg-black/60"
                            >
                                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                            </button>
                        </motion.div>
                    </div>

                </div>
            </div>
        </section>
    );
}

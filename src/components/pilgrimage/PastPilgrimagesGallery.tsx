"use client";

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '../../lib/supabase-browser';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, X, ZoomIn } from 'lucide-react';
import { useLocale } from '../../contexts/LocaleContext';

interface GalleryImage {
    id: string;
    image_url: string;
}

export function PastPilgrimagesGallery() {
    const { t } = useLocale();
    const [images, setImages] = useState<GalleryImage[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);

    useEffect(() => {
        const fetchImages = async () => {
            if (!supabaseBrowser) return;

            const { data } = await supabaseBrowser
                .from('gallery_images')
                .select('id, image_url')
                .eq('is_active', true)
                .order('display_order', { ascending: true })
                .order('created_at', { ascending: false })
                .limit(20);

            if (data) {
                setImages(data);
            }
            setLoading(false);
        };

        fetchImages();
    }, []);

    // Lock body scroll when lightbox is open
    useEffect(() => {
        if (selectedImage) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [selectedImage]);

    if (loading) return null;
    if (images.length === 0) return null;

    // Duplicate images to create seamless loop
    const displayImages = images.length < 10 ? [...images, ...images, ...images] : [...images, ...images];

    return (
        <section className="py-16 overflow-hidden">
            <style jsx>{`
                @keyframes scroll {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .gallery-track {
                    animation: scroll 60s linear infinite;
                    width: fit-content;
                }
                .gallery-track:hover {
                    animation-play-state: paused;
                }
            `}</style>

            <div className="max-w-7xl mx-auto px-6 mb-8">
                <h2 className="text-3xl font-serif font-bold text-slate-900">{t.pilgrimages.gallery.title}</h2>
                <p className="text-slate-500 mt-1">{t.pilgrimages.gallery.subtitle}</p>
            </div>

            <div className="relative w-full">
                {/* Gradients for fade effect */}
                <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[#f8fafc] to-transparent z-10 pointer-events-none" />
                <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[#f8fafc] to-transparent z-10 pointer-events-none" />

                <div className="flex overflow-hidden group py-4">
                    <div className="flex gap-4 gallery-track px-4">
                        {displayImages.map((img, idx) => (
                            <motion.div
                                key={`${img.id}-${idx}`}
                                className="relative w-64 h-80 rounded-2xl overflow-hidden shrink-0 border border-slate-100 shadow-sm cursor-zoom-in group/card"
                                whileHover={{ scale: 1.05, y: -5 }}
                                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                onClick={() => setSelectedImage(img)}
                            >
                                <img
                                    src={img.image_url}
                                    alt="Momentos de Peregrinação"
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover/card:scale-110"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover/card:bg-black/20 transition-colors duration-300 flex items-center justify-center opacity-0 group-hover/card:opacity-100">
                                    <ZoomIn className="text-white w-8 h-8 drop-shadow-md" />
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Lightbox Modal */}
            <AnimatePresence>
                {selectedImage && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSelectedImage(null)}
                        className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 md:p-10 cursor-zoom-out"
                    >
                        <button
                            onClick={() => setSelectedImage(null)}
                            className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors p-2"
                        >
                            <X size={32} />
                        </button>

                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="relative max-w-5xl max-h-[85vh] w-full flex items-center justify-center overflow-hidden rounded-lg shadow-2xl"
                            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking image
                        >
                            <img
                                src={selectedImage.image_url}
                                alt="Expanded View"
                                className="max-w-full max-h-[85vh] object-contain rounded-md"
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    );
}

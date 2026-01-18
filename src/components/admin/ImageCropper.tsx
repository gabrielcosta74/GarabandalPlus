"use client";

import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { motion } from 'framer-motion';
import { X, Check, Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import getCroppedImg from '../../lib/cropImage';

interface ImageCropperProps {
    imageSrc: string;
    aspect?: number;
    onCropComplete: (croppedFile: File) => void;
    onCancel: () => void;
}

export default function ImageCropper({ imageSrc, aspect = 3 / 4, onCropComplete, onCancel }: ImageCropperProps) {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [loading, setLoading] = useState(false);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

    const onCropChange = (crop: { x: number; y: number }) => {
        setCrop(crop);
    };

    const onZoomChange = (zoom: number) => {
        setZoom(zoom);
    };

    const onCropCompleteCallback = useCallback((croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleSave = async () => {
        setLoading(true);
        try {
            const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
            if (croppedImage) {
                onCropComplete(croppedImage);
            }
        } catch (e) {
            console.error(e);
            alert("Erro ao recortar imagem");
            setLoading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-0 md:p-4"
        >
            <div className="bg-white w-full h-full md:h-[80vh] md:max-w-2xl md:rounded-2xl overflow-hidden flex flex-col relative shadow-2xl">
                {/* Header */}
                <div className="p-4 border-b flex items-center justify-between z-10 bg-white shrink-0">
                    <h3 className="font-bold text-lg text-gray-900">Ajustar Imagem</h3>
                    <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Cropper Area */}
                <div className="relative flex-1 bg-black">
                    <div className="absolute inset-0">
                        <Cropper
                            image={imageSrc}
                            crop={crop}
                            zoom={zoom}
                            aspect={aspect}
                            onCropChange={onCropChange}
                            onCropComplete={onCropCompleteCallback}
                            onZoomChange={onZoomChange}
                            minZoom={0.5}
                            maxZoom={3}
                            // Allows user to move image freely to find best fit
                            restrictPosition={true}
                        />
                    </div>
                </div>

                {/* Controls */}
                <div className="p-6 border-t bg-white flex flex-col gap-6 shrink-0 safe-area-bottom">
                    <div className="flex items-center gap-4">
                        <ZoomOut className="w-5 h-5 text-gray-400" />
                        <input
                            type="range"
                            value={zoom}
                            min={0.5}
                            max={3}
                            step={0.1}
                            aria-labelledby="Zoom"
                            onChange={(e) => setZoom(Number(e.target.value))}
                            className="flex-1 h-3 bg-gray-200 rounded-full appearance-none cursor-pointer accent-indigo-600 active:accent-indigo-700"
                        />
                        <ZoomIn className="w-5 h-5 text-gray-400" />
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={onCancel}
                            className="flex-1 px-4 py-3 text-base font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="flex-1 px-4 py-3 bg-indigo-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-lg shadow-indigo-200"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                            Aplicar
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

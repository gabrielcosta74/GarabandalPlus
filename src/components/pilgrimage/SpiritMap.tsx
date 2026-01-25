"use client";

import * as React from 'react';
import { useRef, useState, useEffect, useCallback } from 'react';
import Map, { Marker, Source, Layer, MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapPin, Plane, Play, Pause, SkipBack, SkipForward, MousePointer2 } from 'lucide-react';

type Stage = {
    id: string;
    title: string;
    description?: string;
    lat: number;
    lng: number;
    image_url?: string;
    display_order: number;
};

interface SpiritMapProps {
    stages: Stage[];
    height?: number;
}

export default function SpiritMap({ stages, height = 500 }: SpiritMapProps) {
    const mapRef = useRef<MapRef>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [activeStageIndex, setActiveStageIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [viewMode, setViewMode] = useState<'story' | 'free'>('story');

    // Sort stages just in case
    const sortedStages = React.useMemo(() =>
        [...stages].sort((a, b) => a.display_order - b.display_order),
        [stages]);

    const activeStage = sortedStages[activeStageIndex];

    // --- Camera Control ---
    const flyToStage = useCallback((index: number) => {
        const stage = sortedStages[index];
        if (!stage || !mapRef.current) return;

        mapRef.current.flyTo({
            center: [stage.lng, stage.lat],
            zoom: 11, // Close up view
            pitch: 60, // Cinematic tilt
            bearing: -20, // Slight angle
            duration: 3000,
            essential: true
        });
    }, [sortedStages]);

    const flyToOverview = useCallback(() => {
        if (!mapRef.current || sortedStages.length === 0) return;
        // Calculate bounds
        const lons = sortedStages.map(s => s.lng);
        const lats = sortedStages.map(s => s.lat);
        const minLon = Math.min(...lons);
        const maxLon = Math.max(...lons);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);

        mapRef.current.fitBounds(
            [[minLon, minLat], [maxLon, maxLat]],
            { padding: 100, pitch: 30, bearing: 0, duration: 2000 }
        );
    }, [sortedStages]);

    // --- Sequencing Logic ---
    useEffect(() => {
        if (!isLoaded) return;

        // If switching to Story Mode, go to current active stage
        if (viewMode === 'story') {
            flyToStage(activeStageIndex);
        } else {
            // Free mode - maybe zoom out a bit?
            flyToOverview();
        }
    }, [viewMode, isLoaded, activeStageIndex, flyToStage, flyToOverview]);

    // Auto-Play Timer
    useEffect(() => {
        if (!isPlaying || viewMode !== 'story') return;

        const timer = setTimeout(() => {
            const nextIndex = (activeStageIndex + 1) % sortedStages.length;
            setActiveStageIndex(nextIndex);
        }, 8000); // 8 seconds per slide (3s travel + 5s reading)

        return () => clearTimeout(timer);
    }, [isPlaying, viewMode, activeStageIndex, sortedStages.length]);


    // --- Event Handlers ---
    const handleNext = () => {
        const next = (activeStageIndex + 1) % sortedStages.length;
        setActiveStageIndex(next);
        setViewMode('story');
    };

    const handlePrev = () => {
        const prev = (activeStageIndex - 1 + sortedStages.length) % sortedStages.length;
        setActiveStageIndex(prev);
        setViewMode('story');
    };

    const togglePlay = () => {
        setIsPlaying(!isPlaying);
        if (!isPlaying) setViewMode('story');
    };

    // GeoJSON for the Path
    const routeGeoJSON = React.useMemo<GeoJSON.Feature<GeoJSON.LineString> | null>(() => {
        if (sortedStages.length < 2) return null;
        return {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: sortedStages.map(s => [s.lng, s.lat])
            }
        };
    }, [sortedStages]);

    return (
        <div className="rounded-3xl overflow-hidden shadow-2xl border border-slate-800 bg-slate-950 relative group select-none" style={{ height }}>

            {/* --- 3D MAP --- */}
            <Map
                ref={mapRef}
                initialViewState={{
                    longitude: -4.0,
                    latitude: 40.0,
                    zoom: 4,
                    pitch: 45
                }}
                onLoad={() => setIsLoaded(true)}
                onMove={() => {
                    // Keep manual toggle
                }}
                mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
                terrain={{ source: 'terrain', exaggeration: 1.5 }}
            >
                {/* Route Line */}
                {routeGeoJSON && (
                    <Source id="route" type="geojson" data={routeGeoJSON}>
                        <Layer
                            id="route-layer"
                            type="line"
                            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                            paint={{
                                'line-color': '#F59E0B',
                                'line-width': 3,
                                'line-opacity': 0.6,
                                'line-dasharray': [2, 1]
                            }}
                        />
                    </Source>
                )}

                {/* Markers */}
                {sortedStages.map((stage, index) => {
                    const isActive = index === activeStageIndex && viewMode === 'story';
                    return (
                        <Marker
                            key={stage.id}
                            longitude={stage.lng}
                            latitude={stage.lat}
                            anchor="bottom"
                            onClick={(e) => {
                                e.originalEvent.stopPropagation();
                                setActiveStageIndex(index);
                                setViewMode('story');
                                setIsPlaying(false); // Stop auto-play if user clicks specific
                            }}
                        >
                            <div className={`
                            relative flex flex-col items-center transition-all duration-500
                            ${isActive ? 'scale-125 z-10' : 'scale-75 opacity-70 hover:opacity-100 hover:scale-110'}
                        `}>
                                {/* Pin */}
                                <div className={`
                                w-auto min-w-[32px] h-8 px-2 rounded-full border-2 flex items-center justify-center shadow-lg transition-colors gap-1
                                ${isActive ? 'bg-yellow-500 border-yellow-300 text-slate-900' : 'bg-slate-800 border-slate-600 text-white'}
                            `}>
                                    {index === 0 ? <span className="text-[10px] font-black">INÍCIO</span> :
                                        index === sortedStages.length - 1 ? <MapPin className="w-4 h-4" /> :
                                            <span className="text-[10px] font-bold">{index + 1}</span>}
                                </div>

                                {/* Pulse Effect for Active */}
                                {isActive && (
                                    <div className="absolute top-0 w-8 h-8 bg-yellow-400/50 rounded-full animate-ping -z-10" />
                                )}
                            </div>
                        </Marker>
                    );
                })}
            </Map>


            {/* --- UI OVERLAYS --- */}

            {/* 1. Header & Title */}
            <div className="absolute top-6 left-6 z-10 pointer-events-none">
                <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-full border border-yellow-500/20 shadow-lg">
                    <Plane className="w-4 h-4 text-yellow-500" />
                    <span className="text-yellow-100 text-xs font-bold uppercase tracking-wider">
                        {viewMode === 'story' ? 'Modo Visita Guiada' : 'Modo Livre'}
                    </span>
                </div>
            </div>

            {/* 2. Active Stage Card (Rich UI) - Only in Story Mode */}
            {viewMode === 'story' && activeStage && (
                <div className="absolute bottom-24 left-6 z-10 md:bottom-auto md:top-20 md:left-6 max-w-[280px] md:max-w-sm">
                    <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-700 p-0 rounded-2xl shadow-2xl overflow-hidden transition-all duration-500 transform translate-y-0 opacity-100">
                        {/* Image Area */}
                        <div className="h-32 w-full bg-slate-800 relative">
                            {activeStage.image_url ? (
                                <img src={activeStage.image_url} alt={activeStage.title} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-600">
                                    <MapPin className="w-8 h-8 opacity-20" />
                                </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent" />

                            {/* Day / Order Badge */}
                            <div className="absolute top-3 left-3 bg-yellow-500 text-slate-900 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                                PARAGEM {activeStage.display_order}
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-4 relative -mt-4">
                            <h2 className="text-xl font-bold text-white leading-tight mb-1">{activeStage.title}</h2>
                            <p className="text-sm text-slate-300 leading-relaxed">{activeStage.description}</p>
                        </div>

                        {/* Progress Bar (if playing) */}
                        {isPlaying && (
                            <div className="h-1 w-full bg-slate-800 relative overflow-hidden">
                                <div className="absolute inset-0 bg-yellow-500 animate-[progress_8s_linear_infinite]" />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 3. Controls Bar */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-2xl border border-slate-700 shadow-xl">

                {/* Nav Buttons */}
                <button onClick={handlePrev} className="p-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors">
                    <SkipBack className="w-5 h-5" />
                </button>

                <button onClick={togglePlay} className="p-4 bg-yellow-500 hover:bg-yellow-400 text-black rounded-xl transition-all shadow-lg hover:shadow-yellow-500/20 active:scale-95">
                    {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
                </button>

                <button onClick={handleNext} className="p-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors">
                    <SkipForward className="w-5 h-5" />
                </button>

                <div className="w-px h-6 bg-slate-700 mx-1" />

                {/* Mode Toggle */}
                <button
                    onClick={() => {
                        const newMode = viewMode === 'story' ? 'free' : 'story';
                        setViewMode(newMode);
                        setIsPlaying(false);
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${viewMode === 'free' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                >
                    <MousePointer2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Livre</span>
                </button>
            </div>

            {/* Instructions */}
            {viewMode === 'free' && (
                <div className="absolute top-20 right-6 z-10 bg-black/50 backdrop-blur p-2 rounded-lg text-right">
                    <p className="text-[10px] text-slate-300">Arraste para mover</p>
                    <p className="text-[10px] text-slate-300">Ctrl + Arraste para rodar</p>
                </div>
            )}

            <style jsx global>{`
             @keyframes progress {
                 0% { transform: translateX(-100%); }
                 100% { transform: translateX(0%); }
             }
         `}</style>
        </div>
    );
}

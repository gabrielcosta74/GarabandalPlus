"use client";

import { useEffect, useState, useLayoutEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, Check, Play } from "lucide-react";
import { createPortal } from "react-dom";

type Step = {
    targetId: string;
    title: string;
    description: string;
    position: "top" | "bottom" | "left" | "right" | "center";
};

const TUTORIAL_STEPS: Step[] = [
    {
        targetId: "tut-hero",
        title: "Bem-vindo ao teu Espaço",
        description: "Este é o teu painel exclusivo. Aqui encontras o resumo da tua atividade e acesso rápido a todas as funcionalidades de membro.",
        position: "bottom",
    },
    {
        targetId: "tut-about",
        title: "A História de Garabandal",
        description: "Conhece a fundo as aparições. Acede a documentação histórica, mensagens originais e avisos proféticos.",
        position: "right",
    },
    {
        targetId: "tut-intentions",
        title: "Envia as tuas Intenções",
        description: "Acende uma vela virtual. As tuas intenções são apresentadas a Nossa Senhora na igreja paroquial.",
        position: "left",
    },
    {
        targetId: "tut-academy",
        title: "Academia e Cursos",
        description: "Acede a documentários exclusivos e cursos de formação. Aprende ao teu ritmo com conteúdos multimédia.",
        position: "right",
    },
    {
        targetId: "tut-novenas",
        title: "Novenas Guiadas",
        description: "Inicia uma jornada de oração de 9 dias. Nós ajudamos-te a manter a constância e devoção.",
        position: "left",
    },
    {
        targetId: "tut-live",
        title: "Garabandal em Direto",
        description: "Assiste às missas e celebrações diretamente da Igreja Paroquial. Estamos conectados 24/7.",
        position: "right",
    },
    {
        targetId: "tut-prayers",
        title: "Orações e Devoção",
        description: "Encontra paz com a nossa coleção de orações oficiais e o terço meditado.",
        position: "left",
    },
    {
        targetId: "tut-quota",
        title: "Gestão de Sócio",
        description: "Consulta o estado das tuas quotas, regulariza pagamentos e vê o teu número de sócio.",
        position: "top",
    },
    {
        targetId: "tut-history",
        title: "O Teu Histórico",
        description: "Consulta todos os teus donativos, compras na loja e interações passadas.",
        position: "top",
    },
    {
        targetId: "tut-card",
        title: "Cartão Digital",
        description: "Em breve, terás aqui o teu cartão de sócio digital para apresentar em eventos e obter descontos.",
        position: "top",
    },
];

export default function MemberTutorial() {
    const [activeStepIndex, setActiveStepIndex] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    // Separate state for rect to force re-render on resize
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

    // Check localStorage on mount
    useEffect(() => {
        const hasSeen = localStorage.getItem("garabandal_member_tutorial_V2");
        if (!hasSeen) {
            // Small delay to ensure UI is ready
            setTimeout(() => setIsOpen(true), 1500);
        }
    }, []);

    // Update rect when step changes or resize
    useLayoutEffect(() => {
        if (!isOpen) return;

        const updateRect = () => {
            const step = TUTORIAL_STEPS[activeStepIndex];
            const el = document.getElementById(step.targetId);
            if (el) {
                setTargetRect(el.getBoundingClientRect());
                // Scroll element into view smoothly if needed
                el.scrollIntoView({ behavior: "smooth", block: "center" });
            } else {
                // If element not found (e.g. mobile hidden), skip or fallback
                setTargetRect(null);
            }
        };

        updateRect();
        window.addEventListener("resize", updateRect);
        window.addEventListener("scroll", updateRect); // Update on scroll too to keep spotlight attached

        return () => {
            window.removeEventListener("resize", updateRect);
            window.removeEventListener("scroll", updateRect);
        };
    }, [activeStepIndex, isOpen]);

    const handleNext = () => {
        if (activeStepIndex < TUTORIAL_STEPS.length - 1) {
            setActiveStepIndex((prev) => prev + 1);
        } else {
            handleComplete();
        }
    };

    const handleComplete = () => {
        setIsOpen(false);
        localStorage.setItem("garabandal_member_tutorial_V2", "true");
    };

    const handleSkip = () => {
        handleComplete();
    };

    if (!isOpen) return null;

    const step = TUTORIAL_STEPS[activeStepIndex];
    const isLast = activeStepIndex === TUTORIAL_STEPS.length - 1;

    // We use a portal to ensure it's above everything
    return createPortal(
        <div className="fixed inset-0 z-[9999] overflow-hidden">

            {/* 1. Dark Overlay with SVG Mask for visual cutout */}
            {/* We use a heavy clip-path or simple 4-div approach if mask assumes complex support. 
          Actually, simple 4-div overlay is robust. */}
            {targetRect ? (
                <>
                    {/* Top */}
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="absolute top-0 left-0 right-0 bg-slate-950/80 backdrop-blur-[2px] transition-all duration-300 ease-out"
                        style={{ height: targetRect.top }}
                    />
                    {/* Bottom */}
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="absolute left-0 right-0 bottom-0 bg-slate-950/80 backdrop-blur-[2px] transition-all duration-300 ease-out"
                        style={{ top: targetRect.bottom }}
                    />
                    {/* Left */}
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="absolute left-0 top-0 bottom-0 bg-slate-950/80 backdrop-blur-[2px] transition-all duration-300 ease-out"
                        style={{ top: targetRect.top, height: targetRect.height, width: targetRect.left }}
                    />
                    {/* Right */}
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="absolute right-0 top-0 bottom-0 bg-slate-950/80 backdrop-blur-[2px] transition-all duration-300 ease-out"
                        style={{ top: targetRect.top, height: targetRect.height, left: targetRect.right }}
                    />

                    {/* Spotlight Border (The focused area) */}
                    <motion.div
                        className="absolute border-2 border-yellow-500 rounded-2xl shadow-[0_0_50px_rgba(234,179,8,0.3)] pointer-events-none"
                        style={{
                            top: targetRect.top - 4,
                            left: targetRect.left - 4,
                            width: targetRect.width + 8,
                            height: targetRect.height + 8,
                        }}
                        layoutId="spotlight"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                </>
            ) : (
                // Fallback full screen dark if rect invalid
                <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm" />
            )}


            {/* 2. Tooltip Card */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6 md:p-0">
                {/* Position logic can be complex. For robust simple onboarding in Next.js, 
             we stick to a floating card that isn't strictly attached if space is tight, 
             OR simple distinct placements. 
             Here we position absolutely based on rect if possible, or center if mobile. */}

                {targetRect && (
                    <motion.div
                        className="pointer-events-auto absolute w-full max-w-sm bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{
                            opacity: 1,
                            scale: 1,
                            y: 0,
                            // Basic positioning logic
                            top: window.innerWidth < 768
                                ? 'auto' // Mobile: stick to bottom usually
                                : targetRect.bottom + 20 > window.innerHeight - 200
                                    ? targetRect.top - 220 // If too low, show above
                                    : targetRect.bottom + 20, // Else show below
                            left: window.innerWidth < 768
                                ? '50%'
                                : Math.min(Math.max(20, targetRect.left), window.innerWidth - 400),
                            x: window.innerWidth < 768 ? '-50%' : 0,
                            bottom: window.innerWidth < 768 ? 40 : 'auto',
                        }}
                        transition={{ type: "spring", stiffness: 350, damping: 25 }}
                    >
                        {/* Progress Bar */}
                        <div className="h-1 bg-slate-800 w-full">
                            <motion.div
                                className="h-full bg-gradient-to-r from-yellow-500 to-yellow-600"
                                animate={{ width: `${((activeStepIndex + 1) / TUTORIAL_STEPS.length) * 100}%` }}
                            />
                        </div>

                        <div className="p-6">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-yellow-500">
                                    Passo {activeStepIndex + 1} de {TUTORIAL_STEPS.length}
                                </span>
                                <button onClick={handleSkip} className="text-slate-500 hover:text-white transition-colors">
                                    <X size={16} />
                                </button>
                            </div>

                            <h3 className="font-serif text-xl font-bold text-white mb-2">
                                {step.title}
                            </h3>
                            <p className="text-slate-400 text-sm leading-relaxed mb-6">
                                {step.description}
                            </p>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleNext}
                                    className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-yellow-900/20"
                                >
                                    {isLast ? (
                                        <>Começar <Check size={18} /></>
                                    ) : (
                                        <>Seguinte <ChevronRight size={18} /></>
                                    )}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>

        </div>,
        document.body
    );
}

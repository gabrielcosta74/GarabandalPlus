"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
    HeartHandshake,
    Globe,
    CalendarRange,
    MapPin,
    Footprints,
    GraduationCap,
    ShieldCheck,
    MessageSquareHeart,
    Check,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Sparkles,
    Mountain,
    PersonStanding,
    Accessibility,
} from "lucide-react";
import { supabaseBrowser, getBrowserAccessToken } from "../../lib/supabase-browser";
import { useLocale } from "../../contexts/LocaleContext";

/**
 * Popup obrigatório (gate) de candidatura a voluntário de apoio ao peregrino em Garabandal.
 * Aparece a todos os membros que ainda não responderam; uma pergunta por ecrã, mobile-first.
 * Quem escolhe "sem interesse de momento" também resolve o gate (não volta a aparecer).
 */

type Answers = {
    linguas: string[];
    disponibilidade: string;
    esteve_garabandal: string;
    condicao_fisica: string;
    compromisso_formacao: boolean;
    compromisso_colete: boolean;
    motivacao: string;
};

const LANGS = [
    { id: "pt", pt: "Português", en: "Portuguese", flag: "🇵🇹" },
    { id: "es", pt: "Espanhol", en: "Spanish", flag: "🇪🇸" },
    { id: "en", pt: "Inglês", en: "English", flag: "🇬🇧" },
    { id: "fr", pt: "Francês", en: "French", flag: "🇫🇷" },
    { id: "it", pt: "Italiano", en: "Italian", flag: "🇮🇹" },
    { id: "de", pt: "Alemão", en: "German", flag: "🇩🇪" },
    { id: "outra", pt: "Outra", en: "Other", flag: "🌍" },
];

const MONTHS = [
    { id: "jan", pt: "Jan", en: "Jan" }, { id: "fev", pt: "Fev", en: "Feb" },
    { id: "mar", pt: "Mar", en: "Mar" }, { id: "abr", pt: "Abr", en: "Apr" },
    { id: "mai", pt: "Mai", en: "May" }, { id: "jun", pt: "Jun", en: "Jun" },
    { id: "jul", pt: "Jul", en: "Jul" }, { id: "ago", pt: "Ago", en: "Aug" },
    { id: "set", pt: "Set", en: "Sep" }, { id: "out", pt: "Out", en: "Oct" },
    { id: "nov", pt: "Nov", en: "Nov" }, { id: "dez", pt: "Dez", en: "Dec" },
];

const DURATIONS = [
    { id: "dias", pt: "Alguns dias", en: "A few days" },
    { id: "1sem", pt: "± 1 semana", en: "~1 week" },
    { id: "2sem", pt: "± 2 semanas", en: "~2 weeks" },
    { id: "3-4sem", pt: "3 a 4 semanas", en: "3–4 weeks" },
    { id: "mes+", pt: "Mais de 1 mês", en: "Over 1 month" },
    { id: "flex", pt: "Flexível", en: "Flexible" },
];

const STEP_KEYS = [
    "linguas",
    "disponibilidade",
    "esteve",
    "fisica",
    "formacao",
    "colete",
    "motivacao",
] as const;

export default function VolunteerSurvey() {
    const { locale } = useLocale();
    const isEn = locale === "en";
    const t = <T,>(pt: T, en: T): T => (isEn ? en : pt);

    const [mounted, setMounted] = useState(false);
    const [open, setOpen] = useState(false);
    const [phase, setPhase] = useState<"intro" | "form" | "done">("intro");
    const [stepIndex, setStepIndex] = useState(0);
    const [direction, setDirection] = useState(1);
    const [submitting, setSubmitting] = useState(false);
    const [doneStatus, setDoneStatus] = useState<"candidato" | "nao_interessado">("candidato");

    // Disponibilidade estruturada (composta num texto legível no submit).
    const [availAnytime, setAvailAnytime] = useState(false);
    const [availMonths, setAvailMonths] = useState<string[]>([]);
    const [availDuration, setAvailDuration] = useState<string>("");
    const [availNote, setAvailNote] = useState("");

    const [answers, setAnswers] = useState<Answers>({
        linguas: [],
        disponibilidade: "",
        esteve_garabandal: "",
        condicao_fisica: "",
        compromisso_formacao: false,
        compromisso_colete: false,
        motivacao: "",
    });

    useEffect(() => setMounted(true), []);

    // Decidir se o gate aparece: só para membros autenticados que ainda não responderam.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                if (!supabaseBrowser) return;
                const { data: { user } } = await supabaseBrowser.auth.getUser();
                if (!user) return;
                const token = await getBrowserAccessToken().catch(() => null);
                if (!token) return;
                const res = await fetch("/api/member/voluntariado", {
                    headers: { Authorization: `Bearer ${token}` },
                    cache: "no-store",
                });
                const data = await res.json().catch(() => null);
                if (!cancelled && res.ok && !data?.responded) {
                    setOpen(true);
                }
            } catch {
                /* falha silenciosa — não bloquear a área de membros */
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // Bloquear scroll do body enquanto o gate está aberto.
    useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = prev; };
    }, [open]);

    const toggleLang = (id: string) => {
        setAnswers((a) => ({
            ...a,
            linguas: a.linguas.includes(id)
                ? a.linguas.filter((x) => x !== id)
                : [...a.linguas, id],
        }));
    };

    const toggleMonth = (id: string) => {
        setAvailMonths((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
        setAvailAnytime(false);
    };

    // Compõe a disponibilidade num texto legível para o admin/email.
    const composeAvailability = (): string => {
        const parts: string[] = [];
        if (availAnytime) {
            parts.push(t("Qualquer altura do ano", "Any time of year"));
        } else if (availMonths.length) {
            const labels = MONTHS.filter((m) => availMonths.includes(m.id)).map((m) => t(m.pt, m.en));
            parts.push(`${t("Meses", "Months")}: ${labels.join(", ")}`);
        }
        if (availDuration) {
            const d = DURATIONS.find((x) => x.id === availDuration);
            if (d) parts.push(`${t("Duração", "Duration")}: ${t(d.pt, d.en)}`);
        }
        if (availNote.trim()) parts.push(`${t("Nota", "Note")}: ${availNote.trim()}`);
        return parts.join(" · ");
    };

    const currentKey = STEP_KEYS[stepIndex];

    const canAdvance = useMemo(() => {
        switch (currentKey) {
            case "linguas": return answers.linguas.length > 0;
            case "disponibilidade": return (availAnytime || availMonths.length > 0) && !!availDuration;
            case "esteve": return !!answers.esteve_garabandal;
            case "fisica": return !!answers.condicao_fisica;
            case "formacao": return answers.compromisso_formacao;
            case "colete": return answers.compromisso_colete;
            case "motivacao": return true; // opcional
            default: return false;
        }
    }, [currentKey, answers, availAnytime, availMonths, availDuration]);

    const isLast = stepIndex === STEP_KEYS.length - 1;

    const goNext = () => {
        if (!canAdvance) return;
        if (isLast) { submit("candidato"); return; }
        setDirection(1);
        setStepIndex((i) => i + 1);
    };
    const goBack = () => {
        if (stepIndex === 0) { setPhase("intro"); return; }
        setDirection(-1);
        setStepIndex((i) => i - 1);
    };

    const submit = async (status: "candidato" | "nao_interessado") => {
        setSubmitting(true);
        try {
            const token = await getBrowserAccessToken();
            const payload = status === "candidato"
                ? { status, ...answers, disponibilidade: composeAvailability() }
                : { status };
            const res = await fetch("/api/member/voluntariado", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => null);
                throw new Error(d?.error || t("Falha ao enviar.", "Failed to submit."));
            }
            setDoneStatus(status);
            setPhase("done");
        } catch (e: any) {
            alert(e?.message || t("Ocorreu um erro. Tente novamente.", "Something went wrong. Please try again."));
        } finally {
            setSubmitting(false);
        }
    };

    if (!mounted || !open) return null;

    const accent = "#0f4c81";

    const choiceCard = (
        active: boolean,
        onClick: () => void,
        title: string,
        subtitle?: string,
        emoji?: React.ReactNode,
    ) => (
        <button
            type="button"
            onClick={onClick}
            style={{
                display: "flex", alignItems: "center", gap: 14, width: "100%",
                padding: "16px 18px", borderRadius: 16, cursor: "pointer",
                textAlign: "left", transition: "all .15s ease",
                border: `2px solid ${active ? accent : "#e2e8f0"}`,
                background: active ? "rgba(15,76,129,0.06)" : "#fff",
                boxShadow: active ? "0 6px 18px rgba(15,76,129,0.12)" : "none",
            }}
        >
            {emoji && <span style={{ fontSize: 26, lineHeight: 1 }}>{emoji}</span>}
            <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontWeight: 700, color: "#0f172a", fontSize: 15 }}>{title}</span>
                {subtitle && <span style={{ display: "block", color: "#64748b", fontSize: 13, marginTop: 2 }}>{subtitle}</span>}
            </span>
            <span style={{
                width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                border: `2px solid ${active ? accent : "#cbd5e1"}`,
                background: active ? accent : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
            }}>
                {active && <Check size={14} color="#fff" strokeWidth={3} />}
            </span>
        </button>
    );

    const stepMeta: Record<typeof STEP_KEYS[number], { icon: any; title: string; hint?: string }> = {
        linguas: {
            icon: Globe,
            title: t("Que línguas fala?", "Which languages do you speak?"),
            hint: t("Para acolher peregrinos de vários países. Escolha todas as que se aplicam.",
                "To welcome pilgrims from many countries. Select all that apply."),
        },
        disponibilidade: {
            icon: CalendarRange,
            title: t("Qual a sua disponibilidade?", "What is your availability?"),
            hint: t("É só para termos uma ideia aproximada — os detalhes serão combinados mais à frente, sem compromisso.",
                "Just to get a rough idea — the details will be arranged later, with no commitment."),
        },
        esteve: {
            icon: MapPin,
            title: t("Já esteve em Garabandal?", "Have you been to Garabandal before?"),
        },
        fisica: {
            icon: Footprints,
            title: t("Tem condição física para caminhar até aos locais das aparições?",
                "Are you physically able to walk to the apparition sites?"),
            hint: t("Implica subir aos Pinos (caminho em subida).",
                "It involves climbing to the Pines (an uphill path)."),
        },
        formacao: {
            icon: GraduationCap,
            title: t("Compromisso de formação", "Training commitment"),
            hint: t("Antes de servir, é obrigatório frequentar uns dias de formação específica do Apostolado.",
                "Before serving, attending specific Apostolate training days is mandatory."),
        },
        colete: {
            icon: ShieldCheck,
            title: t("Colete e orientações", "Vest & guidelines"),
            hint: t("Durante o serviço usará o colete identificativo do Apostolado e seguirá as suas orientações.",
                "During service you will wear the Apostolate's identifying vest and follow its guidelines."),
        },
        motivacao: {
            icon: MessageSquareHeart,
            title: t("Porque sente este chamamento?", "Why do you feel this calling?"),
            hint: t("Partilhe, se quiser, o que o move a servir em Garabandal. (Opcional)",
                "Share, if you wish, what moves you to serve in Garabandal. (Optional)"),
        },
    };

    const renderStepBody = () => {
        switch (currentKey) {
            case "linguas":
                return (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        {LANGS.map((l) => {
                            const active = answers.linguas.includes(l.id);
                            return (
                                <button key={l.id} type="button" onClick={() => toggleLang(l.id)}
                                    style={{
                                        display: "flex", alignItems: "center", gap: 10, padding: "13px 14px",
                                        borderRadius: 14, cursor: "pointer", fontWeight: 600, fontSize: 14,
                                        border: `2px solid ${active ? accent : "#e2e8f0"}`,
                                        background: active ? "rgba(15,76,129,0.06)" : "#fff",
                                        color: "#0f172a", transition: "all .15s ease",
                                    }}>
                                    <span style={{ fontSize: 20 }}>{l.flag}</span>
                                    <span style={{ flex: 1, textAlign: "left" }}>{t(l.pt, l.en)}</span>
                                    {active && <Check size={16} color={accent} strokeWidth={3} />}
                                </button>
                            );
                        })}
                    </div>
                );
            case "disponibilidade":
                return (
                    <div style={{ display: "grid", gap: 18 }}>
                        {/* Quando */}
                        <div>
                            <div style={fieldLabel}>{t("Em que altura poderia ir?", "When could you go?")}</div>
                            <button type="button" onClick={() => { setAvailAnytime((v) => !v); setAvailMonths([]); }}
                                style={{
                                    display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px 14px",
                                    borderRadius: 13, cursor: "pointer", fontWeight: 700, fontSize: 14, marginBottom: 10,
                                    border: `2px solid ${availAnytime ? accent : "#e2e8f0"}`,
                                    background: availAnytime ? "rgba(15,76,129,0.06)" : "#fff", color: "#0f172a",
                                }}>
                                <span style={{ fontSize: 18 }}>🗓️</span>
                                <span style={{ flex: 1, textAlign: "left" }}>{t("Sou flexível — qualquer altura", "I'm flexible — any time")}</span>
                                {availAnytime && <Check size={16} color={accent} strokeWidth={3} />}
                            </button>
                            <div style={{
                                display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8,
                                opacity: availAnytime ? 0.4 : 1, pointerEvents: availAnytime ? "none" : "auto",
                            }}>
                                {MONTHS.map((mo) => {
                                    const active = availMonths.includes(mo.id);
                                    return (
                                        <button key={mo.id} type="button" onClick={() => toggleMonth(mo.id)}
                                            style={{
                                                padding: "10px 0", borderRadius: 11, cursor: "pointer",
                                                fontWeight: 700, fontSize: 13.5,
                                                border: `2px solid ${active ? accent : "#e2e8f0"}`,
                                                background: active ? accent : "#fff",
                                                color: active ? "#fff" : "#0f172a", transition: "all .12s ease",
                                            }}>
                                            {t(mo.pt, mo.en)}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Duração */}
                        <div>
                            <div style={fieldLabel}>{t("Por quanto tempo?", "For how long?")}</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                {DURATIONS.map((d) => {
                                    const active = availDuration === d.id;
                                    return (
                                        <button key={d.id} type="button" onClick={() => setAvailDuration(d.id)}
                                            style={{
                                                padding: "10px 15px", borderRadius: 999, cursor: "pointer",
                                                fontWeight: 700, fontSize: 13.5,
                                                border: `2px solid ${active ? accent : "#e2e8f0"}`,
                                                background: active ? "rgba(15,76,129,0.06)" : "#fff",
                                                color: active ? accent : "#0f172a", transition: "all .12s ease",
                                            }}>
                                            {t(d.pt, d.en)}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <input
                            value={availNote}
                            onChange={(e) => setAvailNote(e.target.value)}
                            placeholder={t("Nota (opcional) — ex.: depende das férias", "Note (optional) — e.g.: depends on holidays")}
                            maxLength={160}
                            style={{
                                width: "100%", padding: "12px 14px", borderRadius: 13, fontSize: 14,
                                border: "2px solid #e2e8f0", fontFamily: "inherit", color: "#0f172a",
                                outline: "none", boxSizing: "border-box",
                            }}
                        />
                    </div>
                );
            case "esteve":
                return (
                    <div style={{ display: "grid", gap: 10 }}>
                        {choiceCard(answers.esteve_garabandal === "varias", () => setAnswers((a) => ({ ...a, esteve_garabandal: "varias" })), t("Sim, várias vezes", "Yes, several times"), undefined, "🙏")}
                        {choiceCard(answers.esteve_garabandal === "uma", () => setAnswers((a) => ({ ...a, esteve_garabandal: "uma" })), t("Sim, uma vez", "Yes, once"), undefined, "✨")}
                        {choiceCard(answers.esteve_garabandal === "nao", () => setAnswers((a) => ({ ...a, esteve_garabandal: "nao" })), t("Ainda não", "Not yet"), undefined, "🧭")}
                    </div>
                );
            case "fisica":
                return (
                    <div style={{ display: "grid", gap: 10 }}>
                        {choiceCard(answers.condicao_fisica === "sem_limitacoes", () => setAnswers((a) => ({ ...a, condicao_fisica: "sem_limitacoes" })), t("Sim, sem limitações", "Yes, no limitations"), undefined, <Mountain size={24} color="#16a34a" />)}
                        {choiceCard(answers.condicao_fisica === "algumas_limitacoes", () => setAnswers((a) => ({ ...a, condicao_fisica: "algumas_limitacoes" })), t("Com algumas limitações", "With some limitations"), undefined, <PersonStanding size={24} color="#d97706" />)}
                        {choiceCard(answers.condicao_fisica === "dificuldade", () => setAnswers((a) => ({ ...a, condicao_fisica: "dificuldade" })), t("Tenho dificuldade em subidas", "I struggle with uphill walks"), undefined, <Accessibility size={24} color="#64748b" />)}
                    </div>
                );
            case "formacao":
                return (
                    <div style={{ display: "grid", gap: 10 }}>
                        {choiceCard(answers.compromisso_formacao, () => setAnswers((a) => ({ ...a, compromisso_formacao: true })),
                            t("Sim, comprometo-me a fazer a formação", "Yes, I commit to attending the training"),
                            t("Reconheço que é obrigatória antes de servir.", "I acknowledge it is mandatory before serving."), "✅")}
                    </div>
                );
            case "colete":
                return (
                    <div style={{ display: "grid", gap: 10 }}>
                        {choiceCard(answers.compromisso_colete, () => setAnswers((a) => ({ ...a, compromisso_colete: true })),
                            t("Sim, aceito usar o colete e seguir as orientações", "Yes, I will wear the vest and follow the guidelines"),
                            t("Represento o Apostolado junto dos peregrinos.", "I represent the Apostolate before the pilgrims."), "🦺")}
                    </div>
                );
            case "motivacao":
                return (
                    <textarea
                        autoFocus
                        value={answers.motivacao}
                        onChange={(e) => setAnswers((a) => ({ ...a, motivacao: e.target.value }))}
                        placeholder={t("Escreva aqui a sua motivação… (opcional)", "Write your motivation here… (optional)")}
                        rows={5}
                        style={{
                            width: "100%", padding: "14px 16px", borderRadius: 14, fontSize: 15,
                            border: "2px solid #e2e8f0", resize: "vertical", fontFamily: "inherit",
                            color: "#0f172a", outline: "none", boxSizing: "border-box",
                        }}
                    />
                );
            default:
                return null;
        }
    };

    const overlay = (
        <div style={{
            position: "fixed", inset: 0, zIndex: 99999,
            background: "rgba(8,15,30,0.62)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
            padding: "0", overscrollBehavior: "contain",
        }}>
            <motion.div
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 28 }}
                style={{
                    width: "100%", maxWidth: 480, background: "#fff",
                    borderTopLeftRadius: 26, borderTopRightRadius: 26,
                    borderRadius: "26px 26px 0 0",
                    maxHeight: "94vh", display: "flex", flexDirection: "column",
                    overflow: "hidden", boxShadow: "0 -10px 40px rgba(0,0,0,0.25)",
                }}
                className="volunteer-survey-sheet"
            >
                {/* Header */}
                <div style={{
                    background: `linear-gradient(135deg, ${accent}, #1d6fb8)`,
                    color: "#fff", padding: "20px 22px 18px", position: "relative",
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, letterSpacing: 0.5, textTransform: "uppercase", opacity: 0.92 }}>
                        <HeartHandshake size={16} />
                        {t("Servir em Garabandal", "Serve in Garabandal")}
                    </div>
                    {phase === "form" && (
                        <div style={{ marginTop: 14, display: "flex", gap: 5 }}>
                            {STEP_KEYS.map((_, i) => (
                                <div key={i} style={{
                                    height: 4, flex: 1, borderRadius: 4,
                                    background: i <= stepIndex ? "#fff" : "rgba(255,255,255,0.32)",
                                    transition: "background .3s ease",
                                }} />
                            ))}
                        </div>
                    )}
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflowY: "auto", padding: "22px 22px 4px" }}>
                    <AnimatePresence mode="wait" custom={direction}>
                        {phase === "intro" && (
                            <motion.div key="intro"
                                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }}>
                                <div style={{
                                    width: 56, height: 56, borderRadius: 18, marginBottom: 16,
                                    background: "rgba(15,76,129,0.08)", display: "flex", alignItems: "center", justifyContent: "center",
                                }}>
                                    <Sparkles size={28} color={accent} />
                                </div>
                                <h2 style={{ margin: "0 0 10px", fontSize: 21, fontWeight: 800, color: "#0f172a", lineHeight: 1.25 }}>
                                    {t("Sente a missão de servir em Garabandal?",
                                        "Do you feel called to serve in Garabandal?")}
                                </h2>
                                <p style={{ margin: 0, color: "#475569", fontSize: 14.5, lineHeight: 1.6 }}>
                                    {t(
                                        "Estamos a formar um grupo restrito de voluntários de apoio ao peregrino. Quem servir terá alojamento na casa do Apostolado e ajudará a acolher os peregrinos, contar a história das aparições, levá-los aos locais santos e apoiar a paróquia de Garabandal.",
                                        "We are forming a small group of pilgrim-support volunteers. Those who serve will be hosted at the Apostolate's house and will help welcome pilgrims, share the story of the apparitions, take them to the holy sites and support the Garabandal parish.",
                                    )}
                                </p>
                                <div style={{
                                    margin: "16px 0 0", padding: "12px 14px", borderRadius: 12,
                                    background: "rgba(15,76,129,0.05)", border: "1px solid rgba(15,76,129,0.12)",
                                    display: "flex", gap: 10,
                                }}>
                                    <span style={{ fontSize: 17, lineHeight: 1.4 }}>🏠</span>
                                    <p style={{ margin: 0, color: "#334155", fontSize: 13, lineHeight: 1.55 }}>
                                        {t(
                                            "O alojamento na casa do Apostolado é oferecido com todo o carinho. As refeições e a viagem até Garabandal ficam a cargo de cada voluntário — com toda a simplicidade, é assim que partilhamos esta missão.",
                                            "Lodging at the Apostolate's house is offered with all our care. Meals and travel to Garabandal are each volunteer's own responsibility — in all simplicity, that's how we share this mission together.",
                                        )}
                                    </p>
                                </div>
                                <p style={{ margin: "12px 0 0", color: "#475569", fontSize: 13.5, lineHeight: 1.6 }}>
                                    {t(
                                        "Responder leva menos de 1 minuto. Já temos os seus contactos da sua conta de membro.",
                                        "Answering takes less than 1 minute. We already have your contact details from your member account.",
                                    )}
                                </p>
                            </motion.div>
                        )}

                        {phase === "form" && (
                            <motion.div key={currentKey} custom={direction}
                                initial={{ opacity: 0, x: direction > 0 ? 40 : -40 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: direction > 0 ? -40 : 40 }}
                                transition={{ duration: 0.22 }}>
                                <div style={{
                                    width: 48, height: 48, borderRadius: 14, marginBottom: 14,
                                    background: "rgba(15,76,129,0.08)", display: "flex", alignItems: "center", justifyContent: "center",
                                }}>
                                    {(() => { const Icon = stepMeta[currentKey].icon; return <Icon size={24} color={accent} />; })()}
                                </div>
                                <h2 style={{ margin: "0 0 6px", fontSize: 19, fontWeight: 800, color: "#0f172a", lineHeight: 1.3 }}>
                                    {stepMeta[currentKey].title}
                                </h2>
                                {stepMeta[currentKey].hint && (
                                    <p style={{ margin: "0 0 18px", color: "#64748b", fontSize: 13.5, lineHeight: 1.55 }}>
                                        {stepMeta[currentKey].hint}
                                    </p>
                                )}
                                {renderStepBody()}
                            </motion.div>
                        )}

                        {phase === "done" && (
                            <motion.div key="done"
                                initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                                style={{ textAlign: "center", padding: "20px 4px 8px" }}>
                                <div style={{
                                    width: 68, height: 68, borderRadius: "50%", margin: "0 auto 18px",
                                    background: doneStatus === "candidato" ? "#dcfce7" : "#f1f5f9",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                }}>
                                    {doneStatus === "candidato"
                                        ? <Check size={34} color="#16a34a" strokeWidth={3} />
                                        : <HeartHandshake size={32} color="#64748b" />}
                                </div>
                                <h2 style={{ margin: "0 0 10px", fontSize: 20, fontWeight: 800, color: "#0f172a" }}>
                                    {doneStatus === "candidato"
                                        ? t("Candidatura enviada!", "Application sent!")
                                        : t("Obrigado pela sua resposta", "Thank you for your reply")}
                                </h2>
                                <p style={{ margin: 0, color: "#475569", fontSize: 14.5, lineHeight: 1.6 }}>
                                    {doneStatus === "candidato"
                                        ? t("O Apostolado vai analisar a sua candidatura e entrará em contacto consigo. Que Nossa Senhora do Carmo o acompanhe.",
                                            "The Apostolate will review your application and get in touch with you. May Our Lady of Mount Carmel be with you.")
                                        : t("Sem problema. Se um dia sentir este chamamento, fale connosco.",
                                            "No problem. If one day you feel this calling, reach out to us.")}
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer / actions */}
                <div style={{ padding: "14px 22px calc(16px + env(safe-area-inset-bottom))", borderTop: "1px solid #f1f5f9" }}>
                    {phase === "intro" && (
                        <div style={{ display: "grid", gap: 10 }}>
                            <button type="button" onClick={() => { setPhase("form"); setStepIndex(0); setDirection(1); }}
                                style={primaryBtn(accent)}>
                                {t("Quero candidatar-me", "I want to apply")}
                                <ChevronRight size={18} />
                            </button>
                            <button type="button" disabled={submitting} onClick={() => submit("nao_interessado")}
                                style={ghostBtn()}>
                                {submitting ? <Loader2 size={16} className="vs-spin" /> : t("Não tenho interesse de momento", "Not interested right now")}
                            </button>
                        </div>
                    )}

                    {phase === "form" && (
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                            <button type="button" onClick={goBack} disabled={submitting}
                                style={{ ...ghostBtn(), width: 52, padding: 0, height: 50 }}>
                                <ChevronLeft size={20} />
                            </button>
                            <button type="button" onClick={goNext} disabled={!canAdvance || submitting}
                                style={{ ...primaryBtn(accent), flex: 1, opacity: canAdvance && !submitting ? 1 : 0.5 }}>
                                {submitting
                                    ? <Loader2 size={18} className="vs-spin" />
                                    : isLast
                                        ? <>{t("Enviar candidatura", "Send application")}<Check size={18} /></>
                                        : <>{t("Continuar", "Continue")}<ChevronRight size={18} /></>}
                            </button>
                        </div>
                    )}

                    {phase === "done" && (
                        <button type="button" onClick={() => setOpen(false)} style={primaryBtn(accent)}>
                            {t("Concluir", "Done")}
                        </button>
                    )}
                </div>
            </motion.div>

            <style>{`
                @media (min-width: 560px) {
                    .volunteer-survey-sheet { border-radius: 26px !important; margin-bottom: 4vh; }
                }
                .vs-spin { animation: vs-spin 0.8s linear infinite; }
                @keyframes vs-spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );

    return createPortal(overlay, document.body);
}

const fieldLabel: React.CSSProperties = {
    fontSize: 12.5, fontWeight: 700, color: "#475569", marginBottom: 9,
    textTransform: "uppercase", letterSpacing: 0.3,
};

function primaryBtn(accent: string): React.CSSProperties {
    return {
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        width: "100%", height: 52, borderRadius: 14, border: "none", cursor: "pointer",
        background: accent, color: "#fff", fontWeight: 700, fontSize: 15.5,
    };
}
function ghostBtn(): React.CSSProperties {
    return {
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        width: "100%", height: 50, borderRadius: 14, cursor: "pointer",
        background: "#fff", color: "#64748b", fontWeight: 600, fontSize: 14,
        border: "1.5px solid #e2e8f0",
    };
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { AlertTriangle, Bus, CheckCircle2, Circle, Loader2, QrCode, RefreshCw, Search, Video, VideoOff, XCircle } from 'lucide-react';
import { getBrowserAccessToken } from '../../lib/supabase-browser';

declare global {
    interface Navigator {
        webkitGetUserMedia?: (
            constraints: MediaStreamConstraints,
            successCallback: (stream: MediaStream) => void,
            errorCallback: (error: DOMException) => void
        ) => void;
        mozGetUserMedia?: (
            constraints: MediaStreamConstraints,
            successCallback: (stream: MediaStream) => void,
            errorCallback: (error: DOMException) => void
        ) => void;
    }

    interface Window {
        BarcodeDetector?: {
            new(options?: { formats?: string[] }): {
                detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
            };
            getSupportedFormats?: () => Promise<string[]>;
        };
    }
}

type Person = {
    pass_id: string;
    booking_id: string;
    pilgrim_id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    room_type?: string | null;
    flight_option?: string | null;
    has_notes: boolean;
    checked_in: boolean;
    checked_in_at?: string | null;
    checked_in_by?: string | null;
};

type ScanResponse = {
    status: 'accepted' | 'duplicate' | 'rejected' | 'invalid';
    message: string;
    previous_checkin_at?: string;
    pass?: {
        pilgrim?: {
            full_name?: string;
            email?: string | null;
            phone?: string | null;
            room_type?: string | null;
            flight_option?: string | null;
            allergies?: string | null;
            dietary_restrictions?: string | null;
            health_notes?: string | null;
            notes?: string | null;
        };
        pilgrimage_title?: string;
    };
};

const BUS_CHECKPOINT = 'bus_boarding';

export default function PilgrimageScanner({ pilgrimageId }: { pilgrimageId: string }) {
    const checkpoint = BUS_CHECKPOINT;
    const [people, setPeople] = useState<Person[]>([]);
    const [stats, setStats] = useState({ expected: 0, checked_in: 0, missing: 0 });
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [manualValue, setManualValue] = useState('');
    const [query, setQuery] = useState('');
    const [scanResult, setScanResult] = useState<ScanResponse | null>(null);
    const [scanBusy, setScanBusy] = useState(false);

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const frameRef = useRef<number | null>(null);
    const lastScanRef = useRef<{ value: string; at: number }>({ value: '', at: 0 });

    const filteredPeople = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return people;
        return people.filter((person) => [
            person.name,
            person.email,
            person.phone,
            person.room_type,
            person.flight_option,
        ].filter(Boolean).join(' ').toLowerCase().includes(needle));
    }, [people, query]);

    const missingPeople = filteredPeople.filter((person) => !person.checked_in);
    const checkedPeople = filteredPeople.filter((person) => person.checked_in);

    const getToken = async () => getBrowserAccessToken(1);

    const loadSummary = useCallback(async () => {
        setLoading(true);
        try {
            const token = await getToken();
            const res = await fetch(`/api/admin/pilgrimage-checkins/${pilgrimageId}?checkpoint=${encodeURIComponent(checkpoint)}&t=${Date.now()}`, {
                cache: 'no-store',
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Erro ao carregar scanner');
            setPeople(Array.isArray(data?.people) ? data.people : []);
            setStats(data?.stats || { expected: 0, checked_in: 0, missing: 0 });
        } catch (err: unknown) {
            setCameraError(err instanceof Error ? err.message : 'Erro ao carregar dados');
        } finally {
            setLoading(false);
        }
    }, [checkpoint, pilgrimageId]);

    useEffect(() => {
        loadSummary();
    }, [loadSummary]);

    useEffect(() => {
        return () => stopCamera();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const stopCamera = () => {
        if (frameRef.current) cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setScanning(false);
    };

    const startCamera = async () => {
        setCameraError(null);
        setScanResult(null);

        try {
            const stream = await getCameraStream({
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
                audio: false,
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
            setScanning(true);
            scanLoop(window.BarcodeDetector ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null);
        } catch (err: unknown) {
            setCameraError(err instanceof Error ? err.message : 'Não foi possível abrir a câmara.');
            stopCamera();
        }
    };

    const getCameraStream = async (constraints: MediaStreamConstraints) => {
        if (navigator.mediaDevices?.getUserMedia) {
            return navigator.mediaDevices.getUserMedia(constraints);
        }

        const legacyGetUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
        if (legacyGetUserMedia) {
            return new Promise<MediaStream>((resolve, reject) => {
                legacyGetUserMedia.call(navigator, constraints, resolve, reject);
            });
        }

        const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
        const isSecure = window.isSecureContext || window.location.protocol === 'https:' || isLocalhost;
        if (!isSecure) {
            throw new Error('A câmara no telemóvel exige HTTPS. Abre esta página por https ou testa numa versão publicada.');
        }

        throw new Error('Este browser não disponibiliza acesso à câmara nesta página.');
    };

    const scanLoop = (detector: { detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>> } | null) => {
        const tick = async () => {
            const video = videoRef.current;
            const canvas = canvasRef.current;

            if (video && canvas && video.readyState >= 2 && !scanBusy) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    let value = '';

                    try {
                        if (detector) {
                            const codes = await detector.detect(canvas);
                            value = codes?.[0]?.rawValue || '';
                        }
                    } catch {
                        value = '';
                    }

                    if (!value) {
                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
                            inversionAttempts: 'attemptBoth',
                        });
                        value = decoded?.data || '';
                    }

                    const now = Date.now();
                    if (value && (value !== lastScanRef.current.value || now - lastScanRef.current.at > 3500)) {
                        lastScanRef.current = { value, at: now };
                        await submitScan({ payload: value });
                    }
                }
            }

            frameRef.current = requestAnimationFrame(tick);
        };

        frameRef.current = requestAnimationFrame(tick);
    };

    const submitScan = async (input: { payload?: string; passId?: string }) => {
        setScanBusy(true);
        try {
            const token = await getToken();
            const res = await fetch('/api/admin/pilgrimage-checkins/scan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    pilgrimageId,
                    checkpointType: checkpoint,
                    ...input,
                }),
            });
            const data = await res.json();
            if (!res.ok && !data?.status) throw new Error(data?.error || 'Erro ao validar passe');
            setScanResult(data);

            if (navigator.vibrate) {
                navigator.vibrate(data.status === 'accepted' ? 80 : [80, 60, 80]);
            }

            await loadSummary();
        } catch (err: unknown) {
            setScanResult({ status: 'invalid', message: err instanceof Error ? err.message : 'Erro ao validar passe' });
        } finally {
            setScanBusy(false);
        }
    };

    const validateManualCode = async () => {
        if (!manualValue.trim()) return;
        await submitScan({ payload: manualValue.trim() });
        setManualValue('');
    };

    const validatePerson = async (person: Person) => {
        await submitScan({ passId: person.pass_id });
    };

    return (
        <div className="space-y-5">
            <div className="rounded-[2rem] bg-slate-950 text-white overflow-hidden shadow-2xl">
                <div className="p-5 md:p-6 space-y-5">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-[11px] uppercase tracking-[0.22em] font-black text-emerald-300 mb-1">Scanner do Autocarro</p>
                            <h3 className="text-2xl md:text-3xl font-black tracking-tight">Entrada no autocarro</h3>
                        </div>
                        <button
                            onClick={loadSummary}
                            disabled={loading}
                            className="w-11 h-11 rounded-2xl bg-white/10 hover:bg-white/15 flex items-center justify-center transition-colors disabled:opacity-50"
                            title="Atualizar"
                        >
                            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>

                    <div className="inline-flex w-fit items-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950">
                        <Bus className="w-4 h-4" />
                        Embarque
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        <StatTile label="Esperados" value={stats.expected} />
                        <StatTile label="Entraram" value={stats.checked_in} tone="green" />
                        <StatTile label="Faltam" value={stats.missing} tone="amber" />
                    </div>
                </div>

                <div className="relative bg-black aspect-[4/3] sm:aspect-video">
                    <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
                    <canvas ref={canvasRef} className="hidden" />

                    {!scanning && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-900">
                            <div className="w-20 h-20 rounded-[1.75rem] bg-white/10 flex items-center justify-center mb-4">
                                <QrCode className="w-9 h-9 text-emerald-300" />
                            </div>
                            <p className="font-bold text-lg">Entrada no autocarro</p>
                            <p className="text-white/50 text-sm mt-1 max-w-sm">Abre a câmara e aponta para o Passe de Peregrino.</p>
                            <button
                                onClick={startCamera}
                                className="mt-5 inline-flex items-center gap-2 px-6 py-4 rounded-2xl bg-emerald-400 text-slate-950 font-black hover:bg-emerald-300 transition-colors"
                            >
                                <Video className="w-5 h-5" />
                                Abrir scanner
                            </button>
                        </div>
                    )}

                    {scanning && (
                        <>
                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                <div className="w-64 h-64 max-w-[72vw] max-h-[72vw] rounded-[2rem] border-4 border-emerald-300 shadow-[0_0_0_999px_rgba(0,0,0,0.28)]" />
                            </div>
                            <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-3">
                                <div className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-black/60 backdrop-blur text-sm font-bold">
                                    <Bus className="w-4 h-4 text-emerald-300" />
                                    Embarque
                                </div>
                                <button
                                    onClick={stopCamera}
                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-black/60 backdrop-blur text-sm font-bold"
                                >
                                    <VideoOff className="w-4 h-4" />
                                    Parar
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {cameraError && (
                <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 flex gap-3 text-amber-800">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p className="text-sm font-semibold">{cameraError}</p>
                </div>
            )}

            {scanResult && <ScanResultCard result={scanResult} />}

            <div className="rounded-[2rem] bg-white border border-slate-200 shadow-sm p-4 md:p-5 space-y-4">
                <div className="flex items-center gap-3">
                    <Search className="w-5 h-5 text-slate-400" />
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Pesquisar por nome, email, telefone..."
                        className="w-full outline-none text-sm font-semibold placeholder:text-slate-400"
                    />
                </div>
                <div className="flex gap-2">
                    <input
                        value={manualValue}
                        onChange={(event) => setManualValue(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') validateManualCode();
                        }}
                        placeholder="Código manual ou URL do QR"
                        className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-slate-400"
                    />
                    <button
                        onClick={validateManualCode}
                        disabled={!manualValue.trim() || scanBusy}
                        className="px-4 py-3 rounded-2xl bg-slate-900 text-white font-black text-sm disabled:opacity-40"
                    >
                        Validar
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="rounded-3xl bg-white border border-slate-200 p-8 text-center text-slate-500">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
                    A carregar peregrinos...
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                    <PeopleList
                        title="Faltam entrar"
                        tone="amber"
                        people={missingPeople}
                        actionLabel="Validar"
                        onAction={validatePerson}
                        busy={scanBusy}
                    />
                    <PeopleList
                        title="Já entraram"
                        tone="green"
                        people={checkedPeople}
                        actionLabel="Revalidar"
                        onAction={validatePerson}
                        busy={scanBusy}
                    />
                </div>
            )}
        </div>
    );
}

function StatTile({ label, value, tone = 'slate' }: { label: string; value: number; tone?: 'slate' | 'green' | 'amber' }) {
    const color = tone === 'green' ? 'text-emerald-300' : tone === 'amber' ? 'text-amber-300' : 'text-white';
    return (
        <div className="rounded-3xl bg-white/8 border border-white/10 p-4">
            <p className="text-[10px] uppercase tracking-widest font-black text-white/45">{label}</p>
            <p className={`text-3xl font-black mt-1 ${color}`}>{value}</p>
        </div>
    );
}

function ScanResultCard({ result }: { result: ScanResponse }) {
    const isOk = result.status === 'accepted';
    const isDuplicate = result.status === 'duplicate';
    const Icon = isOk ? CheckCircle2 : isDuplicate ? AlertTriangle : XCircle;
    const styles = isOk
        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
        : isDuplicate
            ? 'bg-amber-50 border-amber-200 text-amber-900'
            : 'bg-rose-50 border-rose-200 text-rose-900';

    const pilgrim = result.pass?.pilgrim;
    const notes = [pilgrim?.allergies, pilgrim?.dietary_restrictions, pilgrim?.health_notes, pilgrim?.notes].filter(Boolean);

    return (
        <div className={`rounded-[2rem] border p-5 ${styles}`}>
            <div className="flex items-start gap-4">
                <Icon className="w-7 h-7 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                    <p className="font-black text-xl">{result.message}</p>
                    {pilgrim?.full_name && <p className="font-bold mt-1">{pilgrim.full_name}</p>}
                    {(pilgrim?.room_type || pilgrim?.flight_option) && (
                        <p className="text-sm mt-1 opacity-75">
                            Quarto: {pilgrim.room_type || '-'} · Voo: {pilgrim.flight_option || '-'}
                        </p>
                    )}
                    {notes.length > 0 && (
                        <div className="mt-3 rounded-2xl bg-white/55 p-3 text-sm font-semibold">
                            {notes.join(' · ')}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function PeopleList({
    title,
    tone,
    people,
    actionLabel,
    onAction,
    busy,
}: {
    title: string;
    tone: 'amber' | 'green';
    people: Person[];
    actionLabel: string;
    onAction: (person: Person) => void;
    busy: boolean;
}) {
    const toneClass = tone === 'green' ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : 'text-amber-700 bg-amber-50 border-amber-100';

    return (
        <div className="rounded-[2rem] bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <h4 className="font-black text-slate-900">{title}</h4>
                <span className={`px-3 py-1 rounded-full text-xs font-black border ${toneClass}`}>{people.length}</span>
            </div>
            <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto">
                {people.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm font-semibold">Sem resultados.</div>
                ) : people.map((person) => (
                    <div key={person.pass_id} className="p-4 flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${person.checked_in ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            {person.checked_in ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="font-black text-slate-900 truncate">{person.name}</p>
                            <p className="text-xs text-slate-500 truncate">
                                {[person.phone, person.room_type, person.flight_option].filter(Boolean).join(' · ') || 'Sem detalhes adicionais'}
                            </p>
                        </div>
                        <button
                            onClick={() => onAction(person)}
                            disabled={busy}
                            className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-black disabled:opacity-40"
                        >
                            {actionLabel}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

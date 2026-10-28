'use client';

import { useState } from 'react';
import { AlertCircle, Check, Loader2, Utensils } from 'lucide-react';
import { DIETARY_MAX_LENGTH, getDietaryInfo, type DietaryFields } from '../../lib/pilgrimage-dietary';

type Participant = DietaryFields & { id: string; full_name: string };
type SavedParticipant = DietaryFields & { id: string };

export default function DietaryPanel({ bookingId, pilgrims, token, isEn, disabled, onSaved }: {
    bookingId: string;
    pilgrims: Participant[];
    token: string | null;
    isEn: boolean;
    disabled: boolean;
    onSaved: (person: SavedParticipant) => void;
}) {
    return (
        <section className="space-y-5">
            <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-5 text-amber-100">
                <h2 className="flex items-center gap-2 text-lg font-bold"><Utensils className="h-5 w-5" />{isEn ? 'Food allergies and dietary requirements' : 'Alergias e restrições alimentares'}</h2>
                <p className="mt-2 text-sm leading-relaxed">{isEn
                    ? 'Check the details for every participant. You can add or update them here, even after registering. The organisation will use this information to notify hotels and meal providers. Tell us as soon as possible; changes close to departure may need direct confirmation with the organisation.'
                    : 'Confirma os dados de cada participante. Podes acrescentar ou corrigir esta informação aqui, mesmo depois da inscrição. A organização vai usá-la para avisar hotéis e responsáveis pelas refeições. Informa-nos o mais cedo possível; alterações perto da partida podem precisar de confirmação direta com a organização.'}</p>
            </div>
            {disabled && <p className="text-sm text-white/70">{isEn ? 'This registration is no longer active.' : 'Esta inscrição já não está ativa.'}</p>}
            {pilgrims.map(person => <ParticipantForm key={person.id} person={person} bookingId={bookingId} token={token} isEn={isEn} disabled={disabled} onSaved={onSaved} />)}
        </section>
    );
}

function ParticipantForm({ person, bookingId, token, isEn, disabled, onSaved }: {
    person: Participant;
    bookingId: string;
    token: string | null;
    isEn: boolean;
    disabled: boolean;
    onSaved: (person: SavedParticipant) => void;
}) {
    const info = getDietaryInfo(person);
    const savedAnswer = info.status === 'none' ? (isEn ? 'No' : 'Não') : info.answer;
    const [draft, setDraft] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const value = draft ?? savedAnswer;
    const fieldId = `dietary-${person.id}`;

    async function save(event: React.FormEvent) {
        event.preventDefault();
        setSaving(true);
        setError('');
        setSuccess(false);
        try {
            const response = await fetch(`/api/booking/${bookingId}/dietary`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pilgrimId: person.id, answer: value, token }),
            });
            const body = await response.json();
            if (!response.ok) throw new Error(isEn ? 'Could not save. Please try again.' : body.error || 'Não foi possível guardar.');
            onSaved(body.pilgrim);
            setDraft(null);
            setSuccess(true);
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : (isEn ? 'Could not save.' : 'Não foi possível guardar.'));
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={save} className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h3 className="text-lg font-semibold text-white">{person.full_name}</h3>
            {info.status === 'pending' && <p className="mt-2 flex items-center gap-2 text-sm text-amber-200"><AlertCircle className="h-4 w-4" />{isEn ? 'Not yet provided — please complete this information.' : 'Por preencher — confirma esta informação.'}</p>}
            <label htmlFor={fieldId} className="mb-2 mt-4 block text-sm font-semibold text-white/80">{isEn ? 'Food allergies / dietary requirements' : 'Alergias alimentares / restrições'}</label>
            <textarea id={fieldId} required maxLength={DIETARY_MAX_LENGTH} disabled={disabled || saving} rows={3} value={value}
                onChange={event => { setDraft(event.target.value); setSuccess(false); }}
                aria-describedby={`${fieldId}-help`}
                placeholder={isEn ? 'E.g. nut allergy, lactose intolerance, gluten-free…' : 'Ex.: alergia a frutos secos, intolerância à lactose, sem glúten…'}
                className="w-full rounded-xl border border-white/20 bg-slate-900 p-3 text-white placeholder:text-slate-400 focus:border-amber-400 focus:outline-none disabled:opacity-50" />
            <p id={`${fieldId}-help`} className="mt-2 text-xs text-white/60">{isEn ? 'Describe the foods to avoid and any relevant precautions. If none, write “No”.' : 'Indica os alimentos a evitar e os cuidados necessários. Se não tens alergias ou restrições, escreve “Não”.'}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
                <button type="submit" disabled={disabled || saving || !value.trim()} className="flex min-h-11 items-center gap-2 rounded-xl bg-amber-400 px-5 py-2 font-bold text-slate-950 disabled:opacity-50">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{isEn ? 'Save details' : 'Guardar dados'}
                </button>
                <button type="button" disabled={disabled || saving} onClick={() => { setDraft(isEn ? 'No' : 'Não'); setSuccess(false); }} className="min-h-11 px-2 text-sm text-white/70 underline disabled:opacity-50">{isEn ? 'I have no allergies or restrictions' : 'Não tenho alergias ou restrições'}</button>
            </div>
            {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
            {success && <p role="status" className="mt-3 text-sm text-emerald-300">{isEn ? 'Saved. The organisation can now see these details.' : 'Guardado. A organização já pode consultar estes dados.'}</p>}
        </form>
    );
}

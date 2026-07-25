'use client';

import { useState, useCallback } from 'react';
import { Languages, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { getBrowserAccessToken } from '../../lib/supabase-browser';
import RichTextField from './RichTextField';
import { isRichTextEmpty } from '../../lib/rich-text';

type FieldType = 'input' | 'textarea' | 'rich';

interface BilingualFieldProps {
  label: string;
  ptValue: string;
  enValue: string;
  onChangePt: (val: string) => void;
  onChangeEn: (val: string) => void;
  type?: FieldType;
  placeholder?: string;
  placeholderEn?: string;
  rows?: number;
  inputClassName?: string;
  required?: boolean;
}

async function getTranslateHeaders() {
  const token = await getBrowserAccessToken();

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

function parseMultilineValue(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Campo bilingue PT + EN para o admin.
 * Mostra dois campos lado a lado (ou empilhados em mobile) com botão de tradução automática via DeepL.
 */
export default function BilingualField({
  label,
  ptValue,
  enValue,
  onChangePt,
  onChangeEn,
  type = 'input',
  placeholder,
  placeholderEn,
  rows = 4,
  inputClassName = '',
  required = false,
}: BilingualFieldProps) {
  const [translating, setTranslating] = useState(false);
  const [lastStatus, setLastStatus] = useState<'idle' | 'ok' | 'error'>('idle');

  const baseClass =
    'w-full p-3 bg-white border rounded-xl outline-none transition-all text-sm ' +
    'focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 placeholder:text-slate-300 ' +
    inputClassName;

  const handleTranslate = useCallback(async () => {
    if (!ptValue?.trim()) return;
    setTranslating(true);
    setLastStatus('idle');
    try {
      const res = await fetch('/api/admin/translate', {
        method: 'POST',
        headers: await getTranslateHeaders(),
        body: JSON.stringify({ text: ptValue }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro na tradução');
      onChangeEn(data.translated);
      setLastStatus('ok');
    } catch (err: any) {
      console.error('[BilingualField translate]', err);
      setLastStatus('error');
    } finally {
      setTranslating(false);
    }
  }, [ptValue, onChangeEn]);

  const enHasContent = type === 'rich' ? !isRichTextEmpty(enValue) : !!enValue?.trim();

  return (
    <div className="space-y-2">
      {/* Label + Translate button */}
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
        <button
          type="button"
          onClick={handleTranslate}
          disabled={translating || !ptValue?.trim()}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-lg
            bg-indigo-50 text-indigo-600 border border-indigo-100
            hover:bg-indigo-100 hover:border-indigo-200 transition-all
            disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {translating ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : lastStatus === 'ok' ? (
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          ) : lastStatus === 'error' ? (
            <AlertCircle className="w-3 h-3 text-red-400" />
          ) : (
            <Languages className="w-3 h-3" />
          )}
          {translating ? 'A traduzir...' : '✨ Traduzir EN'}
        </button>
      </div>

      {/* Two columns: PT + EN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* PT */}
        <div className="relative">
          <span className="absolute top-2.5 left-3 text-[10px] font-black text-slate-400 uppercase tracking-widest z-10">🇵🇹</span>
          {type === 'rich' ? (
            <RichTextField
              value={ptValue}
              onChange={onChangePt}
              placeholder={placeholder}
              minRows={rows}
              ariaLabel={`${label} (PT)`}
              className="pt-6"
            />
          ) : type === 'textarea' ? (
            <textarea
              className={`${baseClass} pl-9 resize-none`}
              style={{ minHeight: `${rows * 1.6}rem` }}
              value={ptValue}
              onChange={e => onChangePt(e.target.value)}
              placeholder={placeholder}
            />
          ) : (
            <input
              type="text"
              className={`${baseClass} pl-9`}
              value={ptValue}
              onChange={e => onChangePt(e.target.value)}
              placeholder={placeholder}
            />
          )}
        </div>

        {/* EN */}
        <div className="relative">
          <span className="absolute top-2.5 left-3 text-[10px] font-black text-slate-400 uppercase tracking-widest z-10">🇬🇧</span>
          {type === 'rich' ? (
            <RichTextField
              value={enValue}
              onChange={onChangeEn}
              placeholder={placeholderEn ?? 'English version...'}
              minRows={rows}
              ariaLabel={`${label} (EN)`}
              className={`pt-6 ${!enHasContent ? 'border-amber-200 bg-amber-50/30' : 'border-emerald-200 bg-emerald-50/20'}`}
            />
          ) : type === 'textarea' ? (
            <textarea
              className={`${baseClass} pl-9 resize-none ${!enHasContent ? 'border-amber-200 bg-amber-50/30' : 'border-emerald-200 bg-emerald-50/20'}`}
              style={{ minHeight: `${rows * 1.6}rem` }}
              value={enValue}
              onChange={e => onChangeEn(e.target.value)}
              placeholder={placeholderEn ?? 'English version...'}
            />
          ) : (
            <input
              type="text"
              className={`${baseClass} pl-9 ${!enHasContent ? 'border-amber-200 bg-amber-50/30' : 'border-emerald-200 bg-emerald-50/20'}`}
              value={enValue}
              onChange={e => onChangeEn(e.target.value)}
              placeholder={placeholderEn ?? 'English version...'}
            />
          )}
          {/* Status indicator */}
          {enHasContent && (
            <span className="absolute top-2.5 right-3 w-1.5 h-1.5 rounded-full bg-emerald-400" title="Tradução EN presente" />
          )}
          {!enHasContent && (
            <span className="absolute top-2.5 right-3 w-1.5 h-1.5 rounded-full bg-amber-300" title="Sem tradução EN" />
          )}
        </div>
      </div>
    </div>
  );
}


/**
 * Botão "Traduzir tudo" para usar no topo de um formulário.
 * Recebe um array de { ptValue, onChangeEn } e traduz todos em batch.
 */
interface TranslateAllButtonProps {
  fields: Array<{ ptValue: string; onChangeEn: (val: string) => void }>;
  className?: string;
}

export function TranslateAllButton({ fields, className = '' }: TranslateAllButtonProps) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');

  const handleTranslateAll = async () => {
    const texts = fields.map(f => f.ptValue ?? '');
    const nonEmpty = texts.some(t => t.trim());
    if (!nonEmpty) return;

    setLoading(true);
    setStatus('idle');
    try {
      const res = await fetch('/api/admin/translate', {
        method: 'POST',
        headers: await getTranslateHeaders(),
        body: JSON.stringify({ texts }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro');

      (data.translated as string[]).forEach((translated, i) => {
        if (translated) fields[i].onChangeEn(translated);
      });
      setStatus('ok');
    } catch (err) {
      console.error('[TranslateAllButton]', err);
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleTranslateAll}
      disabled={loading}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl
        bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-sm
        disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : status === 'ok' ? (
        <CheckCircle2 className="w-4 h-4" />
      ) : status === 'error' ? (
        <AlertCircle className="w-4 h-4 text-red-300" />
      ) : (
        <Languages className="w-4 h-4" />
      )}
      {loading ? 'A traduzir tudo...' : status === 'ok' ? 'Traduzido!' : '🌐 Traduzir tudo EN'}
    </button>
  );
}

interface BilingualListFieldProps {
  label: string;
  ptValues: string[];
  enValues: string[];
  onChangePt: (vals: string[]) => void;
  onChangeEn: (vals: string[]) => void;
  placeholder?: string;
  placeholderEn?: string;
  rows?: number;
}

export function BilingualListField({
  label,
  ptValues,
  enValues,
  onChangePt,
  onChangeEn,
  placeholder,
  placeholderEn,
  rows = 6,
}: BilingualListFieldProps) {
  const [translating, setTranslating] = useState(false);
  const [lastStatus, setLastStatus] = useState<'idle' | 'ok' | 'error'>('idle');

  const ptText = (ptValues ?? []).join('\n');
  const enText = (enValues ?? []).join('\n');
  const enHasContent = !!enText.trim();
  const baseClass =
    'w-full p-3 bg-white border rounded-xl outline-none transition-all text-sm ' +
    'focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 placeholder:text-slate-300 resize-none';

  const handleTranslate = useCallback(async () => {
    const texts = (ptValues ?? []).map((value) => value?.trim() ?? '');
    const nonEmpty = texts.some((value) => value);
    if (!nonEmpty) return;

    setTranslating(true);
    setLastStatus('idle');

    try {
      const res = await fetch('/api/admin/translate', {
        method: 'POST',
        headers: await getTranslateHeaders(),
        body: JSON.stringify({ texts }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro na tradução');

      onChangeEn((data.translated as string[]).map((value) => value?.trim()).filter(Boolean));
      setLastStatus('ok');
    } catch (err) {
      console.error('[BilingualListField translate]', err);
      setLastStatus('error');
    } finally {
      setTranslating(false);
    }
  }, [onChangeEn, ptValues]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
          {label}
        </label>
        <button
          type="button"
          onClick={handleTranslate}
          disabled={translating || !ptText.trim()}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-lg
            bg-indigo-50 text-indigo-600 border border-indigo-100
            hover:bg-indigo-100 hover:border-indigo-200 transition-all
            disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {translating ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : lastStatus === 'ok' ? (
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          ) : lastStatus === 'error' ? (
            <AlertCircle className="w-3 h-3 text-red-400" />
          ) : (
            <Languages className="w-3 h-3" />
          )}
          {translating ? 'A traduzir...' : '✨ Traduzir EN'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="relative">
          <span className="absolute top-2.5 left-3 text-[10px] font-black text-slate-400 uppercase tracking-widest z-10">🇵🇹</span>
          <textarea
            className={`${baseClass} pl-9`}
            style={{ minHeight: `${rows * 1.6}rem` }}
            value={ptText}
            onChange={(e) => onChangePt(parseMultilineValue(e.target.value))}
            placeholder={placeholder}
          />
        </div>

        <div className="relative">
          <span className="absolute top-2.5 left-3 text-[10px] font-black text-slate-400 uppercase tracking-widest z-10">🇬🇧</span>
          <textarea
            className={`${baseClass} pl-9 ${!enHasContent ? 'border-amber-200 bg-amber-50/30' : 'border-emerald-200 bg-emerald-50/20'}`}
            style={{ minHeight: `${rows * 1.6}rem` }}
            value={enText}
            onChange={(e) => onChangeEn(parseMultilineValue(e.target.value))}
            placeholder={placeholderEn ?? 'One item per line in English...'}
          />
          {enHasContent && (
            <span className="absolute top-2.5 right-3 w-1.5 h-1.5 rounded-full bg-emerald-400" title="Tradução EN presente" />
          )}
          {!enHasContent && (
            <span className="absolute top-2.5 right-3 w-1.5 h-1.5 rounded-full bg-amber-300" title="Sem tradução EN" />
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { api, avatarColor, initials, isValidEmail, type Address, type Contact } from './mail-api';

type Suggestion = { name: string; address: string; tag: string };

/** "Nome <email>", "email" ou vários colados de uma vez. */
const parseAddresses = (raw: string): Address[] => {
    const out: Address[] = [];
    const re = /(?:"?([^"<>,;\n]*?)"?\s*<([^<>\s,;]+)>|([^\s<>,;"]+@[^\s<>,;"]+))/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(raw))) {
        const address = (match[2] || match[3] || '').trim().replace(/^mailto:/i, '');
        if (address) out.push({ name: (match[1] || '').trim(), address });
    }
    return out;
};

export default function RecipientInput({ id, label, value, onChange, recent, autoFocus, trailing }: {
    id: string;
    label: string;
    value: Address[];
    onChange: (value: Address[]) => void;
    /** Endereços que já aparecem na caixa: sugeridos primeiro, sem ir ao servidor. */
    recent: Address[];
    autoFocus?: boolean;
    trailing?: React.ReactNode;
}) {
    const [text, setText] = useState('');
    const [remote, setRemote] = useState<Contact[]>([]);
    const [active, setActive] = useState(0);
    const [focused, setFocused] = useState(false);
    const input = useRef<HTMLInputElement>(null);
    const request = useRef(0);

    const query = text.trim().toLowerCase();

    useEffect(() => {
        if (query.length < 2) { setRemote([]); return; }
        const current = ++request.current;
        const timer = setTimeout(() => {
            api({ view: 'contacts', q: query })
                .then((data) => { if (current === request.current) setRemote(data.contacts || []); })
                .catch(() => undefined);
        }, 160);
        return () => clearTimeout(timer);
    }, [query]);

    const suggestions = useMemo<Suggestion[]>(() => {
        if (!query) return [];
        const taken = new Set(value.map((a) => a.address.toLowerCase()));
        const out = new Map<string, Suggestion>();
        for (const a of recent) {
            const key = a.address.toLowerCase();
            if (taken.has(key) || out.has(key)) continue;
            if (key.includes(query) || a.name.toLowerCase().includes(query)) out.set(key, { name: a.name, address: a.address, tag: 'Recente' });
            if (out.size >= 4) break;
        }
        for (const c of remote) {
            const key = c.email.toLowerCase();
            if (!taken.has(key) && !out.has(key)) out.set(key, { name: c.name || '', address: c.email, tag: c.tag });
        }
        return [...out.values()].slice(0, 8);
    }, [query, recent, remote, value]);

    useEffect(() => { setActive(0); }, [suggestions.length, query]);

    const add = (items: Address[]) => {
        if (!items.length) return;
        const taken = new Set(value.map((a) => a.address.toLowerCase()));
        const fresh = items.filter((a) => !taken.has(a.address.toLowerCase()) && taken.add(a.address.toLowerCase()));
        onChange([...value, ...fresh]);
        setText('');
    };

    const commitText = () => {
        const parsed = parseAddresses(text);
        if (parsed.length) add(parsed);
        else if (text.trim()) add([{ name: '', address: text.trim() }]);
    };

    const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        const open = focused && suggestions.length > 0;
        if (open && event.key === 'ArrowDown') { event.preventDefault(); setActive((i) => (i + 1) % suggestions.length); return; }
        if (open && event.key === 'ArrowUp') { event.preventDefault(); setActive((i) => (i - 1 + suggestions.length) % suggestions.length); return; }
        if ((event.key === 'Enter' || event.key === 'Tab') && open) {
            event.preventDefault();
            add([suggestions[active]]);
            return;
        }
        if ((event.key === 'Enter' || event.key === ',' || event.key === ';' || (event.key === 'Tab' && text.trim())) && text.trim()) {
            event.preventDefault();
            commitText();
            return;
        }
        if (event.key === ' ' && isValidEmail(text.trim())) {
            event.preventDefault();
            commitText();
            return;
        }
        if (event.key === 'Backspace' && !text && value.length) {
            onChange(value.slice(0, -1));
        }
    };

    return (
        <div className="mbx-rcpt" onClick={() => input.current?.focus()}>
            <label htmlFor={id}>{label}</label>
            <div className="mbx-rcpt-box">
                {value.map((a) => {
                    const valid = isValidEmail(a.address);
                    return (
                        <span key={a.address} className={`mbx-rcpt-chip${valid ? '' : ' is-invalid'}`} title={valid ? a.address : 'Endereço inválido'}>
                            <i style={{ background: valid ? avatarColor(a) : '#dc2626' }}>{initials(a)}</i>
                            {a.name || a.address}
                            <button type="button" aria-label={`Tirar ${a.address}`} onClick={(e) => { e.stopPropagation(); onChange(value.filter((v) => v !== a)); }}>
                                <X size={12} />
                            </button>
                        </span>
                    );
                })}
                <input
                    ref={input}
                    id={id}
                    autoFocus={autoFocus}
                    value={text}
                    autoComplete="off"
                    onChange={(e) => {
                        // Vírgula/ponto e vírgula fecham o chip mesmo sem keydown
                        // (alguns teclados de telemóvel não o enviam).
                        const next = e.target.value;
                        const cut = Math.max(next.lastIndexOf(','), next.lastIndexOf(';'));
                        if (cut === -1) { setText(next); return; }
                        const parsed = parseAddresses(next.slice(0, cut));
                        if (parsed.length) add(parsed);
                        setText(next.slice(cut + 1).trimStart());
                    }}
                    onKeyDown={onKeyDown}
                    onFocus={() => setFocused(true)}
                    onBlur={() => { setFocused(false); if (text.trim()) commitText(); }}
                    onPaste={(e) => {
                        const pasted = e.clipboardData.getData('text');
                        const parsed = parseAddresses(pasted);
                        if (parsed.length > 1 || (parsed.length === 1 && !text)) {
                            e.preventDefault();
                            add(parsed);
                        }
                    }}
                />
            </div>
            {trailing}
            {focused && suggestions.length > 0 && (
                <ul className="mbx-rcpt-menu" role="listbox">
                    {suggestions.map((s, i) => (
                        <li key={s.address} role="option" aria-selected={i === active} className={i === active ? 'is-active' : ''}
                            onMouseDown={(e) => { e.preventDefault(); add([s]); }} onMouseEnter={() => setActive(i)}>
                            <i style={{ background: avatarColor(s) }}>{initials(s)}</i>
                            <span className="mbx-rcpt-menu-text">
                                <strong>{s.name || s.address}</strong>
                                {s.name && <small>{s.address}</small>}
                            </span>
                            <em>{s.tag}</em>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

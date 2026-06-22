"use client";

import { useEffect, useRef, useState } from 'react';
import { Tag } from 'lucide-react';
import { supabaseBrowser } from '../../lib/supabase-browser';

type Props = {
  value: string;
  onChange: (next: string) => void;
};

/**
 * Lightweight autocomplete that fetches existing categories from wp_pages
 * once on mount. Keeps it simple — for hundreds of categories we'd switch
 * to a proper dropdown.
 */
export function CategoryAutocomplete({ value, onChange }: Props) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabaseBrowser) return;
      const { data } = await supabaseBrowser
        .from('wp_pages')
        .select('category')
        .not('category', 'is', null);
      if (cancelled || !data) return;
      const set = new Set<string>();
      for (const r of data as Array<{ category: string | null }>) {
        if (r.category) set.add(r.category);
      }
      setSuggestions([...set].sort());
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const filtered = value
    ? suggestions.filter((s) => s.toLowerCase().includes(value.toLowerCase()) && s !== value)
    : suggestions;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        className="cms-input"
        placeholder="ex: testemunhos"
      />
      {open && filtered.length > 0 && (
        <ul
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 30,
            margin: 0,
            padding: '0.3rem',
            listStyle: 'none',
            background: '#fff',
            border: '1px solid rgba(15, 23, 42, 0.12)',
            borderRadius: 8,
            boxShadow: '0 10px 30px rgba(15, 23, 42, 0.12)',
            maxHeight: 220,
            overflowY: 'auto',
          }}
        >
          {filtered.slice(0, 12).map((s) => (
            <li key={s}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onChange(s); setOpen(false); }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.45rem 0.6rem',
                  background: 'transparent',
                  border: 0,
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  color: '#0f172a',
                }}
                className="hover:bg-slate-100"
              >
                <Tag size={12} style={{ color: '#d4af37' }} /> {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

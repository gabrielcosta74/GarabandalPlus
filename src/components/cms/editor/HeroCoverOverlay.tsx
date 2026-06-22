"use client";

import { useState } from 'react';
import { ImagePlus, RefreshCw, X } from 'lucide-react';
import { MediaPickerDialog } from '../MediaPicker';

/**
 * Edit the hero / cover image straight from the editor canvas. Renders as an
 * overlay on top of the <ArticleHero> preview: a centred "add" button when
 * empty, or a small "Trocar / Remover" toolbar when an image is set. Opens the
 * shared media library dialog. The overlay itself is click-through
 * (pointer-events:none) so only its buttons are interactive.
 */
export function HeroCoverOverlay({
  value,
  onChange,
  aspect = 'wide',
}: {
  value: string | null | undefined;
  onChange: (next: string | null) => void;
  aspect?: 'square' | 'cover' | 'wide';
}) {
  const [open, setOpen] = useState(false);
  const hasImage = !!value;

  return (
    <>
      <div
        aria-hidden={false}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 30,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: hasImage ? 'flex-end' : 'center',
          padding: '0.85rem',
        }}
      >
        {hasImage ? (
          <div
            style={{
              pointerEvents: 'auto',
              display: 'inline-flex',
              gap: '0.4rem',
              padding: '0.3rem',
              borderRadius: 999,
              background: 'rgba(15,23,42,0.55)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="cms-btn"
              style={heroBtnStyle}
              title="Trocar imagem de capa"
            >
              <RefreshCw size={13} /> Trocar capa
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="cms-btn"
              style={heroBtnStyle}
              title="Remover imagem de capa"
            >
              <X size={13} /> Remover
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            style={{
              pointerEvents: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.7rem 1.1rem',
              borderRadius: 12,
              border: '1.5px dashed rgba(15,23,42,0.35)',
              background: 'rgba(255,255,255,0.85)',
              backdropFilter: 'blur(6px)',
              color: '#0f172a',
              fontWeight: 700,
              fontSize: '0.9rem',
              fontFamily: 'inherit',
              cursor: 'pointer',
              boxShadow: '0 4px 18px rgba(15,23,42,0.12)',
            }}
          >
            <ImagePlus size={16} /> Adicionar imagem de capa
          </button>
        )}
      </div>

      {open && (
        <MediaPickerDialog
          aspect={aspect}
          onClose={() => setOpen(false)}
          onPick={(url) => {
            onChange(url);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

const heroBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.35rem',
  padding: '0.4rem 0.7rem',
  borderRadius: 999,
  background: 'transparent',
  color: '#fff',
  fontSize: '0.8rem',
  fontWeight: 700,
  border: 'none',
  cursor: 'pointer',
};

"use client";

import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import type { BookingCta } from './types';

/** Onda de luz que nasce do ponto do clique (CSS em .pg-btn-primary::before). */
function ripple(event: React.PointerEvent<HTMLElement>) {
    const el = event.currentTarget;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--rx', `${event.clientX - rect.left}px`);
    el.style.setProperty('--ry', `${event.clientY - rect.top}px`);
    el.removeAttribute('data-ripple');
    void el.offsetWidth; // reinicia a animação em cliques seguidos
    el.setAttribute('data-ripple', '');
}

/**
 * Botão principal de inscrição. Só apresentação: o destino e o clique vêm
 * prontos da página. Os atributos data-track são os mesmos de antes
 * (pilgrimage_cta_clicked / pilgrimage_waitlist_clicked + placement).
 */
export default function CtaButton({
    cta,
    placement,
    className = '',
    compact = false,
}: {
    cta: BookingCta;
    placement: string;
    className?: string;
    compact?: boolean;
}) {
    const size = compact ? '!min-h-11 !px-5 !text-[14px]' : '';
    if (cta.kind === 'closed') {
        return (
            <button type="button" disabled className={`pg-btn pg-btn-primary ${size} ${className}`}>
                {cta.label}
            </button>
        );
    }

    const isManage = cta.kind === 'manage';
    const track = cta.kind === 'waitlist' ? 'pilgrimage_waitlist_clicked' : 'pilgrimage_cta_clicked';
    const classes = `pg-btn ${isManage ? 'pg-btn-manage' : 'pg-btn-primary'} ${size} ${className}`;
    const content = (
        <>
            {isManage && <Check size={17} aria-hidden />}
            <span>{cta.label}</span>
            {!isManage && (
                <span className="pg-btn-arrow" aria-hidden>
                    <ArrowRight size={17} />
                    <ArrowRight size={17} />
                </span>
            )}
        </>
    );

    if (cta.onClick) {
        return (
            <button type="button" onClick={cta.onClick} onPointerDown={ripple} data-track={isManage ? undefined : track} data-track-placement={isManage ? undefined : placement} className={classes}>
                {content}
            </button>
        );
    }
    return (
        <Link href={cta.href} onPointerDown={ripple} data-track={isManage ? undefined : track} data-track-placement={isManage ? undefined : placement} className={classes}>
            {content}
        </Link>
    );
}

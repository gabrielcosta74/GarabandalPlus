import type { Draft } from './mail-api';
import { DEFAULT_SIGNATURE, type SignatureSettings } from './email-template';

/** Letra por omissão dos emails — a mesma do editor, para o que se vê ser o que sai. */
export const EMAIL_FONT = 'Arial, Helvetica, sans-serif';
export const EMAIL_FONT_SIZE = '14px';
export const EMAIL_TEXT_COLOR = '#202124';

const applyStyles = (el: HTMLElement, styles: Record<string, string>) => {
    for (const [prop, value] of Object.entries(styles)) {
        if (!el.style.getPropertyValue(prop)) el.style.setProperty(prop, value);
    }
};

/**
 * HTML do editor → HTML que se vê igual no Gmail, Outlook e telemóvel: tudo
 * em estilos inline (os clientes de email ignoram <style>), parágrafos sem
 * margem como no editor e linhas vazias que não desaparecem.
 */
export function inlineEmailStyles(html: string) {
    const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, 'text/html');
    const root = doc.getElementById('root')!;

    root.querySelectorAll('p').forEach((p) => {
        applyStyles(p, { margin: '0' });
        if (!p.textContent && !p.querySelector('br,img')) p.appendChild(doc.createElement('br'));
    });
    root.querySelectorAll('blockquote').forEach((el) =>
        applyStyles(el as HTMLElement, { margin: '6px 0 6px 4px', 'padding-left': '12px', 'border-left': '3px solid #d0d7de', color: '#555555' }));
    root.querySelectorAll('ul,ol').forEach((el) => applyStyles(el as HTMLElement, { margin: '0', 'padding-left': '26px' }));
    root.querySelectorAll('a').forEach((el) => applyStyles(el as HTMLElement, { color: '#0f4c81' }));
    root.querySelectorAll('mark').forEach((el) => applyStyles(el as HTMLElement, { color: 'inherit', padding: '0 1px' }));

    return root.innerHTML;
}

export const htmlToText = (html: string) => {
    const doc = new DOMParser().parseFromString(
        html.replace(/<\/(p|div|li|blockquote|h\d)>/g, '</$1>\n').replace(/<br\s*\/?>/g, '\n'),
        'text/html',
    );
    return (doc.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
};

export const isHtmlEmpty = (html: string) => !html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();

/* -------------------- Preferências e rascunho (neste browser) -------------------- */

const SIGNATURE_KEY = 'mbx:signature:v2';
const BRANDED_KEY = 'mbx:branded';
const AUTOSAVE_KEY = 'mbx:autosave';

const read = (key: string) => {
    try { return window.localStorage.getItem(key); } catch { return null; }
};
const write = (key: string, value: string | null) => {
    try {
        if (value === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, value);
    } catch {
        // Sem localStorage (modo privado): funciona, só não guarda.
    }
};

export const loadSignatureSettings = (): SignatureSettings => {
    try {
        return { ...DEFAULT_SIGNATURE, ...JSON.parse(read(SIGNATURE_KEY) || '{}') };
    } catch {
        return DEFAULT_SIGNATURE;
    }
};
export const saveSignatureSettings = (settings: SignatureSettings) => write(SIGNATURE_KEY, JSON.stringify(settings));

/** Modelo do Apostolado ligado por omissão; a escolha fica lembrada. */
export const loadBranded = () => read(BRANDED_KEY) !== '0';
export const saveBranded = (on: boolean) => write(BRANDED_KEY, on ? '1' : '0');

type Autosave = { draft: Omit<Draft, 'files'>; at: number };

export const loadAutosave = (): Autosave | null => {
    const raw = read(AUTOSAVE_KEY);
    if (!raw) return null;
    try {
        const saved = JSON.parse(raw) as Autosave;
        // Rascunhos com mais de uma semana já não interessam.
        return Date.now() - saved.at < 7 * 86_400_000 ? saved : null;
    } catch {
        return null;
    }
};
export const saveAutosave = (draft: Draft) => {
    // Os anexos ficam de fora: pesam demasiado para o localStorage.
    write(AUTOSAVE_KEY, JSON.stringify({ draft: { ...draft, files: undefined }, at: Date.now() }));
};
export const clearAutosave = () => write(AUTOSAVE_KEY, null);

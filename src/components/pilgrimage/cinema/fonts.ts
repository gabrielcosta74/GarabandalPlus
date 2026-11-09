import { Allura, Instrument_Sans } from 'next/font/google';

// Fontes da página de detalhe da peregrinação.
// Instrument Sans para títulos; Allura (manuscrita) só para acentos curtos,
// como o subtítulo do hero. O texto corrido e a meta são Inter, do layout raiz.
// Estão num módulo à parte porque os elementos em portal (painel de inscrição,
// sheet do mobile) vivem fora da árvore da página e precisam das mesmas variáveis.
export const pgDisplayFont = Instrument_Sans({
    subsets: ['latin', 'latin-ext'],
    axes: ['wdth'],
    variable: '--font-pg-display',
    display: 'swap',
});

export const pgScriptFont = Allura({
    subsets: ['latin', 'latin-ext'],
    weight: '400',
    variable: '--font-pg-script',
    display: 'swap',
});

/** Classes que definem --font-pg-display e --font-pg-script. */
export const pgFontVariables = `${pgDisplayFont.variable} ${pgScriptFont.variable}`;

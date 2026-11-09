// Tokens de motion da página da peregrinação, iguais às variáveis
// --pg-ease-* e --pg-dur-* de pilgrimage-theme.css.

/** Entradas: começa rápido e assenta devagar. */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
/** Transições entre paragens: in-out forte e cinematográfico. */
export const EASE_CINE = [0.76, 0, 0.24, 1] as const;
/** Hovers e mudanças de estado. */
export const EASE_SOFT = [0.4, 0, 0.2, 1] as const;

export const DUR = {
    fast: 0.25,
    base: 0.6,
    slow: 1.1,
    cine: 1.6,
} as const;

/** Molas para elementos que seguem o scroll ou o cursor. */
export const SPRING = {
    /** Painel de inscrição, barras e indicadores de progresso. */
    ui: { stiffness: 260, damping: 32, mass: 0.6 },
    /** Imagens com parallax: mais pesado, sem ressalto. */
    media: { stiffness: 90, damping: 26, mass: 0.9 },
} as const;

/** Margem do viewport para disparar as entradas um pouco antes do fim do ecrã. */
export const IN_VIEW_MARGIN = '0px 0px -12% 0px';

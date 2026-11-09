// Tipos partilhados pelos componentes da página de detalhe.

export type CinemaStage = {
    id: string;
    title: string;
    description?: string;
    lat: number;
    lng: number;
    image_url?: string | null;
    display_order: number;
};

export type CinemaItineraryItem = {
    id: string;
    day_number: number;
    title: string;
    title_en?: string | null;
    description: string;
    description_en?: string | null;
    image_url: string;
    images?: string[] | null;
};

export type CinemaTeamMember = {
    id?: string;
    name: string;
    role: string;
    role_en?: string | null;
    country: string;
    image_url: string;
    is_special_guest: boolean;
    description: string;
    description_en?: string | null;
};

/**
 * O que o botão principal faz. Calculado na página com as mesmas regras de
 * sempre (encerrada → desativado; lista de espera → modal; inscrição existente
 * → gerir; aviso de pagamento → modal; senão → link de inscrição).
 */
export type BookingCta = {
    kind: 'closed' | 'waitlist' | 'manage' | 'start';
    label: string;
    href: string;
    /** Quando existe, o botão é <button> e chama isto em vez de navegar. */
    onClick?: () => void;
};

/** Preço e condições, já formatados na página (sem contas aqui). */
export type BookingSummary = {
    startingEUR: string;
    startingConverted?: string | null;
    baseEUR: string;
    depositEUR: string;
    currency: string;
    maxInstallments: number;
    departureLabel: string;
    deadlineLabel?: string | null;
    /** Só quando restam poucos lugares (≤ 6), como antes. */
    lastSpots: boolean;
    hasIncludedInfo: boolean;
    hasFlightInfo: boolean;
    flightsLabel: string;
    flightsHint: string;
    onOpenIncluded: () => void;
    onOpenFlights: () => void;
};

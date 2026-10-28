/** Destinos internos que uma notificação pode abrir na app móvel. */
export const PUSH_DESTINATIONS = [
    { value: '/', label: 'Início' },
    { value: '/pray', label: 'Rezar' },
    { value: '/prayer/daily', label: 'Oração do dia' },
    { value: '/explore', label: 'Explorar' },
    { value: '/pilgrimages', label: 'Peregrinações' },
    { value: '/support', label: 'Apoiar' },
    { value: '/profile', label: 'Perfil' },
] as const;

export function isAllowedPushDestination(value: string): boolean {
    return PUSH_DESTINATIONS.some((destination) => destination.value === value);
}

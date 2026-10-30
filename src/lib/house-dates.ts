import type { HouseRange } from './house-booking';

const pad = (value: number) => String(value).padStart(2, '0');
export const dayKey = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const addDays = (key: string, days: number) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};
export const nightsBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
export const nightTaken = (night: string, ranges: HouseRange[]) =>
  ranges.some(range => night >= range.startsOn && night < range.endsOn);
export const stayOverlaps = (from: string, to: string, ranges: HouseRange[]) =>
  ranges.some(range => range.startsOn < to && range.endsOn > from);
export const formatHouseDay = (day: string, locale: string, weekday = false) =>
  new Intl.DateTimeFormat(locale, { timeZone: 'UTC', day: 'numeric', month: 'short', ...(weekday ? { weekday: 'short' } : {}) })
    .format(new Date(`${day}T00:00:00Z`));

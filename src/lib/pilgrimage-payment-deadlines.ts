const DAY_MS = 24 * 60 * 60 * 1000;

const toUtcDay = (value: Date) =>
  new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));

export const daysBetweenUtc = (from: Date, to: Date) => {
  const diff = toUtcDay(to).getTime() - toUtcDay(from).getTime();
  return Math.round(diff / DAY_MS);
};

export const getRegistrationFeeDueDate = (createdAt?: string | null) => {
  const date = new Date(String(createdAt || '').trim());
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + 5);
  return date.toISOString();
};

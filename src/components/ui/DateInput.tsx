import React, { useEffect, useRef, useState } from 'react';

interface DateInputProps {
    value?: string;
    onChange: (value: string) => void;
    error?: string;
    label?: string;
    isEn?: boolean;
    autoFocus?: boolean;
}

const MONTHS_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

type Part = 'day' | 'month' | 'year';

// US devices write dates month-first; everyone else day-first.
const prefersMonthFirst = () => {
    if (typeof navigator === 'undefined') return false;
    const tag = (navigator.languages && navigator.languages[0]) || navigator.language || '';
    return /^en-US$/i.test(tag);
};

// A whole date typed or pasted into one box ("07/04/1960", "15.03.1962",
// "1962-03-15", "07041960"). Returns null when it is not clearly a full date.
const parseWholeDate = (raw: string, monthFirst: boolean): { day: string; month: string; year: string } | null => {
    const trimmed = raw.trim();
    let a: number, b: number, y: number;
    const iso = /^(\d{4})\D(\d{1,2})\D(\d{1,2})$/.exec(trimmed);
    const parts = trimmed.split(/\D+/).filter(Boolean);
    if (iso) {
        [y, b, a] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
        // ISO is always year-month-day.
        return toParts(a, b, y);
    } else if (parts.length === 3 && parts[2].length === 4) {
        [a, b, y] = parts.map(Number);
    } else if (/^\d{8}$/.test(trimmed)) {
        [a, b, y] = [Number(trimmed.slice(0, 2)), Number(trimmed.slice(2, 4)), Number(trimmed.slice(4))];
    } else {
        return null;
    }
    // Unambiguous when one side cannot be a month; otherwise follow the device order.
    if (a > 12) return toParts(a, b, y);
    if (b > 12) return toParts(b, a, y);
    return monthFirst ? toParts(b, a, y) : toParts(a, b, y);
};

const toParts = (day: number, month: number, year: number) => {
    if (!(month >= 1 && month <= 12 && day >= 1 && day <= new Date(year, month, 0).getDate())) return null;
    return { day: String(day).padStart(2, '0'), month: String(month).padStart(2, '0'), year: String(year) };
};

// Day and year are typed (numeric keypad on phones, auto-advance like the big
// apps do); the month stays a named list so nobody has to think "is 03 March?".
// The month list also takes digits, so people who type the whole date in one
// go ("07041960") are not stuck when focus lands on it.
const DateInput: React.FC<DateInputProps> = ({ value, onChange, error, label, isEn = false, autoFocus = false }) => {
    const [day, setDay] = useState<string>('');
    const [month, setMonth] = useState<string>('');
    const [year, setYear] = useState<string>('');
    const [monthFirst, setMonthFirst] = useState(false);
    const dayRef = useRef<HTMLInputElement>(null);
    const monthRef = useRef<HTMLSelectElement>(null);
    const yearRef = useRef<HTMLInputElement>(null);
    const monthKeys = useRef({ buffer: '', at: 0 });

    // Read after mount so the server and first client render agree.
    useEffect(() => {
        setMonthFirst(isEn && prefersMonthFirst());
    }, [isEn]);

    // Initialize from value if present. Read the YYYY-MM-DD parts directly:
    // `new Date('1962-03-15')` is UTC midnight, which shows as the 14th in
    // Brazil (UTC-3) and would then be saved back one day early.
    useEffect(() => {
        const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
        if (match) {
            setYear(match[1]);
            setMonth(match[2]);
            setDay(match[3]);
        }
    }, [value]);

    const currentYear = new Date().getFullYear();
    const order: Part[] = monthFirst ? ['month', 'day', 'year'] : ['day', 'month', 'year'];
    const refs = { day: dayRef, month: monthRef, year: yearRef };
    const focusAfter = (part: Part) => {
        const next = order[order.indexOf(part) + 1];
        if (next) refs[next].current?.focus();
    };

    const emit = (newDay: string, newMonth: string, newYear: string) => {
        const d = parseInt(newDay, 10);
        const m = parseInt(newMonth, 10);
        const y = parseInt(newYear, 10);
        const complete = newDay.length === 2 && newMonth && newYear.length === 4
            && d >= 1 && d <= 31 && y >= currentYear - 110 && y <= currentYear;

        if (!complete) {
            // Incomplete or out of range: clear so the required validation catches it.
            if (value) onChange('');
            return;
        }

        const lastDay = new Date(y, m, 0).getDate();
        const safeDay = String(Math.min(d, lastDay)).padStart(2, '0');
        if (d > lastDay) setDay(safeDay);
        onChange(`${newYear}-${newMonth}-${safeDay}`);
    };

    // A full date typed or pasted into the day or year box fills all three.
    const applyWholeDate = (raw: string) => {
        if (!/\D/.test(raw.trim()) && raw.trim().length < 8) return false;
        const parsed = parseWholeDate(raw, monthFirst);
        if (!parsed) return false;
        setDay(parsed.day);
        setMonth(parsed.month);
        setYear(parsed.year);
        emit(parsed.day, parsed.month, parsed.year);
        return true;
    };

    const handleDay = (raw: string) => {
        if (raw.replace(/\D/g, '').length > 2 && applyWholeDate(raw)) return;
        const val = raw.replace(/\D/g, '').slice(0, 2);
        // A lone "1"–"3" may still become "12"/"31": wait for the second digit
        // (or blur) so the parent never reformats the field mid-typing.
        const done = val.length === 2 || (val.length === 1 && Number(val) > 3);
        const padded = done ? val.padStart(2, '0') : '';
        setDay(done ? padded : val);
        emit(padded, month, year);
        if (done) focusAfter('day');
    };

    // Read the field, not `day`: auto-advance blurs it inside handleDay, before
    // the new value renders, and the stale "1" of "15" would be padded to "01".
    const handleDayBlur = (event: React.FocusEvent<HTMLInputElement>) => {
        const current = event.target.value.replace(/\D/g, '');
        if (current.length !== 1) return;
        const padded = current.padStart(2, '0');
        setDay(padded);
        emit(padded, month, year);
    };

    const handleMonth = (val: string) => {
        setMonth(val);
        emit(day.padStart(2, '0'), val, year);
        const next = order[order.indexOf('month') + 1];
        if (val && next && (next === 'day' ? day.length < 2 : year.length < 4)) refs[next].current?.focus();
    };

    // Digits on the month list: "3" → March, "1" then "2" → December, "07" → July.
    const handleMonthKeyDown = (event: React.KeyboardEvent<HTMLSelectElement>) => {
        if (event.metaKey || event.ctrlKey || event.altKey) return;
        if (/^[/.\- ]$/.test(event.key)) {
            event.preventDefault();
            if (month) focusAfter('month');
            return;
        }
        if (!/^\d$/.test(event.key)) return;
        event.preventDefault();

        const now = Date.now();
        const keys = monthKeys.current;
        const buffer = (now - keys.at < 1200 ? keys.buffer : '') + event.key;
        keys.at = now;
        const n = Number(buffer);

        if (buffer.length === 1) {
            keys.buffer = n <= 1 ? buffer : '';
            if (n === 0) return;
            const val = String(n).padStart(2, '0');
            if (n === 1) {
                // Could still be 10–12: pick January for now, wait for the next digit.
                setMonth(val);
                emit(day.padStart(2, '0'), val, year);
                return;
            }
            handleMonth(val);
            focusAfter('month');
            return;
        }

        keys.buffer = '';
        if (n >= 1 && n <= 12) {
            handleMonth(String(n).padStart(2, '0'));
            focusAfter('month');
            return;
        }
        // "19…": the 1 was January and the 9 starts the next box.
        const next = order[order.indexOf('month') + 1];
        focusAfter('month');
        if (next === 'year') handleYear(event.key);
        else if (next === 'day') handleDay(event.key);
    };

    const handleYear = (raw: string) => {
        if (raw.replace(/\D/g, '').length > 4 && applyWholeDate(raw)) return;
        const val = raw.replace(/\D/g, '').slice(0, 4);
        setYear(val);
        emit(day.padStart(2, '0'), month, val);
    };

    const months = isEn ? MONTHS_EN : MONTHS_PT;

    const fields: Record<Part, React.ReactNode> = {
        day: (
            <label key="day" className={`reg-field ${error ? 'is-invalid' : ''}`}>
                <span className="reg-field-label">{isEn ? 'Day' : 'Dia'}</span>
                <input
                    ref={dayRef}
                    type="text"
                    inputMode="numeric"
                    autoComplete="bday-day"
                    placeholder="DD"
                    value={day}
                    onChange={(e) => handleDay(e.target.value)}
                    onBlur={handleDayBlur}
                    autoFocus={autoFocus && !monthFirst}
                />
            </label>
        ),
        month: (
            <label key="month" className={`reg-field reg-field-select ${error ? 'is-invalid' : ''}`}>
                <span className="reg-field-label">{isEn ? 'Month' : 'Mês'}</span>
                <select
                    ref={monthRef}
                    autoComplete="bday-month"
                    value={month}
                    onChange={(e) => handleMonth(e.target.value)}
                    onKeyDown={handleMonthKeyDown}
                    autoFocus={autoFocus && monthFirst}
                >
                    <option value="" disabled>—</option>
                    {months.map((m, i) => (
                        <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
                    ))}
                </select>
            </label>
        ),
        year: (
            <label key="year" className={`reg-field ${error ? 'is-invalid' : ''}`}>
                <span className="reg-field-label">{isEn ? 'Year' : 'Ano'}</span>
                <input
                    ref={yearRef}
                    type="text"
                    inputMode="numeric"
                    autoComplete="bday-year"
                    placeholder={isEn ? 'YYYY' : 'AAAA'}
                    value={year}
                    onChange={(e) => handleYear(e.target.value)}
                />
            </label>
        ),
    };

    return (
        <div>
            {label && <span className="reg-label-out">{label}</span>}
            <div className={`reg-date ${monthFirst ? 'is-month-first' : ''}`} role="group" aria-label={label}>
                {order.map((part) => fields[part])}
            </div>
            {error && <span className="reg-error" role="alert">{error}</span>}
        </div>
    );
};

export default DateInput;

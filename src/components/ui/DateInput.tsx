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

// Day and year are typed (numeric keypad on phones, auto-advance like the big
// apps do); the month stays a named list so nobody has to think "is 03 March?".
const DateInput: React.FC<DateInputProps> = ({ value, onChange, error, label, isEn = false, autoFocus = false }) => {
    const [day, setDay] = useState<string>('');
    const [month, setMonth] = useState<string>('');
    const [year, setYear] = useState<string>('');
    const monthRef = useRef<HTMLSelectElement>(null);
    const yearRef = useRef<HTMLInputElement>(null);

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

    const handleDay = (raw: string) => {
        const val = raw.replace(/\D/g, '').slice(0, 2);
        // A lone "1"–"3" may still become "12"/"31": wait for the second digit
        // (or blur) so the parent never reformats the field mid-typing.
        const done = val.length === 2 || (val.length === 1 && Number(val) > 3);
        const padded = done ? val.padStart(2, '0') : '';
        setDay(done ? padded : val);
        emit(padded, month, year);
        if (done) monthRef.current?.focus();
    };

    const handleDayBlur = () => {
        if (day.length !== 1) return;
        const padded = day.padStart(2, '0');
        setDay(padded);
        emit(padded, month, year);
    };

    const handleMonth = (val: string) => {
        setMonth(val);
        emit(day.padStart(2, '0'), val, year);
        if (val && year.length < 4) yearRef.current?.focus();
    };

    const handleYear = (raw: string) => {
        const val = raw.replace(/\D/g, '').slice(0, 4);
        setYear(val);
        emit(day.padStart(2, '0'), month, val);
    };

    const months = isEn ? MONTHS_EN : MONTHS_PT;

    return (
        <div>
            {label && <span className="reg-label-out">{label}</span>}
            <div className="reg-date" role="group" aria-label={label}>
                <label className={`reg-field ${error ? 'is-invalid' : ''}`}>
                    <span className="reg-field-label">{isEn ? 'Day' : 'Dia'}</span>
                    <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="bday-day"
                        placeholder={isEn ? 'DD' : 'DD'}
                        value={day}
                        onChange={(e) => handleDay(e.target.value)}
                        onBlur={handleDayBlur}
                        autoFocus={autoFocus}
                        maxLength={2}
                    />
                </label>
                <label className={`reg-field reg-field-select ${error ? 'is-invalid' : ''}`}>
                    <span className="reg-field-label">{isEn ? 'Month' : 'Mês'}</span>
                    <select
                        ref={monthRef}
                        autoComplete="bday-month"
                        value={month}
                        onChange={(e) => handleMonth(e.target.value)}
                    >
                        <option value="" disabled>—</option>
                        {months.map((m, i) => (
                            <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
                        ))}
                    </select>
                </label>
                <label className={`reg-field ${error ? 'is-invalid' : ''}`}>
                    <span className="reg-field-label">{isEn ? 'Year' : 'Ano'}</span>
                    <input
                        ref={yearRef}
                        type="text"
                        inputMode="numeric"
                        autoComplete="bday-year"
                        placeholder={isEn ? 'YYYY' : 'AAAA'}
                        value={year}
                        onChange={(e) => handleYear(e.target.value)}
                        maxLength={4}
                    />
                </label>
            </div>
            {error && <span className="reg-error" role="alert">{error}</span>}
        </div>
    );
};

export default DateInput;

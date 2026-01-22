import React, { useEffect, useState } from 'react';

interface DateInputProps {
    value?: string;
    onChange: (value: string) => void;
    error?: string;
}

const MONTHS = [
    { value: '01', label: 'Janeiro' },
    { value: '02', label: 'Fevereiro' },
    { value: '03', label: 'Março' },
    { value: '04', label: 'Abril' },
    { value: '05', label: 'Maio' },
    { value: '06', label: 'Junho' },
    { value: '07', label: 'Julho' },
    { value: '08', label: 'Agosto' },
    { value: '09', label: 'Setembro' },
    { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },
    { value: '12', label: 'Dezembro' },
];

const DateInput: React.FC<DateInputProps> = ({ value, onChange, error }) => {
    const [day, setDay] = useState<string>('');
    const [month, setMonth] = useState<string>('');
    const [year, setYear] = useState<string>('');

    // Initialize from value if present
    useEffect(() => {
        if (value) {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                setDay(String(date.getDate()).padStart(2, '0'));
                setMonth(String(date.getMonth() + 1).padStart(2, '0'));
                setYear(String(date.getFullYear()));
            }
        }
    }, [value]);

    const handleChange = (type: 'day' | 'month' | 'year', val: string) => {
        let newDay = type === 'day' ? val : day;
        let newMonth = type === 'month' ? val : month;
        let newYear = type === 'year' ? val : year;

        if (type === 'day') setDay(val);
        if (type === 'month') setMonth(val);
        if (type === 'year') setYear(val);

        if (newDay && newMonth && newYear) {
            // Validate day in month
            const d = parseInt(newDay);
            const m = parseInt(newMonth);
            const y = parseInt(newYear);
            const lastDay = new Date(y, m, 0).getDate();

            if (d > lastDay) {
                // If day is invalid for month (e.g. 31 Feb), don't update parent yet or handle gracefully?
                // For now, let's just construct it. ISO format: YYYY-MM-DD
                // But better to stick to valid dates.
                onChange(`${newYear}-${newMonth}-${String(lastDay).padStart(2, '0')}`);
                setDay(String(lastDay).padStart(2, '0'));
            } else {
                onChange(`${newYear}-${newMonth}-${newDay}`);
            }
        } else {
            // If incomplete, do we send empty? Or keep previous?
            // Sending empty might trigger required validation.
            // Let's refrain from sending incomplete dates unless we want to clear it.
            if (!newDay && !newMonth && !newYear) {
                onChange('');
            }
        }
    };

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 100 }, (_, i) => String(currentYear - i));
    const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));

    const selectClass = "bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-5 text-white text-lg focus:border-yellow-500 focus:outline-none appearance-none cursor-pointer";

    return (
        <div className="space-y-2">
            <div className="grid grid-cols-3 gap-3">
                <div className="relative">
                    <select
                        value={day}
                        onChange={(e) => handleChange('day', e.target.value)}
                        className={`${selectClass} w-full`}
                    >
                        <option value="" disabled>Dia</option>
                        {days.map(d => (
                            <option key={d} value={d}>{d}</option>
                        ))}
                    </select>
                </div>
                <div className="relative">
                    <select
                        value={month}
                        onChange={(e) => handleChange('month', e.target.value)}
                        className={`${selectClass} w-full`}
                    >
                        <option value="" disabled>Mês</option>
                        {MONTHS.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                    </select>
                </div>
                <div className="relative">
                    <select
                        value={year}
                        onChange={(e) => handleChange('year', e.target.value)}
                        className={`${selectClass} w-full`}
                    >
                        <option value="" disabled>Ano</option>
                        {years.map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
            </div>
            {error && <span className="text-red-500 text-sm mt-1 block font-medium">{error}</span>}
        </div>
    );
};

export default DateInput;

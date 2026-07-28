"use client";

import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import type { HistoryPoint } from './PaymentCurrencyDisplay';

type ExchangeRateChartProps = {
    points: HistoryPoint[];
    currency: 'BRL' | 'USD';
    isEn: boolean;
};

const formatDate = (date: string, isEn: boolean, long = false) =>
    new Intl.DateTimeFormat(isEn ? 'en-US' : 'pt-PT', {
        day: '2-digit',
        month: long ? 'short' : '2-digit',
    }).format(new Date(`${date}T12:00:00Z`));

const formatRate = (rate: number, currency: string) =>
    new Intl.NumberFormat(currency === 'BRL' ? 'pt-BR' : 'en-US', {
        minimumFractionDigits: currency === 'BRL' ? 2 : 3,
        maximumFractionDigits: currency === 'BRL' ? 2 : 3,
    }).format(rate);

export default function ExchangeRateChart({
    points,
    currency,
    isEn,
}: ExchangeRateChartProps) {
    return (
        <div className="h-64 min-h-64 min-w-0 w-full rounded-2xl border border-slate-100 bg-slate-50/70 px-1 pb-2 pt-5 sm:h-72 sm:min-h-72">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
                <AreaChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="exchangeRateFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#d97706" stopOpacity={0.28} />
                            <stop offset="95%" stopColor="#d97706" stopOpacity={0.02} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                        dataKey="date"
                        tickFormatter={(value) => formatDate(value, isEn)}
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={30}
                    />
                    <YAxis
                        domain={['dataMin - 0.02', 'dataMax + 0.02']}
                        tickFormatter={(value) => Number(value).toFixed(currency === 'BRL' ? 2 : 3)}
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                        width={44}
                    />
                    <Tooltip
                        labelFormatter={(value) => formatDate(String(value), isEn, true)}
                        formatter={(value) => [
                            `1 EUR = ${formatRate(Number(value), currency)} ${currency}`,
                            isEn ? 'Rate' : 'Taxa',
                        ]}
                        contentStyle={{
                            borderRadius: 14,
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 12px 30px rgba(15,23,42,.12)',
                            fontSize: 12,
                        }}
                    />
                    <Area
                        type="monotone"
                        dataKey="rate"
                        stroke="#d97706"
                        strokeWidth={3}
                        fill="url(#exchangeRateFill)"
                        activeDot={{ r: 5, fill: '#d97706', stroke: '#fff', strokeWidth: 2 }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

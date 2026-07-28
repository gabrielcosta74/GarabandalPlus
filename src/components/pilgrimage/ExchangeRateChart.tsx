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
        <div className="h-[260px] min-h-[260px] w-full min-w-0 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/70 sm:h-[300px] sm:min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <AreaChart data={points} margin={{ top: 18, right: 16, left: 4, bottom: 8 }}>
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
                        tick={{ fontSize: 12, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={30}
                    />
                    <YAxis
                        domain={['dataMin - 0.02', 'dataMax + 0.02']}
                        tickFormatter={(value) => Number(value).toFixed(currency === 'BRL' ? 2 : 3)}
                        tick={{ fontSize: 12, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                        width={52}
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
                            fontSize: 13,
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

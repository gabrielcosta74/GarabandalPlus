"use client";

import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";

type ChartData = {
    name: string;
    value: number;
};

interface DashboardChartsProps {
    data: ChartData[];
}

export default function DashboardCharts({ data }: DashboardChartsProps) {
    if (!data || data.length === 0) {
        return (
            <div className="h-64 w-full flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
                <p className="text-gray-500 text-sm">Sem dados suficientes para o gráfico</p>
            </div>
        );
    }

    return (
        <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                    data={data}
                    margin={{
                        top: 10,
                        right: 0,
                        left: -20,
                        bottom: 0,
                    }}
                >
                    <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.1} />
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#6B7280' }}
                        tickFormatter={(value) => {
                            const date = new Date(value);
                            return `${date.getDate()}/${date.getMonth() + 1}`;
                        }}
                        interval="preserveStartEnd"
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#6B7280' }}
                        tickFormatter={(value) => `€${value}`}
                    />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                        itemStyle={{ color: '#111827', fontWeight: 600 }}
                        formatter={(value: number, name: string) => [`€${value ? value.toFixed(2) : '0.00'}`, 'Receita']}
                        labelFormatter={(label) => new Date(label).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })}
                    />
                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#10B981"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorRevenue)"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

"use client";

import {
    ComposedChart,
    Line,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend
} from "recharts";
import { ArrowUpRight, ArrowDownRight, Package, AlertTriangle, ExternalLink } from 'lucide-react';

// --- Types ---
export type RevenueTrendData = {
    date: string;
    revenue: number;
    orders: number;
};

export type RevenueDistData = {
    name: string;
    value: number;
};

// --- WIDGET 1: Revenue Trend (Composed Bar + Line) ---
export function RevenueTrendWidget({ data }: { data: RevenueTrendData[] }) {
    if (!data || data.length === 0) return <EmptyState label="Sem dados de receita recentes" />;

    return (
        <div className="w-full h-[300px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                        tickFormatter={(val) => {
                            const d = new Date(val);
                            return `${d.getDate()}/${d.getMonth() + 1}`;
                        }}
                        minTickGap={30}
                    />
                    <YAxis
                        yAxisId="left"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                        tickFormatter={(val) => `€${val}`}
                    />
                    <YAxis
                        yAxisId="right"
                        orientation="right"
                        axisLine={false}
                        tickLine={false}
                        hide
                    />
                    <Tooltip
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                        formatter={(value: number, name: string) => {
                            if (name === 'revenue') return [`€${value.toFixed(2)}`, 'Receita'];
                            if (name === 'orders') return [value, 'Transações'];
                            return [value, name];
                        }}
                        labelFormatter={(label) => new Date(label).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })}
                    />
                    <Bar
                        yAxisId="left"
                        dataKey="revenue"
                        barSize={20}
                        fill="url(#colorBar)"
                        radius={[4, 4, 0, 0]}
                    />
                    <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="orders"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={false}
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}

// --- WIDGET 2: Revenue Distribution (Donut) ---
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

export function RevenueDistWidget({ data }: { data: RevenueDistData[] }) {
    if (!data || data.length === 0) return <EmptyState label="Sem dados de distribuição" />;

    return (
        <div className="w-full h-[300px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                    >
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip
                        formatter={(value: number) => `€${value.toFixed(2)}`}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                    />
                    <Legend
                        verticalAlign="bottom"
                        height={36}
                        iconType="circle"
                        formatter={(value) => <span className="text-xs font-medium text-slate-600">{value}</span>}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}

// --- KPI CARD ---
export function KpiCard({ title, value, trend, prefix = "€" }: { title: string, value: number, trend: number, prefix?: string }) {
    const isPositive = trend >= 0;
    return (
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between h-full">
            <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{title}</p>
                <h3 className="text-2xl font-bold text-slate-900">
                    {prefix === '€' ? new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value) : value}
                </h3>
            </div>
            <div className="mt-4 flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {Math.abs(trend).toFixed(1)}%
                </span>
                <span className="text-xs text-slate-400">vs mês anterior</span>
            </div>
        </div>
    );
}

// --- HELPERS ---
function EmptyState({ label }: { label: string }) {
    return (
        <div className="flex h-full w-full items-center justify-center p-8 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
            <span className="text-sm text-slate-400 font-medium">{label}</span>
        </div>
    );
}

export function LowStockList({ items }: { items: any[] }) {
    if (!items?.length) return <EmptyState label="Stock OK" />;
    return (
        <div className="space-y-3">
            {items.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-orange-500">
                            <Package size={16} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-700">{item.name}</p>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">ID: {item.id.slice(0, 6)}...</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-rose-500 bg-rose-50 px-2 py-1 rounded-md border border-rose-100">
                            {item.stock} un
                        </span>
                        <a href={`/admin/loja/produto/${item.id}`} className="p-1 text-slate-300 hover:text-slate-600 transition-colors">
                            <ExternalLink size={14} />
                        </a>
                    </div>
                </div>
            ))}
        </div>
    );
}

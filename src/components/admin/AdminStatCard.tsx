
import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

type AdminStatCardProps = {
    title: string;
    value: string | number;
    trend?: number; // percentage (e.g., 12.5)
    trendLabel?: string; // e.g., "vs last month"
    icon: any;
    color?: 'gold' | 'blue' | 'purple' | 'green';
};

export default function AdminStatCard({ title, value, trend, trendLabel, icon: Icon, color = 'gold' }: AdminStatCardProps) {

    const colorStyles = {
        gold: 'bg-garabandal-gold/10 text-garabandal-dark border-garabandal-gold/20',
        blue: 'bg-blue-50 text-blue-700 border-blue-200',
        purple: 'bg-purple-50 text-purple-700 border-purple-200',
        green: 'bg-green-50 text-green-700 border-green-200'
    };

    const iconColorStyles = {
        gold: 'text-garabandal-dark',
        blue: 'text-blue-600',
        purple: 'text-purple-600',
        green: 'text-green-600'
    };

    const isPositive = trend && trend > 0;
    const isNegative = trend && trend < 0;

    return (
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            {/* Background decoration */}
            <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-0 group-hover:opacity-10 transition-opacity ${colorStyles[color].split(' ')[0]} blur-2xl`}></div>

            <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${colorStyles[color]}`}>
                    <Icon className={`w-6 h-6 ${iconColorStyles[color]}`} />
                </div>
                {trend !== undefined && (
                    <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${isPositive ? 'bg-green-50 text-green-700' : isNegative ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-600'}`}>
                        {isPositive ? <ArrowUpRight className="w-3 h-3" /> : isNegative ? <ArrowDownRight className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                        <span>{Math.abs(trend)}%</span>
                    </div>
                )}
            </div>

            <div>
                <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
                <h3 className="text-2xl font-bold text-gray-900 tracking-tight">{value}</h3>
                {trendLabel && <p className="text-xs text-gray-400 mt-2">{trendLabel}</p>}
            </div>
        </div>
    );
}

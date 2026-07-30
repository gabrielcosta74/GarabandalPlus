export default function FactptDashboardSkeleton() {
    return (
        <div className="grid gap-5" aria-label="A carregar faturação" aria-busy="true">
            <div className="flex items-center justify-between gap-3">
                <div className="h-11 w-52 animate-pulse rounded-xl bg-slate-200/70" />
                <div className="h-11 w-64 animate-pulse rounded-xl bg-slate-200/70" />
            </div>
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                {Array.from({ length: 4 }, (_, index) => (
                    <div key={index} className="h-[132px] animate-pulse rounded-2xl bg-slate-200/60" />
                ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
                <div className="h-56 animate-pulse rounded-2xl bg-slate-200/60" />
                <div className="h-56 animate-pulse rounded-2xl bg-slate-200/60" />
            </div>
            <div className="h-96 animate-pulse rounded-2xl bg-slate-200/60" />
        </div>
    );
}

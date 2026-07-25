import RichText from './RichText';
import ItineraryDaySlideshow from './ItineraryDaySlideshow';

interface ItineraryItem {
    id: string;
    day_number: number;
    title: string;
    title_en?: string | null;
    description: string;
    description_en?: string | null;
    image_url: string;
    images?: string[] | null;
}

function DayBadge({ label, className = '' }: { label: string; className?: string }) {
    return (
        <span className={`inline-flex items-center rounded-full bg-yellow-300 px-3.5 py-1.5 text-[11px] font-black uppercase tracking-wide text-slate-950 shadow-sm ${className}`}>
            {label}
        </span>
    );
}

export default function PilgrimageItineraryDays({ items, isEn }: { items: ItineraryItem[]; isEn: boolean }) {
    if (!items || items.length === 0) {
        return (
            <p className="text-slate-500 italic">
                {isEn ? 'Detailed itinerary coming soon.' : 'Roteiro detalhado em breve.'}
            </p>
        );
    }

    return (
        // Break out of the section's horizontal padding on mobile so day cards
        // run edge-to-edge (full screen width); contained again from `sm` up.
        <div className="-mx-5 space-y-4 sm:mx-0 md:space-y-6">
            {items.map((item) => {
                const title = isEn ? item.title_en || item.title : item.title;
                const dayLabel = isEn ? `Day ${item.day_number}` : `Dia ${item.day_number}`;
                const gallery = (Array.isArray(item.images) ? item.images : [])
                    .filter(Boolean);
                if (gallery.length === 0 && item.image_url) gallery.push(item.image_url);
                return (
                    <article
                        key={item.id}
                        className="group overflow-hidden border-y border-slate-100 bg-white shadow-sm transition-all sm:rounded-3xl sm:border hover:shadow-lg hover:border-yellow-200"
                    >
                        {gallery.length > 0 && (
                            <ItineraryDaySlideshow images={gallery} alt={title} dayLabel={dayLabel} />
                        )}

                        <div className="p-5 sm:p-6 md:p-7">
                            {gallery.length === 0 && <DayBadge label={dayLabel} className="mb-3" />}
                            <h3 className="mb-2 font-serif text-xl font-bold leading-tight text-slate-950 sm:text-2xl">
                                {title}
                            </h3>
                            <RichText
                                value={isEn ? item.description_en || item.description : item.description}
                                className="text-[15px] leading-7 text-slate-600 sm:text-base"
                            />
                        </div>
                    </article>
                );
            })}
        </div>
    );
}

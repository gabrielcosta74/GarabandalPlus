import RichText from './RichText';
import ItineraryDaySlideshow from './ItineraryDaySlideshow';
import './pilgrimage-itinerary.css';

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

export default function PilgrimageItineraryDays({ items, isEn }: { items: ItineraryItem[]; isEn: boolean }) {
    if (!items || items.length === 0) {
        return <p className="itinerary-empty">{isEn ? 'Detailed itinerary coming soon.' : 'Roteiro detalhado em breve.'}</p>;
    }

    const days = [...items].sort((a, b) => a.day_number - b.day_number);

    return (
        <div className="pilgrimage-itinerary">
            {days.length > 1 && (
                <nav className="itinerary-day-nav" aria-label={isEn ? 'Jump to a day' : 'Ir para um dia'}>
                    {days.map((item) => (
                        <a key={item.id} href={`#itinerary-day-${item.id}`}>
                            <span>{isEn ? 'Day' : 'Dia'} {item.day_number}</span>
                            <span className="itinerary-day-nav-title">{isEn ? item.title_en || item.title : item.title}</span>
                        </a>
                    ))}
                </nav>
            )}

            <div className="itinerary-day-list">
                {days.map((item) => {
                const title = isEn ? item.title_en || item.title : item.title;
                const dayLabel = isEn ? `Day ${item.day_number}` : `Dia ${item.day_number}`;
                const gallery = (Array.isArray(item.images) ? item.images : [])
                    .filter(Boolean);
                if (gallery.length === 0 && item.image_url) gallery.push(item.image_url);
                return (
                    <article
                        id={`itinerary-day-${item.id}`}
                        key={item.id}
                        className={`itinerary-day-card ${gallery.length ? 'has-gallery' : ''}`}
                    >
                        {gallery.length > 0 && (
                            <div className="itinerary-card-media"><ItineraryDaySlideshow images={gallery} alt={title} dayLabel={dayLabel} isEn={isEn} /></div>
                        )}

                        <div className="itinerary-card-content">
                            <div className="itinerary-card-heading">
                                <span className="itinerary-card-number" aria-hidden="true">{String(item.day_number).padStart(2, '0')}</span>
                                <div><span className="itinerary-card-eyebrow">{dayLabel}</span><h3>{title}</h3></div>
                            </div>
                            <RichText
                                value={isEn ? item.description_en || item.description : item.description}
                                className="itinerary-card-description"
                            />
                        </div>
                    </article>
                );
                })}
            </div>
        </div>
    );
}

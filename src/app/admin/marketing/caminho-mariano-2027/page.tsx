import { renderMarketingEmail } from '../../../../lib/marketing-email';
import { MARIAN_2027_STEPS, marian2027EmailContext } from '../../../../lib/marian-2027-campaign';
import MarianCampaignPreview from './preview';

export const metadata = { title: 'Emails · Caminho Mariano 2027' };

export default function Marian2027CampaignPage() {
  const buildPreviews = (language: 'pt' | 'en') => MARIAN_2027_STEPS.map((step, index) => {
    const rendered = renderMarketingEmail({
      contact: {
        display_name: 'Maria',
        normalized_email: 'maria@example.com',
        language,
        recommendation: 'Caminho Mariano 2027',
      },
      templateKey: step.key,
      context: {
        ...marian2027EmailContext(step.key),
        unsubscribeUrl: '#',
      },
    });
    const englishLabels = ['01 · Invitation', '02 · The itinerary', '03 · Before you register'];
    return { key: step.key, label: language === 'en' ? englishLabels[index] : step.label, day: step.day, subject: rendered.subject, html: rendered.html, image: step.image };
  });

  return <MarianCampaignPreview previews={{ pt: buildPreviews('pt'), en: buildPreviews('en') }} />;
}

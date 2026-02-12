import { cache } from 'react';
import styles from '../app/page.module.css';
import { getAppUrl } from '../lib/config';

type DonationMeta = {
  goal: number;
  raised: number;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'EUR' }).format(value);

const loadMeta = cache(async (): Promise<DonationMeta> => {
  const siteUrl = getAppUrl();
  try {
    const res = await fetch(`${siteUrl}/api/donations/meta`);
    if (!res.ok) return { goal: 2500, raised: 0 };
    const data = await res.json();
    if (typeof data?.goal === 'number' && typeof data?.raised === 'number') {
      return { goal: data.goal, raised: data.raised };
    }
  } catch {
    // ignore
  }
  return { goal: 2500, raised: 0 };
});

export default async function DonationProgress() {
  const meta = await loadMeta();
  const progress = meta.goal <= 0 ? 0 : Math.min(100, Math.round((meta.raised / meta.goal) * 100));

  return (
    <div className={styles.donationProgress}>
      <div className={styles.donationHeader}>
        <div>
          <span className={styles.donationEyebrow}>Progresso das doações</span>
          <h3>Meta atual da missão</h3>
          <p>
            Já arrecadamos <strong>{formatCurrency(meta.raised)}</strong> de{' '}
            <strong>{formatCurrency(meta.goal)}</strong>.
          </p>
        </div>
        <div className={styles.donationPercent}>{progress}%</div>
      </div>
      <div className={styles.donationBar}>
        <span className={styles.donationFill} style={{ width: `${progress}%` }} />
      </div>
      <div className={styles.donationFoot}>
        <span>{formatCurrency(meta.raised)} arrecadado</span>
        <span>{formatCurrency(Math.max(meta.goal - meta.raised, 0))} faltando</span>
      </div>
    </div>
  );
}

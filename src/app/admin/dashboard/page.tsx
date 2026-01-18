"use client";

import AdminShell from '../AdminShell';
import styles from '../detail.module.css';

export default function AdminDashboardPage() {
  return (
    <AdminShell
      title="Estatisticas gerais"
      description="Resumo executivo com indicadores e alertas do periodo."
    >
      <section className={styles.grid}>
        <div className={styles.panel}>
          <h3 className={styles.panelTitle}>Receita total</h3>
          <p className={styles.hint}>Resumo de quota, doacoes e loja.</p>
        </div>
        <div className={styles.panel}>
          <h3 className={styles.panelTitle}>Taxa de sucesso</h3>
          <p className={styles.hint}>Pagamentos aprovados vs falhados.</p>
        </div>
        <div className={styles.panel}>
          <h3 className={styles.panelTitle}>Alertas</h3>
          <p className={styles.hint}>Falhas de pagamento e pendencias.</p>
        </div>
      </section>

      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>Resumo diario</h3>
        <p className={styles.hint}>Grafico e distribuicao por canal.</p>
        <div className={styles.placeholder}>Area de grafico</div>
      </section>
    </AdminShell>
  );
}

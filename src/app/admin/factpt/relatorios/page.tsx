"use client";

import AdminShell from '../../AdminShell';
import styles from '../../factpt.module.css';

const exports = [
  { id: 'SAFT-2024-03', period: 'Mar 2024', date: 'Hoje', status: 'Gerado' },
  { id: 'SAFT-2024-02', period: 'Fev 2024', date: '05 Mar', status: 'Gerado' },
];

export default function FactPtRelatoriosPage() {
  return (
    <AdminShell
      title="Relatorios & SAF-T"
      description="Exportacoes fiscais e ficheiros SAF-T."
      toolbar={
        <div className={styles.actions}>
          <label className={styles.field}>
            Periodo
            <select className={styles.select} defaultValue="mes">
              <option value="mes">Este mes</option>
              <option value="trimestre">Ultimo trimestre</option>
              <option value="ano">Ano atual</option>
            </select>
          </label>
          <button className={styles.buttonPrimary} type="button">
            Gerar SAF-T
          </button>
        </div>
      }
    >
      <section className={styles.panel}>
        <div className={styles.table}>
          <div className={styles.tableHead}>
            <span>ID</span>
            <span>Periodo</span>
            <span>Data</span>
            <span>Estado</span>
            <span>Acao</span>
          </div>
          {exports.map((item) => (
            <div className={styles.tableRow} key={item.id}>
              <div data-label="ID">
                <strong>{item.id}</strong>
              </div>
              <div data-label="Periodo">{item.period}</div>
              <div data-label="Data">{item.date}</div>
              <div data-label="Estado">
                <span className={`${styles.badge} ${styles.badgeSuccess}`}>{item.status}</span>
              </div>
              <div data-label="Acao" className={styles.rowActions}>
                <button className={styles.buttonTiny} type="button">
                  Download
                </button>
                <button className={styles.buttonTiny} type="button">
                  Ver detalhe
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}

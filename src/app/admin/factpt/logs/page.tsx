"use client";

import AdminShell from '../../AdminShell';
import styles from '../../factpt.module.css';

const logs = [
  { id: 'log-001', date: 'Hoje, 10:32', action: 'Emitir documento', status: '200', detail: 'FT-2024-00123' },
  { id: 'log-002', date: 'Ontem, 17:45', action: 'Emitir documento', status: '502', detail: 'Timeout fact.pt' },
  { id: 'log-003', date: '18 Mar, 09:20', action: 'Testar ligacao', status: '200', detail: 'OK' },
];

export default function FactPtLogsPage() {
  return (
    <AdminShell title="Logs fact.pt" description="Auditoria das chamadas e respostas da API.">
      <section className={styles.panel}>
        <div className={styles.table}>
          <div className={styles.tableHead}>
            <span>Data</span>
            <span>Acao</span>
            <span>Status</span>
            <span>Detalhe</span>
            <span>ID</span>
          </div>
          {logs.map((log) => (
            <div className={styles.tableRow} key={log.id}>
              <div data-label="Data">{log.date}</div>
              <div data-label="Acao">{log.action}</div>
              <div data-label="Status">
                <span className={`${styles.badge} ${log.status === '200' ? styles.badgeSuccess : styles.badgeWarning}`}>
                  {log.status}
                </span>
              </div>
              <div data-label="Detalhe">{log.detail}</div>
              <div data-label="ID">{log.id}</div>
            </div>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}

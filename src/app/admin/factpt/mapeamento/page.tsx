"use client";

import AdminShell from '../../AdminShell';
import styles from '../../factpt.module.css';

const mapRows = [
  { id: 'SKU-001', name: 'Livro Garabandal', type: 'Produto', iva: '6%', status: 'Completo' },
  { id: 'DON-001', name: 'Doacao livre', type: 'Servico', iva: 'Isento', status: 'Pendente' },
  { id: 'MEM-001', name: 'Quota anual', type: 'Servico', iva: 'Isento', status: 'Completo' },
];

export default function FactPtMapeamentoPage() {
  return (
    <AdminShell
      title="Mapeamento fiscal"
      description="Associe produtos e servicos aos codigos fiscais."
      toolbar={
        <div className={styles.actions}>
          <button className={styles.buttonGhost} type="button">
            Importar produtos
          </button>
          <button className={styles.buttonPrimary} type="button">
            Guardar mapeamento
          </button>
        </div>
      }
    >
      <section className={styles.panel}>
        <div className={styles.table}>
          <div className={styles.tableHead}>
            <span>ID</span>
            <span>Descricao</span>
            <span>Tipo</span>
            <span>IVA</span>
            <span>Estado</span>
          </div>
          {mapRows.map((row) => (
            <div className={styles.tableRow} key={row.id}>
              <div data-label="ID">
                <strong>{row.id}</strong>
              </div>
              <div data-label="Descricao">{row.name}</div>
              <div data-label="Tipo">{row.type}</div>
              <div data-label="IVA">
                <select className={styles.select} defaultValue={row.iva === 'Isento' ? '0' : row.iva.replace('%', '')}>
                  <option value="23">23%</option>
                  <option value="13">13%</option>
                  <option value="6">6%</option>
                  <option value="0">Isento</option>
                </select>
              </div>
              <div data-label="Estado">
                <span className={`${styles.badge} ${row.status === 'Completo' ? styles.badgeSuccess : styles.badgeWarning}`}>
                  {row.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}

"use client";

import AdminShell from '../../AdminShell';
import styles from '../../factpt.module.css';

export default function FactPtConfiguracaoPage() {
  return (
    <AdminShell
      title="Configuracao fact.pt"
      description="Credenciais, series e regras fiscais para emissao automatica."
    >
      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>Credenciais & ambiente</h3>
        <div className={styles.form}>
          <label className={styles.field}>
            Chave API
            <input className={styles.input} type="password" placeholder="••••••••••••" />
          </label>
          <label className={styles.field}>
            Ambiente
            <select className={styles.select} defaultValue="sandbox">
              <option value="sandbox">Sandbox</option>
              <option value="prod">Producao</option>
            </select>
          </label>
          <div className={styles.actions}>
            <button className={styles.buttonGhost} type="button">
              Testar ligacao
            </button>
            <button className={styles.buttonPrimary} type="button">
              Guardar
            </button>
          </div>
        </div>
      </section>

      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>Dados fiscais</h3>
        <div className={styles.form}>
          <label className={styles.field}>
            NIF
            <input className={styles.input} type="text" placeholder="000000000" />
          </label>
          <label className={styles.field}>
            Nome fiscal
            <input className={styles.input} type="text" placeholder="Apostolado de Garabandal" />
          </label>
          <label className={styles.field}>
            Morada
            <input className={styles.input} type="text" placeholder="Rua, numero, localidade" />
          </label>
          <label className={styles.field}>
            CAE
            <input className={styles.input} type="text" placeholder="00000" />
          </label>
        </div>
      </section>

      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>Series e documentos</h3>
        <div className={styles.form}>
          <label className={styles.field}>
            Serie Loja (Vendas)
            <input className={styles.input} type="text" placeholder="FT-2024" />
          </label>
          <label className={styles.field}>
            Serie Doacoes
            <input className={styles.input} type="text" placeholder="RD-2024" />
          </label>
          <label className={styles.field}>
            Serie Quotas
            <input className={styles.input} type="text" placeholder="RQ-2024" />
          </label>
          <label className={styles.field}>
            IVA default
            <select className={styles.select} defaultValue="23">
              <option value="23">23%</option>
              <option value="13">13%</option>
              <option value="6">6%</option>
              <option value="0">Isento</option>
            </select>
          </label>
        </div>
        <hr className={styles.divider} />
        <div className={styles.actions}>
          <button className={styles.buttonPrimary} type="button">
            Guardar configuracao
          </button>
        </div>
      </section>
    </AdminShell>
  );
}

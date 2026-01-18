import React from 'react';
import styles from './auth.module.css';

type AuthShellProps = {
  title: string;
  subtitle: string;
  features: string[];
  children: React.ReactNode;
};

export default function AuthShell({ title, subtitle, features, children }: AuthShellProps) {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <aside className={styles.aside}>
          <h1>{title}</h1>
          <p>{subtitle}</p>
          <div className={styles.features}>
            {features.map((item) => (
              <div className={styles.feature} key={item}>
                <span className={styles.featureDot} />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </aside>
        <div>{children}</div>
      </div>
    </main>
  );
}

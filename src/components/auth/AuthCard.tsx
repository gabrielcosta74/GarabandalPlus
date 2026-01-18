import React from 'react';
import styles from './auth.module.css';

type AuthCardProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

export default function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

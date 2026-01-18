import React from 'react';
import styles from './auth.module.css';

type AuthErrorBannerProps = {
  message?: string | null;
};

export default function AuthErrorBanner({ message }: AuthErrorBannerProps) {
  if (!message) return null;
  return <div className={styles.error}>{message}</div>;
}

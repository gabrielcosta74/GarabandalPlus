import React from 'react';
import styles from './auth.module.css';

type AuthInputProps = {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  helper?: string;
  value?: string;
  onChange?: (value: string) => void;
};

export default function AuthInput({
  label,
  name,
  type = 'text',
  placeholder,
  autoComplete,
  helper,
  value,
  onChange,
}: AuthInputProps) {
  return (
    <div className={styles.field}>
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
      />
      {helper ? <span className={styles.helper}>{helper}</span> : null}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '../../lib/supabase-browser';

type Status = 'idle' | 'working' | 'success' | 'error';

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string>('A validar o link...');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showReset, setShowReset] = useState(false);
  const canReset = useMemo(() => {
    const pwd = newPassword.trim();
    const confirm = confirmPassword.trim();
    return pwd.length >= 6 && pwd === confirm;
  }, [newPassword, confirmPassword]);

  useEffect(() => {
    const run = async () => {
      if (!supabaseBrowser) {
        setStatus('error');
        setMessage('Configuração Supabase em falta.');
        return;
      }
      setStatus('working');
      try {
        const hash = window.location.hash.replace(/^#/, '');
        const params = new URLSearchParams(hash);
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        const type = params.get('type'); // e.g. recovery, signup, email_change

        if (!access_token || !refresh_token) {
          setStatus('error');
          setMessage('Link inválido ou expirado.');
          return;
        }

        const { data, error } = await supabaseBrowser.auth.setSession({
          access_token,
          refresh_token,
        });
        if (error || !data.session) {
          setStatus('error');
          setMessage(error?.message || 'Não foi possível validar a sessão.');
          return;
        }

        if (type === 'recovery') {
          setShowReset(true);
          setStatus('idle');
          setMessage('Sessão restaurada. Define uma nova password abaixo.');
        } else {
          setStatus('success');
          setMessage('Conta confirmada. Podes fechar esta página ou voltar à app.');
        }
      } catch (err: any) {
        console.error('Erro no callback:', err);
        setStatus('error');
        setMessage(err?.message || 'Erro ao processar o link.');
      }
    };
    run();
  }, []);

  const handleResetPassword = async () => {
    if (!supabaseBrowser) return;
    if (!canReset) {
      setMessage('As passwords devem coincidir e ter pelo menos 6 caracteres.');
      return;
    }
    setStatus('working');
    setMessage('A atualizar password...');
    try {
      const { error } = await supabaseBrowser.auth.updateUser({ password: newPassword.trim() });
      if (error) {
        setStatus('error');
        setMessage(error.message);
        return;
      }
      setStatus('success');
      setMessage('Password atualizada. Podes fechar esta página ou voltar à app.');
      setShowReset(false);
    } catch (err: any) {
      setStatus('error');
      setMessage(err?.message || 'Erro ao atualizar password.');
    }
  };

  return (
    <div style={{ maxWidth: 540, margin: '0 auto', padding: '32px 16px', minHeight: '100vh' }}>
      <h1 style={{ margin: 0, fontSize: 26 }}>Recuperação/Confirmação</h1>
      <p style={{ color: '#4a5a70' }}>{message}</p>

      {showReset && (
        <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
          <label style={{ color: '#4a5a70' }}>
            Nova password (mín. 6)
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{
                marginTop: 6,
                padding: '10px 12px',
                width: '100%',
                borderRadius: 10,
                border: '1px solid #d7e1f0',
                fontSize: 16,
              }}
            />
          </label>
          <label style={{ color: '#4a5a70' }}>
            Confirmar nova password
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{
                marginTop: 6,
                padding: '10px 12px',
                width: '100%',
                borderRadius: 10,
                border: '1px solid #d7e1f0',
                fontSize: 16,
              }}
            />
          </label>
          <button
            onClick={handleResetPassword}
            disabled={!canReset || status === 'working' || status === 'success'}
            style={{
              background: '#1E63F0',
              color: '#fff',
              border: 'none',
              padding: '12px 16px',
              borderRadius: 10,
              fontWeight: 700,
              cursor: status === 'working' ? 'wait' : 'pointer',
              opacity: !canReset || status === 'success' ? 0.6 : 1,
            }}
          >
            {status === 'success' ? 'Password atualizada' : 'Atualizar password'}
          </button>
        </div>
      )}

      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Link href="garabandalapp://auth-callback" style={{ color: '#1E63F0', fontWeight: 700 }}>
          Abrir na app
        </Link>
        <Link href="/" style={{ color: '#4a5a70' }}>
          Voltar à página inicial
        </Link>
      </div>
    </div>
  );
}

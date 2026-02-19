"use client";

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '../../../lib/supabase-browser';

type ClaimInfo = {
  orderRef: string;
  buyerEmail: string;
  buyerName?: string | null;
  buyerNif?: string | null;
  totalAmount?: number | null;
  currency?: string | null;
  hasPhysical: boolean;
  hasDigital: boolean;
  emailExists: boolean;
  expiresAt?: string | null;
  isClaimed: boolean;
};

const formatCurrency = (value: number, currency = 'EUR') =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(value);

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('pt-PT');
};

function ClaimContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') || '';
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<ClaimInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const loadClaim = async () => {
      if (!token) {
        setError('Token ausente.');
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/store/claim?token=${encodeURIComponent(token)}`);
        const payload = await res.json();
        if (!res.ok) {
          setError(payload?.message || 'Nao foi possivel validar o link.');
          return;
        }
        setInfo(payload);
      } catch (err) {
        setError('Nao foi possivel validar o link.');
      } finally {
        setLoading(false);
      }
    };
    loadClaim();
  }, [token]);

  const mode = useMemo(() => {
    if (!info) return 'loading';
    return info.emailExists ? 'login' : 'register';
  }, [info]);

  const handleClaim = async (accessToken: string) => {
    const res = await fetch('/api/store/claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error(payload?.message || 'Nao foi possivel associar a compra.');
    }
  };

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!supabaseBrowser || !info) {
      setError('Supabase nao configurado.');
      return;
    }
    if (!password.trim()) {
      setError('Indica a password.');
      return;
    }
    setSubmitting(true);
    try {
      const { data, error: loginError } = await supabaseBrowser.auth.signInWithPassword({
        email: info.buyerEmail,
        password: password.trim(),
      });
      if (loginError || !data.session) {
        setError(loginError?.message || 'Nao foi possivel entrar.');
        return;
      }
      await handleClaim(data.session.access_token);
      setSuccess('Compra associada com sucesso.');
      router.push(info.hasDigital ? '/biblioteca' : '/encomendas');
    } catch (err: any) {
      setError(err?.message || 'Nao foi possivel associar a compra.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!supabaseBrowser || !info) {
      setError('Supabase nao configurado.');
      return;
    }
    if (password.trim().length < 6) {
      setError('A password deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password.trim() !== confirmPassword.trim()) {
      setError('As passwords nao coincidem.');
      return;
    }
    setSubmitting(true);
    try {
      const registerRes = await fetch('/api/store/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'register',
          token,
          password: password.trim(),
        }),
      });
      const registerPayload = await registerRes.json().catch(() => ({}));
      if (!registerRes.ok) {
        setError(registerPayload?.message || 'Nao foi possivel criar a conta.');
        return;
      }

      const { data, error: loginError } = await supabaseBrowser.auth.signInWithPassword({
        email: info.buyerEmail,
        password: password.trim(),
      });
      if (loginError || !data.session) {
        setError(loginError?.message || 'Conta criada, mas não foi possível iniciar sessão automaticamente.');
        return;
      }

      await handleClaim(data.session.access_token);
      setSuccess('Conta criada e compra associada com sucesso.');
      router.push(info.hasDigital ? '/biblioteca' : '/encomendas');
    } catch (err: any) {
      setError(err?.message || 'Nao foi possivel criar a conta.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="claim">
      <div className="claim__card">
        <h1>Associar compra à conta</h1>
        <p className="muted">
          Este link serve para ligar esta encomenda à sua conta e desbloquear a biblioteca digital e o histórico de encomendas.
        </p>

        {loading && <p className="muted">A validar link...</p>}
        {error && <p className="error">{error}</p>}

        {info && !loading ? (
          <div className="summary">
            <div>
              <strong>Pedido</strong>
              <span>{info.orderRef}</span>
            </div>
            <div>
              <strong>Email</strong>
              <span>{info.buyerEmail}</span>
            </div>
            {typeof info.totalAmount === 'number' ? (
              <div>
                <strong>Total</strong>
                <span>{formatCurrency(info.totalAmount, info.currency || 'EUR')}</span>
              </div>
            ) : null}
            <div>
              <strong>Conteúdos</strong>
              <span>{info.hasDigital ? 'Digitais + físicos' : info.hasPhysical ? 'Físicos' : 'Digitais'}</span>
            </div>
            {info.expiresAt ? (
              <div>
                <strong>Expira em</strong>
                <span>{formatDate(info.expiresAt)}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        {success && <p className="success">{success}</p>}

        {info && mode === 'login' ? (
          <form onSubmit={handleLogin} className="form">
            <p className="form__note">
              Já existe uma conta com este email. Inicie sessão para associar esta compra automaticamente.
            </p>
            <label>
              Email
              <input type="email" value={info.buyerEmail} readOnly />
            </label>
            <label>
              Password
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <button type="submit" disabled={submitting}>
              {submitting ? 'A entrar...' : 'Entrar e associar'}
            </button>
          </form>
        ) : null}

        {info && mode === 'register' ? (
          <form onSubmit={handleRegister} className="form">
            <p className="form__note">
              Ainda não existe conta com este email. Crie uma password para criar a conta agora e associar a compra de imediato.
            </p>
            <label>
              Email
              <input type="email" value={info.buyerEmail} readOnly />
            </label>
            <label>
              Criar password
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <label>
              Confirmar password
              <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            </label>
            <button type="submit" disabled={submitting}>
              {submitting ? 'A criar...' : 'Criar conta e associar'}
            </button>
          </form>
        ) : null}
      </div>

      <style jsx>{`
        .claim {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          background: linear-gradient(180deg, #f5f8ff 0%, #ffffff 100%);
          color: #0f172a;
        }

        .claim__card {
          width: min(520px, 100%);
          background: #ffffff;
          border-radius: 20px;
          padding: 28px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 20px 40px rgba(15, 23, 42, 0.08);
        }

        h1 {
          margin: 0 0 6px;
          font-size: 22px;
        }

        .muted {
          color: #64748b;
          font-size: 13px;
          margin-bottom: 16px;
        }

        .summary {
          display: grid;
          gap: 10px;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 14px;
          background: #f8fafc;
          margin-bottom: 16px;
        }

        .summary div {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
        }

        .summary strong {
          color: #334155;
        }

        .form {
          display: grid;
          gap: 12px;
        }

        .form__note {
          margin: 0;
          font-size: 13px;
          color: #475569;
        }

        label {
          display: grid;
          gap: 6px;
          font-size: 13px;
          color: #334155;
        }

        input {
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          font-size: 14px;
        }

        button {
          margin-top: 6px;
          background: #1d4ed8;
          color: #ffffff;
          border: none;
          border-radius: 12px;
          padding: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .error {
          color: #dc2626;
          font-size: 13px;
          margin: 8px 0;
        }

        .success {
          color: #15803d;
          font-size: 13px;
          margin: 8px 0;
        }
      `}</style>
    </main>
  );
}

export default function ClaimPage() {
  return (
    <Suspense
      fallback={
        <main className="claim">
          <div className="claim__card">
            <h1>Aceder a sua compra</h1>
            <p className="muted">A preparar o seu pedido...</p>
          </div>
        </main>
      }
    >
      <ClaimContent />
    </Suspense>
  );
}

type Props = {
  status: 'success' | 'invalid' | 'error';
  locale: 'pt' | 'en';
};

const COPY = {
  pt: {
    success_title: 'Subscrição cancelada',
    success_body: 'Deixará de receber os nossos emails de divulgação. Pode voltar a juntar-se quando quiser. Que Nossa Senhora de Garabandal o acompanhe.',
    invalid_title: 'Ligação inválida',
    invalid_body: 'Esta ligação de cancelamento não é válida ou expirou. Se continuar a receber emails que não deseja, responda a um deles e tratamos disso.',
    error_title: 'Algo correu mal',
    error_body: 'Não foi possível concluir o cancelamento. Tente novamente mais tarde ou responda a um dos nossos emails.',
    home: 'Voltar ao site',
  },
  en: {
    success_title: 'Subscription cancelled',
    success_body: 'You will no longer receive our outreach emails. You are welcome to rejoin at any time. May Our Lady of Garabandal accompany you.',
    invalid_title: 'Invalid link',
    invalid_body: 'This unsubscribe link is not valid or has expired. If you keep receiving emails you do not want, simply reply to one and we will take care of it.',
    error_title: 'Something went wrong',
    error_body: 'We could not complete the unsubscribe. Please try again later or reply to one of our emails.',
    home: 'Back to site',
  },
};

export default function UnsubscribeResult({ status, locale }: Props) {
  const c = COPY[locale];
  const title = c[`${status}_title` as const];
  const body = c[`${status}_body` as const];
  const homeHref = locale === 'en' ? '/en' : '/';

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '24px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 520, width: '100%', background: '#fff', borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', padding: '40px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 12px' }}>{title}</h1>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: '#475569', margin: '0 0 24px' }}>{body}</p>
        <a href={homeHref} style={{ display: 'inline-block', background: '#0f172a', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 14, padding: '12px 24px', borderRadius: 12 }}>{c.home}</a>
      </div>
    </main>
  );
}

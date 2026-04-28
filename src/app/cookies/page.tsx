import { Metadata } from 'next';
import Link from 'next/link';
import { APP_URL } from '../../lib/config';
import CookiePreferencesButton from '../../components/privacy/CookiePreferencesButton';

export const metadata: Metadata = {
  title: 'Política de Cookies',
  description:
    'Política de Cookies do Apostolado de Garabandal sobre utilização de cookies e tecnologias semelhantes.',
  alternates: {
    canonical: `${APP_URL}/cookies`,
  },
  openGraph: {
    url: `${APP_URL}/cookies`,
    title: 'Política de Cookies | Apostolado de Garabandal',
    description:
      'Saiba que cookies utilizamos, para que servem e como gerir preferências.',
  },
};

export default function CookiesPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-6 py-16 space-y-10">
        <header className="space-y-4">
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-slate-900">
            Política de Cookies
          </h1>
          <p className="text-sm text-slate-500">
            Última atualização: 28 de abril de 2026
          </p>
          <p className="text-slate-600 leading-relaxed">
            Esta política explica o uso de cookies, armazenamento local e tecnologias semelhantes no
            website e web app do Apostolado de Garabandal.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">1. O que são cookies</h2>
          <p className="text-slate-600 leading-relaxed">
            Cookies são pequenos ficheiros guardados no dispositivo para permitir funcionamento
            técnico, segurança, personalização e, quando consentido, medição/marketing.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">2. Tipos de cookies que podemos utilizar</h2>
          <ul className="list-disc pl-6 text-slate-600 leading-relaxed space-y-2">
            <li><strong>Estritamente necessários:</strong> autenticação, sessão, carrinho, segurança, prevenção de abuso, checkout, doações, quotas e inscrições. Estes não podem ser desativados no nosso painel porque são necessários para prestar o serviço pedido.</li>
            <li><strong>Preferências locais:</strong> idioma, moeda, estado do carrinho e a sua escolha de consentimento, quando aplicável.</li>
            <li><strong>Analíticos:</strong> medição de utilização de páginas públicas e melhoria do website. Estes só são ativados se aceitar cookies analíticos.</li>
            <li><strong>Marketing:</strong> campanhas, medição de conversões ou comunicações personalizadas. Estes só são ativados se aceitar cookies de marketing.</li>
            <li><strong>Terceiros essenciais:</strong> serviços de autenticação, alojamento, pagamentos, antifraude e email podem definir identificadores técnicos próprios necessários à execução desses serviços.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">3. Finalidades</h2>
          <ul className="list-disc pl-6 text-slate-600 leading-relaxed space-y-2">
            <li>Manter sessões autenticadas e proteger contas de utilizador.</li>
            <li>Permitir fluxos de checkout, doações, quotas e inscrições.</li>
            <li>Garantir integridade técnica, deteção de erros e estabilidade da plataforma.</li>
            <li>Medir desempenho e utilização de páginas públicas, quando houver consentimento.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">4. Gestão de preferências</h2>
          <p className="text-slate-600 leading-relaxed">
            Pode aceitar todos, rejeitar cookies opcionais ou escolher categorias no banner de
            consentimento. Pode alterar a sua escolha a qualquer momento através do botão abaixo.
            Também pode gerir cookies no navegador (bloquear, apagar ou limitar). A desativação de
            cookies necessários pode impedir autenticação, checkout e outras funcionalidades essenciais.
          </p>
          <CookiePreferencesButton />
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">5. Cookies de terceiros</h2>
          <p className="text-slate-600 leading-relaxed">
            Alguns fluxos dependem de serviços terceiros (ex.: Supabase para autenticação/base de
            dados, Stripe/Reduniq para pagamentos, PostHog para analytics quando consentido, e
            fornecedores de email/infraestrutura). Estes serviços podem definir identificadores
            técnicos próprios nos termos das suas políticas.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">6. Base legal</h2>
          <p className="text-slate-600 leading-relaxed">
            Cookies estritamente necessários são utilizados para execução do serviço solicitado e
            segurança da plataforma. Cookies analíticos e de marketing são utilizados com base no seu
            consentimento, que pode retirar a qualquer momento.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">7. Contacto</h2>
          <p className="text-slate-600 leading-relaxed">
            Para questões sobre cookies e privacidade, contacte{' '}
            <strong>geral@apostoladodegarabandal.com</strong> ou consulte a{' '}
            <Link href="/privacidade" className="underline hover:text-slate-900">
              Política de Privacidade
            </Link>
            .
          </p>
        </section>

        <div className="border-t border-slate-200 pt-6 text-sm text-slate-500">
          <p>
            Referências legais principais: Diretiva ePrivacy (2002/58/CE), Lei n.º 41/2004 e RGPD.
          </p>
        </div>
      </div>
    </main>
  );
}

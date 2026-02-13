import { Metadata } from 'next';
import Link from 'next/link';
import { APP_URL } from '../../lib/config';

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
            Última atualização: 13 de fevereiro de 2026
          </p>
          <p className="text-slate-600 leading-relaxed">
            Esta política explica o uso de cookies e tecnologias semelhantes no website e web app do
            Apostolado de Garabandal.
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
            <li><strong>Estritamente necessários:</strong> autenticação, sessão, segurança e prevenção de abuso.</li>
            <li><strong>Funcionais:</strong> preferências de interface e melhoria da experiência.</li>
            <li><strong>Analíticos:</strong> medição agregada de utilização, apenas quando legalmente exigível com consentimento.</li>
            <li><strong>Terceiros:</strong> serviços de pagamento, proteção e infraestrutura.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">3. Finalidades</h2>
          <ul className="list-disc pl-6 text-slate-600 leading-relaxed space-y-2">
            <li>Manter sessões autenticadas e proteger contas de utilizador.</li>
            <li>Permitir fluxos de checkout, doações, quotas e inscrições.</li>
            <li>Garantir integridade técnica, deteção de erros e estabilidade da plataforma.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">4. Gestão de preferências</h2>
          <p className="text-slate-600 leading-relaxed">
            Pode gerir cookies no navegador (bloquear, apagar ou limitar). A desativação de cookies
            necessários pode impedir autenticação, checkout e outras funcionalidades essenciais.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">5. Cookies de terceiros</h2>
          <p className="text-slate-600 leading-relaxed">
            Alguns fluxos dependem de serviços terceiros (ex.: pagamentos e autenticação). Estes
            serviços podem definir identificadores técnicos próprios nos termos das suas políticas.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">6. Contacto</h2>
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


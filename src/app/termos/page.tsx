import { Metadata } from 'next';
import Link from 'next/link';
import { APP_URL } from '../../lib/config';

export const metadata: Metadata = {
  title: 'Termos e Condições',
  description:
    'Termos e Condições de utilização do website e web app do Apostolado de Garabandal.',
  alternates: {
    canonical: `${APP_URL}/termos`,
    languages: {
      'pt-BR': `${APP_URL}/termos`,
      'pt-PT': `${APP_URL}/termos`,
      en: `${APP_URL}/en/terms`,
    },
  },
  openGraph: {
    url: `${APP_URL}/termos`,
    title: 'Termos e Condições | Apostolado de Garabandal',
    description:
      'Consulte as regras de utilização da plataforma, pagamentos, inscrições e loja online.',
  },
};

export default function TermosPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-6 py-16 space-y-10">
        <header className="space-y-4">
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-slate-900">
            Termos e Condições
          </h1>
          <p className="text-sm text-slate-500">
            Última atualização: 3 de setembro de 2026
          </p>
          <p className="text-slate-600 leading-relaxed">
            Ao utilizar o website, a web app ou a aplicação móvel para membros do Apostolado de
            Garabandal, o utilizador declara que leu, compreendeu e aceita estes Termos.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">1. Objeto e âmbito</h2>
          <p className="text-slate-600 leading-relaxed">
            Estes Termos regulam o acesso e utilização do website, web app, aplicação móvel, área de
            membro, inscrição em peregrinações, doações, pagamentos de quotas e loja online.
          </p>
          <p className="text-slate-600 leading-relaxed">
            A plataforma é operada pela Associação do Apostolado de Garabandal, NIPC 517582023,
            com sede no Largo da Igreja, n.º 36, 4535-275 Paços de Brandão, Portugal.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">2. Conta de utilizador</h2>
          <ul className="list-disc pl-6 text-slate-600 leading-relaxed space-y-2">
            <li>O utilizador é responsável pela veracidade dos dados fornecidos e pela segurança da conta.</li>
            <li>Não é permitida utilização abusiva, fraudulenta ou que viole legislação aplicável.</li>
            <li>Podemos suspender acessos em caso de risco de segurança ou incumprimento destes Termos.</li>
            <li>A aplicação móvel permite solicitar a eliminação da conta no Perfil, sem prejuízo da conservação de registos exigida por lei.</li>
          </ul>
        </section>

        <section id="conteudo-utilizadores" className="space-y-3 scroll-mt-24">
          <h2 className="text-xl font-semibold text-slate-900">
            3. Conteúdo publicado por utilizadores
          </h2>
          <p className="text-slate-600 leading-relaxed">
            A aplicação móvel inclui um mural de intenções onde os membros podem partilhar pedidos
            de oração. Ao publicar, o utilizador declara que o conteúdo é da sua autoria e aceita as
            regras seguintes.
          </p>
          <ul className="list-disc pl-6 text-slate-600 leading-relaxed space-y-2">
            <li>
              <strong>Não existe tolerância para conteúdo ofensivo ou para comportamentos
              abusivos.</strong> É proibido publicar conteúdo difamatório, obsceno, violento,
              discriminatório, de ódio, assediante, enganoso, publicitário ou ilegal, bem como dados
              pessoais de terceiros.
            </li>
            <li>
              Qualquer membro pode denunciar uma intenção e bloquear o respetivo autor a partir da
              própria aplicação. O bloqueio é imediato e pode ser gerido no Perfil.
            </li>
            <li>
              As denúncias são analisadas no prazo máximo de 24 horas. Conteúdo que viole estas
              regras é removido e as contas responsáveis podem ser suspensas ou eliminadas, sem
              aviso prévio e sem direito a reembolso de quotas.
            </li>
            <li>
              Uma intenção denunciada por vários membros é ocultada automaticamente enquanto aguarda
              análise.
            </li>
            <li>
              O Apostolado de Garabandal não subscreve nem verifica previamente o conteúdo
              publicado pelos utilizadores, mas reserva-se o direito de o remover a qualquer momento.
            </li>
          </ul>
        </section>

        <section id="peregrinacoes" className="space-y-3 scroll-mt-24">
          <h2 className="text-xl font-semibold text-slate-900">4. Peregrinações e inscrições</h2>
          <ul className="list-disc pl-6 text-slate-600 leading-relaxed space-y-2">
            <li>As inscrições estão sujeitas a disponibilidade, validação de dados e confirmação de pagamento.</li>
            <li>Condições específicas (valores, prestações, política de cancelamento) são apresentadas em cada peregrinação.</li>
            <li>Em caso de divergência, prevalecem as condições específicas da peregrinação publicada.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">5. Quotas, doações e pagamentos</h2>
          <ul className="list-disc pl-6 text-slate-600 leading-relaxed space-y-2">
            <li>Os pagamentos podem ser processados por prestadores externos (ex.: Stripe, Reduniq), de acordo com os seus termos próprios.</li>
            <li>Doações e quotas são registadas para controlo administrativo, contabilístico e fiscal.</li>
            <li>Quando aplicável, o estado do pagamento depende da confirmação do operador de pagamento.</li>
            <li>A quota é uma obrigação estatutária de membro da associação e não uma compra de conteúdo digital da aplicação.</li>
            <li>A aplicação móvel não processa pagamentos nem recolhe dados de cartão.</li>
            <li>Os donativos são voluntários, não desbloqueiam funcionalidades ou conteúdo digital e, quando iniciados na aplicação, são concluídos fora da aplicação no navegador do dispositivo.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">6. Loja online</h2>
          <ul className="list-disc pl-6 text-slate-600 leading-relaxed space-y-2">
            <li>Os preços e disponibilidade podem ser atualizados sem prejuízo dos pedidos já confirmados.</li>
            <li>Para contratos celebrados à distância, aplicam-se os direitos legais do consumidor em Portugal.</li>
            <li>Custos de envio, prazos e condições são apresentados no checkout antes da confirmação.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">7. Propriedade intelectual</h2>
          <p className="text-slate-600 leading-relaxed">
            Conteúdos, marcas, elementos gráficos, textos, vídeos e demais materiais da plataforma
            estão protegidos por direitos de propriedade intelectual, salvo indicação em contrário.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">8. Limitação de responsabilidade</h2>
          <p className="text-slate-600 leading-relaxed">
            Envidamos esforços para garantir disponibilidade e exatidão da informação, mas não
            asseguramos funcionamento ininterrupto ou ausência total de erro. A responsabilidade é
            limitada nos termos legais aplicáveis.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">9. Proteção de dados</h2>
          <p className="text-slate-600 leading-relaxed">
            O tratamento de dados pessoais é regido pela nossa{' '}
            <Link href="/privacidade" className="underline hover:text-slate-900">
              Política de Privacidade
            </Link>{' '}
            e pela{' '}
            <Link href="/cookies" className="underline hover:text-slate-900">
              Política de Cookies
            </Link>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">10. Alterações aos Termos</h2>
          <p className="text-slate-600 leading-relaxed">
            Estes Termos podem ser revistos a qualquer momento. A versão em vigor é a publicada
            nesta página.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">11. Lei aplicável e foro</h2>
          <p className="text-slate-600 leading-relaxed">
            Estes Termos regem-se pela lei portuguesa. Em caso de litígio, aplica-se o regime legal
            de resolução de litígios de consumo e os tribunais competentes em Portugal, sem prejuízo
            de normas imperativas de proteção do consumidor.
          </p>
        </section>

        <div className="border-t border-slate-200 pt-6 text-sm text-slate-500">
          <p>
            Referências legais principais: Decreto-Lei n.º 7/2004 (comércio eletrónico), Decreto-Lei
            n.º 24/2014 (contratos celebrados à distância), RGPD e Lei n.º 58/2019.
          </p>
        </div>
      </div>
    </main>
  );
}

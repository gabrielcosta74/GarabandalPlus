import { Metadata } from 'next';
import Link from 'next/link';
import { APP_URL } from '../../lib/config';

export const metadata: Metadata = {
  title: 'Política de Privacidade',
  description:
    'Política de Privacidade do Apostolado de Garabandal para utilização da plataforma, peregrinações, doações e loja online.',
  alternates: {
    canonical: `${APP_URL}/privacidade`,
    languages: {
      'pt-BR': `${APP_URL}/privacidade`,
      'pt-PT': `${APP_URL}/privacidade`,
      en: `${APP_URL}/en/privacy`,
    },
  },
  openGraph: {
    url: `${APP_URL}/privacidade`,
    title: 'Política de Privacidade | Apostolado de Garabandal',
    description:
      'Consulte como tratamos dados pessoais, direitos dos titulares e medidas de segurança.',
  },
};

export default function PrivacidadePage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-6 py-16 space-y-10">
        <header className="space-y-4">
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-slate-900">
            Política de Privacidade
          </h1>
          <p className="text-sm text-slate-500">
            Última atualização: 23 de julho de 2026
          </p>
          <p className="text-slate-600 leading-relaxed">
            Esta Política descreve como o Apostolado de Garabandal trata dados pessoais no âmbito
            do website, web app e aplicação móvel para membros (incluindo áreas de membro,
            peregrinações, doações, inscrições, loja online e comunicações operacionais).
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">1. Responsável pelo tratamento</h2>
          <p className="text-slate-600 leading-relaxed">
            Responsável: <strong>Associação do Apostolado de Garabandal</strong>, associação sem
            fins lucrativos, NIPC <strong>517582023</strong>.
            <br />
            Sede: Largo da Igreja, n.º 36, 4535-275 Paços de Brandão, Portugal.
            <br />
            Contacto de privacidade: <strong>geral@apostoladodegarabandal.com</strong>.
            <br />
            Para exercício de direitos, utilize o mesmo email com o assunto “Proteção de Dados”.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">2. Dados que tratamos</h2>
          <ul className="list-disc pl-6 text-slate-600 leading-relaxed space-y-2">
            <li>Identificação e contacto: nome, email, telefone, país, morada e dados fiscais quando aplicável.</li>
            <li>Conta e autenticação: credenciais, identificadores técnicos de sessão e estado de autenticação.</li>
            <li>Utilização da área de membro: progresso de novenas, orações concluídas, favoritos e atividade necessária ao funcionamento da aplicação.</li>
            <li>Dados de inscrição e peregrinação: dados dos peregrinos, preferências logísticas, comprovativos e histórico.</li>
            <li>Dados de transação: montantes, método de pagamento, referências e estado de pagamento.</li>
            <li>Dados de loja online: encomendas, envio, faturação e histórico comercial.</li>
            <li>Comunicações e suporte: mensagens enviadas por formulários, email e canais de apoio.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">3. Finalidades e bases legais</h2>
          <ul className="list-disc pl-6 text-slate-600 leading-relaxed space-y-2">
            <li>Execução contratual: gestão de inscrições, quotas, doações e encomendas.</li>
            <li>Obrigações legais: faturação, arquivo contabilístico/fiscal, prevenção de fraude e cooperação com autoridades.</li>
            <li>Interesse legítimo: segurança da plataforma, auditoria, prevenção de abuso e melhoria operacional.</li>
            <li>Consentimento: comunicações promocionais não estritamente necessárias, quando aplicável.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">4. Partilha de dados</h2>
          <p className="text-slate-600 leading-relaxed">
            Os dados podem ser partilhados com subcontratantes estritamente necessários à operação da
            plataforma (ex.: autenticação, alojamento, processamento de pagamentos, envio de email e
            notificações), sempre ao abrigo de contratos com cláusulas de proteção de dados.
          </p>
          <p className="text-slate-600 leading-relaxed">
            Os principais prestadores incluem Supabase (autenticação e base de dados), Railway
            (alojamento e API), Resend (email transacional) e, apenas no website quando há uma
            transação, os operadores de pagamento apresentados no respetivo checkout. A aplicação
            móvel não integra publicidade, não vende dados e não recolhe dados de cartão.
          </p>
          <p className="text-slate-600 leading-relaxed">
            Não vendemos dados pessoais.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">5. Transferências internacionais</h2>
          <p className="text-slate-600 leading-relaxed">
            Quando houver tratamento fora do EEE, aplicamos mecanismos adequados previstos no RGPD
            (como cláusulas contratuais-tipo e medidas complementares).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">6. Conservação</h2>
          <ul className="list-disc pl-6 text-slate-600 leading-relaxed space-y-2">
            <li>Conta: enquanto estiver ativa; após eliminação, o acesso é revogado e o perfil é apagado ou anonimizado.</li>
            <li>Atividade e progresso de oração no servidor: eliminados com a conta, salvo cópias de segurança sujeitas ao seu ciclo técnico de rotação.</li>
            <li>Dados transacionais, contabilísticos e fiscais: durante 10 anos, ou prazo superior quando uma obrigação legal ou litígio aplicável o imponha.</li>
            <li>Dados baseados em consentimento: até retirada do consentimento ou termo da finalidade.</li>
            <li>Preferências e progresso guardados apenas no dispositivo: até serem removidos pelo utilizador, pela aplicação ou pela desinstalação, conforme o mecanismo utilizado.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">7. Direitos dos titulares</h2>
          <p className="text-slate-600 leading-relaxed">
            Pode exercer os direitos de acesso, retificação, apagamento, limitação, oposição,
            portabilidade e retirada de consentimento (quando aplicável), bem como apresentar
            reclamação à CNPD.
          </p>
          <p className="text-slate-600 leading-relaxed">
            A aplicação móvel disponibiliza uma opção de eliminação da conta no Perfil. A eliminação
            revoga o acesso, elimina o progresso e a atividade e anonimiza o perfil, sem prejuízo da
            conservação limitada de registos necessária para cumprir obrigações legais,
            contabilísticas ou fiscais, prevenir fraude ou resolver litígios. O pedido também pode
            ser iniciado na página pública de{' '}
            <Link href="/eliminar-conta" className="underline hover:text-slate-900">
              eliminação de conta e dados
            </Link>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">8. Aplicação móvel e rastreamento</h2>
          <p className="text-slate-600 leading-relaxed">
            A aplicação usa armazenamento seguro para manter a sessão e armazenamento local para
            preferências, favoritos e progresso temporário de oração. Não utiliza identificadores
            publicitários, não acompanha o utilizador entre apps ou websites e não solicita acesso a
            contactos, localização, fotografias, microfone ou câmara.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">9. Segurança</h2>
          <p className="text-slate-600 leading-relaxed">
            Aplicamos medidas técnicas e organizativas adequadas (controlo de acesso, segregação de
            permissões, registos de auditoria e proteção de infraestrutura), sem prejuízo de não
            existir segurança absoluta em meios digitais.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">10. Cookies</h2>
          <p className="text-slate-600 leading-relaxed">
            O detalhe sobre cookies e tecnologias semelhantes está disponível na{' '}
            <Link href="/cookies" className="underline hover:text-slate-900">
              Política de Cookies
            </Link>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">11. Alterações</h2>
          <p className="text-slate-600 leading-relaxed">
            Esta Política pode ser atualizada para refletir alterações legais, técnicas ou
            operacionais. A versão em vigor é sempre a publicada nesta página.
          </p>
        </section>

        <div className="border-t border-slate-200 pt-6 text-sm text-slate-500">
          <p>
            Referências legais principais: RGPD (Regulamento (UE) 2016/679), Lei n.º 58/2019 e Lei
            n.º 41/2004.
          </p>
        </div>
      </div>
    </main>
  );
}

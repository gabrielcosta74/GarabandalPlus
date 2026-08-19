import type { Metadata } from 'next';
import Link from 'next/link';
import { APP_URL } from '../../lib/config';

export const metadata: Metadata = {
  title: 'Eliminar conta e dados',
  description:
    'Informação e meios para eliminar uma conta Garabandal + e os dados associados.',
  alternates: {
    canonical: `${APP_URL}/eliminar-conta`,
  },
};

const deletionMail =
  'mailto:geral@apostoladodegarabandal.com?subject=Pedido%20de%20elimina%C3%A7%C3%A3o%20de%20conta%20e%20dados&body=Solicito%20a%20elimina%C3%A7%C3%A3o%20da%20minha%20conta%20Garabandal%20%2B.%0A%0AEmail%20da%20conta%3A%20';

export default function DeleteAccountPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl space-y-8 px-6 py-16">
        <header className="space-y-4">
          <h1 className="text-3xl font-bold text-slate-900 md:text-4xl">
            Eliminar conta e dados
          </h1>
          <p className="text-slate-600 leading-relaxed">
            Esta página aplica-se às contas utilizadas no website e na aplicação{' '}
            <strong>Garabandal +</strong>, disponibilizada pelo Apostolado de Garabandal.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">Na aplicação</h2>
          <p className="text-slate-600 leading-relaxed">
            Abra <strong>Perfil</strong>, escolha <strong>Eliminar conta</strong> e confirme. O
            processo revoga imediatamente o acesso e elimina a conta de autenticação, o progresso
            de oração, as preferências e a atividade da app. Os dados pessoais do perfil são
            eliminados ou anonimizados.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">Dados eliminados</h2>
          <p className="text-slate-600 leading-relaxed">
            São eliminados ou anonimizados os dados da conta e do perfil, as preferências, o
            progresso de oração e outros dados de utilização que não tenham de ser conservados por
            obrigação legal. O pedido feito por email é processado após a validação da titularidade
            da conta.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">Sem acesso à aplicação</h2>
          <p className="text-slate-600 leading-relaxed">
            Envie o pedido a partir do email associado à conta. Poderemos pedir uma confirmação
            limitada de identidade para impedir eliminações indevidas.
          </p>
          <a
            className="inline-flex rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-800"
            href={deletionMail}
          >
            Pedir eliminação por email
          </a>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">Dados conservados por lei</h2>
          <p className="text-slate-600 leading-relaxed">
            Registos contabilísticos, fiscais, de pagamento, prevenção de fraude ou litígio podem
            ser conservados de forma limitada durante o prazo legal aplicável, normalmente 10 anos
            para documentação contabilística e fiscal. Esses registos deixam de ser usados para
            disponibilizar a conta ou para marketing.
          </p>
        </section>

        <p className="border-t border-slate-200 pt-6 text-sm text-slate-500">
          Consulte também a nossa{' '}
          <Link className="underline hover:text-slate-900" href="/privacidade">
            Política de Privacidade
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

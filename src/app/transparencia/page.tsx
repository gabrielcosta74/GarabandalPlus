import { Metadata } from 'next';
import { APP_URL } from '../../lib/config';

export const metadata: Metadata = {
  title: 'Transparência e recibos',
  description: 'Saiba como usamos as doações e como funciona a emissão de recibos no Apostolado de Garabandal.',
  alternates: {
    canonical: `${APP_URL}/transparencia`,
  },
  openGraph: {
    url: `${APP_URL}/transparencia`,
    title: 'Transparência e recibos | Apostolado de Garabandal',
    description: 'Entenda como as doações são utilizadas e como funciona a emissão de recibos.',
  },
};

export default function TransparenciaPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-6 py-16 space-y-10">
        <header className="space-y-3">
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-slate-900">Transparência e Recibos</h1>
          <p className="text-slate-600 leading-relaxed">
            A sua confiança é essencial. Aqui explicamos como as doações são utilizadas e
            como funciona a emissão de recibos.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">Como utilizamos as doações</h2>
          <p className="text-slate-600 leading-relaxed">
            As doações apoiam peregrinações, projetos de evangelização e iniciativas de formação
            espiritual do Apostolado de Garabandal.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">Emissão de recibos</h2>
          <p className="text-slate-600 leading-relaxed">
            Os recibos são emitidos manualmente pela administração após a confirmação do pagamento.
            Caso precise de um recibo com urgência, entre em contato com nossa equipe.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">Contato</h2>
          <p className="text-slate-600 leading-relaxed">
            Para dúvidas ou solicitações, escreva para <strong>contacto@garabandal.org</strong>.
          </p>
        </section>
      </div>
    </main>
  );
}

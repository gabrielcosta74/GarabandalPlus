import type { Metadata } from 'next';
import Link from 'next/link';
import { APP_URL } from '../../../lib/config';

const title = 'Política de Devolução | Loja do Apostolado de Garabandal';
const description =
  'Política restrita de devolução, livre resolução legal, trocas e reembolsos aplicável aos artigos vendidos na loja online do Apostolado de Garabandal.';
const url = `${APP_URL}/loja/politica-devolucao`;

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: url,
    languages: {
      'pt-BR': url,
      'pt-PT': url,
      en: `${APP_URL}/en/store/return-policy`,
    },
  },
  openGraph: {
    url,
    title,
    description,
    type: 'article',
    locale: 'pt_PT',
    siteName: 'Apostolado de Garabandal',
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [`${APP_URL}/opengraph-image`],
  },
};

export default function PoliticaDevolucaoPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-6 py-16 space-y-10">
        <header className="space-y-4">
          <Link href="/loja" className="text-sm font-semibold text-amber-700 hover:text-amber-800">
            Voltar à loja
          </Link>
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-slate-900">
            Política de Devolução
          </h1>
          <p className="text-sm text-slate-500">
            Última atualização: 15 de junho de 2026
          </p>
          <p className="text-slate-600 leading-relaxed">
            Esta política aplica-se aos artigos comprados na loja online do Apostolado de
            Garabandal, incluindo livros, artigos religiosos, vestuário e conteúdos digitais.
            Fora dos casos legalmente obrigatórios, não aceitamos devoluções, trocas ou reembolsos
            por mera conveniência, alteração de preferência ou engano na compra.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">1. Política restrita</h2>
          <p className="text-slate-600 leading-relaxed">
            A loja não oferece uma política comercial voluntária de devoluções ou trocas. As
            devoluções são aceites apenas quando a lei o imponha: exercício válido do direito de
            livre resolução em compras à distância, artigo defeituoso, artigo danificado no
            transporte ou artigo diferente do encomendado.
          </p>
          <p className="text-slate-600 leading-relaxed">
            Compras efetuadas por empresas, profissionais ou entidades no âmbito da sua atividade
            podem não beneficiar do regime legal de consumidor, sem prejuízo de direitos imperativos
            aplicáveis.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">2. Direito de livre resolução</h2>
          <p className="text-slate-600 leading-relaxed">
            Nos contratos celebrados à distância, o consumidor pode resolver a compra no prazo de
            14 dias de calendário, sem necessidade de indicar motivo. Para artigos físicos, o prazo
            conta a partir do dia em que o consumidor, ou um terceiro por si indicado, recebe o
            artigo. Se a encomenda for entregue em várias remessas, o prazo conta a partir da
            receção do último artigo.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">3. Como pedir uma devolução</h2>
          <p className="text-slate-600 leading-relaxed">
            Para exercer o direito legal de livre resolução ou reportar defeito, dano ou erro na
            encomenda, envie uma declaração inequívoca para{' '}
            <a href="mailto:geral@apostoladodegarabandal.com" className="underline hover:text-slate-900">
              geral@apostoladodegarabandal.com
            </a>
            , indicando o número da encomenda, nome, email usado na compra e artigos a devolver.
          </p>
          <p className="text-slate-600 leading-relaxed">
            Pode usar o seguinte texto: “Venho por este meio resolver o contrato de compra da
            encomenda [número], recebida em [data], relativa ao(s) artigo(s) [artigos].”
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">4. Estado dos artigos devolvidos</h2>
          <ul className="list-disc pl-6 text-slate-600 leading-relaxed space-y-2">
            <li>Os artigos devem ser devolvidos completos, limpos e, sempre que possível, na embalagem original.</li>
            <li>Livros devem ser devolvidos sem sinais de uso incompatíveis com uma verificação normal.</li>
            <li>Vestuário deve ser devolvido sem uso, lavagem, odores, manchas ou danos.</li>
            <li>O consumidor pode ser responsabilizado pela depreciação resultante de manuseamento além do necessário para verificar a natureza, características e funcionamento do artigo.</li>
            <li>Não aceitamos devoluções de artigos usados, incompletos, danificados por uso indevido ou sem condições de revenda, sem prejuízo dos direitos legais em caso de defeito.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">5. Prazo e custos de envio da devolução</h2>
          <p className="text-slate-600 leading-relaxed">
            Depois de comunicar a devolução, o consumidor deve enviar os artigos no prazo de 14 dias.
            Salvo erro nosso, artigo defeituoso ou artigo diferente do encomendado, os custos diretos
            de devolução ficam a cargo do consumidor.
          </p>
          <p className="text-slate-600 leading-relaxed">
            Recomendamos o envio com comprovativo ou rastreio. A morada de devolução será indicada
            por email após o pedido, de acordo com o país e o tipo de artigo.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">6. Reembolsos</h2>
          <p className="text-slate-600 leading-relaxed">
            O reembolso será efetuado no prazo de 14 dias a contar da comunicação de livre resolução,
            através do mesmo meio de pagamento usado na compra, salvo acordo expresso em contrário.
            Podemos reter o reembolso até recebermos os artigos devolvidos ou até ser apresentado
            comprovativo do seu envio.
          </p>
          <p className="text-slate-600 leading-relaxed">
            Quando aplicável, reembolsamos o preço dos artigos e os custos de entrega padrão pagos
            na compra. Custos adicionais resultantes da escolha de um método de entrega mais caro do
            que o método padrão disponível não são reembolsáveis.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">7. Conteúdos digitais</h2>
          <p className="text-slate-600 leading-relaxed">
            Em conteúdos digitais fornecidos por download, acesso imediato ou biblioteca digital, o
            direito de livre resolução pode deixar de se aplicar quando o consumidor tiver consentido
            no início imediato do fornecimento e reconhecido que, com esse início, perde o direito de
            livre resolução.
          </p>
          <p className="text-slate-600 leading-relaxed">
            Depois de disponibilizado o ficheiro, link, download ou acesso à biblioteca digital nos
            termos acima, não aceitamos cancelamentos, devoluções ou reembolsos por arrependimento.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">8. Artigos defeituosos, danificados ou errados</h2>
          <p className="text-slate-600 leading-relaxed">
            Se receber um artigo danificado, defeituoso ou diferente do encomendado, contacte-nos
            assim que possível para{' '}
            <a href="mailto:geral@apostoladodegarabandal.com" className="underline hover:text-slate-900">
              geral@apostoladodegarabandal.com
            </a>
            , com o número da encomenda e fotografias do artigo e da embalagem. Nestes casos,
            indicaremos a solução adequada sem limitar os direitos legais de garantia do consumidor.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">9. Exceções</h2>
          <p className="text-slate-600 leading-relaxed">
            Além das exceções previstas na lei, podem não ser aceites devoluções de artigos
            personalizados, artigos selados que não possam ser devolvidos por razões de saúde ou
            higiene depois de abertos, ou conteúdos digitais cujo fornecimento já tenha começado nos
            termos indicados nesta política.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">10. Contacto</h2>
          <p className="text-slate-600 leading-relaxed">
            Para questões sobre devoluções, trocas ou reembolsos, contacte{' '}
            <a href="mailto:geral@apostoladodegarabandal.com" className="underline hover:text-slate-900">
              geral@apostoladodegarabandal.com
            </a>
            .
          </p>
        </section>

        <div className="border-t border-slate-200 pt-6 text-sm text-slate-500">
          <p>
            Referências legais principais: Decreto-Lei n.º 24/2014, regime dos contratos celebrados
            à distância, e Decreto-Lei n.º 84/2021, regime aplicável a bens, conteúdos e serviços
            digitais.
          </p>
        </div>
      </div>
    </main>
  );
}

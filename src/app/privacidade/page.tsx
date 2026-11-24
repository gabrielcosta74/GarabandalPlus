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
            Última atualização: 24 de novembro de 2026
          </p>
          <p className="text-slate-600 leading-relaxed">
            Esta Política descreve como o Apostolado de Garabandal trata dados pessoais no âmbito
            do website, web app e aplicação móvel Garabandal (incluindo áreas de membro,
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
            <li>Identificação e contacto: nome, email, telefone, data de nascimento, sexo, país, morada e dados fiscais (incluindo NIF/CPF) quando aplicável.</li>
            <li>Conta e autenticação: credenciais, identificadores técnicos de sessão e estado de autenticação. Parte da aplicação pode ser usada sem conta; nesse caso, o progresso fica no dispositivo até a pessoa criar ou abrir uma conta, e então passa para ela.</li>
            <li>Utilização da área de membro: progresso de novenas, orações concluídas, favoritos e atividade necessária ao funcionamento da aplicação.</li>
            <li>Funcionalidades espirituais: intenções de oração privadas ou publicadas na comunidade, denúncias de conteúdo, progresso e dias de oração e respostas do assistente de IA que o utilizador decida reportar. Alguns destes dados podem revelar convicções religiosas.</li>
            <li>Comunidade: nome, fotografias escolhidas para o perfil ou para publicações, legendas, comentários, pedidos de oração e graças, encontros e salas de oração, chat da missa em direto, reações, amizades, bloqueios e denúncias. O nome e a fotografia de perfil podem ser vistos por outras pessoas; a visibilidade das publicações é escolhida antes de publicar. Alguns pedidos publicados para toda a comunidade podem aparecer, sem nome nem fotografia, a quem usa a aplicação sem conta.</li>
            <li>Assistentes da Bíblia e do Catecismo: registo da autorização para usar fornecedores de IA, incluindo a versão e a data, e número de perguntas feitas. As perguntas não são guardadas como histórico; para não repetir o mesmo pedido, uma resposta pode ficar guardada sem ligação à conta e sem o texto da pergunta. A pergunta e a resposta reportadas pelo utilizador ficam disponíveis para revisão.</li>
            <li>Notificações e dispositivo: identificador aleatório da instalação, identificador de envio de notificações, sistema, versão da aplicação, idioma, fuso horário, última utilização, autorização dada no telefone e preferências de aviso.</li>
            <li>Métricas de utilização da aplicação: ecrãs abertos, sessões, orações começadas e terminadas, vídeos vistos e guardados, botões usados, sistema, versão e, no Android, a origem da instalação. Com sessão iniciada ficam ligadas à conta; sem conta, a um identificador aleatório da instalação. Não incluem o texto de orações, pedidos, perguntas ou do exame de consciência.</li>
            <li>Microfone e voz (terço em conversa): só com autorização e durante a oração. O som e o reconhecimento de voz são tratados no dispositivo; não são enviados nem guardados nos nossos servidores.</li>
            <li>Subscrição digital Rezar+: identificador da conta, produto, loja, ambiente de teste ou produção, referência da transação, estado da subscrição e fim do período de acesso. Não recebemos dados do cartão utilizado na loja.</li>
            <li>Reserva da casa do Apostolado: datas, número e nomes dos acompanhantes, contactos e notas indicados no pedido.</li>
            <li>Dados de inscrição e peregrinação: dados do titular e acompanhantes, alojamento, quarto, voos, pontos de encontro, preferências logísticas, comprovativos e histórico.</li>
            <li>Dados de saúde fornecidos para a segurança da viagem: alergias, restrições alimentares, notas de saúde e necessidades de assistência. Estes dados são tratados apenas para organizar e acompanhar a peregrinação.</li>
            <li>Dados de transação: montantes, método de pagamento, referências e estado de pagamento.</li>
            <li>Dados de loja online: encomendas, envio, faturação e histórico comercial.</li>
            <li>Comunicações e suporte: mensagens enviadas por formulários, email e canais de apoio.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">3. Finalidades e bases legais</h2>
          <ul className="list-disc pl-6 text-slate-600 leading-relaxed space-y-2">
            <li>Execução contratual: gestão da conta, inscrições, quotas, doações, encomendas, reservas e acesso à subscrição digital Rezar+, e prestação das funções da aplicação que a pessoa usa.</li>
            <li>Obrigações legais: faturação, arquivo contabilístico/fiscal, prevenção de fraude e cooperação com autoridades.</li>
            <li>Interesse legítimo: segurança da plataforma, auditoria, prevenção de abuso e melhoria da aplicação através de métricas de utilização, sem publicidade. Pode opor-se através do contacto indicado acima.</li>
            <li>Dados que podem revelar convicções religiosas: tratados no âmbito das atividades legítimas da Associação, sem fins lucrativos e com finalidade religiosa, em relação a membros e pessoas que com ela mantêm contactos regulares (artigo 9.º, n.º 2, alínea d), do RGPD), e com autorização expressa antes de publicar na comunidade ou de usar os assistentes de IA.</li>
            <li>Sugestão de vídeos: a ordem dos vídeos tem em conta os temas das orações feitas na aplicação e os vídeos vistos, guardados ou recusados. Não produz efeitos jurídicos nem serve para publicidade.</li>
            <li>Consentimento: comunicações promocionais não estritamente necessárias, quando aplicável.</li>
            <li>Autorização expressa para os assistentes de IA: antes de enviar perguntas a fornecedores externos, explicamos o envio e pedimos permissão. É possível retirá-la no próprio assistente; a leitura continua disponível.</li>
            <li>Autorização expressa para publicar na comunidade: antes de aceitar as regras, explicamos que o texto e, se escolhida, a fotografia são enviados à OpenAI para verificação automática de segurança. Sem essa autorização, é possível continuar a consultar a comunidade, mas não publicar.</li>
            <li>Notificações e microfone: só com a autorização dada no telefone, que pode ser retirada a qualquer momento nas definições do dispositivo.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">4. Partilha de dados</h2>
          <p className="text-slate-600 leading-relaxed">
            Os dados podem ser partilhados com subcontratantes estritamente necessários à operação da
            plataforma (ex.: autenticação, alojamento, processamento de pagamentos, envio de email e
            notificações e organização operacional da viagem), sempre ao abrigo de contratos com cláusulas de proteção de dados e segundo o princípio da minimização.
          </p>
          <p className="text-slate-600 leading-relaxed">
            Os principais prestadores incluem Supabase (autenticação, base de dados e ficheiros), Railway
            (alojamento e API), Resend (email transacional), Reduniq (checkout externo de pagamentos),
            RevenueCat (validação das compras digitais da App Store e Google Play; recebe o identificador
            da conta e os dados da subscrição) e Expo, Apple e Google (entrega de notificações).
          </p>
          <p className="text-slate-600 leading-relaxed">
            Nos assistentes opcionais da Bíblia e do Catecismo, a Google recebe a pergunta e mensagens
            recentes para pesquisar passagens relevantes. A Google ou a OpenAI recebe a pergunta, essas
            mensagens e excertos selecionados para gerar a resposta. A aplicação não envia o exame de
            consciência nem a preparação para confissão a esses fornecedores.
          </p>
          <p className="text-slate-600 leading-relaxed">
            Ao publicar, comentar ou mudar a fotografia e a apresentação do perfil, após autorização, o
            texto e, quando aplicável, a fotografia são enviados à OpenAI para identificar conteúdo
            impróprio antes de aparecerem. Textos publicados na comunidade podem também ser enviados à
            OpenAI para os traduzir a quem usa a aplicação noutra língua. A OpenAI não recebe o nome nem
            o identificador da conta nesses pedidos; o próprio conteúdo pode, contudo, identificar
            pessoas. A equipa do Apostolado pode consultar publicações e denúncias para decidir
            ocultação, reposição ou outras medidas de segurança.
          </p>
          <p className="text-slate-600 leading-relaxed">
            A secção Vídeos usa os serviços da API do YouTube e o leitor oficial do YouTube, que pode
            recolher dados e usar cookies segundo a{' '}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-900">
              Política de Privacidade da Google
            </a>
            . Não enviamos ao YouTube a identificação da sua conta connosco. Leituras, imagens, mapas e
            transmissões obtidos de outros serviços implicam que estes recebam o endereço IP do
            dispositivo, como em qualquer página na internet.
          </p>
          <p className="text-slate-600 leading-relaxed">
            Quando necessário à execução da peregrinação, os dados estritamente necessários podem ser
            partilhados com operadores de transporte, alojamento, seguros ou acompanhamento local.
            A aplicação móvel não integra publicidade própria, não vende dados e não recolhe dados de cartão.
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
            <li>Comunidade: as publicações e fotografias permanecem até serem retiradas pelo autor, pela equipa ou com a eliminação da conta, ressalvados registos de denúncia e decisão necessários para segurança e obrigações legais. As cópias de segurança seguem o respetivo ciclo técnico de rotação.</li>
            <li>Métricas de utilização: as ligadas à conta são apagadas com ela; as feitas sem conta não identificam diretamente a pessoa e conservam-se enquanto forem úteis para melhorar a aplicação. Os registos de vídeos vistos são apagados ao fim de 180 dias.</li>
            <li>Notificações: os dados do dispositivo são retirados ao terminar sessão ou eliminar a conta; os registos técnicos de entrega são apagados ao fim de 30 dias.</li>
            <li>Dados baseados em consentimento: até retirada do consentimento ou termo da finalidade.</li>
            <li>Autorização de IA: o registo ativo é apagado quando a autorização é retirada ou a conta é eliminada. As respostas que o utilizador reportou podem permanecer para análise da denúncia durante o período necessário a essa finalidade.</li>
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
            Na aplicação pode descarregar uma cópia dos dados da sua conta em Perfil, Definições,
            “Descarregar os meus dados”.
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
            preferências, favoritos, rascunhos de inscrição e progresso temporário de oração. O exame de consciência, a data da última confissão e a penitência pendente ficam apenas no armazenamento seguro do dispositivo; são apagados ao sair da conta ou eliminá-la. A desinstalação no iOS pode não apagar automaticamente os dados do Keychain. Não utiliza identificadores
            publicitários, não acompanha o utilizador entre apps ou websites e não solicita acesso a
            contactos, localização ou câmara.
          </p>
          <p className="text-slate-600 leading-relaxed">
            O seletor de fotografias do sistema é aberto apenas quando a pessoa escolhe uma imagem para o
            perfil ou para a comunidade; a aplicação recebe só a imagem escolhida. O microfone e o
            reconhecimento de voz só são pedidos no terço em conversa, e o som não sai do dispositivo.
          </p>
          <p className="text-slate-600 leading-relaxed">
            A aplicação não é dirigida a crianças.
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

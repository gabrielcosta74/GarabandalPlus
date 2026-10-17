type MarianStep = 'marian_2027_invitation' | 'marian_2027_journey' | 'marian_2027_practical';

type EditorialEmailInput = {
  step: MarianStep;
  locale: 'pt' | 'en';
  subject: string;
  preview: string;
  name?: string | null;
  image: string;
  pilgrimageUrl: string;
  unsubscribeUrl?: string | null;
};

const ink = '#203146';
const muted = '#66717d';
const wine = '#754c58';
const paper = '#f5f2ed';
const serif = "'New York', 'Iowan Old Style', Baskerville, Georgia, serif";

const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const paragraph = (copy: string) => `<p style="margin:0 0 20px;color:${ink};font-size:16px;line-height:27px;">${copy}</p>`;
const detailRow = (number: string, title: string, copy: string) => `
  <tr><td width="46" valign="top" style="padding:18px 0;border-top:1px solid #e4ded8;color:${wine};font-family:${serif};font-size:22px;line-height:28px;">${number}</td>
  <td valign="top" style="padding:18px 0;border-top:1px solid #e4ded8;"><div style="color:${ink};font-family:${serif};font-size:23px;line-height:28px;">${title}</div><div style="padding-top:5px;color:${muted};font-size:14px;line-height:23px;">${copy}</div></td></tr>`;

type Edition = { chapter: string; title: string; subtitle: string; photoLabel: string; photoPosition: string; cta: string; body: (greeting: string) => string };

const EDITIONS: Record<MarianStep, Edition> = {
  marian_2027_invitation: {
    chapter: '01 / O CONVITE',
    title: 'Há viagens que se tornam caminho.',
    subtitle: 'Caminho Mariano · 11 a 24 de outubro de 2027',
    photoLabel: 'GARABANDAL · ESPANHA',
    photoPosition: 'center 72%',
    cta: 'Conhecer a peregrinação',
    body: (greeting) => `
      ${paragraph(`<strong>${greeting},</strong>`)}
      ${paragraph('Em outubro de 2027, convidamos a percorrer connosco o Caminho Mariano: catorze dias de oração, encontro e descoberta, com início em Portugal e passagem por lugares marcantes da fé mariana em Espanha e França.')}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 27px;background:#f7f3f1;border-left:3px solid ${wine};"><tr><td style="padding:22px 25px;">
        <div style="color:${wine};font-size:10px;font-weight:700;letter-spacing:2.2px;">O PERCURSO</div>
        <div style="padding-top:8px;color:${ink};font-family:${serif};font-size:25px;line-height:32px;">De Fátima a Garabandal. De Lourdes a Paris.</div>
        <div style="padding-top:8px;color:${muted};font-size:14px;line-height:23px;">Portugal, Espanha e França, com acompanhamento espiritual e tempo para viver cada lugar.</div>
      </td></tr></table>
      ${paragraph('O programa oficial reúne as etapas, as condições e todos os passos para a inscrição. Conheça-o e descubra se este caminho é para si.')}`,
  },
  marian_2027_journey: {
    chapter: '02 / O ITINERÁRIO',
    title: 'Cada lugar tem uma história.',
    subtitle: '11 a 24 de outubro de 2027 · Um percurso com sentido',
    photoLabel: 'GARABANDAL · ESPANHA',
    photoPosition: 'center 76%',
    cta: 'Explorar o itinerário',
    body: (greeting) => `
      ${paragraph(`<strong>${greeting},</strong>`)}
      ${paragraph('O Caminho Mariano liga lugares que convidam a parar, escutar e rezar. Ao longo de catorze dias, seguimos por três países com o acompanhamento espiritual previsto no programa.')}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:23px 0 30px;">
        ${detailRow('01', 'Fátima e Garabandal', 'Da oração em Fátima ao silêncio da aldeia de Garabandal.')}
        ${detailRow('02', 'Lourdes e La Salette', 'Duas etapas marianas no coração do percurso por França.')}
        ${detailRow('03', 'Lisieux e Paris', 'Outros lugares de fé antes do regresso a casa.')}
      </table>
      ${paragraph('Na página da peregrinação pode percorrer o programa dia a dia e consultar o que está incluído.')}`,
  },
  marian_2027_practical: {
    chapter: '03 / ANTES DE DECIDIR',
    title: 'Prepare o seu caminho.',
    subtitle: '11 a 24 de outubro de 2027 · Decidir com tranquilidade',
    photoLabel: 'LOURDES · FRANÇA',
    photoPosition: 'center 52%',
    cta: 'Ver programa e condições',
    body: (greeting) => `
      ${paragraph(`<strong>${greeting},</strong>`)}
      ${paragraph('Se está a considerar o Caminho Mariano 2027, reunimos num só lugar as informações de que precisa para decidir com tranquilidade.')}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:25px 0 29px;background:#f7f3f1;"><tr><td style="padding:24px 26px;">
        <div style="margin-bottom:14px;color:${wine};font-size:10px;font-weight:700;letter-spacing:2.2px;">NO PROGRAMA OFICIAL</div>
        <div style="padding:10px 0;border-top:1px solid #e4ded8;color:${ink};font-size:15px;line-height:23px;">11 a 24 de outubro de 2027</div>
        <div style="padding:10px 0;border-top:1px solid #e4ded8;color:${ink};font-size:15px;line-height:23px;">Itinerário e acompanhamento espiritual</div>
        <div style="padding:10px 0 0;border-top:1px solid #e4ded8;color:${ink};font-size:15px;line-height:23px;">Condições, preços e inscrição</div>
      </td></tr></table>
      ${paragraph('Se surgir alguma dúvida, escreva-nos para <a href="mailto:geral@apostoladodegarabandal.com" style="color:#754c58;text-decoration:underline;">geral@apostoladodegarabandal.com</a>. Teremos todo o gosto em ajudar.')}
      ${paragraph('Quando decidir, pode seguir os passos de inscrição diretamente na página.')}`,
  },
};

const EDITIONS_EN: Record<MarianStep, Edition> = {
  marian_2027_invitation: {
    chapter: '01 / AN INVITATION',
    title: 'Where the journey becomes prayer.',
    subtitle: 'Marian Way · 11–24 October 2027',
    photoLabel: 'GARABANDAL · SPAIN',
    photoPosition: 'center 72%',
    cta: 'Discover the pilgrimage',
    body: (greeting) => `
      ${paragraph(`<strong>${greeting},</strong>`)}
      ${paragraph('In October 2027, we invite you to join us on the Marian Way: fourteen days of prayer, reflection and discovery, beginning in Portugal and continuing through Marian pilgrimage sites in Spain and France.')}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 27px;background:#f7f3f1;border-left:3px solid ${wine};"><tr><td style="padding:22px 25px;">
        <div style="color:${wine};font-size:10px;font-weight:700;letter-spacing:2.2px;">THE JOURNEY</div>
        <div style="padding-top:8px;color:${ink};font-family:${serif};font-size:25px;line-height:32px;">From Fátima to Garabandal. From Lourdes to Paris.</div>
        <div style="padding-top:8px;color:${muted};font-size:14px;line-height:23px;">Portugal, Spain and France, with spiritual guidance and time to experience each place.</div>
      </td></tr></table>
      ${paragraph('The official programme has the full route, conditions and registration details. Take a look and see whether this journey is right for you.')}`,
  },
  marian_2027_journey: {
    chapter: '02 / THE ITINERARY',
    title: 'Every place has a story.',
    subtitle: '11–24 October 2027 · A journey with purpose',
    photoLabel: 'GARABANDAL · SPAIN',
    photoPosition: 'center 76%',
    cta: 'Explore the itinerary',
    body: (greeting) => `
      ${paragraph(`<strong>${greeting},</strong>`)}
      ${paragraph('The Marian Way connects places that invite us to pause, listen and pray. Over fourteen days, we travel through three countries with spiritual guidance throughout, as described in the programme.')}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:23px 0 30px;">
        ${detailRow('01', 'Fátima and Garabandal', 'From prayer in Fátima to the quiet of Garabandal village.')}
        ${detailRow('02', 'Lourdes and La Salette', 'Two Marian stops at the heart of our journey through France.')}
        ${detailRow('03', 'Lisieux and Paris', 'More places of faith before the journey home.')}
      </table>
      ${paragraph('On the pilgrimage page, you can explore the day-by-day programme and see what is included.')}`,
  },
  marian_2027_practical: {
    chapter: '03 / BEFORE YOU DECIDE',
    title: 'Prepare for the journey.',
    subtitle: '11–24 October 2027 · Decide with confidence',
    photoLabel: 'LOURDES · FRANCE',
    photoPosition: 'center 52%',
    cta: 'View programme and details',
    body: (greeting) => `
      ${paragraph(`<strong>${greeting},</strong>`)}
      ${paragraph('If you are considering the Marian Way 2027, you can find the dates, route and registration details together in one place.')}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:25px 0 29px;background:#f7f3f1;"><tr><td style="padding:24px 26px;">
        <div style="margin-bottom:14px;color:${wine};font-size:10px;font-weight:700;letter-spacing:2.2px;">IN THE OFFICIAL PROGRAMME</div>
        <div style="padding:10px 0;border-top:1px solid #e4ded8;color:${ink};font-size:15px;line-height:23px;">11–24 October 2027</div>
        <div style="padding:10px 0;border-top:1px solid #e4ded8;color:${ink};font-size:15px;line-height:23px;">Itinerary and spiritual guidance</div>
        <div style="padding:10px 0 0;border-top:1px solid #e4ded8;color:${ink};font-size:15px;line-height:23px;">Conditions, prices and registration</div>
      </td></tr></table>
      ${paragraph('If you have a question, write to us at <a href="mailto:geral@apostoladodegarabandal.com" style="color:#754c58;text-decoration:underline;">geral@apostoladodegarabandal.com</a>. We will be glad to help.')}
      ${paragraph('When you are ready, you can follow the registration steps directly on the pilgrimage page.')}`,
  },
};

export function renderMarian2027EditorialEmail(input: EditorialEmailInput): string {
  const isEn = input.locale === 'en';
  const edition = (isEn ? EDITIONS_EN : EDITIONS)[input.step];
  const firstName = input.name?.trim().split(/\s+/)[0];
  const greeting = firstName ? `${isEn ? 'Hello' : 'Olá'} ${escapeHtml(firstName)}` : (isEn ? 'Hello' : 'Olá');
  const title = escapeHtml(edition.title);
  const image = escapeHtml(input.image);
  const url = escapeHtml(input.pilgrimageUrl);
  const unsubscribeUrl = input.unsubscribeUrl ? escapeHtml(input.unsubscribeUrl) : null;

  return `<!DOCTYPE html>
<html lang="${input.locale}" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(input.subject)}</title>
  <style>
    :root { color-scheme:light only; supported-color-schemes:light; }
    body { margin:0; padding:0; background:${paper}; font-family:Arial,Helvetica,sans-serif; -webkit-font-smoothing:antialiased; }
    table { border-spacing:0; border-collapse:collapse; } img { border:0; }
    @media only screen and (max-width:620px) { .container { width:100% !important; } .edge { padding-left:25px !important; padding-right:25px !important; } .headline { font-size:34px !important; line-height:39px !important; } .outer { padding:12px 0 !important; } .photo { height:225px !important; } }
  </style>
</head>
<body style="margin:0;padding:0;background:${paper};color:${ink};font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;">${escapeHtml(input.preview)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${paper}" style="background:${paper};"><tr><td class="outer" align="center" style="padding:32px 12px;">
    <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;">
      <tr><td align="center" class="edge" style="padding:27px 38px 25px;background:#ffffff;border-top:4px solid ${wine};">
        <div style="color:${ink};font-family:${serif};font-size:18px;line-height:24px;letter-spacing:.3px;">Apostolado de Garabandal</div>
        <div style="padding-top:7px;color:${wine};font-size:9px;font-weight:700;letter-spacing:2.6px;">${isEn ? 'MARIAN WAY' : 'CAMINHO MARIANO'} &nbsp;·&nbsp; 2027</div>
      </td></tr>
      <tr><td class="photo" height="285" background="${image}" style="height:285px;background:#d6d9d6 url('${image}') ${edition.photoPosition}/cover no-repeat;background-size:cover;">
        <!--[if gte mso 9]><v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px;height:285px;"><v:fill type="frame" src="${image}" color="#d6d9d6" /><v:textbox inset="0,0,0,0"><![endif]-->
        <div style="height:285px;line-height:285px;font-size:0;">&nbsp;</div>
        <!--[if gte mso 9]></v:textbox></v:rect><![endif]-->
      </td></tr>
      <tr><td class="edge" style="padding:17px 45px 0;color:${muted};font-size:10px;letter-spacing:1.8px;">${edition.photoLabel}</td></tr>
      <tr><td class="edge" style="padding:34px 45px 0;">
        <div style="color:${wine};font-size:10px;font-weight:700;letter-spacing:2.6px;">${edition.chapter}</div>
        <h1 class="headline" style="margin:15px 0 0;color:${ink};font-family:${serif};font-size:42px;font-weight:400;line-height:46px;letter-spacing:-1.2px;">${title}</h1>
        <p style="margin:13px 0 0;color:${muted};font-family:${serif};font-size:17px;font-style:italic;line-height:24px;">${escapeHtml(edition.subtitle)}</p>
      </td></tr>
      <tr><td class="edge" style="padding:29px 45px 0;"><div style="border-top:1px solid #e4ded8;font-size:0;line-height:0;">&nbsp;</div></td></tr>
      <tr><td class="edge" style="padding:31px 45px 5px;">${edition.body(greeting)}</td></tr>
      <tr><td class="edge" style="padding:0 45px 44px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="${ink}" style="background:${ink};">
          <a href="${url}" style="display:block;padding:18px 20px;color:#ffffff;font-size:13px;font-weight:700;letter-spacing:.3px;line-height:20px;text-align:center;text-decoration:none;">${edition.cta} &nbsp;→</a>
        </td></tr></table>
      </td></tr>
      <tr><td class="edge" style="padding:25px 45px 29px;background:#f7f3f1;border-top:1px solid #e9e1dd;">
        <div style="color:${ink};font-family:${serif};font-size:19px;line-height:25px;">${isEn ? 'We are here to help.' : 'Estamos por perto.'}</div>
        <p style="margin:8px 0 0;color:${muted};font-size:12px;line-height:20px;">${isEn ? 'Questions about the pilgrimage?' : 'Questões sobre a peregrinação?'} <a href="mailto:geral@apostoladodegarabandal.com" style="color:${wine};text-decoration:underline;">${isEn ? 'Email us' : 'Escreva-nos'}</a> ${isEn ? 'or message us on' : 'ou fale connosco pelo'} <a href="https://wa.me/351915206815" style="color:${wine};text-decoration:underline;">WhatsApp</a>.</p>
        ${unsubscribeUrl ? `<p style="margin:20px 0 0;color:#7c838b;font-size:11px;line-height:17px;">${isEn ? 'You are receiving this email because you subscribed to our updates. You can' : 'Recebe este email por ter subscrito as nossas comunicações. Pode'} <a href="${unsubscribeUrl}" style="color:#7c838b;text-decoration:underline;">${isEn ? 'unsubscribe' : 'cancelar a subscrição'}</a> ${isEn ? 'at any time.' : 'a qualquer momento.'}</p>` : ''}
      </td></tr>
    </table>
    <div style="padding:22px 10px 0;color:#899097;font-size:10px;letter-spacing:1.1px;text-align:center;">APOSTOLADO DE GARABANDAL</div>
  </td></tr></table>
</body></html>`;
}

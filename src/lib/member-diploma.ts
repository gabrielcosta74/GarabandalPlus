import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import path from 'path';
import fs from 'fs/promises';

type MemberDiplomaInput = {
  memberName: string;
  memberNumber: number;
  issuedAt?: string | null;
  locale?: 'pt' | 'en';
};

const DEFAULT_LOGO_URL =
  'https://7a8de8e761.clvaw-cdnwnd.com/71f1178ac9c9a00e4eb676b74ddebc1f/200000002-1e4111f3a0/nossasenhoragarabandal-9.jpg?ph=7a8de8e761';

const RIGHTS_PT = [
  'Desconto de 5% em livros e publicacoes da Associacao.',
  'Desconto de 5% em congressos e conferencias organizadas pela Associacao.',
  '50 euros de desconto em peregrinacoes e atividades sociais organizadas.',
  'Ofertas de missas anuais pelas intencoes dos associados e familiares.',
  'Participar e votar na Assembleia Geral apos 2 anos de quotas pagas.',
];

const RIGHTS_EN = [
  '5% discount on books and publications by the Association.',
  '5% discount on congresses and conferences organized by the Association.',
  '50 euros discount on pilgrimages and organized social activities.',
  'Annual masses offered for the intentions of members and their families.',
  'Participate and vote in the General Assembly after 2 years of paid quotas.',
];

const DUTIES_PT = [
  'Cumprir obrigacoes estatutarias e deliberacoes dos orgaos sociais.',
  'Exercer funcoes para as quais for eleito ou designado.',
  'Pagar a quota anual estabelecida (25 EUR).',
  'Colaborar nas atividades da associacao e nos seus objetivos.',
];

const DUTIES_EN = [
  'Comply with statutory obligations and board decisions.',
  'Perform the duties for which one was elected or appointed.',
  'Pay the established annual quota (25 EUR).',
  'Collaborate in the association\'s activities and its objectives.',
];

const formatDate = (value?: string | null, locale: 'pt' | 'en' = 'pt') => {
  const date = value ? new Date(value) : new Date();
  const l = locale === 'en' ? 'en-US' : 'pt-PT';
  if (Number.isNaN(date.getTime())) return new Date().toLocaleDateString(l);
  return date.toLocaleDateString(l, { year: 'numeric', month: 'long', day: 'numeric' });
};

const wrapText = (text: string, maxWidth: number, font: any, size: number) => {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    const width = font.widthOfTextAtSize(next, size);
    if (width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
};

const loadLogoBytes = async () => {
  const localPath = process.env.MEMBER_DIPLOMA_LOGO_PATH;
  if (localPath) {
    try {
      return await fs.readFile(localPath);
    } catch (err) {
      console.warn('Nao foi possivel ler logo local:', err);
    }
  }

  try {
    const fallbackPath = path.join(process.cwd(), 'public', 'images', 'member-diploma-logo.jpg');
    return await fs.readFile(fallbackPath);
  } catch {
    // ignore
  }

  const url = process.env.MEMBER_DIPLOMA_LOGO_URL || DEFAULT_LOGO_URL;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Logo fetch failed');
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    console.warn('Nao foi possivel obter logo remoto:', err);
    return null;
  }
};

const loadSignatureBytes = async () => {
  const localPath = process.env.MEMBER_DIPLOMA_SIGNATURE_PATH;
  if (localPath) {
    try {
      return await fs.readFile(localPath);
    } catch (err) {
      console.warn('Nao foi possivel ler assinatura local:', err);
    }
  }

  try {
    const fallbackPath = path.join(process.cwd(), 'public', 'images', 'assinatura-garabandal.png');
    return await fs.readFile(fallbackPath);
  } catch {
    // ignore
  }

  const url = process.env.MEMBER_DIPLOMA_SIGNATURE_URL;
  if (url) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Signature fetch failed');
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (err) {
      console.warn('Nao foi possivel obter assinatura remota:', err);
      return null;
    }
  }
  return null;
};

export const generateMemberDiplomaPdf = async ({ memberName, memberNumber, issuedAt, locale = 'pt' }: MemberDiplomaInput) => {
  const isEn = locale === 'en';
  const pdfDoc = await PDFDocument.create();
  // Landscape A4 for a more certificate-like feel: 841.89 x 595.28
  const page = pdfDoc.addPage([841.89, 595.28]);
  const { width, height } = page.getSize();

  // Load Classic Fonts
  const fontRegular = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const fontScript = await pdfDoc.embedFont(StandardFonts.ZapfDingbats); // Using generic for decorations if needed, or stick to Times for class

  // Colors
  const darkBlue = rgb(0.1, 0.15, 0.3);
  const gold = rgb(0.7, 0.6, 0.2);
  const textGrey = rgb(0.3, 0.3, 0.3);

  // --- Background & Border ---
  const margin = 40;
  // Outer Border (Gold)
  page.drawRectangle({
    x: margin,
    y: margin,
    width: width - margin * 2,
    height: height - margin * 2,
    borderColor: gold,
    borderWidth: 3,
    color: rgb(0.99, 0.99, 0.98), // Cream background
  });

  // Inner Border (Blue)
  page.drawRectangle({
    x: margin + 5,
    y: margin + 5,
    width: width - (margin + 5) * 2,
    height: height - (margin + 5) * 2,
    borderColor: darkBlue,
    borderWidth: 1,
    opacity: 0, // No fill
    borderOpacity: 0.8
  });

  let cursorY = height - 100;

  // --- Logo ---
  const logoBytes = await loadLogoBytes();
  if (logoBytes) {
    let logo;
    try {
      logo = await pdfDoc.embedJpg(logoBytes as unknown as Uint8Array);
    } catch {
      try {
        logo = await pdfDoc.embedPng(logoBytes as unknown as Uint8Array);
      } catch (err) {
        console.warn('Nao foi possivel embutir logo:', err);
      }
    }
    if (logo) {
      const maxWidth = 100;
      const scale = maxWidth / logo.width;
      const logoWidth = maxWidth;
      const logoHeight = logo.height * scale;
      page.drawImage(logo, {
        x: (width - logoWidth) / 2,
        y: height - 130, // Position at top
        width: logoWidth,
        height: logoHeight,
      });
      cursorY -= 60;
    }
  }

  // --- Title ---
  cursorY = height - 160;
  const title = isEn ? 'MEMBERSHIP DIPLOMA' : 'DIPLOMA DE MEMBRO';
  const titleSize = 32;
  const titleWidth = fontBold.widthOfTextAtSize(title, titleSize);
  page.drawText(title, {
    x: (width - titleWidth) / 2,
    y: cursorY,
    size: titleSize,
    font: fontBold,
    color: darkBlue,
  });

  const subTitle = isEn ? 'GARABANDAL APOSTOLATE' : 'APOSTOLADO DE GARABANDAL';
  const subTitleSize = 16;
  const subTitleWidth = fontRegular.widthOfTextAtSize(subTitle, subTitleSize);
  page.drawText(subTitle, {
    x: (width - subTitleWidth) / 2,
    y: cursorY - 25,
    size: subTitleSize,
    font: fontRegular,
    color: gold,
  });

  // --- Main Content ---
  cursorY -= 80;
  const certText = isEn ? 'This certifies that' : 'Certifica-se que';
  const certTextSize = 14;
  const certTextWidth = fontItalic.widthOfTextAtSize(certText, certTextSize);
  page.drawText(certText, {
    x: (width - certTextWidth) / 2,
    y: cursorY,
    size: certTextSize,
    font: fontItalic,
    color: textGrey,
  });

  cursorY -= 40;
  // Member Name (Large)
  const nameSize = 36;
  const nameWidth = fontBold.widthOfTextAtSize(memberName, nameSize);
  page.drawText(memberName, {
    x: (width - nameWidth) / 2,
    y: cursorY,
    size: nameSize,
    font: fontBold,
    color: darkBlue,
  });

  // Underline name
  page.drawLine({
    start: { x: (width - nameWidth) / 2 - 20, y: cursorY - 5 },
    end: { x: (width + nameWidth) / 2 + 20, y: cursorY - 5 },
    thickness: 1,
    color: gold,
  });

  cursorY -= 30;
  const memberSince = isEn ? `is an active member under no. ${memberNumber}` : `é membro ativo com o número ${memberNumber}`;
  const numberTextSize = 14;
  const numberTextWidth = fontRegular.widthOfTextAtSize(memberSince, numberTextSize);
  page.drawText(memberSince, {
    x: (width - numberTextWidth) / 2,
    y: cursorY,
    size: numberTextSize,
    font: fontRegular,
    color: textGrey,
  });

  // --- Rights & Duties Columns ---
  const colY = cursorY - 60;
  const col1X = margin + 50;
  const col2X = width / 2 + 20;
  const colWidth = (width - margin * 2) / 2 - 60;

  // Rights Column
  const rightsTitle = isEn ? 'MEMBER RIGHTS' : 'DIREITOS DO MEMBRO';
  page.drawText(rightsTitle, {
    x: col1X,
    y: colY,
    size: 12,
    font: fontBold,
    color: darkBlue,
  });

  let rightY = colY - 20;
  const rightsList = isEn ? RIGHTS_EN : RIGHTS_PT;
  rightsList.forEach((item) => {
    const lines = wrapText(`• ${item}`, colWidth + 20, fontRegular, 10);
    lines.forEach((line) => {
      page.drawText(line, {
        x: col1X,
        y: rightY,
        size: 10,
        font: fontRegular,
        color: textGrey,
      });
      rightY -= 14;
    });
    rightY -= 4; // Extra space between items
  });

  // Duties Column
  const dutiesTitle = isEn ? 'MEMBER DUTIES' : 'DEVERES DO MEMBRO';
  page.drawText(dutiesTitle, {
    x: col2X,
    y: colY,
    size: 12,
    font: fontBold,
    color: darkBlue,
  });

  let dutyY = colY - 20;
  const dutiesList = isEn ? DUTIES_EN : DUTIES_PT;
  dutiesList.forEach((item) => {
    const lines = wrapText(`• ${item}`, colWidth, fontRegular, 10);
    lines.forEach((line) => {
      page.drawText(line, {
        x: col2X,
        y: dutyY,
        size: 10,
        font: fontRegular,
        color: textGrey,
      });
      dutyY -= 14;
    });
    dutyY -= 4;
  });

  // --- Footer / Signature ---
  const footerY = margin + 60;

  const dateText = isEn 
    ? `Issued in Paços de Brandão on ${formatDate(issuedAt, locale)}`
    : `Emitido em Paços de Brandão, a ${formatDate(issuedAt, locale)}`;
  page.drawText(dateText, {
    x: margin + 50,
    y: footerY,
    size: 11,
    font: fontItalic,
    color: textGrey,
  });

  const sigLabel = isEn ? 'The Board' : 'A Direção';
  const sigLabelWidth = fontBold.widthOfTextAtSize(sigLabel, 12);
  const sigX = width - margin - 150;

  // --- Draw Signature ---
  const signatureBytes = await loadSignatureBytes();
  if (signatureBytes) {
    let signatureImg;
    try {
      signatureImg = await pdfDoc.embedPng(signatureBytes as unknown as Uint8Array);
    } catch {
      try {
        signatureImg = await pdfDoc.embedJpg(signatureBytes as unknown as Uint8Array);
      } catch (e) {
        console.warn('Failed to embed signature', e);
      }
    }

    if (signatureImg) {
      const sigWidth = 100;
      const sigScale = sigWidth / signatureImg.width;
      const sigHeight = signatureImg.height * sigScale;

      // Position signature above the line
      page.drawImage(signatureImg, {
        x: sigX + (150 - sigWidth) / 2,
        y: footerY + 5, // Just above the line
        width: sigWidth,
        height: sigHeight,
      });
    }
  }

  // Label (Below line)
  page.drawText(sigLabel, {
    x: sigX + (150 - sigLabelWidth) / 2,
    y: footerY - 15,
    size: 12,
    font: fontBold,
    color: darkBlue,
  });

  // Line
  page.drawLine({
    start: { x: sigX, y: footerY },
    end: { x: sigX + 150, y: footerY },
    thickness: 1,
    color: darkBlue,
  });

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
};

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import path from 'path';
import fs from 'fs/promises';

type MemberDiplomaInput = {
  memberName: string;
  memberNumber: number;
  issuedAt?: string | null;
};

const DEFAULT_LOGO_URL =
  'https://7a8de8e761.clvaw-cdnwnd.com/71f1178ac9c9a00e4eb676b74ddebc1f/200000002-1e4111f3a0/nossasenhoragarabandal-9.jpg?ph=7a8de8e761';

const RIGHTS = [
  'Desconto de 5% em livros e publicacoes da Associacao.',
  'Desconto de 5% em congressos e conferencias organizadas pela Associacao.',
  'Desconto de 5% em peregrinacoes e atividades sociais organizadas.',
  'Ofertas de missas anuais pelas intencoes dos associados e familiares.',
  'Participar e votar na Assembleia Geral apos 2 anos de quotas pagas.',
];

const DUTIES = [
  'Cumprir obrigacoes estatutarias e deliberacoes dos orgaos sociais.',
  'Exercer funcoes para as quais for eleito ou designado.',
  'Pagar a quota anual estabelecida (25 EUR).',
  'Colaborar nas atividades da associacao e nos seus objetivos.',
];

const formatDatePt = (value?: string | null) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toLocaleDateString('pt-PT');
  return date.toLocaleDateString('pt-PT');
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

export const generateMemberDiplomaPdf = async ({ memberName, memberNumber, issuedAt }: MemberDiplomaInput) => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 52;
  let cursorY = height - margin;

  const logoBytes = await loadLogoBytes();
  if (logoBytes) {
    let logo;
    try {
      logo = await pdfDoc.embedJpg(logoBytes);
    } catch {
      try {
        logo = await pdfDoc.embedPng(logoBytes);
      } catch (err) {
        console.warn('Nao foi possivel embutir logo:', err);
      }
    }
    if (logo) {
      const maxWidth = 140;
      const scale = maxWidth / logo.width;
      const logoWidth = maxWidth;
      const logoHeight = logo.height * scale;
      page.drawImage(logo, {
        x: (width - logoWidth) / 2,
        y: cursorY - logoHeight,
        width: logoWidth,
        height: logoHeight,
      });
      cursorY -= logoHeight + 18;
    }
  }

  const titleSize = 24;
  const title = 'Diploma de Membro';
  const titleWidth = fontBold.widthOfTextAtSize(title, titleSize);
  page.drawText(title, {
    x: (width - titleWidth) / 2,
    y: cursorY - titleSize,
    size: titleSize,
    font: fontBold,
    color: rgb(0.12, 0.18, 0.3),
  });
  cursorY -= titleSize + 18;

  const intro = `Certifica-se que ${memberName} e membro do Apostolado de Garabandal.`;
  const introLines = wrapText(intro, width - margin * 2, fontRegular, 12);
  introLines.forEach((line) => {
    page.drawText(line, {
      x: margin,
      y: cursorY - 12,
      size: 12,
      font: fontRegular,
      color: rgb(0.2, 0.26, 0.38),
    });
    cursorY -= 16;
  });

  const memberLine = `Numero de socio: ${memberNumber}`;
  page.drawText(memberLine, {
    x: margin,
    y: cursorY - 14,
    size: 12,
    font: fontBold,
    color: rgb(0.12, 0.18, 0.3),
  });
  cursorY -= 28;

  const sectionTitle = 'Direitos do associado';
  page.drawText(sectionTitle, {
    x: margin,
    y: cursorY - 14,
    size: 13,
    font: fontBold,
    color: rgb(0.12, 0.18, 0.3),
  });
  cursorY -= 22;

  RIGHTS.forEach((item) => {
    const lines = wrapText(`- ${item}`, width - margin * 2, fontRegular, 11);
    lines.forEach((line) => {
      page.drawText(line, {
        x: margin,
        y: cursorY - 12,
        size: 11,
        font: fontRegular,
        color: rgb(0.24, 0.3, 0.4),
      });
      cursorY -= 14;
    });
  });

  cursorY -= 10;

  const dutiesTitle = 'Deveres do associado';
  page.drawText(dutiesTitle, {
    x: margin,
    y: cursorY - 14,
    size: 13,
    font: fontBold,
    color: rgb(0.12, 0.18, 0.3),
  });
  cursorY -= 22;

  DUTIES.forEach((item) => {
    const lines = wrapText(`- ${item}`, width - margin * 2, fontRegular, 11);
    lines.forEach((line) => {
      page.drawText(line, {
        x: margin,
        y: cursorY - 12,
        size: 11,
        font: fontRegular,
        color: rgb(0.24, 0.3, 0.4),
      });
      cursorY -= 14;
    });
  });

  cursorY -= 18;

  page.drawText(`Data: ${formatDatePt(issuedAt)}`, {
    x: margin,
    y: cursorY - 12,
    size: 11,
    font: fontRegular,
    color: rgb(0.3, 0.36, 0.46),
  });

  const signatureLabel = 'Assinatura do responsavel';
  const signatureWidth = fontRegular.widthOfTextAtSize(signatureLabel, 10);
  page.drawText(signatureLabel, {
    x: width - margin - signatureWidth,
    y: cursorY - 12,
    size: 10,
    font: fontRegular,
    color: rgb(0.45, 0.5, 0.6),
  });

  page.drawLine({
    start: { x: width - margin - 180, y: cursorY - 22 },
    end: { x: width - margin, y: cursorY - 22 },
    thickness: 1,
    color: rgb(0.8, 0.83, 0.88),
  });

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
};

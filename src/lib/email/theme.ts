/**
 * Tokens visuais dos emails — espelham o tema do site (src/app/globals.css, @theme):
 * o azul do botão "Tornar membro" (.btn-member) e a escala brand, ink, paper e line.
 * Mudar a aparência de todos os emails é mudar este ficheiro.
 *
 * Os clientes de email não suportam variáveis CSS, oklch nem gradientes de forma fiável,
 * por isso os valores são hex e o botão é uma cor sólida (com `bgcolor` para o Outlook).
 */
export const EMAIL_THEME = {
  // Azul da marca (site: --color-brand e escala)
  brand: '#3563e9',
  brand700: '#2b51c7',
  brand200: '#c3d3fb',
  brand50: '#eef3ff',

  // Neutros (site: ink, ink-soft, muted, line, paper)
  ink: '#0f1b33',
  inkSoft: '#1b2a4a',
  muted: '#5b6475',
  line: '#e2e7f0',
  paper: '#f4f6fa',
  white: '#ffffff',

  // Estados
  success: '#16a34a',
  successBg: '#f0fdf4',
  error: '#dc2626',
  errorBg: '#fef2f2',
  warning: '#b45309',
  warningBg: '#fffbeb',
  whatsapp: '#25d366',
} as const;

// O site usa Inter. Inter não está instalada nos clientes de email, por isso a pilha
// cai para a fonte de sistema mais próxima (Segoe UI no Windows, Helvetica/Arial no resto).
export const EMAIL_FONTS = {
  sans: "Inter, 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif",
  serif: "Inter, 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif",
} as const;

// Receita do botão principal (pílula, como .btn-member no site).
export const EMAIL_BUTTON = {
  radius: 999,
  shadow: '0 6px 18px -4px rgba(53,99,233,0.45)',
  paddingMd: '15px 32px',
  paddingLg: '19px 28px',
} as const;

export type EmailTheme = typeof EMAIL_THEME;

import type { ReactNode } from 'react';
import { pgFontVariables } from './fonts';

/**
 * Carrega as fontes da página da peregrinação (PT e EN) e define as variáveis
 * sem criar uma caixa no layout (display: contents). Só as rotas que usam este
 * componente descarregam estas fontes.
 */
export default function PilgrimageTypeScope({ children }: { children: ReactNode }) {
    return <div className={`${pgFontVariables} contents`}>{children}</div>;
}

import { Metadata } from 'next';
import MembershipClient from './MembershipClient';

export const metadata: Metadata = {
  title: 'Tornar-se Membro',
  description: 'Junte-se à família do Apostolado. Tenha acesso a conteúdos exclusivos e ajude a sustentar esta obra.',
};

export default function TornarMembroPage() {
  return <MembershipClient />;
}

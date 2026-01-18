import { Metadata } from 'next';
import StoreClient from './StoreClient';

export const metadata: Metadata = {
  title: 'Loja Oficial',
  description: 'Adquira terços, livros e artigos religiosos oficiais. Apoie a divulgação da mensagem de Garabandal.',
};

export default function LojaPage() {
  return <StoreClient />;
}

import { Geist } from 'next/font/google';

import AdminLayout from '../../../components/admin/AdminLayout';
import ContabilidadeView from '../../../components/admin/contabilidade/ContabilidadeView';
import '../../../components/admin/contabilidade/ledger.css';

// The Contabilidade module has its own typeface, separate from the rest of the admin.
const ledgerSans = Geist({ subsets: ['latin'], display: 'swap' });

export default function AdminContabilidadePage() {
  return (
    <AdminLayout title="Contabilidade">
      <div className={`${ledgerSans.className} antialiased [&_button:not(:disabled)]:cursor-pointer [&_[role=button]]:cursor-pointer [&_label:has(button)]:cursor-pointer`}>
        <ContabilidadeView />
      </div>
    </AdminLayout>
  );
}

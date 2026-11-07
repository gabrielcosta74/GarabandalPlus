import { Geist } from 'next/font/google';

import AdminLayout from '../../../components/admin/AdminLayout';
import FinancasView from '../../../components/admin/financas/FinancasView';

const financeSans = Geist({ subsets: ['latin'], display: 'swap', weight: ['300', '400', '500'] });

export default function AdminFinancasPage() {
  return (
    <AdminLayout title="Análise" hideHeader bare>
      <div className={financeSans.className}>
        <FinancasView />
      </div>
    </AdminLayout>
  );
}

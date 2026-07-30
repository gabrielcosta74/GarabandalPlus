import AdminLayout from '../../../components/admin/AdminLayout';
import FactptDashboard from '../../../components/admin/factpt/FactptDashboard';

export default function AdminFaturacaoPage() {
  return (
    <AdminLayout
      title="Faturação"
      description="Faturas emitidas e documentos que ainda precisam de atenção"
    >
      <FactptDashboard />
    </AdminLayout>
  );
}

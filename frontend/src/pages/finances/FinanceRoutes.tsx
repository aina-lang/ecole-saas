import { Routes, Route, Navigate } from 'react-router-dom'
import { FinanceDashboardPage } from './FinanceDashboardPage'
import { PaymentListPage } from './PaymentListPage'
import { PaymentDetailPage } from './PaymentDetailPage'
import { PaymentConfigPage } from './PaymentConfigPage'
import { FeeStructurePage } from './FeeStructurePage'

export function FinanceRoutes() {
  return (
    <Routes>
      <Route index element={<FinanceDashboardPage />} />
      <Route path="payments" element={<PaymentListPage />} />
      <Route path="payments/:id" element={<PaymentDetailPage />} />
      <Route path="config" element={<PaymentConfigPage />} />
      <Route path="fees" element={<FeeStructurePage />} />
      <Route path="*" element={<Navigate to="/finances" replace />} />
    </Routes>
  )
}

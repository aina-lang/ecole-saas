import { Routes, Route, Navigate } from 'react-router-dom'
import { FinanceDashboardPage } from './FinanceDashboardPage'
import { PaymentListPage } from './PaymentListPage'
import { FeeStructurePage } from './FeeStructurePage'
import { TeacherAttendancePage } from '@/pages/teachers/TeacherAttendancePage'
import { TeacherPayPage } from '@/pages/teachers/TeacherPayPage'
import { TeacherContractPage } from '@/pages/teachers/TeacherContractPage'

export function FinanceRoutes() {
  return (
    <Routes>
      <Route index element={<FinanceDashboardPage />} />
      <Route path="payments" element={<PaymentListPage />} />
      <Route path="fees" element={<FeeStructurePage />} />
      <Route path="teacher-attendance" element={<TeacherAttendancePage />} />
      <Route path="teacher-payments" element={<TeacherPayPage />} />
      <Route path="teacher-contracts" element={<TeacherContractPage />} />
      <Route path="*" element={<Navigate to="/finances" replace />} />
    </Routes>
  )
}

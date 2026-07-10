import { Routes, Route, Navigate, NavLink, Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { TeacherAttendancePage } from './TeacherAttendancePage'
import { TeacherPayPage } from './TeacherPayPage'
import { TeacherContractPage } from './TeacherContractPage'

const tabs = [
  { label: 'Présences', to: '/teachers/attendance' },
  { label: 'Paie', to: '/teachers/payments' },
  { label: 'Contrats', to: '/teachers/contracts' }
]

function TeacherLayout() {
  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              cn(
                '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )
            }
          >
            {t.label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  )
}

export function TeacherRoutes() {
  return (
    <Routes>
      <Route element={<TeacherLayout />}>
        <Route index element={<Navigate to="/teachers/attendance" replace />} />
        <Route path="attendance" element={<TeacherAttendancePage />} />
        <Route path="payments" element={<TeacherPayPage />} />
        <Route path="contracts" element={<TeacherContractPage />} />
        <Route path="*" element={<Navigate to="/teachers/attendance" replace />} />
      </Route>
    </Routes>
  )
}

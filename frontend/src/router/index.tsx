import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoginPage } from '@/pages/auth/LoginPage'
// import { OnboardingPage } from '@/pages/onboarding/OnboardingPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { SyncPage } from '@/pages/sync/SyncPage'
import { StudentRoutes } from '@/pages/students/StudentRoutes'
import { ClassRoutes } from '@/pages/classes/ClassRoutes'
import { GradeRoutes } from '@/pages/grades/GradeRoutes'
import { AttendanceRoutes } from '@/pages/attendance/AttendanceRoutes'
import { CommunicationRoutes } from '@/pages/communications/CommunicationRoutes'
import { FinanceRoutes } from '@/pages/finances/FinanceRoutes'
import { AdminRoutes } from '@/pages/administration/AdminRoutes'
import { OnboardingPage } from '@/pages/onboarding/OnboardingPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const onboardingCompleted = useAuthStore((s) => s.onboardingCompleted)

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (!onboardingCompleted) {
    return <Navigate to="/onboarding" replace />
  }

  return <>{children}</>
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <AppLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="students/*" element={<StudentRoutes />} />
        <Route path="classes/*" element={<ClassRoutes />} />
        <Route path="grades/*" element={<GradeRoutes />} />
        <Route path="attendance/*" element={<AttendanceRoutes />} />
        <Route path="communications/*" element={<CommunicationRoutes />} />
        <Route path="finances/*" element={<FinanceRoutes />} />
        <Route path="administration/*" element={<AdminRoutes />} />
        <Route path="sync" element={<SyncPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

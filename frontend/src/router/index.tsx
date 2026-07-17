import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
// import { OnboardingPage } from '@/pages/onboarding/OnboardingPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { SyncPage } from '@/pages/sync/SyncPage'
import { StudentRoutes } from '@/pages/students/StudentRoutes'
import { ParentsPage } from '@/pages/students/ParentsPage'
import { ParentFormPage } from '@/pages/students/ParentFormPage'
import { ParentDetailPage } from '@/pages/students/ParentDetailPage'
import { ParentEditPage } from '@/pages/students/ParentEditPage'
import { ClassRoutes } from '@/pages/classes/ClassRoutes'
import { GradeRoutes } from '@/pages/grades/GradeRoutes'
import { SubjectsPage } from '@/pages/subjects/SubjectsPage'
import { TimetablePage } from '@/pages/timetable/TimetablePage'
import { AttendanceRoutes } from '@/pages/attendance/AttendanceRoutes'
import { CommunicationRoutes } from '@/pages/communications/CommunicationRoutes'
import { FinanceRoutes } from '@/pages/finances/FinanceRoutes'
import { AdminRoutes } from '@/pages/administration/AdminRoutes'
import { TeacherRoutes } from '@/pages/teachers/TeacherRoutes'
import { OnboardingPage } from '@/pages/onboarding/OnboardingPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hydrated = useAuthStore((s) => s.hydrated)
  const onboardingCompleted = useAuthStore((s) => s.onboardingCompleted)

  if (!hydrated) {
    return <div className="flex h-screen items-center justify-center text-muted-foreground">Chargement...</div>
  }

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
      <Route path="/register" element={<RegisterPage />} />
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
        <Route path="parents" element={<ParentsPage />} />
        <Route path="parents/new" element={<ParentFormPage />} />
        <Route path="parents/:id/edit" element={<ParentEditPage />} />
        <Route path="parents/:id" element={<ParentDetailPage />} />
        <Route path="classes/*" element={<ClassRoutes />} />
        <Route path="grades/*" element={<GradeRoutes />} />
        <Route path="subjects" element={<SubjectsPage />} />
        <Route path="timetable" element={<TimetablePage />} />
        <Route path="attendance/*" element={<AttendanceRoutes />} />
        <Route path="communications/*" element={<CommunicationRoutes />} />
        <Route path="finances/*" element={<FinanceRoutes />} />
        <Route path="teachers/*" element={<TeacherRoutes />} />
        <Route path="administration/*" element={<AdminRoutes />} />
        <Route path="sync" element={<SyncPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

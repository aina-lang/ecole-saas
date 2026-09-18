import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'
import { AppLayout } from '@/components/layout/AppLayout'
import { TitleBar } from '@/components/layout/TitleBar'
import { LoginPage } from '@/pages/auth/LoginPage'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage'
import { ChangePasswordPage } from '@/pages/auth/ChangePasswordPage'
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
import { AdminRoutes } from '@/pages/administration/AdminRoutes'
import { FinanceRoutes } from '@/pages/finances/FinanceRoutes'
import { TeacherRoutes } from '@/pages/teachers/TeacherRoutes'
import { OnboardingPage } from '@/pages/onboarding/OnboardingPage'

// Pages sans barre latérale : la barre de titre coiffe toute la fenêtre.
function PublicLayout() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TitleBar />
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  )
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hydrated = useAuthStore((s) => s.hydrated)
  const onboardingCompleted = useAuthStore((s) => s.onboardingCompleted)
  const mustChangePassword = useAuthStore((s) => !!s.user?.mustChangePassword)
  const location = useLocation()

  if (!hydrated) {
    return <div className="flex h-screen items-center justify-center text-muted-foreground">Chargement...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Mot de passe temporaire remis par le support : on impose son changement
  // avant tout accès (la page reste dans AppLayout pour garder la barre).
  if (mustChangePassword && location.pathname !== '/account/password') {
    return <Navigate to="/account/password" replace />
  }

  if (!onboardingCompleted && !mustChangePassword) {
    return <Navigate to="/onboarding" replace />
  }

  return <>{children}</>
}

// Un seul établissement par ordinateur : une fois ce poste rattaché, la
// création n'est plus accessible, même en tapant l'adresse de la page. Le
// serveur applique la même règle (auth.service.registerTenant), y compris
// après une réinstallation qui aurait effacé cette information locale.
function RegisterRoute() {
  const hydrated = useAuthStore((s) => s.hydrated)
  const deviceLinked = useAuthStore((s) => s.deviceLinked || !!s.lockedSession)
  if (!hydrated) return null
  if (deviceLinked) return <Navigate to="/login" replace />
  return <RegisterPage />
}

export function AppRouter() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterRoute />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
      </Route>
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
        <Route path="account/password" element={<ChangePasswordPage />} />
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
        <Route path="teachers/*" element={<TeacherRoutes />} />
        <Route path="administration/*" element={<AdminRoutes />} />
        <Route path="finances/*" element={<FinanceRoutes />} />
        <Route path="sync" element={<SyncPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

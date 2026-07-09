import { Routes, Route, Navigate } from 'react-router-dom'
import { AttendancePage } from './AttendancePage'
import { AttendanceStatsPage } from './AttendanceStatsPage'

export function AttendanceRoutes() {
  return (
    <Routes>
      <Route index element={<AttendancePage />} />
      <Route path="stats" element={<AttendanceStatsPage />} />
      <Route path="*" element={<Navigate to="/attendance" replace />} />
    </Routes>
  )
}

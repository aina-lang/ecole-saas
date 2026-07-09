import { Routes, Route, Navigate } from 'react-router-dom'
import { StudentListPage } from './StudentListPage'
import { StudentFormPage } from './StudentFormPage'
import { StudentDetailPage } from './StudentDetailPage'

export function StudentRoutes() {
  return (
    <Routes>
      <Route index element={<StudentListPage />} />
      <Route path="new" element={<StudentFormPage />} />
      <Route path=":id" element={<StudentDetailPage />} />
      <Route path=":id/edit" element={<StudentFormPage />} />
      <Route path="*" element={<Navigate to="/students" replace />} />
    </Routes>
  )
}

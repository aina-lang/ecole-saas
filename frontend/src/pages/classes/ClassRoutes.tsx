import { Routes, Route, Navigate } from 'react-router-dom'
import { ClassListPage } from './ClassListPage'
import { ClassFormPage } from './ClassFormPage'
import { ClassDetailPage } from './ClassDetailPage'

export function ClassRoutes() {
  return (
    <Routes>
      <Route index element={<ClassListPage />} />
      <Route path="new" element={<ClassFormPage />} />
      <Route path=":id" element={<ClassDetailPage />} />
      <Route path=":id/edit" element={<ClassFormPage />} />
      <Route path="*" element={<Navigate to="/classes" replace />} />
    </Routes>
  )
}

import { Routes, Route, Navigate } from 'react-router-dom'
import { GradeListPage } from './GradeListPage'
import { GradeEntryPage } from './GradeEntryPage'

export function GradeRoutes() {
  return (
    <Routes>
      <Route index element={<GradeListPage />} />
      <Route path="entry" element={<GradeEntryPage />} />
      <Route
        path="student/:id"
        element={<div className="text-muted-foreground">Bulletin de l'élève</div>}
      />
      <Route path="*" element={<Navigate to="/grades" replace />} />
    </Routes>
  )
}

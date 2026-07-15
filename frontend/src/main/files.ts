import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

const UPLOAD_DIR = join(app.getPath('userData'), 'uploads')
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true })

interface FileEntry {
  id: string
  entity_type: string
  entity_id: string
  field_name: string
  local_path: string
  original_name: string
  mime_type: string
}

const files = new Map<string, FileEntry>()

export function saveFileLocally(
  buffer: Buffer,
  entityType: string,
  entityId: string,
  fieldName: string,
  originalName: string,
  mimeType: string
) {
  const id = `${entityType}_${entityId}_${fieldName}_${Date.now()}`
  const ext = originalName.split('.').pop() || 'bin'
  const localPath = join(UPLOAD_DIR, `${id}.${ext}`)
  writeFileSync(localPath, buffer)

  const entry: FileEntry = {
    id,
    entity_type: entityType,
    entity_id: entityId,
    field_name: fieldName,
    local_path: localPath,
    original_name: originalName,
    mime_type: mimeType,
  }
  files.set(id, entry)
  return entry
}

export function getFileUploadCount(): number {
  return files.size
}

export function getFileUploadByEntity(entityType: string, entityId: string, fieldName: string): FileEntry | undefined {
  return Array.from(files.values()).find(
    (f) => f.entity_type === entityType && f.entity_id === entityId && f.field_name === fieldName
  )
}

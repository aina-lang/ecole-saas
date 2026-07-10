import { Button } from '@/components/ui/button'

export const rolePermissions: Record<string, string[]> = {
  ADMIN: [
    'Gestion complète des utilisateurs',
    'Configuration de l\'établissement',
    'Accès à tous les modules',
    'Gestion des rôles et permissions',
    'Consultation des journaux d\'audit'
  ],
  TEACHER: [
    'Saisie des notes',
    'Gestion des présences',
    'Consultation des élèves',
    'Communication avec les parents',
    'Emploi du temps'
  ],
  SECRETARY: [
    'Gestion des inscriptions',
    'Gestion des dossiers élèves',
    'Gestion des paiements',
    'Planning et emploi du temps',
    'Communications administratives'
  ],
  PARENT: [
    'Consultation des notes',
    'Suivi des présences',
    'Paiements en ligne',
    'Communication avec les enseignants',
    'Informations scolaires'
  ]
}

interface Option {
  id: string
  name: string
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder
}: {
  options: Option[]
  selected: string[]
  onChange: (next: string[]) => void
  placeholder: string
}) {
  if (!options.length) {
    return <p className="text-xs text-muted-foreground">Aucune option disponible.</p>
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt.id)
        return (
          <button
            type="button"
            key={opt.id}
            onClick={() =>
              onChange(active ? selected.filter((i) => i !== opt.id) : [...selected, opt.id])
            }
            className={
              'rounded-full border px-3 py-1 text-xs transition-colors ' +
              (active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent')
            }
          >
            {opt.name}
          </button>
        )
      })}
      {!selected.length && (
        <span className="text-xs text-muted-foreground">{placeholder}</span>
      )}
    </div>
  )
}

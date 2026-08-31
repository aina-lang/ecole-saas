import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { saveEntity, getEntityById } from '@/lib/db/pouchdb-compat'
import { EVALUATION_TYPES, EVALUATION_TYPE_LABELS } from '@/lib/evaluation-types'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { FormSection } from '@/components/layout/page'

// Le coefficient par matière se règle désormais uniquement depuis Matières
// (chaque fiche matière a son propre champ Coefficient) — l'ancien onglet
// "Coefficients" ici en était une copie qui pouvait diverger de la valeur
// réelle utilisée pour le calcul des moyennes.

interface GradeConfig {
  includedTypes: string[]
  examBlancIsolated: boolean
}

const CONFIG_DOC_ID = 'grade_config'

const DEFAULT_CONFIG: GradeConfig = {
  includedTypes: EVALUATION_TYPES.filter((t) => t !== 'examen_blanc'),
  examBlancIsolated: true,
}

const RULES = [
  { condition: 'Moyenne ≥ 10,00 / 20', result: 'Admis', sub: 'passe en classe supérieure' },
  { condition: '9,50 ≤ Moyenne < 10,00', result: 'À délibérer', sub: 'conseil des professeurs' },
  { condition: 'Moyenne < 9,50', result: 'Redoublant', sub: 'redouble la classe' },
]

export function GradeAveragingConfig() {
  const queryClient = useQueryClient()

  const [gradeConfig, setGradeConfig] = useState<GradeConfig>(DEFAULT_CONFIG)
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [savingConfig, setSavingConfig] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const doc = await getEntityById<any>('GradeConfig' as any, CONFIG_DOC_ID)
        if (doc?.includedTypes) {
          setGradeConfig({ includedTypes: doc.includedTypes, examBlancIsolated: doc.examBlancIsolated ?? true })
        }
      } catch {
        // use defaults
      } finally {
        setLoadingConfig(false)
      }
    })()
  }, [])

  async function handleToggleType(type: string, checked: boolean) {
    const next = checked
      ? [...gradeConfig.includedTypes, type]
      : gradeConfig.includedTypes.filter((t) => t !== type)
    const config: GradeConfig = {
      ...gradeConfig,
      includedTypes: next,
      examBlancIsolated: type === 'examen_blanc' ? checked : gradeConfig.examBlancIsolated,
    }
    setGradeConfig(config)
    setSavingConfig(true)
    try {
      await saveEntity('GradeConfig' as any, { id: CONFIG_DOC_ID, ...config })
      queryClient.invalidateQueries({ queryKey: ['grade-config'] })
    } catch {
      toast.error('Erreur lors de l\'enregistrement de la configuration')
    } finally {
      setSavingConfig(false)
    }
  }

  async function handleToggleExamBlancIsolated(checked: boolean) {
    const config: GradeConfig = { ...gradeConfig, examBlancIsolated: checked }
    setGradeConfig(config)
    setSavingConfig(true)
    try {
      await saveEntity('GradeConfig' as any, { id: CONFIG_DOC_ID, ...config })
      queryClient.invalidateQueries({ queryKey: ['grade-config'] })
    } catch {
      toast.error('Erreur lors de l\'enregistrement de la configuration')
    } finally {
      setSavingConfig(false)
    }
  }

  if (loadingConfig) {
    return <p className="text-sm text-muted-foreground">Chargement...</p>
  }

  return (
    <div className="space-y-6">
      <FormSection
        title="Types d'évaluation inclus"
        description="Activer ou désactiver chaque type d'évaluation pour le calcul de la moyenne générale. Les changements sont enregistrés automatiquement."
        columns={1}
      >
        <div className="rounded-lg border">
          <div className="divide-y">
            {EVALUATION_TYPES.map((type) => {
              const isIncluded = gradeConfig.includedTypes.includes(type)
              return (
                <div
                  key={type}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`switch-${type}`} className="cursor-pointer font-medium">
                      {EVALUATION_TYPE_LABELS[type]}
                    </Label>
                    {type === 'examen_blanc' && (
                      <Badge variant="secondary">Isolé</Badge>
                    )}
                  </div>
                  <Switch
                    id={`switch-${type}`}
                    checked={isIncluded}
                    onCheckedChange={(checked) => handleToggleType(type, checked)}
                    disabled={savingConfig}
                  />
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border px-4 py-3">
          <div className="space-y-0.5">
            <Label htmlFor="switch-exam-blanc-isolated" className="cursor-pointer font-medium">
              Examens Blancs isolés
            </Label>
            <p className="text-sm text-muted-foreground">
              Les examens blancs génèrent des rapports indépendants de la moyenne générale
            </p>
          </div>
          <Switch
            id="switch-exam-blanc-isolated"
            checked={gradeConfig.examBlancIsolated}
            onCheckedChange={handleToggleExamBlancIsolated}
            disabled={savingConfig}
          />
        </div>
      </FormSection>

      <FormSection
        title="Règles de promotion"
        description="Seuils utilisés pour déterminer le passage en classe supérieure"
        columns={1}
      >
        <div className="rounded-lg border divide-y">
          {RULES.map((rule, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium">{rule.condition}</p>
                <p className="text-xs text-muted-foreground">{rule.sub}</p>
              </div>
              <Badge
                variant={
                  i === 0 ? 'default' : i === 1 ? 'secondary' : 'destructive'
                }
              >
                {rule.result}
              </Badge>
            </div>
          ))}
        </div>
      </FormSection>
    </div>
  )
}

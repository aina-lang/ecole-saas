import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useLocalQuery } from '@/lib/db/hooks'
import { saveEntity } from '@/lib/db/pouchdb-compat'
import client, { extractErrorMessage } from '@/api/client'
import { CredentialsDialog, type Credentials } from '@/components/credentials-dialog'
import type { Teacher } from '@/types'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ReloadIcon, CheckIcon } from '@radix-ui/react-icons'
import { PageHeader, FormShell, FormSection } from '@/components/layout/page'

export function TeacherFormPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { id } = useParams()
  const isEdit = !!id

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phones, setPhones] = useState<string[]>([])
  const [phoneInput, setPhoneInput] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([])
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([])
  const [credentials, setCredentials] = useState<Credentials | null>(null)

  const { data: classesRaw, loading: loadingClasses } = useLocalQuery<{ id: string; name: string; level?: string | null; deletedAt?: string | null }>('Class')
  const { data: subjectsRaw, loading: loadingSubjects } = useLocalQuery<{ id: string; name: string; level?: string | null; code?: string | null; deletedAt?: string | null }>('Subject')
  const { data: levels } = useLocalQuery<{ id: string; name: string; sortOrder?: number }>('Level')

  // Classes triées par niveau (ordre pédagogique) puis par nom.
  const levelOrder = new Map((levels ?? []).map((l) => [l.name, l.sortOrder ?? 0]))
  const classes = (classesRaw ?? [])
    .filter((c) => !c.deletedAt)
    .sort((a, b) => (levelOrder.get(a.level ?? '') ?? 99) - (levelOrder.get(b.level ?? '') ?? 99) || a.name.localeCompare(b.name))
  // Matières groupées par niveau ; quand des classes sont cochées, on ne
  // propose que les matières de leurs niveaux (une matière « Malagasy »
  // existe par niveau : sans le niveau, la liste était illisible).
  const selectedLevels = new Set(classes.filter((c) => selectedClassIds.includes(c.id)).map((c) => c.level ?? ''))
  const subjects = (subjectsRaw ?? []).filter((s) => !s.deletedAt)
  const subjectGroups = Array.from(
    subjects.reduce((m, s) => { const k = s.level ?? 'Sans niveau'; if (!m.has(k)) m.set(k, []); m.get(k)!.push(s); return m }, new Map<string, typeof subjects>())
  )
    .filter(([lvl]) => selectedLevels.size === 0 || selectedLevels.has(lvl))
    .sort((a, b) => (levelOrder.get(a[0]) ?? 99) - (levelOrder.get(b[0]) ?? 99))
    .map(([lvl, list]) => [lvl, [...list].sort((a, b) => a.name.localeCompare(b.name))] as const)
  const { data: allTeachers } = useLocalQuery<Teacher>('Teacher')

  const existingTeacher = isEdit ? allTeachers?.find((t) => t.id === id) : null

  useEffect(() => {
    if (isEdit && existingTeacher && !firstName) {
      const t = existingTeacher as Teacher & Record<string, any>
      setFirstName(t.user?.firstName ?? t.user_firstName ?? '')
      setLastName(t.user?.lastName ?? t.user_lastName ?? '')
      setEmail(t.user?.email ?? t.user_email ?? '')
      setSpecialty(t.specialty ?? '')
      if (t.classIds) setSelectedClassIds(t.classIds)
      if (t.subjectIds) setSelectedSubjectIds(t.subjectIds)
      const tPhones: string[] = []
      for (let i = 0; i < 3; i++) {
        const v = t[`user_phone_${i}`]
        if (v) tPhones.push(v)
      }
      if (tPhones.length) setPhones(tPhones)
    }
  }, [existingTeacher, isEdit])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isEdit && existingTeacher) {
        const t = existingTeacher as Teacher & Record<string, any>
        const userIdToUpdate = t.userId
        // Mettre à jour les champs plats du Teacher
        await saveEntity('Teacher', {
          id: existingTeacher.id,
          specialty,
          classIds: selectedClassIds,
          subjectIds: selectedSubjectIds,
          user_firstName: firstName,
          user_lastName: lastName,
          user_email: email || null,
          ...phones.reduce((acc, p, i) => ({ ...acc, [`user_phone_${i}`]: p }), {} as Record<string, string>),
        })
        // Mettre à jour le User associé
        if (userIdToUpdate) {
          await saveEntity('User', {
            id: userIdToUpdate,
            firstName,
            lastName,
            email: email || null,
            user_firstName: firstName,
            user_lastName: lastName,
            user_email: email || null,
          })
        }
        return null
      }
      // EN LIGNE avec un e-mail : le serveur crée le compte + la fiche, génère
      // un mot de passe temporaire (affiché ici, envoyé par e-mail à
      // l'enseignant). Le mot de passe ne transite jamais par un document
      // synchronisé. Hors ligne : création locale, mot de passe à définir plus tard.
      let serverTeacher: { id: string; userId: string; temporaryPassword?: string | null; credentialsEmailed?: boolean } | null = null
      if (email.trim() && navigator.onLine) {
        try {
          const { data } = await client.post('/teachers', {
            email: email.trim().toLowerCase(),
            firstName: firstName || undefined,
            lastName,
            phones,
            specialty: specialty || undefined,
            classIds: selectedClassIds,
            subjectIds: selectedSubjectIds,
          })
          serverTeacher = data
        } catch (err: any) {
          if (err?.response) throw err // refus du serveur (e-mail déjà pris…) : on remonte
        }
      }
      const teacherId = serverTeacher?.id ?? crypto.randomUUID()
      const userId = serverTeacher?.userId ?? crypto.randomUUID()
      const credentials: Credentials | null = serverTeacher?.temporaryPassword
        ? { name: `${firstName} ${lastName}`.trim(), email: email.trim().toLowerCase(), password: serverTeacher.temporaryPassword, emailed: !!serverTeacher.credentialsEmailed }
        : null
      const tenantId = localStorage.getItem('tenantId')
      const userPhones: { _id: string; userId: string; value: string; sortOrder: number }[] = phones.map(
        (v, i) => ({ _id: crypto.randomUUID(), userId, value: v, sortOrder: i + 1 })
      )
      await saveEntity('User', {
        _id: userId,
        id: userId,
        firstName,
        lastName,
        email: email || null,
        role: 'TEACHER',
        tenantId,
        isActive: true,
        // Pas de mot de passe dans le document synchronisé (il partirait en
        // clair dans CouchDB) — les identifiants se définissent en ligne.
        phones: userPhones,
        user_firstName: firstName,
        user_lastName: lastName,
        user_email: email || null,
      })
      await saveEntity('Teacher', {
        id: teacherId,
        userId,
        specialty: specialty || null,
        tenantId,
        classIds: selectedClassIds,
        subjectIds: selectedSubjectIds,
        // Champs plats copies pour affichage direct dans TeacherListPage
        user_firstName: firstName,
        user_lastName: lastName,
        user_email: email || null,
        ...phones.reduce((acc, p, i) => ({ ...acc, [`user_phone_${i}`]: p }), {} as Record<string, string>),
      })
      return credentials
    },
    onSuccess: (creds) => {
      queryClient.invalidateQueries({ queryKey: ['teacher-list'] })
      if (creds) {
        setCredentials(creds)
        return
      }
      toast.success(isEdit ? 'Enseignant modifié' : 'Enseignant ajouté', isEdit ? undefined : {
        description: email.trim()
          ? 'Créé hors ligne : le mot de passe se définira en ligne (Gestion des utilisateurs, bouton clé).'
          : 'Sans e-mail, aucun accès n’a été généré : ajoutez un e-mail pour créer un compte de connexion.',
      })
      navigate('/teachers/list')
    },
    onError: (err) => toast.error(extractErrorMessage(err, "Erreur lors de l'enregistrement")),
  })

  function addPhone() {
    const trimmed = phoneInput.trim()
    if (trimmed && phones.length < 3 && !phones.includes(trimmed)) {
      setPhones((prev) => [...prev, trimmed])
      setPhoneInput('')
    }
  }

  function removePhone(index: number) {
    setPhones((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSubmit() {
    if (!lastName.trim()) {
      toast.error('Le nom de famille est requis')
      return
    }
    saveMutation.mutate()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        backTo="/teachers/list"
        title={isEdit ? 'Modifier l\'enseignant' : 'Ajouter un enseignant'}
        description={isEdit ? 'Modifier les informations de l\'enseignant' : 'Créer un nouveau compte enseignant'}
      />

      <FormShell
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => navigate('/teachers/list')}>
              Annuler
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <>
                  <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : isEdit ? 'Enregistrer' : 'Créer l\'enseignant'}
            </Button>
          </>
        }
      >
        <FormSection
          title="Informations personnelles"
          description="Identité et adresse email du compte enseignant"
          columns={2}
        >
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Prénom</label>
            <Input
              placeholder="Prénom"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Nom de famille <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder="Nom de famille"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email</label>
            <Input
              type="email"
              placeholder="email@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {/* Pas de champ mot de passe : ce formulaire écrit un document
              local synchronisé — un mot de passe y serait répliqué en clair.
              Les identifiants de connexion se définissent en ligne. */}
          <p className="text-xs text-muted-foreground sm:col-span-2">
            En ligne, un mot de passe temporaire est généré à la création, affiché
            ici et envoyé par e-mail à l'enseignant (à changer à sa première
            connexion). Hors ligne, il se définira plus tard via Gestion des
            utilisateurs.
          </p>
        </FormSection>

        <FormSection title="Téléphones" description="Jusqu'à 3 numéros de contact" columns={1}>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Téléphone(s) <span className="text-xs text-muted-foreground">(max 3)</span>
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="+261 ..."
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPhone())}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={addPhone}
                disabled={phones.length >= 3 || !phoneInput.trim()}
              >
                Ajouter
              </Button>
            </div>
            {phones.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {phones.map((phone, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs"
                  >
                    {phone}
                    <button
                      type="button"
                      onClick={() => removePhone(i)}
                      className="ml-1 text-muted-foreground hover:text-foreground"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </FormSection>

        <FormSection title="Spécialité" columns={2}>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Spécialité</label>
            <Input
              placeholder="Ex: Mathématiques"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
            />
          </div>
        </FormSection>

        <FormSection
          title="Classes et matières"
          description="Classes affectées et matières enseignées"
          columns={2}
        >
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Classes affectées</label>
            <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-lg border p-2">
              {classes.map((cls) => {
                const checked = selectedClassIds.includes(cls.id)
                return (
                  <label
                    key={cls.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
                      checked ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-secondary'
                    )}
                  >
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={checked}
                      onChange={() => {
                        setSelectedClassIds((prev) =>
                          checked ? prev.filter((c) => c !== cls.id) : [...prev, cls.id]
                        )
                      }}
                    />
                    {checked && <CheckIcon className="h-3.5 w-3.5" />}{cls.name}
                    {cls.level && <span className="text-[11px] font-normal text-muted-foreground">{cls.level}</span>}
                  </label>
                )
              })}
              {loadingClasses && <span className="text-sm text-muted-foreground">Chargement...</span>}
            </div>
            {selectedClassIds.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {selectedClassIds.length} classe(s) sélectionnée(s)
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Matières enseignées</label>
            <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg border p-2">
              {subjectGroups.length === 0 && !loadingSubjects && (
                <p className="px-1 text-sm text-muted-foreground">
                  {subjects.length === 0 ? 'Aucune matière définie.' : 'Aucune matière pour les niveaux des classes cochées.'}
                </p>
              )}
              {subjectGroups.map(([lvl, list]) => (
                <div key={lvl}>
                  <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{lvl}</p>
                  <div className="flex flex-wrap gap-2">
                    {list.map((subj) => {
                      const checked = selectedSubjectIds.includes(subj.id)
                      return (
                        <label
                          key={subj.id}
                          className={cn(
                            'flex cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
                            checked ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-secondary'
                          )}
                        >
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={checked}
                            onChange={() => {
                              setSelectedSubjectIds((prev) =>
                                checked ? prev.filter((s) => s !== subj.id) : [...prev, subj.id]
                              )
                            }}
                          />
                          {checked && <CheckIcon className="h-3.5 w-3.5" />}{subj.name}
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
              {loadingSubjects && <span className="text-sm text-muted-foreground">Chargement...</span>}
            </div>
            {selectedSubjectIds.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {selectedSubjectIds.length} matière(s) sélectionnée(s)
              </p>
            )}
          </div>
        </FormSection>
      </FormShell>
      <CredentialsDialog credentials={credentials} onClose={() => { setCredentials(null); navigate('/teachers/list') }} />
    </div>
  )
}

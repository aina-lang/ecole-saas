import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useLocalQuery } from '@/lib/db/hooks'
import { saveEntity, queryEntities } from '@/lib/db/pouchdb-compat'
import type { Teacher } from '@/types'
import { cn } from '@/lib/utils'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ReloadIcon, ArrowLeftIcon } from '@radix-ui/react-icons'

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
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [specialty, setSpecialty] = useState('')
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([])
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([])

  const { data: classes, loading: loadingClasses } = useLocalQuery<{ id: string; name: string }>('Class')
  const { data: subjects, loading: loadingSubjects } = useLocalQuery<{ id: string; name: string }>('Subject')
  const { data: allTeachers, loading: loadingTeachers } = useLocalQuery<Teacher>('Teacher')

  const existingTeacher = isEdit ? allTeachers?.find((t) => t.id === id) : null

  useEffect(() => {
    if (isEdit && existingTeacher && !firstName) {
      const t = existingTeacher as Teacher & Record<string, any>
      setFirstName(t.user?.firstName ?? t.user_firstName ?? '')
      setLastName(t.user?.lastName ?? t.user_lastName ?? '')
      setEmail(t.user?.email ?? t.user_email ?? '')
      setSpecialty(t.specialty ?? '')
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
        return
      }
      const teacherId = crypto.randomUUID()
      const userId = crypto.randomUUID()
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
        passwordHash: password || Math.random().toString(36).slice(2, 10) + 'A1!',
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-list'] })
      toast.success(isEdit ? 'Enseignant modifié' : 'Enseignant ajouté')
      navigate('/teachers/list')
    },
    onError: () => toast.error('Erreur lors de l\'enregistrement'),
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

  const isLoading = isEdit && !existingTeacher

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/teachers/list')}>
          <ArrowLeftIcon className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {isEdit ? 'Modifier l\'enseignant' : 'Ajouter un enseignant'}
          </h2>
          <p className="text-muted-foreground">
            {isEdit ? 'Modifier les informations de l\'enseignant' : 'Créer un nouveau compte enseignant'}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations personnelles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
                Nom de famille <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="Nom de famille"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
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

          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Téléphone <span className="text-xs text-muted-foreground">(max 3)</span>
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="+261 ..."
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPhone())}
              />
              <Button
                variant="secondary"
                onClick={addPhone}
                disabled={phones.length >= 3 || !phoneInput.trim()}
              >
                Ajouter
              </Button>
            </div>
            {phones.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {phones.map((phone, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs"
                  >
                    {phone}
                    <button
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

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Mot de passe</label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-20"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? 'Masquer' : 'Afficher'}
              </Button>
            </div>
            {!isEdit && !password && (
              <p className="text-xs text-muted-foreground">
                Si vide, un mot de passe aléatoire sera généré.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informations enseignant</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Spécialité</label>
            <Input
              placeholder="Ex: Mathématiques"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Classes affectées</label>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto rounded-lg border p-2">
              {(classes ?? []).map((cls) => {
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
                    {checked ? '✓ ' : ''}{cls.name}
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
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto rounded-lg border p-2">
              {(subjects ?? []).map((subj) => {
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
                    {checked ? '✓ ' : ''}{subj.name}
                  </label>
                )
              })}
              {loadingSubjects && <span className="text-sm text-muted-foreground">Chargement...</span>}
            </div>
            {selectedSubjectIds.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {selectedSubjectIds.length} matière(s) sélectionnée(s)
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? (
            <>
              <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
              Enregistrement...
            </>
          ) : isEdit ? 'Enregistrer' : 'Créer l\'enseignant'}
        </Button>
        <Button variant="outline" onClick={() => navigate('/teachers/list')}>
          Annuler
        </Button>
      </div>
    </div>
  )
}
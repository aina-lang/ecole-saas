import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { KeyRound, Mail, Phone, BookOpen, School, CalendarDays } from 'lucide-react'
import { getEntityById, queryEntities } from '@/lib/db/pouchdb-compat'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Pencil2Icon } from '@radix-ui/react-icons'
import { PageHeader, DetailHeader, InfoGrid, EmptyState } from '@/components/layout/page'
import { StudentPhoto } from '@/components/ui/student-photo'
import { SetPasswordDialog } from '@/components/set-password-dialog'
import { DAYS } from '@/lib/days'

const toMinutesOfDay = (t: string) => { const [h, m] = String(t ?? '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0) }
import { cn } from '@/lib/utils'

export function TeacherDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [passwordOpen, setPasswordOpen] = useState(false)

  const { data: teacher, isLoading } = useQuery({
    queryKey: ['teacher', id],
    enabled: !!id,
    queryFn: async () => getEntityById<any>('Teacher', id!),
  })
  const { data: userDoc } = useQuery({
    queryKey: ['teacher-user', teacher?.userId],
    enabled: !!teacher?.userId,
    queryFn: async () => getEntityById<any>('User', teacher!.userId),
  })
  const { data: classes } = useQuery({ queryKey: ['classes-all'], queryFn: async () => queryEntities<any>('Class') })
  const { data: subjects } = useQuery({ queryKey: ['subjects-all'], queryFn: async () => queryEntities<any>('Subject') })
  const { data: slots } = useQuery({
    queryKey: ['teacher-slots', id],
    enabled: !!id,
    queryFn: async () => (await queryEntities<any>('TimetableSlot')).filter((s) => s.teacherId === id && !s.deletedAt && !s.isRecreation),
  })

  const classIds: string[] = teacher?.classIds ?? (teacher?.classes ?? []).map((c: any) => c.id) ?? []
  const subjectIds: string[] = teacher?.subjectIds ?? (teacher?.subjects ?? []).map((s: any) => s.id) ?? []
  const myClasses = (classes ?? []).filter((c) => !c.deletedAt && classIds.includes(c.id))
  const mySubjects = (subjects ?? []).filter((s) => !s.deletedAt && subjectIds.includes(s.id))
  const className = (cid: string) => (classes ?? []).find((c) => c.id === cid)?.name ?? '—'
  const subjectName = (sid?: string | null) => (subjects ?? []).find((s) => s.id === sid)?.name ?? 'Cours'

  const byDay = useMemo(() => {
    const m = new Map<number, any[]>()
    for (const s of slots ?? []) {
      if (!m.has(s.dayOfWeek)) m.set(s.dayOfWeek, [])
      m.get(s.dayOfWeek)!.push(s)
    }
    for (const l of m.values()) l.sort((a, b) => toMinutesOfDay(a.startTime) - toMinutesOfDay(b.startTime))
    return m
  }, [slots])
  const weeklyHours = (slots ?? []).reduce((n, s) => n + (toMinutesOfDay(s.endTime) - toMinutesOfDay(s.startTime)), 0) / 60

  if (isLoading) return <div className="flex h-48 items-center justify-center text-muted-foreground">Chargement...</div>
  if (!teacher) {
    return (
      <EmptyState title="Enseignant introuvable" action={<Button variant="outline" onClick={() => navigate('/teachers/list')}>Retour à la liste</Button>} />
    )
  }

  const firstName = teacher.user_firstName ?? teacher.user?.firstName ?? userDoc?.firstName ?? ''
  const lastName = teacher.user_lastName ?? teacher.user?.lastName ?? userDoc?.lastName ?? ''
  const email = teacher.user_email ?? teacher.user?.email ?? userDoc?.email ?? ''
  const phones: string[] = [0, 1, 2].map((i) => teacher[`user_phone_${i}`]).filter(Boolean)
  if (phones.length === 0 && Array.isArray(userDoc?.phones)) phones.push(...userDoc.phones.map((p: any) => p.value ?? p).filter(Boolean))
  const fullName = `${firstName} ${lastName}`.trim()
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
  const active = userDoc ? userDoc.isActive !== false : true

  return (
    <div className="space-y-6">
      <PageHeader
        backTo="/teachers/list"
        title="Fiche enseignant"
        actions={
          <>
            <Button variant="outline" onClick={() => setPasswordOpen(true)} disabled={!teacher.userId}>
              <KeyRound className="mr-2 h-4 w-4" />
              Mot de passe
            </Button>
            <Button onClick={() => navigate(`/teachers/${id}/edit`)}>
              <Pencil2Icon className="mr-2 h-4 w-4" />
              Modifier
            </Button>
          </>
        }
      />

      <DetailHeader
        avatar={<StudentPhoto src={userDoc?.photoUrl ?? teacher.photoUrl} alt={fullName} initials={initials} className="h-28 w-28 ring-4 ring-background shadow-md" entityId={teacher.userId} fallbackClassName="text-3xl" />}
        title={fullName || 'Enseignant'}
        subtitle={teacher.specialty || (mySubjects.length ? mySubjects.map((s) => s.name).join(', ') : 'Enseignant')}
        badges={<Badge variant={active ? 'default' : 'destructive'}>{active ? 'Actif' : 'Désactivé'}</Badge>}
        meta={
          <>
            {email && <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{email}</span>}
            {phones.map((p) => <span key={p} className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{p}</span>)}
            <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary"><School className="h-3.5 w-3.5" />{myClasses.length} classe{myClasses.length > 1 ? 's' : ''}</span>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs font-medium"><CalendarDays className="h-3.5 w-3.5" />{weeklyHours.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} h / semaine</span>
          </>
        }
      />

      <Tabs defaultValue="infos">
        <TabsList>
          <TabsTrigger value="infos">Infos</TabsTrigger>
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="timetable">Emploi du temps</TabsTrigger>
        </TabsList>

        <TabsContent value="infos" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-4"><CardTitle className="text-base">Identité</CardTitle></CardHeader>
            <CardContent>
              <InfoGrid columns={3} items={[
                { label: 'Nom', value: lastName },
                { label: 'Prénom', value: firstName },
                { label: 'Spécialité', value: teacher.specialty },
                { label: 'Email', value: email },
                { label: 'Téléphone(s)', value: phones.length ? phones.join(' · ') : null },
                { label: 'Compte', value: teacher.userId ? (active ? 'Actif' : 'Désactivé') : 'Aucun compte' },
              ]} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-4"><CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-4 w-4 text-muted-foreground" /> Matières enseignées</CardTitle></CardHeader>
            <CardContent>
              {mySubjects.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune matière affectée — <button type="button" className="text-primary hover:underline" onClick={() => navigate(`/teachers/${id}/edit`)}>modifier la fiche</button>.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {mySubjects.map((s) => <Badge key={s.id} variant="outline" className="border-transparent bg-accent px-2.5 py-1 text-accent-foreground">{s.name}</Badge>)}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="classes" className="mt-4">
          <Card>
            <CardHeader className="pb-4"><CardTitle className="text-base">Classes affectées</CardTitle></CardHeader>
            <CardContent>
              {myClasses.length === 0 ? (
                <EmptyState icon={<School className="h-5 w-5" />} title="Aucune classe affectée" description="Affectez des classes depuis le formulaire de l'enseignant." action={<Button variant="outline" onClick={() => navigate(`/teachers/${id}/edit`)}>Modifier la fiche</Button>} />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {myClasses.map((c) => {
                    const hours = (slots ?? []).filter((s) => s.classId === c.id).reduce((n, s) => n + (toMinutesOfDay(s.endTime) - toMinutesOfDay(s.startTime)), 0) / 60
                    return (
                      <button key={c.id} type="button" onClick={() => navigate(`/classes/${c.id}`)} className="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/60">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent text-sm font-semibold text-accent-foreground">{String(c.name).replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase()}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{c.name}</span>
                          <span className="block text-xs text-muted-foreground">{c.level ? `${c.level} · ` : ''}{hours ? `${hours.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} h / semaine` : 'Aucun créneau'}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timetable" className="mt-4">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Emploi du temps</CardTitle>
            </CardHeader>
            <CardContent>
              {(slots ?? []).length === 0 ? (
                <EmptyState icon={<CalendarDays className="h-5 w-5" />} title="Aucun créneau" description="Les cours de cet enseignant apparaîtront ici dès qu'ils seront placés dans l'emploi du temps des classes." />
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {DAYS.map((d) => {
                    const list = byDay.get(d.value) ?? []
                    if (list.length === 0) return null
                    return (
                      <div key={d.value} className="rounded-lg border">
                        <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
                          <span className="text-sm font-semibold">{d.label}</span>
                          <span className="text-xs text-muted-foreground">{list.length} cours</span>
                        </div>
                        <ul className="divide-y">
                          {list.map((s) => (
                            <li key={s.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                              <span className="w-24 shrink-0 tabular-nums text-muted-foreground">{s.startTime}–{s.endTime}</span>
                              <span className={cn('w-1 self-stretch rounded-full bg-primary/60')} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium">{subjectName(s.subjectId)}</span>
                                <span className="block truncate text-xs text-muted-foreground">{className(s.classId)}{s.room ? ` · ${s.room}` : ''}</span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <SetPasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} userId={teacher.userId ?? null} userName={fullName} />
    </div>
  )
}

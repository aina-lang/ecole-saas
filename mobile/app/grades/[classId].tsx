import { useMemo, useState } from 'react'
import { View, FlatList, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Users, Pencil } from 'lucide-react-native'
import { Text } from '@/components/ui/text'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScreenHeader, Empty, classColor, CARD_SHADOW } from '@/components/screen'
import { useClasses, useClassStudents, useClassSubjects, usePeriods, useGrades, useMe } from '@/lib/queries'
import { useAuth } from '@/lib/auth'
import { sendOrQueue } from '@/lib/outbox'
import { errorMessage } from '@/lib/api'
import { useThemeColors } from '@/lib/theme-colors'
import { useDialog } from '@/components/ui/dialog'
import { SearchBar } from '@/components/search-bar'

const TYPES = [
  { value: 'CONTROLE', label: 'Contrôle' }, { value: 'EXAM', label: 'Examen' }, { value: 'TEST', label: 'Interro' },
  { value: 'HOMEWORK', label: 'Devoir' }, { value: 'ORAL', label: 'Oral' },
]

function Chip({ active, label, onPress, light = false }: { active: boolean; label: string; onPress: () => void; light?: boolean }) {
  if (light) {
    return (
      <Pressable onPress={onPress} className={`rounded-full px-3 py-1.5 ${active ? 'bg-white' : 'bg-white/15'}`}>
        <Text className={`text-sm font-medium ${active ? 'text-slate-900' : 'text-white'}`}>{label}</Text>
      </Pressable>
    )
  }
  return (
    <Pressable onPress={onPress} className={`rounded-full border px-3 py-1.5 ${active ? 'border-primary bg-primary' : 'border-border bg-card'}`}>
      <Text className={`text-sm font-medium ${active ? 'text-primary-foreground' : ''}`}>{label}</Text>
    </Pressable>
  )
}

export default function GradesScreen() {
  const { classId } = useLocalSearchParams<{ classId: string }>()
  const router = useRouter()
  const colors = useThemeColors()
  const { toast, alert, confirm } = useDialog()
  const cls = useClasses().data?.find((c) => c.id === classId)
  const color = classColor(classId ?? '')
  const { data: students, isLoading } = useClassStudents(classId)
  const { data: allSubjects } = useClassSubjects(classId)
  const role = useAuth((s) => s.user?.role)
  const me = useMe().data
  // Enseignant : seulement ses matières (règle aussi appliquée par le serveur).
  // Si aucune de ses matières n'est référencée pour la classe, on propose
  // quand même celles de ses matières dont le niveau correspond à la classe.
  const mine = role === 'TEACHER' && me ? (allSubjects ?? []).filter((s) => me.subjects.some((ms) => ms.id === s.id)) : null
  const subjects = mine === null
    ? allSubjects
    : mine.length > 0
      ? mine
      : (me!.subjects as any[]).filter((ms) => !cls?.level || !ms.level || ms.level === cls.level)
  const { data: periodsData } = usePeriods()
  const [subjectId, setSubjectId] = useState<string>('')
  const [periodId, setPeriodId] = useState<string>('')
  const [type, setType] = useState('CONTROLE')
  const [label, setLabel] = useState('')
  const [maxValue, setMaxValue] = useState('20')
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [q, setQ] = useState('')
  const visible = useMemo(() => { const t = q.trim().toLowerCase(); return t ? (students ?? []).filter((s) => `${s.lastName} ${s.firstName ?? ''} ${s.registrationNumber ?? ''}`.toLowerCase().includes(t)) : students ?? [] }, [students, q])
  const { data: existing } = useGrades(classId, subjectId || undefined, periodId || undefined)

  const effSubject = subjectId || subjects?.[0]?.id || ''
  const averages = useMemo(() => {
    const m = new Map<string, { sum: number; w: number }>()
    for (const g of existing ?? []) {
      const e = m.get(g.studentId) ?? { sum: 0, w: 0 }
      e.sum += (g.value / (g.maxValue || 20)) * 20 * (g.coefficient || 1); e.w += g.coefficient || 1
      m.set(g.studentId, e)
    }
    return m
  }, [existing])

  const filled = Object.values(values).filter((v) => v.trim() !== '').length
  const max = Number(maxValue.replace(',', '.')) || 20
  const subjectName = subjects?.find((s) => s.id === effSubject)?.name ?? ''

  async function save() {
    if (!effSubject) return alert({ title: 'Matière', message: 'Choisissez une matière.', tone: 'warning' })
    const grades = (students ?? [])
      .filter((s) => (values[s.id] ?? '').trim() !== '')
      .map((s) => ({ studentId: s.id, subjectId: effSubject, value: Number((values[s.id] ?? '').replace(',', '.')), maxValue: max, evaluationType: type, evaluationLabel: label.trim() || undefined, periodId: periodId || undefined }))
    const bad = grades.find((g) => Number.isNaN(g.value) || g.value < 0 || g.value > max)
    if (bad) return alert({ title: 'Note invalide', message: `Les notes doivent être comprises entre 0 et ${max}.`, tone: 'warning' })
    if (grades.length === 0) return alert({ title: 'Aucune note', message: 'Saisissez au moins une note.', tone: 'warning' })
    const ok = await confirm({ title: `Enregistrer ${grades.length} note${grades.length > 1 ? 's' : ''} ?`, message: `${subjectName} · ${TYPES.find((t) => t.value === type)?.label ?? type} sur ${max}${label.trim() ? ` · ${label.trim()}` : ''}`, confirmLabel: 'Enregistrer' })
    if (!ok) return
    setSaving(true)
    try {
      const sent = await sendOrQueue({
        kind: 'grades',
        label: `${grades.length} note(s) ${cls?.name ?? ''} — ${subjectName}`,
        method: 'post',
        url: `/grades/class/${classId}/bulk`,
        body: grades,
        invalidate: [['grades', classId, effSubject, periodId]],
      })
      toast({ type: sent ? 'success' : 'warning', title: sent ? 'Notes enregistrées' : 'Notes mises en attente', message: sent ? `${grades.length} note(s) ajoutée(s).` : 'Envoi automatique dès que le réseau revient.' })
      router.back()
    } catch (err) {
      await alert({ title: 'Erreur', message: errorMessage(err), tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-background">
      <ScreenHeader hero back title="Saisie des notes" subtitle={cls?.name} className="pb-14" style={{ backgroundColor: color }}>
        <Text className="mt-4 text-[11px] font-semibold uppercase tracking-[1.5px] text-white/70">Matière</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingTop: 6 }}>
          {(subjects ?? []).map((s) => <Chip key={s.id} light active={s.id === effSubject} label={s.name} onPress={() => setSubjectId(s.id)} />)}
          {(subjects ?? []).length === 0 && <Text className="text-sm text-white/80">{role === 'TEACHER' ? "Aucune de vos matières n'est définie pour cette classe" : 'Aucune matière définie pour cette classe'}</Text>}
        </ScrollView>
        {(periodsData?.periods ?? []).length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingTop: 8 }}>
            <Chip light active={!periodId} label="Toutes périodes" onPress={() => setPeriodId('')} />
            {periodsData!.periods.map((p) => <Chip key={p.id} light active={p.id === periodId} label={p.label} onPress={() => setPeriodId(p.id)} />)}
          </ScrollView>
        )}
      </ScreenHeader>

      <FlatList
        showsVerticalScrollIndicator={false}
        data={visible}
        keyExtractor={(s) => s.id}
        keyboardShouldPersistTaps="handled"
        className="-mt-6"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 130 }}
        ListHeaderComponent={
          <View style={CARD_SHADOW} className="mb-4 gap-3 rounded-2xl bg-card p-3">
            <View className="flex-row items-center gap-2"><Pencil size={14} color={colors.muted} /><Text className="text-xs font-semibold uppercase tracking-[1.5px] text-muted-foreground">Évaluation</Text></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {TYPES.map((t) => <Chip key={t.value} active={t.value === type} label={t.label} onPress={() => setType(t.value)} />)}
            </ScrollView>
            <View className="flex-row gap-3">
              <View className="flex-1"><Input label="Intitulé (optionnel)" value={label} onChangeText={setLabel} placeholder="Ex. Contrôle n°2" /></View>
              <View className="w-24"><Input label="Sur" value={maxValue} onChangeText={setMaxValue} keyboardType="decimal-pad" /></View>
            </View>
            <SearchBar value={q} onChange={setQ} placeholder="Rechercher un élève…" />
          </View>
        }
        ListEmptyComponent={!isLoading ? <Empty icon={Users} title={q ? 'Aucun élève ne correspond' : 'Aucun élève'} /> : null}
        ItemSeparatorComponent={() => <View className="h-2" />}
        renderItem={({ item: s, index }) => {
          const avg = averages.get(s.id)
          const has = (values[s.id] ?? '').trim() !== ''
          return (
            <View style={CARD_SHADOW} className={`flex-row items-center gap-3 rounded-2xl bg-card px-3 py-2 ${has ? 'border border-primary/40' : ''}`}>
              <Text className="w-5 text-xs text-muted-foreground">{index + 1}</Text>
              <View className="flex-1">
                <Text className="font-medium" numberOfLines={1}>{s.lastName.toUpperCase()} {s.firstName ?? ''}</Text>
                <Text className="text-xs text-muted-foreground">{avg && avg.w ? `Moyenne ${subjectName ? subjectName.toLowerCase() : 'matière'} : ${(avg.sum / avg.w).toFixed(2)} / 20` : 'Aucune note'}</Text>
              </View>
              <View className="flex-row items-center gap-1">
                <TextInput
                  value={values[s.id] ?? ''}
                  onChangeText={(v) => setValues((m) => ({ ...m, [s.id]: v }))}
                  keyboardType="decimal-pad"
                  placeholder="—"
                  placeholderTextColor={colors.muted}
                  style={{ color: colors.foreground, paddingVertical: 0 }}
                  className={`h-11 w-16 rounded-xl border text-center text-lg font-semibold ${has ? 'border-primary bg-primary/5' : 'border-input bg-background'}`}
                />
                <Text className="w-8 text-xs text-muted-foreground">/ {max}</Text>
              </View>
            </View>
          )
        }}
      />
      <View style={{ shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 10 }} className="absolute bottom-0 left-0 right-0 rounded-t-3xl border-t border-border bg-card px-4 pb-8 pt-4">
        <Button label={filled ? `Enregistrer ${filled} note${filled > 1 ? 's' : ''}` : 'Enregistrer'} loading={saving} disabled={!filled} onPress={save} size="lg" className="rounded-xl" style={filled ? { backgroundColor: color } : undefined} />
      </View>
    </KeyboardAvoidingView>
  )
}

import { useNavigate } from 'react-router-dom'
import { useLocalQuery } from '@/lib/db/hooks'
import type { Class } from '@/types'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PlusIcon, PersonIcon, ReaderIcon, ReloadIcon } from '@radix-ui/react-icons'
import { cn } from '@/lib/utils'

export function ClassListPage() {
  const navigate = useNavigate()

  const { data: classes, loading: isLoading, refetch } = useLocalQuery<Class>('Class')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Classes</h2>
          <p className="text-muted-foreground">Gérer les classes de l'établissement</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <ReloadIcon className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
          <Button onClick={() => navigate('/classes/new')}>
            <PlusIcon className="mr-2 h-4 w-4" />
            Ajouter une classe
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center text-muted-foreground">
          Chargement...
        </div>
      ) : !classes?.length ? (
        <div className="flex h-48 flex-col items-center justify-center gap-4 text-muted-foreground">
          <p>Aucune classe trouvée</p>
          <Button onClick={() => navigate('/classes/new')}>Créer la première classe</Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((cls) => (
            <Card
              key={cls.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => navigate(`/classes/${cls.id}`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">{cls.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{cls.level}</p>
                  </div>
                  <Badge variant="outline">{cls.room || 'Salle N/D'}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <PersonIcon className="h-4 w-4" />
                    <span>
                      {cls.studentCount} / {cls.capacity} élèves
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ReaderIcon className="h-4 w-4" />
                    <span>Enseignants</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

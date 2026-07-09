import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useAuthStore } from '@/stores/auth-store'
import {
  PersonIcon,
  ReaderIcon,
  BellIcon,
  StarIcon
} from '@radix-ui/react-icons'
import { Link } from 'react-router-dom'

const stats = [
  {
    label: 'Total Élèves',
    value: '245',
    icon: PersonIcon,
    change: '+8%',
    variant: 'default' as const
  },
  {
    label: 'Enseignants',
    value: '18',
    icon: ReaderIcon,
    change: '+2',
    variant: 'default' as const
  },
  {
    label: 'Classes',
    value: '12',
    icon: BellIcon,
    change: '0',
    variant: 'default' as const
  },
  {
    label: 'Taux de présence',
    value: '94%',
    icon: StarIcon,
    change: '+1%',
    variant: 'default' as const
  }
]

const recentActivity = [
  { action: 'Nouvel élève inscrit', detail: 'Marie Dupont - 6ème A', time: 'Il y a 5 min' },
  { action: 'Note ajoutée', detail: 'Mathématiques - M. Martin', time: 'Il y a 12 min' },
  { action: 'Présence validée', detail: 'Classe de CM2 - 28/30 présents', time: 'Il y a 1h' },
  { action: 'Paiement reçu', detail: 'Frais de scolarité - Jean Camara', time: 'Il y a 2h' },
  { action: 'Communication envoyée', detail: 'Aux parents des 5ème B', time: 'Il y a 3h' }
]

const quickActions = [
  { label: 'Inscrire un élève', path: '/students/new', variant: 'default' as const },
  { label: 'Ajouter des notes', path: '/grades', variant: 'outline' as const },
  { label: 'Faire l\'appel', path: '/attendance', variant: 'outline' as const },
  { label: 'Envoyer un message', path: '/communications', variant: 'outline' as const }
]

export function DashboardPage() {
  const user = useAuthStore((s) => s.user)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Bonjour, {user?.firstName || 'Utilisateur'}
        </h2>
        <p className="text-muted-foreground">
          Voici un aperçu de votre établissement aujourd'hui.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                <span className="text-green-600">{stat.change}</span> vs mois dernier
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Activité récente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((item, i) => (
                <div key={i}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium">{item.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.detail}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {item.time}
                    </Badge>
                  </div>
                  {i < recentActivity.length - 1 && (
                    <Separator className="mt-3" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Actions rapides</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action) => (
                <Button
                  key={action.label}
                  variant={action.variant}
                  asChild
                  className="h-20"
                >
                  <Link to={action.path}>{action.label}</Link>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
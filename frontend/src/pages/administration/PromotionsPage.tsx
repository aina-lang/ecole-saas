import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { DeliberationPage } from './DeliberationPage'
import { RolloverPage } from './RolloverPage'
import { ReinscriptionPage } from './ReinscriptionPage'
import { DispatchPage } from './DispatchPage'

const tabs = [
  { value: 'deliberation', label: 'Délibération' },
  { value: 'rollover', label: 'Clôture annuelle' },
  { value: 'reinscription', label: 'Ré-inscriptions' },
  { value: 'dispatch', label: 'Répartition' },
] as const

export function PromotionsPage({ defaultTab }: { defaultTab?: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Gestion des promotions</h2>
        <p className="text-muted-foreground">Délibération, clôture, ré-inscriptions et répartition.</p>
      </div>
      <Tabs defaultValue={defaultTab ?? 'deliberation'} className="space-y-6">
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="deliberation"><DeliberationPage /></TabsContent>
        <TabsContent value="rollover"><RolloverPage /></TabsContent>
        <TabsContent value="reinscription"><ReinscriptionPage /></TabsContent>
        <TabsContent value="dispatch"><DispatchPage /></TabsContent>
      </Tabs>
    </div>
  )
}
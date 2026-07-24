import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { ReloadIcon } from '@radix-ui/react-icons'
import { getTenantSetting, setTenantSetting } from '@/lib/tenant-settings'

interface PaymentConfig {
  monthlyTuition: number
  annualFee: number
  dueDay: number
}

const DEFAULTS: PaymentConfig = {
  monthlyTuition: 0,
  annualFee: 0,
  dueDay: 15,
}

export function PaymentConfigPage() {
  const queryClient = useQueryClient()
  const [config, setConfig] = useState<PaymentConfig>(DEFAULTS)

  const { data: savedConfig, isLoading } = useQuery({
    queryKey: ['payment-config'],
    queryFn: async () => {
      const raw = await getTenantSetting('payment_config')
      return raw ? (JSON.parse(raw) as PaymentConfig) : DEFAULTS
    },
  })

  useEffect(() => {
    if (savedConfig) setConfig(savedConfig)
  }, [savedConfig])

  const saveMutation = useMutation({
    mutationFn: async () => {
      await setTenantSetting('payment_config', JSON.stringify(config))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-config'] })
      toast.success('Configuration des paiements enregistrée')
    },
    onError: () => toast.error('Erreur lors de l\'enregistrement'),
  })

  if (isLoading) {
    return <div className="flex h-48 items-center justify-center text-muted-foreground">Chargement...</div>
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Configuration des paiements</h2>
        <p className="text-muted-foreground">Définir les montants d'écolage mensuel et des frais annuels</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Montants par défaut</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Écolage mensuel (Ar)</label>
            <Input
              type="number"
              min={0}
              value={config.monthlyTuition}
              onChange={(e) => setConfig((c) => ({ ...c, monthlyTuition: +e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">Montant mensuel par élève</p>
          </div>

          <Separator />

          <div className="space-y-2">
            <label className="text-sm font-medium">Frais scolaires annuels (Ar)</label>
            <Input
              type="number"
              min={0}
              value={config.annualFee}
              onChange={(e) => setConfig((c) => ({ ...c, annualFee: +e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">Frais d'inscription ou frais fixes par année</p>
          </div>

          <Separator />

          <div className="space-y-2">
            <label className="text-sm font-medium">Jour d'échéance</label>
            <Input
              type="number"
              min={1}
              max={28}
              value={config.dueDay}
              onChange={(e) => setConfig((c) => ({ ...c, dueDay: +e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">Jour du mois pour les échéances de paiement</p>
          </div>

          <Button
            className="w-full"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending && <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

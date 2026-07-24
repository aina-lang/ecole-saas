import { ReactNode } from 'react'
import bg1 from '@/assets/bg1.jpg'

export function AuthShell({
  title,
  subtitle,
  children
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="flex h-full w-full">
      <div
        className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-cover bg-center p-12 text-white md:flex"
        style={{ backgroundImage: `url(${bg1})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/50" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-lg font-bold backdrop-blur-sm">
            E
          </div>
          <span className="text-xl font-semibold tracking-tight">École SaaS</span>
        </div>

        <div className="relative space-y-3">
          <h2 className="text-3xl font-bold leading-tight">
            Gérez votre établissement en toute simplicité
          </h2>
          <p className="mt-3 max-w-sm text-white/80">
            Élèves, notes, présences, finance et communication — centralisés dans une seule
            application.
          </p>
        </div>

        <p className="relative text-sm text-white/60">
          © {new Date().getFullYear()} École SaaS — Gestion scolaire
        </p>
      </div>

      <div className="flex w-full items-center justify-center bg-background p-6 md:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center gap-3 text-center md:hidden">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-xl font-bold text-primary-foreground">
              E
            </div>
            <span className="text-lg font-semibold">École SaaS</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mb-6 mt-2 text-sm text-muted-foreground">{subtitle}</p>

          {children}
        </div>
      </div>
    </div>
  )
}

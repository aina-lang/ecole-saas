import { ReactNode } from 'react'

function AuthIllustration() {
  return (
    <svg viewBox="0 0 400 300" fill="none" className="w-full max-w-sm" aria-hidden="true">
      <defs>
        <linearGradient id="authGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.25" />
          <stop offset="100%" stopColor="white" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <rect x="40" y="60" width="320" height="200" rx="16" fill="url(#authGrad)" />
      <rect x="70" y="100" width="260" height="14" rx="7" fill="white" opacity="0.7" />
      <rect x="70" y="130" width="200" height="14" rx="7" fill="white" opacity="0.45" />
      <rect x="70" y="160" width="230" height="14" rx="7" fill="white" opacity="0.3" />
      <circle cx="300" cy="200" r="36" fill="white" opacity="0.18" />
      <path
        d="M150 230l40-50 30 36 24-30 36 44"
        stroke="white"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.6"
      />
      <path
        d="M120 250a40 40 0 0 1 40-40h80a40 40 0 0 1 40 40"
        stroke="white"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  )
}

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
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-primary via-indigo-600 to-violet-700 p-12 text-primary-foreground md:flex">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10" />
        <div className="absolute -bottom-20 -left-10 h-72 w-72 rounded-full bg-white/5" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-lg font-bold">
            E
          </div>
          <span className="text-xl font-semibold tracking-tight">École SaaS</span>
        </div>

        <div className="relative space-y-8">
          <AuthIllustration />
          <div>
            <h2 className="text-3xl font-bold leading-tight">
              Gérez votre établissement en toute simplicité
            </h2>
            <p className="mt-3 max-w-sm text-white/80">
              Élèves, notes, présences, finance et communication — centralisés dans une seule
              application.
            </p>
          </div>
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

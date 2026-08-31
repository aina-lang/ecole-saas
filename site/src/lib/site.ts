/**
 * Source unique des informations produit affichées sur le site.
 *
 * Les coordonnées et le discours reprennent mot pour mot ceux de
 * l'application (frontend/src/lib/support.ts et l'écran de connexion) : le
 * visiteur qui télécharge doit retrouver exactement la même promesse et les
 * mêmes numéros une fois l'app installée.
 */

export const PRODUCT = {
  name: 'Sekoliko',
  tagline: 'Gestion scolaire hors ligne',
  headline: 'Toute la vie de votre établissement, au même endroit.',
  pitch:
    "Une application pensée pour les écoles de Madagascar : simple, rapide et fiable même quand la connexion ne l'est pas.",
  version: '1.0.0',
} as const

export const SUPPORT = {
  phoneDisplay: '+261 32 57 153 47',
  phoneTel: '+261325715347',
  whatsapp: 'https://wa.me/261325715347',
  email: 'merciaaina@gmail.com',
} as const

/** Fichiers publiés sur le serveur de téléchargement (voir docs/publier-une-mise-a-jour.md). */
export const DOWNLOADS = {
  base: 'http://51.178.50.63:3000/updates',
  installer: {
    file: `Sekoliko-${PRODUCT.version}-installateur.exe`,
    size: '201 Mo',
    label: 'Installateur Windows',
    detail: '64 et 32 bits — l’installeur choisit tout seul',
  },
  portable: {
    file: `Sekoliko-${PRODUCT.version}-portable.exe`,
    size: '105 Mo',
    label: 'Version portable',
    detail: 'Sur clé USB, sans installation — pas de mise à jour automatique',
  },
} as const

export const REQUIREMENTS = [
  { label: 'Système', value: 'Windows 10 ou Windows 11 (64 ou 32 bits)' },
  { label: 'Mémoire', value: '4 Go de RAM minimum, 8 Go recommandés' },
  { label: 'Disque', value: '1 Go libre, plus l’espace des photos et documents' },
  { label: 'Internet', value: 'Requis à la première connexion et pour la synchronisation, facultatif ensuite' },
] as const

/** Modules du logiciel, dans l'ordre du menu de l'application. */
export const FEATURES = [
  {
    id: 'eleves',
    icon: 'Users',
    title: 'Élèves et inscriptions',
    summary: 'Dossiers complets, photos, matricules automatiques et rattachement aux parents.',
    detail:
      "Chaque élève a une fiche avec sa photo, son matricule, sa classe, ses parents et ses documents. La recherche porte sur le nom, le prénom ou le matricule, et les listes s'exportent en PDF, Word ou Excel.",
    screen: 'eleves.png',
  },
  {
    id: 'parents',
    icon: 'HeartHandshake',
    title: 'Parents et tuteurs',
    summary: 'Un compte par famille, plusieurs enfants rattachés, plusieurs numéros par contact.',
    detail:
      "Les parents sont reliés à leurs enfants : depuis une fiche parent on voit toute la fratrie, et depuis un élève on retrouve les contacts à appeler. Les téléphones multiples sont gérés et dédoublonnés.",
    screen: 'parents.png',
  },
  {
    id: 'notes',
    icon: 'GraduationCap',
    title: 'Notes et bulletins',
    summary: 'Devoirs, contrôles et examens avec coefficients, moyennes et bulletins PDF.',
    detail:
      "La saisie se fait par classe et par matière, avec le type d'évaluation et son coefficient. Les moyennes se calculent seules, par période et par année, et les bulletins sortent en PDF prêts à imprimer.",
    screen: 'notes.png',
  },
  {
    id: 'presences',
    icon: 'ClipboardCheck',
    title: 'Présences et absences',
    summary: 'Appel par demi-journée ou par créneau, avec suivi des retards et des justificatifs.',
    detail:
      "L'appel se fait classe par classe et jour par jour, en quelques clics. Les statistiques par élève et par classe montrent d'un coup d'œil qui décroche.",
    screen: 'presences.png',
  },
  {
    id: 'emploi-du-temps',
    icon: 'CalendarDays',
    title: 'Emplois du temps',
    summary: 'Grille hebdomadaire par classe, avec salles, enseignants et récréations.',
    detail:
      "Chaque classe a sa grille de la semaine, avec la matière, l'enseignant et la salle. Les conflits d'enseignant ou de salle sont signalés, et la grille s'exporte en PDF pour l'affichage.",
    screen: 'emploi-du-temps.png',
  },
  {
    id: 'paiements',
    icon: 'Wallet',
    title: 'Écolages et paiements',
    summary: 'Frais par niveau, paiements partiels, reçus et suivi des retards.',
    detail:
      "Les frais se définissent par niveau — droits d'inscription, écolage mensuel. Chaque règlement, même partiel, est enregistré avec son reçu, et le tableau de bord affiche le taux de recouvrement.",
    screen: 'paiements.png',
  },
  {
    id: 'promotions',
    icon: 'ArrowUpRight',
    title: 'Passage de classe',
    summary: 'Délibération, clôture annuelle, ré-inscriptions et répartition, en quatre étapes.',
    detail:
      "Le passage d'une année à l'autre est guidé : calcul des moyennes et décisions de passage, clôture de l'année, contrôle des dettes à la ré-inscription, puis affectation dans les nouvelles classes.",
    screen: 'promotions.png',
  },
  {
    id: 'finances',
    icon: 'BarChart3',
    title: 'Tableau de bord',
    summary: 'Effectifs, taux de présence, collecte mensuelle et impayés en une page.',
    detail:
      "L'écran d'accueil résume l'établissement : nombre d'élèves et d'enseignants, remplissage des classes, présence du jour, montants collectés, en attente et en retard.",
    screen: 'tableau-de-bord.png',
  },
] as const

/** Captures mises en avant dans la galerie de l'accueil. */
export const GALLERY = [
  { src: 'tableau-de-bord.png', label: 'Tableau de bord' },
  { src: 'eleves.png', label: 'Élèves' },
  { src: 'emploi-du-temps.png', label: 'Emploi du temps' },
  { src: 'notes.png', label: 'Notes' },
  { src: 'paiements.png', label: 'Paiements' },
  { src: 'presences.png', label: 'Présences' },
  { src: 'parents.png', label: 'Parents' },
  { src: 'frais.png', label: 'Frais par niveau' },
  { src: 'tableau-de-bord-sombre.png', label: 'Thème sombre' },
] as const

export const FAQ = [
  {
    q: 'Faut-il Internet pour utiliser Sekoliko ?',
    a: "Non. Après la première connexion, l'application fonctionne entièrement hors ligne : saisie des notes, appel, encaissements, impression. Quand le réseau revient, tout se synchronise automatiquement avec le serveur et les autres postes de l'école.",
  },
  {
    q: 'Plusieurs ordinateurs peuvent-ils travailler en même temps ?',
    a: "Oui. Chaque poste garde sa propre copie des données et se synchronise dès qu'il retrouve le réseau. Le secrétariat peut encaisser pendant que le surveillant fait l'appel, sans se gêner.",
  },
  {
    q: 'Combien coûte la licence ?',
    a: "La licence est annuelle et sans limite d'élèves ni d'enseignants. Le tarif dépend de l'établissement : appelez-nous ou écrivez-nous, la réponse est immédiate.",
  },
  {
    q: 'Que se passe-t-il à la fin de la licence ?',
    a: "L'application passe en lecture seule : vous gardez l'accès à toutes vos données et pouvez les consulter et les imprimer, mais la saisie est suspendue jusqu'au renouvellement. Rien n'est jamais supprimé.",
  },
  {
    q: 'Mes données partent-elles à l’étranger ?',
    a: "Elles vivent d'abord sur vos ordinateurs. La copie de synchronisation est hébergée sur notre serveur pour permettre le travail à plusieurs postes et la restauration en cas de panne matérielle.",
  },
  {
    q: 'Windows affiche « Éditeur inconnu » au téléchargement, est-ce normal ?',
    a: "Oui, pour l'instant. Le certificat de signature est en cours d'acquisition. Cliquez sur « Informations complémentaires » puis « Exécuter quand même ». Vérifiez que le fichier vient bien de cette page.",
  },
] as const

export const NAV = [
  { href: '/fonctionnalites', label: 'Fonctionnalités' },
  { href: '/licence', label: 'Licence' },
  { href: '/support', label: 'Assistance' },
] as const

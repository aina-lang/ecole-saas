import { PrismaClient, UserRole, AttendanceStatus, PaymentStatus, DocumentCategory, TeacherAttendanceStatus, ContractType, TeacherPaymentStatus, MessagePriority, MessageStatus, SyncStatus, SyncOperation } from '@prisma/client'
import * as bcrypt from 'bcrypt'
import { PrismaPg } from '@prisma/adapter-pg'
import { randomUUID } from 'crypto'
import * as fs from 'fs'
import * as path from 'path'

const envPath = path.resolve(process.cwd(), '.env')
const envContent = fs.readFileSync(envPath, 'utf-8')
const envVars: Record<string, string> = {}
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) envVars[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '')
}

const adapter = new PrismaPg({
  connectionString: envVars.DATABASE_URL,
})

const prisma = new PrismaClient({ adapter })

const PASSWORD_HASH_ROUNDS = 12

const TENANTS = [
  {
    name: 'Lycée Victor Hugo',
    subdomain: 'lycee-victor-hugo',
    plan: 'STARTER' as const,
    status: 'ACTIVE' as const,
    maxStudents: 500,
    maxTeachers: 50,
    maxStorageMb: 5000,
    settings: {
      schoolName: 'Lycée Victor Hugo',
      address: '25 Rue Victor Hugo, 75000 Paris',
      phone: '+33 1 23 45 67 89',
      email: 'contact@lycee-vhugo.fr',
      website: 'https://lycee-vhugo.fr',
      directorName: 'Mme Marie Lefèvre',
      academicYear: '2025-2026',
      semester: 'SEMESTER_1',
      gradingScale: 'FRENCH',
      currency: 'EUR',
      language: 'fr',
      timezone: 'Europe/Paris',
    },
  },
  {
    name: 'Collège Jean Jaurès',
    subdomain: 'college-jean-jaures',
    plan: 'PROFESSIONAL' as const,
    status: 'ACTIVE' as const,
    maxStudents: 800,
    maxTeachers: 80,
    maxStorageMb: 10000,
    settings: {
      schoolName: 'Collège Jean Jaurès',
      address: '12 Ave Jean Jaurès, 31000 Toulouse',
      phone: '+33 5 61 00 00 00',
      email: 'contact@college-jaures.fr',
      website: 'https://college-jaures.fr',
      directorName: 'M. Bernard Dubois',
      academicYear: '2025-2026',
      semester: 'SEMESTER_1',
      gradingScale: 'FRENCH',
      currency: 'EUR',
      language: 'fr',
      timezone: 'Europe/Paris',
    },
  },
  {
    name: 'École Primaire Les Mimosas',
    subdomain: 'ecole-les-mimosas',
    plan: 'FREE' as const,
    status: 'TRIAL' as const,
    trialEndsAt: new Date('2026-09-30'),
    maxStudents: 150,
    maxTeachers: 15,
    maxStorageMb: 1000,
    settings: {
      schoolName: 'École Primaire Les Mimosas',
      address: '8 Rue des Fleurs, 06000 Nice',
      phone: '+33 4 93 00 00 00',
      email: 'contact@ecole-mimosas.fr',
      website: 'https://ecole-mimosas.fr',
      directorName: 'Mme Sophie Lambert',
      academicYear: '2025-2026',
      semester: 'SEMESTER_1',
      gradingScale: 'FRENCH',
      currency: 'EUR',
      language: 'fr',
      timezone: 'Europe/Paris',
    },
  },
]

const TEACHER_DATA = [
  { firstName: 'Jean', lastName: 'Dupont', specialty: 'Mathématiques' },
  { firstName: 'Sophie', lastName: 'Martin', specialty: 'Français' },
  { firstName: 'Pierre', lastName: 'Bernard', specialty: 'Physique-Chimie' },
  { firstName: 'Isabelle', lastName: 'Laurent', specialty: 'Histoire-Géographie' },
  { firstName: 'Marc', lastName: 'Petit', specialty: 'Anglais' },
  { firstName: 'Céline', lastName: 'Dubois', specialty: 'SVT' },
  { firstName: 'Antoine', lastName: 'Moreau', specialty: 'EPS' },
  { firstName: 'Nathalie', lastName: 'Rousseau', specialty: 'Mathématiques' },
  { firstName: 'Philippe', lastName: 'Leroy', specialty: 'Français' },
  { firstName: 'Valérie', lastName: 'Mercier', specialty: 'Physique-Chimie' },
]

const PARENT_DATA = [
  { firstName: 'Thomas', lastName: 'Petit' },
  { firstName: 'Isabelle', lastName: 'Roux' },
  { firstName: 'Christophe', lastName: 'Moreau' },
  { firstName: 'Caroline', lastName: 'Durand' },
  { firstName: 'François', lastName: 'Leroy' },
  { firstName: 'Catherine', lastName: 'Girard' },
  { firstName: 'Nicolas', lastName: 'Fontaine' },
  { firstName: 'Sandrine', lastName: 'Marchand' },
  { firstName: 'Laurent', lastName: 'Fournier' },
  { firstName: 'Sophie', lastName: 'Lefebvre' },
  { firstName: 'David', lastName: 'Renaud' },
  { firstName: 'Patricia', lastName: 'Guerin' },
]

const CLASS_DATA = [
  { name: '2nde A', level: '2nde', room: 'Bâtiment A - Salle 12', capacity: 35 },
  { name: '2nde B', level: '2nde', room: 'Bâtiment A - Salle 13', capacity: 35 },
  { name: '2nde C', level: '2nde', room: 'Bâtiment A - Salle 14', capacity: 30 },
  { name: '1ère A', level: '1ère', room: 'Bâtiment B - Salle 21', capacity: 35 },
  { name: '1ère B', level: '1ère', room: 'Bâtiment B - Salle 22', capacity: 30 },
  { name: '1ère C', level: '1ère', room: 'Bâtiment B - Salle 23', capacity: 30 },
]

const SUBJECTS_DATA = [
  { name: 'Mathématiques', code: 'MATH', level: '2nde', coefficient: 4 },
  { name: 'Français', code: 'FR', level: '2nde', coefficient: 3 },
  { name: 'Physique-Chimie', code: 'PC', level: '2nde', coefficient: 3 },
  { name: 'Histoire-Géographie', code: 'HG', level: '2nde', coefficient: 2 },
  { name: 'Anglais', code: 'ANG', level: '2nde', coefficient: 2 },
  { name: 'SVT', code: 'SVT', level: '2nde', coefficient: 2 },
  { name: 'EPS', code: 'EPS', level: '2nde', coefficient: 1 },
  { name: 'Mathématiques', code: 'MATH', level: '1ère', coefficient: 5 },
  { name: 'Français', code: 'FR', level: '1ère', coefficient: 3 },
  { name: 'Physique-Chimie', code: 'PC', level: '1ère', coefficient: 3 },
  { name: 'Histoire-Géographie', code: 'HG', level: '1ère', coefficient: 2 },
  { name: 'Anglais', code: 'ANG', level: '1ère', coefficient: 2 },
  { name: 'SVT', code: 'SVT', level: '1ère', coefficient: 2 },
  { name: 'EPS', code: 'EPS', level: '1ère', coefficient: 1 },
  { name: 'NSI', code: 'NSI', level: '1ère', coefficient: 4 },
]

const STUDENT_DATA = [
  { firstName: 'Lucas', lastName: 'Petit', gender: 'M', birthDate: new Date('2008-03-15'), nationality: 'Française', bloodType: 'A+' },
  { firstName: 'Emma', lastName: 'Petit', gender: 'F', birthDate: new Date('2009-07-22'), nationality: 'Française', bloodType: 'O+' },
  { firstName: 'Gabriel', lastName: 'Roux', gender: 'M', birthDate: new Date('2008-11-05'), nationality: 'Française', bloodType: 'B+' },
  { firstName: 'Jade', lastName: 'Roux', gender: 'F', birthDate: new Date('2009-01-30'), nationality: 'Française', bloodType: 'AB+' },
  { firstName: 'Louis', lastName: 'Moreau', gender: 'M', birthDate: new Date('2008-06-12'), nationality: 'Française', bloodType: 'A-' },
  { firstName: 'Chloé', lastName: 'Moreau', gender: 'F', birthDate: new Date('2009-09-08'), nationality: 'Française', bloodType: 'O-' },
  { firstName: 'Hugo', lastName: 'Durand', gender: 'M', birthDate: new Date('2008-12-01'), nationality: 'Française', bloodType: 'A+' },
  { firstName: 'Léa', lastName: 'Durand', gender: 'F', birthDate: new Date('2009-04-18'), nationality: 'Française', bloodType: 'B-' },
  { firstName: 'Nathan', lastName: 'Leroy', gender: 'M', birthDate: new Date('2008-08-25'), nationality: 'Française', bloodType: 'O+' },
  { firstName: 'Manon', lastName: 'Leroy', gender: 'F', birthDate: new Date('2009-02-14'), nationality: 'Française', bloodType: 'A+' },
  { firstName: 'Théo', lastName: 'Girard', gender: 'M', birthDate: new Date('2008-10-30'), nationality: 'Française', bloodType: 'AB-' },
  { firstName: 'Camille', lastName: 'Girard', gender: 'F', birthDate: new Date('2009-05-09'), nationality: 'Française', bloodType: 'A+' },
  { firstName: 'Alexandre', lastName: 'Fontaine', gender: 'M', birthDate: new Date('2008-01-20'), nationality: 'Française', bloodType: 'O+' },
  { firstName: 'Sarah', lastName: 'Fontaine', gender: 'F', birthDate: new Date('2009-08-15'), nationality: 'Française', bloodType: 'B+' },
  { firstName: 'Romain', lastName: 'Marchand', gender: 'M', birthDate: new Date('2008-04-10'), nationality: 'Française', bloodType: 'A+' },
  { firstName: 'Laura', lastName: 'Marchand', gender: 'F', birthDate: new Date('2009-11-28'), nationality: 'Française', bloodType: 'O-' },
  { firstName: 'Quentin', lastName: 'Fournier', gender: 'M', birthDate: new Date('2008-09-03'), nationality: 'Française', bloodType: 'A-' },
  { firstName: 'Marine', lastName: 'Fournier', gender: 'F', birthDate: new Date('2009-06-17'), nationality: 'Française', bloodType: 'AB+' },
  { firstName: 'Bastien', lastName: 'Lefebvre', gender: 'M', birthDate: new Date('2008-07-25'), nationality: 'Française', bloodType: 'O+' },
  { firstName: 'Ophélie', lastName: 'Lefebvre', gender: 'F', birthDate: new Date('2009-03-12'), nationality: 'Française', bloodType: 'A+' },
  { firstName: 'Jules', lastName: 'Renaud', gender: 'M', birthDate: new Date('2008-05-30'), nationality: 'Française', bloodType: 'B+' },
  { firstName: 'Lucie', lastName: 'Renaud', gender: 'F', birthDate: new Date('2009-10-05'), nationality: 'Française', bloodType: 'A+' },
  { firstName: 'Maxime', lastName: 'Guerin', gender: 'M', birthDate: new Date('2008-02-18'), nationality: 'Française', bloodType: 'AB-' },
  { firstName: 'Clara', lastName: 'Guerin', gender: 'F', birthDate: new Date('2009-12-22'), nationality: 'Française', bloodType: 'O+' },
  { firstName: 'Enzo', lastName: 'Martinez', gender: 'M', birthDate: new Date('2008-07-08'), nationality: 'Espagnole', bloodType: 'A+' },
]

const FEE_STRUCTURES = [
  { label: "Frais d'inscription", amount: 500, dueDay: 15, description: "Frais annuels d'inscription", isActive: true },
  { label: 'Frais de scolarité - Trimestre 1', amount: 1500, dueDay: 30, description: 'Premier trimestre', isActive: true },
  { label: 'Frais de scolarité - Trimestre 2', amount: 1500, dueDay: 15, description: 'Deuxième trimestre', isActive: true },
  { label: 'Frais de scolarité - Trimestre 3', amount: 1500, dueDay: 0, description: 'Troisième trimestre', isActive: true },
  { label: 'Assurance scolaire', amount: 200, dueDay: 15, description: 'Assurance responsabilité civile + individuelle accident', isActive: true },
  { label: 'Frais de cantine - Trimestre 1', amount: 450, dueDay: 10, description: 'Cantine scolaire', isActive: true },
  { label: 'Frais de cantine - Trimestre 2', amount: 450, dueDay: 10, description: 'Cantine scolaire', isActive: true },
  { label: 'Frais de cantine - Trimestre 3', amount: 450, dueDay: 10, description: 'Cantine scolaire', isActive: true },
  { label: 'Voyage scolaire', amount: 350, dueDay: 5, description: 'Voyage de fin d\'année', isActive: true },
]

const MESSAGES_CONTENT = [
  { subject: 'Réunion parents-professeurs', body: 'Chers parents, une réunion parents-professeurs aura lieu le 15 novembre à 18h. Cordialement, M. Dupont', priority: 'HIGH' as MessagePriority },
  { subject: 'Sortie scolaire au musée', body: 'Information concernant la sortie au musée du Louvre prévue le 20 décembre. Permission à retourner signée.', priority: 'NORMAL' as MessagePriority },
  { subject: 'Résultats du trimestre', body: 'Les résultats du premier trimestre sont disponibles sur le portail élève.', priority: 'NORMAL' as MessagePriority },
  { subject: 'Urgence: Grève des transports', body: 'En raison de la grève des transports prévue le 5 décembre, l\'établissement restera ouvert mais les cours débuteront à 10h.', priority: 'URGENT' as MessagePriority },
  { subject: 'Inscription aux activités périscolaires', body: 'Les inscriptions aux activités périscolaires (théâtre, chorale, sport) sont ouvertes jusqu\'au 30 septembre.', priority: 'LOW' as MessagePriority },
  { subject: 'Vaccination HPV', body: 'Information sur la campagne de vaccination HPV organisée par l\'ARS. Consentement à retourner avant le 10 octobre.', priority: 'NORMAL' as MessagePriority },
  { subject: 'Fermeture exceptionnelle', body: 'L\'établissement sera fermé le 22 février pour cause de journée pédagogique.', priority: 'HIGH' as MessagePriority },
  { subject: 'Remise des bulletins', body: 'La remise des bulletins du second trimestre aura lieu le samedi 3 février de 9h à 12h.', priority: 'NORMAL' as MessagePriority },
  { subject: 'Collecte de jouets', body: 'L\'association des parents d\'élèves organise une collecte de jouets au profit des enfants défavorisés.', priority: 'LOW' as MessagePriority },
  { subject: 'Alerte canicule', body: 'En raison des fortes chaleurs annoncées, les cours d\'EPS sont annulés et les récréations se feront à l\'ombre.', priority: 'URGENT' as MessagePriority },
  { subject: 'Stage de découverte', body: 'Les élèves de 2nde doivent trouver un stage de découverte professionnelle avant les vacances d\'hiver.', priority: 'NORMAL' as MessagePriority },
  { subject: 'Photographie scolaire', body: 'Les photographies individuelles et de classe auront lieu le jeudi 12 octobre.', priority: 'LOW' as MessagePriority },
  { subject: 'Élection des délégués', body: 'Les élections des délégués de classe auront lieu la semaine du 25 septembre.', priority: 'NORMAL' as MessagePriority },
  { subject: 'Conseil de classe', body: 'Le conseil de classe du premier trimestre se réunira le 28 novembre à 17h.', priority: 'HIGH' as MessagePriority },
  { subject: 'Vente de gâteaux', body: 'L\'association des parents d\'élèves organise une vente de gâteaux le vendredi 17 mars.', priority: 'LOW' as MessagePriority },
]

const EVALUATION_TYPES = ['EXAM', 'TEST', 'HOMEWORK', 'PROJECT']
const EVALUATION_LABELS: Record<string, string> = {
  EXAM: 'Examen trimestriel',
  TEST: 'Contrôle continu',
  HOMEWORK: 'Devoir à la maison',
  PROJECT: 'Projet',
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomFloat(min: number, max: number): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2))
}

const TIME_SLOTS = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00']
const DAYS = [1, 2, 3, 4, 5]

async function seedTenant(tenantConfig: typeof TENANTS[number], tenantIndex: number, allTenantResults: any[]) {
  console.log(`\n🏢 Seeding tenant: ${tenantConfig.name}`)

  const tenant = await prisma.tenant.create({
    data: {
      name: tenantConfig.name,
      subdomain: tenantConfig.subdomain,
      plan: tenantConfig.plan,
      status: tenantConfig.status,
      maxStudents: tenantConfig.maxStudents,
      maxTeachers: tenantConfig.maxTeachers,
      maxStorageMb: tenantConfig.maxStorageMb,
      trialEndsAt: (tenantConfig as any).trialEndsAt,
      settings: tenantConfig.settings,
    },
  })

  const adminPasswordHash = await bcrypt.hash('Admin123!', PASSWORD_HASH_ROUNDS)
  const teacherPasswordHash = await bcrypt.hash('Teacher123!', PASSWORD_HASH_ROUNDS)
  const secretaryPasswordHash = await bcrypt.hash('Secretary123!', PASSWORD_HASH_ROUNDS)
  const parentPasswordHash = await bcrypt.hash('Parent123!', PASSWORD_HASH_ROUNDS)

  // Create ADMIN user
  const adminUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: `admin@${tenantConfig.subdomain}.fr`,
      passwordHash: adminPasswordHash,
      firstName: tenantConfig.settings.directorName.split(' ').slice(1).join(' ') || 'Admin',
      lastName: tenantConfig.settings.directorName.split(' ')[0] || 'Admin',
      role: 'ADMIN',
      isActive: true,
      phones: {
        create: [
          { value: tenantConfig.settings.phone, sortOrder: 0 },
          { value: '+33 6 00 00 00 00', sortOrder: 1 },
        ],
      },
    },
  })

  // Create SUPER_ADMIN user
  const superAdminUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'superadmin@ecole-saas.com',
      passwordHash: adminPasswordHash,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
      phones: { create: [{ value: '+33 6 99 99 99 99', sortOrder: 0 }] },
    },
  })

  // Create SECRETARY user
  const secretaryUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: `secretariat@${tenantConfig.subdomain}.fr`,
      passwordHash: secretaryPasswordHash,
      firstName: 'Claire',
      lastName: 'Moreau',
      role: 'SECRETARY',
      isActive: true,
      phones: { create: [{ value: tenantConfig.settings.phone, sortOrder: 0 }] },
    },
  })

  // Create TEACHER users (10 teachers)
  const teacherUsers: { id: string; email: string | null; firstName: string | null; lastName: string }[] = []
  for (let i = 0; i < TEACHER_DATA.length; i++) {
    const t = TEACHER_DATA[i]
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: `teacher${i + 1}@${tenantConfig.subdomain}.fr`,
        passwordHash: teacherPasswordHash,
        firstName: t.firstName,
        lastName: t.lastName,
        role: 'TEACHER',
        isActive: true,
        phones: {
          create: [
            { value: `+33 6 ${String(randomInt(10, 99))} ${String(randomInt(10, 99))} ${String(randomInt(10, 99))} ${String(randomInt(10, 99))}`, sortOrder: 0 },
          ],
        },
      },
    })
    teacherUsers.push(user)
  }

  // Create PARENT users (12 parents)
  const parentUsers: { id: string; email: string | null; firstName: string | null; lastName: string }[] = []
  for (let i = 0; i < PARENT_DATA.length; i++) {
    const p = PARENT_DATA[i]
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: `parent${i + 1}@${tenantConfig.subdomain}.fr`,
        passwordHash: parentPasswordHash,
        firstName: p.firstName,
        lastName: p.lastName,
        role: 'PARENT',
        isActive: true,
        phones: {
          create: [
            { value: `+33 6 ${String(randomInt(10, 99))} ${String(randomInt(10, 99))} ${String(randomInt(10, 99))} ${String(randomInt(10, 99))}`, sortOrder: 0 },
          ],
        },
      },
    })
    parentUsers.push(user)
  }

  // Create Teachers
  const teachers: { id: string; userId: string; specialty: string | null }[] = []
  for (let i = 0; i < TEACHER_DATA.length; i++) {
    const teacher = await prisma.teacher.create({
      data: {
        tenantId: tenant.id,
        userId: teacherUsers[i].id,
        specialty: TEACHER_DATA[i].specialty,
      },
    })
    teachers.push(teacher)
  }

  // Create Subjects
  const subjects = await Promise.all(
    SUBJECTS_DATA.map(s =>
      prisma.subject.create({
        data: {
          tenantId: tenant.id,
          name: s.name,
          code: s.code,
          level: s.level,
          coefficient: s.coefficient,
        },
      })
    )
  )

  // Create Classes
  const classes = await Promise.all(
    CLASS_DATA.map(c =>
      prisma.class.create({
        data: {
          tenantId: tenant.id,
          name: c.name,
          level: c.level,
          room: c.room,
          capacity: c.capacity,
        },
      })
    )
  )

  // Link Teachers to Classes
  for (let i = 0; i < teachers.length; i++) {
    const assignedClasses = classes.filter(() => Math.random() > 0.3)
    if (assignedClasses.length > 0) {
      await prisma.teacher.update({
        where: { id: teachers[i].id },
        data: { classes: { connect: assignedClasses.map(c => ({ id: c.id })) } },
      })
    }
  }

  // Link Teachers to Subjects (each teacher gets subjects matching their specialty)
  for (let i = 0; i < teachers.length; i++) {
    const specialty = TEACHER_DATA[i].specialty
    const matchingSubjects = subjects.filter(s => s.name === specialty)
    for (const subject of matchingSubjects) {
      await prisma.teacher.update({
        where: { id: teachers[i].id },
        data: { subjects: { connect: { id: subject.id } } },
      })
    }
  }

  // Link Subjects to Classes
  const subjectsByLevel: Record<string, typeof subjects> = {}
  for (const s of subjects) {
    const level = s.level || 'unknown'
    if (!subjectsByLevel[level]) subjectsByLevel[level] = []
    subjectsByLevel[level].push(s)
  }

  for (const cls of classes) {
    const levelSubjects = subjectsByLevel[cls.level || ''] || []
    if (levelSubjects.length > 0) {
      await prisma.class.update({
        where: { id: cls.id },
        data: { subjects: { connect: levelSubjects.map(s => ({ id: s.id })) } },
      })
    }
  }

  // Create AcademicYear, Periods, Holidays
  const academicYear = await prisma.academicYear.create({
    data: {
      tenantId: tenant.id,
      label: '2025-2026',
      startDate: new Date('2025-09-01'),
      endDate: new Date('2026-07-04'),
      isCurrent: true,
      periods: {
        create: [
          { label: 'Trimestre 1', type: 'TRIMESTER', startDate: new Date('2025-09-01'), endDate: new Date('2025-11-30'), coefficient: 1.0 },
          { label: 'Trimestre 2', type: 'TRIMESTER', startDate: new Date('2025-12-01'), endDate: new Date('2026-02-28'), coefficient: 1.0 },
          { label: 'Trimestre 3', type: 'TRIMESTER', startDate: new Date('2026-03-01'), endDate: new Date('2026-07-04'), coefficient: 1.0 },
        ],
      },
      holidays: {
        create: [
          { label: 'Vacances de la Toussaint', startDate: new Date('2025-10-18'), endDate: new Date('2025-11-03') },
          { label: 'Vacances de Noël', startDate: new Date('2025-12-20'), endDate: new Date('2026-01-05') },
          { label: 'Vacances d\'hiver', startDate: new Date('2026-02-07'), endDate: new Date('2026-02-23') },
          { label: 'Vacances de Printemps', startDate: new Date('2026-04-04'), endDate: new Date('2026-04-20') },
        ],
      },
    },
    include: { periods: true, holidays: true },
  })

  // Create Students (25 students)
  const createdStudents: { id: string; firstName: string; lastName: string; gender: string | null }[] = []
  for (let i = 0; i < STUDENT_DATA.length; i++) {
    const s = STUDENT_DATA[i]
    const cls = classes[i % classes.length]
    const parent = parentUsers[i % parentUsers.length]
    const secondParent = parentUsers[(i + 1) % parentUsers.length]
    const hasAllergies = Math.random() > 0.7
    const hasMedicalNotes = Math.random() > 0.8
    const cities = ['Paris', 'Toulouse', 'Nice', 'Lyon', 'Marseille', 'Bordeaux', 'Lille', 'Strasbourg', 'Nantes', 'Montpellier']

    const student = await prisma.student.create({
      data: {
        tenantId: tenant.id,
        firstName: s.firstName,
        lastName: s.lastName,
        gender: s.gender,
        birthDate: s.birthDate,
        birthPlace: `${randomFrom(cities)} (75)`,
        nationality: s.nationality,
        address: `${randomInt(1, 120)} Rue ${randomFrom(['de la Paix', 'des Lilas', 'Victor Hugo', 'Jean Jaurès', 'du Général de Gaulle', 'des Écoles', 'de la Mairie', 'Saint-Exupéry'])}, ${randomFrom(cities)}`,
        phoneNumber: `+33 6 ${String(randomInt(10, 99))} ${String(randomInt(10, 99))} ${String(randomInt(10, 99))} ${String(randomInt(10, 99))}`,
        email: `${s.firstName.toLowerCase()}.${s.lastName.toLowerCase()}@email.fr`,
        bloodType: s.bloodType,
        allergies: hasAllergies ? 'Pollen, acariens' : undefined,
        medicalNotes: hasMedicalNotes ? 'Asthme léger, Ventoline en cas de crise' : undefined,
        emergencyContact: `${parent.firstName} ${parent.lastName}`,
        emergencyPhone: `+33 6 ${String(randomInt(10, 99))} ${String(randomInt(10, 99))} ${String(randomInt(10, 99))} ${String(randomInt(10, 99))}`,
        status: 'ACTIVE',
        classId: cls.id,
        enrollmentDate: new Date('2025-09-01'),
        registrationNumber: `${tenantConfig.subdomain.toUpperCase().slice(0, 3)}-${new Date().getFullYear()}-${String(i + 1).padStart(5, '0')}`,
        parents: {
          create: [
            { parentId: parent.id, relation: 'MÈRE', isPrimary: true },
            { parentId: secondParent.id, relation: 'PÈRE', isPrimary: false },
          ],
        },
      },
    })
    createdStudents.push(student)
  }

  // Create Timetable Slots for each class
  let timetableSlotsCount = 0
  for (const cls of classes) {
    const classWithRelations = await prisma.class.findUnique({
      where: { id: cls.id },
      include: { teachers: { include: { subjects: true } }, subjects: true },
    })
    if (!classWithRelations || !classWithRelations.subjects.length) continue

    const classTeachers = classWithRelations.teachers
    const classSubjects = classWithRelations.subjects

    for (const day of DAYS) {
      for (const time of TIME_SLOTS) {
        const subject = randomFrom(classSubjects)
        const matchingTeachers = classTeachers.filter(t =>
          t.subjects.some(ts => (ts as any).subjectId === subject.id)
        )
        const teacher = matchingTeachers.length > 0
          ? randomFrom(matchingTeachers)
          : classTeachers.length > 0
            ? randomFrom(classTeachers)
            : undefined

        const endHour = String(parseInt(time.split(':')[0]) + 1).padStart(2, '0')
        await prisma.timetableSlot.create({
          data: {
            tenantId: tenant.id,
            classId: cls.id,
            subjectId: subject.id,
            teacherId: teacher?.id || undefined,
            dayOfWeek: day,
            startTime: time,
            endTime: time === '16:00' ? '17:00' : `${endHour}:00`,
            room: cls.room,
          },
        })
        timetableSlotsCount++
      }
    }
  }

  // Create Teacher Contracts
  const contractTypes: ContractType[] = ['HOURLY', 'MONTHLY', 'FIXED']
  for (const teacher of teachers) {
    const contractType = randomFrom(contractTypes)
    await prisma.teacherContract.create({
      data: {
        tenantId: tenant.id,
        teacherId: teacher.id,
        contractType,
        hourlyRate: contractType === 'HOURLY' ? randomInt(25, 45) : null,
        monthlySalary: contractType === 'MONTHLY' ? randomInt(1800, 3200) : null,
        fixedAmount: contractType === 'FIXED' ? randomInt(15000, 35000) : null,
        startDate: new Date('2025-09-01'),
        endDate: new Date('2026-07-04'),
        isActive: true,
      },
    })
  }

  // Create Teacher Attendances (20 days per teacher)
  for (const teacher of teachers) {
    const teacherAttendances: any[] = []
    for (let day = 0; day < 20; day++) {
      const date = new Date('2025-09-01')
      date.setDate(date.getDate() + day)
      if (date.getDay() === 0 || date.getDay() === 6) continue

      const status = randomFrom<TeacherAttendanceStatus>(['PRESENT', 'PRESENT', 'PRESENT', 'PRESENT', 'LATE', 'EXCUSED'])
      teacherAttendances.push({
        tenantId: tenant.id,
        teacherId: teacher.id,
        date,
        status,
        justification: status === 'EXCUSED' ? 'Rendez-vous médical' : status === 'LATE' ? 'Retard transport' : undefined,
      })
    }
    await prisma.teacherAttendance.createMany({ data: teacherAttendances })
  }

  // Create Teacher Payments (3 payments per teacher)
  for (let month = 0; month < 3; month++) {
    for (const teacher of teachers) {
      const contract = await prisma.teacherContract.findUnique({ where: { teacherId: teacher.id } })
      const baseAmount = contract?.monthlySalary || randomInt(1500, 2500)
      const totalAmount = baseAmount + randomInt(50, 200) - randomInt(0, 100)

      await prisma.teacherPayment.create({
        data: {
          tenantId: tenant.id,
          teacherId: teacher.id,
          periodLabel: `Mois ${month + 1}`,
          periodStart: new Date(2025, 8 + month, 1),
          periodEnd: new Date(2025, 8 + month, 0),
          totalHours: randomFloat(80, 120),
          hourlyRate: contract?.hourlyRate || null,
          baseAmount,
          bonusAmount: randomFloat(50, 200),
          deductionAmount: randomFloat(0, 100),
          totalAmount,
          status: randomFrom<TeacherPaymentStatus>(['PAID', 'PAID', 'PENDING']),
          paidAt: Math.random() > 0.3 ? new Date(2025, 8 + month, 28) : null,
          paymentMethod: 'virement_bancaire',
          reference: `SAL-${tenantConfig.subdomain.toUpperCase().slice(0, 3)}-${teacher.id.slice(0, 8).toUpperCase()}-${month + 1}`,
        },
      })
    }
  }

  // Create Fee Structures
  const feeStructures = await Promise.all(
    FEE_STRUCTURES.map(f =>
      prisma.feeStructure.create({
        data: { tenantId: tenant.id, ...f },
      })
    )
  )

  // Create Grades (5+ grades per student across subjects)
  for (const student of createdStudents) {
    const studentClass = classes.find(c => c.id === createdStudents.find(s => s.id === student.id)?.id ? true : false) || classes[0]
    const studentSubjects = subjects.filter(s => s.level === studentClass.level)
    const selectedSubjects = studentSubjects.slice(0, Math.min(8, studentSubjects.length))

    for (const subject of selectedSubjects) {
      const numGrades = randomInt(3, 6)
      for (let g = 0; g < numGrades; g++) {
        const evalType = randomFrom(EVALUATION_TYPES)
        const teacherForSubject = teachers.find(t => TEACHER_DATA[teachers.indexOf(t)].specialty === subject.name) || randomFrom(teachers)

        await prisma.grade.create({
          data: {
            tenantId: tenant.id,
            studentId: student.id,
            subjectId: subject.id,
            teacherId: teacherForSubject.id,
            periodId: academicYear.periods[0].id,
            value: randomInt(5, 20),
            maxValue: 20,
            coefficient: subject.coefficient,
            evaluationType: evalType,
            evaluationLabel: EVALUATION_LABELS[evalType],
            comment: Math.random() > 0.5 ? undefined : randomFrom(['Bon travail', 'Peut mieux faire', 'Encourageant', 'Doit fournir plus d\'efforts', 'Excellent travail', 'Continue ainsi']),
            semester: 1,
            isPublished: true,
          },
        })
      }
    }
  }

  // Create Attendance records (20 days per student)
  const attendanceStatuses: AttendanceStatus[] = ['PRESENT', 'PRESENT', 'PRESENT', 'PRESENT', 'LATE', 'ABSENT', 'EXCUSED']
  for (const student of createdStudents) {
    for (let day = 0; day < 20; day++) {
      const date = new Date('2025-09-01')
      date.setDate(date.getDate() + day)
      if (date.getDay() === 0 || date.getDay() === 6) continue

      const status = randomFrom(attendanceStatuses)
      await prisma.attendance.create({
        data: {
          tenantId: tenant.id,
          studentId: student.id,
          date,
          status,
          justification: status === 'ABSENT' ? randomFrom(['Maladie', 'Famille', 'Raison personnelle']) : status === 'EXCUSED' ? randomFrom(['Rendez-vous médical', 'Sport', 'Raison familiale']) : undefined,
        },
      })
    }
  }

  // Create Payments (multiple per student)
  for (const student of createdStudents) {
    for (const fee of feeStructures) {
      if (Math.random() > 0.7) continue
      const paidAmount = Math.random() > 0.25 ? fee.amount : randomInt(0, Math.floor(fee.amount * 0.5))

      await prisma.payment.create({
        data: {
          tenantId: tenant.id,
          studentId: student.id,
          feeStructureId: fee.id,
          amount: fee.amount,
          paidAmount,
          dueDate: new Date(2025, fee.dueDay > 0 ? fee.dueDay - 1 : 0, fee.dueDay || 15),
          paidAt: paidAmount >= fee.amount ? new Date() : null,
          status: paidAmount >= fee.amount ? 'PAID' : paidAmount > 0 ? 'OVERDUE' : 'PENDING',
          paymentMethod: paidAmount > 0 ? randomFrom(['bank_transfer', 'check', 'cash', 'card']) : undefined,
          reference: `PAY-${tenantConfig.subdomain.toUpperCase().slice(0, 3)}-${randomUUID().slice(0, 8).toUpperCase()}`,
          receiptNumber: paidAmount >= fee.amount ? `REC-${String(randomInt(1000, 9999))}` : undefined,
          notes: Math.random() > 0.7 ? 'Paiement effectué en ligne' : undefined,
        },
      })
    }
  }

  // Create Messages
  const allUsers = [adminUser, superAdminUser, secretaryUser, ...teacherUsers, ...parentUsers]
  for (const msg of MESSAGES_CONTENT) {
    const sender = randomFrom(allUsers)
    const message = await prisma.message.create({
      data: {
        tenantId: tenant.id,
        senderId: sender.id,
        subject: msg.subject,
        body: msg.body,
        priority: msg.priority,
        status: randomFrom<MessageStatus>(['SENT', 'DELIVERED', 'READ']),
        readAt: Math.random() > 0.4 ? new Date() : undefined,
        recipients: {
          create: allUsers
            .filter(u => u.id !== sender.id && Math.random() > 0.5)
            .map(u => ({
              userId: u.id,
              status: randomFrom<MessageStatus>(['SENT', 'DELIVERED', 'READ']),
              readAt: Math.random() > 0.3 ? new Date() : undefined,
            })),
        },
      },
    })
  }

  // Create Documents (15+ documents)
  const documentCategories: DocumentCategory[] = ['ADMINISTRATIVE', 'MEDICAL', 'PEDAGOGICAL', 'FINANCIAL', 'OTHER']
  for (let i = 0; i < 20; i++) {
    const student = randomFrom(createdStudents)
    const category = randomFrom(documentCategories)
    const fileNames: Record<DocumentCategory, string> = {
      ADMINISTRATIVE: 'Certificat de scolarité',
      MEDICAL: 'Certificat médical',
      PEDAGOGICAL: 'Bulletin trimestriel',
      FINANCIAL: 'Reçu de paiement',
      OTHER: 'Document divers',
    }

    await prisma.document.create({
      data: {
        tenantId: tenant.id,
        studentId: student.id,
        category,
        fileName: `${fileNames[category].toLowerCase().replace(/\s/g, '-')}-${student.id.slice(0, 8)}.pdf`,
        originalName: `${fileNames[category]} - ${student.firstName} ${student.lastName}.pdf`,
        mimeType: 'application/pdf',
        size: randomInt(1024 * 50, 1024 * 500),
        path: `/storage/tenant_${tenant.id}/documents/${student.id}/${fileNames[category].toLowerCase().replace(/\s/g, '-')}.pdf`,
        uploadedBy: randomFrom([adminUser.id, secretaryUser.id]),
      },
    })
  }

  // Create Audit Logs (15+ logs)
  const auditActions = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'EXPORT', 'IMPORT']
  const entityTypes = ['User', 'Student', 'Class', 'Subject', 'Grade', 'Payment', 'Attendance', 'Message', 'Document', 'Teacher']
  for (let i = 0; i < 20; i++) {
    await prisma.auditLog.create({
      data: {
        tenantId: tenant.id,
        userId: randomFrom(allUsers).id,
        action: randomFrom(auditActions),
        entityType: randomFrom(entityTypes),
        entityId: randomUUID().slice(0, 12),
        newValue: { timestamp: new Date().toISOString(), description: `Action ${i + 1} sur ${tenantConfig.name}` },
        metadata: { userAgent: 'Seed-Script/1.0', ipAddress: '127.0.0.1' },
      },
    })
  }

  // Create Sync Devices (3 devices)
  const devices = [
    { deviceId: `device-${tenant.id}-app1`, deviceName: 'Application Mobile Android - Samsung Galaxy Tab' },
    { deviceId: `device-${tenant.id}-app2`, deviceName: 'Application Mobile iOS - iPad Pro' },
    { deviceId: `device-${tenant.id}-web1`, deviceName: 'Navigateur Web - Chrome Desktop' },
    { deviceId: `device-${tenant.id}-tablet`, deviceName: 'Tablette Huawei MediaPad' },
    { deviceId: `device-${tenant.id}-laptop`, deviceName: 'Ordinateur Portable Dell Latitude' },
  ]

  const createdDevices = await Promise.all(
    devices.map(d =>
      prisma.syncDevice.create({
        data: {
          tenantId: tenant.id,
          deviceId: d.deviceId,
          deviceName: d.deviceName,
          lastSyncAt: new Date(),
          lastSyncTimestamp: new Date(),
        },
      })
    )
  )

  // Create Sync Logs
  const syncOperations: SyncOperation[] = ['CREATE', 'UPDATE', 'DELETE']
  const syncEntityTypes = ['Student', 'Grade', 'Attendance', 'Payment']
  for (let i = 0; i < 25; i++) {
    const device = randomFrom(createdDevices)
    const entityType = randomFrom(syncEntityTypes)
    const entity = entityType === 'Student' ? randomFrom(createdStudents) : null

    await prisma.syncLog.create({
      data: {
        tenantId: tenant.id,
        deviceId: device.deviceId,
        entityType,
        entityId: entity?.id || randomUUID().slice(0, 12),
        operation: randomFrom(syncOperations),
        payload: { data: `Sync payload for ${entityType} #${i + 1}`, timestamp: Date.now() },
        status: randomFrom<SyncStatus>(['SYNCED', 'SYNCED', 'SYNCED', 'PENDING']),
        serverVersion: i + 1,
        syncedAt: Math.random() > 0.2 ? new Date() : undefined,
      },
    })
  }

  // Create Sync Jobs
  const jobTypes = ['PROCESS_BATCH', 'RESOLVE_CONFLICT', 'PUSH_CHANGES', 'FILE_UPLOAD']
  for (let i = 0; i < 15; i++) {
    await prisma.syncJob.create({
      data: {
        tenantId: tenant.id,
        jobType: randomFrom(jobTypes),
        payload: { jobId: i + 1, tenantId: tenant.id, createdAt: Date.now() },
        status: randomFrom(['PENDING', 'COMPLETED', 'FAILED', 'IN_PROGRESS']),
        priority: randomInt(0, 5),
        retryCount: randomInt(0, 3),
        processedAt: Math.random() > 0.3 ? new Date() : undefined,
        error: Math.random() > 0.85 ? 'Connection timeout after 30s' : undefined,
      },
    })
  }

  console.log(`\n📊 ${tenantConfig.name}:`)
  console.log(`   Users: ${allUsers.length} | Teachers: ${teachers.length} | Subjects: ${subjects.length} | Classes: ${classes.length}`)
  console.log(`   Students: ${createdStudents.length}`)
  console.log(`   FeeStructures: ${feeStructures.length} | Messages: ${MESSAGES_CONTENT.length} | Documents: 20`)
  console.log(`   TimetableSlots: ${timetableSlotsCount} | AuditLogs: 20 | SyncDevices: ${createdDevices.length}`)

  return {
    tenant: { id: tenant.id, name: tenant.name, subdomain: tenant.subdomain },
    users: allUsers,
    classes,
    subjects,
    students: createdStudents,
    teachers,
  }
}

async function seed() {
  console.log('🌱 Starting comprehensive database seed...')
  const startTime = Date.now()
  await prisma.$connect()
  console.log('✅ Connected to database')

  console.log('🧹 Cleaning existing data...')
  await prisma.syncJob.deleteMany()
  await prisma.syncLog.deleteMany()
  await prisma.syncDevice.deleteMany()
  await prisma.teacherPayment.deleteMany()
  await prisma.teacherAttendance.deleteMany()
  await prisma.teacherContract.deleteMany()
  await prisma.teacher.deleteMany()
  await prisma.timetableSlot.deleteMany()
  await prisma.messageRecipient.deleteMany()
  await prisma.message.deleteMany()
  await prisma.document.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.grade.deleteMany()
  await prisma.attendance.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.studentParent.deleteMany()
  await prisma.student.deleteMany()
  await prisma.userPhone.deleteMany()
  await prisma.user.deleteMany()
  await prisma.subject.deleteMany()
  await prisma.class.deleteMany()
  await prisma.holiday.deleteMany()
  await prisma.period.deleteMany()
  await prisma.academicYear.deleteMany()
  await prisma.feeStructure.deleteMany()
  await prisma.tenant.deleteMany()
  console.log('✅ Cleaned existing data')

  const results: any[] = []
  for (let i = 0; i < TENANTS.length; i++) {
    const result = await seedTenant(TENANTS[i], i, results)
    results.push(result)
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log('\n' + '='.repeat(60))
  console.log(`🎉 ALL ${TENANTS.length} TENANTS SEEDED SUCCESSFULLY in ${elapsed}s`)
  console.log('='.repeat(60))

  console.log('\n🔐 Default credentials (all tenants):')
  console.log('  Admin:      admin@{subdomain}.fr / Admin123!')
  console.log('  SuperAdmin: superadmin@ecole-saas.com / Admin123!')
  console.log('  Teacher:    teacher{1-10}@{subdomain}.fr / Teacher123!')
  console.log('  Secretary:  secretariat@{subdomain}.fr / Secretary123!')
  console.log('  Parent:     parent{1-12}@{subdomain}.fr / Parent123!')

  console.log('\n📋 Tenant summary:')
  for (const r of results) {
    console.log(`  • ${r.tenant.name} (${r.tenant.subdomain})`)
  }

  await prisma.$disconnect()
  console.log('\n✅ Database connection closed')
}

seed().catch(async (error) => {
  console.error('❌ Seed failed:', error)
  await prisma.$disconnect()
  process.exit(1)
})

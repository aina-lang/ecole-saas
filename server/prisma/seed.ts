import { PrismaClient, UserRole, AttendanceStatus, PaymentStatus, DocumentCategory } from '@prisma/client'
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
    plan: 'FREE' as const,
    status: 'ACTIVE' as const,
    maxStudents: 200,
    maxTeachers: 20,
    maxStorageMb: 2000,
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
]

type SeedTenant = typeof TENANTS[number]

interface SeedResult {
  tenant: { id: string; name: string; subdomain: string }
  users: { id: string; email: string | null; role: UserRole }[]
  classes: { id: string; name: string }[]
  subjects: { id: string; name: string }[]
  students: { id: string; firstName: string; lastName: string }[]
  teachers: { id: string; userId: string }[]
}

async function seedTenant(tenantConfig: SeedTenant): Promise<SeedResult> {
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
      settings: {
        create: tenantConfig.settings,
      },
    },
  })

  const passwordHash = await bcrypt.hash('Admin123!', 12)
  const teacherPasswordHash = await bcrypt.hash('Teacher123!', 12)
  const secretaryPasswordHash = await bcrypt.hash('Secretary123!', 12)
  const parentPasswordHash = await bcrypt.hash('Parent123!', 12)

  const adminUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: tenantConfig.settings.email.replace('contact@', 'admin@'),
      passwordHash,
      firstName: tenantConfig.settings.directorName.split(' ').slice(1).join(' ') || 'Admin',
      lastName: tenantConfig.settings.directorName.split(' ')[0] || 'Admin',
      role: 'ADMIN',
      isActive: true,
      phones: { create: [{ value: tenantConfig.settings.phone, sortOrder: 0 }] },
    },
  })

  const superAdminUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'superadmin@ecole-saas.com',
      passwordHash,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  })

  const teacher1User = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: `teacher1@${tenantConfig.subdomain}.fr`,
      passwordHash: teacherPasswordHash,
      firstName: 'Jean',
      lastName: 'Dupont',
      role: 'TEACHER',
      isActive: true,
      phones: { create: [{ value: '+33 6 98 76 54 32', sortOrder: 0 }] },
    },
  })

  const teacher2User = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: `teacher2@${tenantConfig.subdomain}.fr`,
      passwordHash: teacherPasswordHash,
      firstName: 'Sophie',
      lastName: 'Martin',
      role: 'TEACHER',
      isActive: true,
      phones: { create: [{ value: '+33 6 11 22 33 44', sortOrder: 0 }] },
    },
  })

  const teacher3User = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: `teacher3@${tenantConfig.subdomain}.fr`,
      passwordHash: teacherPasswordHash,
      firstName: 'Pierre',
      lastName: 'Bernard',
      role: 'TEACHER',
      isActive: true,
      phones: { create: [{ value: '+33 6 55 66 77 88', sortOrder: 0 }] },
    },
  })

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

  const parent1User = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: `parent1@${tenantConfig.subdomain}.fr`,
      passwordHash: parentPasswordHash,
      firstName: 'Thomas',
      lastName: ' Petit',
      role: 'PARENT',
      isActive: true,
      phones: { create: [{ value: '+33 6 11 11 11 11', sortOrder: 0 }] },
    },
  })

  const parent2User = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: `parent2@${tenantConfig.subdomain}.fr`,
      passwordHash: parentPasswordHash,
      firstName: 'Isabelle',
      lastName: 'Roux',
      role: 'PARENT',
      isActive: true,
      phones: { create: [{ value: '+33 6 22 22 22 22', sortOrder: 0 }] },
    },
  })

  const teacher1 = await prisma.teacher.create({
    data: { tenantId: tenant.id, userId: teacher1User.id, specialty: 'Mathématiques' },
  })

  const teacher2 = await prisma.teacher.create({
    data: { tenantId: tenant.id, userId: teacher2User.id, specialty: 'Français' },
  })

  const teacher3 = await prisma.teacher.create({
    data: { tenantId: tenant.id, userId: teacher3User.id, specialty: 'Physique-Chimie' },
  })

  const subjects = await Promise.all([
    prisma.subject.create({ data: { tenantId: tenant.id, name: 'Mathématiques', code: 'MATH', level: '2nde', coefficient: 4 } }),
    prisma.subject.create({ data: { tenantId: tenant.id, name: 'Français', code: 'FR', level: '2nde', coefficient: 3 } }),
    prisma.subject.create({ data: { tenantId: tenant.id, name: 'Physique-Chimie', code: 'PC', level: '2nde', coefficient: 3 } }),
    prisma.subject.create({ data: { tenantId: tenant.id, name: 'Histoire-Géographie', code: 'HG', level: '2nde', coefficient: 2 } }),
    prisma.subject.create({ data: { tenantId: tenant.id, name: 'Anglais', code: 'ANG', level: '2nde', coefficient: 2 } }),
    prisma.subject.create({ data: { tenantId: tenant.id, name: 'SVT', code: 'SVT', level: '2nde', coefficient: 2 } }),
    prisma.subject.create({ data: { tenantId: tenant.id, name: 'EPS', code: 'EPS', level: '2nde', coefficient: 1 } }),
    prisma.subject.create({ data: { tenantId: tenant.id, name: 'Mathématiques', code: 'MATH', level: '1ère', coefficient: 4 } }),
    prisma.subject.create({ data: { tenantId: tenant.id, name: 'Français', code: 'FR', level: '1ère', coefficient: 3 } }),
    prisma.subject.create({ data: { tenantId: tenant.id, name: 'Physique-Chimie', code: 'PC', level: '1ère', coefficient: 3 } }),
  ])

  const class2nde = await prisma.class.create({
    data: { tenantId: tenant.id, name: '2nde A', level: '2nde', room: 'Bâtiment A - Salle 12', capacity: 30 },
  })

  const class2ndeB = await prisma.class.create({
    data: { tenantId: tenant.id, name: '2nde B', level: '2nde', room: 'Bâtiment A - Salle 13', capacity: 30 },
  })

  const class1ere = await prisma.class.create({
    data: { tenantId: tenant.id, name: '1ère A', level: '1ère', room: 'Bâtiment B - Salle 21', capacity: 30 },
  })

  await prisma.teacher.update({
    where: { id: teacher1.id },
    data: { classes: { connect: [{ id: class2nde.id }, { id: class2ndeB.id }, { id: class1ere.id }] } },
  })
  await prisma.teacher.update({
    where: { id: teacher2.id },
    data: { classes: { connect: [{ id: class2nde.id }, { id: class2ndeB.id }] } },
  })
  await prisma.teacher.update({
    where: { id: teacher3.id },
    data: { classes: { connect: [{ id: class2nde.id }, { id: class1ere.id }] } },
  })

  await prisma.teacher.update({
    where: { id: teacher1.id },
    data: { subjects: { connect: [{ id: subjects[0].id }, { id: subjects[7].id }] } },
  })
  await prisma.teacher.update({
    where: { id: teacher2.id },
    data: { subjects: { connect: [{ id: subjects[1].id }, { id: subjects[8].id }] } },
  })
  await prisma.teacher.update({
    where: { id: teacher3.id },
    data: { subjects: { connect: [{ id: subjects[2].id }, { id: subjects[9].id }] } },
  })

  await prisma.class.update({
    where: { id: class2nde.id },
    data: { subjects: { connect: subjects.slice(0, 7).map(s => ({ id: s.id })) } },
  })
  await prisma.class.update({
    where: { id: class2ndeB.id },
    data: { subjects: { connect: subjects.slice(0, 7).map(s => ({ id: s.id })) } },
  })
  await prisma.class.update({
    where: { id: class1ere.id },
    data: { subjects: { connect: subjects.slice(7, 10).map(s => ({ id: s.id })) } },
  })

  const studentsData = [
    { firstName: 'Lucas', lastName: 'Petit', gender: 'M', birthDate: new Date('2008-03-15'), classId: class2nde.id, parentId: parent1User.id },
    { firstName: 'Emma', lastName: 'Petit', gender: 'F', birthDate: new Date('2009-07-22'), classId: class2nde.id, parentId: parent1User.id },
    { firstName: 'Gabriel', lastName: 'Roux', gender: 'M', birthDate: new Date('2008-11-05'), classId: class2nde.id, parentId: parent2User.id },
    { firstName: 'Jade', lastName: 'Roux', gender: 'F', birthDate: new Date('2009-01-30'), classId: class2nde.id, parentId: parent2User.id },
    { firstName: 'Louis', lastName: 'Moreau', gender: 'M', birthDate: new Date('2008-06-12'), classId: class2ndeB.id, parentId: parent1User.id },
    { firstName: 'Chloé', lastName: 'Moreau', gender: 'F', birthDate: new Date('2009-09-08'), classId: class2ndeB.id, parentId: parent1User.id },
    { firstName: 'Hugo', lastName: 'Durand', gender: 'M', birthDate: new Date('2008-12-01'), classId: class2ndeB.id, parentId: parent2User.id },
    { firstName: 'Léa', lastName: 'Durand', gender: 'F', birthDate: new Date('2009-04-18'), classId: class2ndeB.id, parentId: parent2User.id },
    { firstName: 'Nathan', lastName: 'Leroy', gender: 'M', birthDate: new Date('2008-08-25'), classId: class1ere.id, parentId: parent1User.id },
    { firstName: 'Manon', lastName: 'Leroy', gender: 'F', birthDate: new Date('2009-02-14'), classId: class1ere.id, parentId: parent1User.id },
    { firstName: 'Théo', lastName: 'Girard', gender: 'M', birthDate: new Date('2008-10-30'), classId: class1ere.id, parentId: parent2User.id },
    { firstName: 'Camille', lastName: 'Girard', gender: 'F', birthDate: new Date('2009-05-09'), classId: class1ere.id, parentId: parent2User.id },
  ]

  const createdStudents: Array<{ id: string; firstName: string; lastName: string }> = []
  for (const s of studentsData) {
    const student = await prisma.student.create({
      data: {
        tenantId: tenant.id,
        firstName: s.firstName,
        lastName: s.lastName,
        gender: s.gender,
        birthDate: s.birthDate,
        classId: s.classId,
        status: 'ACTIVE',
        registrationNumber: `${tenantConfig.subdomain.toUpperCase().slice(0, 3)}-${new Date().getFullYear()}-${String(createdStudents.length + 1).padStart(5, '0')}`,
        enrollmentDate: new Date('2025-09-01'),
        parents: { create: { parentId: s.parentId, relation: 'PARENT', isPrimary: true } },
      },
      include: { parents: true },
    })
    createdStudents.push({ id: student.id, firstName: student.firstName, lastName: student.lastName })
  }

  const evaluationTypes = ['EXAM', 'TEST', 'HOMEWORK', 'PROJECT']
  for (const student of createdStudents) {
    for (const subject of subjects.slice(0, 4)) {
      const evalType = evaluationTypes[Math.floor(Math.random() * evaluationTypes.length)]
      const value = Math.floor(Math.random() * 10) + 10
      await prisma.grade.create({
        data: {
          tenantId: tenant.id,
          studentId: student.id,
          subjectId: subject.id,
          teacherId: teacher1.id,
          value,
          maxValue: 20,
          coefficient: subject.coefficient,
          evaluationType: evalType,
          evaluationLabel: evalType === 'EXAM' ? 'Examen trimestriel' : evalType === 'TEST' ? 'Contrôle continu' : evalType === 'HOMEWORK' ? 'Devoir' : 'Projet',
          comment: evalType === 'EXAM' ? "Note d'examen trimestriel" : undefined,
          semester: 1,
          isPublished: true,
        },
      })
    }
  }

  const attendanceStatuses: AttendanceStatus[] = ['PRESENT', 'PRESENT', 'PRESENT', 'LATE', 'EXCUSED', 'ABSENT']
  for (let day = 1; day <= 10; day++) {
    const date = new Date()
    date.setDate(date.getDate() - day)
    for (const student of createdStudents) {
      const status = attendanceStatuses[Math.floor(Math.random() * attendanceStatuses.length)]
      await prisma.attendance.create({
        data: {
          tenantId: tenant.id,
          studentId: student.id,
          date,
          status,
          justification: status === 'ABSENT' ? 'Maladie' : status === 'EXCUSED' ? 'Rendez-vous médical' : undefined,
        },
      })
    }
  }

  const baseAmount = 3000
  for (const student of createdStudents) {
    const paidAmount = Math.random() > 0.3 ? baseAmount : Math.floor(baseAmount * 0.5)
    await prisma.payment.create({
      data: {
        tenantId: tenant.id,
        studentId: student.id,
        amount: baseAmount,
        paidAmount,
        dueDate: new Date('2025-10-15'),
        status: paidAmount >= baseAmount ? 'PAID' : paidAmount > 0 ? 'OVERDUE' : 'PENDING',
        paymentMethod: paidAmount > 0 ? 'bank_transfer' : undefined,
        reference: `PAY-${randomUUID().slice(0, 8).toUpperCase()}`,
      },
    })
  }

  const timeSlots = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00']
  const days = [1, 2, 3, 4, 5]
  for (const cls of [class2nde, class2ndeB, class1ere]) {
    const classWithRelations = await prisma.class.findUnique({
      where: { id: cls.id },
      include: { teachers: { include: { subjects: true } }, subjects: true },
    })
    if (!classWithRelations || !classWithRelations.subjects.length) continue

    const classTeachers = classWithRelations.teachers
    const classSubjects = classWithRelations.subjects
    let slotIndex = 0
    for (const day of days) {
      for (const time of timeSlots) {
        if (slotIndex >= classSubjects.length) break
        const subject = classSubjects[slotIndex % classSubjects.length]
        const teacher = classTeachers.find(t => t.subjects.some(ts => (ts as any).subjectId === subject.id)) || classTeachers[0]
        await prisma.timetableSlot.create({
          data: {
            tenantId: tenant.id,
            classId: cls.id,
            subjectId: subject.id,
            teacherId: teacher?.id || undefined,
            dayOfWeek: day,
            startTime: time,
            endTime: time === '16:00' ? '17:00' : `${time.split(':')[0]}:50`,
            room: cls.room,
          },
        })
        slotIndex++
      }
    }
  }

  await prisma.feeStructure.createMany({
    data: [
      { tenantId: tenant.id, label: "Frais d'inscription", amount: 500, dueDay: 15, description: 'Frais annuels d\'inscription', isActive: true },
      { tenantId: tenant.id, label: 'Frais de scolarité - Trimestre 1', amount: 1500, dueDay: 30, description: 'Premier trimestre', isActive: true },
      { tenantId: tenant.id, label: 'Frais de scolarité - Trimestre 2', amount: 1500, dueDay: 15, description: 'Deuxième trimestre', isActive: true },
      { tenantId: tenant.id, label: 'Frais de scolarité - Trimestre 3', amount: 1500, dueDay: 0, description: 'Troisième trimestre', isActive: true },
    ],
  })

  for (const student of createdStudents.slice(0, 5)) {
    await prisma.document.create({
      data: {
        tenantId: tenant.id,
        studentId: student.id,
        category: 'OTHER',
        fileName: `bulletins-${student.lastName}.pdf`,
        originalName: `Bulletin trimestriel - ${student.firstName} ${student.lastName}.pdf`,
        mimeType: 'application/pdf',
        size: 1024 * 250,
        path: `/storage/tenant_${tenant.id}/documents/bulletin-${student.id}.pdf`,
        uploadedBy: adminUser.id,
      },
    })
  }

  await prisma.auditLog.createMany({
    data: [
      {
        tenantId: tenant.id,
        userId: adminUser.id,
        action: 'CREATE',
        entityType: 'Tenant',
        entityId: tenant.id,
        newValue: { name: tenant.name, subdomain: tenant.subdomain },
      },
      {
        tenantId: tenant.id,
        userId: adminUser.id,
        action: 'CREATE',
        entityType: 'User',
        entityId: teacher1User.id,
        newValue: { email: teacher1User.email, role: teacher1User.role },
      },
      {
        tenantId: tenant.id,
        userId: adminUser.id,
        action: 'CREATE',
        entityType: 'Class',
        entityId: class2nde.id,
        newValue: { name: class2nde.name, level: class2nde.level },
      },
    ],
  })

  console.log(`\n📊 ${tenantConfig.name}:`)
  console.log(`   Users: 8 | Teachers: 3 | Subjects: 10 | Classes: 3`)
  console.log(`   Students: ${createdStudents.length} | Grades: ${createdStudents.length * 4} | Attendance: ${createdStudents.length * 10} | Payments: ${createdStudents.length}`)

  return {
    tenant: { id: tenant.id, name: tenant.name, subdomain: tenant.subdomain },
    users: [
      { id: adminUser.id, email: adminUser.email, role: 'ADMIN' },
      { id: superAdminUser.id, email: superAdminUser.email, role: 'SUPER_ADMIN' },
      { id: teacher1User.id, email: teacher1User.email, role: 'TEACHER' },
      { id: teacher2User.id, email: teacher2User.email, role: 'TEACHER' },
      { id: teacher3User.id, email: teacher3User.email, role: 'TEACHER' },
      { id: secretaryUser.id, email: secretaryUser.email, role: 'SECRETARY' },
      { id: parent1User.id, email: parent1User.email, role: 'PARENT' },
      { id: parent2User.id, email: parent2User.email, role: 'PARENT' },
    ],
    classes: [
      { id: class2nde.id, name: class2nde.name },
      { id: class2ndeB.id, name: class2ndeB.name },
      { id: class1ere.id, name: class1ere.name },
    ],
    subjects: subjects.map(s => ({ id: s.id, name: s.name })),
    students: createdStudents.map(s => ({ id: s.id, firstName: s.firstName, lastName: s.lastName })),
    teachers: [
      { id: teacher1.id, userId: teacher1.userId },
      { id: teacher2.id, userId: teacher2.userId },
      { id: teacher3.id, userId: teacher3.userId },
    ],
  }
}

async function seed() {
  console.log('🌱 Starting database seed...')
  await prisma.$connect()
  console.log('✅ Connected to database')

  console.log('🧹 Cleaning existing data...')
  await prisma.attendance.deleteMany()
  await prisma.grade.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.studentParent.deleteMany()
  await prisma.document.deleteMany()
  await prisma.timetableSlot.deleteMany()
  await prisma.student.deleteMany()
  await prisma.teacher.deleteMany()
  await prisma.user.deleteMany()
  await prisma.subject.deleteMany()
  await prisma.class.deleteMany()
  await prisma.feeStructure.deleteMany()
  await prisma.message.deleteMany()
  await prisma.messageRecipient.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.syncDevice.deleteMany()
  await prisma.syncLog.deleteMany()
  await prisma.syncJob.deleteMany()
  await prisma.tenant.deleteMany()
  console.log('✅ Cleaned existing data')

  const results: SeedResult[] = []
  for (const tenantConfig of TENANTS) {
    const result = await seedTenant(tenantConfig)
    results.push(result)
  }

  console.log('\n🎉 All tenants seeded successfully!')
  console.log('\n🔐 Default credentials (all tenants):')
  console.log('  Admin: admin@{subdomain}.fr / Admin123!')
  console.log('  Super Admin: superadmin@ecole-saas.com / Admin123!')
  console.log('  Teacher: teacher1@{subdomain}.fr / Teacher123!')
  console.log('  Secretary: secretariat@{subdomain}.fr / Secretary123!')
  console.log('  Parent: parent1@{subdomain}.fr / Parent123!')

  await prisma.$disconnect()
  console.log('\n✅ Database connection closed')
  return results
}

seed().catch((error) => {
  console.error('❌ Seed failed:', error)
  process.exit(1)
})

import { createHash } from 'crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaClient as SchedulingPrismaClient } from '../../apps/scheduling-service/src/generated/prisma-client';

const prisma = new PrismaClient();
const schedulingPrisma = new SchedulingPrismaClient({
  datasources: {
    db: {
      url:
        process.env.SCHEDULING_DATABASE_URL ||
        'postgresql://medcrm:medcrm_password@localhost:5432/medcrm_scheduling?schema=public',
    },
  },
});

const modules = [
  { code: 'auth', name: 'Auth/RBAC', version: '1.0.0', isCore: true, dependencies: [] },
  {
    code: 'organization-structure',
    name: 'Organization Structure',
    version: '1.0.0',
    isCore: false,
    dependencies: ['auth'],
  },
  {
    code: 'patient-crm',
    name: 'Patient CRM',
    version: '1.0.0',
    isCore: false,
    dependencies: ['auth', 'organization-structure'],
  },
  {
    code: 'smart-scheduling',
    name: 'Smart Scheduling',
    version: '1.0.0',
    isCore: false,
    dependencies: ['auth', 'organization-structure', 'patient-crm'],
  },
  {
    code: 'receptionist-workplace',
    name: 'Receptionist Workplace',
    version: '1.0.0',
    isCore: false,
    dependencies: ['auth', 'patient-crm', 'smart-scheduling'],
  },
  {
    code: 'communications',
    name: 'Communications',
    version: '1.0.0',
    isCore: false,
    dependencies: ['auth', 'patient-crm'],
  },
  {
    code: 'emr-ehr',
    name: 'EMR/EHR Clinical Module',
    version: '1.0.0',
    isCore: false,
    dependencies: ['auth', 'patient-crm', 'smart-scheduling'],
  },
  {
    code: 'finance-billing',
    name: 'Finance and SaaS Billing Module',
    version: '1.0.0',
    isCore: false,
    dependencies: ['auth', 'patient-crm', 'smart-scheduling', 'receptionist-workplace'],
  },
  {
    code: 'integration-gateway',
    name: 'Laboratories, Files & Integration Gateway',
    version: '1.0.0',
    isCore: false,
    dependencies: ['auth'],
  },
  {
    code: 'business-intelligence',
    name: 'Business Intelligence & Executive Dashboards',
    version: '1.0.0',
    isCore: false,
    dependencies: ['auth'],
  },
  {
    code: 'inventory-warehouse',
    name: 'Inventory & Warehouse',
    version: '1.0.0',
    isCore: false,
    dependencies: ['auth', 'organization-structure', 'finance-billing'],
  },
];

const permissions = [
  ['auth', 'auth.bootstrap.read', 'Read bootstrap payload'],
  ['auth', 'users.read', 'Read users'],
  ['auth', 'users.manage', 'Manage users'],
  ['auth', 'roles.manage', 'Manage roles'],
  ['auth', 'system.settings.read', 'Read tenant settings, modules, roles'],
  ['auth', 'system.settings.manage', 'Manage tenant profile and module configuration'],
  ['auth', 'system.audit.read', 'Read tenant audit log entries'],
  ['organization-structure', 'organization.branches.read', 'Read branches'],
  ['organization-structure', 'organization.branches.manage', 'Manage branches'],
  ['organization-structure', 'organization.employees.read', 'Read employees'],
  ['organization-structure', 'organization.employees.manage', 'Manage employees'],
  ['patient-crm', 'patients.read', 'Read patients'],
  ['patient-crm', 'patients.create', 'Create patients'],
  ['patient-crm', 'patients.update', 'Update patients'],
  ['patient-crm', 'patients.contacts.read', 'Read patient contacts'],
  ['patient-crm', 'patients.contacts.manage', 'Manage patient contacts'],
  ['patient-crm', 'patients.export', 'Export patients'],
  ['patient-crm', 'patients.documents.read', 'Read patient legal documents'],
  ['patient-crm', 'patients.documents.manage', 'Sign/manage patient legal documents'],
  ['patient-crm', 'patients.tags.manage', 'Manage CRM tags and patient tagging'],
  ['patient-crm', 'patients.family.manage', 'Manage patient family groups and members'],
  ['patient-crm', 'patients.notes.read', 'Read internal patient notes'],
  ['patient-crm', 'patients.notes.manage', 'Create/delete patient notes'],
  ['patient-crm', 'patients.metrics.read', 'Read patient CRM metrics & attribution'],
  ['smart-scheduling', 'scheduling.appointments.read', 'Read appointments'],
  ['smart-scheduling', 'scheduling.appointments.create', 'Create appointments'],
  ['smart-scheduling', 'scheduling.appointments.update', 'Update appointments'],
  ['smart-scheduling', 'scheduling.appointments.cancel', 'Cancel appointments'],
  ['smart-scheduling', 'scheduling.calendar.read', 'Read calendar'],
  ['smart-scheduling', 'scheduling.availability.read', 'Read availability'],
  ['receptionist-workplace', 'reception.dashboard.read', 'Read reception dashboard'],
  ['receptionist-workplace', 'reception.dashboard.manage', 'Manage reception dashboard'],
  ['receptionist-workplace', 'reception.fast_booking.create', 'Create fast booking'],
  ['receptionist-workplace', 'reception.patient.inline_create', 'Inline create patient'],
  ['receptionist-workplace', 'reception.queue.read', 'Read queue'],
  ['receptionist-workplace', 'reception.queue.manage', 'Manage queue'],
  ['receptionist-workplace', 'reception.visit.checkin', 'Check in patient'],
  ['receptionist-workplace', 'reception.visit.status_manage', 'Manage visit status'],
  ['receptionist-workplace', 'reception.calls.read', 'Read call logs'],
  ['receptionist-workplace', 'reception.calls.manage', 'Manage incoming calls'],
  ['receptionist-workplace', 'reception.invoices.read', 'Read invoices'],
  ['receptionist-workplace', 'reception.invoices.prepare', 'Prepare invoices'],
  ['receptionist-workplace', 'reception.manual_override', 'Manual override control'],
  ['emr-ehr', 'emr.records.read', 'Read EMR medical records'],
  ['emr-ehr', 'emr.records.manage', 'Manage EMR medical records and episodes'],
  ['emr-ehr', 'emr.encounters.write', 'Write encounter drafts and notes'],
  ['emr-ehr', 'emr.encounters.sign', 'Sign encounter medical documents'],
  ['emr-ehr', 'emr.encounters.amend', 'Amend signed encounters'],
  ['emr-ehr', 'emr.templates.manage', 'Manage clinical templates'],
  ['emr-ehr', 'emr.fhir.read', 'Read HL7/FHIR exported resources'],
  ['finance-billing', 'finance.shift.manage', 'Manage cashier shifts'],
  ['finance-billing', 'finance.payment.create', 'Record cash desk payments'],
  ['finance-billing', 'finance.refund.manage', 'Record and approve refunds'],
  ['finance-billing', 'finance.payroll.manage', 'Manage rules and payrolls'],
  ['finance-billing', 'finance.billing.manage', 'Manage subscriptions and limits'],
  ['finance-billing', 'finance.invoice.read', 'Read clinical billing invoices'],
  ['communications', 'communications.inbox.read', 'Read operator omnichannel inbox'],
  ['communications', 'communications.message.send', 'Send outbound operator replies'],
  ['communications', 'communications.campaign.manage', 'Create and execute campaigns'],
  ['communications', 'communications.rule.manage', 'Manage notification rules and preferences'],
  ['communications', 'communications.chatbot.manage', 'Manage event-driven chatbots'],
  ['integration-gateway', 'integration.gateway.manage', 'Manage integration gateway'],
  ['integration-gateway', 'integration.lab.manage', 'Manage lab orders and integrations'],
  ['integration-gateway', 'integration.storage.manage', 'Manage cloud file storage registry'],
  [
    'integration-gateway',
    'integration.telephony.manage',
    'Manage IP telephony events and callbacks',
  ],
  ['business-intelligence', 'analytics.financial.view', 'View financial dashboard'],
  ['business-intelligence', 'analytics.marketing.view', 'View marketing ROI dashboard'],
  ['business-intelligence', 'analytics.operations.view', 'View operational efficiency dashboard'],
  ['business-intelligence', 'analytics.reports.manage', 'Manage BI scheduled reporting'],
  ['inventory-warehouse', 'inventory.warehouse.manage', 'Manage warehouses and inventory items'],
  ['inventory-warehouse', 'inventory.procure.manage', 'Record and manage supplier procurements'],
  [
    'inventory-warehouse',
    'inventory.transfer.manage',
    'Request and approve warehouse stock transfers',
  ],
  ['inventory-warehouse', 'inventory.bom.manage', 'Configure service BOM технологические карты'],
  ['inventory-warehouse', 'inventory.audit.manage', 'Conduct and log stock discrepancy audits'],
] as const;

async function main(): Promise<void> {
  const tenant = await prisma.tenant.upsert({
    where: { code: 'demo-clinic' },
    update: {},
    create: {
      code: 'demo-clinic',
      name: 'Demo Clinic',
      subscriptionPlan: 'enterprise',
      defaultLocale: 'ru',
      timezone: 'Europe/Moscow',
      status: 'active',
    },
  });

  const branch = await prisma.branch.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'main' } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: 'main',
      name: 'Main Branch',
      timezone: 'Europe/Moscow',
      status: 'active',
    },
  });

  const moduleByCode = new Map<string, string>();
  for (const item of modules) {
    const module = await prisma.systemModule.upsert({
      where: { code: item.code },
      update: {
        name: item.name,
        version: item.version,
        isCore: item.isCore,
        dependencies: item.dependencies,
      },
      create: {
        code: item.code,
        name: item.name,
        version: item.version,
        isCore: item.isCore,
        dependencies: item.dependencies,
        status: 'active',
      },
    });
    moduleByCode.set(item.code, module.id);
    await prisma.tenantModule.upsert({
      where: { tenantId_moduleId: { tenantId: tenant.id, moduleId: module.id } },
      update: { enabled: true, activatedAt: new Date() },
      create: {
        tenantId: tenant.id,
        moduleId: module.id,
        enabled: true,
        activatedAt: new Date(),
        configurationJson: {},
      },
    });
  }

  const permissionIds: string[] = [];
  for (const [moduleCode, code, name] of permissions) {
    const permission = await prisma.permission.upsert({
      where: { code },
      update: { name, moduleCode, moduleId: moduleByCode.get(moduleCode) },
      create: {
        code,
        name,
        moduleCode,
        moduleId: moduleByCode.get(moduleCode),
      },
    });
    permissionIds.push(permission.id);
  }

  const ownerRole = await prisma.role.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'CLINIC_OWNER' } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: 'CLINIC_OWNER',
      name: 'Clinic Owner',
      description: 'Full tenant administrator',
      isSystem: true,
    },
  });

  for (const permissionId of permissionIds) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: ownerRole.id, permissionId } },
      update: {},
      create: { roleId: ownerRole.id, permissionId },
    });
  }

  const passwordHash = await argon2.hash('Admin123!');
  const admin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@demo.clinic' } },
    update: { passwordHash, status: 'active' },
    create: {
      tenantId: tenant.id,
      email: 'admin@demo.clinic',
      passwordHash,
      firstName: 'Demo',
      lastName: 'Admin',
      language: 'ru',
      status: 'active',
      isSuperAdmin: false,
    },
  });

  await prisma.userBranchRole.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      userId: admin.id,
      tenantId: tenant.id,
      branchId: branch.id,
      roleId: ownerRole.id,
      isPrimary: true,
    },
  });

  const serviceConsultation = await prisma.service.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'consultation' } },
    update: {
      basePrice: new Prisma.Decimal(1500),
    },
    create: {
      tenantId: tenant.id,
      code: 'consultation',
      name: 'Консультация',
      durationMinutes: 30,
      color: '#0f766e',
      isOnlineBookable: true,
      basePrice: new Prisma.Decimal(1500),
    },
  });

  const serviceProcedure = await prisma.service.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'procedure' } },
    update: {
      basePrice: new Prisma.Decimal(3000),
    },
    create: {
      tenantId: tenant.id,
      code: 'procedure',
      name: 'Процедура',
      durationMinutes: 45,
      color: '#7c3aed',
      isOnlineBookable: true,
      basePrice: new Prisma.Decimal(3000),
    },
  });

  const serviceDentalTherapy = await prisma.service.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'dental-therapy' } },
    update: {
      basePrice: new Prisma.Decimal(4200),
      durationMinutes: 45,
      color: '#0ea5e9',
    },
    create: {
      tenantId: tenant.id,
      code: 'dental-therapy',
      name: 'Лечение кариеса',
      durationMinutes: 45,
      color: '#0ea5e9',
      isOnlineBookable: true,
      basePrice: new Prisma.Decimal(4200),
    },
  });

  const serviceCardioDiagnostics = await prisma.service.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'cardio-diagnostics' } },
    update: {
      basePrice: new Prisma.Decimal(2600),
      durationMinutes: 30,
      color: '#ef4444',
    },
    create: {
      tenantId: tenant.id,
      code: 'cardio-diagnostics',
      name: 'ЭКГ + консультация',
      durationMinutes: 30,
      color: '#ef4444',
      isOnlineBookable: true,
      basePrice: new Prisma.Decimal(2600),
    },
  });

  const servicePediatricConsultation = await prisma.service.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'pediatric-consultation' } },
    update: {
      basePrice: new Prisma.Decimal(1800),
      durationMinutes: 30,
      color: '#f97316',
    },
    create: {
      tenantId: tenant.id,
      code: 'pediatric-consultation',
      name: 'Прием педиатра',
      durationMinutes: 30,
      color: '#f97316',
      isOnlineBookable: true,
      basePrice: new Prisma.Decimal(1800),
    },
  });

  const serviceGynecologyConsultation = await prisma.service.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'gynecology-consultation' } },
    update: {
      basePrice: new Prisma.Decimal(2400),
      durationMinutes: 40,
      color: '#db2777',
    },
    create: {
      tenantId: tenant.id,
      code: 'gynecology-consultation',
      name: 'Прием гинеколога',
      durationMinutes: 40,
      color: '#db2777',
      isOnlineBookable: true,
      basePrice: new Prisma.Decimal(2400),
    },
  });

  const serviceUltrasoundAbdomen = await prisma.service.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'ultrasound-abdomen' } },
    update: {
      basePrice: new Prisma.Decimal(2200),
      durationMinutes: 30,
      color: '#14b8a6',
    },
    create: {
      tenantId: tenant.id,
      code: 'ultrasound-abdomen',
      name: 'УЗИ органов брюшной полости',
      durationMinutes: 30,
      color: '#14b8a6',
      isOnlineBookable: true,
      basePrice: new Prisma.Decimal(2200),
    },
  });

  const serviceDentalHygiene = await prisma.service.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'dental-hygiene' } },
    update: {
      basePrice: new Prisma.Decimal(3200),
      durationMinutes: 50,
      color: '#0891b2',
    },
    create: {
      tenantId: tenant.id,
      code: 'dental-hygiene',
      name: 'Профессиональная гигиена полости рта',
      durationMinutes: 50,
      color: '#0891b2',
      isOnlineBookable: true,
      basePrice: new Prisma.Decimal(3200),
    },
  });

  // 1. Specialties
  const specialtiesData = [
    { code: 'dentist', name: 'Стоматолог', internationalCode: 'DENT' },
    { code: 'gynecologist', name: 'Гинеколог', internationalCode: 'GYN' },
    { code: 'cardiologist', name: 'Кардиолог', internationalCode: 'CARD' },
    { code: 'pediatrician', name: 'Педиатр', internationalCode: 'PED' },
    { code: 'radiologist', name: 'Радиолог/Врач УЗИ', internationalCode: 'RAD' },
  ];

  const specialtyMap = new Map<string, string>();
  for (const spec of specialtiesData) {
    const s = await prisma.specialty.upsert({
      where: { code: spec.code },
      update: {},
      create: { ...spec, isSystem: true },
    });
    specialtyMap.set(spec.code, s.id);
  }

  // 2. Positions
  const positionsData = [
    { code: 'CHIEF_DOCTOR', name: 'Главный врач', isMedicalStaff: true },
    { code: 'DOCTOR', name: 'Врач-специалист', isMedicalStaff: true },
    { code: 'DOCTOR_USI', name: 'Врач УЗИ', isMedicalStaff: true },
    { code: 'NURSE', name: 'Медсестра', isMedicalStaff: true },
    { code: 'REGISTRAR', name: 'Регистратор/Администратор', isMedicalStaff: false },
    { code: 'CASHIER', name: 'Кассир', isMedicalStaff: false },
  ];

  const positionMap = new Map<string, string>();
  for (const pos of positionsData) {
    const p = await prisma.position.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: pos.code } },
      update: {},
      create: { ...pos, tenantId: tenant.id, isSystem: true },
    });
    positionMap.set(pos.code, p.id);
  }

  // 3. Room Types
  const roomTypesData = [
    { code: 'DOCTOR_OFFICE', name: 'Кабинет врача', color: '#0f766e' },
    { code: 'OPERATING_ROOM', name: 'Операционная', color: '#dc2626' },
    { code: 'USI_ROOM', name: 'Кабинет УЗИ', color: '#2563eb' },
    { code: 'TREATMENT_ROOM', name: 'Процедурный кабинет', color: '#16a34a' },
    { code: 'LABORATORY', name: 'Лаборатория', color: '#7c3aed' },
  ];

  const roomTypeMap = new Map<string, string>();
  for (const rt of roomTypesData) {
    const r = await schedulingPrisma.roomType.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: rt.code } },
      update: {},
      create: { ...rt, tenantId: tenant.id, isSystem: true },
    });
    roomTypeMap.set(rt.code, r.id);
  }

  // 4. Equipment Categories
  const categoriesData = [
    { code: 'USI_SCANNER', name: 'УЗИ сканер' },
    { code: 'DENTAL_CHAIR', name: 'Стоматологическая установка' },
    { code: 'AUTOCLAVE', name: 'Автоклав стерилизационный' },
    { code: 'ECG_MACHINE', name: 'ЭКГ аппарат' },
  ];

  const categoryMap = new Map<string, string>();
  for (const cat of categoriesData) {
    const c = await schedulingPrisma.equipmentCategory.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: cat.code } },
      update: {},
      create: { ...cat, tenantId: tenant.id, isSystem: true },
    });
    categoryMap.set(cat.code, c.id);
  }

  // 5. Departments
  const dentistryDept = await prisma.department.upsert({
    where: {
      tenantId_branchId_code: { tenantId: tenant.id, branchId: branch.id, code: 'dentistry' },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      code: 'dentistry',
      name: 'Стоматология',
      description: 'Отделение терапевтической и хирургической стоматологии',
      color: '#0f766e',
    },
  });

  const cardiologyDept = await prisma.department.upsert({
    where: {
      tenantId_branchId_code: { tenantId: tenant.id, branchId: branch.id, code: 'cardiology' },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      code: 'cardiology',
      name: 'Кардиология',
      description: 'Кардиологическое отделение',
      color: '#2563eb',
    },
  });

  const pediatricsDept = await prisma.department.upsert({
    where: {
      tenantId_branchId_code: { tenantId: tenant.id, branchId: branch.id, code: 'pediatrics' },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      code: 'pediatrics',
      name: 'Педиатрия',
      description: 'Педиатрическое отделение и вакцинация',
      color: '#f97316',
    },
  });

  const womensHealthDept = await prisma.department.upsert({
    where: {
      tenantId_branchId_code: { tenantId: tenant.id, branchId: branch.id, code: 'womens-health' },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      code: 'womens-health',
      name: 'Женское здоровье',
      description: 'Гинекология, наблюдение беременности и профилактические осмотры',
      color: '#db2777',
    },
  });

  // 6. Rooms
  const docOffice = await schedulingPrisma.room.upsert({
    where: {
      tenantId_branchId_code: { tenantId: tenant.id, branchId: branch.id, code: 'room-101' },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      departmentId: dentistryDept.id,
      roomTypeId: roomTypeMap.get('DOCTOR_OFFICE')!,
      code: 'room-101',
      name: 'Кабинет стоматолога 101',
      floor: 1,
      capacity: 1,
    },
  });

  const usiOffice = await schedulingPrisma.room.upsert({
    where: {
      tenantId_branchId_code: { tenantId: tenant.id, branchId: branch.id, code: 'room-102' },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      departmentId: cardiologyDept.id,
      roomTypeId: roomTypeMap.get('USI_ROOM')!,
      code: 'room-102',
      name: 'Кабинет УЗИ 102',
      floor: 1,
      capacity: 1,
    },
  });

  const cardioOffice = await schedulingPrisma.room.upsert({
    where: {
      tenantId_branchId_code: { tenantId: tenant.id, branchId: branch.id, code: 'room-103' },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      departmentId: cardiologyDept.id,
      roomTypeId: roomTypeMap.get('DOCTOR_OFFICE')!,
      code: 'room-103',
      name: 'Кабинет кардиолога 103',
      floor: 1,
      capacity: 1,
    },
  });

  const treatmentRoom = await schedulingPrisma.room.upsert({
    where: {
      tenantId_branchId_code: { tenantId: tenant.id, branchId: branch.id, code: 'room-104' },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      departmentId: dentistryDept.id,
      roomTypeId: roomTypeMap.get('TREATMENT_ROOM')!,
      code: 'room-104',
      name: 'Процедурный кабинет 104',
      floor: 1,
      capacity: 2,
    },
  });

  const gynecologyOffice = await schedulingPrisma.room.upsert({
    where: {
      tenantId_branchId_code: { tenantId: tenant.id, branchId: branch.id, code: 'room-105' },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      departmentId: womensHealthDept.id,
      roomTypeId: roomTypeMap.get('DOCTOR_OFFICE')!,
      code: 'room-105',
      name: 'Кабинет гинеколога 105',
      floor: 1,
      capacity: 1,
    },
  });

  const pediatricOffice = await schedulingPrisma.room.upsert({
    where: {
      tenantId_branchId_code: { tenantId: tenant.id, branchId: branch.id, code: 'room-106' },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      departmentId: pediatricsDept.id,
      roomTypeId: roomTypeMap.get('DOCTOR_OFFICE')!,
      code: 'room-106',
      name: 'Кабинет педиатра 106',
      floor: 1,
      capacity: 1,
    },
  });

  // Allowed specialties in room-102
  await schedulingPrisma.roomSpecialty.upsert({
    where: {
      roomId_specialtyId: { roomId: usiOffice.id, specialtyId: specialtyMap.get('radiologist')! },
    },
    update: {},
    create: { roomId: usiOffice.id, specialtyId: specialtyMap.get('radiologist')! },
  });

  await schedulingPrisma.roomSpecialty.upsert({
    where: {
      roomId_specialtyId: { roomId: docOffice.id, specialtyId: specialtyMap.get('dentist')! },
    },
    update: {},
    create: { roomId: docOffice.id, specialtyId: specialtyMap.get('dentist')! },
  });

  await schedulingPrisma.roomSpecialty.upsert({
    where: {
      roomId_specialtyId: {
        roomId: cardioOffice.id,
        specialtyId: specialtyMap.get('cardiologist')!,
      },
    },
    update: {},
    create: { roomId: cardioOffice.id, specialtyId: specialtyMap.get('cardiologist')! },
  });

  await schedulingPrisma.roomSpecialty.upsert({
    where: {
      roomId_specialtyId: {
        roomId: gynecologyOffice.id,
        specialtyId: specialtyMap.get('gynecologist')!,
      },
    },
    update: {},
    create: {
      roomId: gynecologyOffice.id,
      specialtyId: specialtyMap.get('gynecologist')!,
    },
  });

  await schedulingPrisma.roomSpecialty.upsert({
    where: {
      roomId_specialtyId: {
        roomId: pediatricOffice.id,
        specialtyId: specialtyMap.get('pediatrician')!,
      },
    },
    update: {},
    create: {
      roomId: pediatricOffice.id,
      specialtyId: specialtyMap.get('pediatrician')!,
    },
  });

  // 7. Equipment
  const usiScanner = await schedulingPrisma.equipment.upsert({
    where: { tenantId_inventoryNumber: { tenantId: tenant.id, inventoryNumber: 'EQ-USI-001' } },
    update: {},
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      roomId: null,
      categoryId: categoryMap.get('USI_SCANNER')!,
      inventoryNumber: 'EQ-USI-001',
      serialNumber: 'SN129381283',
      name: 'УЗИ Аппарат Mindray M9',
      manufacturer: 'Mindray',
      model: 'M9',
      status: 'ACTIVE',
      isSharedResource: true,
    },
  });

  // 8. Employee
  const employee = await prisma.employee.upsert({
    where: { tenantId_employeeNumber: { tenantId: tenant.id, employeeNumber: 'EMP-000001' } },
    update: {},
    create: {
      tenantId: tenant.id,
      userId: admin.id,
      employeeNumber: 'EMP-000001',
      firstName: 'Demo',
      lastName: 'Admin',
      hireDate: new Date(),
      status: 'ACTIVE',
    },
  });

  const seedEmployeeWithUser = async (input: {
    employeeNumber: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    departmentId: string;
    positionCode: string;
    specialtyCode: string;
    roomId: string;
  }) => {
    const user = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: input.email } },
      update: {
        firstName: input.firstName,
        lastName: input.lastName,
        passwordHash,
        status: 'active',
      },
      create: {
        tenantId: tenant.id,
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        language: 'ru',
        status: 'active',
        isSuperAdmin: false,
      },
    });

    const seededEmployee = await prisma.employee.upsert({
      where: {
        tenantId_employeeNumber: { tenantId: tenant.id, employeeNumber: input.employeeNumber },
      },
      update: {
        userId: user.id,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        email: input.email,
        status: 'ACTIVE',
      },
      create: {
        tenantId: tenant.id,
        userId: user.id,
        employeeNumber: input.employeeNumber,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        email: input.email,
        hireDate: new Date('2024-02-01'),
        status: 'ACTIVE',
      },
    });

    await prisma.userBranchRole.deleteMany({
      where: { tenantId: tenant.id, userId: user.id, branchId: branch.id },
    });
    await prisma.userBranchRole.create({
      data: {
        userId: user.id,
        tenantId: tenant.id,
        branchId: branch.id,
        roleId: ownerRole.id,
        isPrimary: true,
      },
    });

    await prisma.employeePosition.deleteMany({
      where: { tenantId: tenant.id, employeeId: seededEmployee.id },
    });
    await prisma.employeePosition.create({
      data: {
        tenantId: tenant.id,
        employeeId: seededEmployee.id,
        branchId: branch.id,
        departmentId: input.departmentId,
        positionId: positionMap.get(input.positionCode)!,
        specialtyId: specialtyMap.get(input.specialtyCode)!,
        rate: 1.0,
        isPrimary: true,
      },
    });

    await schedulingPrisma.employeeRoomAssignment.deleteMany({
      where: { tenantId: tenant.id, employeeId: seededEmployee.id },
    });
    await schedulingPrisma.employeeRoomAssignment.create({
      data: {
        tenantId: tenant.id,
        employeeId: seededEmployee.id,
        branchId: branch.id,
        departmentId: input.departmentId,
        roomId: input.roomId,
        specialtyId: specialtyMap.get(input.specialtyCode)!,
      },
    });

    return seededEmployee;
  };

  const dentistEmployee = await seedEmployeeWithUser({
    employeeNumber: 'EMP-000002',
    email: 'dentist@demo.clinic',
    firstName: 'Рустам',
    lastName: 'Каримов',
    phone: '+992900110022',
    departmentId: dentistryDept.id,
    positionCode: 'CHIEF_DOCTOR',
    specialtyCode: 'dentist',
    roomId: docOffice.id,
  });

  const cardiologistEmployee = await seedEmployeeWithUser({
    employeeNumber: 'EMP-000003',
    email: 'cardio@demo.clinic',
    firstName: 'Дилфуза',
    lastName: 'Саидова',
    phone: '+992900330044',
    departmentId: cardiologyDept.id,
    positionCode: 'CHIEF_DOCTOR',
    specialtyCode: 'cardiologist',
    roomId: cardioOffice.id,
  });

  const pediatricianEmployee = await seedEmployeeWithUser({
    employeeNumber: 'EMP-000004',
    email: 'pediatric@demo.clinic',
    firstName: 'Саид',
    lastName: 'Мирзоев',
    phone: '+992900550066',
    departmentId: pediatricsDept.id,
    positionCode: 'DOCTOR',
    specialtyCode: 'pediatrician',
    roomId: pediatricOffice.id,
  });

  const gynecologistEmployee = await seedEmployeeWithUser({
    employeeNumber: 'EMP-000005',
    email: 'gynecology@demo.clinic',
    firstName: 'Муниса',
    lastName: 'Хакимова',
    phone: '+992900770088',
    departmentId: womensHealthDept.id,
    positionCode: 'DOCTOR',
    specialtyCode: 'gynecologist',
    roomId: gynecologyOffice.id,
  });

  const radiologistEmployee = await seedEmployeeWithUser({
    employeeNumber: 'EMP-000006',
    email: 'ultrasound@demo.clinic',
    firstName: 'Алишер',
    lastName: 'Юсупов',
    phone: '+992900990011',
    departmentId: cardiologyDept.id,
    positionCode: 'DOCTOR_USI',
    specialtyCode: 'radiologist',
    roomId: usiOffice.id,
  });

  // Assign position
  await prisma.employeePosition.deleteMany({
    where: { tenantId: tenant.id, employeeId: employee.id },
  });
  await prisma.employeePosition.create({
    data: {
      tenantId: tenant.id,
      employeeId: employee.id,
      branchId: branch.id,
      departmentId: cardiologyDept.id,
      positionId: positionMap.get('CHIEF_DOCTOR')!,
      specialtyId: specialtyMap.get('radiologist')!,
      rate: 1.0,
      isPrimary: true,
    },
  });

  // Assign room
  await schedulingPrisma.employeeRoomAssignment.deleteMany({
    where: { tenantId: tenant.id, employeeId: employee.id },
  });
  await schedulingPrisma.employeeRoomAssignment.create({
    data: {
      tenantId: tenant.id,
      employeeId: employee.id,
      branchId: branch.id,
      departmentId: cardiologyDept.id,
      roomId: usiOffice.id,
      specialtyId: specialtyMap.get('radiologist')!,
    },
  });

  // 9. Working Schedules
  // Branch Working Hours (weekday 1..6, 08:00 - 18:00)
  await schedulingPrisma.workingSchedule.deleteMany({
    where: { tenantId: tenant.id, entityType: 'branch', entityId: branch.id },
  });
  for (let i = 1; i <= 6; i++) {
    await schedulingPrisma.workingSchedule.create({
      data: {
        tenantId: tenant.id,
        entityType: 'branch',
        entityId: branch.id,
        weekday: i,
        startTime: '08:00',
        endTime: '18:00',
        timezone: 'Europe/Moscow',
      },
    });
  }

  await schedulingPrisma.workingSchedule.deleteMany({
    where: {
      tenantId: tenant.id,
      entityType: { in: ['employee', 'room'] },
      entityId: {
        in: [
          employee.id,
          dentistEmployee.id,
          cardiologistEmployee.id,
          pediatricianEmployee.id,
          gynecologistEmployee.id,
          radiologistEmployee.id,
          docOffice.id,
          usiOffice.id,
          cardioOffice.id,
          treatmentRoom.id,
          gynecologyOffice.id,
          pediatricOffice.id,
        ],
      },
    },
  });

  const demoDoctorIds = [
    employee.id,
    dentistEmployee.id,
    cardiologistEmployee.id,
    pediatricianEmployee.id,
    gynecologistEmployee.id,
    radiologistEmployee.id,
  ];
  const demoRoomIds = [
    docOffice.id,
    usiOffice.id,
    cardioOffice.id,
    treatmentRoom.id,
    gynecologyOffice.id,
    pediatricOffice.id,
  ];

  for (let weekday = 1; weekday <= 6; weekday++) {
    for (const entityId of demoDoctorIds) {
      await schedulingPrisma.workingSchedule.create({
        data: {
          tenantId: tenant.id,
          entityType: 'employee',
          entityId,
          weekday,
          startTime: '08:00',
          endTime: '18:00',
          timezone: 'Europe/Moscow',
        },
      });
    }
    for (const entityId of demoRoomIds) {
      await schedulingPrisma.workingSchedule.create({
        data: {
          tenantId: tenant.id,
          entityType: 'room',
          entityId,
          weekday,
          startTime: '08:00',
          endTime: '18:00',
          timezone: 'Europe/Moscow',
        },
      });
    }
  }

  // 10. Patient CRM Core Seed Data
  // CRM Tags
  const tagVip = await prisma.crmTag.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'vip' } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: 'vip',
      name: 'VIP',
      color: '#e11d48',
      isSystem: false,
    },
  });

  const tagChild = await prisma.crmTag.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'child' } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: 'child',
      name: 'Ребенок',
      color: '#2563eb',
      isSystem: false,
    },
  });

  const tagPregnancy = await prisma.crmTag.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'pregnancy' } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: 'pregnancy',
      name: 'Беременность',
      color: '#db2777',
      isSystem: false,
    },
  });

  // Legal Document Types
  const docTypePdn = await prisma.legalDocumentType.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'PDN_CONSENT' } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: 'PDN_CONSENT',
      name: 'Согласие на обработку ПДн',
      validityPeriodDays: 365,
      requiresSignature: true,
      isRequired: true,
    },
  });

  const docTypeContract = await prisma.legalDocumentType.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'MEDICAL_SERVICE_CONTRACT' } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: 'MEDICAL_SERVICE_CONTRACT',
      name: 'Договор об оказании платных мед. услуг',
      validityPeriodDays: null,
      requiresSignature: true,
      isRequired: true,
    },
  });

  // Templates
  await prisma.legalDocumentTemplate.deleteMany({
    where: { tenantId: tenant.id },
  });

  await prisma.legalDocumentTemplate.create({
    data: {
      tenantId: tenant.id,
      documentTypeId: docTypePdn.id,
      version: '1.0',
      language: 'ru',
      templateFileId: '00000000-0000-0000-0000-000000000101',
      isActive: true,
    },
  });

  await prisma.legalDocumentTemplate.create({
    data: {
      tenantId: tenant.id,
      documentTypeId: docTypeContract.id,
      version: '1.0',
      language: 'ru',
      templateFileId: '00000000-0000-0000-0000-000000000102',
      isActive: true,
    },
  });

  // Helper function for phone hashing
  const getPhoneHash = (phone: string) => {
    const norm = phone.toLowerCase().replace(/[\s()+-]/g, '');
    return createHash('sha256').update(norm).digest('hex');
  };

  const deleteAppointmentByNumber = async (appointmentNumber: string) => {
    const appointment = await schedulingPrisma.appointment.findFirst({
      where: { tenantId: tenant.id, appointmentNumber },
    });
    if (!appointment) return;

    await prisma.paymentAllocation.deleteMany({
      where: { invoiceItem: { invoice: { appointmentId: appointment.id } } },
    });
    await prisma.patientDebt.deleteMany({ where: { invoice: { appointmentId: appointment.id } } });
    await prisma.invoiceItem.deleteMany({ where: { invoice: { appointmentId: appointment.id } } });
    await prisma.invoice.deleteMany({ where: { appointmentId: appointment.id } });
    await schedulingPrisma.appointmentStatusHistory.deleteMany({
      where: { appointmentId: appointment.id },
    });
    await schedulingPrisma.appointmentResource.deleteMany({
      where: { appointmentId: appointment.id },
    });
    await schedulingPrisma.appointmentVisitState.deleteMany({
      where: { appointmentId: appointment.id },
    });
    await schedulingPrisma.visitQueue.deleteMany({ where: { appointmentId: appointment.id } });

    const encounters = await prisma.encounter.findMany({
      where: { appointmentId: appointment.id },
    });
    const encounterIds = encounters.map((encounter) => encounter.id);
    const compositions = await prisma.clinicalComposition.findMany({
      where: { encounterId: { in: encounterIds } },
    });
    const compositionIds = compositions.map((composition) => composition.id);
    const sections = await prisma.clinicalSection.findMany({
      where: { compositionId: { in: compositionIds } },
    });
    const sectionIds = sections.map((section) => section.id);

    await prisma.clinicalElement.deleteMany({ where: { sectionId: { in: sectionIds } } });
    await prisma.clinicalSection.deleteMany({ where: { compositionId: { in: compositionIds } } });
    await prisma.clinicalComposition.deleteMany({ where: { encounterId: { in: encounterIds } } });
    await prisma.encounterDiagnosis.deleteMany({ where: { encounterId: { in: encounterIds } } });
    await prisma.prescriptionItem.deleteMany({
      where: { prescription: { encounterId: { in: encounterIds } } },
    });
    await prisma.prescription.deleteMany({ where: { encounterId: { in: encounterIds } } });
    await prisma.encounter.deleteMany({ where: { appointmentId: appointment.id } });

    await schedulingPrisma.appointment.delete({ where: { id: appointment.id } });
  };

  const deleteInvoicesByNumbers = async (invoiceNumbers: string[]) => {
    await prisma.paymentAllocation.deleteMany({
      where: {
        invoiceItem: {
          invoice: {
            tenantId: tenant.id,
            invoiceNumber: { in: invoiceNumbers },
          },
        },
      },
    });
    await prisma.patientDebt.deleteMany({
      where: {
        invoice: {
          tenantId: tenant.id,
          invoiceNumber: { in: invoiceNumbers },
        },
      },
    });
    await prisma.invoiceItem.deleteMany({
      where: {
        invoice: {
          tenantId: tenant.id,
          invoiceNumber: { in: invoiceNumbers },
        },
      },
    });
    await prisma.invoice.deleteMany({
      where: { tenantId: tenant.id, invoiceNumber: { in: invoiceNumbers } },
    });
  };

  // Patients (P-000001, P-000002, P-000003)
  const p1 = await prisma.patient.upsert({
    where: { tenantId_patientCode: { tenantId: tenant.id, patientCode: 'P-000001' } },
    update: {
      firstName: 'Иван',
      lastName: 'Иванов',
      middleName: 'Иванович',
      fullName: 'Иванов Иван Иванович',
      birthDate: new Date('1990-01-01'),
      gender: 'MALE',
      status: 'ACTIVE',
    },
    create: {
      tenantId: tenant.id,
      patientCode: 'P-000001',
      firstName: 'Иван',
      lastName: 'Иванов',
      middleName: 'Иванович',
      fullName: 'Иванов Иван Иванович',
      birthDate: new Date('1990-01-01'),
      gender: 'MALE',
      status: 'ACTIVE',
      registrationBranchId: branch.id,
    },
  });

  await prisma.patientContact.deleteMany({ where: { patientId: p1.id } });
  await prisma.patientContact.create({
    data: {
      tenantId: tenant.id,
      patientId: p1.id,
      type: 'PHONE',
      value: '+79991112233',
      normalizedValueHash: getPhoneHash('+79991112233'),
      isPrimary: true,
    },
  });

  await prisma.patientAddress.deleteMany({ where: { patientId: p1.id } });
  await prisma.patientAddress.create({
    data: {
      tenantId: tenant.id,
      patientId: p1.id,
      country: 'Россия',
      city: 'Москва',
      addressLine: 'ул. Ленина, д. 10, кв. 25',
      isPrimary: true,
    },
  });

  const p2 = await prisma.patient.upsert({
    where: { tenantId_patientCode: { tenantId: tenant.id, patientCode: 'P-000002' } },
    update: {
      firstName: 'Мария',
      lastName: 'Иванова',
      middleName: 'Ивановна',
      fullName: 'Иванова Мария Ивановна',
      birthDate: new Date('1992-05-15'),
      gender: 'FEMALE',
      status: 'ACTIVE',
    },
    create: {
      tenantId: tenant.id,
      patientCode: 'P-000002',
      firstName: 'Мария',
      lastName: 'Иванова',
      middleName: 'Ивановна',
      fullName: 'Иванова Мария Ивановна',
      birthDate: new Date('1992-05-15'),
      gender: 'FEMALE',
      status: 'ACTIVE',
      registrationBranchId: branch.id,
    },
  });

  await prisma.patientContact.deleteMany({ where: { patientId: p2.id } });
  await prisma.patientContact.create({
    data: {
      tenantId: tenant.id,
      patientId: p2.id,
      type: 'PHONE',
      value: '+79992223344',
      normalizedValueHash: getPhoneHash('+79992223344'),
      isPrimary: true,
    },
  });

  const p3 = await prisma.patient.upsert({
    where: { tenantId_patientCode: { tenantId: tenant.id, patientCode: 'P-000003' } },
    update: {
      firstName: 'Петр',
      lastName: 'Иванов',
      middleName: 'Иванович',
      fullName: 'Иванов Петр Иванович',
      birthDate: new Date('2018-09-20'),
      gender: 'MALE',
      status: 'NEW',
    },
    create: {
      tenantId: tenant.id,
      patientCode: 'P-000003',
      firstName: 'Петр',
      lastName: 'Иванов',
      middleName: 'Иванович',
      fullName: 'Иванов Петр Иванович',
      birthDate: new Date('2018-09-20'),
      gender: 'MALE',
      status: 'NEW',
      registrationBranchId: branch.id,
    },
  });

  await prisma.patientContact.deleteMany({ where: { patientId: p3.id } });
  await prisma.patientContact.create({
    data: {
      tenantId: tenant.id,
      patientId: p3.id,
      type: 'PHONE',
      value: '+79991112233',
      normalizedValueHash: getPhoneHash('+79991112233'),
      isPrimary: true,
    },
  });

  const seedPatient = async (input: {
    code: string;
    firstName: string;
    lastName: string;
    middleName?: string;
    birthDate: string;
    gender: string;
    status: string;
    phone: string;
    city?: string;
    addressLine?: string;
  }) => {
    const fullName = [input.lastName, input.firstName, input.middleName].filter(Boolean).join(' ');
    const patient = await prisma.patient.upsert({
      where: { tenantId_patientCode: { tenantId: tenant.id, patientCode: input.code } },
      update: {
        firstName: input.firstName,
        lastName: input.lastName,
        middleName: input.middleName,
        fullName,
        birthDate: new Date(input.birthDate),
        gender: input.gender,
        status: input.status,
      },
      create: {
        tenantId: tenant.id,
        patientCode: input.code,
        firstName: input.firstName,
        lastName: input.lastName,
        middleName: input.middleName,
        fullName,
        birthDate: new Date(input.birthDate),
        gender: input.gender,
        status: input.status,
        registrationBranchId: branch.id,
      },
    });

    await prisma.patientContact.deleteMany({ where: { patientId: patient.id } });
    await prisma.patientContact.create({
      data: {
        tenantId: tenant.id,
        patientId: patient.id,
        type: 'PHONE',
        value: input.phone,
        normalizedValueHash: getPhoneHash(input.phone),
        isPrimary: true,
      },
    });

    if (input.city || input.addressLine) {
      await prisma.patientAddress.deleteMany({ where: { patientId: patient.id } });
      await prisma.patientAddress.create({
        data: {
          tenantId: tenant.id,
          patientId: patient.id,
          country: 'Таджикистан',
          city: input.city ?? 'Душанбе',
          addressLine: input.addressLine ?? 'район Сино',
          isPrimary: true,
        },
      });
    }

    return patient;
  };

  const p4 = await seedPatient({
    code: 'P-000004',
    firstName: 'Мадина',
    lastName: 'Азизова',
    middleName: 'Фарруховна',
    birthDate: '1988-03-11',
    gender: 'FEMALE',
    status: 'VIP',
    phone: '+992900445566',
    city: 'Душанбе',
    addressLine: 'проспект Рудаки, 87',
  });

  const p5 = await seedPatient({
    code: 'P-000005',
    firstName: 'Фаридун',
    lastName: 'Назаров',
    middleName: 'Саидович',
    birthDate: '1979-08-24',
    gender: 'MALE',
    status: 'ACTIVE',
    phone: '+992918001122',
    city: 'Душанбе',
    addressLine: 'ул. Шотемур, 14',
  });

  const p6 = await seedPatient({
    code: 'P-000006',
    firstName: 'Зухро',
    lastName: 'Шарипова',
    middleName: 'Каримовна',
    birthDate: '1996-12-02',
    gender: 'FEMALE',
    status: 'NEW',
    phone: '+992935551010',
    city: 'Вахдат',
    addressLine: 'ул. Сино, 7',
  });

  const p7 = await seedPatient({
    code: 'P-000007',
    firstName: 'Темур',
    lastName: 'Холиков',
    middleName: 'Абдуллоевич',
    birthDate: '2014-06-18',
    gender: 'MALE',
    status: 'ACTIVE',
    phone: '+992907770099',
    city: 'Душанбе',
    addressLine: 'мкр. 82, д. 9',
  });

  const p8 = await seedPatient({
    code: 'P-000008',
    firstName: 'Мехрона',
    lastName: 'Сатторова',
    middleName: 'Бахтиёровна',
    birthDate: '1991-04-09',
    gender: 'FEMALE',
    status: 'ACTIVE',
    phone: '+992918222334',
    city: 'Душанбе',
    addressLine: 'ул. Айни, 44',
  });

  const p9 = await seedPatient({
    code: 'P-000009',
    firstName: 'Бехруз',
    lastName: 'Курбонов',
    middleName: 'Нуриддинович',
    birthDate: '1984-10-30',
    gender: 'MALE',
    status: 'ACTIVE',
    phone: '+992935334455',
    city: 'Душанбе',
    addressLine: 'ул. Турсунзаде, 18',
  });

  const p10 = await seedPatient({
    code: 'P-000010',
    firstName: 'Самира',
    lastName: 'Рахмонова',
    middleName: 'Одиловна',
    birthDate: '2019-01-27',
    gender: 'FEMALE',
    status: 'NEW',
    phone: '+992907123456',
    city: 'Гиссар',
    addressLine: 'ул. Навруз, 5',
  });

  const p11 = await seedPatient({
    code: 'P-000011',
    firstName: 'Комрон',
    lastName: 'Умаров',
    middleName: 'Абдурахмонович',
    birthDate: '1972-07-16',
    gender: 'MALE',
    status: 'ACTIVE',
    phone: '+992900222333',
    city: 'Душанбе',
    addressLine: 'проспект Исмоили Сомони, 31',
  });

  const p12 = await seedPatient({
    code: 'P-000012',
    firstName: 'Нигора',
    lastName: 'Файзиева',
    middleName: 'Шарифовна',
    birthDate: '1994-11-03',
    gender: 'FEMALE',
    status: 'ACTIVE',
    phone: '+992918765432',
    city: 'Душанбе',
    addressLine: 'ул. Бухоро, 22',
  });

  const p13 = await seedPatient({
    code: 'P-000013',
    firstName: 'Далер',
    lastName: 'Махмудов',
    middleName: 'Фирдавсович',
    birthDate: '1989-02-21',
    gender: 'MALE',
    status: 'ACTIVE',
    phone: '+992935777888',
    city: 'Душанбе',
    addressLine: 'мкр. Зарафшон, 12',
  });

  const p14 = await seedPatient({
    code: 'P-000014',
    firstName: 'Шахноза',
    lastName: 'Абдуллоева',
    middleName: 'Муродовна',
    birthDate: '1986-06-05',
    gender: 'FEMALE',
    status: 'VIP',
    phone: '+992900808080',
    city: 'Душанбе',
    addressLine: 'ул. Саъди Шерози, 63',
  });

  const demoPatientIds = [
    p1.id,
    p2.id,
    p3.id,
    p4.id,
    p5.id,
    p6.id,
    p7.id,
    p8.id,
    p9.id,
    p10.id,
    p11.id,
    p12.id,
    p13.id,
    p14.id,
  ];

  // Family Group and Ties
  await prisma.familyMember.deleteMany({
    where: { patientId: { in: [p1.id, p2.id, p3.id] } },
  });
  await prisma.familyGroup.deleteMany({
    where: { primaryContactPatientId: p1.id },
  });

  const familyGroup = await prisma.familyGroup.create({
    data: {
      tenantId: tenant.id,
      familyName: 'Ивановы',
      primaryContactPatientId: p1.id,
      sharedBalanceEnabled: true,
      sharedDiscountEnabled: true,
    },
  });

  await prisma.familyMember.createMany({
    data: [
      {
        tenantId: tenant.id,
        familyGroupId: familyGroup.id,
        patientId: p1.id,
        relationType: 'FATHER',
        isPrimaryContact: true,
        canReceiveNotifications: true,
      },
      {
        tenantId: tenant.id,
        familyGroupId: familyGroup.id,
        patientId: p2.id,
        relationType: 'SPOUSE',
        isPrimaryContact: false,
        canReceiveNotifications: true,
      },
      {
        tenantId: tenant.id,
        familyGroupId: familyGroup.id,
        patientId: p3.id,
        relationType: 'SON',
        isPrimaryContact: false,
        canReceiveNotifications: false,
      },
    ],
  });

  // Metrics & Leads
  await prisma.patientCrmMetric.upsert({
    where: { patientId: p1.id },
    update: {
      totalVisits: 5,
      totalRevenue: 15000.0,
      ltv: 15000.0,
      averageCheck: 3000.0,
      loyaltyPoints: 150,
      lastVisitAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    },
    create: {
      tenantId: tenant.id,
      patientId: p1.id,
      totalVisits: 5,
      totalRevenue: 15000.0,
      ltv: 15000.0,
      averageCheck: 3000.0,
      loyaltyPoints: 150,
      lastVisitAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    },
  });

  for (const metric of [
    {
      patientId: p4.id,
      totalVisits: 8,
      totalRevenue: 32800,
      ltv: 32800,
      averageCheck: 4100,
      loyaltyPoints: 420,
      lastVisitAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
    {
      patientId: p5.id,
      totalVisits: 3,
      totalRevenue: 7800,
      ltv: 7800,
      averageCheck: 2600,
      loyaltyPoints: 80,
      lastVisitAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    },
    {
      patientId: p6.id,
      totalVisits: 1,
      totalRevenue: 1500,
      ltv: 1500,
      averageCheck: 1500,
      loyaltyPoints: 10,
      lastVisitAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
    {
      patientId: p7.id,
      totalVisits: 4,
      totalRevenue: 11600,
      ltv: 11600,
      averageCheck: 2900,
      loyaltyPoints: 110,
      lastVisitAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
    },
    {
      patientId: p8.id,
      totalVisits: 2,
      totalRevenue: 4800,
      ltv: 4800,
      averageCheck: 2400,
      loyaltyPoints: 45,
      lastVisitAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
    },
    {
      patientId: p9.id,
      totalVisits: 6,
      totalRevenue: 18600,
      ltv: 18600,
      averageCheck: 3100,
      loyaltyPoints: 190,
      lastVisitAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    },
    {
      patientId: p10.id,
      totalVisits: 1,
      totalRevenue: 1800,
      ltv: 1800,
      averageCheck: 1800,
      loyaltyPoints: 15,
      lastVisitAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
    {
      patientId: p14.id,
      totalVisits: 9,
      totalRevenue: 42100,
      ltv: 42100,
      averageCheck: 4678,
      loyaltyPoints: 520,
      lastVisitAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  ]) {
    await prisma.patientCrmMetric.upsert({
      where: { patientId: metric.patientId },
      update: metric,
      create: {
        tenantId: tenant.id,
        ...metric,
      },
    });
  }

  await prisma.patientLead.deleteMany({ where: { patientId: p1.id } });
  await prisma.patientLead.create({
    data: {
      tenantId: tenant.id,
      patientId: p1.id,
      sourceType: 'ADVERTISING',
      sourceName: 'Yandex Direct',
      utmSource: 'yandex',
      utmMedium: 'cpc',
      utmCampaign: 'search_clinic',
    },
  });

  // Tag Assignments
  await prisma.patientTag.deleteMany({
    where: { patientId: { in: demoPatientIds } },
  });
  await prisma.patientTag.create({
    data: {
      tenantId: tenant.id,
      patientId: p1.id,
      tagId: tagVip.id,
      assignedBy: admin.id,
    },
  });
  await prisma.patientTag.create({
    data: {
      tenantId: tenant.id,
      patientId: p4.id,
      tagId: tagVip.id,
      assignedBy: admin.id,
    },
  });
  await prisma.patientTag.create({
    data: {
      tenantId: tenant.id,
      patientId: p6.id,
      tagId: tagPregnancy.id,
      assignedBy: admin.id,
    },
  });
  await prisma.patientTag.create({
    data: {
      tenantId: tenant.id,
      patientId: p7.id,
      tagId: tagChild.id,
      assignedBy: admin.id,
    },
  });
  await prisma.patientTag.create({
    data: {
      tenantId: tenant.id,
      patientId: p3.id,
      tagId: tagChild.id,
      assignedBy: admin.id,
    },
  });
  await prisma.patientTag.create({
    data: {
      tenantId: tenant.id,
      patientId: p10.id,
      tagId: tagChild.id,
      assignedBy: admin.id,
    },
  });
  await prisma.patientTag.create({
    data: {
      tenantId: tenant.id,
      patientId: p14.id,
      tagId: tagVip.id,
      assignedBy: admin.id,
    },
  });

  // Signed Document
  await prisma.patientLegalDocument.deleteMany({ where: { patientId: p1.id } });
  await prisma.patientLegalDocument.create({
    data: {
      tenantId: tenant.id,
      patientId: p1.id,
      documentTypeId: docTypeContract.id,
      documentNumber: 'D-2026-0001',
      signedAt: new Date(),
      status: 'ACTIVE',
      signedByUserId: admin.id,
      branchId: branch.id,
    },
  });

  // Notes & Timeline
  await prisma.patientNote.deleteMany({ where: { patientId: p1.id } });
  await prisma.patientNote.create({
    data: {
      tenantId: tenant.id,
      patientId: p1.id,
      note: 'Пациент просил звонить только после 14:00',
      visibility: 'PRIVATE',
      createdBy: admin.id,
    },
  });

  await prisma.patientTimelineEvent.deleteMany({ where: { patientId: p1.id } });
  await prisma.patientTimelineEvent.createMany({
    data: [
      {
        tenantId: tenant.id,
        patientId: p1.id,
        eventType: 'TAG_ASSIGNED',
        eventSource: 'SYSTEM',
        title: 'Присвоен тег: VIP',
        createdBy: admin.id,
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        tenantId: tenant.id,
        patientId: p1.id,
        eventType: 'DOCUMENT_SIGNED',
        eventSource: 'SYSTEM',
        title: 'Подписан документ: Договор об оказании платных мед. услуг',
        description: 'Номер документа: D-2026-0001',
        createdBy: admin.id,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        tenantId: tenant.id,
        patientId: p1.id,
        eventType: 'NOTE',
        eventSource: 'STAFF',
        title: 'Добавлена заметка',
        description: 'Пациент просил звонить только после 14:00',
        createdBy: admin.id,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
    ],
  });

  // 11. Service Required Resources
  // Map Procedure service to require USI_ROOM and USI_SCANNER equipment category
  const roomTypeUsiId = roomTypeMap.get('USI_ROOM');
  const catUsiScannerId = categoryMap.get('USI_SCANNER');

  if (roomTypeUsiId) {
    await schedulingPrisma.serviceRequiredResource.upsert({
      where: {
        serviceId_resourceType_resourceCategoryId: {
          serviceId: serviceProcedure.id,
          resourceType: 'ROOM_TYPE',
          resourceCategoryId: roomTypeUsiId,
        },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        serviceId: serviceProcedure.id,
        resourceType: 'ROOM_TYPE',
        resourceCategoryId: roomTypeUsiId,
      },
    });
  }

  if (catUsiScannerId) {
    await schedulingPrisma.serviceRequiredResource.upsert({
      where: {
        serviceId_resourceType_resourceCategoryId: {
          serviceId: serviceProcedure.id,
          resourceType: 'EQUIPMENT_CATEGORY',
          resourceCategoryId: catUsiScannerId,
        },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        serviceId: serviceProcedure.id,
        resourceType: 'EQUIPMENT_CATEGORY',
        resourceCategoryId: catUsiScannerId,
      },
    });
  }

  // 12. Resource Buffers
  // Set 10-minute prep buffer for the USI scanner
  await schedulingPrisma.resourceBuffer.upsert({
    where: {
      tenantId_resourceType_resourceId: {
        tenantId: tenant.id,
        resourceType: 'EQUIPMENT',
        resourceId: usiScanner.id,
      },
    },
    update: {
      beforeMinutes: 10,
      afterMinutes: 10,
    },
    create: {
      tenantId: tenant.id,
      resourceType: 'EQUIPMENT',
      resourceId: usiScanner.id,
      beforeMinutes: 10,
      afterMinutes: 10,
    },
  });

  // Set 5-minute buffer for Doctor (Demo Admin)
  await schedulingPrisma.resourceBuffer.upsert({
    where: {
      tenantId_resourceType_resourceId: {
        tenantId: tenant.id,
        resourceType: 'EMPLOYEE',
        resourceId: employee.id,
      },
    },
    update: {
      beforeMinutes: 0,
      afterMinutes: 5,
    },
    create: {
      tenantId: tenant.id,
      resourceType: 'EMPLOYEE',
      resourceId: employee.id,
      beforeMinutes: 0,
      afterMinutes: 5,
    },
  });

  // 13. Waiting List
  // Add patient p2 (Мария Иванова) to waiting list for tomorrow to next week
  const dateTomorrow = new Date();
  dateTomorrow.setDate(dateTomorrow.getDate() + 1);
  const dateNextWeek = new Date();
  dateNextWeek.setDate(dateNextWeek.getDate() + 7);

  await schedulingPrisma.waitingList.deleteMany({
    where: { patientId: p2.id, tenantId: tenant.id },
  });

  await schedulingPrisma.waitingList.create({
    data: {
      tenantId: tenant.id,
      patientId: p2.id,
      branchId: branch.id,
      employeeId: employee.id,
      preferredDateFrom: dateTomorrow,
      preferredDateTo: dateNextWeek,
      preferredTimeFrom: '09:00',
      preferredTimeTo: '18:00',
      serviceId: serviceProcedure.id,
      priority: 'HIGH',
      notes: 'Пациент просит самое раннее свободное окно',
    },
  });

  // 14. Receptionist workplace dummy data (today's board cards, queue, call, invoice)
  await schedulingPrisma.receptionistDashboardCache.deleteMany({
    where: { tenantId: tenant.id, branchId: branch.id },
  });

  const todayStart = new Date();
  todayStart.setHours(10, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(10, 30, 0, 0);

  const demoAppointmentNumbers = [
    'A-SEED-001',
    'A-DEMO-002',
    'A-DEMO-003',
    'A-DEMO-004',
    'A-DEMO-005',
    'A-DEMO-006',
    'A-DEMO-007',
    'A-DEMO-008',
    'A-DEMO-009',
    'A-DEMO-010',
    'A-DEMO-011',
    'A-DEMO-012',
    'A-DEMO-013',
    'A-DEMO-014',
    'A-DEMO-015',
    'A-DEMO-016',
    'A-DEMO-017',
    'A-DEMO-018',
    'A-DEMO-019',
    'A-DEMO-020',
    'A-DEMO-021',
  ];
  const demoInvoiceNumbers = demoAppointmentNumbers.map(
    (appointmentNumber) => `INV-${appointmentNumber}`,
  );

  for (const appointmentNumber of demoAppointmentNumbers) {
    await deleteAppointmentByNumber(appointmentNumber);
  }
  await deleteInvoicesByNumbers(demoInvoiceNumbers);

  const demoApp = await schedulingPrisma.appointment.create({
    data: {
      tenantId: tenant.id,
      branchId: branch.id,
      patientId: p1.id,
      employeeId: employee.id,
      serviceId: serviceConsultation.id,
      appointmentNumber: 'A-SEED-001',
      bookingSource: 'ADMIN_PANEL',
      appointmentType: 'CONSULTATION',
      status: 'CHECKED_IN',
      priority: 'VIP',
      startAt: todayStart,
      endAt: todayEnd,
      durationMinutes: 30,
      notes: 'Семенной визит для тестирования АРМ',
      createdBy: admin.id,
      resources: {
        create: [
          {
            tenantId: tenant.id,
            resourceType: 'EMPLOYEE',
            resourceId: employee.id,
            reservedFrom: todayStart,
            reservedTo: todayEnd,
          },
          {
            tenantId: tenant.id,
            resourceType: 'ROOM',
            resourceId: usiOffice.id,
            reservedFrom: todayStart,
            reservedTo: todayEnd,
          },
        ],
      },
      statusHistory: {
        create: [
          { tenantId: tenant.id, newStatus: 'SCHEDULED', changedBy: admin.id, reason: 'Seeded' },
          { tenantId: tenant.id, newStatus: 'CHECKED_IN', changedBy: admin.id, reason: 'Seeded' },
        ],
      },
      visitStates: {
        create: [
          {
            tenantId: tenant.id,
            oldState: 'SCHEDULED',
            newState: 'CHECKED_IN',
            changedBy: admin.id,
            workstationType: 'RECEPTIONIST',
          },
        ],
      },
    },
  });

  // Create corresponding queue ticket
  await schedulingPrisma.visitQueue.deleteMany({
    where: { tenantId: tenant.id, appointmentId: demoApp.id },
  });
  await schedulingPrisma.visitQueue.create({
    data: {
      tenantId: tenant.id,
      branchId: branch.id,
      appointmentId: demoApp.id,
      queueNumber: 'Q-999',
      queueStatus: 'WAITING',
      priority: 'VIP',
      estimatedWaitTime: 10,
    },
  });

  // Create dummy incoming call for p1
  await schedulingPrisma.incomingCall.deleteMany({
    where: { tenantId: tenant.id, phoneNumber: '+79991112233' },
  });
  await schedulingPrisma.incomingCall.create({
    data: {
      tenantId: tenant.id,
      branchId: branch.id,
      phoneNumber: '+79991112233',
      patientId: p1.id,
      operatorUserId: admin.id,
      callStartedAt: new Date(Date.now() - 30000),
      callEndedAt: new Date(),
      durationSeconds: 30,
      callResult: 'ANSWERED',
    },
  });

  // Create a pending invoice for p1
  await prisma.invoice.deleteMany({
    where: { tenantId: tenant.id, appointmentId: demoApp.id },
  });
  await prisma.invoice.create({
    data: {
      tenantId: tenant.id,
      branchId: branch.id,
      patientId: p1.id,
      appointmentId: demoApp.id,
      invoiceNumber: 'INV-A-SEED-001',
      status: 'PENDING_PAYMENT',
      subtotalAmount: 1500,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: 1500,
      paidAmount: 0,
      dueAmount: 1500,
      currency: 'TJS',
      createdBy: admin.id,
      items: {
        create: [
          {
            tenantId: tenant.id,
            serviceId: serviceConsultation.id,
            quantity: 1,
            unitPrice: 1500,
            discountAmount: 0,
            materialCost: 200,
            taxAmount: 0,
            totalAmount: 1500,
            performerEmployeeId: employee.id,
          },
        ],
      },
    },
  });

  const atDemoDay = (dayOffset: number, hour: number, minute = 0) => {
    const value = new Date();
    value.setDate(value.getDate() + dayOffset);
    value.setHours(hour, minute, 0, 0);
    return value;
  };

  const createDemoAppointment = async (input: {
    appointmentNumber: string;
    patientId: string;
    employeeId: string;
    serviceId: string;
    roomId: string;
    dayOffset: number;
    startHour: number;
    startMinute?: number;
    durationMinutes: number;
    status: string;
    priority?: string;
    notes: string;
    invoiceStatus?: 'PENDING_PAYMENT' | 'PAID';
  }) => {
    const startAt = atDemoDay(input.dayOffset, input.startHour, input.startMinute ?? 0);
    const endAt = new Date(startAt.getTime() + input.durationMinutes * 60 * 1000);
    const appointment = await schedulingPrisma.appointment.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        patientId: input.patientId,
        employeeId: input.employeeId,
        serviceId: input.serviceId,
        appointmentNumber: input.appointmentNumber,
        bookingSource: 'ADMIN_PANEL',
        appointmentType: 'CONSULTATION',
        status: input.status,
        priority: input.priority ?? 'NORMAL',
        startAt,
        endAt,
        durationMinutes: input.durationMinutes,
        confirmedAt: [
          'CONFIRMED',
          'CHECKED_IN',
          'IN_PROGRESS',
          'COMPLETED_PENDING_PAYMENT',
          'COMPLETED',
        ].includes(input.status)
          ? startAt
          : null,
        checkedInAt: [
          'CHECKED_IN',
          'IN_PROGRESS',
          'COMPLETED_PENDING_PAYMENT',
          'COMPLETED',
        ].includes(input.status)
          ? startAt
          : null,
        completedAt: ['COMPLETED_PENDING_PAYMENT', 'COMPLETED'].includes(input.status)
          ? endAt
          : null,
        cancelledAt: ['CANCELLED', 'NO_SHOW'].includes(input.status) ? startAt : null,
        notes: input.notes,
        createdBy: admin.id,
        resources: {
          create: [
            {
              tenantId: tenant.id,
              resourceType: 'EMPLOYEE',
              resourceId: input.employeeId,
              reservedFrom: startAt,
              reservedTo: endAt,
            },
            {
              tenantId: tenant.id,
              resourceType: 'ROOM',
              resourceId: input.roomId,
              reservedFrom: startAt,
              reservedTo: endAt,
            },
          ],
        },
        statusHistory: {
          create: [
            {
              tenantId: tenant.id,
              newStatus: 'SCHEDULED',
              changedBy: admin.id,
              reason: 'Demo seed',
            },
            ...(input.status !== 'SCHEDULED'
              ? [
                  {
                    tenantId: tenant.id,
                    oldStatus: 'SCHEDULED',
                    newStatus: input.status,
                    changedBy: admin.id,
                    reason: 'Demo seed',
                  },
                ]
              : []),
          ],
        },
      },
    });

    if (input.status === 'CHECKED_IN') {
      await schedulingPrisma.visitQueue.create({
        data: {
          tenantId: tenant.id,
          branchId: branch.id,
          appointmentId: appointment.id,
          queueNumber: `Q-${input.appointmentNumber.slice(-3)}`,
          queueStatus: 'WAITING',
          priority: input.priority ?? 'NORMAL',
          estimatedWaitTime: input.priority === 'VIP' ? 5 : 15,
        },
      });
    }

    if (input.invoiceStatus) {
      const service = await prisma.service.findUniqueOrThrow({ where: { id: input.serviceId } });
      const isPaid = input.invoiceStatus === 'PAID';
      await prisma.invoice.create({
        data: {
          tenantId: tenant.id,
          branchId: branch.id,
          patientId: input.patientId,
          appointmentId: appointment.id,
          invoiceNumber: `INV-${input.appointmentNumber}`,
          status: input.invoiceStatus,
          subtotalAmount: service.basePrice,
          discountAmount: 0,
          taxAmount: 0,
          totalAmount: service.basePrice,
          paidAmount: isPaid ? service.basePrice : 0,
          dueAmount: isPaid ? 0 : service.basePrice,
          currency: 'TJS',
          createdBy: admin.id,
          items: {
            create: [
              {
                tenantId: tenant.id,
                serviceId: input.serviceId,
                quantity: 1,
                unitPrice: service.basePrice,
                discountAmount: 0,
                materialCost: 120,
                taxAmount: 0,
                totalAmount: service.basePrice,
                performerEmployeeId: input.employeeId,
              },
            ],
          },
        },
      });
    }

    return appointment;
  };

  const weeklyAppointments: Parameters<typeof createDemoAppointment>[0][] = [
    {
      appointmentNumber: 'A-DEMO-002',
      patientId: p4.id,
      employeeId: dentistEmployee.id,
      serviceId: serviceDentalTherapy.id,
      roomId: docOffice.id,
      dayOffset: 0,
      startHour: 9,
      durationMinutes: 45,
      status: 'CONFIRMED',
      priority: 'VIP',
      notes: 'VIP пациент, контроль после терапевтического лечения',
    },
    {
      appointmentNumber: 'A-DEMO-003',
      patientId: p5.id,
      employeeId: cardiologistEmployee.id,
      serviceId: serviceCardioDiagnostics.id,
      roomId: cardioOffice.id,
      dayOffset: 0,
      startHour: 9,
      startMinute: 30,
      durationMinutes: 30,
      status: 'SCHEDULED',
      notes: 'Первичная кардиологическая диагностика',
    },
    {
      appointmentNumber: 'A-DEMO-004',
      patientId: p6.id,
      employeeId: dentistEmployee.id,
      serviceId: serviceConsultation.id,
      roomId: treatmentRoom.id,
      dayOffset: 0,
      startHour: 10,
      startMinute: 30,
      durationMinutes: 30,
      status: 'IN_PROGRESS',
      notes: 'Пациент уже в кабинете, идет прием',
    },
    {
      appointmentNumber: 'A-DEMO-005',
      patientId: p7.id,
      employeeId: pediatricianEmployee.id,
      serviceId: servicePediatricConsultation.id,
      roomId: pediatricOffice.id,
      dayOffset: 0,
      startHour: 11,
      startMinute: 30,
      durationMinutes: 30,
      status: 'COMPLETED_PENDING_PAYMENT',
      notes: 'Осмотр после ОРВИ, ожидается оплата в кассе',
      invoiceStatus: 'PENDING_PAYMENT',
    },
    {
      appointmentNumber: 'A-DEMO-006',
      patientId: p2.id,
      employeeId: radiologistEmployee.id,
      serviceId: serviceUltrasoundAbdomen.id,
      roomId: usiOffice.id,
      dayOffset: 0,
      startHour: 12,
      startMinute: 30,
      durationMinutes: 30,
      status: 'COMPLETED',
      notes: 'УЗИ выполнено, прием закрыт',
      invoiceStatus: 'PAID',
    },
    {
      appointmentNumber: 'A-DEMO-007',
      patientId: p3.id,
      employeeId: dentistEmployee.id,
      serviceId: serviceConsultation.id,
      roomId: docOffice.id,
      dayOffset: 0,
      startHour: 14,
      durationMinutes: 30,
      status: 'CANCELLED',
      notes: 'Отмена по просьбе родителя',
    },
    {
      appointmentNumber: 'A-DEMO-008',
      patientId: p8.id,
      employeeId: gynecologistEmployee.id,
      serviceId: serviceGynecologyConsultation.id,
      roomId: gynecologyOffice.id,
      dayOffset: 1,
      startHour: 9,
      durationMinutes: 40,
      status: 'CONFIRMED',
      notes: 'Плановый профилактический прием',
    },
    {
      appointmentNumber: 'A-DEMO-009',
      patientId: p9.id,
      employeeId: dentistEmployee.id,
      serviceId: serviceDentalHygiene.id,
      roomId: docOffice.id,
      dayOffset: 1,
      startHour: 10,
      durationMinutes: 50,
      status: 'CONFIRMED',
      notes: 'Профессиональная гигиена перед ортопедическим лечением',
    },
    {
      appointmentNumber: 'A-DEMO-010',
      patientId: p10.id,
      employeeId: pediatricianEmployee.id,
      serviceId: servicePediatricConsultation.id,
      roomId: pediatricOffice.id,
      dayOffset: 1,
      startHour: 12,
      durationMinutes: 30,
      status: 'SCHEDULED',
      notes: 'Первичный прием ребенка, жалобы на кашель',
    },
    {
      appointmentNumber: 'A-DEMO-011',
      patientId: p11.id,
      employeeId: cardiologistEmployee.id,
      serviceId: serviceCardioDiagnostics.id,
      roomId: cardioOffice.id,
      dayOffset: 2,
      startHour: 8,
      startMinute: 30,
      durationMinutes: 30,
      status: 'CONFIRMED',
      priority: 'HIGH',
      notes: 'Контроль АД, пациент принимает терапию',
    },
    {
      appointmentNumber: 'A-DEMO-012',
      patientId: p12.id,
      employeeId: radiologistEmployee.id,
      serviceId: serviceUltrasoundAbdomen.id,
      roomId: usiOffice.id,
      dayOffset: 2,
      startHour: 10,
      durationMinutes: 30,
      status: 'CONFIRMED',
      notes: 'УЗИ по направлению гинеколога',
    },
    {
      appointmentNumber: 'A-DEMO-013',
      patientId: p13.id,
      employeeId: dentistEmployee.id,
      serviceId: serviceDentalTherapy.id,
      roomId: docOffice.id,
      dayOffset: 3,
      startHour: 9,
      durationMinutes: 45,
      status: 'SCHEDULED',
      notes: 'Лечение кариеса 36 зуба',
    },
    {
      appointmentNumber: 'A-DEMO-014',
      patientId: p14.id,
      employeeId: gynecologistEmployee.id,
      serviceId: serviceGynecologyConsultation.id,
      roomId: gynecologyOffice.id,
      dayOffset: 3,
      startHour: 11,
      durationMinutes: 40,
      status: 'CONFIRMED',
      priority: 'VIP',
      notes: 'VIP пациент, наблюдение беременности',
    },
    {
      appointmentNumber: 'A-DEMO-015',
      patientId: p1.id,
      employeeId: cardiologistEmployee.id,
      serviceId: serviceCardioDiagnostics.id,
      roomId: cardioOffice.id,
      dayOffset: 4,
      startHour: 9,
      startMinute: 30,
      durationMinutes: 30,
      status: 'CONFIRMED',
      notes: 'Повторная ЭКГ после коррекции терапии',
    },
    {
      appointmentNumber: 'A-DEMO-016',
      patientId: p6.id,
      employeeId: radiologistEmployee.id,
      serviceId: serviceUltrasoundAbdomen.id,
      roomId: usiOffice.id,
      dayOffset: 4,
      startHour: 13,
      durationMinutes: 30,
      status: 'SCHEDULED',
      notes: 'Контрольное УЗИ перед консультацией',
    },
    {
      appointmentNumber: 'A-DEMO-017',
      patientId: p7.id,
      employeeId: pediatricianEmployee.id,
      serviceId: servicePediatricConsultation.id,
      roomId: pediatricOffice.id,
      dayOffset: 5,
      startHour: 10,
      durationMinutes: 30,
      status: 'CONFIRMED',
      notes: 'Плановый осмотр школьника',
    },
    {
      appointmentNumber: 'A-DEMO-018',
      patientId: p5.id,
      employeeId: dentistEmployee.id,
      serviceId: serviceDentalHygiene.id,
      roomId: docOffice.id,
      dayOffset: 5,
      startHour: 12,
      durationMinutes: 50,
      status: 'SCHEDULED',
      notes: 'Профилактическая чистка',
    },
    {
      appointmentNumber: 'A-DEMO-019',
      patientId: p12.id,
      employeeId: gynecologistEmployee.id,
      serviceId: serviceGynecologyConsultation.id,
      roomId: gynecologyOffice.id,
      dayOffset: 6,
      startHour: 9,
      durationMinutes: 40,
      status: 'CONFIRMED',
      notes: 'Повторный прием по результатам УЗИ',
    },
    {
      appointmentNumber: 'A-DEMO-020',
      patientId: p11.id,
      employeeId: radiologistEmployee.id,
      serviceId: serviceUltrasoundAbdomen.id,
      roomId: usiOffice.id,
      dayOffset: 6,
      startHour: 11,
      durationMinutes: 30,
      status: 'SCHEDULED',
      notes: 'Плановая диагностика органов брюшной полости',
    },
    {
      appointmentNumber: 'A-DEMO-021',
      patientId: p9.id,
      employeeId: cardiologistEmployee.id,
      serviceId: serviceConsultation.id,
      roomId: cardioOffice.id,
      dayOffset: 6,
      startHour: 15,
      durationMinutes: 30,
      status: 'SCHEDULED',
      notes: 'Консультация по результатам анализов',
    },
  ];

  for (const appointment of weeklyAppointments) {
    await createDemoAppointment(appointment);
  }

  // 15. EMR Clinical Subsystem Seeding
  // ICD-10 Dictionary codes
  // Standard Units
  const units = [
    { code: 'mg', name: 'Milligram', nameRu: 'Миллиграмм' },
    { code: 'ml', name: 'Milliliter', nameRu: 'Миллилитр' },
    { code: 'tab', name: 'Tablet', nameRu: 'Таблетка' },
    { code: 'drop', name: 'Drop', nameRu: 'Капля' },
    { code: 'g', name: 'Gram', nameRu: 'Грамм' },
    { code: 'IU', name: 'International Unit', nameRu: 'МЕ' },
  ];
  for (const u of units) {
    await prisma.referenceUnit.upsert({
      where: { code: u.code },
      update: { name: u.name, nameRu: u.nameRu },
      create: { code: u.code, name: u.name, nameRu: u.nameRu },
    });
  }

  // Standard Routes
  const routes = [
    { code: 'PO', name: 'Oral', nameRu: 'Перорально' },
    { code: 'IV', name: 'Intravenous', nameRu: 'Внутривенно' },
    { code: 'IM', name: 'Intramuscular', nameRu: 'Внутримышечно' },
    { code: 'SC', name: 'Subcutaneous', nameRu: 'Подкожно' },
    { code: 'TOP', name: 'Topical', nameRu: 'Местно' },
    { code: 'INH', name: 'Inhalation', nameRu: 'Ингаляционно' },
  ];
  for (const r of routes) {
    await prisma.referenceRoute.upsert({
      where: { code: r.code },
      update: { name: r.name, nameRu: r.nameRu },
      create: { code: r.code, name: r.name, nameRu: r.nameRu },
    });
  }

  // Standard Dosage Forms
  const forms = [
    { code: 'tab', name: 'Tablet', nameRu: 'Таблетка' },
    { code: 'cap', name: 'Capsule', nameRu: 'Капсула' },
    { code: 'syrup', name: 'Syrup', nameRu: 'Сироп' },
    { code: 'drops', name: 'Drops', nameRu: 'Капли' },
    { code: 'injection', name: 'Injection solution', nameRu: 'Раствор для инъекций' },
  ];
  for (const f of forms) {
    await prisma.referenceDosageForm.upsert({
      where: { code: f.code },
      update: { name: f.name, nameRu: f.nameRu },
      create: { code: f.code, name: f.name, nameRu: f.nameRu },
    });
  }

  // ICD-10 codes
  const commonIcdCodes = [
    {
      code: 'I10',
      title: 'Essential (primary) hypertension',
      titleRu: 'Эссенциальная [первичная] гипертензия',
      titleTj: 'Фишорбаландии эссенсиалӣ',
      isLeaf: true,
    },
    {
      code: 'J00',
      title: 'Acute nasopharyngitis (common cold)',
      titleRu: 'Острый назофарингит [насморк]',
      titleTj: 'Назофарингити шадид',
      isLeaf: true,
    },
    {
      code: 'K02',
      title: 'Dental caries',
      titleRu: 'Кариес зубов',
      titleTj: 'Кариеси дандон',
      isLeaf: true,
    },
    {
      code: 'E11',
      title: 'Type 2 diabetes mellitus',
      titleRu: 'Сахарный диабет 2 типа',
      titleTj: 'Дябети қанди намуди 2',
      isLeaf: true,
    },
    { code: 'J45', title: 'Asthma', titleRu: 'Астма', titleTj: 'Астма', isLeaf: true },
  ];
  for (const icd of commonIcdCodes) {
    await prisma.referenceIcdCode.upsert({
      where: { code: icd.code },
      update: { title: icd.title, titleRu: icd.titleRu, titleTj: icd.titleTj },
      create: {
        code: icd.code,
        title: icd.title,
        titleRu: icd.titleRu,
        titleTj: icd.titleTj,
        version: 10,
        isLeaf: true,
        isActive: true,
      },
    });

    // Seed back compatibility DiagnosisDictionary as well
    await prisma.diagnosisDictionary.upsert({
      where: { code: icd.code },
      update: { nameRu: icd.titleRu, nameEn: icd.title },
      create: {
        code: icd.code,
        codeSystem: 'ICD-10',
        nameRu: icd.titleRu || '',
        nameEn: icd.title,
        nameTj: icd.titleTj,
        isActive: true,
      },
    });
  }

  // Reference INNs
  const inns = [
    {
      code: 'INN001',
      name: 'Perindopril',
      nameRu: 'Периндоприл',
      nameTj: 'Периндоприл',
      atxCode: 'C09AA04',
      fdaPregnancyCategory: 'D',
      requiresRenalAdjustment: true,
      requiresHepaticAdjustment: false,
    },
    {
      code: 'INN002',
      name: 'Spironolactone',
      nameRu: 'Спиронолактон',
      nameTj: 'Спиронолактон',
      atxCode: 'C03DA01',
      fdaPregnancyCategory: 'C',
      requiresRenalAdjustment: true,
      requiresHepaticAdjustment: false,
    },
    {
      code: 'INN003',
      name: 'Paracetamol',
      nameRu: 'Парацетамол',
      nameTj: 'Парацетамол',
      atxCode: 'N02BE01',
      fdaPregnancyCategory: 'B',
      requiresRenalAdjustment: false,
      requiresHepaticAdjustment: true,
    },
    {
      code: 'INN004',
      name: 'Warfarin',
      nameRu: 'Варфарин',
      nameTj: 'Варфарин',
      atxCode: 'B01AA03',
      fdaPregnancyCategory: 'X',
      requiresRenalAdjustment: false,
      requiresHepaticAdjustment: false,
    },
    {
      code: 'INN005',
      name: 'Amoxicillin',
      nameRu: 'Амоксициллин',
      nameTj: 'Амоксисиллин',
      atxCode: 'J01CA04',
      fdaPregnancyCategory: 'B',
      requiresRenalAdjustment: true,
      requiresHepaticAdjustment: false,
    },
  ];
  for (const inn of inns) {
    await prisma.referenceInn.upsert({
      where: { code: inn.code },
      update: {
        name: inn.name,
        nameRu: inn.nameRu,
        nameTj: inn.nameTj,
        atxCode: inn.atxCode,
        fdaPregnancyCategory: inn.fdaPregnancyCategory,
        requiresRenalAdjustment: inn.requiresRenalAdjustment,
        requiresHepaticAdjustment: inn.requiresHepaticAdjustment,
      },
      create: {
        code: inn.code,
        name: inn.name,
        nameRu: inn.nameRu,
        nameTj: inn.nameTj,
        atxCode: inn.atxCode,
        fdaPregnancyCategory: inn.fdaPregnancyCategory,
        requiresRenalAdjustment: inn.requiresRenalAdjustment,
        requiresHepaticAdjustment: inn.requiresHepaticAdjustment,
        isActive: true,
      },
    });
  }

  // Medicinal Products
  const meds = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      innCode: 'INN001',
      tradeName: 'Престариум',
      manufacturer: 'Servier',
      dosageForm: 'tab',
      strength: '5 mg',
      country: 'France',
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      innCode: 'INN002',
      tradeName: 'Верошпирон',
      manufacturer: 'Gedeon Richter',
      dosageForm: 'tab',
      strength: '25 mg',
      country: 'Hungary',
    },
    {
      id: '33333333-3333-3333-3333-333333333333',
      innCode: 'INN003',
      tradeName: 'Панадол',
      manufacturer: 'GSK',
      dosageForm: 'tab',
      strength: '500 mg',
      country: 'UK',
    },
    {
      id: '44444444-4444-4444-4444-444444444444',
      innCode: 'INN005',
      tradeName: 'Амоксиклав',
      manufacturer: 'Lek',
      dosageForm: 'tab',
      strength: '500/125 mg',
      country: 'Slovenia',
    },
  ];
  for (const med of meds) {
    await prisma.referenceMedicinalProduct.upsert({
      where: { id: med.id },
      update: {
        innCode: med.innCode,
        tradeName: med.tradeName,
        manufacturer: med.manufacturer,
        dosageForm: med.dosageForm,
        strength: med.strength,
        country: med.country,
      },
      create: {
        id: med.id,
        innCode: med.innCode,
        tradeName: med.tradeName,
        manufacturer: med.manufacturer,
        dosageForm: med.dosageForm,
        strength: med.strength,
        country: med.country,
        isActive: true,
      },
    });
  }

  // Allergens
  const allergens = [
    {
      code: 'ALL001',
      category: 'drug',
      title: 'Пенициллины',
      titleRu: 'Пенициллины',
      innCode: 'INN005',
    },
    { code: 'ALL002', category: 'food', title: 'Арахис', titleRu: 'Арахис', innCode: null },
  ];
  for (const all of allergens) {
    await prisma.referenceAllergen.upsert({
      where: { code: all.code },
      update: {
        category: all.category,
        title: all.title,
        titleRu: all.titleRu,
        innCode: all.innCode,
      },
      create: {
        code: all.code,
        category: all.category,
        title: all.title,
        titleRu: all.titleRu,
        innCode: all.innCode,
        isActive: true,
      },
    });
  }

  // DDIs
  const ddis = [
    {
      innCodeA: 'INN001',
      innCodeB: 'INN002',
      severity: 'major',
      mechanism: 'ACE inhibitors + aldosterone antagonists can cause severe hyperkalemia.',
      recommendation: 'Monitor potassium levels closely or avoid co-administration.',
    },
    {
      innCodeA: 'INN003',
      innCodeB: 'INN004',
      severity: 'moderate',
      mechanism: 'Chronic paracetamol can enhance the hypoprothrombinemic effect of warfarin.',
      recommendation: 'Monitor INR and adjust warfarin dose as needed.',
    },
  ];
  for (const ddi of ddis) {
    const existing = await prisma.referenceDdi.findFirst({
      where: {
        OR: [
          { innCodeA: ddi.innCodeA, innCodeB: ddi.innCodeB },
          { innCodeA: ddi.innCodeB, innCodeB: ddi.innCodeA },
        ],
      },
    });
    if (!existing) {
      await prisma.referenceDdi.create({
        data: {
          innCodeA: ddi.innCodeA,
          innCodeB: ddi.innCodeB,
          severity: ddi.severity,
          mechanism: ddi.mechanism,
          recommendation: ddi.recommendation,
        },
      });
    }
  }

  // LOINC Codes
  const loincs = [
    {
      code: '8480-6',
      component: 'Systolic blood pressure',
      system: 'BP',
      scale: 'Qn',
      class: 'BP',
      titleRu: 'Систолическое АД',
      referenceRange: '90-139',
    },
    {
      code: '8462-4',
      component: 'Diastolic blood pressure',
      system: 'BP',
      scale: 'Qn',
      class: 'BP',
      titleRu: 'Диастолическое АД',
      referenceRange: '60-89',
    },
    {
      code: '8867-4',
      component: 'Heart rate',
      system: 'HR',
      scale: 'Qn',
      class: 'CARDIAC',
      titleRu: 'Пульс / ЧСС',
      referenceRange: '60-100',
    },
    {
      code: '8310-5',
      component: 'Body temperature',
      system: 'Temp',
      scale: 'Qn',
      class: 'CLIN',
      titleRu: 'Температура тела',
      referenceRange: '35.5-37.2',
    },
    {
      code: '2708-6',
      component: 'Oxygen saturation',
      system: 'SpO2',
      scale: 'Qn',
      class: 'PULM',
      titleRu: 'Насыщение крови кислородом',
      referenceRange: '95-100',
    },
  ];
  for (const l of loincs) {
    await prisma.referenceLoincCode.upsert({
      where: { code: l.code },
      update: {
        component: l.component,
        system: l.system,
        scale: l.scale,
        class: l.class,
        titleRu: l.titleRu,
        referenceRange: l.referenceRange,
      },
      create: {
        code: l.code,
        component: l.component,
        system: l.system,
        scale: l.scale,
        class: l.class,
        titleRu: l.titleRu,
        referenceRange: l.referenceRange,
        isActive: true,
      },
    });
  }

  // Vital Alert Rules
  const alertRules = [
    { vitalType: 'BP_SYS', minNormal: 90, maxNormal: 139, minCritical: 80, maxCritical: 180 },
    { vitalType: 'BP_DIA', minNormal: 60, maxNormal: 89, minCritical: 50, maxCritical: 110 },
    { vitalType: 'HR', minNormal: 60, maxNormal: 100, minCritical: 45, maxCritical: 140 },
    { vitalType: 'TEMP', minNormal: 35.5, maxNormal: 37.2, minCritical: 35.0, maxCritical: 39.5 },
    { vitalType: 'SPO2', minNormal: 95, maxNormal: 100, minCritical: 90, maxCritical: 100 },
  ];
  for (const ar of alertRules) {
    const existing = await prisma.vitalAlertRule.findFirst({
      where: { vitalType: ar.vitalType, tenantId: null },
    });
    if (!existing) {
      await prisma.vitalAlertRule.create({
        data: {
          vitalType: ar.vitalType,
          minNormal: ar.minNormal,
          maxNormal: ar.maxNormal,
          minCritical: ar.minCritical,
          maxCritical: ar.maxCritical,
          tenantId: null,
          isActive: true,
        },
      });
    }
  }

  // Dental Procedure Templates
  const dentTemplates = [
    { code: 'DENT001', name: 'Dental caries treatment', nameRu: 'Лечение кариеса' },
    {
      code: 'DENT002',
      name: 'Pulpitis endodontic treatment',
      nameRu: 'Лечение пульпита (эндодонтия)',
    },
    { code: 'DENT003', name: 'Tooth extraction', nameRu: 'Удаление зуба' },
    { code: 'DENT004', name: 'Implantation', nameRu: 'Имплантация зуба' },
    {
      code: 'DENT005',
      name: 'Professional oral hygiene',
      nameRu: 'Профессиональная гигиена полости рта',
    },
  ];
  for (const dt of dentTemplates) {
    await prisma.dentalProcedureTemplate.upsert({
      where: { code: dt.code },
      update: { name: dt.name, nameRu: dt.nameRu },
      create: { code: dt.code, name: dt.name, nameRu: dt.nameRu, isActive: true },
    });
  }

  // Cardiology Template
  const cardiologyTemplateCode = 'cardio-exam';
  await prisma.clinicalTemplate.deleteMany({
    where: { tenantId: tenant.id, code: cardiologyTemplateCode },
  });
  const cardioTemplate = await prisma.clinicalTemplate.create({
    data: {
      tenantId: tenant.id,
      code: cardiologyTemplateCode,
      name: 'Кардиологический осмотр',
      version: 1,
      isSystem: true,
      isActive: true,
      schemaJson: {
        type: 'object',
        properties: {
          bloodPressure: { type: 'string', title: 'Артериальное давление (мм рт.ст.)' },
          heartRate: { type: 'number', title: 'ЧСС (уд/мин)' },
          complaints: { type: 'string', title: 'Жалобы пациента' },
        },
      },
      uiSchemaJson: {},
    },
  });

  // Medical Record
  await prisma.medicalRecord.deleteMany({
    where: { tenantId: tenant.id, patientId: p1.id },
  });
  const medRec = await prisma.medicalRecord.create({
    data: {
      tenantId: tenant.id,
      patientId: p1.id,
      medicalRecordNumber: 'MR-P-000001',
      bloodType: 'O_PLUS',
      allergiesJson: ['Пенициллин', 'Пыльца берёзы'],
      chronicConditionsJson: ['Гипертоническая болезнь II стадии'],
      emergencyContactsJson: [
        { name: 'Иванова Мария', relationship: 'Жена', phone: '+79992223344' },
      ],
    },
  });

  // Episode Of Care
  await prisma.episodeOfCare.deleteMany({
    where: { tenantId: tenant.id, patientId: p1.id },
  });
  const episode = await prisma.episodeOfCare.create({
    data: {
      tenantId: tenant.id,
      patientId: p1.id,
      branchId: branch.id,
      responsibleDoctorId: employee.id,
      episodeType: 'HYPERTENSION_TREATMENT',
      title: 'Лечение гипертонической болезни',
      startDate: new Date(),
      status: 'ACTIVE',
      clinicalSummary: 'Первичное выявление стойкого повышения АД. Подбор гипотензивной терапии.',
    },
  });

  // Encounter Note draft
  await prisma.encounter.deleteMany({
    where: { tenantId: tenant.id, patientId: p1.id },
  });
  await prisma.encounter.create({
    data: {
      tenantId: tenant.id,
      patientId: p1.id,
      appointmentId: demoApp.id,
      episodeId: episode.id,
      doctorEmployeeId: employee.id,
      encounterType: 'OUTPATIENT',
      startedAt: new Date(),
      status: 'DRAFT',
      compositions: {
        create: [
          {
            tenantId: tenant.id,
            templateId: cardioTemplate.id,
            compositionType: 'EXAMINATION_NOTE',
            title: 'Первичный осмотр кардиолога',
            status: 'DRAFT',
            sections: {
              create: [
                {
                  tenantId: tenant.id,
                  sectionCode: 'subjective',
                  sectionName: 'Жалобы и анамнез',
                  sortOrder: 1,
                  elements: {
                    create: [
                      {
                        tenantId: tenant.id,
                        fieldCode: 'complaints',
                        fieldType: 'text',
                        fieldValueJson:
                          'Головные боли в затылочной области, мелькание мушек перед глазами при повышении АД до 150/90.',
                      },
                    ],
                  },
                },
                {
                  tenantId: tenant.id,
                  sectionCode: 'objective',
                  sectionName: 'Объективные данные',
                  sortOrder: 2,
                  elements: {
                    create: [
                      {
                        tenantId: tenant.id,
                        fieldCode: 'bp_systolic',
                        fieldType: 'number',
                        fieldValueJson: 145,
                        unit: 'mmHg',
                        terminologyCode: '8480-6',
                      },
                      {
                        tenantId: tenant.id,
                        fieldCode: 'bp_diastolic',
                        fieldType: 'number',
                        fieldValueJson: 95,
                        unit: 'mmHg',
                        terminologyCode: '8462-4',
                      },
                      {
                        tenantId: tenant.id,
                        fieldCode: 'heart_rate',
                        fieldType: 'number',
                        fieldValueJson: 78,
                        unit: 'bpm',
                        terminologyCode: '8867-4',
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
      diagnoses: {
        create: [
          {
            tenantId: tenant.id,
            diagnosisCode: 'I10',
            diagnosisType: 'CLINICAL',
            isPrimary: true,
            notes: 'Первичная артериальная гипертензия 1 ст., риск 2.',
            createdBy: admin.id,
          },
        ],
      },
      prescriptions: {
        create: [
          {
            tenantId: tenant.id,
            prescriptionType: 'MEDICATION',
            notes: 'Принимать ежедневно утром под контроль АД',
            createdBy: admin.id,
            items: {
              create: [
                {
                  tenantId: tenant.id,
                  itemCode: 'perindopril',
                  itemName: 'Периндоприл 5 мг',
                  dosage: '5 мг',
                  frequency: '1 раз в сутки',
                  duration: '3 месяца',
                  route: 'oral',
                  quantity: 90,
                  instructions: 'Таблетки принимать натощак за 15 минут до завтрака',
                },
              ],
            },
          },
        ],
      },
    },
  });

  // 16. Finance, Cashier and SaaS Billing Seeding
  // Seed Tariff Plans
  const plans = [
    {
      code: 'basic',
      name: 'Basic Plan',
      monthlyPrice: 100,
      yearlyPrice: 1000,
      limits: { users: 5, branches: 1, sms: 100 },
    },
    {
      code: 'pro',
      name: 'Pro Plan',
      monthlyPrice: 250,
      yearlyPrice: 2500,
      limits: { users: 20, branches: 3, sms: 1000 },
    },
    {
      code: 'enterprise',
      name: 'Enterprise Plan',
      monthlyPrice: 500,
      yearlyPrice: 5000,
      limits: { users: 100, branches: 10, sms: 10000 },
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { code: plan.code },
      update: {
        name: plan.name,
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        limitsJson: plan.limits as any,
      },
      create: {
        code: plan.code,
        name: plan.name,
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        featuresJson: {},
        limitsJson: plan.limits as any,
        isActive: true,
      },
    });
  }

  const proPlan = await prisma.subscriptionPlan.findUnique({ where: { code: 'pro' } });

  // Seed active Pro subscription for tenant
  await prisma.tenantSubscription.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.tenantSubscription.create({
    data: {
      tenantId: tenant.id,
      subscriptionPlanId: proPlan!.id,
      subscriptionStatus: 'ACTIVE',
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // Seed default usage metrics limits
  for (const [metricCode, limitValue] of Object.entries(
    proPlan!.limitsJson as Record<string, number>,
  )) {
    await prisma.tenantUsageMetric.upsert({
      where: { tenantId_metricCode: { tenantId: tenant.id, metricCode } },
      create: {
        tenantId: tenant.id,
        metricCode,
        currentUsage: 1,
        limitValue,
      },
      update: {
        limitValue,
      },
    });
  }

  // Seed Payroll Rule for the Doctor
  await prisma.payrollRule.deleteMany({ where: { tenantId: tenant.id, employeeId: employee.id } });
  await prisma.payrollRule.create({
    data: {
      tenantId: tenant.id,
      employeeId: employee.id,
      payrollType: 'REVENUE_SHARE',
      percentageRate: 30.0,
      fixedAmount: 0.0,
      deductMaterialCost: true,
      appliesFrom: new Date(),
      isActive: true,
    },
  });

  // Seed Opened Cashier Shift
  await prisma.cashierShift.deleteMany({ where: { tenantId: tenant.id, cashierUserId: admin.id } });
  await prisma.cashierShift.create({
    data: {
      tenantId: tenant.id,
      cashierUserId: admin.id,
      branchId: branch.id,
      openingBalance: 1000.0,
    },
  });

  // Seed Payment Gateway (Alif acquiring)
  await prisma.paymentGateway.deleteMany({ where: { tenantId: tenant.id, code: 'alif' } });
  await prisma.paymentGateway.create({
    data: {
      tenantId: tenant.id,
      code: 'alif',
      name: 'Алиф Эквайринг',
      gatewayType: 'QR_ACQUIRING',
      configurationJson: { token: 'alif-seed-token-123', endpoint: 'https://api.alif.tj/v1' },
      isActive: true,
    },
  });

  // 17. Omnichannel CRM-Communications Seeding
  // Seed SMS Telco Provider Gateway (OsonSMS)
  await prisma.smsProvider.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.smsProvider.create({
    data: {
      tenantId: tenant.id,
      providerCode: 'OSON_SMS',
      providerName: 'OsonSMS Gateway RT',
      apiCredentialsJson: { token: 'osonsms-seed-secret-token-123', sender: 'MedCRM' },
      senderName: 'MedCRM',
      dailyLimit: 5000,
      isActive: true,
    },
  });

  // Seed Multi-lingual (RU/TJ) system templates
  await prisma.messageTemplate.deleteMany({ where: { tenantId: tenant.id } });

  const templateRu = await prisma.messageTemplate.create({
    data: {
      tenantId: tenant.id,
      templateCode: 'appt-confirm',
      templateName: 'Подтверждение записи на прием',
      channelType: 'SMS',
      languageCode: 'ru',
      subject: 'Подтверждение записи',
      templateBody:
        'Здравствуйте, {{patient_name}}! Вы записаны к врачу {{doctor_name}} на {{appointment_time}}. Подтвердите запись ответом: 1 - Подтвердить, 2 - Отменить.',
      variablesJson: {
        patient_name: 'Иван',
        doctor_name: 'Алиев А.',
        appointment_time: '24.05.2026 10:00',
      },
      isSystem: true,
      isActive: true,
    },
  });

  await prisma.messageTemplate.create({
    data: {
      tenantId: tenant.id,
      templateCode: 'appt-confirm',
      templateName: 'Тасдиқи қабули духтур',
      channelType: 'SMS',
      languageCode: 'tg',
      subject: 'Тасдиқи қабул',
      templateBody:
        'Салом, {{patient_name}}! Шумо ба духтур {{doctor_name}} дар вақти {{appointment_time}} сабт шудаед. Барои тасдиқ фиристед: 1, барои бекор кардан: 2.',
      variablesJson: {
        patient_name: 'Иван',
        doctor_name: 'Алиев А.',
        appointment_time: '24.05.2026 10:00',
      },
      isSystem: true,
      isActive: true,
    },
  });

  // Seed automated Trigger Alert notification rule
  await prisma.notificationRule.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.notificationRule.create({
    data: {
      tenantId: tenant.id,
      ruleName: 'Напоминание о подтверждении за 24ч',
      triggerEvent: 'appointment.confirmed',
      channelType: 'SMS',
      templateId: templateRu.id,
      delayMinutes: 0,
      isActive: true,
    },
  });

  // Seed Event-Driven Chatbot Action Flows
  await prisma.chatbotFlow.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.chatbotFlow.create({
    data: {
      tenantId: tenant.id,
      flowName: 'Бот авто-подтверждения / отмены записи',
      triggerType: 'KEYWORD',
      flowSchemaJson: {
        keywords: ['1', '2'],
        actions: ['CONFIRM_APPOINTMENT', 'CANCEL_APPOINTMENT'],
      },
      isActive: true,
    },
  });

  // Seed Patient CRM marketing preferences
  await prisma.communicationPreference.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.communicationPreference.create({
    data: {
      tenantId: tenant.id,
      patientId: p1.id,
      channelType: 'SMS',
      marketingAllowed: true,
      remindersAllowed: true,
      isBlocked: false,
    },
  });

  // 18. Integration Gateway Seeding
  await prisma.integrationMetric.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.deviceMeasurement.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.medicalDevice.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.callEvent.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.telephonyProvider.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.fileLink.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.file.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.storageProvider.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.clinicalObservation.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.labResult.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.labOrderItem.deleteMany({ where: { order: { tenantId: tenant.id } } });
  await prisma.labOrder.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.laboratoryProvider.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.webhookEvent.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.integrationLog.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.integrationProvider.deleteMany({ where: { tenantId: tenant.id } });

  const enc = await prisma.encounter.findFirst({
    where: { tenantId: tenant.id, patientId: p1.id },
  });
  const encounterId = enc ? enc.id : demoApp.id;

  const integrationProvider = await prisma.integrationProvider.create({
    data: {
      tenantId: tenant.id,
      providerType: 'LIS',
      providerCode: 'lis-gateway',
      providerName: 'LIS Integration Gateway',
      authenticationType: 'HMAC',
      configurationJson: { secret: 'super-secret-hmac-key' },
      rateLimitPerMinute: 120,
      isActive: true,
    },
  });

  const labProvider = await prisma.laboratoryProvider.create({
    data: {
      tenantId: tenant.id,
      providerCode: 'LIS_DIALAB',
      providerName: 'DiaLab LIS Laboratory RT',
      apiProtocol: 'HL7',
      endpointUrl: 'https://api.dialab.tj/v2/hl7',
      authenticationJson: { apiKey: 'dialab-seed-key-xyz-789' },
      mappingSchemaJson: { format: 'HL7_V2', segment: 'OBX' },
      isActive: true,
    },
  });

  const storageProvider = await prisma.storageProvider.create({
    data: {
      tenantId: tenant.id,
      providerCode: 'YANDEX_S3',
      providerType: 'S3_COMPATIBLE',
      bucketName: 'medcrm-tenant-files',
      region: 'ru-central1',
      endpointUrl: 'https://storage.yandexcloud.net',
      credentialsJson: { accessKeyId: 'YCAJE...seedKey', secretAccessKey: 'YCP...seedSecret' },
      isDefault: true,
      isActive: true,
    },
  });

  const telephonyProvider = await prisma.telephonyProvider.create({
    data: {
      tenantId: tenant.id,
      providerCode: 'MEGAFON_RT',
      providerName: 'Мегафон Таджикистан АТС',
      apiEndpoint: 'https://ats.megafon.tj/api/v1',
      webhookSecret: 'megafon-secret-key-456',
      configurationJson: { sipId: 'sip-user-123', region: 'dushanbe' },
      isActive: true,
    },
  });

  const medicalDevice = await prisma.medicalDevice.create({
    data: {
      tenantId: tenant.id,
      branchId: branch.id,
      roomId: null,
      deviceType: 'MONITOR',
      manufacturer: 'Mindray',
      model: 'BeneVision N15',
      serialNumber: 'MR-N15-99882211',
      protocolType: 'REST',
      connectionType: 'LAN',
      isActive: true,
    },
  });

  const activeOrder = await prisma.labOrder.create({
    data: {
      tenantId: tenant.id,
      patientId: p1.id,
      encounterId: encounterId,
      providerId: labProvider.id,
      externalOrderId: 'LIS-DIALAB-100239',
      orderStatus: 'SENT',
      priority: 'URGENT',
      orderedBy: admin.id,
      items: {
        create: [
          {
            testCode: 'GLU',
            testName: 'Глюкоза в плазме крови',
            loincCode: '15074-8',
            sampleType: 'PLASMA',
            status: 'SENT',
          },
          {
            testCode: 'CHO',
            testName: 'Общий холестерин',
            loincCode: '2093-3',
            sampleType: 'SERUM',
            status: 'SENT',
          },
        ],
      },
    },
  });

  const completedOrder = await prisma.labOrder.create({
    data: {
      tenantId: tenant.id,
      patientId: p1.id,
      encounterId: encounterId,
      providerId: labProvider.id,
      externalOrderId: 'LIS-DIALAB-100238',
      orderStatus: 'COMPLETED',
      priority: 'NORMAL',
      orderedBy: admin.id,
      completedAt: new Date(Date.now() - 3600000),
      items: {
        create: [
          {
            testCode: 'HEM',
            testName: 'Гемоглобин',
            loincCode: '718-7',
            sampleType: 'BLOOD',
            status: 'COMPLETED',
          },
        ],
      },
    },
  });

  const labResult = await prisma.labResult.create({
    data: {
      tenantId: tenant.id,
      patientId: p1.id,
      encounterId: encounterId,
      labOrderId: completedOrder.id,
      externalResultId: 'RES-DIALAB-883392',
      resultStatus: 'FINAL',
      resultJson: [
        {
          testCode: 'HEM',
          testName: 'Гемоглобин',
          value: '135',
          unit: 'g/L',
          referenceRange: '120-160',
          abnormalFlag: 'N',
        },
      ],
      abnormalFlagsJson: { HEM: 'N' },
    },
  });

  await prisma.clinicalObservation.create({
    data: {
      tenantId: tenant.id,
      patientId: p1.id,
      encounterId: encounterId,
      observationCode: 'HEM',
      observationName: 'Гемоглобин',
      value: '135',
      unit: 'g/L',
      referenceRange: '120-160',
      abnormalFlag: 'N',
      sourceProviderId: labProvider.id,
      labResultId: labResult.id,
    },
  });

  const callAudioFile = await prisma.file.create({
    data: {
      tenantId: tenant.id,
      patientId: p1.id,
      encounterId: encounterId,
      uploadedBy: admin.id,
      storageProviderId: storageProvider.id,
      fileCategory: 'AUDIO_CALL',
      fileName: 'CallRecord-782299.mp3',
      mimeType: 'audio/mpeg',
      extension: 'mp3',
      fileSize: 320000,
      objectKey: `${tenant.id}/${p1.id}/audio_call/record-782299.mp3`,
    },
  });

  await prisma.callEvent.create({
    data: {
      tenantId: tenant.id,
      providerId: telephonyProvider.id,
      callId: 'call-782299',
      patientId: p1.id,
      eventType: 'RECORDING_READY',
      phoneNumber: '+79991112233',
      direction: 'INBOUND',
      durationSeconds: 145,
      recordingFileId: callAudioFile.id,
    },
  });

  // 19. Business Intelligence & DWH Seeding
  await prisma.realtimeMetricCache.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.generatedReport.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.scheduledReport.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.doctorKpiMetric.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.retentionMetric.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.noShowMetric.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.roomUtilizationMetric.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.marketingFunnelMetric.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.financialDailyAggregate.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.dwFactMarketing.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.dwFactPayment.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.dwFactAppointment.deleteMany({ where: { tenantId: tenant.id } });

  // A. Seed DWH Facts
  await prisma.dwFactAppointment.create({
    data: {
      tenantId: tenant.id,
      branchId: branch.id,
      employeeId: employee.id,
      patientId: p1.id,
      serviceId: null,
      appointmentStatus: 'COMPLETED',
      bookingSource: 'TELEGRAM',
      durationMinutes: 30,
      noShowFlag: false,
      completedFlag: true,
      createdDate: new Date(Date.now() - 5 * 24 * 3600 * 1000),
      appointmentDate: new Date(Date.now() - 5 * 24 * 3600 * 1000),
    },
  });

  await prisma.dwFactPayment.create({
    data: {
      tenantId: tenant.id,
      branchId: branch.id,
      invoiceId: crypto.randomUUID(),
      patientId: p1.id,
      paymentMethod: 'CASH',
      amount: new Prisma.Decimal(250.0),
      discountAmount: new Prisma.Decimal(20.0),
      materialCost: new Prisma.Decimal(50.0),
      paymentDate: new Date(Date.now() - 5 * 24 * 3600 * 1000),
    },
  });

  await prisma.dwFactMarketing.create({
    data: {
      tenantId: tenant.id,
      patientId: p1.id,
      leadSource: 'MARKETING',
      utmSource: 'seed_instagram',
      utmCampaign: 'promo_may',
      acquisitionCost: new Prisma.Decimal(45.0),
      firstVisitDate: new Date(Date.now() - 5 * 24 * 3600 * 1000),
      firstPaymentDate: new Date(Date.now() - 5 * 24 * 3600 * 1000),
      ltv: new Prisma.Decimal(250.0),
    },
  });

  // B. Seed 7 Days Financial Daily Mart Trends
  for (let i = 7; i >= 1; i--) {
    const date = new Date(Date.now() - i * 24 * 3600 * 1000);
    await prisma.financialDailyAggregate.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        aggregationDate: date,
        totalRevenue: new Prisma.Decimal(1000 + i * 200),
        totalProfit: new Prisma.Decimal(700 + i * 150),
        totalExpenses: new Prisma.Decimal(300 + i * 50),
        totalRefunds: new Prisma.Decimal(0),
        averageCheck: new Prisma.Decimal(150 + i * 10),
        outstandingDebt: new Prisma.Decimal(0),
      },
    });
  }

  // C. Seed Marketing ROI Funnels Mart
  await prisma.marketingFunnelMetric.create({
    data: {
      tenantId: tenant.id,
      channelSource: 'seed_instagram',
      campaignName: 'promo_may',
      leadsCount: 150,
      appointmentsCount: 95,
      visitsCount: 82,
      paymentsCount: 75,
      totalRevenue: new Prisma.Decimal(18750.0),
      cac: new Prisma.Decimal(45.0),
      roi: new Prisma.Decimal(1.78),
    },
  });

  await prisma.marketingFunnelMetric.create({
    data: {
      tenantId: tenant.id,
      channelSource: 'OsonSMS',
      campaignName: 'reminders',
      leadsCount: 200,
      appointmentsCount: 180,
      visitsCount: 172,
      paymentsCount: 165,
      totalRevenue: new Prisma.Decimal(41250.0),
      cac: new Prisma.Decimal(12.0),
      roi: new Prisma.Decimal(16.18),
    },
  });

  // D. Seed Operational Metrics Mart
  await prisma.roomUtilizationMetric.create({
    data: {
      tenantId: tenant.id,
      roomId: usiOffice.id,
      employeeId: employee.id,
      utilizationPercent: new Prisma.Decimal(78.5),
      occupiedMinutes: 376,
      availableMinutes: 480,
      measuredDate: new Date(),
    },
  });

  await prisma.noShowMetric.create({
    data: {
      tenantId: tenant.id,
      employeeId: employee.id,
      branchId: branch.id,
      noShowRate: new Prisma.Decimal(4.5),
      cancellationRate: new Prisma.Decimal(6.2),
      measuredDate: new Date(),
    },
  });

  await prisma.retentionMetric.create({
    data: {
      tenantId: tenant.id,
      patientSegment: 'REGULAR',
      retentionPeriodDays: 90,
      retentionRate: new Prisma.Decimal(65.4),
      repeatVisits: 235,
    },
  });

  // E. Seed Doctor Performance KPI Mart
  await prisma.doctorKpiMetric.create({
    data: {
      tenantId: tenant.id,
      employeeId: employee.id,
      branchId: branch.id,
      totalVisits: 145,
      totalRevenue: new Prisma.Decimal(36250.0),
      utilizationRate: new Prisma.Decimal(82.4),
      retentionRate: new Prisma.Decimal(71.2),
      noShowRate: new Prisma.Decimal(3.1),
      averageCheck: new Prisma.Decimal(250.0),
      npsScore: new Prisma.Decimal(9.6),
    },
  });

  // F. Seed Active Scheduled Report Rule
  await prisma.scheduledReport.create({
    data: {
      tenantId: tenant.id,
      reportName: 'Weekly Executive Financial Summary',
      reportType: 'FINANCIAL',
      exportFormat: 'PDF',
      recipientsJson: ['director@demo.clinic', 'owner@demo.clinic'] as any,
      cronExpression: '0 8 * * 1',
      filtersJson: { period: 'last_7_days' } as any,
      isActive: true,
    },
  });

  // G. Seed Realtime Cache metrics
  await prisma.realtimeMetricCache.create({
    data: {
      tenantId: tenant.id,
      metricCode: 'active_appointments_count',
      metricValue: '12',
    },
  });

  await prisma.realtimeMetricCache.create({
    data: {
      tenantId: tenant.id,
      metricCode: 'pending_invoices_revenue',
      metricValue: '4820',
    },
  });

  await prisma.realtimeMetricCache.create({
    data: {
      tenantId: tenant.id,
      metricCode: 'checked_in_patients_count',
      metricValue: '3',
    },
  });

  // H. Seed Warehouses
  const mainWarehouse = await prisma.warehouse.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'MAIN-WH' } },
    update: {},
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      warehouseType: 'MAIN',
      code: 'MAIN-WH',
      name: 'Центральный склад',
    },
  });

  const roomWarehouse = await prisma.warehouse.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'USI-OFFICE-ROOM' } },
    update: { roomId: null },
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      roomId: null,
      warehouseType: 'ROOM',
      code: 'USI-OFFICE-ROOM',
      name: 'Шкаф диагностического кабинета',
    },
  });

  // I. Seed Supplier
  const supplier = await prisma.supplier.upsert({
    where: { tenantId_supplierCode: { tenantId: tenant.id, supplierCode: 'TAJ-MED' } },
    update: {},
    create: {
      tenantId: tenant.id,
      supplierCode: 'TAJ-MED',
      supplierName: 'Tajik Medical Supplies',
      phone: '+992900000001',
      email: 'sales@tajmed.tj',
    },
  });

  // J. Seed Nomenclature Inventory Items
  const lidoItem = await prisma.inventoryItem.upsert({
    where: { tenantId_itemCode: { tenantId: tenant.id, itemCode: 'LIDO-ANESTHETIC' } },
    update: {},
    create: {
      tenantId: tenant.id,
      itemCode: 'LIDO-ANESTHETIC',
      barcode: '4601234567890',
      itemName: 'Анестетик Лидокаин 2%',
      unitOfMeasure: 'AMPULE',
      inventoryType: 'MEDICATION',
      requiresBatchTracking: true,
      requiresExpirationTracking: true,
      minimumStockLevel: 10.0,
      reorderLevel: 20.0,
      defaultSupplierId: supplier.id,
    },
  });

  const gelItem = await prisma.inventoryItem.upsert({
    where: { tenantId_itemCode: { tenantId: tenant.id, itemCode: 'USI-GEL' } },
    update: {},
    create: {
      tenantId: tenant.id,
      itemCode: 'USI-GEL',
      barcode: '4601234567891',
      itemName: 'УЗИ-гель 250мл',
      unitOfMeasure: 'ML',
      inventoryType: 'CONSUMABLE',
      requiresBatchTracking: false,
      requiresExpirationTracking: false,
      minimumStockLevel: 50.0,
      reorderLevel: 100.0,
      defaultSupplierId: supplier.id,
    },
  });

  const demoInventoryItemIds = [lidoItem.id, gelItem.id];
  await prisma.stockAlertRule.deleteMany({
    where: { tenantId: tenant.id, itemId: { in: demoInventoryItemIds } },
  });
  await prisma.serviceBomItem.deleteMany({
    where: { bomTemplate: { tenantId: tenant.id, serviceId: serviceProcedure.id } },
  });
  await prisma.serviceBomTemplate.deleteMany({
    where: { tenantId: tenant.id, serviceId: serviceProcedure.id },
  });
  await prisma.inventoryBalance.deleteMany({
    where: { tenantId: tenant.id, itemId: { in: demoInventoryItemIds } },
  });
  await prisma.inventoryBatch.deleteMany({
    where: { tenantId: tenant.id, itemId: { in: demoInventoryItemIds } },
  });

  // K. Seed Expiring Batches for Lidocaine
  const batchA = await prisma.inventoryBatch.create({
    data: {
      tenantId: tenant.id,
      itemId: lidoItem.id,
      supplierId: supplier.id,
      batchNumber: 'LIDO-2026-A',
      expirationDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      purchasePrice: 15.5,
      currentQuantity: 5.0,
      warehouseId: roomWarehouse.id,
    },
  });

  const batchB = await prisma.inventoryBatch.create({
    data: {
      tenantId: tenant.id,
      itemId: lidoItem.id,
      supplierId: supplier.id,
      batchNumber: 'LIDO-2026-B',
      expirationDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      purchasePrice: 15.0,
      currentQuantity: 20.0,
      warehouseId: roomWarehouse.id,
    },
  });

  // L. Seed Balances for the Room Warehouse
  await prisma.inventoryBalance.create({
    data: {
      tenantId: tenant.id,
      warehouseId: roomWarehouse.id,
      itemId: lidoItem.id,
      batchId: batchA.id,
      availableQuantity: 5.0,
      reservedQuantity: 0.0,
    },
  });

  await prisma.inventoryBalance.create({
    data: {
      tenantId: tenant.id,
      warehouseId: roomWarehouse.id,
      itemId: lidoItem.id,
      batchId: batchB.id,
      availableQuantity: 20.0,
      reservedQuantity: 0.0,
    },
  });

  await prisma.inventoryBalance.create({
    data: {
      tenantId: tenant.id,
      warehouseId: roomWarehouse.id,
      itemId: gelItem.id,
      batchId: null,
      availableQuantity: 300.0,
      reservedQuantity: 0.0,
    },
  });

  // M. Seed Service BOM technology recipe template
  await prisma.serviceBomTemplate.create({
    data: {
      tenantId: tenant.id,
      serviceId: serviceProcedure.id,
      version: 'v1.0',
      isActive: true,
      createdBy: admin.id,
      bomItems: {
        create: [
          {
            inventoryItemId: lidoItem.id,
            quantity: 2.0,
            unitOfMeasure: 'AMPULE',
            isMandatory: true,
          },
          {
            inventoryItemId: gelItem.id,
            quantity: 50.0,
            unitOfMeasure: 'ML',
            isMandatory: true,
          },
        ],
      },
    },
  });

  // N. Seed StockAlertRule for Room Warehouse
  await prisma.stockAlertRule.upsert({
    where: {
      tenantId_warehouseId_itemId: {
        tenantId: tenant.id,
        warehouseId: roomWarehouse.id,
        itemId: lidoItem.id,
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      warehouseId: roomWarehouse.id,
      itemId: lidoItem.id,
      minimumQuantity: 5.0,
      criticalQuantity: 2.0,
      notificationTargetsJson: ['pharmacist@demo.clinic'] as any,
      isActive: true,
    },
  });

  console.log('Seed completed');
  console.log('Tenant code: demo-clinic');
  console.log('Login: admin@demo.clinic');
  console.log('Password: Admin123!');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await schedulingPrisma.$disconnect();
  });

import { createHash } from 'crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

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
    const r = await prisma.roomType.upsert({
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
    const c = await prisma.equipmentCategory.upsert({
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

  // 6. Rooms
  const docOffice = await prisma.room.upsert({
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

  const usiOffice = await prisma.room.upsert({
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

  const cardioOffice = await prisma.room.upsert({
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

  const treatmentRoom = await prisma.room.upsert({
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

  // Allowed specialties in room-102
  await prisma.roomSpecialty.upsert({
    where: {
      roomId_specialtyId: { roomId: usiOffice.id, specialtyId: specialtyMap.get('radiologist')! },
    },
    update: {},
    create: { roomId: usiOffice.id, specialtyId: specialtyMap.get('radiologist')! },
  });

  await prisma.roomSpecialty.upsert({
    where: {
      roomId_specialtyId: { roomId: docOffice.id, specialtyId: specialtyMap.get('dentist')! },
    },
    update: {},
    create: { roomId: docOffice.id, specialtyId: specialtyMap.get('dentist')! },
  });

  await prisma.roomSpecialty.upsert({
    where: {
      roomId_specialtyId: {
        roomId: cardioOffice.id,
        specialtyId: specialtyMap.get('cardiologist')!,
      },
    },
    update: {},
    create: { roomId: cardioOffice.id, specialtyId: specialtyMap.get('cardiologist')! },
  });

  // 7. Equipment
  const usiScanner = await prisma.equipment.upsert({
    where: { tenantId_inventoryNumber: { tenantId: tenant.id, inventoryNumber: 'EQ-USI-001' } },
    update: {},
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      roomId: usiOffice.id,
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

    await prisma.employeeRoomAssignment.deleteMany({
      where: { tenantId: tenant.id, employeeId: seededEmployee.id },
    });
    await prisma.employeeRoomAssignment.create({
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
  await prisma.employeeRoomAssignment.deleteMany({
    where: { tenantId: tenant.id, employeeId: employee.id },
  });
  await prisma.employeeRoomAssignment.create({
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
  // Branch Working Hours (weekday 1..5, 08:00 - 18:00)
  for (let i = 1; i <= 5; i++) {
    await prisma.workingSchedule.create({
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

  await prisma.workingSchedule.deleteMany({
    where: {
      tenantId: tenant.id,
      entityType: { in: ['employee', 'room'] },
      entityId: {
        in: [
          employee.id,
          dentistEmployee.id,
          cardiologistEmployee.id,
          docOffice.id,
          usiOffice.id,
          cardioOffice.id,
          treatmentRoom.id,
        ],
      },
    },
  });

  for (let weekday = 1; weekday <= 5; weekday++) {
    for (const entityId of [employee.id, dentistEmployee.id, cardiologistEmployee.id]) {
      await prisma.workingSchedule.create({
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
    for (const entityId of [docOffice.id, usiOffice.id, cardioOffice.id, treatmentRoom.id]) {
      await prisma.workingSchedule.create({
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
    const appointment = await prisma.appointment.findFirst({
      where: { tenantId: tenant.id, appointmentNumber },
    });
    if (!appointment) return;

    await prisma.paymentAllocation.deleteMany({
      where: { invoiceItem: { invoice: { appointmentId: appointment.id } } },
    });
    await prisma.patientDebt.deleteMany({ where: { invoice: { appointmentId: appointment.id } } });
    await prisma.invoiceItem.deleteMany({ where: { invoice: { appointmentId: appointment.id } } });
    await prisma.invoice.deleteMany({ where: { appointmentId: appointment.id } });
    await prisma.appointmentStatusHistory.deleteMany({ where: { appointmentId: appointment.id } });
    await prisma.appointmentResource.deleteMany({ where: { appointmentId: appointment.id } });
    await prisma.appointmentVisitState.deleteMany({ where: { appointmentId: appointment.id } });
    await prisma.visitQueue.deleteMany({ where: { appointmentId: appointment.id } });

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

    await prisma.appointment.delete({ where: { id: appointment.id } });
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
    where: { patientId: { in: [p1.id, p2.id, p3.id, p4.id, p5.id, p6.id, p7.id] } },
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
    await prisma.serviceRequiredResource.upsert({
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
    await prisma.serviceRequiredResource.upsert({
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
  await prisma.resourceBuffer.upsert({
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
  await prisma.resourceBuffer.upsert({
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

  await prisma.waitingList.deleteMany({
    where: { patientId: p2.id, tenantId: tenant.id },
  });

  await prisma.waitingList.create({
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
  await prisma.receptionistDashboardCache.deleteMany({
    where: { tenantId: tenant.id, branchId: branch.id },
  });

  const todayStart = new Date();
  todayStart.setHours(10, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(10, 30, 0, 0);

  for (const appointmentNumber of [
    'A-SEED-001',
    'A-DEMO-002',
    'A-DEMO-003',
    'A-DEMO-004',
    'A-DEMO-005',
    'A-DEMO-006',
    'A-DEMO-007',
  ]) {
    await deleteAppointmentByNumber(appointmentNumber);
  }

  const demoApp = await prisma.appointment.create({
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
  await prisma.visitQueue.deleteMany({
    where: { tenantId: tenant.id, appointmentId: demoApp.id },
  });
  await prisma.visitQueue.create({
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
  await prisma.incomingCall.deleteMany({
    where: { tenantId: tenant.id, phoneNumber: '+79991112233' },
  });
  await prisma.incomingCall.create({
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

  const atToday = (hour: number, minute = 0) => {
    const value = new Date();
    value.setHours(hour, minute, 0, 0);
    return value;
  };

  const createDemoAppointment = async (input: {
    appointmentNumber: string;
    patientId: string;
    employeeId: string;
    serviceId: string;
    roomId: string;
    startHour: number;
    startMinute?: number;
    durationMinutes: number;
    status: string;
    priority?: string;
    notes: string;
    invoiceStatus?: 'PENDING_PAYMENT' | 'PAID';
  }) => {
    const startAt = atToday(input.startHour, input.startMinute ?? 0);
    const endAt = new Date(startAt.getTime() + input.durationMinutes * 60 * 1000);
    const appointment = await prisma.appointment.create({
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
      await prisma.visitQueue.create({
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

  await createDemoAppointment({
    appointmentNumber: 'A-DEMO-002',
    patientId: p4.id,
    employeeId: dentistEmployee.id,
    serviceId: serviceDentalTherapy.id,
    roomId: docOffice.id,
    startHour: 9,
    durationMinutes: 45,
    status: 'CONFIRMED',
    priority: 'VIP',
    notes: 'VIP пациент, просит отдельный расчет после приема',
  });

  await createDemoAppointment({
    appointmentNumber: 'A-DEMO-003',
    patientId: p5.id,
    employeeId: cardiologistEmployee.id,
    serviceId: serviceCardioDiagnostics.id,
    roomId: cardioOffice.id,
    startHour: 9,
    startMinute: 30,
    durationMinutes: 30,
    status: 'SCHEDULED',
    notes: 'Первичная кардиологическая диагностика',
  });

  await createDemoAppointment({
    appointmentNumber: 'A-DEMO-004',
    patientId: p6.id,
    employeeId: dentistEmployee.id,
    serviceId: serviceConsultation.id,
    roomId: treatmentRoom.id,
    startHour: 10,
    startMinute: 30,
    durationMinutes: 30,
    status: 'IN_PROGRESS',
    notes: 'Пациент уже в кабинете, идет прием',
  });

  await createDemoAppointment({
    appointmentNumber: 'A-DEMO-005',
    patientId: p7.id,
    employeeId: cardiologistEmployee.id,
    serviceId: serviceCardioDiagnostics.id,
    roomId: cardioOffice.id,
    startHour: 11,
    startMinute: 30,
    durationMinutes: 30,
    status: 'COMPLETED_PENDING_PAYMENT',
    notes: 'Прием завершен, ожидается оплата в кассе',
    invoiceStatus: 'PENDING_PAYMENT',
  });

  await createDemoAppointment({
    appointmentNumber: 'A-DEMO-006',
    patientId: p2.id,
    employeeId: employee.id,
    serviceId: serviceProcedure.id,
    roomId: usiOffice.id,
    startHour: 12,
    startMinute: 30,
    durationMinutes: 45,
    status: 'COMPLETED',
    notes: 'УЗИ выполнено, прием закрыт',
    invoiceStatus: 'PAID',
  });

  await createDemoAppointment({
    appointmentNumber: 'A-DEMO-007',
    patientId: p3.id,
    employeeId: dentistEmployee.id,
    serviceId: serviceConsultation.id,
    roomId: docOffice.id,
    startHour: 14,
    durationMinutes: 30,
    status: 'CANCELLED',
    notes: 'Отмена по просьбе родителя',
  });

  // 15. EMR Clinical Subsystem Seeding
  // ICD-10 Dictionary codes
  const commonIcdCodes = [
    {
      code: 'I10',
      codeSystem: 'ICD-10',
      nameRu: 'Эссенциальная [первичная] гипертензия',
      nameEn: 'Essential (primary) hypertension',
    },
    {
      code: 'J00',
      codeSystem: 'ICD-10',
      nameRu: 'Острый назофарингит [насморк]',
      nameEn: 'Acute nasopharyngitis (common cold)',
    },
    { code: 'K02', codeSystem: 'ICD-10', nameRu: 'Кариес зубов', nameEn: 'Dental caries' },
  ];

  for (const diag of commonIcdCodes) {
    await prisma.diagnosisDictionary.upsert({
      where: { code: diag.code },
      update: { nameRu: diag.nameRu, nameEn: diag.nameEn },
      create: {
        code: diag.code,
        codeSystem: diag.codeSystem,
        nameRu: diag.nameRu,
        nameEn: diag.nameEn,
        isActive: true,
      },
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
      roomId: usiOffice.id,
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
    update: {},
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      roomId: usiOffice.id,
      warehouseType: 'ROOM',
      code: 'USI-OFFICE-ROOM',
      name: 'Шкаф УЗИ-кабинета',
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
  });

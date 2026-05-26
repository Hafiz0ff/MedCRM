import { PrismaClient } from '@prisma/client';
import { PrismaClient as SchedulingPrismaClient } from '../../apps/scheduling-service/src/generated/prisma-client';

async function main() {
  console.log('Starting seed-future: Populating demo data for the next 4 weeks...');

  const prisma = new PrismaClient();
  const schedulingPrisma = new SchedulingPrismaClient();

  try {
    // 1. Fetch clinic (tenant) and main branch
    const tenant = await prisma.tenant.findUnique({
      where: { code: 'demo-clinic' },
    });
    if (!tenant) {
      throw new Error("Tenant 'demo-clinic' not found. Please run the main seed script first.");
    }

    const branch = await prisma.branch.findFirst({
      where: { tenantId: tenant.id, code: 'main' },
    });
    if (!branch) {
      throw new Error("Main branch not found for tenant 'demo-clinic'.");
    }

    // 2. Fetch patients, employees, services, and rooms
    const patients = await prisma.patient.findMany({
      where: { tenantId: tenant.id },
    });
    if (patients.length === 0) {
      throw new Error('No patients found in primary database to associate future bookings.');
    }

    const employees = await prisma.employee.findMany({
      where: { tenantId: tenant.id },
    });
    if (employees.length === 0) {
      throw new Error('No employees found in primary database.');
    }

    const services = await prisma.service.findMany({
      where: { tenantId: tenant.id },
    });
    if (services.length === 0) {
      throw new Error('No services found in primary database.');
    }

    const rooms = await schedulingPrisma.room.findMany({
      where: { tenantId: tenant.id, branchId: branch.id },
    });
    if (rooms.length === 0) {
      throw new Error('No rooms found in scheduling database.');
    }

    console.log(
      `Loaded: ${patients.length} patients, ${employees.length} employees, ${services.length} services, ${rooms.length} rooms.`,
    );

    // 3. Clear any existing future appointments to avoid duplication
    const futureDateStart = new Date();
    futureDateStart.setHours(0, 0, 0, 0);

    const deletedApps = await schedulingPrisma.appointment.deleteMany({
      where: {
        tenantId: tenant.id,
        branchId: branch.id,
        startAt: { gte: futureDateStart },
        appointmentNumber: { startsWith: 'A-FUT-' },
      },
    });
    console.log(`Cleaned up ${deletedApps.count} existing future demo appointments.`);

    // 4. Generate appointments for the next 28 days
    const totalDays = 28;
    let createdCount = 0;

    const adminUser = await prisma.user.findFirst({
      where: { tenantId: tenant.id, email: 'admin@demo.clinic' },
    });
    const createdBy = adminUser ? adminUser.id : null;

    const availableStartHours = [9, 10, 11, 13, 14, 15, 16, 17];

    for (let dayOffset = 1; dayOffset <= totalDays; dayOffset++) {
      const date = new Date();
      date.setDate(date.getDate() + dayOffset);

      const dayOfWeek = date.getDay();
      if (dayOfWeek === 0) {
        // Skip Sundays as they are typical days off in the clinic seed
        continue;
      }

      // Schedule for a subset of 3 random doctors each day
      const activeDoctors = [...employees].sort(() => 0.5 - Math.random()).slice(0, 3);

      for (const doctor of activeDoctors) {
        // Schedule 2 to 4 random appointments for this doctor on this day
        const appointmentCount = 2 + Math.floor(Math.random() * 3);
        const bookedHours = [...availableStartHours]
          .sort(() => 0.5 - Math.random())
          .slice(0, appointmentCount);

        for (const hour of bookedHours) {
          const startAt = new Date(date);
          startAt.setHours(hour, 0, 0, 0);

          const endAt = new Date(startAt.getTime() + 30 * 60 * 1000); // 30 minutes duration

          const patient = patients[Math.floor(Math.random() * patients.length)];
          const service = services[Math.floor(Math.random() * services.length)];
          const room = rooms[Math.floor(Math.random() * rooms.length)];

          const uniqueNum = `A-FUT-${Date.now().toString().slice(-6)}-${Math.floor(10000 + Math.random() * 90000)}`;

          // Create future appointment
          await schedulingPrisma.appointment.create({
            data: {
              tenantId: tenant.id,
              branchId: branch.id,
              patientId: patient.id,
              employeeId: doctor.id,
              serviceId: service.id,
              appointmentNumber: uniqueNum,
              bookingSource: 'ADMIN_PANEL',
              appointmentType: 'CONSULTATION',
              status: 'SCHEDULED',
              priority: Math.random() > 0.8 ? 'URGENT' : 'NORMAL',
              startAt,
              endAt,
              durationMinutes: 30,
              notes: 'Плановый осмотр и консультация (демо-данные)',
              createdBy,
              resources: {
                create: [
                  {
                    tenantId: tenant.id,
                    resourceType: 'EMPLOYEE',
                    resourceId: doctor.id,
                    reservedFrom: startAt,
                    reservedTo: endAt,
                  },
                  {
                    tenantId: tenant.id,
                    resourceType: 'ROOM',
                    resourceId: room.id,
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
                    changedBy: createdBy,
                    reason: 'Demo future schedule seed',
                  },
                ],
              },
            },
          });

          createdCount++;
        }
      }
    }

    console.log(
      `Successfully created ${createdCount} future appointments across the next 4 weeks!`,
    );
  } catch (error) {
    console.error('Error during future demo seeding:', error);
  } finally {
    await prisma.$disconnect();
    await schedulingPrisma.$disconnect();
  }
}

main();

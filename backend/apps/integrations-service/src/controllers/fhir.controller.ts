import { createHash } from 'node:crypto';
import { PrismaService } from '@core/database/prisma.service';
import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Req,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import {
  toFhirPractitioner,
  toFhirEncounter,
  toFhirCondition,
  toFhirObservation,
  toFhirMedicationRequest,
  toFhirAllergyIntolerance,
  toFhirServiceRequest,
  toFhirDiagnosticReport,
  toFhirAppointment,
} from '../adapters/fhir/mappers/fhir-resource.mapper';
import { toFhirPatient, fromFhirPatient } from '../adapters/fhir/mappers/patient.mapper';
import { CombinedAuthGuard } from '../core/combined-auth.guard';

@ApiTags('fhir')
@ApiBearerAuth()
@UseGuards(CombinedAuthGuard)
@Controller('fhir/r5')
export class FhirController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('metadata')
  getMetadata() {
    return {
      resourceType: 'CapabilityStatement',
      status: 'active',
      date: new Date().toISOString(),
      kind: 'instance',
      fhirVersion: '5.0.0',
      format: ['application/fhir+json'],
      rest: [
        {
          mode: 'server',
          resource: [
            {
              type: 'Patient',
              interaction: [
                { code: 'read' },
                { code: 'create' },
                { code: 'update' },
                { code: 'search-type' },
              ],
            },
            { type: 'Practitioner', interaction: [{ code: 'read' }, { code: 'search-type' }] },
            {
              type: 'Encounter',
              interaction: [{ code: 'read' }, { code: 'create' }, { code: 'search-type' }],
            },
            { type: 'Condition', interaction: [{ code: 'read' }, { code: 'search-type' }] },
            { type: 'Observation', interaction: [{ code: 'read' }, { code: 'search-type' }] },
            { type: 'MedicationRequest', interaction: [{ code: 'read' }, { code: 'search-type' }] },
            {
              type: 'AllergyIntolerance',
              interaction: [{ code: 'read' }, { code: 'search-type' }],
            },
            { type: 'ServiceRequest', interaction: [{ code: 'read' }, { code: 'search-type' }] },
            { type: 'DiagnosticReport', interaction: [{ code: 'read' }, { code: 'search-type' }] },
            { type: 'Appointment', interaction: [{ code: 'read' }, { code: 'search-type' }] },
          ],
        },
      ],
    };
  }

  @Get(':resourceType/:id')
  async getResourceById(
    @Param('resourceType') resourceType: string,
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const tenantId = req.user.tenantId;

    switch (resourceType) {
      case 'Patient': {
        const p = await this.prisma.patient.findUnique({
          where: { id },
          include: { contacts: true },
        });
        if (!p || p.tenantId !== tenantId) throw new NotFoundException('Patient not found');
        return toFhirPatient(p);
      }
      case 'Practitioner': {
        const emp = await this.prisma.employee.findUnique({ where: { id } });
        if (!emp || emp.tenantId !== tenantId)
          throw new NotFoundException('Practitioner not found');
        return toFhirPractitioner(emp);
      }
      case 'Encounter': {
        const enc = await this.prisma.encounter.findUnique({ where: { id } });
        if (!enc || enc.tenantId !== tenantId) throw new NotFoundException('Encounter not found');
        return toFhirEncounter(enc);
      }
      case 'Condition': {
        const cond = await this.prisma.patientChronicCondition.findUnique({ where: { id } });
        if (!cond || cond.tenantId !== tenantId) throw new NotFoundException('Condition not found');
        return toFhirCondition(cond);
      }
      case 'Observation': {
        const obs = await this.prisma.clinicalObservation.findUnique({ where: { id } });
        if (!obs || obs.tenantId !== tenantId) throw new NotFoundException('Observation not found');
        return toFhirObservation(obs);
      }
      case 'MedicationRequest': {
        const item = await this.prisma.prescriptionItem.findUnique({
          where: { id },
          include: { prescription: true },
        });
        if (!item || item.prescription.tenantId !== tenantId)
          throw new NotFoundException('MedicationRequest not found');
        return toFhirMedicationRequest(item);
      }
      case 'AllergyIntolerance': {
        const allergy = await this.prisma.patientAllergy.findUnique({ where: { id } });
        if (!allergy || allergy.tenantId !== tenantId)
          throw new NotFoundException('AllergyIntolerance not found');
        return toFhirAllergyIntolerance(allergy);
      }
      case 'ServiceRequest': {
        const order = await this.prisma.labOrder.findUnique({ where: { id } });
        if (!order || order.tenantId !== tenantId)
          throw new NotFoundException('ServiceRequest not found');
        return toFhirServiceRequest(order);
      }
      case 'DiagnosticReport': {
        const result = await this.prisma.labResult.findUnique({
          where: { id },
          include: { observations: true },
        });
        if (!result || result.tenantId !== tenantId)
          throw new NotFoundException('DiagnosticReport not found');
        return toFhirDiagnosticReport(result);
      }
      case 'Appointment': {
        const appt = await this.prisma.appointment.findUnique({ where: { id } });
        if (!appt || appt.tenantId !== tenantId)
          throw new NotFoundException('Appointment not found');
        return toFhirAppointment(appt);
      }
      default:
        throw new BadRequestException(`Resource type ${resourceType} not supported`);
    }
  }

  @Get('Patient/:id/\\$everything')
  async getPatientEverything(@Param('id') id: string, @Req() req: any) {
    const tenantId = req.user.tenantId;

    const patient = await this.prisma.patient.findUnique({
      where: { id },
      include: { contacts: true },
    });
    if (!patient || patient.tenantId !== tenantId) throw new NotFoundException('Patient not found');

    const encounters = await this.prisma.encounter.findMany({ where: { patientId: id } });
    const conditions = await this.prisma.patientChronicCondition.findMany({
      where: { patientId: id },
    });
    const observations = await this.prisma.clinicalObservation.findMany({
      where: { patientId: id },
    });
    const prescriptions = await this.prisma.prescriptionItem.findMany({
      where: { prescription: { encounter: { patientId: id } } },
      include: { prescription: true },
    });
    const allergies = await this.prisma.patientAllergy.findMany({ where: { patientId: id } });
    const appointments = await this.prisma.appointment.findMany({ where: { patientId: id } });

    const bundle: any = {
      resourceType: 'Bundle',
      type: 'searchset',
      total:
        1 +
        encounters.length +
        conditions.length +
        observations.length +
        prescriptions.length +
        allergies.length +
        appointments.length,
      entry: [
        { resource: toFhirPatient(patient) },
        ...encounters.map((e) => ({ resource: toFhirEncounter(e) })),
        ...conditions.map((c) => ({ resource: toFhirCondition(c) })),
        ...observations.map((o) => ({ resource: toFhirObservation(o) })),
        ...prescriptions.map((p) => ({ resource: toFhirMedicationRequest(p) })),
        ...allergies.map((a) => ({ resource: toFhirAllergyIntolerance(a) })),
        ...appointments.map((ap) => ({ resource: toFhirAppointment(ap) })),
      ],
    };

    return bundle;
  }

  @Get(':resourceType')
  async searchResource(@Param('resourceType') resourceType: string, @Req() req: any) {
    const tenantId = req.user.tenantId;

    const buildBundle = (resources: any[]) => ({
      resourceType: 'Bundle',
      type: 'searchset',
      total: resources.length,
      entry: resources.map((r) => ({ resource: r })),
    });

    switch (resourceType) {
      case 'Patient': {
        const list = await this.prisma.patient.findMany({
          where: { tenantId },
          include: { contacts: true },
        });
        return buildBundle(list.map(toFhirPatient));
      }
      case 'Practitioner': {
        const list = await this.prisma.employee.findMany({ where: { tenantId } });
        return buildBundle(list.map(toFhirPractitioner));
      }
      case 'Encounter': {
        const list = await this.prisma.encounter.findMany({ where: { tenantId } });
        return buildBundle(list.map(toFhirEncounter));
      }
      case 'Condition': {
        const list = await this.prisma.patientChronicCondition.findMany({ where: { tenantId } });
        return buildBundle(list.map(toFhirCondition));
      }
      case 'Observation': {
        const list = await this.prisma.clinicalObservation.findMany({ where: { tenantId } });
        return buildBundle(list.map(toFhirObservation));
      }
      case 'MedicationRequest': {
        const list = await this.prisma.prescriptionItem.findMany({
          where: { prescription: { tenantId } },
          include: { prescription: true },
        });
        return buildBundle(list.map(toFhirMedicationRequest));
      }
      case 'AllergyIntolerance': {
        const list = await this.prisma.patientAllergy.findMany({ where: { tenantId } });
        return buildBundle(list.map(toFhirAllergyIntolerance));
      }
      case 'ServiceRequest': {
        const list = await this.prisma.labOrder.findMany({ where: { tenantId } });
        return buildBundle(list.map(toFhirServiceRequest));
      }
      case 'DiagnosticReport': {
        const list = await this.prisma.labResult.findMany({
          where: { tenantId },
          include: { observations: true },
        });
        return buildBundle(list.map(toFhirDiagnosticReport));
      }
      case 'Appointment': {
        const list = await this.prisma.appointment.findMany({ where: { tenantId } });
        return buildBundle(list.map(toFhirAppointment));
      }
      default:
        throw new BadRequestException(`Resource type ${resourceType} not supported`);
    }
  }

  @Post(':resourceType')
  async createResource(
    @Param('resourceType') resourceType: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const tenantId = req.user.tenantId;

    if (resourceType === 'Patient') {
      const mapped = fromFhirPatient(body);
      const patient = await this.prisma.$transaction(async (tx) => {
        const dbPatient = await tx.patient.create({
          data: {
            tenantId,
            firstName: mapped.firstName,
            lastName: mapped.lastName,
            middleName: mapped.middleName,
            fullName: mapped.fullName,
            gender: mapped.gender,
            birthDate: mapped.birthDate,
            patientCode: mapped.patientCode,
          },
        });

        if (mapped.contacts && mapped.contacts.length > 0) {
          await tx.patientContact.createMany({
            data: mapped.contacts.map((c: any) => ({
              tenantId,
              patientId: dbPatient.id,
              type: c.type,
              value: c.value,
              normalizedValueHash: createHash('sha256')
                .update(c.value.toLowerCase().replace(/[\s()+-]/g, ''))
                .digest('hex'),
              isPrimary: c.isPrimary,
            })),
          });
        }

        return tx.patient.findUnique({
          where: { id: dbPatient.id },
          include: { contacts: true },
        });
      });

      return toFhirPatient(patient);
    }

    throw new BadRequestException(`Write operations on ${resourceType} are not supported`);
  }

  @Put(':resourceType/:id')
  async updateResource(
    @Param('resourceType') resourceType: string,
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const tenantId = req.user.tenantId;

    if (resourceType === 'Patient') {
      const mapped = fromFhirPatient(body);
      const updated = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.patient.findFirst({
          where: { id, tenantId },
        });
        if (!existing) throw new NotFoundException('Patient not found');

        const dbPatient = await tx.patient.update({
          where: { id },
          data: {
            firstName: mapped.firstName,
            lastName: mapped.lastName,
            middleName: mapped.middleName,
            fullName: mapped.fullName,
            gender: mapped.gender,
            birthDate: mapped.birthDate,
          },
        });

        // Simple sync of contacts: delete old ones, recreate new ones
        await tx.patientContact.deleteMany({
          where: { patientId: id },
        });

        if (mapped.contacts && mapped.contacts.length > 0) {
          await tx.patientContact.createMany({
            data: mapped.contacts.map((c: any) => ({
              tenantId,
              patientId: id,
              type: c.type,
              value: c.value,
              normalizedValueHash: createHash('sha256')
                .update(c.value.toLowerCase().replace(/[\s()+-]/g, ''))
                .digest('hex'),
              isPrimary: c.isPrimary,
            })),
          });
        }

        return tx.patient.findUnique({
          where: { id },
          include: { contacts: true },
        });
      });

      return toFhirPatient(updated);
    }

    throw new BadRequestException(`Write operations on ${resourceType} are not supported`);
  }
}

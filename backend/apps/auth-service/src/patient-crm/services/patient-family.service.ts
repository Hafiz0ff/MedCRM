import { PrismaService } from '@core/database/prisma.service';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import { Injectable, NotFoundException } from '@nestjs/common';
import { FamilyGroupDto, FamilyMemberDto } from '../dto/patient-crm.dto';

/**
 * Service responsible for family group management and member relationships.
 */
@Injectable()
export class PatientFamilyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves the family group for a patient, including all members.
   */
  async getFamily(user: AuthenticatedUser, patientId: string) {
    await this.assertPatientExists(user, patientId);
    const membership = await this.prisma.familyMember.findFirst({
      where: { patientId, tenantId: user.tenantId },
      include: {
        familyGroup: {
          include: {
            members: {
              include: {
                patient: true,
              },
            },
          },
        },
      },
    });
    return membership ? membership.familyGroup : null;
  }

  /**
   * Creates a new family group within the tenant scope.
   */
  async createFamilyGroup(user: AuthenticatedUser, dto: FamilyGroupDto) {
    return this.prisma.familyGroup.create({
      data: {
        tenantId: user.tenantId,
        familyName: dto.familyName,
        primaryContactPatientId: dto.primaryContactPatientId,
        sharedBalanceEnabled: dto.sharedBalanceEnabled,
        sharedDiscountEnabled: dto.sharedDiscountEnabled,
      },
    });
  }

  /**
   * Adds a patient as a member to an existing family group.
   */
  async addFamilyMember(user: AuthenticatedUser, dto: FamilyMemberDto) {
    await this.assertPatientExists(user, dto.patientId);

    const fg = await this.prisma.familyGroup.findFirst({
      where: { id: dto.familyGroupId, tenantId: user.tenantId },
    });
    if (!fg) throw new NotFoundException('Family group not found');

    return this.prisma.familyMember.create({
      data: {
        tenantId: user.tenantId,
        familyGroupId: dto.familyGroupId,
        patientId: dto.patientId,
        relationType: dto.relationType,
        isPrimaryContact: dto.isPrimaryContact,
        canReceiveNotifications: dto.canReceiveNotifications,
      },
    });
  }

  /**
   * Removes a member from a family group.
   */
  async removeFamilyMember(user: AuthenticatedUser, memberId: string) {
    const member = await this.prisma.familyMember.findFirst({
      where: { id: memberId, tenantId: user.tenantId },
    });
    if (!member) throw new NotFoundException('Family member not found');

    await this.prisma.familyMember.delete({ where: { id: memberId } });
    return { success: true };
  }

  /**
   * Validates that a patient exists and belongs to the user's tenant.
   */
  private async assertPatientExists(user: AuthenticatedUser, patientId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: {
        id: patientId,
        tenantId: user.tenantId,
        OR: [{ registrationBranchId: null }, { registrationBranchId: { in: user.branchIds } }],
      },
    });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }
}

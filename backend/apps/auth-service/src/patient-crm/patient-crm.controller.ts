import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, UsePipes } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '@core/common/zod-validation.pipe';
import { CurrentUser } from '@core/security/current-user.decorator';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import { RequirePermissions } from '@core/security/permissions.decorator';
import { RequireModule } from '@core/security/modules.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleEnabledGuard } from '../auth/guards/module-enabled.guard';
import { RbacGuard } from '../auth/guards/rbac.guard';
import { PatientCrmService } from './patient-crm.service';
import {
  CreatePatientDto,
  PatientListQuery,
  UpdatePatientDto,
  createPatientSchema,
  patientListQuerySchema,
  updatePatientSchema,
  CreateContactDto,
  UpdateContactDto,
  MergePatientsDto,
  PatientStatusTransitionDto,
  createContactSchema,
  updateContactSchema,
  mergePatientsSchema,
  patientStatusTransitionSchema
} from './dto/patient.schemas';
import {
  CrmTagDto,
  CrmTagSchema,
  FamilyGroupDto,
  FamilyGroupSchema,
  FamilyMemberDto,
  FamilyMemberSchema,
  PatientLegalDocumentDto,
  PatientLegalDocumentSchema,
  PatientNoteDto,
  PatientNoteSchema,
  PatientLeadDto,
  PatientLeadSchema
} from './dto/patient-crm.dto';

@ApiTags('patients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModuleEnabledGuard, RbacGuard)
@RequireModule('patient-crm')
@Controller('patients')
export class PatientCrmController {
  constructor(private readonly patients: PatientCrmService) {}

  @Post()
  @RequirePermissions('patients.create')
  @ApiOperation({ summary: 'Create a new patient' })
  @UsePipes(new ZodValidationPipe(createPatientSchema))
  createPatient(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePatientDto) {
    return this.patients.create(user, dto);
  }

  @Get()
  @RequirePermissions('patients.read')
  @ApiOperation({ summary: 'List patients with pagination and branch-aware filtering' })
  list(@CurrentUser() user: AuthenticatedUser, @Query(new ZodValidationPipe(patientListQuerySchema)) query: PatientListQuery) {
    return this.patients.list(user, query);
  }

  @Get('search')
  @RequirePermissions('patients.read')
  @ApiOperation({ summary: 'Search patients and return duplicate candidates baseline' })
  search(@CurrentUser() user: AuthenticatedUser, @Query(new ZodValidationPipe(patientListQuerySchema)) query: PatientListQuery) {
    return this.patients.search(user, query);
  }

  // Tags endpoints
  @Get('tags')
  @RequirePermissions('patients.read')
  @ApiOperation({ summary: 'List all CRM tags for the tenant' })
  listTags(@CurrentUser() user: AuthenticatedUser) {
    return this.patients.listTags(user);
  }

  @Post('tags')
  @RequirePermissions('patients.tags.manage')
  @ApiOperation({ summary: 'Create a new CRM tag' })
  @UsePipes(new ZodValidationPipe(CrmTagSchema))
  createTag(@CurrentUser() user: AuthenticatedUser, @Body() dto: CrmTagDto) {
    return this.patients.createTag(user, dto);
  }

  @Post(':id/tags/:tagId')
  @RequirePermissions('patients.tags.manage')
  @ApiOperation({ summary: 'Assign a tag to a patient' })
  assignTag(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') patientId: string,
    @Param('tagId') tagId: string
  ) {
    return this.patients.assignTag(user, patientId, tagId);
  }

  @Delete(':id/tags/:tagId')
  @RequirePermissions('patients.tags.manage')
  @ApiOperation({ summary: 'Remove a tag from a patient' })
  removeTag(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') patientId: string,
    @Param('tagId') tagId: string
  ) {
    return this.patients.removeTag(user, patientId, tagId);
  }

  // Family groups endpoints
  @Post('family')
  @RequirePermissions('patients.family.manage')
  @ApiOperation({ summary: 'Create a new family group' })
  @UsePipes(new ZodValidationPipe(FamilyGroupSchema))
  createFamilyGroup(@CurrentUser() user: AuthenticatedUser, @Body() dto: FamilyGroupDto) {
    return this.patients.createFamilyGroup(user, dto);
  }

  @Post('family/members')
  @RequirePermissions('patients.family.manage')
  @ApiOperation({ summary: 'Add a member to a family group' })
  @UsePipes(new ZodValidationPipe(FamilyMemberSchema))
  addFamilyMember(@CurrentUser() user: AuthenticatedUser, @Body() dto: FamilyMemberDto) {
    return this.patients.addFamilyMember(user, dto);
  }

  @Delete('family/members/:memberId')
  @RequirePermissions('patients.family.manage')
  @ApiOperation({ summary: 'Remove a member from a family group' })
  removeFamilyMember(@CurrentUser() user: AuthenticatedUser, @Param('memberId') memberId: string) {
    return this.patients.removeFamilyMember(user, memberId);
  }

  // Legal document templates (must be before :id to prevent matching issues)
  @Get('documents/templates')
  @RequirePermissions('patients.documents.read')
  @ApiOperation({ summary: 'List all legal document templates' })
  listTemplates(@CurrentUser() user: AuthenticatedUser) {
    return this.patients.listTemplates(user);
  }

  // Patient specific details
  @Get(':id')
  @RequirePermissions('patients.read')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.patients.get(user, id);
  }

  @Patch(':id')
  @RequirePermissions('patients.update')
  @UsePipes(new ZodValidationPipe(updatePatientSchema))
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdatePatientDto) {
    return this.patients.update(user, id, dto);
  }

  @Get(':id/family')
  @RequirePermissions('patients.read')
  @ApiOperation({ summary: 'Get family group and all members for a patient' })
  getFamily(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.patients.getFamily(user, id);
  }

  @Get(':id/documents')
  @RequirePermissions('patients.documents.read')
  @ApiOperation({ summary: 'List signed legal documents for a patient' })
  listLegalDocuments(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.patients.listLegalDocuments(user, id);
  }

  @Post(':id/documents')
  @RequirePermissions('patients.documents.manage')
  @ApiOperation({ summary: 'Sign a legal document for a patient' })
  @UsePipes(new ZodValidationPipe(PatientLegalDocumentSchema))
  signLegalDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') patientId: string,
    @Body() dto: PatientLegalDocumentDto
  ) {
    return this.patients.signLegalDocument(user, patientId, dto);
  }

  @Get(':id/timeline')
  @RequirePermissions('patients.read')
  @ApiOperation({ summary: 'Get patient chronological timeline events' })
  getTimeline(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.patients.getTimeline(user, id);
  }

  @Post(':id/notes')
  @RequirePermissions('patients.notes.manage')
  @ApiOperation({ summary: 'Create an internal note for a patient' })
  @UsePipes(new ZodValidationPipe(PatientNoteSchema))
  createNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') patientId: string,
    @Body() dto: PatientNoteDto
  ) {
    return this.patients.createNote(user, patientId, dto);
  }

  @Get(':id/metrics')
  @RequirePermissions('patients.metrics.read')
  @ApiOperation({ summary: 'Get patient CRM metrics (LTV, visits, check average)' })
  getMetrics(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.patients.getMetrics(user, id);
  }

  @Post(':id/leads')
  @RequirePermissions('patients.update')
  @ApiOperation({ summary: 'Track patient lead attribution details' })
  @UsePipes(new ZodValidationPipe(PatientLeadSchema))
  trackLead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') patientId: string,
    @Body() dto: PatientLeadDto
  ) {
    return this.patients.trackLead(user, patientId, dto);
  }

  @Post('merge')
  @RequirePermissions('patients.update')
  @ApiOperation({ summary: 'Merge two duplicate patients' })
  @UsePipes(new ZodValidationPipe(mergePatientsSchema))
  merge(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MergePatientsDto
  ) {
    return this.patients.mergePatients(user, dto);
  }

  @Post(':id/contacts')
  @RequirePermissions('patients.update')
  @ApiOperation({ summary: 'Add a new contact to a patient' })
  @UsePipes(new ZodValidationPipe(createContactSchema))
  addContact(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') patientId: string,
    @Body() dto: CreateContactDto
  ) {
    return this.patients.addContact(user, patientId, dto);
  }

  @Patch(':id/contacts/:contactId')
  @RequirePermissions('patients.update')
  @ApiOperation({ summary: 'Update a patient contact' })
  @UsePipes(new ZodValidationPipe(updateContactSchema))
  updateContact(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') patientId: string,
    @Param('contactId') contactId: string,
    @Body() dto: UpdateContactDto
  ) {
    return this.patients.updateContact(user, patientId, contactId, dto);
  }

  @Delete(':id/contacts/:contactId')
  @RequirePermissions('patients.update')
  @ApiOperation({ summary: 'Remove a patient contact' })
  deleteContact(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') patientId: string,
    @Param('contactId') contactId: string
  ) {
    return this.patients.deleteContact(user, patientId, contactId);
  }

  @Patch(':id/status')
  @RequirePermissions('patients.update')
  @ApiOperation({ summary: 'Transition patient status' })
  @UsePipes(new ZodValidationPipe(patientStatusTransitionSchema))
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') patientId: string,
    @Body() dto: PatientStatusTransitionDto
  ) {
    return this.patients.updateStatus(user, patientId, dto);
  }
}


import { ZodValidationPipe } from '@core/common/zod-validation.pipe';
import { CurrentUser } from '@core/security/current-user.decorator';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import { RequireModule } from '@core/security/modules.decorator';
import { RequirePermissions } from '@core/security/permissions.decorator';
import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Put,
  Patch,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleEnabledGuard } from '../auth/guards/module-enabled.guard';
import { RbacGuard } from '../auth/guards/rbac.guard';
import { CdsEngine } from './cds/cds.engine';
import {
  UpdateMedicalRecordSchema,
  UpdateMedicalRecordDto,
  CreateEpisodeOfCareSchema,
  CreateEpisodeOfCareDto,
  UpdateEpisodeOfCareSchema,
  UpdateEpisodeOfCareDto,
  SaveEncounterSchema,
  SaveEncounterDto,
  SignEncounterSchema,
  SignEncounterDto,
  AmendEncounterSchema,
  AmendEncounterDto,
  CreateClinicalTemplateSchema,
  CreateClinicalTemplateDto,
  AssignDiagnosisSchema,
  AssignDiagnosisDto,
  CreatePrescriptionSchema,
  CreatePrescriptionDto,
  AddPatientAllergySchema,
  AddPatientAllergyDto,
  AddChronicConditionSchema,
  AddChronicConditionDto,
  UpdatePregnancyStateSchema,
  UpdatePregnancyStateDto,
  LogVitalSignSchema,
  LogVitalSignDto,
  CdsCheckSchema,
  CdsCheckDto,
  AddDentalChartEntrySchema,
  AddDentalChartEntryDto,
} from './dto/emr.dto';
import { FhirExportQueryDto, FhirExportQuerySchema } from './dto/fhir-export.dto';
import { EmrService } from './emr.service';
import { FhirExportService } from './fhir/fhir-export.service';

@ApiTags('emr')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModuleEnabledGuard, RbacGuard)
@RequireModule('emr-ehr')
@Controller('emr')
export class EmrController {
  constructor(
    private readonly emr: EmrService,
    private readonly fhirExport: FhirExportService,
    private readonly cds: CdsEngine,
  ) {}

  @Get('medical-records/patient/:patientId')
  @RequirePermissions('emr.records.read')
  getMedicalRecord(@CurrentUser() user: AuthenticatedUser, @Param('patientId') patientId: string) {
    return this.emr.getOrCreateMedicalRecord(user, patientId);
  }

  @Put('medical-records/patient/:patientId')
  @RequirePermissions('emr.records.manage')
  @UsePipes(new ZodValidationPipe(UpdateMedicalRecordSchema))
  updateMedicalRecord(
    @CurrentUser() user: AuthenticatedUser,
    @Param('patientId') patientId: string,
    @Body() dto: UpdateMedicalRecordDto,
  ) {
    return this.emr.updateMedicalRecord(user, patientId, dto);
  }

  @Post('episodes')
  @RequirePermissions('emr.records.manage')
  @UsePipes(new ZodValidationPipe(CreateEpisodeOfCareSchema))
  createEpisodeOfCare(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateEpisodeOfCareDto) {
    return this.emr.createEpisodeOfCare(user, dto);
  }

  @Patch('episodes/:id')
  @RequirePermissions('emr.records.manage')
  @UsePipes(new ZodValidationPipe(UpdateEpisodeOfCareSchema))
  updateEpisodeOfCare(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateEpisodeOfCareDto,
  ) {
    return this.emr.updateEpisodeOfCare(user, id, dto);
  }

  @Get('episodes')
  @RequirePermissions('emr.records.read')
  getEpisodes(@CurrentUser() user: AuthenticatedUser, @Query('patientId') patientId: string) {
    return this.emr.getEpisodes(user, patientId);
  }

  @Post('encounters')
  @RequirePermissions('emr.encounters.write')
  @UsePipes(new ZodValidationPipe(SaveEncounterSchema))
  createEncounterDraft(@CurrentUser() user: AuthenticatedUser, @Body() dto: SaveEncounterDto) {
    return this.emr.saveEncounterDraft(user, dto);
  }

  @Get('encounters/:id')
  @RequirePermissions('emr.records.read')
  getEncounter(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.emr.getEncounter(user, id);
  }

  @Patch('encounters/:id')
  @RequirePermissions('emr.encounters.write')
  @UsePipes(new ZodValidationPipe(SaveEncounterSchema))
  updateEncounterDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SaveEncounterDto,
  ) {
    return this.emr.saveEncounterDraft(user, dto, id);
  }

  @Post('encounters/:id/sign')
  @RequirePermissions('emr.encounters.sign')
  @UsePipes(new ZodValidationPipe(SignEncounterSchema))
  signEncounter(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SignEncounterDto,
  ) {
    return this.emr.signEncounter(user, id, dto);
  }

  @Post('encounters/:id/amend')
  @RequirePermissions('emr.encounters.amend')
  @UsePipes(new ZodValidationPipe(AmendEncounterSchema))
  amendEncounter(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AmendEncounterDto,
  ) {
    return this.emr.amendEncounter(user, id, dto);
  }

  @Get('encounters/:id/versions')
  @RequirePermissions('emr.records.read')
  getEncounterVersions(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.emr.getEncounterVersions(user, id);
  }

  @Post('encounters/:id/diagnoses')
  @RequirePermissions('emr.encounters.write')
  @UsePipes(new ZodValidationPipe(AssignDiagnosisSchema))
  assignDiagnosis(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') encounterId: string,
    @Body() dto: AssignDiagnosisDto,
  ) {
    return this.emr.assignDiagnosis(user, encounterId, dto);
  }

  @Post('encounters/:id/prescriptions')
  @RequirePermissions('emr.encounters.write')
  @UsePipes(new ZodValidationPipe(CreatePrescriptionSchema))
  createPrescription(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') encounterId: string,
    @Body() dto: CreatePrescriptionDto,
  ) {
    return this.emr.createPrescription(user, encounterId, dto);
  }

  @Get('templates')
  @RequirePermissions('emr.records.read')
  getClinicalTemplates(@CurrentUser() user: AuthenticatedUser) {
    return this.emr.getClinicalTemplates(user);
  }

  @Post('templates')
  @RequirePermissions('emr.templates.manage')
  @UsePipes(new ZodValidationPipe(CreateClinicalTemplateSchema))
  createClinicalTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateClinicalTemplateDto,
  ) {
    return this.emr.createClinicalTemplate(user, dto);
  }

  @Get('diagnoses/search')
  @RequirePermissions('emr.records.read')
  searchDiagnoses(@Query('q') query: string) {
    return this.emr.dictionarySearch(query);
  }

  // FHIR Export Endpoints
  @Get('fhir/Patient/:id')
  @Header('Content-Type', 'application/fhir+json')
  @RequirePermissions('emr.fhir.read')
  fhirExportPatient(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.emr.fhirExportPatient(user, id);
  }

  @Get('fhir/Encounter/:id')
  @Header('Content-Type', 'application/fhir+json')
  @RequirePermissions('emr.fhir.read')
  fhirExportEncounter(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.emr.fhirExportEncounter(user, id);
  }

  @Get('fhir/Observation/:id')
  @Header('Content-Type', 'application/fhir+json')
  @RequirePermissions('emr.fhir.read')
  fhirExportObservation(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.emr.fhirExportObservation(user, id);
  }

  // FHIR R4 Bundle export — aggregates Patient, Encounter, Condition,
  // MedicationRequest, and Observation resources for a single patient.
  @Get('fhir/Bundle/Patient/:patientId')
  @Header('Content-Type', 'application/fhir+json')
  @RequirePermissions('emr.fhir.read')
  fhirExportPatientBundle(
    @CurrentUser() user: AuthenticatedUser,
    @Param('patientId') patientId: string,
    @Query(new ZodValidationPipe(FhirExportQuerySchema)) query: FhirExportQueryDto,
  ) {
    return this.fhirExport.exportPatientBundle(user, patientId, query);
  }

  // --- DICTIONARIES ---
  @Get('dicts/icd')
  @RequirePermissions('emr.records.read')
  searchIcd(@Query('q') query: string) {
    return this.emr.searchIcd(query || '');
  }

  @Get('dicts/inn')
  @RequirePermissions('emr.records.read')
  searchInn(@Query('q') query: string) {
    return this.emr.searchInn(query || '');
  }

  @Get('dicts/medicinal-product')
  @RequirePermissions('emr.records.read')
  searchMedicinalProduct(@Query('q') query: string) {
    return this.emr.searchMedicinalProduct(query || '');
  }

  @Get('dicts/allergen')
  @RequirePermissions('emr.records.read')
  searchAllergen(@Query('q') query: string) {
    return this.emr.searchAllergen(query || '');
  }

  // --- VITALS ---
  @Post('vitals')
  @RequirePermissions('emr.encounters.write')
  @UsePipes(new ZodValidationPipe(LogVitalSignSchema))
  logVitalSign(@CurrentUser() user: AuthenticatedUser, @Body() dto: LogVitalSignDto) {
    return this.emr.logVitalSign(user, dto);
  }

  @Get('vitals/patient/:patientId')
  @RequirePermissions('emr.records.read')
  getPatientVitals(@CurrentUser() user: AuthenticatedUser, @Param('patientId') patientId: string) {
    return this.emr.getPatientVitals(user, patientId);
  }

  // --- ALLERGIES ---
  @Post('patients/:patientId/allergies')
  @RequirePermissions('emr.records.manage')
  @UsePipes(new ZodValidationPipe(AddPatientAllergySchema))
  addPatientAllergy(
    @CurrentUser() user: AuthenticatedUser,
    @Param('patientId') patientId: string,
    @Body() dto: AddPatientAllergyDto,
  ) {
    return this.emr.addPatientAllergy(user, patientId, dto);
  }

  @Get('patients/:patientId/allergies')
  @RequirePermissions('emr.records.read')
  getPatientAllergies(
    @CurrentUser() user: AuthenticatedUser,
    @Param('patientId') patientId: string,
  ) {
    return this.emr.getPatientAllergies(user, patientId);
  }

  // --- CHRONIC CONDITIONS ---
  @Post('patients/:patientId/chronic-conditions')
  @RequirePermissions('emr.records.manage')
  @UsePipes(new ZodValidationPipe(AddChronicConditionSchema))
  addPatientChronicCondition(
    @CurrentUser() user: AuthenticatedUser,
    @Param('patientId') patientId: string,
    @Body() dto: AddChronicConditionDto,
  ) {
    return this.emr.addPatientChronicCondition(user, patientId, dto);
  }

  @Get('patients/:patientId/chronic-conditions')
  @RequirePermissions('emr.records.read')
  getPatientChronicConditions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('patientId') patientId: string,
  ) {
    return this.emr.getPatientChronicConditions(user, patientId);
  }

  // --- PREGNANCY STATE ---
  @Post('patients/:patientId/pregnancy')
  @RequirePermissions('emr.records.manage')
  @UsePipes(new ZodValidationPipe(UpdatePregnancyStateSchema))
  updatePatientPregnancyState(
    @CurrentUser() user: AuthenticatedUser,
    @Param('patientId') patientId: string,
    @Body() dto: UpdatePregnancyStateDto,
  ) {
    return this.emr.updatePatientPregnancyState(user, patientId, dto);
  }

  @Get('patients/:patientId/pregnancy')
  @RequirePermissions('emr.records.read')
  getPatientPregnancyState(
    @CurrentUser() user: AuthenticatedUser,
    @Param('patientId') patientId: string,
  ) {
    return this.emr.getPatientPregnancyState(user, patientId);
  }

  // --- DENTAL CHART ---
  @Post('patients/:patientId/dental-chart')
  @RequirePermissions('emr.records.manage')
  @UsePipes(new ZodValidationPipe(AddDentalChartEntrySchema))
  addDentalChartEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('patientId') patientId: string,
    @Body() dto: AddDentalChartEntryDto,
  ) {
    return this.emr.addDentalChartEntry(user, patientId, dto);
  }

  @Get('patients/:patientId/dental-chart')
  @RequirePermissions('emr.records.read')
  getDentalChart(@CurrentUser() user: AuthenticatedUser, @Param('patientId') patientId: string) {
    return this.emr.getDentalChart(user, patientId);
  }

  @Get('dental/procedures')
  @RequirePermissions('emr.records.read')
  getDentalProcedures() {
    return this.emr.getDentalProcedureTemplates();
  }

  // --- CDS ENGINE ---
  @Post('cds/check')
  @RequirePermissions('emr.records.read')
  @UsePipes(new ZodValidationPipe(CdsCheckSchema))
  checkCds(@CurrentUser() user: AuthenticatedUser, @Body() dto: CdsCheckDto) {
    return this.cds.check(user.tenantId, dto);
  }

  // --- LAB REPORTS ---
  @Get('patients/:patientId/lab-reports')
  @RequirePermissions('emr.records.read')
  getPatientLabReports(
    @CurrentUser() user: AuthenticatedUser,
    @Param('patientId') patientId: string,
  ) {
    return this.emr.getPatientLabReports(user, patientId);
  }
}

import { Module, OnModuleInit } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { OneCAdapter } from './adapters/accounting/1c-rest.adapter';
import { OrthancAdapter } from './adapters/dicom/orthanc.adapter';
import { AtolAdapter, EvotorAdapter, SoliqAdapter } from './adapters/fiscal/fiscal-adapters';
import { EsiaAdapter } from './adapters/gov-id/esia.adapter';
import { Hl7MllpServer } from './adapters/hl7/hl7-mllp.server';
import { HelixAdapter, InvitroAdapter, CitilabAdapter } from './adapters/lis/lab-adapters';
import { DocDocAdapter } from './adapters/marketplace/docdoc.adapter';
import { TelehealthService } from './adapters/telehealth.service';
import { UkepSignAdapter } from './adapters/ukep-sign.adapter';
import { IntegrationAdminController } from './controllers/admin.controller';
import { FhirController } from './controllers/fhir.controller';
import { IntegrationGatewayController } from './controllers/integration-gateway.controller';
import { WebhooksController } from './controllers/webhooks.controller';
import { AdapterRegistry } from './core/adapter-registry';
import { CombinedAuthGuard } from './core/combined-auth.guard';
import { IdMapperService } from './core/id-mapper.service';
import { InboxProcessor } from './core/inbox-processor';

const adapters = [
  HelixAdapter,
  InvitroAdapter,
  CitilabAdapter,
  AtolAdapter,
  EvotorAdapter,
  SoliqAdapter,
  OrthancAdapter,
  EsiaAdapter,
  OneCAdapter,
  DocDocAdapter,
];

@Module({
  imports: [JwtModule.register({})],
  providers: [
    // Core
    AdapterRegistry,
    InboxProcessor,
    IdMapperService,
    CombinedAuthGuard,
    // Adapters
    ...adapters,
    TelehealthService,
    UkepSignAdapter,
    // HL7 TCP server (lifecycle-managed)
    Hl7MllpServer,
  ],
  controllers: [
    FhirController,
    WebhooksController,
    IntegrationGatewayController,
    IntegrationAdminController,
  ],
  exports: [AdapterRegistry, InboxProcessor, IdMapperService, TelehealthService, UkepSignAdapter],
})
export class IntegrationsModule implements OnModuleInit {
  constructor(
    private readonly registry: AdapterRegistry,
    private readonly helixAdapter: HelixAdapter,
    private readonly invitroAdapter: InvitroAdapter,
    private readonly citilabAdapter: CitilabAdapter,
    private readonly atolAdapter: AtolAdapter,
    private readonly evotorAdapter: EvotorAdapter,
    private readonly soliqAdapter: SoliqAdapter,
    private readonly orthancAdapter: OrthancAdapter,
    private readonly esiaAdapter: EsiaAdapter,
    private readonly oneCAdapter: OneCAdapter,
    private readonly docDocAdapter: DocDocAdapter,
  ) {}

  onModuleInit() {
    this.registry.register(this.helixAdapter);
    this.registry.register(this.invitroAdapter);
    this.registry.register(this.citilabAdapter);
    this.registry.register(this.atolAdapter);
    this.registry.register(this.evotorAdapter);
    this.registry.register(this.soliqAdapter);
    this.registry.register(this.orthancAdapter);
    this.registry.register(this.esiaAdapter);
    this.registry.register(this.oneCAdapter);
    this.registry.register(this.docDocAdapter);
  }
}

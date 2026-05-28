import { PrismaService } from '@core/database/prisma.service';
import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Req,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiQuery } from '@nestjs/swagger';
import { AdapterRegistry } from '../core/adapter-registry';
import { CombinedAuthGuard } from '../core/combined-auth.guard';
import { InboxProcessor } from '../core/inbox-processor';

@ApiTags('integration-admin')
@ApiBearerAuth()
@UseGuards(CombinedAuthGuard)
@Controller('integration/admin')
export class IntegrationAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: AdapterRegistry,
    private readonly inboxProcessor: InboxProcessor,
  ) {}

  /** GET /integration/admin/adapters — список всех зарегистрированных адаптеров */
  @Get('adapters')
  listAdapters() {
    const adapters = this.registry.list();
    return adapters.map((adapter) => ({
      kind: adapter.kind,
      adminUi: adapter.buildAdminUi(),
    }));
  }

  /** GET /integration/admin/logs — журнал интеграционных операций */
  @Get('logs')
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'providerId', required: false })
  @ApiQuery({ name: 'direction', required: false, enum: ['INBOUND', 'OUTBOUND'] })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  async getLogs(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('providerId') providerId?: string,
    @Query('direction') direction?: 'INBOUND' | 'OUTBOUND',
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const tenantId = req.user.tenantId;
    const take = Math.min(Number(pageSize) || 20, 100);
    const skip = ((Number(page) || 1) - 1) * take;

    const where: any = { tenantId };
    if (providerId) where.providerId = providerId;
    if (direction) where.direction = direction;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [data, total] = await Promise.all([
      this.prisma.integrationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.integrationLog.count({ where }),
    ]);

    return { data, total, page: Number(page) || 1, pageSize: take };
  }

  /** GET /integration/admin/inbox — очередь входящих сообщений */
  @Get('inbox')
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'providerId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ['RECEIVED', 'PROCESSED', 'FAILED'] })
  async getInbox(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('providerId') providerId?: string,
    @Query('status') status?: string,
  ) {
    const tenantId = req.user.tenantId;
    const take = Math.min(Number(pageSize) || 20, 100);
    const skip = ((Number(page) || 1) - 1) * take;

    const where: any = { tenantId };
    if (providerId) where.providerId = providerId;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.integrationInbox.findMany({
        where,
        orderBy: { receivedAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.integrationInbox.count({ where }),
    ]);

    return { data, total, page: Number(page) || 1, pageSize: take };
  }

  /** POST /integration/admin/inbox/:id/replay — повторная обработка упавшего сообщения */
  @Post('inbox/:id/replay')
  async replayInboxMessage(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.user.tenantId;

    const message = await this.prisma.integrationInbox.findUnique({
      where: { id },
    });

    if (!message || message.tenantId !== tenantId) {
      throw new NotFoundException('Сообщение не найдено');
    }

    if (message.status !== 'FAILED') {
      throw new BadRequestException(
        'Повторная обработка доступна только для сообщений со статусом FAILED',
      );
    }

    // Сбрасываем статус на RECEIVED для повторной обработки
    await this.prisma.integrationInbox.update({
      where: { id },
      data: { status: 'RECEIVED', lastError: null },
    });

    // Запускаем повторную обработку через InboxProcessor
    const result = await this.inboxProcessor.processInbound(
      message.tenantId,
      message.providerId,
      message.externalId,
      message.messageType,
      message.payloadRaw,
      message.payloadJson,
    );

    return { success: true, message: result };
  }

  /** GET /integration/admin/stats — статистика здоровья интеграций */
  @Get('stats')
  async getStats(@Req() req: any) {
    const tenantId = req.user.tenantId;
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      inboxByStatus,
      logsByDirection,
      totalProviders,
      activeProviders,
      recentLogs,
      recentInbox,
    ] = await Promise.all([
      this.prisma.integrationInbox.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { id: true },
      }),
      this.prisma.integrationLog.groupBy({
        by: ['direction'],
        where: { tenantId, createdAt: { gte: since24h } },
        _count: { id: true },
      }),
      this.prisma.integrationProvider.count({ where: { tenantId } }),
      this.prisma.integrationProvider.count({ where: { tenantId, isActive: true } }),
      this.prisma.integrationLog.count({
        where: { tenantId, createdAt: { gte: since24h } },
      }),
      this.prisma.integrationInbox.count({
        where: { tenantId, receivedAt: { gte: since24h } },
      }),
    ]);

    const inboxCounts: Record<string, number> = {};
    for (const row of inboxByStatus) {
      inboxCounts[row.status] = row._count.id;
    }

    const logCounts: Record<string, number> = {};
    for (const row of logsByDirection) {
      logCounts[row.direction] = row._count.id;
    }

    return {
      providers: { total: totalProviders, active: activeProviders },
      inbox: {
        byStatus: inboxCounts,
      },
      throughput24h: {
        logs: recentLogs,
        inbox: recentInbox,
        byDirection: logCounts,
      },
    };
  }
}

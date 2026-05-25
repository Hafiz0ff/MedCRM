import { ZodValidationPipe } from '@core/common/zod-validation.pipe';
import { CurrentUser } from '@core/security/current-user.decorator';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import { RequireModule } from '@core/security/modules.decorator';
import { RequirePermissions } from '@core/security/permissions.decorator';
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  UsePipes,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleEnabledGuard } from '../auth/guards/module-enabled.guard';
import { RbacGuard } from '../auth/guards/rbac.guard';
import {
  CreateWarehouseSchema,
  CreateWarehouseDto,
  CreateInventoryItemSchema,
  CreateInventoryItemDto,
  ProcurementDeliverySchema,
  ProcurementDeliveryDto,
  TransferRequestSchema,
  TransferRequestDto,
  BomTemplateSchema,
  BomTemplateDto,
  InventoryAuditSchema,
  InventoryAuditDto,
} from './dto/inventory.dto';
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModuleEnabledGuard, RbacGuard)
@RequireModule('inventory-warehouse')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Post('warehouses')
  @RequirePermissions('inventory.warehouse.manage')
  @UsePipes(new ZodValidationPipe(CreateWarehouseSchema))
  createWarehouse(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateWarehouseDto) {
    return this.inventory.createWarehouse(user.tenantId, dto);
  }

  @Get('warehouses/tree')
  @RequirePermissions('inventory.warehouse.manage')
  getWarehouseTree(@CurrentUser() user: AuthenticatedUser) {
    return this.inventory.getWarehouseTree(user.tenantId);
  }

  @Post('items')
  @RequirePermissions('inventory.warehouse.manage')
  @UsePipes(new ZodValidationPipe(CreateInventoryItemSchema))
  createInventoryItem(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateInventoryItemDto) {
    return this.inventory.createInventoryItem(user.tenantId, dto);
  }

  @Post('procure')
  @RequirePermissions('inventory.procure.manage')
  @UsePipes(new ZodValidationPipe(ProcurementDeliverySchema))
  procureStock(@CurrentUser() user: AuthenticatedUser, @Body() dto: ProcurementDeliveryDto) {
    return this.inventory.procureStock(user.tenantId, user.userId, dto);
  }

  @Post('transfer')
  @RequirePermissions('inventory.transfer.manage')
  @UsePipes(new ZodValidationPipe(TransferRequestSchema))
  transferStock(@CurrentUser() user: AuthenticatedUser, @Body() dto: TransferRequestDto) {
    return this.inventory.transferStock(user.tenantId, user.userId, dto);
  }

  @Post('audit')
  @RequirePermissions('inventory.audit.manage')
  @UsePipes(new ZodValidationPipe(InventoryAuditSchema))
  runInventoryAudit(@CurrentUser() user: AuthenticatedUser, @Body() dto: InventoryAuditDto) {
    return this.inventory.runInventoryAudit(user.tenantId, user.userId, dto);
  }

  @Post('bom')
  @RequirePermissions('inventory.bom.manage')
  @UsePipes(new ZodValidationPipe(BomTemplateSchema))
  configureBomTemplate(@CurrentUser() user: AuthenticatedUser, @Body() dto: BomTemplateDto) {
    return this.inventory.configureBomTemplate(user.tenantId, user.userId, dto);
  }

  @Get('balances')
  @RequirePermissions('inventory.warehouse.manage')
  getBalances(@CurrentUser() user: AuthenticatedUser, @Query('warehouseId') warehouseId?: string) {
    return this.inventory.getBalances(user.tenantId, warehouseId);
  }

  @Get('alerts')
  @RequirePermissions('inventory.warehouse.manage')
  getAlerts(@CurrentUser() user: AuthenticatedUser) {
    return this.inventory.getAlerts(user.tenantId);
  }
}

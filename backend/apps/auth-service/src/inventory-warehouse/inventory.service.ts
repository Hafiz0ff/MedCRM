import { PrismaService } from '@core/database/prisma.service';
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import {
  CreateWarehouseDto,
  CreateInventoryItemDto,
  ProcurementDeliveryDto,
  TransferRequestDto,
  BomTemplateDto,
  InventoryAuditDto,
} from './dto/inventory.dto';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  // 1. Warehouses Management
  async createWarehouse(tenantId: string, dto: CreateWarehouseDto) {
    this.logger.log(`Creating warehouse: ${dto.name} for tenant: ${tenantId}`);
    return this.prisma.warehouse.create({
      data: {
        tenantId,
        parentWarehouseId: dto.parentWarehouseId,
        branchId: dto.branchId,
        departmentId: dto.departmentId,
        roomId: dto.roomId,
        warehouseType: dto.warehouseType,
        code: dto.code,
        name: dto.name,
        responsibleEmployeeId: dto.responsibleEmployeeId,
      },
    });
  }

  async getWarehouseTree(tenantId: string) {
    const warehouses = await this.prisma.warehouse.findMany({
      where: { tenantId, isActive: true },
      include: {
        childWarehouses: true,
      },
    });

    // Build root-level hierarchy
    return warehouses.filter((w) => !w.parentWarehouseId);
  }

  // 2. Nomenclature Management
  async createInventoryItem(tenantId: string, dto: CreateInventoryItemDto) {
    this.logger.log(`Creating inventory item: ${dto.itemName} for tenant: ${tenantId}`);
    return this.prisma.inventoryItem.create({
      data: {
        tenantId,
        itemCode: dto.itemCode,
        barcode: dto.barcode,
        itemName: dto.itemName,
        itemCategoryId: dto.itemCategoryId,
        unitOfMeasure: dto.unitOfMeasure,
        inventoryType: dto.inventoryType,
        requiresBatchTracking: dto.requiresBatchTracking,
        requiresExpirationTracking: dto.requiresExpirationTracking,
        minimumStockLevel: new Decimal(dto.minimumStockLevel),
        reorderLevel: new Decimal(dto.reorderLevel),
        defaultSupplierId: dto.defaultSupplierId,
      },
    });
  }

  // 3. Procurement Deliveries
  async procureStock(tenantId: string, userId: string, dto: ProcurementDeliveryDto) {
    this.logger.log(`Procuring stock items to warehouse: ${dto.warehouseId}`);

    // Calculate total amount
    let totalAmount = 0;
    for (const item of dto.items) {
      totalAmount += item.purchasePrice * item.quantity;
    }

    // Create PurchaseOrder record
    const po = await this.prisma.purchaseOrder.create({
      data: {
        tenantId,
        supplierId: dto.supplierId,
        warehouseId: dto.warehouseId,
        orderStatus: 'RECEIVED',
        totalAmount: new Decimal(totalAmount),
        orderedBy: userId,
        receivedAt: new Date(),
      },
    });

    // Process each item
    for (const item of dto.items) {
      // 1. Create Batch
      const batch = await this.prisma.inventoryBatch.create({
        data: {
          tenantId,
          itemId: item.itemId,
          supplierId: dto.supplierId,
          batchNumber: item.batchNumber,
          serialNumber: item.serialNumber,
          expirationDate: item.expirationDate ? new Date(item.expirationDate) : null,
          productionDate: item.productionDate ? new Date(item.productionDate) : null,
          purchasePrice: new Decimal(item.purchasePrice),
          currentQuantity: new Decimal(item.quantity),
          warehouseId: dto.warehouseId,
        },
      });

      // 2. Upsert balance snapshot
      await this.upsertBalance(
        tenantId,
        dto.warehouseId,
        item.itemId,
        batch.id,
        item.quantity,
        'INCREMENT',
      );

      // 3. Log ledger transaction
      await this.prisma.inventoryTransaction.create({
        data: {
          tenantId,
          warehouseId: dto.warehouseId,
          itemId: item.itemId,
          batchId: batch.id,
          transactionType: 'PURCHASE',
          quantity: new Decimal(item.quantity),
          unitPrice: new Decimal(item.purchasePrice),
          totalAmount: new Decimal(item.purchasePrice * item.quantity),
          sourceEntityType: 'PURCHASE_ORDER',
          sourceEntityId: po.id,
          referenceNumber: po.id,
          performedBy: userId,
        },
      });

      // 4. Trigger alert monitoring check
      await this.checkStockThresholdsAndAlert(tenantId, dto.warehouseId, item.itemId);
    }

    return po;
  }

  // 4. Inventory Transfers
  async transferStock(tenantId: string, userId: string, dto: TransferRequestDto) {
    this.logger.log(
      `Transferring items from: ${dto.sourceWarehouseId} to: ${dto.destinationWarehouseId}`,
    );

    // Create the transfer record
    const transfer = await this.prisma.inventoryTransfer.create({
      data: {
        tenantId,
        sourceWarehouseId: dto.sourceWarehouseId,
        destinationWarehouseId: dto.destinationWarehouseId,
        transferStatus: 'COMPLETED',
        requestedBy: userId,
        approvedBy: userId,
        transferredAt: new Date(),
      },
    });

    for (const item of dto.items) {
      // Find source balance
      const balance = await this.prisma.inventoryBalance.findFirst({
        where: {
          tenantId,
          warehouseId: dto.sourceWarehouseId,
          itemId: item.itemId,
          batchId: item.batchId || null,
        },
        include: { batch: true },
      });

      if (!balance || Number(balance.availableQuantity) < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for item ${item.itemId} at source warehouse.`,
        );
      }

      // 1. Decrement source balance
      await this.prisma.inventoryBalance.update({
        where: { id: balance.id },
        data: {
          availableQuantity: { decrement: new Decimal(item.quantity) },
          updatedAt: new Date(),
        },
      });

      if (balance.batchId) {
        await this.prisma.inventoryBatch.update({
          where: { id: balance.batchId },
          data: {
            currentQuantity: { decrement: new Decimal(item.quantity) },
          },
        });
      }

      // Log source transaction
      await this.prisma.inventoryTransaction.create({
        data: {
          tenantId,
          warehouseId: dto.sourceWarehouseId,
          itemId: item.itemId,
          batchId: balance.batchId,
          transactionType: 'TRANSFER_OUT',
          quantity: new Decimal(item.quantity),
          unitPrice: balance.batch?.purchasePrice || null,
          totalAmount: balance.batch
            ? new Decimal(Number(balance.batch.purchasePrice) * item.quantity)
            : null,
          sourceEntityType: 'TRANSFER',
          sourceEntityId: transfer.id,
          performedBy: userId,
        },
      });

      // 2. Increment destination batch/balance
      let destBatchId: string | null = null;

      if (balance.batch) {
        // Find if destination already has this batch copy
        let destBatch = await this.prisma.inventoryBatch.findFirst({
          where: {
            tenantId,
            warehouseId: dto.destinationWarehouseId,
            itemId: item.itemId,
            batchNumber: balance.batch.batchNumber,
          },
        });

        if (!destBatch) {
          destBatch = await this.prisma.inventoryBatch.create({
            data: {
              tenantId,
              itemId: item.itemId,
              supplierId: balance.batch.supplierId,
              batchNumber: balance.batch.batchNumber,
              serialNumber: balance.batch.serialNumber,
              expirationDate: balance.batch.expirationDate,
              productionDate: balance.batch.productionDate,
              purchasePrice: balance.batch.purchasePrice,
              currentQuantity: new Decimal(item.quantity),
              warehouseId: dto.destinationWarehouseId,
            },
          });
        } else {
          await this.prisma.inventoryBatch.update({
            where: { id: destBatch.id },
            data: {
              currentQuantity: { increment: new Decimal(item.quantity) },
            },
          });
        }
        destBatchId = destBatch.id;
      }

      // Upsert destination balance
      await this.upsertBalance(
        tenantId,
        dto.destinationWarehouseId,
        item.itemId,
        destBatchId,
        item.quantity,
        'INCREMENT',
      );

      // Log destination transaction
      await this.prisma.inventoryTransaction.create({
        data: {
          tenantId,
          warehouseId: dto.destinationWarehouseId,
          itemId: item.itemId,
          batchId: destBatchId,
          transactionType: 'TRANSFER_IN',
          quantity: new Decimal(item.quantity),
          unitPrice: balance.batch?.purchasePrice || null,
          totalAmount: balance.batch
            ? new Decimal(Number(balance.batch.purchasePrice) * item.quantity)
            : null,
          sourceEntityType: 'TRANSFER',
          sourceEntityId: transfer.id,
          performedBy: userId,
        },
      });

      // Monitor stock alerts for both
      await this.checkStockThresholdsAndAlert(tenantId, dto.sourceWarehouseId, item.itemId);
      await this.checkStockThresholdsAndAlert(tenantId, dto.destinationWarehouseId, item.itemId);
    }

    return transfer;
  }

  // 5. Automated EMR Write-Off Engine with FEFO & Fallback
  async autoWriteOffServiceMaterials(
    tenantId: string,
    appointmentId: string,
    encounterId: string,
    roomId?: string,
  ) {
    this.logger.log(
      `EMR auto write-off triggered for appt: ${appointmentId}, encounter: ${encounterId}`,
    );

    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { service: true },
    });

    if (!appointment || !appointment.serviceId) {
      this.logger.warn(`No appointment or service ID found for write-off`);
      return;
    }

    // Get active BOM template
    const bomTemplate = await this.prisma.serviceBomTemplate.findFirst({
      where: {
        tenantId,
        serviceId: appointment.serviceId,
        isActive: true,
      },
      include: {
        bomItems: true,
      },
    });

    if (!bomTemplate) {
      this.logger.log(`No active BOM template found for service: ${appointment.service?.name}`);
      return;
    }

    // Create a log entry for this consumption session
    const consumption = await this.prisma.inventoryConsumption.create({
      data: {
        tenantId,
        appointmentId,
        encounterId,
        employeeId: appointment.employeeId,
        warehouseId: roomId ? roomId : appointment.branchId, // temporary placeholder
        consumptionStatus: 'PENDING',
      },
    });

    // 1. Determine primary write-off warehouse
    let targetWarehouse = await this.prisma.warehouse.findFirst({
      where: { tenantId, roomId: roomId || undefined, isActive: true },
    });

    let usedBranchFallback = false;

    if (!targetWarehouse) {
      // Fallback directly to Branch warehouse
      targetWarehouse = await this.prisma.warehouse.findFirst({
        where: {
          tenantId,
          branchId: appointment.branchId,
          warehouseType: 'BRANCH',
          isActive: true,
        },
      });
      usedBranchFallback = true;
    }

    if (!targetWarehouse) {
      this.logger.error(`No suitable warehouse found for write-off (neither room nor branch)`);
      await this.prisma.inventoryConsumption.update({
        where: { id: consumption.id },
        data: { consumptionStatus: 'FAILED' },
      });
      return;
    }

    // Update warehouseId in consumption log
    await this.prisma.inventoryConsumption.update({
      where: { id: consumption.id },
      data: { warehouseId: targetWarehouse.id },
    });

    // Loop through BOM ingredients
    for (const bomItem of bomTemplate.bomItems) {
      const requiredQty = Number(bomItem.quantity);
      let remainingNeeded = requiredQty;

      // Find available balances sorted by Expiration Date ASC (FEFO)
      let balances = await this.prisma.inventoryBalance.findMany({
        where: {
          tenantId,
          warehouseId: targetWarehouse.id,
          itemId: bomItem.inventoryItemId,
          availableQuantity: { gt: 0 },
        },
        include: { batch: true },
        orderBy: [{ batch: { expirationDate: 'asc' } }, { updatedAt: 'asc' }],
      });

      let totalStock = balances.reduce((sum, b) => sum + Number(b.availableQuantity), 0);

      // 2. Perform BRANCH fallback if ROOM stock is depleted
      if (totalStock < requiredQty && !usedBranchFallback && roomId) {
        const branchWarehouse = await this.prisma.warehouse.findFirst({
          where: {
            tenantId,
            branchId: appointment.branchId,
            warehouseType: 'BRANCH',
            isActive: true,
          },
        });

        if (branchWarehouse && branchWarehouse.id !== targetWarehouse.id) {
          const branchBalances = await this.prisma.inventoryBalance.findMany({
            where: {
              tenantId,
              warehouseId: branchWarehouse.id,
              itemId: bomItem.inventoryItemId,
              availableQuantity: { gt: 0 },
            },
            include: { batch: true },
            orderBy: [{ batch: { expirationDate: 'asc' } }, { updatedAt: 'asc' }],
          });

          const branchTotal = branchBalances.reduce(
            (sum, b) => sum + Number(b.availableQuantity),
            0,
          );
          if (branchTotal > 0) {
            balances = branchBalances;
            targetWarehouse = branchWarehouse;
            usedBranchFallback = true;
            totalStock = branchTotal;

            // Trigger a warning warning alert for room inventory depletion
            await this.createStockAlert(
              tenantId,
              roomId, // alert on Room level
              bomItem.inventoryItemId,
              'WARNING',
              'ACTIVE',
            );
          }
        }
      }

      // 3. Deduct using FEFO
      for (const bal of balances) {
        if (remainingNeeded <= 0) break;

        const balQty = Number(bal.availableQuantity);
        const deduct = Math.min(balQty, remainingNeeded);

        // Decrement balance
        await this.prisma.inventoryBalance.update({
          where: { id: bal.id },
          data: {
            availableQuantity: { decrement: new Decimal(deduct) },
            updatedAt: new Date(),
          },
        });

        // Decrement batch copy
        if (bal.batchId) {
          await this.prisma.inventoryBatch.update({
            where: { id: bal.batchId },
            data: {
              currentQuantity: { decrement: new Decimal(deduct) },
            },
          });
        }

        // Ledger Transaction
        await this.prisma.inventoryTransaction.create({
          data: {
            tenantId,
            warehouseId: targetWarehouse.id,
            itemId: bomItem.inventoryItemId,
            batchId: bal.batchId,
            transactionType: 'CONSUMPTION',
            quantity: new Decimal(deduct),
            unitPrice: bal.batch?.purchasePrice || null,
            totalAmount: bal.batch ? new Decimal(Number(bal.batch.purchasePrice) * deduct) : null,
            sourceEntityType: 'ENCOUNTER',
            sourceEntityId: encounterId,
            performedBy: appointment.employeeId, // Performed by Doctor
          },
        });

        remainingNeeded -= deduct;
      }

      // 4. Critical out of stock alert trigger
      if (remainingNeeded > 0) {
        this.logger.error(
          `Stockout for item ${bomItem.inventoryItemId} during EMR signature. Missed quantity: ${remainingNeeded}`,
        );
        await this.createStockAlert(
          tenantId,
          targetWarehouse.id,
          bomItem.inventoryItemId,
          'CRITICAL',
          'ACTIVE',
        );
      }

      // Monitor thresholds
      await this.checkStockThresholdsAndAlert(
        tenantId,
        targetWarehouse.id,
        bomItem.inventoryItemId,
      );
    }

    await this.prisma.inventoryConsumption.update({
      where: { id: consumption.id },
      data: { consumptionStatus: 'COMPLETED' },
    });
  }

  // 6. Planned Audits (Инвентаризация)
  async runInventoryAudit(tenantId: string, userId: string, dto: InventoryAuditDto) {
    this.logger.log(`Running inventory audit for warehouse: ${dto.warehouseId}`);

    const audit = await this.prisma.inventoryAudit.create({
      data: {
        tenantId,
        warehouseId: dto.warehouseId,
        auditStatus: 'COMPLETED',
        startedBy: userId,
        completedBy: userId,
        completedAt: new Date(),
      },
    });

    for (const item of dto.items) {
      // Find expected available
      const balance = await this.prisma.inventoryBalance.findFirst({
        where: {
          tenantId,
          warehouseId: dto.warehouseId,
          itemId: item.itemId,
          batchId: item.batchId || null,
        },
        include: { batch: true },
      });

      const expected = balance ? Number(balance.availableQuantity) : 0;
      const discrepancy = item.countedQuantity - expected;

      // 1. Log audit item
      await this.prisma.inventoryAuditItem.create({
        data: {
          auditId: audit.id,
          itemId: item.itemId,
          batchId: item.batchId || null,
          expectedQuantity: new Decimal(expected),
          countedQuantity: new Decimal(item.countedQuantity),
          discrepancyQuantity: new Decimal(discrepancy),
        },
      });

      // 2. Adjust Balance
      await this.upsertBalance(
        tenantId,
        dto.warehouseId,
        item.itemId,
        item.batchId || null,
        item.countedQuantity,
        'SET',
      );

      // Update batch if tracked
      if (item.batchId) {
        await this.prisma.inventoryBatch.update({
          where: { id: item.batchId },
          data: {
            currentQuantity: new Decimal(item.countedQuantity),
          },
        });
      }

      // Log adjustment transaction in ledger
      if (discrepancy !== 0) {
        await this.prisma.inventoryTransaction.create({
          data: {
            tenantId,
            warehouseId: dto.warehouseId,
            itemId: item.itemId,
            batchId: item.batchId || null,
            transactionType: 'INVENTORY_ADJUSTMENT',
            quantity: new Decimal(discrepancy),
            unitPrice: balance?.batch?.purchasePrice || null,
            performedBy: userId,
          },
        });
      }

      await this.checkStockThresholdsAndAlert(tenantId, dto.warehouseId, item.itemId);
    }

    return audit;
  }

  // 7. BOM technological recipe builder
  async configureBomTemplate(tenantId: string, userId: string, dto: BomTemplateDto) {
    this.logger.log(`Configuring BOM Template for service: ${dto.serviceId}`);

    // Deactivate previous versions
    await this.prisma.serviceBomTemplate.updateMany({
      where: { tenantId, serviceId: dto.serviceId, isActive: true },
      data: { isActive: false },
    });

    return this.prisma.serviceBomTemplate.create({
      data: {
        tenantId,
        serviceId: dto.serviceId,
        version: dto.version,
        isActive: true,
        createdBy: userId,
        bomItems: {
          create: dto.items.map((item) => ({
            inventoryItemId: item.inventoryItemId,
            quantity: new Decimal(item.quantity),
            unitOfMeasure: item.unitOfMeasure,
            isMandatory: item.isMandatory,
          })),
        },
      },
      include: {
        bomItems: true,
      },
    });
  }

  // Helper monitoring and alerting functions
  private async createStockAlert(
    tenantId: string,
    warehouseId: string,
    itemId: string,
    alertLevel: 'WARNING' | 'CRITICAL',
    alertStatus: 'ACTIVE' | 'RESOLVED',
  ) {
    // Find current stock
    const balances = await this.prisma.inventoryBalance.findMany({
      where: { tenantId, warehouseId, itemId },
    });
    const currentQuantity = balances.reduce((sum, b) => sum + Number(b.availableQuantity), 0);

    return this.prisma.stockAlert.create({
      data: {
        tenantId,
        warehouseId,
        itemId,
        currentQuantity: new Decimal(currentQuantity),
        alertLevel,
        alertStatus,
      },
    });
  }

  async checkStockThresholdsAndAlert(tenantId: string, warehouseId: string, itemId: string) {
    // Total stock in this warehouse
    const balances = await this.prisma.inventoryBalance.findMany({
      where: { tenantId, warehouseId, itemId },
    });
    const totalQty = balances.reduce((sum, b) => sum + Number(b.availableQuantity), 0);

    // Get alert rules
    const rule = await this.prisma.stockAlertRule.findUnique({
      where: {
        tenantId_warehouseId_itemId: {
          tenantId,
          warehouseId,
          itemId,
        },
      },
    });

    const item = await this.prisma.inventoryItem.findUnique({
      where: { id: itemId },
    });

    const minQty = rule ? Number(rule.minimumQuantity) : item ? Number(item.minimumStockLevel) : 0;
    const critQty = rule ? Number(rule.criticalQuantity) : 0;

    // Evaluate
    if (totalQty <= critQty && totalQty > 0) {
      await this.prisma.stockAlert.create({
        data: {
          tenantId,
          warehouseId,
          itemId,
          currentQuantity: new Decimal(totalQty),
          alertLevel: 'CRITICAL',
          alertStatus: 'ACTIVE',
        },
      });
    } else if (totalQty <= minQty && totalQty > critQty) {
      await this.prisma.stockAlert.create({
        data: {
          tenantId,
          warehouseId,
          itemId,
          currentQuantity: new Decimal(totalQty),
          alertLevel: 'WARNING',
          alertStatus: 'ACTIVE',
        },
      });
    } else if (totalQty === 0) {
      await this.prisma.stockAlert.create({
        data: {
          tenantId,
          warehouseId,
          itemId,
          currentQuantity: new Decimal(totalQty),
          alertLevel: 'CRITICAL',
          alertStatus: 'ACTIVE',
        },
      });
    }
  }

  async getBalances(tenantId: string, warehouseId?: string) {
    return this.prisma.inventoryBalance.findMany({
      where: {
        tenantId,
        ...(warehouseId ? { warehouseId } : {}),
      },
      include: {
        item: true,
        batch: true,
        warehouse: true,
      },
    });
  }

  async getAlerts(tenantId: string) {
    return this.prisma.stockAlert.findMany({
      where: { tenantId, alertStatus: 'ACTIVE' },
      include: {
        item: true,
        warehouse: true,
      },
    });
  }

  private async upsertBalance(
    tenantId: string,
    warehouseId: string,
    itemId: string,
    batchId: string | null,
    quantity: number,
    action: 'INCREMENT' | 'SET',
  ) {
    const existing = await this.prisma.inventoryBalance.findFirst({
      where: {
        tenantId,
        warehouseId,
        itemId,
        batchId: batchId || null,
      },
    });

    if (existing) {
      const newQty =
        action === 'INCREMENT' ? Number(existing.availableQuantity) + quantity : quantity;
      return this.prisma.inventoryBalance.update({
        where: { id: existing.id },
        data: {
          availableQuantity: new Decimal(newQty),
          updatedAt: new Date(),
        },
      });
    } else {
      return this.prisma.inventoryBalance.create({
        data: {
          tenantId,
          warehouseId,
          itemId,
          batchId: batchId || null,
          availableQuantity: new Decimal(quantity),
          reservedQuantity: new Decimal(0),
        },
      });
    }
  }
}

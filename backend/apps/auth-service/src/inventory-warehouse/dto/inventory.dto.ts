import { z } from 'zod';

export const CreateWarehouseSchema = z.object({
  parentWarehouseId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  roomId: z.string().uuid().optional(),
  warehouseType: z.enum(['MAIN', 'BRANCH', 'DEPARTMENT', 'ROOM', 'MOBILE']),
  code: z.string().min(2).max(80),
  name: z.string().min(2).max(255),
  responsibleEmployeeId: z.string().uuid().optional(),
});

export type CreateWarehouseDto = z.infer<typeof CreateWarehouseSchema>;

export const CreateInventoryItemSchema = z.object({
  itemCode: z.string().min(2).max(80),
  barcode: z.string().max(120).optional(),
  itemName: z.string().min(2).max(255),
  itemCategoryId: z.string().uuid().optional(),
  unitOfMeasure: z.string().min(1).max(40),
  inventoryType: z.enum([
    'MEDICATION',
    'CONSUMABLE',
    'MEDICAL_DEVICE',
    'LAB_MATERIAL',
    'OFFICE_SUPPLY',
  ]),
  requiresBatchTracking: z.boolean().default(false),
  requiresExpirationTracking: z.boolean().default(false),
  minimumStockLevel: z.number().default(0),
  reorderLevel: z.number().default(0),
  defaultSupplierId: z.string().uuid().optional(),
});

export type CreateInventoryItemDto = z.infer<typeof CreateInventoryItemSchema>;

export const ProcurementItemSchema = z.object({
  itemId: z.string().uuid(),
  batchNumber: z.string().min(1).max(120),
  serialNumber: z.string().max(120).optional(),
  expirationDate: z.string().optional(),
  productionDate: z.string().optional(),
  purchasePrice: z.number(),
  quantity: z.number(),
});

export const ProcurementDeliverySchema = z.object({
  supplierId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  items: z.array(ProcurementItemSchema).min(1),
});

export type ProcurementDeliveryDto = z.infer<typeof ProcurementDeliverySchema>;

export const TransferRequestSchema = z.object({
  sourceWarehouseId: z.string().uuid(),
  destinationWarehouseId: z.string().uuid(),
  items: z
    .array(
      z.object({
        itemId: z.string().uuid(),
        batchId: z.string().uuid().optional(),
        quantity: z.number(),
      }),
    )
    .min(1),
});

export type TransferRequestDto = z.infer<typeof TransferRequestSchema>;

export const BomItemSchema = z.object({
  inventoryItemId: z.string().uuid(),
  quantity: z.number(),
  unitOfMeasure: z.string().min(1).max(40),
  isMandatory: z.boolean().default(true),
});

export const BomTemplateSchema = z.object({
  serviceId: z.string().uuid(),
  version: z.string().min(1).max(40),
  items: z.array(BomItemSchema).min(1),
});

export type BomTemplateDto = z.infer<typeof BomTemplateSchema>;

export const AuditItemSchema = z.object({
  itemId: z.string().uuid(),
  batchId: z.string().uuid().optional(),
  countedQuantity: z.number(),
});

export const InventoryAuditSchema = z.object({
  warehouseId: z.string().uuid(),
  items: z.array(AuditItemSchema).min(1),
});

export type InventoryAuditDto = z.infer<typeof InventoryAuditSchema>;

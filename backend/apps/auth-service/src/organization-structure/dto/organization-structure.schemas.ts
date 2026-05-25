import { z } from 'zod';

// Specialties
export const SpecialtySchema = z.object({
  code: z.string().min(2).max(120),
  name: z.string().min(2).max(255),
  internationalCode: z.string().max(80).optional().nullable(),
  isSystem: z.boolean().optional().default(false),
});
export type SpecialtyDto = z.infer<typeof SpecialtySchema>;

// Positions
export const PositionSchema = z.object({
  code: z.string().min(2).max(120),
  name: z.string().min(2).max(255),
  description: z.string().optional().nullable(),
  isMedicalStaff: z.boolean().optional().default(true),
  isSystem: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});
export type PositionDto = z.infer<typeof PositionSchema>;

// Room Types
export const RoomTypeSchema = z.object({
  code: z.string().min(2).max(120),
  name: z.string().min(2).max(255),
  color: z.string().max(40).optional().nullable(),
  isSystem: z.boolean().optional().default(false),
});
export type RoomTypeDto = z.infer<typeof RoomTypeSchema>;

// Equipment Categories
export const EquipmentCategorySchema = z.object({
  code: z.string().min(2).max(120),
  name: z.string().min(2).max(255),
  isSystem: z.boolean().optional().default(false),
});
export type EquipmentCategoryDto = z.infer<typeof EquipmentCategorySchema>;

// Branches
export const BranchSchema = z.object({
  code: z.string().min(2).max(120),
  name: z.string().min(2).max(255),
  address: z.string().optional().nullable(),
  phone: z.string().max(60).optional().nullable(),
  timezone: z.string().max(80).default('Europe/Moscow'),
  workingHoursJson: z.any().optional(),
  isActive: z.boolean().optional().default(true),
});
export type BranchDto = z.infer<typeof BranchSchema>;

// Departments
export const DepartmentSchema = z.object({
  branchId: z.string().uuid(),
  parentDepartmentId: z.string().uuid().optional().nullable(),
  code: z.string().min(2).max(120),
  name: z.string().min(2).max(255),
  description: z.string().optional().nullable(),
  color: z.string().max(40).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});
export type DepartmentDto = z.infer<typeof DepartmentSchema>;

// Employees
export const EmployeeSchema = z.object({
  userId: z.string().uuid().optional().nullable(),
  employeeNumber: z.string().min(2).max(120),
  firstName: z.string().min(1).max(120),
  lastName: z.string().min(1).max(120),
  middleName: z.string().max(120).optional().nullable(),
  birthDate: z.string().datetime().or(z.string().date()).optional().nullable(),
  gender: z.string().max(40).optional().nullable(),
  phone: z.string().max(60).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  hireDate: z.string().datetime().or(z.string().date()),
  dismissalDate: z.string().datetime().or(z.string().date()).optional().nullable(),
  employmentType: z.string().max(60).default('FULL_TIME'),
  photoFileId: z.string().uuid().optional().nullable(),
  status: z.string().max(40).default('ACTIVE'),
});
export type EmployeeDto = z.infer<typeof EmployeeSchema>;

// Employee Positions / Job Assignments
export const EmployeePositionSchema = z.object({
  employeeId: z.string().uuid(),
  branchId: z.string().uuid(),
  departmentId: z.string().uuid(),
  positionId: z.string().uuid(),
  specialtyId: z.string().uuid().optional().nullable(),
  rate: z.number().min(0.1).max(2.0).default(1.0),
  workRate: z.string().max(40).default('1.0'),
  isPrimary: z.boolean().optional().default(true),
  activeFrom: z.string().datetime().optional(),
  activeTo: z.string().datetime().optional().nullable(),
});
export type EmployeePositionDto = z.infer<typeof EmployeePositionSchema>;

// Rooms
export const RoomSchema = z.object({
  branchId: z.string().uuid(),
  departmentId: z.string().uuid().optional().nullable(),
  roomTypeId: z.string().uuid(),
  code: z.string().min(1).max(120),
  name: z.string().min(1).max(255),
  floor: z.number().int().optional().nullable(),
  capacity: z.number().int().min(1).default(1),
  description: z.string().optional().nullable(),
  scheduleJson: z.any().optional(),
  status: z.string().max(40).default('ACTIVE'),
  isActive: z.boolean().optional().default(true),
  specialtyIds: z.array(z.string().uuid()).optional(),
});
export type RoomDto = z.infer<typeof RoomSchema>;

// Equipment
export const EquipmentSchema = z.object({
  branchId: z.string().uuid(),
  roomId: z.string().uuid().optional().nullable(),
  categoryId: z.string().uuid(),
  inventoryNumber: z.string().min(2).max(120),
  serialNumber: z.string().max(120).optional().nullable(),
  name: z.string().min(2).max(255),
  manufacturer: z.string().max(255).optional().nullable(),
  model: z.string().max(255).optional().nullable(),
  purchaseDate: z.string().datetime().or(z.string().date()).optional().nullable(),
  maintenanceDate: z.string().datetime().or(z.string().date()).optional().nullable(),
  calibrationDate: z.string().datetime().or(z.string().date()).optional().nullable(),
  status: z.string().max(40).default('ACTIVE'),
  isSharedResource: z.boolean().optional().default(false),
});
export type EquipmentDto = z.infer<typeof EquipmentSchema>;

// Employee Room Assignment
export const EmployeeRoomAssignmentSchema = z.object({
  employeeId: z.string().uuid(),
  branchId: z.string().uuid(),
  departmentId: z.string().uuid().optional().nullable(),
  roomId: z.string().uuid(),
  specialtyId: z.string().uuid().optional().nullable(),
  activeFrom: z.string().datetime().optional(),
  activeTo: z.string().datetime().optional().nullable(),
  workScheduleJson: z.any().optional(),
});
export type EmployeeRoomAssignmentDto = z.infer<typeof EmployeeRoomAssignmentSchema>;

// Working Schedule
export const WorkingScheduleSchema = z.object({
  entityType: z.enum(['branch', 'room', 'employee', 'equipment']),
  entityId: z.string().uuid(),
  weekday: z.number().int().min(1).max(7),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  breakStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .nullable(),
  breakEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .nullable(),
  recurrenceRule: z.string().optional().nullable(),
  timezone: z.string().max(80).default('Europe/Moscow'),
  isActive: z.boolean().optional().default(true),
});
export type WorkingScheduleDto = z.infer<typeof WorkingScheduleSchema>;

// Schedule Exception
export const ScheduleExceptionSchema = z.object({
  entityType: z.enum(['branch', 'room', 'employee', 'equipment']),
  entityId: z.string().uuid(),
  exceptionDate: z.string().datetime().or(z.string().date()),
  reason: z.string().optional().nullable(),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .nullable(),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .nullable(),
  isDayOff: z.boolean().optional().default(false),
});
export type ScheduleExceptionDto = z.infer<typeof ScheduleExceptionSchema>;

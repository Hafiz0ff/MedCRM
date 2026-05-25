import { Module } from '@nestjs/common';
import { BranchesController } from './controllers/branches.controller';
import { DepartmentsController } from './controllers/departments.controller';
import { DirectoriesController } from './controllers/directories.controller';
import { EmployeesController } from './controllers/employees.controller';
import { EquipmentController } from './controllers/equipment.controller';
import { RoomsController } from './controllers/rooms.controller';
import { SchedulesController } from './controllers/schedules.controller';
import { BranchesService } from './services/branches.service';
import { DepartmentsService } from './services/departments.service';
import { DirectoriesService } from './services/directories.service';
import { EmployeesService } from './services/employees.service';
import { EquipmentService } from './services/equipment.service';
import { RoomsService } from './services/rooms.service';
import { SchedulesService } from './services/schedules.service';

@Module({
  controllers: [
    DirectoriesController,
    BranchesController,
    DepartmentsController,
    EmployeesController,
    RoomsController,
    EquipmentController,
    SchedulesController,
  ],
  providers: [
    DirectoriesService,
    BranchesService,
    DepartmentsService,
    EmployeesService,
    RoomsService,
    EquipmentService,
    SchedulesService,
  ],
})
export class OrganizationStructureModule {}

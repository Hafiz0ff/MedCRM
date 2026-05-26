import { AuthenticatedUser } from '@core/security/jwt-payload';
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SmartSchedulingService } from './smart-scheduling.service';

@Controller()
export class SmartSchedulingRpcController {
  constructor(private readonly scheduling: SmartSchedulingService) {}

  @MessagePattern('scheduling.create')
  async create(@Payload() data: { user: AuthenticatedUser; dto: any }) {
    return this.scheduling.create(data.user, data.dto);
  }

  @MessagePattern('scheduling.getPublicSlots')
  async getPublicSlots(@Payload() data: { user: AuthenticatedUser; query: any }) {
    return this.scheduling.getPublicSlots(data.user, data.query);
  }

  @MessagePattern('scheduling.onlineBookingReserve')
  async onlineBookingReserve(@Payload() data: { user: AuthenticatedUser; dto: any }) {
    return this.scheduling.onlineBookingReserve(data.user, data.dto);
  }

  @MessagePattern('scheduling.onlineBookingConfirm')
  async onlineBookingConfirm(@Payload() data: { user: AuthenticatedUser; dto: any }) {
    return this.scheduling.onlineBookingConfirm(data.user, data.dto);
  }
}

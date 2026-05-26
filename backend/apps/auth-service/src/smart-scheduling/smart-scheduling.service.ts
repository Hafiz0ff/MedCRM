import { AuthenticatedUser } from '@core/security/jwt-payload';
import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class SmartSchedulingService {
  constructor(@Inject('SCHEDULING_SERVICE') private readonly client: ClientProxy) {}

  async create(user: AuthenticatedUser, dto: any): Promise<any> {
    return firstValueFrom(this.client.send('scheduling.create', { user, dto }));
  }

  async getPublicSlots(user: AuthenticatedUser, query: any): Promise<any> {
    return firstValueFrom(this.client.send('scheduling.getPublicSlots', { user, query }));
  }

  async onlineBookingReserve(user: AuthenticatedUser, dto: any): Promise<any> {
    return firstValueFrom(this.client.send('scheduling.onlineBookingReserve', { user, dto }));
  }

  async onlineBookingConfirm(user: AuthenticatedUser, dto: any): Promise<any> {
    return firstValueFrom(this.client.send('scheduling.onlineBookingConfirm', { user, dto }));
  }
}

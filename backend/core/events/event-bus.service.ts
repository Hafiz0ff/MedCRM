import { EventEmitter } from 'node:events';
import { Injectable, Logger } from '@nestjs/common';

export type DomainEvent<T = any> = {
  eventName: string;
  timestamp: Date;
  tenantId: string;
  payload: T;
};

@Injectable()
export class EventBusService {
  private readonly emitter = new EventEmitter();
  private readonly logger = new Logger(EventBusService.name);

  publish<T>(event: DomainEvent<T>): void {
    this.logger.log(`Publishing event "${event.eventName}" for tenant "${event.tenantId}"`);
    this.emitter.emit(event.eventName, event);
  }

  subscribe<T>(eventName: string, handler: (event: DomainEvent<T>) => void | Promise<void>): void {
    this.emitter.on(eventName, async (event: DomainEvent<T>) => {
      try {
        await handler(event);
      } catch (error) {
        this.logger.error(`Error handling event "${eventName}":`, error);
      }
    });
  }
}

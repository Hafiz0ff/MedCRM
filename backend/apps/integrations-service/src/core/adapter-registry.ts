import { Injectable } from '@nestjs/common';
import { IntegrationAdapter } from './adapter.interface';

@Injectable()
export class AdapterRegistry {
  private readonly adapters = new Map<string, IntegrationAdapter>();

  register(adapter: IntegrationAdapter) {
    this.adapters.set(adapter.kind, adapter);
  }

  get(kind: string): IntegrationAdapter | undefined {
    return this.adapters.get(kind);
  }

  list(): IntegrationAdapter[] {
    return Array.from(this.adapters.values());
  }
}

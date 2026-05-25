import { Injectable } from '@nestjs/common';
import type { PaymentProvider } from './payment-provider.interface';
import { AlifAdapter } from './providers/alif.adapter';
import { YooKassaAdapter } from './providers/yookassa.adapter';

@Injectable()
export class PaymentRegistryService {
  private readonly providers = new Map<string, PaymentProvider>();

  constructor(
    private readonly yookassa: YooKassaAdapter,
    private readonly alif: AlifAdapter,
  ) {
    this.providers.set('yookassa', yookassa);
    this.providers.set('alif', alif);
  }

  getProvider(name: string): PaymentProvider {
    const provider = this.providers.get(name);
    if (!provider) throw new Error(`Payment provider '${name}' is not registered`);
    return provider;
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}

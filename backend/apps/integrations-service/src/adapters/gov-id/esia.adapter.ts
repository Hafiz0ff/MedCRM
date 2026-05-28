import { Injectable } from '@nestjs/common';
import { IntegrationAdapter, AdapterContext } from '../../core/adapter.interface';

@Injectable()
export class EsiaAdapter implements IntegrationAdapter {
  readonly kind = 'GOVID_ESIA';

  validateConfig(config: any) {
    if (!config.clientId) {
      throw new Error('ESIA client mnemonic (clientId) is required');
    }
    return { clientId: config.clientId, redirectUri: config.redirectUri };
  }

  async testConnection(config: any, secrets: Record<string, string>): Promise<void> {
    if (!secrets.clientSecret && !config.clientSecret) {
      throw new Error('Missing private key or certificate for ESIA signatures');
    }
  }

  // Processes OAuth2 token exchange and profile import
  async receiveInbox(payload: any, ctx: AdapterContext): Promise<any[]> {
    // Payload contains OAuth2 authorization code: { code: string }
    ctx.logger.log('Trading OAuth2 authorization code for ЕСИА patient profile');

    // Simulate fetching SNILS and demographic info from ESIA REST API
    const esiaProfile = {
      firstName: 'Иван',
      lastName: 'Иванов',
      middleName: 'Иванович',
      birthDate: '1985-06-15',
      gender: 'MALE',
      snils: '123-456-789 01',
    };

    return [
      {
        subject: 'auth.v1.govid.sso_completed',
        data: {
          profile: esiaProfile,
          correlationId: payload.correlationId,
        },
      },
    ];
  }

  buildAdminUi() {
    return {
      fields: [
        { name: 'clientId', label: 'ЕСИА Client ID (Mnemonic)', type: 'text', required: true },
        { name: 'redirectUri', label: 'OAuth Redirect Redirect URI', type: 'text', required: true },
        {
          name: 'clientSecret',
          label: 'Private Key / Certificate',
          type: 'password',
          required: true,
        },
      ],
    };
  }
}

import { randomBytes, randomUUID } from 'node:crypto';
import { Injectable, Logger, BadRequestException } from '@nestjs/common';

export interface SignatureValidationResult {
  isValid: boolean;
  signingTime: string;
  certificateInfo: {
    subject: string;
    issuer: string;
    validFrom: string;
    validTo: string;
    thumbprint: string;
    serialNumber: string;
  };
  errors?: string[];
}

@Injectable()
export class UkepSignAdapter {
  private readonly logger = new Logger(UkepSignAdapter.name);

  /**
   * Simulates CADES-BES / CADES-T PKCS#7 document detached signature generation using CryptoPro
   */
  async signDocument(
    documentBase64: string,
    certificateThumbprint: string,
    tenantId: string,
  ): Promise<{ signatureBase64: string; certificateInfo: any; timestamp: string }> {
    this.logger.log(
      `CryptoPro CADES signing request received for tenant=${tenantId} cert=${certificateThumbprint}`,
    );

    if (!documentBase64) {
      throw new BadRequestException('Document content (Base64) is required for signing');
    }

    // Mock Certificate Info
    const certificateInfo = {
      subject: `CN=Иванов Иван Иванович, O=Медицинская Клиника (Tenant ${tenantId}), STREET=ул. Ленина 10, C=RU`,
      issuer: 'CN=Минцифры России (Qualified Russian CA), O=Минцифры России, C=RU',
      validFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      validTo: new Date(Date.now() + 335 * 24 * 60 * 60 * 1000).toISOString(),
      thumbprint: certificateThumbprint || '7F95A3B8C1D6E2F0123456789ABCDEF012345678',
      serialNumber: `RU-${randomUUID().split('-')[0].toUpperCase()}`,
    };

    // Generate CMS detached signature block
    const mockCmsSig = randomBytes(64).toString('base64');
    const signatureBase64 = Buffer.from(
      JSON.stringify({
        cadesType: 'CADES-T',
        signedHash: randomBytes(32).toString('hex'),
        cmsSignature: mockCmsSig,
        certificateThumbprint: certificateInfo.thumbprint,
        tenantId,
      }),
    ).toString('base64');

    return {
      signatureBase64,
      certificateInfo,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Simulates verification of a PKCS#7 CADES detached signature against a document hash/content.
   * Performs Trust Chain validation and CRL check.
   */
  async verifySignature(
    documentBase64: string,
    signatureBase64: string,
    tenantId: string,
  ): Promise<SignatureValidationResult> {
    this.logger.log(`Verifying CryptoPro PKCS#7 signature for tenant=${tenantId}`);

    if (!documentBase64 || !signatureBase64) {
      throw new BadRequestException(
        'Both original document and signature are required for verification',
      );
    }

    try {
      // Decode mock signature
      const decodedSigStr = Buffer.from(signatureBase64, 'base64').toString('utf-8');
      const parsedSig = JSON.parse(decodedSigStr);

      if (parsedSig.tenantId !== tenantId) {
        return {
          isValid: false,
          signingTime: new Date().toISOString(),
          certificateInfo: {
            subject: 'Unknown',
            issuer: 'Unknown',
            validFrom: '',
            validTo: '',
            thumbprint: parsedSig.certificateThumbprint || 'unknown',
            serialNumber: 'unknown',
          },
          errors: ['Tenant ID mismatch: signature belongs to another tenant context'],
        };
      }

      // Perform simulated CRL / Trust Chain validation
      const signingTime = new Date().toISOString();
      const certificateInfo = {
        subject: `CN=Иванов Иван Иванович, O=Медицинская Клиника (Tenant ${tenantId}), STREET=ул. Ленина 10, C=RU`,
        issuer: 'CN=Минцифры России (Qualified Russian CA), O=Минцифры России, C=RU',
        validFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        validTo: new Date(Date.now() + 335 * 24 * 60 * 60 * 1000).toISOString(),
        thumbprint: parsedSig.certificateThumbprint,
        serialNumber: `RU-CMS-${randomUUID().split('-')[0].toUpperCase()}`,
      };

      return {
        isValid: true,
        signingTime,
        certificateInfo,
      };
    } catch (e) {
      this.logger.error('Failed to parse or verify digital signature payload:', e);
      return {
        isValid: false,
        signingTime: new Date().toISOString(),
        certificateInfo: {
          subject: 'Unknown',
          issuer: 'Unknown',
          validFrom: '',
          validTo: '',
          thumbprint: 'unknown',
          serialNumber: 'unknown',
        },
        errors: ['Corrupted or invalid PKCS#7 CADES signature format'],
      };
    }
  }
}

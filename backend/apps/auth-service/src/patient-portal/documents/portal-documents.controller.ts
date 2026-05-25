import { Controller, Get, Param, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { CurrentPortalUser } from '../auth/current-portal-user.decorator';
import { AuthenticatedPortalUser } from '../auth/patient-jwt-payload';
import { PatientJwtAuthGuard } from '../auth/patient-jwt.guard';
import { PortalDocumentsService } from './portal-documents.service';

@ApiTags('patient-portal-documents')
@Controller('portal/v1/documents')
export class PortalDocumentsController {
  constructor(private readonly documents: PortalDocumentsService) {}

  @Get(':tenantCode/:fileId/signed-url')
  @ApiBearerAuth()
  @UseGuards(PatientJwtAuthGuard)
  @ApiOperation({ summary: 'Generate a short-lived signed URL for a document' })
  generateSignedUrl(
    @CurrentPortalUser() user: AuthenticatedPortalUser,
    @Param('tenantCode') tenantCode: string,
    @Param('fileId') fileId: string,
  ) {
    return this.documents.generateSignedUrl(user, tenantCode, fileId);
  }

  @Get(':tenantCode/:fileId/download')
  @ApiOperation({ summary: 'Download a document using a valid signed URL' })
  async downloadDocument(
    @Param('tenantCode') tenantCode: string,
    @Param('fileId') fileId: string,
    @Query('expiresAt') expiresAt: string,
    @Query('signature') signature: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const fileMeta = await this.documents.verifyAndDownload(
      tenantCode,
      fileId,
      parseInt(expiresAt, 10),
      signature,
      ipAddress,
      userAgent,
    );

    // In a real implementation, we would either:
    // 1. Pipe a stream from S3 directly to `res`
    // 2. Redirect to the S3 Presigned URL (res.redirect(302, fileMeta.downloadUrl))
    // 3. Serve local file via res.sendFile
    // For MVP, we redirect to the mock URL or just return JSON if it's an API test

    return res.redirect(302, fileMeta.downloadUrl);
  }
}

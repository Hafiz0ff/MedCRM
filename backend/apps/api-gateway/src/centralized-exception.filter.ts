import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class CentralizedExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<any>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const requestId = request.headers['x-request-id'] || 'unknown';

    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred';
    let details: any = undefined;

    if (exception instanceof HttpException) {
      const respObj: any = exception.getResponse();
      if (typeof respObj === 'object' && respObj !== null) {
        code = respObj.error || respObj.code || 'HTTP_EXCEPTION';
        message = respObj.message || message;
        details = respObj.details || undefined;
      } else {
        code = 'HTTP_EXCEPTION';
        message = String(respObj);
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    response.status(status).json({
      success: false,
      error: {
        code: String(code).toUpperCase().replace(/[\s-]/g, '_'),
        message,
        details,
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

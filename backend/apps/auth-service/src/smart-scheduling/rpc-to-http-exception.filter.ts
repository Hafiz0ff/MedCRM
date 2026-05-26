import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class RpcToHttpExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception && exception.isRpcHttpException) {
      return response.status(exception.statusCode).json({
        statusCode: exception.statusCode,
        message: exception.message,
        error: exception.error,
      });
    }

    // Fallback to standard NestJS HttpException check
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const respObj = exception.getResponse();
      return response.status(status).json(respObj);
    }

    // Default 500 error
    return response.status(500).json({
      statusCode: 500,
      message: exception.message || 'Internal server error',
    });
  }
}

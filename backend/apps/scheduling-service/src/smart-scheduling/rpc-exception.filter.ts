import { Catch, RpcExceptionFilter, ArgumentsHost } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Observable, throwError } from 'rxjs';

@Catch()
export class RpcExceptionTranslationFilter implements RpcExceptionFilter<RpcException> {
  catch(exception: any, host: ArgumentsHost): Observable<any> {
    // If it is already an RpcException, just return its payload
    if (exception instanceof RpcException) {
      return throwError(() => exception.getError());
    }

    // If it is an HttpException (like BadRequestException, NotFoundException, etc.)
    if (
      exception &&
      typeof exception.getResponse === 'function' &&
      typeof exception.getStatus === 'function'
    ) {
      const response = exception.getResponse();
      const status = exception.getStatus();
      return throwError(() => ({
        isRpcHttpException: true,
        statusCode: status,
        message:
          typeof response === 'object' && response !== null && 'message' in response
            ? (response as any).message
            : exception.message,
        error:
          typeof response === 'object' && response !== null && 'error' in response
            ? (response as any).error
            : exception.name,
      }));
    }

    // Default generic error
    return throwError(() => ({
      isRpcHttpException: true,
      statusCode: 500,
      message: exception.message || 'Internal server error',
    }));
  }
}

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedPortalUser } from './patient-jwt-payload';

export const CurrentPortalUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedPortalUser => {
    const request = context.switchToHttp().getRequest<{ user: AuthenticatedPortalUser }>();
    return request.user;
  },
);

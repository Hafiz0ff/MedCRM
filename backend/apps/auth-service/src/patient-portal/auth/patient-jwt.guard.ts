import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class PatientJwtAuthGuard extends AuthGuard('patient-jwt') {}

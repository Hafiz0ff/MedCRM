import 'reflect-metadata';
import { PrismaService } from '@core/database/prisma.service';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import express from 'express';
import { AppModule } from '../app.module';

export interface TestContext {
  app: INestApplication;
  baseUrl: string;
  prisma: PrismaService;
  authHeaders: Record<string, string>;
  tenantId: string;
  branchId: string;
  adminId: string;
}

export async function setupE2eTest(): Promise<TestContext> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.use(express.json());
  app.use((req: any, res: any, next: any) => {
    console.log(
      `[E2E-MIDDLEWARE] ${req.method} ${req.url} | Content-Type: ${req.headers['content-type']}`,
    );
    console.log('[E2E-MIDDLEWARE] body:', req.body);
    next();
  });
  app.use(cookieParser());
  app.enableShutdownHooks();

  await app.init();
  await app.listen(0);

  const server = app.getHttpServer();
  const address = server.address();
  const port = typeof address === 'string' ? 3001 : address?.port;
  const baseUrl = `http://localhost:${port}`;

  const prisma = app.get(PrismaService);

  // Perform login to get access token and headers
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantCode: 'demo-clinic',
      email: 'admin@demo.clinic',
      password: 'Admin123!',
    }),
  });

  if (!loginRes.ok) {
    const errorText = await loginRes.text();
    throw new Error(`Failed to login E2E test admin: ${loginRes.status} ${errorText}`);
  }

  const { accessToken } = await loginRes.json();

  // Find tenant, branch, and admin user in DB
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { code: 'demo-clinic' } });
  const branch = await prisma.branch.findFirstOrThrow({
    where: { tenantId: tenant.id, code: 'main' },
  });
  const admin = await prisma.user.findFirstOrThrow({
    where: { tenantId: tenant.id, email: 'admin@demo.clinic' },
  });

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
    'x-tenant-id': tenant.id,
    'x-branch-id': branch.id,
  };

  return {
    app,
    baseUrl,
    prisma,
    authHeaders,
    tenantId: tenant.id,
    branchId: branch.id,
    adminId: admin.id,
  };
}

export async function teardownE2eTest(context: TestContext): Promise<void> {
  await context.app.close();
}

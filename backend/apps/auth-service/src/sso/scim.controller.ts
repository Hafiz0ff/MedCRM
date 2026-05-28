import { randomUUID } from 'node:crypto';
import { PrismaService } from '@core/database/prisma.service';
import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Req,
  Res,
  BadRequestException,
  NotFoundException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import * as argon2 from 'argon2';
import { Request, Response } from 'express';

@ApiTags('scim')
@Controller('system/scim/v2')
export class ScimController {
  constructor(private readonly prisma: PrismaService) {}

  private getTenantId(request: Request): string {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      throw new BadRequestException('X-Tenant-Id header is required for SCIM operations');
    }
    return tenantId;
  }

  @Get('Users')
  @ApiOperation({ summary: 'SCIM 2.0 List Users' })
  async listUsers(@Req() request: Request) {
    const tenantId = this.getTenantId(request);

    const users = await this.prisma.user.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    const resources = users.map((user) => ({
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      id: user.id,
      userName: user.email,
      name: {
        formatted: `${user.firstName} ${user.lastName}`,
        familyName: user.lastName,
        givenName: user.firstName,
      },
      emails: [
        {
          value: user.email,
          type: 'work',
          primary: true,
        },
      ],
      active: user.status === 'active',
      meta: {
        resourceType: 'User',
        created: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    }));

    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: resources.length,
      startIndex: 1,
      itemsPerPage: resources.length || 10,
      Resources: resources,
    };
  }

  @Post('Users')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'SCIM 2.0 Create User' })
  async createUser(@Body() body: any, @Req() request: Request) {
    const tenantId = this.getTenantId(request);

    const email = body.userName || (body.emails && body.emails[0] && body.emails[0].value);
    const fullName =
      body.name?.formatted ||
      `${body.name?.givenName || ''} ${body.name?.familyName || ''}`.trim() ||
      'SCIM User';
    const active = body.active !== false;

    if (!email) {
      throw new BadRequestException('userName or primary email is required');
    }

    // Check if user already exists
    const existing = await this.prisma.user.findFirst({
      where: { tenantId, email: email.toLowerCase() },
    });

    if (existing) {
      throw new BadRequestException('User already exists in this tenant');
    }

    // Resolve tenant branches to assign a default
    const branches = await this.prisma.branch.findMany({ where: { tenantId } });
    if (branches.length === 0) {
      throw new BadRequestException('Tenant has no branches configured');
    }
    const defaultBranch = branches[0];

    // Find or create doctor role
    let role = await this.prisma.role.findFirst({
      where: { tenantId, code: 'doctor' },
    });

    if (!role) {
      role = await this.prisma.role.create({
        data: {
          tenantId,
          code: 'doctor',
          name: 'Doctor',
          description: 'Default role for provisioned users',
        },
      });
    }

    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email: email.toLowerCase(),
        firstName: fullName.split(' ')[0] || 'SCIM',
        lastName: fullName.split(' ').slice(1).join(' ') || 'User',
        passwordHash: await argon2.hash(randomUUID()),
        status: active ? 'active' : 'suspended',
      },
    });

    // Assign to default branch
    await this.prisma.userBranchRole.create({
      data: {
        tenantId,
        userId: user.id,
        branchId: defaultBranch.id,
        roleId: role.id,
      },
    });

    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      id: user.id,
      userName: user.email,
      name: {
        formatted: `${user.firstName} ${user.lastName}`,
        familyName: user.lastName,
        givenName: user.firstName,
      },
      emails: [
        {
          value: user.email,
          type: 'work',
          primary: true,
        },
      ],
      active: user.status === 'active',
      meta: {
        resourceType: 'User',
        created: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    };
  }

  @Put('Users/:id')
  @ApiOperation({ summary: 'SCIM 2.0 Update User' })
  async updateUser(@Param('id') id: string, @Body() body: any, @Req() request: Request) {
    const tenantId = this.getTenantId(request);

    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found in tenant`);
    }

    const email = body.userName || (body.emails && body.emails[0] && body.emails[0].value);
    const fullName =
      body.name?.formatted || `${body.name?.givenName || ''} ${body.name?.familyName || ''}`.trim();
    const active = body.active;

    const updateData: any = {};
    if (email) updateData.email = email.toLowerCase();
    if (fullName) {
      updateData.firstName = fullName.split(' ')[0] || 'SCIM';
      updateData.lastName = fullName.split(' ').slice(1).join(' ') || 'User';
    }
    if (active !== undefined) {
      updateData.status = active ? 'active' : 'suspended';
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateData,
    });

    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      id: updatedUser.id,
      userName: updatedUser.email,
      name: {
        formatted: `${updatedUser.firstName} ${updatedUser.lastName}`,
        familyName: updatedUser.lastName,
        givenName: updatedUser.firstName,
      },
      emails: [
        {
          value: updatedUser.email,
          type: 'work',
          primary: true,
        },
      ],
      active: updatedUser.status === 'active',
      meta: {
        resourceType: 'User',
        created: updatedUser.createdAt.toISOString(),
        updatedAt: updatedUser.updatedAt.toISOString(),
      },
    };
  }
}

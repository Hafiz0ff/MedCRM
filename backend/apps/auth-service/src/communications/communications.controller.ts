import { ZodValidationPipe } from '@core/common/zod-validation.pipe';
import { CurrentUser } from '@core/security/current-user.decorator';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import { RequireModule } from '@core/security/modules.decorator';
import { RequirePermissions } from '@core/security/permissions.decorator';
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
  UsePipes,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleEnabledGuard } from '../auth/guards/module-enabled.guard';
import { RbacGuard } from '../auth/guards/rbac.guard';
import { CommunicationsService } from './communications.service';
import {
  SendMessageSchema,
  SendMessageDto,
  AssignConversationSchema,
  AssignConversationDto,
  CreateTemplateSchema,
  CreateTemplateDto,
  UpdateTemplateSchema,
  UpdateTemplateDto,
  CreateNotificationRuleSchema,
  CreateNotificationRuleDto,
  CreateCampaignSchema,
  CreateCampaignDto,
  UpdatePreferencesSchema,
  UpdatePreferencesDto,
  ChatbotWebhookSchema,
  ChatbotWebhookDto,
} from './dto/communications.dto';

@ApiTags('communications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModuleEnabledGuard, RbacGuard)
@RequireModule('communications')
@Controller('communications')
export class CommunicationsController {
  constructor(private readonly comms: CommunicationsService) {}

  @Get('conversations')
  @RequirePermissions('communications.inbox.read')
  getConversations(@CurrentUser() user: AuthenticatedUser) {
    return this.comms.getConversations(user);
  }

  @Get('conversations/:id/messages')
  @RequirePermissions('communications.inbox.read')
  getMessages(@CurrentUser() user: AuthenticatedUser, @Param('id') conversationId: string) {
    return this.comms.getMessages(user, conversationId);
  }

  @Post('conversations/:id/messages')
  @RequirePermissions('communications.message.send')
  @UsePipes(new ZodValidationPipe(SendMessageSchema))
  sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.comms.sendMessage(user, conversationId, dto);
  }

  @Post('conversations/:id/assign')
  @RequirePermissions('communications.message.send')
  @UsePipes(new ZodValidationPipe(AssignConversationSchema))
  assignConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') conversationId: string,
    @Body() dto: AssignConversationDto,
  ) {
    return this.comms.assignConversation(user, conversationId, dto.operatorId);
  }

  @Get('templates')
  @RequirePermissions('communications.inbox.read')
  getTemplates(@CurrentUser() user: AuthenticatedUser) {
    return this.comms.getTemplates(user);
  }

  @Post('templates')
  @RequirePermissions('communications.campaign.manage')
  @UsePipes(new ZodValidationPipe(CreateTemplateSchema))
  createTemplate(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTemplateDto) {
    return this.comms.createTemplate(user, dto);
  }

  @Put('templates/:id')
  @RequirePermissions('communications.campaign.manage')
  @UsePipes(new ZodValidationPipe(UpdateTemplateSchema))
  updateTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.comms.updateTemplate(user, id, dto);
  }

  @Post('rules')
  @RequirePermissions('communications.rule.manage')
  @UsePipes(new ZodValidationPipe(CreateNotificationRuleSchema))
  createNotificationRule(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateNotificationRuleDto,
  ) {
    return this.comms.createNotificationRule(user, dto);
  }

  @Post('campaigns')
  @RequirePermissions('communications.campaign.manage')
  @UsePipes(new ZodValidationPipe(CreateCampaignSchema))
  createCampaign(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCampaignDto) {
    return this.comms.createCampaign(user, dto);
  }

  @Post('campaigns/:id/execute')
  @RequirePermissions('communications.campaign.manage')
  executeCampaign(@CurrentUser() user: AuthenticatedUser, @Param('id') campaignId: string) {
    return this.comms.executeCampaign(user, campaignId);
  }

  @Post('preferences')
  @RequirePermissions('communications.rule.manage')
  @UsePipes(new ZodValidationPipe(UpdatePreferencesSchema))
  updatePreferences(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdatePreferencesDto) {
    return this.comms.updatePreferences(user, dto);
  }

  // Event-Driven Chatbot webhooks & Local provider inbound routers
  @Post('webhooks/chatbot')
  @RequirePermissions('communications.chatbot.manage')
  @UsePipes(new ZodValidationPipe(ChatbotWebhookSchema))
  async handleChatbotWebhook(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChatbotWebhookDto,
  ) {
    return this.comms.handleInboundMessage(
      user.tenantId,
      dto.chatId,
      'TELEGRAM',
      dto.text,
      dto.externalMessageId,
    );
  }

  @Post('webhooks/telegram')
  @RequirePermissions('communications.chatbot.manage')
  async handleTelegramInbound(@CurrentUser() user: AuthenticatedUser, @Body() payload: any) {
    const chatId = payload.message?.chat?.id?.toString() || payload.chatId;
    const text = payload.message?.text || payload.text || '';
    if (!chatId || !text) throw new BadRequestException('Invalid Telegram payload');

    return this.comms.handleInboundMessage(user.tenantId, chatId, 'TELEGRAM', text);
  }

  @Post('webhooks/sms/:provider')
  @RequirePermissions('communications.chatbot.manage')
  async handleSmsInbound(
    @CurrentUser() user: AuthenticatedUser,
    @Param('provider') provider: string,
    @Body() payload: any,
  ) {
    const phone = payload.phone || payload.sender || '';
    const text = payload.text || payload.message || '';
    if (!phone || !text) throw new BadRequestException('Invalid SMS webhook payload');

    return this.comms.handleInboundMessage(user.tenantId, phone, 'SMS', text);
  }
}

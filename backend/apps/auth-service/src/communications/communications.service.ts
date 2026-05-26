import { createHash } from 'crypto';
import { AuditLoggerService } from '@core/audit/audit-logger.service';
import { PrismaService } from '@core/database/prisma.service';
import { SchedulingPrismaService } from '@core/database/scheduling-prisma.service';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { RealtimeGateway } from '../smart-scheduling/realtime.gateway';
import {
  SendMessageDto,
  CreateTemplateDto,
  UpdateTemplateDto,
  CreateNotificationRuleDto,
  CreateCampaignDto,
  UpdatePreferencesDto,
  UpdateNotificationRuleDto,
  ConfigureChannelDto,
  ConfigureSmsProviderDto,
} from './dto/communications.dto';

@Injectable()
export class CommunicationsService {
  private readonly logger = new Logger(CommunicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly schedulingPrisma: SchedulingPrismaService,
    private readonly audit: AuditLoggerService,
    private readonly realtime: RealtimeGateway,
  ) {}

  // 1. Omnichannel Inbox & Contact Resolver
  async getConversations(user: AuthenticatedUser) {
    return this.prisma.conversation.findMany({
      where: { tenantId: user.tenantId },
      include: {
        patient: true,
        assignedOperator: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  async getMessages(user: AuthenticatedUser, conversationId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv) throw new NotFoundException('Диалог не найден');
    if (conv.tenantId !== user.tenantId) throw new ForbiddenException();

    return this.prisma.message.findMany({
      where: { tenantId: user.tenantId, conversationId },
      include: { attachments: true },
      orderBy: { sentAt: 'asc' },
    });
  }

  async handleInboundMessage(
    tenantId: string,
    phoneOrSocialId: string,
    channelType: 'TELEGRAM' | 'WHATSAPP' | 'SMS' | 'EMAIL' | 'INTERNAL' | 'WEBCHAT',
    text: string,
    externalMsgId?: string,
  ) {
    const phoneHash = createHash('sha256')
      .update(phoneOrSocialId.toLowerCase().replace(/[\s()+-]/g, ''))
      .digest('hex');

    // 1. Contact Matching Resolver
    const contact = await this.prisma.patientContact.findFirst({
      where: { tenantId, normalizedValueHash: phoneHash },
      include: { patient: true },
    });

    console.log('[DEBUG-CHATBOT] phoneOrSocialId:', phoneOrSocialId);
    console.log('[DEBUG-CHATBOT] calculated hash:', phoneHash);
    console.log('[DEBUG-CHATBOT] contact found:', contact ? 'YES' : 'NO');
    if (contact) console.log('[DEBUG-CHATBOT] contact patientId:', contact.patientId);

    let patientId: string;
    let isNewLead = false;

    if (contact) {
      patientId = contact.patientId;
    } else {
      // Unknown Contact Flow -> create a temporary patient lead
      isNewLead = true;
      const code = `LEAD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const tempPatient = await this.prisma.patient.create({
        data: {
          tenantId,
          patientCode: code,
          firstName: 'Неизвестный',
          lastName: 'Контакт',
          fullName: `Неизвестный Контакт (${phoneOrSocialId})`,
          status: 'NEW',
          contacts: {
            create: {
              tenantId,
              type: channelType === 'EMAIL' ? 'EMAIL' : 'PHONE',
              value: phoneOrSocialId,
              normalizedValueHash: phoneHash,
              isPrimary: true,
            },
          },
        },
      });
      patientId = tempPatient.id;
    }

    // 2. Lookup or create active conversation
    let conv = await this.prisma.conversation.findFirst({
      where: {
        tenantId,
        patientId,
        conversationStatus: { in: ['OPEN', 'PENDING', 'WAITING_PATIENT'] },
      },
    });

    if (!conv) {
      conv = await this.prisma.conversation.create({
        data: {
          tenantId,
          patientId,
          primaryChannel: channelType,
          conversationStatus: 'OPEN',
          unreadCount: 1,
        },
      });

      // Join participants
      await this.prisma.conversationParticipant.createMany({
        data: [
          {
            tenantId,
            conversationId: conv.id,
            participantType: 'PATIENT',
            participantId: patientId,
          },
          {
            tenantId,
            conversationId: conv.id,
            participantType: 'BOT',
            participantId: '00000000-0000-0000-0000-000000000000',
          }, // Seed bot id
        ],
      });
    } else {
      await this.prisma.conversation.update({
        where: { id: conv.id },
        data: {
          unreadCount: { increment: 1 },
          lastMessageAt: new Date(),
        },
      });
    }

    // 3. Save Inbound Message
    const message = await this.prisma.message.create({
      data: {
        tenantId,
        conversationId: conv.id,
        patientId,
        senderType: 'PATIENT',
        senderId: patientId,
        channelType,
        externalMessageId: externalMsgId || null,
        direction: 'INBOUND',
        messageType: 'TEXT',
        messageText: text,
        deliveryStatus: 'DELIVERED',
        deliveredAt: new Date(),
      },
    });

    // 4. Emit real-time events to operators
    this.realtime.emitCommunicationEvent('message.received', tenantId, {
      conversationId: conv.id,
      patientId,
      message,
      isNewLead,
    });

    // 5. Audit Log Inbound message
    await this.audit.log({
      tenantId,
      action: 'message.received',
      entityType: 'message',
      entityId: message.id,
      newValuesJson: message as any,
    });

    // 6. Push to Chatbot Engine for automated event-driven processing
    await this.processChatbotFlow(tenantId, conv.id, patientId, text, message.id);

    return { ok: true, conversationId: conv.id, messageId: message.id };
  }

  async sendMessage(user: AuthenticatedUser, conversationId: string, dto: SendMessageDto) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv) throw new NotFoundException('Диалог не найден');
    if (conv.tenantId !== user.tenantId) throw new ForbiddenException();

    // Verify preferences blocking
    if (conv.patientId) {
      const pref = await this.prisma.communicationPreference.findUnique({
        where: {
          tenantId_patientId_channelType: {
            tenantId: user.tenantId,
            patientId: conv.patientId,
            channelType: dto.channelType,
          },
        },
      });
      if (pref && pref.isBlocked) {
        throw new BadRequestException('Пациент заблокировал данный канал связи');
      }
    }

    const message = await this.prisma.$transaction(async (tx) => {
      // Update unread count reset (since operator is replying)
      await tx.conversation.update({
        where: { id: conversationId },
        data: { unreadCount: 0, lastMessageAt: new Date(), conversationStatus: 'WAITING_PATIENT' },
      });

      return tx.message.create({
        data: {
          tenantId: user.tenantId,
          conversationId,
          patientId: conv.patientId,
          senderType: 'EMPLOYEE',
          senderId: user.userId,
          channelType: dto.channelType,
          direction: 'OUTBOUND',
          messageType: dto.mediaFileId ? 'MEDIA' : 'TEXT',
          messageText: dto.messageText || null,
          mediaFileId: dto.mediaFileId || null,
          deliveryStatus: 'PENDING',
        },
      });
    });

    // Dispatch message asynchronously via gateways (mock adapters)
    if (dto.channelType === 'SMS' && conv.patientId) {
      const contact = await this.prisma.patientContact.findFirst({
        where: { tenantId: user.tenantId, patientId: conv.patientId, type: 'PHONE' },
      });
      if (contact) {
        await this.dispatchSmsViaGateway(
          user.tenantId,
          contact.value,
          dto.messageText || '',
          message.id,
        );
      }
    } else {
      // Mock other channels -> set auto-delivered
      await this.prisma.message.update({
        where: { id: message.id },
        data: { deliveryStatus: 'DELIVERED', deliveredAt: new Date() },
      });
    }

    const updatedMsg = await this.prisma.message.findUnique({
      where: { id: message.id },
      include: { attachments: true },
    });

    this.realtime.emitCommunicationEvent('notification.sent', user.tenantId, updatedMsg);

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'message.sent',
      entityType: 'message',
      entityId: message.id,
      newValuesJson: updatedMsg as any,
    });

    return updatedMsg;
  }

  async assignConversation(user: AuthenticatedUser, conversationId: string, operatorId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv) throw new NotFoundException('Диалог не найден');
    if (conv.tenantId !== user.tenantId) throw new ForbiddenException();

    const operator = await this.prisma.user.findUnique({
      where: { id: operatorId },
    });
    if (!operator || operator.tenantId !== user.tenantId) {
      throw new BadRequestException('Оператор не найден');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.conversation.update({
        where: { id: conversationId },
        data: { assignedOperatorId: operatorId },
      });

      await tx.conversationAssignment.create({
        data: {
          tenantId: user.tenantId,
          conversationId,
          assignedToUserId: operatorId,
          assignedBy: user.userId,
        },
      });
    });

    const logMessage = `Диалог передан оператору ${operator.firstName} ${operator.lastName}`;
    const message = await this.prisma.message.create({
      data: {
        tenantId: user.tenantId,
        conversationId,
        senderType: 'BOT',
        senderId: '00000000-0000-0000-0000-000000000000',
        channelType: conv.primaryChannel,
        direction: 'OUTBOUND',
        messageType: 'SYSTEM',
        messageText: logMessage,
        deliveryStatus: 'DELIVERED',
        deliveredAt: new Date(),
      },
    });

    this.realtime.emitCommunicationEvent('message.received', user.tenantId, {
      conversationId,
      message,
    });

    return { ok: true };
  }

  // 2. SMS Gateway Adapter Pattern (Tajikistan local providers)
  private async dispatchSmsViaGateway(
    tenantId: string,
    phone: string,
    text: string,
    messageId: string,
  ) {
    const activeProvider = await this.prisma.smsProvider.findFirst({
      where: { tenantId, isActive: true },
    });
    if (!activeProvider) {
      await this.prisma.message.update({
        where: { id: messageId },
        data: { deliveryStatus: 'FAILED', metadataJson: { error: 'No active SMS provider' } },
      });
      return;
    }

    if (activeProvider.dailyLimit <= 0) {
      await this.prisma.message.update({
        where: { id: messageId },
        data: { deliveryStatus: 'FAILED', metadataJson: { error: 'Daily limit exceeded' } },
      });
      return;
    }

    try {
      this.logger.debug(`Sending SMS via ${activeProvider.providerCode} to ${phone}`);
      // Adapter simulation
      let success = true;
      const provider = activeProvider.providerCode;

      if (provider === 'OSON_SMS') {
        this.logger.debug(`OsonSMS JSON API call to send`);
      } else if (provider === 'BABILON_T') {
        this.logger.debug(`Babilon-T TCP gateway XML submit`);
      } else if (provider === 'TCELL') {
        this.logger.debug(`Tcell SMTP/SMPP relay dispatch`);
      } else if (provider === 'MEGAFON_TJ') {
        this.logger.debug(`Megafon TJ U-SMS HTTP post request`);
      } else {
        success = false;
      }

      if (success) {
        // Deduct Limit
        await this.prisma.smsProvider.update({
          where: { id: activeProvider.id },
          data: { dailyLimit: { decrement: 1 } },
        });

        await this.prisma.message.update({
          where: { id: messageId },
          data: {
            deliveryStatus: 'DELIVERED',
            externalMessageId: `SMS-${provider}-${Date.now()}`,
            deliveredAt: new Date(),
          },
        });
      } else {
        throw new Error('Adapter failed to process payload');
      }
    } catch (e: any) {
      await this.prisma.message.update({
        where: { id: messageId },
        data: { deliveryStatus: 'FAILED', metadataJson: { error: e.message } },
      });
    }
  }

  // 3. Trigger Notification Engine & Scheduler Queue
  async handleTriggerEvent(tenantId: string, event: string, payload: any) {
    const rules = await this.prisma.notificationRule.findMany({
      where: { tenantId, triggerEvent: event, isActive: true },
      include: { template: true },
    });

    for (const rule of rules) {
      let patientId: string | null = null;
      let appointmentId: string | null = null;

      if (event.startsWith('appointment')) {
        patientId = payload.patientId;
        appointmentId = payload.id;
      } else if (event.startsWith('invoice')) {
        patientId = payload.patientId;
      }

      if (!patientId) continue;

      // Consent check: Transactional reminders check remindersAllowed, marketing checks marketingAllowed
      const pref = await this.prisma.communicationPreference.findUnique({
        where: {
          tenantId_patientId_channelType: {
            tenantId,
            patientId,
            channelType: rule.channelType,
          },
        },
      });

      const isMarketing = rule.triggerEvent === 'marketing.campaign';
      if (pref) {
        if (isMarketing && !pref.marketingAllowed) continue;
        if (!isMarketing && !pref.remindersAllowed) continue;
        if (pref.isBlocked) continue;
      }

      // Compile/interpolate variables
      const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
      const doctor = payload.employeeId
        ? await this.prisma.employee.findUnique({ where: { id: payload.employeeId } })
        : null;

      const variables = {
        patient_name: patient ? patient.fullName : 'Уважаемый клиент',
        doctor_name: doctor ? `${doctor.firstName} ${doctor.lastName}` : 'Врач',
        appointment_time: payload.startAt ? new Date(payload.startAt).toLocaleString('ru') : '',
        payment_amount: payload.totalAmount ? payload.totalAmount.toString() : '',
      };

      let renderedBody = rule.template.templateBody;
      for (const [key, val] of Object.entries(variables)) {
        renderedBody = renderedBody.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
      }

      const scheduledAt = new Date();
      scheduledAt.setMinutes(scheduledAt.getMinutes() + rule.delayMinutes);

      // Create Notification Queue entry
      await this.prisma.notificationsQueue.create({
        data: {
          tenantId,
          patientId,
          appointmentId,
          channelType: rule.channelType,
          templateId: rule.templateId,
          scheduledAt,
          payloadJson: { text: renderedBody },
          deliveryStatus: 'PENDING',
        },
      });
    }

    // Automatically trigger immediate queue processing
    await this.processNotificationsQueue(tenantId);
  }

  async processNotificationsQueue(tenantId: string) {
    const now = new Date();
    const pending = await this.prisma.notificationsQueue.findMany({
      where: {
        tenantId,
        deliveryStatus: 'PENDING',
        scheduledAt: { lte: now },
        retryCount: { lt: 3 },
      },
    });

    for (const job of pending) {
      try {
        const payload = job.payloadJson as Record<string, string>;
        let conversation = await this.prisma.conversation.findFirst({
          where: {
            tenantId,
            patientId: job.patientId,
            conversationStatus: { in: ['OPEN', 'PENDING', 'WAITING_PATIENT'] },
          },
        });

        if (!conversation && job.patientId) {
          conversation = await this.prisma.conversation.create({
            data: {
              tenantId,
              patientId: job.patientId,
              primaryChannel: job.channelType,
              conversationStatus: 'OPEN',
            },
          });
        }

        if (conversation) {
          // Send as bot or system
          const msg = await this.prisma.message.create({
            data: {
              tenantId,
              conversationId: conversation.id,
              patientId: job.patientId,
              senderType: 'BOT',
              senderId: '00000000-0000-0000-0000-000000000000',
              channelType: job.channelType,
              direction: 'OUTBOUND',
              messageText: payload.text,
              deliveryStatus: 'PENDING',
            },
          });

          if (job.channelType === 'SMS' && job.patientId) {
            const contact = await this.prisma.patientContact.findFirst({
              where: { tenantId, patientId: job.patientId, type: 'PHONE' },
            });
            if (contact) {
              await this.dispatchSmsViaGateway(tenantId, contact.value, payload.text, msg.id);
            }
          } else {
            await this.prisma.message.update({
              where: { id: msg.id },
              data: { deliveryStatus: 'DELIVERED', deliveredAt: new Date() },
            });
          }
        }

        await this.prisma.notificationsQueue.update({
          where: { id: job.id },
          data: { deliveryStatus: 'DELIVERED', processedAt: new Date() },
        });
      } catch (err: any) {
        await this.prisma.notificationsQueue.update({
          where: { id: job.id },
          data: {
            retryCount: { increment: 1 },
            deliveryStatus: job.retryCount >= 2 ? 'FAILED' : 'PENDING',
          },
        });
      }
    }
  }

  // 4. Event-Driven Chatbot Engine
  private async processChatbotFlow(
    tenantId: string,
    conversationId: string,
    patientId: string,
    text: string,
    messageId: string,
  ) {
    const normalizedInput = text.trim();
    if (normalizedInput !== '1' && normalizedInput !== '2') {
      return; // Non-trigger bot keyword, ignore or route to default handler
    }

    // Find the latest pending appointment to confirm or cancel
    const app = await this.schedulingPrisma.appointment.findFirst({
      where: { tenantId, patientId, status: { in: ['SCHEDULED', 'CHECKED_IN', 'CONFIRMED'] } },
      orderBy: { startAt: 'desc' },
    });

    console.log(
      '[DEBUG-CHATBOT] processChatbotFlow trigger input:',
      normalizedInput,
      'patientId:',
      patientId,
    );
    console.log(
      '[DEBUG-CHATBOT] latest pending appointment:',
      app ? `${app.id} status ${app.status}` : 'NONE',
    );

    if (!app) return;

    if (normalizedInput === '1') {
      // 1. CONFIRMATION
      await this.schedulingPrisma.$transaction(async (tx) => {
        await tx.appointment.update({
          where: { id: app.id },
          data: { status: 'CONFIRMED', confirmedAt: new Date() },
        });

        await tx.appointmentStatusHistory.create({
          data: {
            tenantId,
            appointmentId: app.id,
            oldStatus: app.status,
            newStatus: 'CONFIRMED',
            changedBy: '00000000-0000-0000-0000-000000000000', // System Bot
            reason: 'Подтверждено через чат-бота',
          },
        });
      });

      await this.prisma.chatbotActionLog.create({
        data: {
          tenantId,
          patientId,
          conversationId,
          actionType: 'CONFIRM_APPOINTMENT',
          sourceMessageId: messageId,
          actionResult: `Подтвержден визит ${app.appointmentNumber}`,
        },
      });

      // Reply confirmation success
      await this.sendSystemBotReply(
        tenantId,
        conversationId,
        patientId,
        'Запись успешно подтверждена. Ждем Вас!',
      );
    } else if (normalizedInput === '2') {
      // 2. CANCELLATION
      await this.schedulingPrisma.$transaction(async (tx) => {
        await tx.appointment.update({
          where: { id: app.id },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            cancellationReason: 'Отменено пациентом через чат-бота',
          },
        });

        await tx.appointmentStatusHistory.create({
          data: {
            tenantId,
            appointmentId: app.id,
            oldStatus: app.status,
            newStatus: 'CANCELLED',
            changedBy: '00000000-0000-0000-0000-000000000000',
            reason: 'Отменено через чат-бота',
          },
        });
      });

      await this.prisma.chatbotActionLog.create({
        data: {
          tenantId,
          patientId,
          conversationId,
          actionType: 'CANCEL_APPOINTMENT',
          sourceMessageId: messageId,
          actionResult: `Отменен визит ${app.appointmentNumber}`,
        },
      });

      // Reply cancellation success
      await this.sendSystemBotReply(
        tenantId,
        conversationId,
        patientId,
        'Запись отменена. Всего доброго.',
      );

      // Waiting List release trigger
      await this.triggerWaitingListFailover(tenantId, app);
    }
  }

  private async sendSystemBotReply(
    tenantId: string,
    conversationId: string,
    patientId: string,
    text: string,
  ) {
    const msg = await this.prisma.message.create({
      data: {
        tenantId,
        conversationId,
        patientId,
        senderType: 'BOT',
        senderId: '00000000-0000-0000-0000-000000000000',
        channelType: 'TELEGRAM',
        direction: 'OUTBOUND',
        messageText: text,
        deliveryStatus: 'DELIVERED',
        deliveredAt: new Date(),
      },
    });

    this.realtime.emitCommunicationEvent('message.received', tenantId, {
      conversationId,
      message: msg,
    });
  }

  private async triggerWaitingListFailover(tenantId: string, cancelledApp: any) {
    // Find highest priority patient in waiting list waiting for the same doctor or service
    const waiting = await this.schedulingPrisma.waitingList.findFirst({
      where: {
        tenantId,
        branchId: cancelledApp.branchId,
        OR: [{ employeeId: cancelledApp.employeeId }, { serviceId: cancelledApp.serviceId }],
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });

    if (!waiting) return;

    // Trigger Notification rule to offer this newly released slot!
    const rule = await this.prisma.notificationRule.findFirst({
      where: { tenantId, triggerEvent: 'waiting_list.slot_available', isActive: true },
      include: { template: true },
    });

    if (rule) {
      await this.handleTriggerEvent(tenantId, 'waiting_list.slot_available', {
        patientId: waiting.patientId,
        employeeId: cancelledApp.employeeId,
        startAt: cancelledApp.startAt,
      });
      this.logger.debug(`Waiting list slot offer triggered for patientId=${waiting.patientId}`);
    }
  }

  // 5. Campaigns Engine with Marketing Preferences opt-in checks
  async executeCampaign(user: AuthenticatedUser, campaignId: string) {
    const campaign = await this.prisma.communicationCampaign.findUnique({
      where: { id: campaignId },
      include: { template: true },
    });
    if (!campaign) throw new NotFoundException('Кампания не найдена');
    if (campaign.tenantId !== user.tenantId) throw new ForbiddenException();
    if (campaign.campaignStatus !== 'DRAFT') {
      throw new BadRequestException('Кампания уже запущена или завершена');
    }

    // Update status to ACTIVE
    await this.prisma.communicationCampaign.update({
      where: { id: campaignId },
      data: { campaignStatus: 'ACTIVE' },
    });

    // Segment querying (simulation matches tags or CRM segments)
    const segment = campaign.targetSegmentJson as Record<string, string>;
    const tagCode = segment.tagCode;

    const patients = await this.prisma.patient.findMany({
      where: {
        tenantId: user.tenantId,
        tags: tagCode ? { some: { tag: { code: tagCode } } } : undefined,
      },
    });

    let sentCount = 0;
    for (const patient of patients) {
      // Preference Filter Consent Check
      const pref = await this.prisma.communicationPreference.findUnique({
        where: {
          tenantId_patientId_channelType: {
            tenantId: user.tenantId,
            patientId: patient.id,
            channelType: campaign.channelType,
          },
        },
      });
      if (pref && !pref.marketingAllowed) continue; // Patient opted out of marketing!
      if (pref && pref.isBlocked) continue; // Patient blocked channel!

      // Push to queue as Campaign notification
      await this.prisma.notificationsQueue.create({
        data: {
          tenantId: user.tenantId,
          patientId: patient.id,
          channelType: campaign.channelType,
          templateId: campaign.templateId,
          scheduledAt: new Date(),
          priority: 'LOW',
          payloadJson: { text: campaign.template.templateBody },
        },
      });
      sentCount++;
    }

    // Process immediately
    await this.processNotificationsQueue(user.tenantId);

    // Update status to COMPLETED
    await this.prisma.communicationCampaign.update({
      where: { id: campaignId },
      data: { campaignStatus: 'COMPLETED' },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'campaign.executed',
      entityType: 'communication_campaign',
      entityId: campaignId,
      newValuesJson: { campaignId, sentCount },
    });

    return { success: true, sentCount };
  }

  // Multi-lingual message templates creation
  async createTemplate(user: AuthenticatedUser, dto: CreateTemplateDto) {
    const template = await this.prisma.messageTemplate.create({
      data: {
        tenantId: user.tenantId,
        templateCode: dto.templateCode,
        templateName: dto.templateName,
        channelType: dto.channelType,
        languageCode: dto.languageCode,
        subject: dto.subject || null,
        templateBody: dto.templateBody,
        variablesJson: dto.variablesJson || {},
      },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'template.created',
      entityType: 'message_template',
      entityId: template.id,
      newValuesJson: template,
    });

    return template;
  }

  async updateTemplate(user: AuthenticatedUser, id: string, dto: UpdateTemplateDto) {
    const template = await this.prisma.messageTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Шаблон не найден');
    if (template.tenantId !== user.tenantId) throw new ForbiddenException();

    const updated = await this.prisma.messageTemplate.update({
      where: { id },
      data: {
        templateName: dto.templateName,
        templateBody: dto.templateBody,
        variablesJson: dto.variablesJson,
        isActive: dto.isActive,
      },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'template.updated',
      entityType: 'message_template',
      entityId: id,
      oldValuesJson: template,
      newValuesJson: updated,
    });

    return updated;
  }

  async getTemplates(user: AuthenticatedUser) {
    return this.prisma.messageTemplate.findMany({
      where: { tenantId: user.tenantId },
    });
  }

  async createNotificationRule(user: AuthenticatedUser, dto: CreateNotificationRuleDto) {
    const rule = await this.prisma.notificationRule.create({
      data: {
        tenantId: user.tenantId,
        ruleName: dto.ruleName,
        triggerEvent: dto.triggerEvent,
        channelType: dto.channelType,
        templateId: dto.templateId,
        delayMinutes: dto.delayMinutes,
        conditionsJson: dto.conditionsJson || {},
      },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'rule.created',
      entityType: 'notification_rule',
      entityId: rule.id,
      newValuesJson: rule,
    });

    return rule;
  }

  async createCampaign(user: AuthenticatedUser, dto: CreateCampaignDto) {
    const campaign = await this.prisma.communicationCampaign.create({
      data: {
        tenantId: user.tenantId,
        campaignName: dto.campaignName,
        targetSegmentJson: dto.targetSegmentJson || {},
        channelType: dto.channelType,
        templateId: dto.templateId,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        createdBy: user.userId,
      },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'campaign.created',
      entityType: 'communication_campaign',
      entityId: campaign.id,
      newValuesJson: campaign,
    });

    return campaign;
  }

  async updatePreferences(user: AuthenticatedUser, dto: UpdatePreferencesDto) {
    const pref = await this.prisma.communicationPreference.upsert({
      where: {
        tenantId_patientId_channelType: {
          tenantId: user.tenantId,
          patientId: dto.patientId,
          channelType: dto.channelType,
        },
      },
      create: {
        tenantId: user.tenantId,
        patientId: dto.patientId,
        channelType: dto.channelType,
        marketingAllowed: dto.marketingAllowed !== undefined ? dto.marketingAllowed : true,
        remindersAllowed: dto.remindersAllowed !== undefined ? dto.remindersAllowed : true,
        isBlocked: dto.isBlocked !== undefined ? dto.isBlocked : false,
      },
      update: {
        marketingAllowed: dto.marketingAllowed,
        remindersAllowed: dto.remindersAllowed,
        isBlocked: dto.isBlocked,
      },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'preferences.updated',
      entityType: 'communication_preference',
      entityId: pref.id,
      newValuesJson: pref,
    });

    return pref;
  }

  async getNotificationRules(user: AuthenticatedUser) {
    return this.prisma.notificationRule.findMany({
      where: { tenantId: user.tenantId },
      include: { template: true },
    });
  }

  async updateNotificationRule(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateNotificationRuleDto,
  ) {
    const rule = await this.prisma.notificationRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Правило не найдено');
    if (rule.tenantId !== user.tenantId) throw new ForbiddenException();

    const updated = await this.prisma.notificationRule.update({
      where: { id },
      data: {
        ruleName: dto.ruleName,
        templateId: dto.templateId,
        delayMinutes: dto.delayMinutes,
        isActive: dto.isActive,
        conditionsJson: dto.conditionsJson !== undefined ? dto.conditionsJson : undefined,
      },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'rule.updated',
      entityType: 'notification_rule',
      entityId: id,
      oldValuesJson: rule,
      newValuesJson: updated,
    });

    return updated;
  }

  async deleteNotificationRule(user: AuthenticatedUser, id: string) {
    const rule = await this.prisma.notificationRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Правило не найдено');
    if (rule.tenantId !== user.tenantId) throw new ForbiddenException();

    await this.prisma.notificationRule.delete({ where: { id } });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'rule.deleted',
      entityType: 'notification_rule',
      entityId: id,
      oldValuesJson: rule,
    });

    return { ok: true };
  }

  async getChannels(user: AuthenticatedUser) {
    return this.prisma.communicationChannel.findMany({
      where: { tenantId: user.tenantId },
    });
  }

  async configureChannel(user: AuthenticatedUser, dto: ConfigureChannelDto) {
    const existing = await this.prisma.communicationChannel.findFirst({
      where: { tenantId: user.tenantId, channelType: dto.channelType },
    });

    let channel;
    if (existing) {
      channel = await this.prisma.communicationChannel.update({
        where: { id: existing.id },
        data: {
          providerCode: dto.providerCode,
          configurationJson: dto.configurationJson || {},
          isActive: dto.isActive,
        },
      });
    } else {
      channel = await this.prisma.communicationChannel.create({
        data: {
          tenantId: user.tenantId,
          channelType: dto.channelType,
          providerCode: dto.providerCode,
          configurationJson: dto.configurationJson || {},
          isActive: dto.isActive ?? true,
        },
      });
    }

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'channel.configured',
      entityType: 'communication_channel',
      entityId: channel.id,
      newValuesJson: channel,
    });

    return channel;
  }

  async getSmsProviders(user: AuthenticatedUser) {
    return this.prisma.smsProvider.findMany({
      where: { tenantId: user.tenantId },
    });
  }

  async configureSmsProvider(user: AuthenticatedUser, dto: ConfigureSmsProviderDto) {
    const existing = await this.prisma.smsProvider.findFirst({
      where: { tenantId: user.tenantId, providerCode: dto.providerCode },
    });

    let provider;
    if (existing) {
      provider = await this.prisma.smsProvider.update({
        where: { id: existing.id },
        data: {
          providerName: dto.providerName,
          apiCredentialsJson: dto.apiCredentialsJson || {},
          senderName: dto.senderName,
          dailyLimit: dto.dailyLimit,
          isActive: dto.isActive,
        },
      });
    } else {
      provider = await this.prisma.smsProvider.create({
        data: {
          tenantId: user.tenantId,
          providerCode: dto.providerCode,
          providerName: dto.providerName,
          apiCredentialsJson: dto.apiCredentialsJson || {},
          senderName: dto.senderName,
          dailyLimit: dto.dailyLimit ?? 1000,
          isActive: dto.isActive ?? true,
        },
      });
    }

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'sms_provider.configured',
      entityType: 'sms_provider',
      entityId: provider.id,
      newValuesJson: provider,
    });

    return provider;
  }
}

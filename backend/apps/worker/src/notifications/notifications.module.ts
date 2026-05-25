import { CoreCommunicationsModule } from '@core/communications/core-communications.module';
import { TemplateModule } from '@core/templates/template.module';
import { Module } from '@nestjs/common';
import { NoShowFollowupWorker } from './no-show-followup.worker';
import { NotificationsDispatchWorker } from './notifications-dispatch.worker';
import { NotificationsScheduleScanWorker } from './notifications-schedule-scan.worker';

@Module({
  imports: [CoreCommunicationsModule, TemplateModule],
  providers: [NotificationsDispatchWorker, NotificationsScheduleScanWorker, NoShowFollowupWorker],
})
export class NotificationsModule {}

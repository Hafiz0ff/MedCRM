import { Global, Module } from '@nestjs/common';
import { TemplateService } from './template.service';

@Global()
@Module({
  providers: [TemplateService],
  exports: [TemplateService],
})
export class TemplateModule {}

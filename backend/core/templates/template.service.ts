import { Injectable, Logger } from '@nestjs/common';
import { format as formatDate } from 'date-fns';
import { ru } from 'date-fns/locale';
import Handlebars from 'handlebars';

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);

  constructor() {
    this.registerHelpers();
  }

  private registerHelpers() {
    // Check if helper is already registered to avoid duplicates
    if (!Handlebars.helpers.date) {
      Handlebars.registerHelper('date', (value: any, formatStr: any) => {
        if (!value) return '';
        try {
          const date = new Date(value);
          const formatPattern = typeof formatStr === 'string' ? formatStr : 'dd.MM.yyyy';
          return formatDate(date, formatPattern, { locale: ru });
        } catch (err: any) {
          this.logger.warn(`Failed to format date helper: ${err.message}`);
          return String(value);
        }
      });
    }

    if (!Handlebars.helpers.time) {
      Handlebars.registerHelper('time', (value: any) => {
        if (!value) return '';
        try {
          const date = new Date(value);
          return formatDate(date, 'HH:mm', { locale: ru });
        } catch (err: any) {
          this.logger.warn(`Failed to format time helper: ${err.message}`);
          return String(value);
        }
      });
    }
  }

  /**
   * Compiles the Handlebars template body with the dynamic payload data.
   */
  compile(templateBody: string, payload: Record<string, any>): string {
    try {
      const template = Handlebars.compile(templateBody, { noEscape: true });
      return template(payload);
    } catch (err: any) {
      this.logger.error(`Failed to compile template: ${err.message}`);
      throw new Error(`Template compilation error: ${err.message}`);
    }
  }
}

/* eslint-disable no-console */
import { Injectable, Logger as BaseLogger, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type LogEventEntry = {
  level: string;
  event: Event;
  timestamp: string;
};

type Event = {
  traceId: string;
  code: string;
  message: string;
  function: string;
  producer: string;
  metadata: any;
};

@Injectable({ scope: Scope.TRANSIENT })
export class Logger extends BaseLogger {
  protected producer: string;
  protected codeDomain: string;
  protected codeService: string;
  protected codeMapper: any;
  protected constant: any;

  constructor(private configService: ConfigService) {
    super();

    const appDomain = configService.get<any>('logger.appDomain');
    const appService = configService.get<any>('logger.appService');

    this.constant = configService.get<any>(`eventCode.${appDomain}`);

    if (this.constant === undefined) {
      this.codeDomain = 'E00';
      this.codeService = '000';
    } else {
      this.codeDomain = this.constant.codeDomain;
      if (this.codeDomain === undefined) {
        this.codeDomain = 'E00';
      }

      this.codeService = this.constant.codeService[appService];

      if (this.codeService === undefined) {
        this.codeService = '000';
      }
    }

    this.codeMapper = configService.get<any>('codeMapper');
    if (this.codeMapper === undefined) {
      this.codeMapper = {};
    }

    this.producer = this.configService.get<any>('logger.appName');
  }

  public log(message: unknown): void {
    console.log(this.prefix(), message);
  }

  public INFO(traceId: string, code: string, message: string, _function: string = '', metadata: any = ''): void {
    let event: Event = this._getEvent(traceId, code, message, _function, metadata);
    this._log('INFO', event, metadata);
  }

  public WARN(traceId: string, code: string, message: string, _function: string = '', metadata: any = ''): void {
    let event: Event = this._getEvent(traceId, code, message, _function, metadata);
    this._log('WARN', event, metadata);
  }

  public FATAL(traceId: string, code: string, message: string, _function: string = '', metadata: any = ''): void {
    let event: Event = this._getEvent(traceId, code, message, _function, metadata);
    this._log('FATAL', event, metadata);
  }

  public DEBUG(traceId: string, code: string, message: string, _function: string = '', metadata: any = ''): void {
    let event: Event = this._getEvent(traceId, code, message, _function, metadata);
    this._log('DEBUG', event, metadata);
  }

  public ERROR(traceId: string, code: string, message: string, _function: string = '', metadata: any = ''): void {
    let event: Event = this._getEvent(traceId, code, message, _function, metadata);
    this._log('ERROR', event, metadata);
  }

  public _log(level: string, event: Event, metadata: any): void {
    let logEventEntry: LogEventEntry = {
      level,
      event,
      timestamp: new Date().toISOString(),
    };

    console.log(JSON.stringify(logEventEntry));
  }

  public prefix(): string {
    let prefix = new Date().toISOString();
    if (this.context) {
      prefix += ` [${this.context}]`;
    }

    return prefix;
  }

  public codePrefix(): string {
    return this.codeDomain + this.codeService;
  }

  public getCode(alias: string): string {
    const code = this.codeMapper[alias];
    if (code == undefined) {
      return alias;
    }

    return code;
  }

  private _getEvent(traceId: string, code: string, message: string, _function: string = '', metadata: any = ''): Event {
    return {
      traceId,
      code: this.codePrefix() + this.getCode(code),
      message,
      function: `${this.context}.${_function}`,
      producer: this.producer,
      metadata,
    };
  }
}

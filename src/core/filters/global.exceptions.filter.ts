import { ArgumentsHost, Catch, HttpException, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import axios from 'axios';
import type { Response } from 'express';
import { EntityNotFoundError } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Logger } from '../utils';

@Catch()
export class GlobalExceptionsFilter extends BaseExceptionFilter {
  constructor(private readonly logger: Logger) {
    super();

    this.logger.setContext(GlobalExceptionsFilter.name);
  }

  public catch(exception: Error, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const traceId = res.get('x-trace-id') || uuid();

    let traces: string[] = exception.stack?.split('\n') || [];

    let metadata: any = {
      exception_raised: {
        function: traces.length > 1 ? traces[1] : '',
        file: traces.length > 1 ? traces[1] : '',
        stacktrace: exception.stack,
      },
    };

    let message = exception.message || 'Unknown Exception';
    let detail = null;
    let status = HttpStatus.INTERNAL_SERVER_ERROR;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const exceptionDetail: Record<string, any> = typeof exceptionResponse === 'object' ? { ...exceptionResponse } : {};
      detail = exceptionDetail.detail || exceptionDetail.message || exceptionResponse;
    }

    if (exception instanceof EntityNotFoundError) {
      message = 'Entity not found';
      status = HttpStatus.NOT_FOUND;
    }

    if (axios.isAxiosError(exception)) {
      detail = exception.response?.data;
      status = HttpStatus.BAD_REQUEST;
    }

    this.logger.ERROR(traceId, 'exception_raised', message, 'catch', metadata);

    res.status(status).json({
      error: {
        code: this.logger.codePrefix() + this.logger.getCode('exception_raised'),
        message,
        detail,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

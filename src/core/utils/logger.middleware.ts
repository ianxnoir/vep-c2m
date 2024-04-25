import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response } from 'express';
import { v4 as uuid } from 'uuid';

import { Logger } from './logger.service';

type http_request_received = {
  host: string;
  path: string;
  method: string;
  userId: string;
};

type http_response_sent = {
  status: number;
  host: string;
  path: string;
  method: string;
  userId: string;
};

type metadataHttpResponseSent = {
  http_response_sent: http_response_sent;
};

type metadataHttpRequestReceived = {
  http_request_received: http_request_received;
};

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly passUrl: string[] = ['/health'];

  constructor(private logger: Logger) {
    this.logger.setContext(LoggerMiddleware.name);
  }

  public use(req: Request, res: Response, next: () => void): void {
    let traceId: string = uuid();

    let requestId: any = req.headers['x-request-id'];

    if (requestId == undefined) {
      res.setHeader('x-trace-id', traceId);
    } else {
      traceId = requestId;
      res.setHeader('x-trace-id', requestId);
    }

    let http_request_received: http_request_received = {
      host: req.hostname,
      path: req.path,
      method: req.method,
      userId: '88574930239480823', // TO DO: extract ssouid from JWT token
    };

    let metadataHttpRequestReceived: metadataHttpRequestReceived = {
      http_request_received: http_request_received,
    };

    if (this.passUrl.includes(req.originalUrl)) {
      return next();
    }

    this.logger.INFO(traceId, 'http_request_received', 'Received request.', LoggerMiddleware.prototype.use.name, metadataHttpRequestReceived);

    res.on('finish', () => {
      let http_response_sent: http_response_sent = {
        status: res.statusCode,
        host: req.hostname,
        path: req.path,
        method: req.method,
        userId: '88574930239480823', // TO DO: extract ssouid from JWT token
      };

      let metadataHttpResponseSent: metadataHttpResponseSent = {
        http_response_sent: http_response_sent,
      };

      this.logger.INFO(res.get('x-trace-id'), 'http_response_sent', res.statusCode.toString(), LoggerMiddleware.prototype.use.name, metadataHttpResponseSent);
    });

    return next();
  }
}

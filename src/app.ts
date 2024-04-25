import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { XRayInterceptor } from './core/interceptors/xray-logging-interceptor';
import * as AWSXRay from 'aws-xray-sdk';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import fs from 'fs';
// import session from 'express-session';
import helmet from 'helmet';

import { AppModule } from './app.module';

const XRayExpress = AWSXRay.express;
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const configService: ConfigService = app.get(ConfigService);
  AWSXRay.setDaemonAddress(configService.get('xray.DAEMON_ENDPOINT') || '127.0.0.1:2000');

  app.useGlobalPipes(
    new ValidationPipe({
      disableErrorMessages: false,
      transform: true, // transform object to DTO class
    })
  );

  app.enable('trust proxy');

  //#region Express Middleware
  app.use(compression());
  // app.use(
  //   session({
  //     secret: configService.get<any>('app.sessionSecret'),
  //     resave: false,
  //     saveUninitialized: true,
  //     cookie: { secure: 'auto' },
  //   })
  // );
  app.use(helmet());
  //#endregion
  app.use(XRayExpress.openSegment('VEP-C2M'));
  AWSXRay.captureHTTPsGlobal(require('https'));
  AWSXRay.captureHTTPsGlobal(require('http'));
  AWSXRay.captureMySQL(require('mysql'));
  app.useGlobalInterceptors(new XRayInterceptor());

  app.use(AWSXRay.express.closeSegment());
  app.use(cookieParser());

  const options = new DocumentBuilder()
  .setTitle('VEP C2M Service API')
  .setDescription('VEP C2M Service API')
  .setVersion('1.0')
  .addTag('vep-c2m')
  .addServer('', 'clouddev')
  .addServer('', 'sit')
  .addServer('', 'uat')
  .addServer('', 'prd')
  .build();
  const document = SwaggerModule.createDocument(app, options);
  const outputPath = './docs/swagger.json';
  fs.writeFileSync(outputPath, JSON.stringify(document, null, 4), { encoding: 'utf8' });

  await app.listen(configService.get<any>('app.appPort'));
}

// eslint-disable-next-line no-console
bootstrap()
  .then(() => console.log('Bootstrap', new Date().toLocaleString()))
  .catch(console.error);

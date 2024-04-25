import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { Logger } from './logger.service';
import { UtilsModule } from './utils';

let app: TestingModule;
let logger: Logger;

// const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
// const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

describe('Unit tests for Logger Service', () => {
  beforeEach(async () => {
    app = await Test.createTestingModule({
      providers: [
        Logger,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              console.log(key);
              // if (key === 'logger.appDomain') {
              //     return 'vep-foundation-core'
              // }
              if (key === 'eventCode.vep-foundation-core') {
                return {
                  codeDomain: 'E00',
                };
              }
              return null;
            }),
          },
        },
      ],
      imports: [UtilsModule],
    }).compile();

    logger = await app.resolve<Logger>(Logger);
  });

  test('Verify the console.log is called', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    logger.log('hello');

    expect(consoleLogSpy).toBeCalledTimes(1);
  });

  test('Verify the _log is called', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    let event: any = {};

    logger._log('INFO', event, {});
    expect(consoleLogSpy).toBeCalledTimes(1);
  });

  test('Verify the _log function in INFO is called', async () => {
    const _logSpy = jest.spyOn(logger, '_log').mockImplementation();

    logger.INFO('traceId', '00001', 'message', 'function', '');
    expect(_logSpy).toBeCalledTimes(1);
  });

  test('Verify the _log function in WARN is called', async () => {
    const _logSpy = jest.spyOn(logger, '_log').mockImplementation();

    logger.WARN('traceId', '00001', 'message', 'function', '');
    expect(_logSpy).toBeCalledTimes(1);
  });

  afterAll(async () => {
    await app?.close();
  });
});

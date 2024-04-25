import { Test, TestingModule } from '@nestjs/testing';

import { S3Service } from './s3.service';
import { UtilsModule } from './utils';

let app: TestingModule;
let s3: S3Service;

// const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
// const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

describe('Unit tests for S3Service Service', () => {
  beforeAll(async () => {
    app = await Test.createTestingModule({
      imports: [UtilsModule],
    }).compile();

    s3 = await app.resolve<S3Service>(S3Service);
  });

  test('Verify the getFile is called', async () => {
    let result = await s3.getFile('fair-master/cache/settings.json');
    result = JSON.parse(result);
    expect('data' in result).toBe(true);
  });

  afterAll(async () => {
    await app?.close();
  });
});

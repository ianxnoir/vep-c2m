import { Module, HttpModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SendbirdLicense } from '../../../entities/sendbirdLicense.entity';
import { ZOOMLicense } from '../../../entities/zoomLicense.entity';
import { Meeting } from '../../../entities/meeting.entity';
import { ReuseLicenseController } from './reuseLicense.controller';
import { ReuseLicenseService } from './reuseLicense.service';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([SendbirdLicense, ZOOMLicense, Meeting]),
  ],
  controllers: [ReuseLicenseController],
  providers: [ReuseLicenseService, ZOOMLicense, Meeting],
})
export class ReuseLicenseModule {}

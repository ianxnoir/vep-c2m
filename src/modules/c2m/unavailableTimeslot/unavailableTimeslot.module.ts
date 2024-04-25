import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UnavailableTimeslot } from '../../../entities/unavailableTimeslot.entity';
import { UserMeta } from '../../../entities/userMeta';
import { UnavailableTimeslotService } from './unavailableTimeslot.service';

@Module({
  imports: [TypeOrmModule.forFeature([UnavailableTimeslot, UserMeta])],
  providers: [UnavailableTimeslotService],
  exports: [UnavailableTimeslotService],
})
export class UnavailableTimeslotModule {}

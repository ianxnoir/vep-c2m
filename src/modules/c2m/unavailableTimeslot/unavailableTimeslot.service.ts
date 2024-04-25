import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import moment, { Moment } from 'moment-timezone';
import { Repository, In, Between, InsertResult } from 'typeorm';
import { CreateUnavailableTimeslot } from '../../../dto/createUnavailableTimeslot.dto';
import { UnavailableTimeslot } from '../../../entities/unavailableTimeslot.entity';
import { UserMeta } from '../../../entities/userMeta';
import { UserMetaKey } from './unavailableTimeslot.type';

@Injectable()
export class UnavailableTimeslotService {
  constructor(
    @InjectRepository(UnavailableTimeslot)
    private unavailableTimeslotRepository: Repository<UnavailableTimeslot>,
    @InjectRepository(UserMeta)
    private userMeta: Repository<UserMeta>
  ) {}

  public async remove(entities: UnavailableTimeslot[]): Promise<UnavailableTimeslot[]> {
    return await this.unavailableTimeslotRepository.remove(entities);
  }

  public async findUnavailableTimeslotsByUser(
    ssoUids: string[],
    fairCodes: string[],
    fiscalYears: string[],
    fields: Record<string, any>
  ): Promise<UnavailableTimeslot[]> {
    return this.unavailableTimeslotRepository.find({
      where: {
        ...fields,
        fairCode: In(fairCodes),
        fiscalYear: In(fiscalYears),
        ssoUid: In(ssoUids),
      },
      order: { startTime: 'ASC' },
    });
  }

  public async findUnavailableTimeslotsByUsers(
    ssoUids: string[],
    fairCodes: string[],
    fiscalYears: string[],
    fields: Record<string, any>
  ): Promise<UnavailableTimeslot[]> {
    return this.unavailableTimeslotRepository.find({
      select: ['startTime', 'endTime'],
      where: {
        ...fields,
        fairCode: In(fairCodes),
        fiscalYear: In(fiscalYears),
        ssoUid: In(ssoUids),
      },
      order: { startTime: 'ASC' },
    });
  }

  public async findIsReachedAvailabilityPage(ssoUid: string): Promise<boolean> {
    const userMeta = await this.userMeta.find({
      where: {
        ssoUid,
        key: UserMetaKey.REACHED_AVAILABILITY_PAGE,
        value: '1',
      },
    });

    return !!userMeta.length;
  }

  public async createReachedAvailabilityPageRecord(ssoUid: string): Promise<UserMeta> {
    const newUserMeta = this.userMeta.create({
      ssoUid,
      key: UserMetaKey.REACHED_AVAILABILITY_PAGE,
      value: '1',
      creationTime: new Date(),
      lastUpdatedAt: new Date(),
    });

    return this.userMeta.save(newUserMeta);
  }

  public async deleteUnavailableTimeslots(ssoUid: string, fairCode: string, fiscalYear: string, dates: Array<Moment>): Promise<UnavailableTimeslot[]> {
    const where = dates.map((date: Moment) => {
      const start = date.startOf('D').isAfter() ? date.startOf('D').toDate() : new Date();

      return {
        startTime: Between(start, date.endOf('D').toDate()),
        ssoUid,
        fairCode,
        fiscalYear,
      };
    });

    const unavailableTimeslots = await this.unavailableTimeslotRepository.find({
      where: dates.length ? where : { ssoUid, fairCode },
    });

    return this.unavailableTimeslotRepository.remove(unavailableTimeslots);
  }

  public async createUnavailableTimeslots(ssoUid: string, fairCode: string, fiscalYear: string, timeslots: Array<CreateUnavailableTimeslot>): Promise<any[]> {
    const unavailableTimeslotsData = timeslots.map((data: CreateUnavailableTimeslot) => ({
      fairCode,
      fiscalYear,
      ssoUid,
      startTime: moment(data.startTime).toDate(),
      endTime: moment(data.endTime).toDate(),
      createdBy: ssoUid,
      creationTime: new Date(),
      lastUpdatedBy: ssoUid,
      lastUpdatedAt: new Date(),
    }));

    const promises = Array(Math.ceil(unavailableTimeslotsData.length / 1000))
      .fill(null)
      .map(async (v: any, i: number) => {
        const chunkedTimeslots: any[] = unavailableTimeslotsData.slice(i * 1000, i * 1000 + 1000);

        return this.unavailableTimeslotRepository.insert(chunkedTimeslots);
      });

    const results = await Promise.all(promises);

    return results.flatMap((r: InsertResult) => r.generatedMaps);
  }

  public getUnavailableDate(ssoUid: string, fairCode: string, fiscalYear: string, targetDate: string, nextDate: string): Promise<any> {
    return this.unavailableTimeslotRepository.createQueryBuilder("timeslot")
      .where(`timeslot.ssoUid = "${ssoUid}"`)
      .andWhere(`timeslot.fairCode = "${fairCode}"`)
      .andWhere(`timeslot.fiscalYear = "${fiscalYear}"`)
      .andWhere(`timeslot.startTime >= "${targetDate}" and timeslot.startTime < "${nextDate}"`)
      .getMany();
  }

  public deleteUnavailableDate(ssoUid: string, fairCode: string, fiscalYear: string) {
    return this.unavailableTimeslotRepository.delete({
      ssoUid,
      fairCode,
      fiscalYear
    });
  }

  public saveTimeslotByBatch(entity: UnavailableTimeslot[]) {
    return this.unavailableTimeslotRepository.save(entity, { chunk: 1000 });
  }
  
  public countUnavailableTimeslot(ssoUid: string, fairCode: string, fiscalYear: string) {
    return this.unavailableTimeslotRepository.createQueryBuilder("timeslot")
    .where(`timeslot.ssoUid = "${ssoUid}"`)
    .andWhere(`timeslot.fairCode = "${fairCode}"`)
    .andWhere(`timeslot.fiscalYear = "${fiscalYear}"`)
    .getCount();
  }
}

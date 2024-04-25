import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { FairParticipant } from '../../content/fair/entities/FairParticipant';
import { FairParticipantType } from '../../content/fair/entities/FairParticipantType';
import { FairRegistration } from '../../content/fair/entities/FairRegistration';
import { FairRegistrationStatus } from '../../content/fair/entities/FairRegistrationStatus';
import { SortingOption } from '../cbm.type';

@Injectable()
export class FairService {
  constructor(
    @InjectRepository(FairRegistration, 'fairDatabase')
    private fairRegistrationRepository: Repository<FairRegistration>,
    @InjectRepository(FairRegistrationStatus, 'fairDatabase')
    private fairRegistrationStatusRepository: Repository<FairRegistrationStatus>,
    @InjectRepository(FairParticipantType, 'fairDatabase')
    private fairParticipantTypeRepository: Repository<FairParticipantType>,
    @InjectRepository(FairParticipant, 'fairDatabase')
    private fairParticipantRepository: Repository<FairParticipant>
  ) {}

  public async filterParticipant(
    fairCode: string[],
    fairYear: string,
    filters: Record<string, any>,
    sortings: Record<string, SortingOption> = {},
    selects: (keyof FairParticipant)[] = []
  ): Promise<FairParticipant[]> {
    const { participantTypeCode, fairRegistrationStatusCode, country, branchOffice, ssoUid, emailId } = filters;
    const registrationFilter = { participantTypeCode, fairRegistrationStatusCode, country, branchOffice };
    const fairParticipantIds = (await this.filterRegistration(fairCode, fairYear, registrationFilter, {}, ['fairParticipantId'])).flatMap(
      (item: any) => item.fairParticipantId
    );
    const select = this.buildSelectOption<keyof FairParticipant>(selects);
    const query = this.buildFilterOption({ id: fairParticipantIds, ssoUid, emailId });
    return this.fairParticipantRepository.find({ where: query, select });
  }

  public async filterRegistration(
    fairCode: string[],
    fairYear: string,
    filters: Record<string, any>,
    sortings: Record<string, SortingOption> = {},
    selects: (keyof FairRegistration)[] = []
  ): Promise<FairRegistration[]> {
    const { participantTypeCode, fairRegistrationStatusCode, country, branchOffice } = filters;

    const fairParticipantTypes = await this.getFairParticipantType(participantTypeCode);
    const fairRegistrationStatuses = await this.getFairRegistrationStatus(fairRegistrationStatusCode);

    const registrationFilters = {
      fairCode,
      projectYear: [fairYear],
      addressCountryCode: country,
      fairParticipantTypeId: fairParticipantTypes.map((type: FairParticipantType) => type.id),
      fairRegistrationStatusId: fairRegistrationStatuses.map((status: FairRegistrationStatus) => status.id),
      overseasBranchOffice: branchOffice,
    };

    const frfq: Record<string, any> = this.buildFilterOption(registrationFilters, true);
    const select = this.buildSelectOption<keyof FairRegistration>(selects);
    return await this.fairRegistrationRepository.find({
      where: frfq,
      select,
    });
  }

  public getFairRegistrationIdBySsoUid(ssoUid: string) {
    return this.fairParticipantRepository
      .findOne({ ssoUid })
      .then((result: any) => {
        const fairParticipantId = result.id;
        return this.fairRegistrationRepository.findOne({ fairParticipantId });
      })
      .then((result: any) => {
        return {
          status: 200,
          data: {
            fairRegistration: result.id,
          },
        };
      })
      .catch((error) => {
        return {
          status: 400,
          message: error?.message ? error.message : error
        }
      })
  }

  public async getFairParticipantType(fairParticipantTypeCode: string[]): Promise<FairParticipantType[]> {
    const query = this.buildFilterOption({ fairParticipantTypeCode });
    return this.fairParticipantTypeRepository.find(query);
  }

  public async getFairRegistrationStatus(fairRegistrationStatusCode: string[]): Promise<FairRegistrationStatus[]> {
    const query = this.buildFilterOption({ fairRegistrationStatusCode });
    return this.fairRegistrationStatusRepository.find(query);
  }

  private buildSelectOption<T>(fields: T[]): T[] | undefined {
    return fields.length ? fields : undefined;
  }

  private buildFilterOption(fields: Record<string, Array<any> | undefined>, strict: boolean = false): Record<string, any> {
    let filterQuery: Record<string, any> = {};

    // add filter option if field is not empty
    Object.keys(fields).forEach((key: string) => {
      if (fields[key] !== undefined && fields[key] !== null && (strict || fields[key]?.length)) {
        filterQuery[key] = In(<any[]>fields[key]);
      }
    });
    return filterQuery;
  }
}

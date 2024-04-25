import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Connection, getConnection, Repository } from 'typeorm';
import { VepCouncilGlobalCountry as Country } from '../../content/content/entities/VepCouncilGlobalCountry';
import { VepCouncilGlobalNob as Nob } from '../../content/content/entities/VepCouncilGlobalNob';
import { VepCouncilGlobalOffice as Office } from '../../content/content/entities/VepCouncilGlobalOffice';
import { VepCouncilGlobalTargetMarket as TargetMarket } from '../../content/content/entities/VepCouncilGlobalTargetMarket';
import { VepFairSetting as FairSetting } from '../../content/content/entities/VepFairSetting';

@Injectable()
export class ContentService {
  constructor(
    @InjectRepository(Country, 'contentDatabase')
    private countryRepository: Repository<Country>,
    @InjectRepository(Office, 'contentDatabase')
    private branchOfficeRepository: Repository<Office>,
    @InjectRepository(FairSetting, 'contentDatabase')
    private fairSettingRepository: Repository<FairSetting>,
    @InjectRepository(Nob, 'contentDatabase')
    private nobRepository: Repository<Nob>,
    @InjectRepository(TargetMarket, 'contentDatabase')
    private targetMarketRepository: Repository<TargetMarket>
  ) {}

  public async addConfig(): Promise<any> {
    // reference - addConfig.bak
    const value1 = 'Interval of sending reminder when sending first five AI recommendations and inform buyer during C2M period';
    const value2 = 'DAY';
    const value3 = '1';

    const query = `INSERT INTO vepC2MConfig (fieldName, unit, configValue, lastUpdatedBy, lastUpdatedAt) VALUES ('${value1}', '${value2}', '${value3}', 'jotam','2022-08-08 12:00:00.000000');`;
    const result = await getConnection().query(query);
    return result;
  }

  public async getCountryCode(): Promise<any> {
    return this.countryRepository.find({ select: ['code', 'englishDescription', 'chineseDescriptionTc', 'chineseDescriptionSc'] });
  }

  public async getBranchOfficeCode(): Promise<any> {
    return this.branchOfficeRepository.find({ select: ['officeCode', 'officeDescEn', 'officeDescTc', 'officeDescSc', 'officeType', 'officeTypeDesc'] });
  }

  public async getEoaFair(fairCode: string, fairYear: string): Promise<FairSetting> {
    const fiscalYearFair = await this.fairSettingRepository.findOneOrFail({ faircode: fairCode, metaKey: 'vms_project_year', metaValue: fairYear });
    const { fiscalYear } = fiscalYearFair;
    return this.fairSettingRepository.findOneOrFail({ faircode: fairCode, metaKey: 'eoa_fair_id', fiscalYear });
  }

  // public async getEoaFair(fairCode: string, fiscalYear: string): Promise<FairSetting | undefined> {
  //   return this.fairSettingRepository.findOne({ faircode: fairCode, metaKey: 'eoa_fair_id', fiscalYear });
  // }

  public async getTargetMarketCode(): Promise<any> {
    return this.targetMarketRepository.find({ select: ['code', 'englishDescription', 'chineseDescriptionTc', 'chineseDescriptionSc'] });
  }

  public async getNobCode(): Promise<any> {
    return this.nobRepository.find({ select: ['code', 'englishDescription', 'chineseDescriptionTc', 'chineseDescriptionSc'] });
  }

  public async getAdminId(currentUserEmail: string): Promise<{ adminId: string }[]> {
    const query = `SELECT user_id as adminId FROM vep_admin.user user WHERE email = "${currentUserEmail}"`;

    const connection: Connection = getConnection('contentDatabase');
    const slaveRunner = connection.createQueryRunner('slave');
    return connection.query(query, undefined, slaveRunner)
    .finally(() => {
      slaveRunner.release();
    });
  }

  public async getRoleId(currentUserEmail:string): Promise<{ roleId: number, roleName: string }[]> {
    const query = `SELECT rT.role_id as roleId, rT.name as roleName FROM vep_admin.role rT 
                  INNER JOIN vep_admin.userRole uRT ON uRT.role_id = rT.role_id 
                  INNER JOIN vep_admin.user uT ON uT.user_id = uRT.user_id
                  WHERE uT.email = "${currentUserEmail}"`;
    const connection: Connection = getConnection('contentDatabase');
    const slaveRunner = connection.createQueryRunner('slave');
    return connection.query(query, undefined, slaveRunner)
    .finally(() => {
      slaveRunner.release();
    });
  }

  public async getLatestUserPermission(currentUserEmail: string): Promise<Record<string, any>> {
    const query = `SELECT DISTINCT(rP.permission_id) as permission FROM vep_admin.role rT 
                  INNER JOIN vep_admin.userRole uRT ON uRT.role_id = rT.role_id 
                  INNER JOIN vep_admin.user uT ON uT.user_id = uRT.user_id
                  INNER JOIN vep_admin.rolePermission rP ON rP.role_id = rT.role_id
                  WHERE uT.email = "${currentUserEmail}"`;
    const connection: Connection = getConnection('contentDatabase');
    const slaveRunner = connection.createQueryRunner('slave');
    let result: any[] = [];
    try {
      result = await connection.query(query, undefined, slaveRunner);
    } catch (error) {
      console.log("Error in getLatestUserPermission api", error)
    } finally {
      slaveRunner.release();
    }

    const tempArrayForUserPermission:Record<string, any>[] = [];
    result.map((e:any) => tempArrayForUserPermission.push(e.permission));
    return { permissions: tempArrayForUserPermission.filter((e:any) => +e) };
  }

  public async getFiscalYearListFromFairRegistration(): Promise<Record<string, any>> {
    const query = `
    select Distinct fairCode ,fiscalYear from vepFairDb.fairRegistration
    `;
    const connection = await getConnection('contentDatabase');
    const slaveRunner = connection.createQueryRunner('slave');
    let result: any[] = [];
    try {
      result = await connection.query(query, undefined, slaveRunner);
    } catch (error) {
      console.log("Error in getFiscalYearListFromFairRegistration api", error)
    } finally {
      slaveRunner.release();
    }
    let split:Record<string, any[]> = {};
    for (let i = 0; i < result.length; i++) {
      let p = result[i].fairCode;
      if (!split[p]) {
        split[p] = [];
      }
      split[p]?.push(result[i]);
    }
    return result.reduce((agg:any[], curr:Record<string, any[]>) => {
        let found = <Record<string, any[]>>agg.find((x:any) => x.fairCode === curr.fairCode);
        if (found) {
          found.fiscalYear.push(curr.fiscalYear);
        } else {
           agg.push({
           fairCode: curr.fairCode,
           fiscalYear: [curr.fiscalYear]
           });
        }
        return agg;
        }, []);
  }

  public checkPermission(permissionRequiredArray: number[], userPermissionArray: number[], checkAll: boolean): boolean {
    if (checkAll && permissionRequiredArray.every((v:number) => userPermissionArray.includes(v))) {
      return true;
    }
    if (!checkAll && permissionRequiredArray.some((v:number) => userPermissionArray.includes(v))) {
      return true;
    }
    return false;
  }

  public async getAdminUserList(): Promise<any> {
    const query = 'SELECT name, email, branchOffice FROM vep_admin.user user';
    const connection = await getConnection('contentDatabase');
    const slaveRunner = connection.createQueryRunner('slave');
    try {
      const res: any[] = await connection.query(query, undefined, slaveRunner);
      const adminUserList = res.map((obj:Record<string, any>) => ({
        name: obj.name,
        email: obj.email
      }));
      const branchOfficeList = res.map((obj:Record<string, any>) => obj.branchOffice).filter(
        (obj:string | null) => (obj !== null && obj !== '')
        );
      return {
        status: 200,
        data: {
          adminUserList,
          branchOfficeList: [...new Set(branchOfficeList)],
        }
      };
    } catch (error) {
      return {
        status: 400,
        message: JSON.stringify(error)
      };
    } finally {
      slaveRunner.release();
    }
  }

  public async getCouncilBranchOfficeList(branchOfficeUser:number, branchOffice: string): Promise<any> {
    const andWhere = `AND office_code = '${branchOffice}'`;
    const query = `SELECT office_code, office_desc_en FROM vep_content.vep_council_global_office 
    WHERE office_type != "I" AND office_type != "V" ${branchOfficeUser ? andWhere : ' '} 
    ORDER BY office_desc_en`;
    const connection = await getConnection('contentDatabase');
    const slaveRunner = connection.createQueryRunner('slave');

    try {
      const res: any[] = await connection.query(query, undefined, slaveRunner);
      const councilBranchOfficeList = res.map((obj:Record<string, any>) => ({
        code: obj.office_code,
        label: obj.office_desc_en
      }));
      return {
        status: 200,
        data: {
          branchOfficeList: [...new Set(councilBranchOfficeList)],
        }
      };
    } catch (error) {
      return {
        status: 400,
        message: JSON.stringify(error)
      };
    } finally {
      slaveRunner.release();
    }
  }

  public async getExhibitorSelfSsoUid(ccdid: string): Promise<any> {
    const query = `SELECT companyCcdid, ssoUid from vepExhibitorDb.vepExhibitor where companyCcdid = '${ccdid}'`;
    const connection: Connection = getConnection('contentDatabase');
    const slaveRunner = connection.createQueryRunner('slave');
    try {
      const res: any[] = await connection.query(query, undefined, slaveRunner);
      return {
        status: 200,
        data: {
          res
        }
      };
    } catch (error:any) {
      return {
        status: 400,
        message: JSON.stringify(error)
      };
    } finally {
      slaveRunner.release();
    }
  }
}

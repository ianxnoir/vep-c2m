import { HttpException, HttpService, Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response, NextFunction } from 'express';
import { ApiExhibitorService } from '../modules/api/exhibitor/exhibitor.service';
import { ApiFairService } from '../modules/api/fair/fair.service';

@Injectable()
export class GetExhibitorIDMiddleware implements NestMiddleware {
  private baseUri: string;
  constructor(
    private apiExhibitorService: ApiExhibitorService,
    private httpService: HttpService,
    private configService: ConfigService,
    private apiFairService: ApiFairService,
  ) {
    this.baseUri = this.configService.get<string>('api.FAIR_SERVICE_URI') || '';
  }

  public async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (req.headers['x-email-id'] && req.headers['x-visitor-type']) {
      const { body, baseUrl } = req;
      let { language } = body;

      let fairCodesFromCombinedFair = [];
      let extractedFairCode: string | undefined;
      language = this.getLanguage(language, baseUrl);

      const fairDataResult = await this.httpService.get(`${this.baseUri}/fair/list`).toPromise();
      const fairDataList: any[] | null = fairDataResult?.data?.data;

      !fairDataList?.length && this.throwError("Can't find any active fair");

      const fairCodeList = fairDataList?.map((obj: Record<string, any>) => obj.fairCode);
      extractedFairCode = fairCodeList?.find((element: string) => req.url.includes(`/${element}/`));
      if (!extractedFairCode && req.body.fairCode) {
        extractedFairCode = fairCodeList?.find((element: string) => req.body.fairCode === element);
      }

      !extractedFairCode?.length && this.throwError("Can't get the target fair");

      const result = await this.apiExhibitorService.getExhibitorProfileV3(<string>req.headers['x-email-id']);
      const exhibitorRecords: any[] = result?.data?.data?.records;

      // only throw error when the user states he is "EXHIBITOR"
      (<string>req.headers['x-visitor-type']).toLowerCase() === 'exhibitor' && !exhibitorRecords?.length && this.throwError("Can't get the exhibitor fair record");

      const combinedFairData: Record<string, any>[] = await this.apiFairService.getMultipleFairDatas([extractedFairCode!])
      .then((combinedFairResult: any) => {
        if (!combinedFairResult?.data?.length) {
          return [];
        }
        return (
          combinedFairResult?.data?.length
          && combinedFairResult?.data?.flatMap(
            (fairData: any) => fairData?.relatedFair?.length
              && fairData?.relatedFair?.flatMap((fair: any) => ({
                fairCode: fair.fair_code,
                fiscalYear: fair.fiscal_year,
                fairShortName: language ? fair.fair_short_name?.[language] : fair.fair_short_name?.en,
              }))
          )
        );
      });

      if (combinedFairData?.length) {
        body.combinedFairData = combinedFairData;
        const exhibitorFairCodeList = exhibitorRecords.map((record:any) => record.fairCode);
        fairCodesFromCombinedFair = combinedFairData.map((fair:any) => fair.fairCode).filter((fairCode: any) => exhibitorFairCodeList.includes(fairCode));
      }

      if (fairCodesFromCombinedFair.length) {
        extractedFairCode = fairCodesFromCombinedFair[0];
      }

      const fairCodeIndex = exhibitorRecords.findIndex((record: any) => record.fairCode === extractedFairCode);
      if ((<string>req.headers['x-visitor-type']).toLowerCase() === 'exhibitor') {
        if (!exhibitorRecords?.[0]?.companyCCDID || fairCodeIndex === -1) {
            this.throwError('Can not find exhibitor');
          }
          req.headers['x-secondary-id'] = req.headers['x-sso-uid'];
          // fairCodeIndex change to 0
          req.headers['x-sso-uid'] = exhibitorRecords?.[fairCodeIndex]?.companyCCDID;
        } else if ((<string>req.headers['x-visitor-type']).toLowerCase() !== 'exhibitor') {
          req.headers['x-secondary-id'] = exhibitorRecords?.[fairCodeIndex]?.companyCCDID;
        }
      }

      next();
    }

    private getLanguage(language: string, baseUrl: string): string {
      const languageList = ['en', 'sc', 'tc'];
      if (languageList.includes(language)) {
        return language;
      }

      let targetLanguage = 'en';
      const splitedUrl = baseUrl.split('/');
      splitedUrl.some((param: string) => {
        if (languageList.includes(param)) {
          targetLanguage = param;
          return true;
        }
        return false;
      });
      return targetLanguage;
    }

    private throwError(message: string): void {
      throw new HttpException(message, 401);
    }
  }


/* comment: as once an exh create a meeting in dgp,
and switch to jew buyer, V3 cannot find its ccdid under jew, no meeting will return
and cannot know should use which fair, so rollback to [0]
*/

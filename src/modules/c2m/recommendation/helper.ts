export const esDataRestructurer = (arr: any[]):Record<string, any> => arr.map((exhibitor:any, index:number) => ({
            ...exhibitor,
            id: index + 1,
            exhibitorCompanyName: exhibitor.companyName,
            country: exhibitor.country,
            exhibitorType: exhibitor.exhibitorType,
            numsOfAcceptedMeeting: exhibitor.acceptedMeeting,
            productList: exhibitor.productList, // latestProduct->productNameEn? old= eoa map table
            description: exhibitor.description, // unknown
            nob: exhibitor.nob, // natureofBusinessSymbols?
            eTargetMarket: exhibitor.preferredMarket, // unknown, exhibitorPreferredMarkets or exhibitorCurrentMarkets
            ePreferredNob: exhibitor.preferredNob,
            eAvoidMarket: exhibitor.notPreferredMarket,
            exhibitorFair: exhibitor.exhibitorFair,
            pavilion: exhibitor.pavilion, // code or value?
            zone: exhibitor.zone,
            brand: 'attribute_brandName',
            boothNumber: exhibitor.boothNumber,
            productStrategy: 'need add',
            factoryLocation: 'need add',
            exhibitorName: exhibitor.fullName,
            // from other API
            exhRegDate: '2022-04-03T11:30:00Z',
            //
        }));

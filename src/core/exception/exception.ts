export class VepError extends Error {
    public vepErrorMsg: VepErrorMsgObj;
    public errorDetail: any;
    constructor(vepErrorMsg: VepErrorMsgObj, detail?: any) {
        super(vepErrorMsg?.message);
        this.name = 'VepError';
        this.vepErrorMsg = vepErrorMsg;
        this.errorDetail = detail || '';
    }
}

export type VepErrorObj = Record<string, VepErrorMsgObj>;

export type VepErrorMsgObj = {
    code: string;
    message: string;
    status?: number;
};

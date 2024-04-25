export interface SSOUser {
  ssoUid: string;
  role: string;
  firstName: string;
  lastName: string;
  avatar: string;
  companyName: string;
  country: string;
  companyLogo: string;
  fairCode: string;
  fiscalYear: string;
}

export interface Exhibitor extends SSOUser {
  supplierUrn?: string;
  exhibitorUrn?: string;
}

export interface Buyer extends SSOUser {}

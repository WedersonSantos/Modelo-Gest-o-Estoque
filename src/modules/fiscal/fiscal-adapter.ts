import type { FiscalDraft } from "./fiscal.rules";
/** Authorized providers can implement this contract. Never fetch a user-supplied QR URL. */
export interface FiscalProviderAdapter {
 fetchDocument(accessKey:string,organizationId:string):Promise<FiscalDraft>;
}

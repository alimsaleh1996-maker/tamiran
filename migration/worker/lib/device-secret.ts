import { ReceptionError } from './reception-repository.ts';

function encode(value: Uint8Array): string {
  return btoa(String.fromCharCode(...value)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function decode(value: string): Uint8Array<ArrayBuffer> {
  if(!/^[A-Za-z0-9_-]+$/.test(value))throw new Error('Invalid encoding');
  return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),ch=>ch.charCodeAt(0));
}
function aad(shopId: number, caseUuid: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(`tamiran:device-secret:v1:${shopId}:${caseUuid}`);
}
export async function encryptDeviceSecret(key: CryptoKey,shopId:number,caseUuid:string,secret:string):Promise<string>{
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(shopId,caseUuid)},key,new TextEncoder().encode(secret));
  return `v1.${encode(iv)}.${encode(new Uint8Array(data))}`;
}
export async function decryptDeviceSecret(key:CryptoKey,shopId:number,caseUuid:string,ciphertext:string):Promise<string>{
  try{
    const [version,nonce,payload,...extra]=ciphertext.split('.'),iv=decode(nonce);
    if(version!=='v1'||extra.length||iv.length!==12)throw new Error('Invalid envelope');
    const data=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad(shopId,caseUuid)},key,decode(payload));
    return new TextDecoder().decode(data);
  }catch{throw new ReceptionError('رمز موقت دستگاه قابل بازیابی نیست.',409);}
}

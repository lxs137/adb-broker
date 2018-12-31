const forge = require("node-forge");
const BigInteger = forge.jsbn.BigInteger;
const setRsaPublicKey = forge.pki.setRsaPublicKey;

/**
 * The stucture of an ADB RSAPublicKey is as follows:
 * 
 *     #define RSANUMBYTES 256           // 2048 bit key length
 *     #define RSANUMWORDS (RSANUMBYTES / sizeof(uint32_t))
 * 
 *     typedef struct RSAPublicKey {
 *         int len;                  // Length of n[] in number of uint32_t
 *         uint32_t n0inv;           // -1 / n[0] mod 2^32
 *         uint32_t n[RSANUMWORDS];  // modulus as little endian array
 *         uint32_t rr[RSANUMWORDS]; // R^2 as little endian array
 *         int exponent;             // 3 or 65537
 *     } RSAPublicKey;
 */

const RE = /^((?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?)\0? (.*)\s*$/;

export const parsePublicKey = (buffer: Buffer): Promise<any> => {
  return new Promise((resolve, reject) => {
    const match = RE.exec(<any>buffer);
    if(!match) {
      reject("Unrecognizable public key format");
    }
    let key;
    try {
      key = readPublicKey(new Buffer(match[1], "base64"), match[2]);
    } catch(err) {
      reject(err);
    }
    resolve(key);
  });
};

const readPublicKey = (data: Buffer, comment: string): any => {
  if(!data.length)
    throw new Error("Invalid public key");
  let offset = 0;
  const len = data.readUInt32LE(offset) * 4;
  offset += 4;
  if(data.length !== 12 + 2 * len) 
    throw new Error("Invalid public key");
  
  // skip n0inv
  offset += 4;

  const n = new Buffer(len);
  data.copy(n, 0, offset, offset + len);
  n.reverse();
  offset += len;

  // skip rr
  offset += len;

  const e = data.readUInt32LE(offset);
  if(e !== 3 && e !== 65537)
    throw new Error(`Invalid exponent ${e}, only 3 and 65537 are supported`);
  
  const key = setRsaPublicKey(
    new BigInteger(n.toString("hex"), 16), 
    new BigInteger(e.toString(), 10));

  const md = forge.md.md5.create();
  md.update(data.toString("binary"));
  key.fingerprint = md.digest().toHex().match(/../g).join(":");
  key.comment = comment;
  return key;
};
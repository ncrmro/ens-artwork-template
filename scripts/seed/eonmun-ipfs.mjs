import fs from 'node:fs';
import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';
const works=JSON.parse(fs.readFileSync('src/eonmun-import.json'));
const assets={};
async function put(bytes){const cid=CID.createV1(0x55,await sha256.digest(bytes)).toString();fs.writeFileSync('public/ipfs/'+cid,bytes);return 'ipfs://'+cid;}
for(const w of works){const r=await fetch(w.imageURI,{signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error(w.title+': '+r.status);const bytes=Buffer.from(await r.arrayBuffer());if(bytes.length>24*1024*1024)throw Error('Image exceeds Worker asset limit');const image=await put(bytes);const previous=JSON.parse(fs.readFileSync('public/ipfs/'+w.manifestURI.slice(7)));const manifest=await put(Buffer.from(JSON.stringify({...previous,image})));assets[w.id]={image,manifest};console.log(w.title,bytes.length,image);}
fs.writeFileSync('src/eonmun-ipfs-assets.json',JSON.stringify(assets,null,2)+'\n');

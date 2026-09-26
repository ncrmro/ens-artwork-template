import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';
const bucket=process.env.FILEBASE_BUCKET;
if(!bucket) throw Error('Set FILEBASE_BUCKET and configure AWS credentials outside the repository.');
const ipfs=process.env.IPFS_BIN||'ipfs';
const awsArgs=['--endpoint-url','https://s3.filebase.com','--region','us-east-1','s3api'];
const aws=(args)=>JSON.parse(execFileSync('aws',[...awsArgs,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']})||'{}');
const uris=new Set();
function collect(value){if(typeof value==='string'&&value.startsWith('ipfs://'))uris.add(value);else if(value&&typeof value==='object')Object.values(value).forEach(collect);}
for(const file of ['src/seed-assets.json','src/named-assets.json','src/eonmun-ipfs-assets.json'])collect(JSON.parse(fs.readFileSync(file)));
fs.mkdirSync('.local/ipfs-cars',{recursive:true});
const records=[];
for(const uri of uris){
 const cid=uri.slice(7),file='public/ipfs/'+cid,bytes=fs.readFileSync(file);
 if(CID.createV1(0x55,await sha256.digest(bytes)).toString()!==cid)throw Error('CID mismatch: '+cid);
 const key=cid+'.car';let metadata;
 try{metadata=aws(['head-object','--bucket',bucket,'--key',key]).Metadata;}catch{}
 if(!metadata){
  const imported=execFileSync(ipfs,['block','put','--format=raw','--pin',file],{encoding:'utf8'}).trim();
  if(imported!==cid)throw Error('Local IPFS CID mismatch');
  const car=path.resolve('.local/ipfs-cars',key);
  fs.writeFileSync(car,execFileSync(ipfs,['dag','export',cid],{maxBuffer:32*1024*1024}));
  aws(['put-object','--bucket',bucket,'--key',key,'--body',car,'--metadata','import=car','--content-type','application/vnd.ipld.car']);
  metadata=aws(['head-object','--bucket',bucket,'--key',key]).Metadata;
 }
 const normalized=Object.fromEntries(Object.entries(metadata).map(([k,v])=>[k.toLowerCase(),v]));
 if(normalized.cid!==cid)throw Error('Filebase returned a different CID: '+cid);
 records.push({cid,bytes:bytes.length,status:normalized['pinning-status']||'unknown'});
 console.log(cid,records.at(-1).status);
}
fs.mkdirSync('output',{recursive:true});fs.writeFileSync('output/filebase-pins.json',JSON.stringify({bucket,checkedAt:new Date().toISOString(),records},null,2));
console.log('Verified '+records.length+' preserved CIDs.');

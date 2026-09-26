import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CID} from 'multiformats/cid';
import {sha256} from 'multiformats/hashes/sha2';
import assets from '../src/named-assets.json';
import sources from '../src/artwork-sources.json';
test('public-domain image and manifest bytes match their immutable IPFS CIDs',async()=>{
 const values=new Set<string>();
 function collect(value:any){if(typeof value==='string'&&value.startsWith('ipfs://'))values.add(value.slice(7));else if(value&&typeof value==='object')Object.values(value).forEach(collect);}
 collect(assets);
 for(const cid of values){const bytes=fs.readFileSync('public/ipfs/'+cid);assert.equal(CID.createV1(0x55,await sha256.digest(bytes)).toString(),cid);assert.ok(bytes.length<1048576,'Raw image blocks fit normal IPFS block limits');}
 assert.equal(new Set(Object.values(assets.images)).size,3,'Three different artwork images');
 for(const source of sources){assert.ok(source.source.startsWith('https://'));assert.ok(source.artist&&source.license);const cid=(assets.images as any)[source.id].slice(7);const bytes=fs.readFileSync('public/ipfs/'+cid);assert.equal(bytes[0],0xff);assert.equal(bytes[1],0xd8,'Image is a JPEG, not an error page');}
});

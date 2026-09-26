import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';
import { withEonmunArtworks, eonmunAssets } from '../src/eonmun-import.js';
import originals from '../src/eonmun-import.json';
test('EON MUN import is additive, repeatable and preserves checkpoint records', async()=>{
  const existing={id:'existing',title:'Already minted'};
  const catalogue={participants:[{parent:'eonmun.eth',name:'EON MUN'}],works:[existing]};
  const result=withEonmunArtworks(catalogue);
  assert.equal(result.works[0],existing);
  assert.equal(result.works.length,6);
  assert.deepEqual(withEonmunArtworks(result),result);
  for(const w of originals){
    assert.ok(result.works.some((x: any)=>x.id===w.id&&x.artist==='EON MUN'));
    const asset=(eonmunAssets as any)[w.id];
    const bytes=fs.readFileSync('public/ipfs/'+asset.manifest.slice(7));
    assert.equal('ipfs://'+CID.createV1(0x55,await sha256.digest(bytes)),asset.manifest);
    const metadata=JSON.parse(bytes.toString());
    assert.equal(metadata.name,w.title);
    assert.equal(metadata.image,asset.image);
    assert.ok(asset.image.startsWith("ipfs://"));
  }
});

test('repair only updates invalid media pins for unsubmitted mints', async()=>{
  const {repairEonmunMediaPins,legacyEonmunAssets}=await import('../src/eonmun-import.js');
  const {keccak256,stringToHex}=await import('viem');
  const digest=(value:unknown)=>keccak256(stringToHex(JSON.stringify(value)));
  const id=originals[0].id, key='media:'+id;
  const old=digest((legacyEonmunAssets as any)[id]);
  const fresh={pins:{[key]:old},transactions:{}};
  repairEonmunMediaPins(fresh);
  assert.equal(fresh.pins[key],digest((eonmunAssets as any)[id]));
  const submitted={pins:{[key]:old},transactions:{['mint.'+id]:{hash:'0x123'}}};
  repairEonmunMediaPins(submitted);
  assert.equal(submitted.pins[key],old);
});

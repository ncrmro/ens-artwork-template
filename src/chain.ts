import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseAbi,
  encodeFunctionData,
  decodeFunctionResult,
  namehash,
  toHex,
  type Address,
  type EIP1193Provider,
  type Abi,
  type Hex,
} from "viem";
import { sepolia } from "viem/chains";
import { normalize, packetToBytes } from "viem/ens";
import { CID } from "multiformats/cid";
import { bytesToHex } from "viem";
import artifacts from "./generated/contracts.json";
export { sepolia, normalize };
export const chainId = 11155111;
export const client = createPublicClient({
  chain: sepolia,
  transport: http("/api/rpc", { batch: true }),
});
export const contracts = artifacts as Record<
  string,
  { abi: Abi; bytecode: Hex }
>;
export const parentAbi = parseAbi([
  "function findOwner(string label) view returns(address)",
  "function findExpiry(string label) view returns(uint64)",
  "function getSubregistry(string label) view returns(address)",
  "function setSubregistry(uint256 anyId,address subregistry)",
]);
export type Config = {
  name: string;
  parentName: string;
  chainId: number;
  rpcUrl: string;
  registry: string;
  sale: string;
  example: string;
  ipfsGateway: string;
  ens: { ETHRegistry: Address; LabelStore: Address };
  ensSourceCommit: string;
};
export function contentHash(cid: string): Hex {
  const parsed = CID.parse(cid.replace(/^ipfs:\/\//, ""));
  return bytesToHex(new Uint8Array([0xe3, 0x01, ...parsed.toV1().bytes]));
}
export function validateParent(name: string) {
  const n = normalize(name);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.eth$/.test(n))
    throw Error("Use one lowercase .eth parent label.");
  return n;
}
export async function wallet() {
  const provider = (window as Window & { ethereum?: EIP1193Provider }).ethereum;
  if (!provider)
    throw Error(
      "Open this page in a wallet browser or install an Ethereum wallet. No Burner is required.",
    );
  const w = createWalletClient({ chain: sepolia, transport: custom(provider) });
  const [account] = await w.requestAddresses();
  if ((await w.getChainId()) !== chainId) await w.switchChain({ id: chainId });
  if ((await w.getChainId()) !== chainId)
    throw Error("Switch your wallet to Ethereum Sepolia.");
  return { w, account };
}
export async function receipt(hash: Hex) {
  const r = await client.waitForTransactionReceipt({ hash });
  if (r.status !== "success")
    throw Error("Transaction reverted. See its Sepolia receipt.");
  return r;
}

export async function resolveContent(name: string): Promise<Hex> {
  const abi = parseAbi([
    "function contenthash(bytes32 node) view returns(bytes)",
  ]);
  const normalized = normalize(name);
  const [data] = await client.readContract({
    address: sepolia.contracts.ensUniversalResolver.address,
    abi: parseAbi([
      "function resolveWithGateways(bytes name, bytes data, string[] gateways) view returns(bytes,address)",
    ]),
    functionName: "resolveWithGateways",
    args: [
      toHex(packetToBytes(normalized)),
      encodeFunctionData({
        abi,
        functionName: "contenthash",
        args: [namehash(normalized)],
      }),
      [],
    ],
  });
  return decodeFunctionResult({ abi, functionName: "contenthash", data });
}

import {
  createPublicClient,
  defineChain,
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
export let chainId = 11155111;
let activeChain = sepolia as import("viem").Chain;
let resolverAddress: Address = sepolia.contracts.ensUniversalResolver.address;
export let client = createPublicClient({
  chain: sepolia,
  transport: http("/api/rpc", { batch: true }),
});
export function configureChain(config: Config) {
  if (![11155111, 31337].includes(config.chainId))
    throw Error("Unsupported network");
  chainId = config.chainId;
  activeChain =
    chainId === 31337
      ? defineChain({
          id: 31337,
          name: "Local ENSv2",
          nativeCurrency: { name: "Test Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: { default: { http: [config.rpcUrl] } },
        })
      : sepolia;
  resolverAddress =
    config.ens.UniversalResolver ||
    sepolia.contracts.ensUniversalResolver.address;
  client = createPublicClient({
    chain: activeChain as typeof sepolia,
    pollingInterval: chainId === 31337 ? 200 : 4000,
    transport: http("/api/rpc", { batch: true }),
  });
}
export const contracts = artifacts as Record<
  string,
  { abi: Abi; bytecode: Hex }
>;
export const parentAbi = parseAbi([
  "function getResource(uint256 anyId) view returns(uint256)",
  "function hasRoles(uint256 resource,uint256 roleBitmap,address account) view returns(bool)",
  "function findOwner(string label) view returns(address)",
  "function findExpiry(string label) view returns(uint64)",
  "function getSubregistry(string label) view returns(address)",
  "function setSubregistry(uint256 anyId,address subregistry)",
]);
export type Lifecycle = {
  namespace: string;
  artwork: string;
  mandates: string;
  settlement: string;
  galleryNamespace: string;
  galleryRegistry: string;
  galleryParentName: string;
};
export type Config = {
  projectName: string;
  gallerySiteUrl: string;
  siteView?: string;
  lifecycle: Lifecycle;
  name: string;
  parentName: string;
  chainId: number;
  rpcUrl: string;
  registry: string;
  sale: string;
  example: string;
  ipfsGateway: string;
  ens: {
    ETHRegistry: Address;
    LabelStore: Address;
    UniversalResolver?: Address;
  };
  localDemo?: {
    runId: string;
    transactions?: { action: string; hash: string; blockNumber: number }[];
    accounts: Record<string, Address>;
    context: Record<string, string>;
  };
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
  const provider =
    localProvider ||
    (window as Window & { ethereum?: EIP1193Provider }).ethereum;
  if (!provider)
    throw Error(
      "Open this page in a wallet browser or install an Ethereum wallet. No Burner is required.",
    );
  const w = createWalletClient({
    chain: activeChain,
    transport: custom(provider),
  });
  const [account] = await w.requestAddresses();
  if ((await w.getChainId()) !== chainId) {
    try {
      await w.switchChain({ id: chainId });
    } catch (e: any) {
      if (e.code !== 4902) throw e;
      await w.addChain({ chain: activeChain });
      await w.switchChain({ id: chainId });
    }
  }
  if ((await w.getChainId()) !== chainId)
    throw Error("Switch your wallet to the configured network.");
  return { w, account };
}
export async function receipt(hash: Hex) {
  const r = await client.waitForTransactionReceipt({ hash });
  if (r.status !== "success")
    throw Error("Transaction reverted. See its receipt.");
  return r;
}

export async function resolveContent(name: string): Promise<Hex> {
  const abi = parseAbi([
    "function contenthash(bytes32 node) view returns(bytes)",
  ]);
  const normalized = normalize(name);
  const [data] = await client.readContract({
    address: resolverAddress,
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

let localProvider: EIP1193Provider | undefined;
export function selectLocalWallet(account: Address) {
  if (chainId !== 31337) throw Error("Local wallets require chain 31337");
  localProvider = {
    request: async ({ method, params }: any) => {
      if (method === "eth_accounts" || method === "eth_requestAccounts")
        return [account];
      if (method === "eth_chainId") return "0x7a69";
      if (method === "wallet_switchEthereumChain") {
        if (params[0].chainId !== "0x7a69") throw Error("Local demo only");
        return null;
      }
      if (
        method === "eth_sendTransaction" &&
        params?.[0]?.from?.toLowerCase() !== account.toLowerCase()
      )
        throw Error("Wrong local account");
      const res = await fetch("/api/local-wallet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const data: any = await res.json();
      if (!res.ok || data.error)
        throw Error(data.error?.message || data.error || "Local RPC failed");
      return data.result;
    },
  } as EIP1193Provider;
}

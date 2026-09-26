import {
  createPublicClient,
  http,
  keccak256,
  stringToHex,
  zeroAddress,
  type Address,
} from "viem";
import { sepolia } from "viem/chains";
import { parentAbi, type Config } from "./chain";
export const ADMIN_NAME = "ncrmro.eth";
export const sameAddress = (a?: string, b?: string) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();
export function adminClient(config: Config) {
  return createPublicClient({
    chain: { ...sepolia, id: config.chainId },
    transport: http("/api/rpc"),
    pollingInterval: config.chainId === 31337 ? 100 : 2000,
  });
}
export async function adminIdentity(pc: any, root: Address) {
  const [owner, expiry, block] = await Promise.all([
    pc.readContract({
      address: root,
      abi: parentAbi,
      functionName: "findOwner",
      args: ["ncrmro"],
    }),
    pc.readContract({
      address: root,
      abi: parentAbi,
      functionName: "findExpiry",
      args: ["ncrmro"],
    }),
    pc.getBlock(),
  ]);
  if (owner === zeroAddress || expiry <= block.timestamp)
    throw Error("ncrmro.eth is not currently registered on this network.");
  return owner as Address;
}
export async function canSetSubregistry(
  pc: any,
  root: Address,
  label: string,
  account: Address,
) {
  const resource = await pc.readContract({
    address: root,
    abi: parentAbi,
    functionName: "getResource",
    args: [BigInt(keccak256(stringToHex(label)))],
  });
  return pc.readContract({
    address: root,
    abi: parentAbi,
    functionName: "hasRoles",
    args: [resource, 1n << 20n, account],
  });
}

import { parseAbi, zeroAddress, isAddress, type Address } from "viem";
import { normalize } from "viem/ens";
import staticIndex from "./browse-index.json";
import { type Config, parentAbi } from "./chain";
export type NamespaceEntry = {
  name: string;
  displayName: string;
  settlement: string;
  registry?: string;
  wallet?: string;
};
export async function resolveParticipant(
  pc: any,
  root: Address,
  name: string,
): Promise<Address> {
  const n = normalize(name);
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*){0,3}\.eth$/.test(
      n,
    )
  )
    throw Error("Use a valid .eth namespace.");
  let registry = root;
  for (const label of n.split(".").slice(0, -1).reverse()) {
    registry = await pc.readContract({
      address: registry,
      abi: parentAbi,
      functionName: "getSubregistry",
      args: [label],
    });
    if (registry === zeroAddress) return zeroAddress;
  }
  return registry;
}
export async function publicNamespaces(
  pc: any,
  c: Config,
): Promise<NamespaceEntry[]> {
  if (c.localDemo?.catalogueIndex) return c.localDemo.catalogueIndex;
  const fallback: NamespaceEntry[] =
    staticIndex.chainId === c.chainId ? staticIndex.namespaces : [];
  try {
    const registry = await resolveParticipant(
      pc,
      c.ens.ETHRegistry,
      "ncrmro.eth",
    );
    if (registry === zeroAddress) return fallback;
    const value = await pc.readContract({
      address: registry,
      abi: parseAbi(["function catalogue() view returns(string)"]),
      functionName: "catalogue",
    });
    if (value.length > 8192) return fallback;
    const index = JSON.parse(value);
    if (
      index.chainId !== c.chainId ||
      !Array.isArray(index.namespaces) ||
      index.namespaces.length < 1 ||
      index.namespaces.length > 50
    )
      return fallback;
    const entries: NamespaceEntry[] = index.namespaces;
    if (
      !entries.every(
        (n) =>
          typeof n.name === "string" &&
          /^(art|exhibitions)\.[a-z0-9.-]+\.eth$/.test(n.name) &&
          typeof n.displayName === "string" &&
          n.displayName.length <= 128 &&
          isAddress(n.registry || "") &&
          isAddress(n.wallet || "") &&
          (n.settlement === "" || isAddress(n.settlement)),
      )
    )
      return fallback;
    return [
      ...entries,
      ...fallback.filter((n) => !entries.some((e) => e.name === n.name)),
    ];
  } catch {
    return fallback;
  }
}

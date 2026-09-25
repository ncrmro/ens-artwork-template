import config from "../artist.config.json";
// Public endpoint used by the official ENS beta app. Candidates are verified onchain before setup.
export async function walletNames(url: URL): Promise<Response> {
  const address = url.searchParams.get("address") || "";
  const skip = Number(url.searchParams.get("skip") || 0);
  const after = url.searchParams.get("after");
  if (
    !/^0x[0-9a-fA-F]{40}$/.test(address) ||
    !Number.isSafeInteger(skip) ||
    skip < 0 ||
    skip > 10000 ||
    (after?.length || 0) > 256
  )
    return Response.json(
      { error: "Invalid address or cursor" },
      { status: 400 },
    );
  try {
    const r = await fetch("https://staging-graphql.ens.dev/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        query:
          "query($a:String!,$r:String!,$skip:Int!,$after:String){domains(first:100,skip:$skip,where:{owner:$a,registry:$r}){name} roleConnection(first:100,after:$after,account:$a,contract:$r){edges{node{name}} pageInfo{hasNextPage endCursor}}}",
        variables: {
          a: address.toLowerCase(),
          r: config.ens.ETHRegistry,
          skip,
          after,
        },
      }),
    });
    const x = (await r.json()) as any;
    if (!r.ok || x.errors || !x.data?.roleConnection)
      throw Error("Indexer unavailable");
    const names = [
      ...new Set<string>(
        [
          ...x.data.domains,
          ...x.data.roleConnection.edges.map((e: any) => e.node),
        ]
          .map((d: any) => d.name)
          .filter(
            (n: any) =>
              typeof n === "string" &&
              /^[a-z0-9]+(?:-[a-z0-9]+)*\.eth$/.test(n),
          ),
      ),
    ].sort();
    return Response.json(
      {
        names,
        nextSkip: x.data.domains.length === 100 ? skip + 100 : null,
        nextAfter: x.data.roleConnection.pageInfo.hasNextPage
          ? x.data.roleConnection.pageInfo.endCursor
          : null,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json(
      {
        error:
          "ENS name discovery is temporarily unavailable. Retry or check a name manually.",
      },
      { status: 502 },
    );
  }
}

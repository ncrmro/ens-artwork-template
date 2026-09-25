import fs from "node:fs";
import solc from "solc";
const files = fs.readdirSync("contracts").filter((x) => x.endsWith(".sol"));
const sources = Object.fromEntries(
  files.map((f) => [
    "contracts/" + f,
    { content: fs.readFileSync("contracts/" + f, "utf8") },
  ]),
);
const result = JSON.parse(
  solc.compile(
    JSON.stringify({
      language: "Solidity",
      sources,
      settings: {
        viaIR: true,
        optimizer: { enabled: true, runs: 200 },
        evmVersion: "cancun",
        outputSelection: {
          "*": {
            "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"],
          },
        },
      },
    }),
    {
      import(path) {
        for (const f of [path, "node_modules/" + path])
          if (fs.existsSync(f)) return { contents: fs.readFileSync(f, "utf8") };
        return { error: "Missing " + path };
      },
    },
  ),
);
for (const e of result.errors ?? []) console.error(e.formattedMessage);
if (result.errors?.some((e) => e.severity === "error")) process.exit(1);
fs.mkdirSync("src/generated", { recursive: true });
const artifacts = {};
for (const f of files)
  for (const [name, c] of Object.entries(
    result.contracts["contracts/" + f] ?? {},
  )) {
    if (!c.evm.bytecode.object) continue;
    const size = c.evm.deployedBytecode.object.length / 2;
    if (size > 24576) throw Error(name + " exceeds EIP-170");
    artifacts[name] = { abi: c.abi, bytecode: "0x" + c.evm.bytecode.object };
    console.log(name + ": " + size + " runtime bytes");
  }
fs.writeFileSync("src/generated/contracts.json", JSON.stringify(artifacts));

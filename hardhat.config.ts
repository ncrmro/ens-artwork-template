import { defineConfig } from "hardhat/config";
import hardhatViem from "@nomicfoundation/hardhat-viem";
export default defineConfig({
  plugins: [hardhatViem],
  networks: {
    unit: { type: "edr-simulated", chainType: "l1", chainId: 11155111 },
  },
});

import axios from "axios";
import { Chain, chainToPlatform, chains } from "@wormhole-foundation/sdk-connect";

const registryUrl = (chain: Chain) =>
  `https://raw.githubusercontent.com/cosmos/chain-registry/master/${chain.toLowerCase()}/chain.json`;

(async function () {
  const cosmosChains = chains.filter((chain) => chainToPlatform(chain) === "Cosmwasm");

  const chainToFees = new Map<Chain, [string, number]>();
  for (const chain of cosmosChains) {
    const url = registryUrl(chain);
    console.log(url);
    try {
      const { data } = await axios.get(url);
      const fees = data["fees"];
      const feeToken = fees["fee_tokens"][0];
      chainToFees.set(chain, [feeToken["denom"], feeToken["average_gas_price"]]);
    } catch (e) {
      console.error("Could not fetch registry entry for:", chain);
    }
  }

  console.log(chainToFees);
})();

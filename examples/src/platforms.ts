import { blindDeserializePayload, loadProtocols } from "@wormhole-foundation/sdk";
import evm from "@wormhole-foundation/sdk/platforms/evm";

(async function () {
  await loadProtocols(evm, ["TokenBridge", "WormholeCore"]);

  const platform = new evm.Platform("Mainnet");
  const ethereum = platform.getChain("Ethereum");
  const core = await ethereum.getWormholeCore();
  const [msg] = await core.parseMessages(
    "0xee0faa8eaf0f0acf7c6835f35fd4e58fb57d74a3f6dcf4067acc02aca1dd3916",
  );
  console.log(blindDeserializePayload(msg!.payload));

  const sepolia = evm.getChain("Testnet", "Sepolia", {
    rpc: "https://eth-sepolia-public.unifra.io",
  });
  const tb = await sepolia.getTokenBridge();
  const address = await tb.getWrappedNative();
  console.log(address.toString());
})();

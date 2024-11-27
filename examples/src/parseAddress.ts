import { toNative, toUniversal } from "@wormhole-foundation/sdk";

const ETHEREUM_ADDRESS = '0xaaee1a9723aadb7afa2810263653a34ba2c21c7a';
const ETHEREUM_ADDRESS_UNIVERSAL = toUniversal('Ethereum', ETHEREUM_ADDRESS).toString();

(async function () {
  // We can parse an Ethereum address from its native or universal format
  const parsedEthereumAddr1 = toNative('Ethereum', ETHEREUM_ADDRESS);
  const parsedEthereumAddr2 = toNative('Ethereum', ETHEREUM_ADDRESS_UNIVERSAL);
  console.log(parsedEthereumAddr1);
  console.log(parsedEthereumAddr2);

  // Parsing a Sui address as Ethereum will throw:
  try {
    toNative('Ethereum', '0xabd62c91e3bd89243c592b93b9f45cf9f584be3df4574e05ae31d02fcfef67fc');
  } catch (e) {
    console.error(e);
  }
})();


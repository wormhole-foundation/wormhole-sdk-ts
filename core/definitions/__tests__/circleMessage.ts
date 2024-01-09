import { deserializeLayout, circle, encoding, contracts } from "@wormhole-foundation/sdk-base";
import { UniversalAddress } from "../src";
import { circleMessageLayout } from "../src/payloads/circleBridge";

const ethAddressToUniversal = (address: string) => {
  return new UniversalAddress("00".repeat(12) + address.slice(2));
};

describe("Circle Message tests", function () {
  it("should correctly deserialize a circle message", function () {
    // log taken from here: https://goerli.etherscan.io/tx/0x45938c1c491b066c967a75c9a959ed5d1ae6d014b819517ad4d8a63f34b988be
    const _orig =
      "0000000000000000000000010000000000039826000000000000000000000000d0c3da58f55358142b8d3e06c1c30c5c6114efe8000000000000000000000000eb08f243e5d3fcff26a9e38ae5520a669f4019d000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000007865c6e87b9f70255377e024ace6630c1eaa37f0000000000000000000000006603b4a7e29dfbdb6159c395a915e74757c1fb1300000000000000000000000000000000000000000000000000000000000f42400000000000000000000000006603b4a7e29dfbdb6159c395a915e74757c1fb13";
    const orig = encoding.hex.decode(_orig);

    const fromChain = "Ethereum";
    const toChain = "Avalanche";

    // same sender and receiver
    const accountSender = ethAddressToUniversal("0x6603b4a7e29dfbdb6159c395a915e74757c1fb13");

    const actualSender = ethAddressToUniversal(
      contracts.circleContracts("Testnet", fromChain).tokenMessenger,
    );
    const actualReceiver = ethAddressToUniversal(
      contracts.circleContracts("Testnet", toChain).tokenMessenger,
    );

    const tokenAddress = ethAddressToUniversal(circle.usdcContract("Testnet", fromChain));

    const decoded = deserializeLayout(circleMessageLayout, orig);
    expect(decoded.sourceDomain).toEqual(fromChain);
    expect(decoded.destinationDomain).toEqual(toChain);
    expect(decoded.nonce).toEqual(235558n);
    expect(decoded.sender.equals(actualSender)).toBeTruthy();
    expect(decoded.recipient.equals(actualReceiver)).toBeTruthy();

    const decodedPayload = decoded.payload;
    expect(decodedPayload.amount).toEqual(1000000n);
    expect(decodedPayload.burnToken.equals(tokenAddress)).toBeTruthy();
    expect(decodedPayload.mintRecipient.equals(accountSender)).toBeTruthy();
    expect(decodedPayload.messageSender.equals(accountSender)).toBeTruthy();
  });
});

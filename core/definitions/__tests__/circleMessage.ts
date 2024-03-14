import { deserializeLayout, circle, encoding, contracts } from "@wormhole-foundation/sdk-base";
import { UniversalAddress } from "./../src/index.js";
import { circleMessageLayout } from "./../src/protocols/circleBridge/index.js";

const ethAddressToUniversal = (address: string) => {
  return new UniversalAddress("00".repeat(12) + address.slice(2));
};

describe("Circle Message tests", function () {
  it("should correctly deserialize a circle message", function () {
    // log taken from here: https://testnet.snowtrace.io/tx/0x348eba20452040c1fc2b86399d634ddfdd647c29b2ab22ab23e173fc3d23ff78/eventlog?chainId=43113
    const _orig =
      "0x0000000000000001000000060000000000049360000000000000000000000000eb08f243e5d3fcff26a9e38ae5520a669f4019d00000000000000000000000009f3b8679c73c2fef8b59b4f3444d4e156fb70aa50000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000005425890298aed601595a70ab815c96711a31bc650000000000000000000000006603b4a7e29dfbdb6159c395a915e74757c1fb1300000000000000000000000000000000000000000000000000000000000027100000000000000000000000006603b4a7e29dfbdb6159c395a915e74757c1fb13";

    const orig = encoding.hex.decode(_orig);

    const fromChain = "Avalanche";
    const fromChainDomain = circle.circleChainId("Testnet", fromChain);
    const toChain = "BaseSepolia";
    const toChainDomain = circle.circleChainId("Testnet", toChain);

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
    expect(decoded.sourceDomain).toEqual(fromChainDomain);
    expect(decoded.destinationDomain).toEqual(toChainDomain);
    expect(decoded.nonce).toEqual(299872n);
    expect(decoded.sender.equals(actualSender)).toBeTruthy();
    expect(decoded.recipient.equals(actualReceiver)).toBeTruthy();

    const decodedPayload = decoded.payload;
    expect(decodedPayload.amount).toEqual(10000n);
    expect(decodedPayload.burnToken.equals(tokenAddress)).toBeTruthy();
    expect(decodedPayload.mintRecipient.equals(accountSender)).toBeTruthy();
    expect(decodedPayload.messageSender.equals(accountSender)).toBeTruthy();
  });
});

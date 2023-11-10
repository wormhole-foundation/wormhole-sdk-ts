import { APTOS_COIN, AptosAddress } from "../../src";

describe("Cosmwasm Address Tests", () => {
    describe("Parse Address", () => {
        test("An address parses", () => {
            let address = new AptosAddress(
                APTOS_COIN,
            );
            expect(address).toBeTruthy();

            address = new AptosAddress(
                "0xc90949fd7ff3c13fd0b586a10547b5ca1212edc2c170e368d1dea00c01fea62b"
            );
            expect(address).toBeTruthy();
        });

        test("An invalid address is rejected", () => {
            expect(() => new AptosAddress("bogus")).toThrow();
        });
    });
});

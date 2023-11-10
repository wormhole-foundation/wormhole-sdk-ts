import { APTOS_COIN, AptosAddress } from "../../src";

describe("Cosmwasm Address Tests", () => {
    describe("Parse Address", () => {
        test("An address parses", () => {
            let address = new AptosAddress(
                APTOS_COIN,
            );
            expect(address).toBeTruthy();
            expect(address.toString()).toEqual(APTOS_COIN)

            const acctAddress = "0xc90949fd7ff3c13fd0b586a10547b5ca1212edc2c170e368d1dea00c01fea62b"
            address = new AptosAddress(
                acctAddress
            );
            expect(address).toBeTruthy();
            expect(address.toString()).toEqual(acctAddress)
        });

        test("An invalid address is rejected", () => {
            expect(() => new AptosAddress("bogus")).toThrow();
        });
    });
});

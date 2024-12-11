# Solana Platform Code

Here is all the code for the Solana Platform. It is divided in 3 sections:

- In `address.ts`, `chain.ts`, `platform.ts`, `signer.ts`, `types.ts`, `unsignedTransaction.ts`, there
  are the implementation of the Wormhole core interfaces. The structure is the same as in the EVM
  code.
- The `utils` folder holds a lot of utilities being useful when writing a SDK or calling a program.
  Among them is `bpfLoaderUpgradeable` which allows to interact with this program.
- The `testing` folder holds:
  - A big helper class `TestsHelper` allowing to do everything that is desirable in an integration
    tests package.
  - 2 classes allowing to interact with the Wormhole Core program and the Token Bridge one in a testing
    environment. They can be instanciated from `TestsHelper` which is supposed to be the class
    allowing to do everything.

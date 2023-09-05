# General Structure

## Unit Tests

All packages should have a `__test__` directory with unit tests for the package.

## Platforms

All platforms should also have the tests broken into `__test__/integration`, `__tests__/mocks`,  `__test__/unit` directories.

The `__test__/integration` directory should contain tests that test the calls using RPCs to the blockchain. 

The `__test__/mocks` directory should contain mocks for things like RPCs and Signers that are Platform specific

## Fixtures

Each platform should have a `__test__/integration/fixtures` directory that contains fixtures for complex blockchain data structures

Using nock, we can gather the request/responses and using jest.mock, mock the RPC calls to return the fixtures.  This allows us to test the code without having to make RPC calls to the blockchain.


## End-to-End Tests

The root `__tests__` directory should contain end-to-end tests with things like balance checks before and after

jest.mock('ethers', () => {
  const actualEthers = jest.requireActual('ethers');
  return {
    ...actualEthers,
    getDefaultProvider: jest.fn().mockImplementation(() => {
      return {
        getNetwork: jest.fn().mockReturnValue({ chainId: 1 }),
      };
    }),
  };
});

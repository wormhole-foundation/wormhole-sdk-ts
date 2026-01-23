# Portico protocol

In order to provide a more useful token on the destination chain,
the input token may be converted prior to bridging and converted
again on the destination chain.

## Example:

Convert 1 ETH on Optimism to 1 Eth on Arbitrum.

```
Notation Key:
  Function(token) -> token
  Chain[token name]
```

### Step 1

On Optimism

- Wrap(Optimism[Eth]) -> Optimism[wETH]
- Convert(Optimism[wETH]) -> Optimism[xETH]
- WormholeTransferToken(Optimism[xETH])

### Step 2

Off Chain

- Guardians observe events, sign VAA
- Automatic Relayer listening submits transaction

### Step 3

On Arbitrum

- WormholeRedeemTransfer(VAA) -> Arbitrum[xETH]
- Convert(Arbitrum[xETH]) -> Arbitrum[wETH]
- Unwrap(wETH) -> ETH

The current table of input tokens, to bridging tokens,
to final tokens is as follows

```
| inputs           | 'native' | ETH | wETH  |  wstETH |  USDT |
| bridging token   |           xETH         | xwstETH | xUSDT |
| outputs          | 'native' | ETH | wETH  |  wstETH |  USDT |
```

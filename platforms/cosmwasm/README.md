Cosmwasm
--------


Stuff that idk what to do about yet


# RPC

Right now, getRpc on the `Platform` type is sync,  but the cosmjs client `connect` method is async. what do?


# Addresses

Contract addresses are 32 bytes

"Regular" addresses are 20 bytes

Each chain has its own special prefix


# Transfers into cosmos 

Some knowledge of cosmos payload format is required to format the message correctly. This is somewhat similar to the need to understand Solana ATAs for transferring to Solana.

# Transfers between cosmos chains

No attestation will be created since no VAA is created so `fetchAttestation` is a noop?




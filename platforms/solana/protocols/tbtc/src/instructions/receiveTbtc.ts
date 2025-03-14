/*
  const { hash, emitterAddress, emitterChain, sequence } =
    parseTokenTransferVaa(signedVAA);
  const recipient = new PublicKey(payer);
  const custodian = getCustodianPDA(gatewayProgramId);
  const program = new Program(WormholeGatewayIdl, gatewayProgramId, {
    connection,
  });
  const custodianData = await program.account.custodian.fetch(custodian);
  const tbtcMint = new PublicKey(custodianData.tbtcMint as PublicKeyInitData);
  const wrappedTbtcToken = new PublicKey(
    custodianData.wrappedTbtcToken as PublicKeyInitData,
  );
  const wrappedTbtcMint = new PublicKey(
    custodianData.wrappedTbtcMint as PublicKeyInitData,
  );
  const recipientTokenKey = await getAssociatedTokenAddress(
    tbtcMint,
    recipient,
  );
  const transaction = new Transaction();
  const recipientToken = await connection.getAccountInfo(recipientTokenKey);
  if (!recipientToken) {
    // Create the tBTC token account if it doesn't exist yet
    const recipientTokenAtaIx = createAssociatedTokenAccountInstruction(
      recipient,
      recipientTokenKey,
      recipient,
      tbtcMint,
    );
    transaction.add(recipientTokenAtaIx);
  }
  const tokenBridgeWrappedAsset = deriveWrappedMetaKey(
    tokenBridgeProgramId,
    wrappedTbtcMint,
  );
  const recipientWrappedToken = await getAssociatedTokenAddress(
    wrappedTbtcMint,
    recipient,
  );
  const accounts = {
    payer: recipient,
    custodian,
    postedVaa: derivePostedVaaKey(coreBridgeProgramId, hash),
    tokenBridgeClaim: deriveClaimKey(
      tokenBridgeProgramId,
      emitterAddress,
      emitterChain,
      sequence,
    ),
    wrappedTbtcToken,
    wrappedTbtcMint,
    tbtcMint,
    recipientToken: recipientTokenKey,
    recipient,
    recipientWrappedToken,
    tbtcConfig: getConfigPDA(),
    tbtcMinterInfo: getMinterInfoPDA(custodian),
    tokenBridgeConfig: deriveTokenBridgeConfigKey(tokenBridgeProgramId),
    tokenBridgeRegisteredEmitter: deriveEndpointKey(
      tokenBridgeProgramId,
      emitterChain,
      emitterAddress,
    ),
    tokenBridgeWrappedAsset,
    tokenBridgeMintAuthority: deriveMintAuthorityKey(tokenBridgeProgramId),
    rent: SYSVAR_RENT_PUBKEY,
    tbtcProgram: TBTC_PROGRAM_ID,
    tokenBridgeProgram: tokenBridgeProgramId,
    coreBridgeProgram: coreBridgeProgramId,
  };
  const receiveTbtcIx = await program.methods
    .receiveTbtc(hash)
    .accounts(accounts)
    .instruction();
  return transaction.add(receiveTbtcIx);
  */

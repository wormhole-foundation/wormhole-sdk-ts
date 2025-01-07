export interface TokenDataId {
  /** Token creator address */
  creator: string;

  /** Unique name within this creator's account for this Token's collection */
  collection: string;

  /** Name of Token */
  name: string;
}

export interface TokenId {
  token_data_id: TokenDataId;

  /** version number of the property map */
  property_version: string;
}

export type TokenBridgeState = {
  consumed_vaas: {
    elems: {
      handle: string;
    };
  };
  emitter_cap: {
    emitter: string;
    sequence: string;
  };
  governance_chain_id: {
    number: string;
  };
  governance_contract: {
    external_address: string;
  };
  native_infos: {
    handle: string;
  };
  registered_emitters: {
    handle: string;
  };
  signer_cap: {
    account: string;
  };
  wrapped_infos: {
    handle: string;
  };
};

export type OriginInfo = {
  token_address: {
    external_address: string;
  };
  token_chain: {
    number: string; // lol
  };
};

export type CreateTokenDataEvent = {
  version: string;
  guid: {
    creation_number: string;
    account_address: string;
  };
  sequence_number: string;
  type: "0x3::token::CreateTokenDataEvent";
  data: {
    description: string;
    id: TokenDataId;
    maximum: string;
    mutability_config: {
      description: boolean;
      maximum: boolean;
      properties: boolean;
      royalty: boolean;
      uri: boolean;
    };
    name: string;
    property_keys: [string];
    property_types: [string];
    property_values: [string];
    royalty_payee_address: string;
    royalty_points_denominator: string;
    royalty_points_numerator: string;
    uri: string;
  };
};

export type DepositEvent = {
  version: string;
  guid: {
    creation_number: string;
    account_address: string;
  };
  sequence_number: string;
  type: "0x3::token::DepositEvent";
  data: {
    amount: string;
    id: TokenId;
  };
};

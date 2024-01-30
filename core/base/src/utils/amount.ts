/**
 * Converts a human friendly decimal number to base units as an integer
 *
 * @param amount The decimal number as a string to convert into base units
 * @param decimals the number of decimals to normalize to
 * @returns The amount converted to base units as a BigNumber
 */
export function normalizeAmount(amount: number | string, decimals: number | bigint): bigint {
  return baseUnits(parseAmount(amount, Number(decimals)));
}

export interface Amount {
  // This is stored as a string as opposed to bigint so that Amount is JSON-compatible 🙃
  amount: string;
  decimals: number;
};

/**
 * Parses a string or number into an Amount, given a decimal level
 * @param amount The string or number to parse
 * @param decimals The number of decimals for the token this amount is of
 * @returns An Amount, expressed as base units and decimals
 */
export function parseAmount(amount: string | number, decimals: number): Amount {
  validateAmountInput(amount, decimals);

  amount = amount.toString();

  // TODO :)
  if (amount.includes('e')) throw new Error('Scientific notation is not supported yet by Amount');

  const chunks = amount.split(".");
  if (chunks.length > 2) throw "Too many decimals";

  let [whole, partial] =
    chunks.length === 0 ? ["0", ""] : chunks.length === 1 ? [chunks[0], ""] : chunks;

  // Strip trailing zeroes
  while (partial.length < decimals) partial += '0';

  let amountStr = whole + partial;

  while (amountStr!.length > 1 && amountStr?.startsWith('0')) {
    amountStr = amountStr.substring(1)
  }

  return { amount: amountStr, decimals }
}

/**
 * Directly creates an Amount given the base units and decimal level
 * @param amount Amount expressed as base units
 * @param decimals The number of decimals for the token this amount is of
 * @returns An Amount, expressed as base units and decimals
 */
export function amountFromBaseUnits(amount: bigint, decimals: number): Amount {
  return { amount: amount.toString(), decimals }
}

/**
 * Returns the base units from an Amount, as a bigint
 * @param amount An Amount
 * @returns A bigint, representing the base units for the Amount
 */
export function baseUnits(amount: Amount): bigint {
  validateAmount(amount);
  return BigInt(amount.amount)
}

/**
 * Formats an Amount as a human-readable string
 * @param amount An Amount
 * @param precision Number of decimal places to render
 * @returns A string representing the Amount as a fixed point number
 */
export function displayAmount(amount: Amount, precision?: number): string {
  validateAmount(amount);

  let whole = amount.amount.substring(0, amount.amount.length - amount.decimals);
  let partial = amount.amount.substring(amount.amount.length - amount.decimals);

  while (partial.length < amount.decimals) {
    partial = '0' + partial;
  }

  if (typeof precision === 'number') {
    while (precision > partial.length) {
      partial += '0';
    }
  }

  if (whole.length === 0) whole = '0';

  if (partial.length > 0) {
    return `${whole}.${partial}`;
  } else {
    return whole;
  }
}

function validateAmountInput(amount: number | string, decimals: number): void {
  if (typeof amount === 'number') {
    if (!isFinite(amount)) throw new Error("Amount: invalid input. Amount must be finite");
    if (amount < 0) throw new Error('Amount: invalid input. Amount cannot be negative');
  } else {
    if (!/^[0-9\.]*$/.test(amount)) {
      throw new Error('Amount: invalid input. Must only contain digits.');
    }
  }

  if (!isFinite(decimals)) {
    throw new Error('Amount: invalid input. Decimals must be finite');
  }
}

function validateAmount(amount: Amount): void {
  if (!/^[0-9]*$/.test(amount.amount)) {
    throw new Error('Amount: invalid input. Must only contain digits.');
  }
  if (amount.decimals < 0) {
    throw new Error('Amount: invalid input. Decimals must be >= 0');
  }
  if (!isFinite(amount.decimals)) {
    throw new Error('Amount: invalid input. Decimals must be a finite number.');
  }
}

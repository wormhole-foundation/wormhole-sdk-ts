/**
 * Converts a human friendly decimal number to base units as an integer
 *
 * @param amount The decimal number as a string to convert into base units
 * @param decimals the number of decimals to normalize to
 * @returns The amount converted to base units as a BigNumber
 */
export function normalizeAmount(amount: number | string, decimals: bigint): bigint {
  // If we're passed a number, convert it to a string first
  // so we can do everything as bigints
  if (typeof amount === "number") amount = amount.toPrecision();

  // punting
  if (amount.includes("e")) throw new Error(`Exponential detected:  ${amount}`);

  // some slightly sketchy string manip

  const chunks = amount.split(".");
  if (chunks.length > 2) throw "Too many decimals";

  const [whole, partial] =
    chunks.length === 0 ? ["0", ""] : chunks.length === 1 ? [chunks[0], ""] : chunks;

  if (partial && partial.length > decimals)
    throw new Error(`Overspecified decimal amount: ${partial.length} > ${decimals}`);

  // combine whole and partial without decimals
  const amt = BigInt(whole + partial);

  // adjust number of decimals to account for decimals accounted for
  // when we remove the decimal place for amt
  decimals -= BigInt(partial.length);

  // finally, produce the number in base units
  return amt * 10n ** decimals;
}

/**
 * Converts a bigint amount to a friendly decimal number as a string
 *
 * @param amount The number of units as a bigint to convert into the display amount
 * @param decimals the number of decimals in the displayAmount
 * @returns The amount converted to a nice display string
 */
export function displayAmountOld(amount: bigint, decimals: bigint, displayDecimals: bigint): string {
  // first scale to remove any partial amounts but allowing for full
  // precision required by displayDecimals
  const amt = amount / 10n ** (decimals - displayDecimals);
  const numDec = Number(displayDecimals);
  // Final scaling then use the builtin `Number.tofixed` for formatting display amount
  return (Number(amt) / 10 ** numDec).toFixed(numDec);
}




export interface Amount {
  amount: string;
  decimals: number;
};

export function amount(amount: string | number, decimals: number) {
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

export function baseUnits(amount: Amount): bigint {
  validateAmount(amount);
  return BigInt(amount.amount)
}

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

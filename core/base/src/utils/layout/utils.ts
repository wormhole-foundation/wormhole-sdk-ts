export const checkUint8ArraySize = (custom: Uint8Array, size: number): void => {
  if (custom.length !== size)
    throw new Error(
      `binary size mismatch: layout size: ${custom.length}, data size: ${size}`
    );
}

export const checkNumEquals = (custom: number | bigint, data: number | bigint): void => {
  if (custom != data)
    throw new Error(
      `value mismatch: (constant) layout value: ${custom}, data value: ${data}`
    );
}

export const checkUint8ArrayDeeplyEqual = (custom: Uint8Array, data: Uint8Array): void => {
  checkUint8ArraySize(custom, data.length);

  for (let i = 0; i < custom.length; ++i)
    if (custom[i] !== data[i])
      throw new Error(
        `binary data mismatch: layout value: ${custom}, data value: ${data}`
      );
}

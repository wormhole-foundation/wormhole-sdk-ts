import { jest } from "@jest/globals";
const vaaBytes =
  "AQAAAAABAFF+Nf18NSYNieW1ScgE+mB8aQwT38tJfMhfcP9tpIvINkjrdoXQHDRdFvBoLU0e9ubPDXCJ5cfstpBv7Oa/WecAZSV4BAAAAAAACGJB/9wDK2k7+4VEhY8EA97Iby4XIK+fNPjWX+V0tiOMAAAAAAAAF2EAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADJ6zttAAAAAAAAAAAAAAAAu98b+5NUusWMNKhaKUmCvK8+XJwAAgAAAAAAAAAAAAAAAIVCzopf6Qwm6UA2xnYjuVOvQ+dyAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";
const sucessfulResponse = {
  status: 200,
  data: {
    vaaBytes,
  },
};

const notFoundResponse = {
  status: 404,
  data: {
    code: 5,
    message: "requested VAA not found in store",
    details: [] as any[],
  },
};

let nextGet: jest.Mock = jest.fn().mockResolvedValue(sucessfulResponse);

// ESM: use unstable_mockModule (jest.mock isn't usable under ESM). The SDK does
// `import axios from "axios"` and calls axios.get/axios.isAxiosError, so the mock must
// provide a `default` export. This file is imported first by the test, so the mock is
// registered before connect (and thus axios) loads.
const actualAxios = jest.requireActual("axios") as any;
const realAxios = actualAxios.default ?? actualAxios;

jest.unstable_mockModule("axios", () => ({
  default: { ...realAxios, get: () => nextGet() },
}));

export const givenSignedVaaNotFound = () => {
  nextGet = jest.fn().mockRejectedValue(notFoundResponse);
};

export const givenSignedVaaRequestWorksAfterRetry = () => {
  nextGet = jest
    .fn()
    .mockRejectedValueOnce(notFoundResponse)
    .mockResolvedValueOnce(sucessfulResponse);
};

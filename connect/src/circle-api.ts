import axios from "axios";
import { retry } from "./tasks.js";

// Note: mostly ripped off from https://github.com/circlefin/cctp-sample-app/blob/master/src/services/attestationService.ts
export const CIRCLE_RETRY_INTERVAL = 2000;

export enum CircleAttestationStatus {
  complete = "complete",
  pending_confirmations = "pending_confirmations",
}

export interface CircleAttestationResponse {
  attestation: string | null;
  status: CircleAttestationStatus;
}
export interface Attestation {
  message: string | null;
  status: CircleAttestationStatus;
}

const mapCircleAttestation = (attestationResponse: CircleAttestationResponse) => ({
  message: attestationResponse.attestation,
  status: attestationResponse.status,
});

export async function getCircleAttestation(
  circleApi: string,
  msgHash: string,
): Promise<string | null> {
  const url = `${circleApi}/${msgHash}`;
  try {
    const response = await axios.get<CircleAttestationResponse>(url);
    const attestation = mapCircleAttestation(response?.data);
    return attestation.message === "PENDING" ? null : attestation.message;
  } catch (error) {
    if (!error) return null;
    if (typeof error === "object") {
      // A 404 error means the VAA is not yet available
      // since its not available yet, we return null signaling it can be tried again
      if (axios.isAxiosError(error) && error.response?.status === 404) return null;
      if ("status" in error && error.status === 404) return null;
    }

    throw error;
  }
}

export async function getCircleAttestationWithRetry(
  circleApi: string,
  msgHash: string,
  timeout: number,
): Promise<string | null> {
  const task = () => getCircleAttestation(circleApi, msgHash);
  return retry<string>(task, CIRCLE_RETRY_INTERVAL, timeout, "Circle:GetAttestation");
}

export async function checkCircleGeoblock(): Promise<{
  success: false;
  error: Error;
} | null> {
  try {
    const url = "https://api.circle.com/ping";

    await axios.get<{
      status?: string;
      message?: string;
    }>(url, { timeout: 5000 });
    return null; // No error, continue with quote
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 403 || error.response?.status === 451) {
        return {
          success: false,
          error: new Error(
            "You are attempting a transfer from a location that is restricted by Circle.",
          ),
        };
      }
    }
    // Other errors are non-blocking, continue with quote
    return null;
  }
}

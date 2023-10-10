import axios from "axios";

// Note: mostly ripped off from https://github.com/circlefin/cctp-sample-app/blob/master/src/services/attestationService.ts

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

const mapCircleAttestation = (
  attestationResponse: CircleAttestationResponse,
) => ({
  message: attestationResponse.attestation,
  status: attestationResponse.status,
});

export async function getCircleAttestation(
  circleApi: string,
  msgHash: string,
): Promise<Attestation | null> {
  const url = `${circleApi}/${msgHash}`;
  try {
    const response = await axios.get<CircleAttestationResponse>(url);
    const attestation = mapCircleAttestation(response?.data);

    // Found but still pending
    if (attestation.message === "PENDING") return null;

    return attestation;
  } catch (error) {
    if (!(axios.isAxiosError(error) && error?.response?.status === 404)) {
      console.error(error);
    }
    return null;
  }
}

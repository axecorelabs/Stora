// Shared vocabulary for the two failure modes every dashboard API call
// can hit, so a vendor sees one honest, consistent message instead of a
// raw browser string or a bare "Internal server error" with no next step.

export const GENERIC_SERVER_ERROR_MESSAGE =
  "Something went wrong on our end. Please try again -- if this keeps happening, contact support.";

export const NETWORK_ERROR_MESSAGE =
  "Couldn't reach the server. Check your connection and try again.";

// fetch() rejects with a TypeError specifically for network-level
// failures (offline, DNS, dropped connection) -- it never throws
// TypeError for an HTTP error status, which goes through the
// !response.ok branch instead and carries the server's own message.
export function isNetworkError(error) {
  return error instanceof TypeError;
}

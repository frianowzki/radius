import { initiateUserControlledWalletsClient } from "@circle-fin/user-controlled-wallets";

export const CIRCLE_USER_WALLET_CHAIN = process.env.CIRCLE_USER_WALLET_CHAIN || "ARC-TESTNET";
export const CIRCLE_USER_WALLET_ACCOUNT_TYPE = process.env.CIRCLE_USER_WALLET_ACCOUNT_TYPE || "EOA";

export function getCircleUserWalletsClient() {
  const apiKey = process.env.CIRCLE_API_KEY;
  if (!apiKey) {
    throw new Error("CIRCLE_API_KEY is not configured");
  }

  return initiateUserControlledWalletsClient({ apiKey });
}

export function normalizeCircleUserId(value: unknown) {
  const userId = String(value ?? "").trim();
  if (userId.length < 5) {
    throw new Error("User ID must be at least 5 characters");
  }
  if (userId.length > 64) {
    throw new Error("User ID must be 64 characters or less");
  }
  if (!/^[a-zA-Z0-9._:@-]+$/.test(userId)) {
    throw new Error("User ID can only contain letters, numbers, dot, underscore, colon, @, or dash");
  }
  return userId;
}

export function normalizeUserToken(value: unknown) {
  const userToken = String(value ?? "").trim();
  if (!userToken) throw new Error("Missing user token");
  return userToken;
}

export function circleErrorMessage(error: unknown) {
  const maybeResponse = error as { response?: { data?: { message?: string; code?: number }; status?: number }; message?: string };
  const code = maybeResponse.response?.data?.code;
  const message = maybeResponse.response?.data?.message || maybeResponse.message || "Circle request failed";
  return { message, code, status: maybeResponse.response?.status };
}

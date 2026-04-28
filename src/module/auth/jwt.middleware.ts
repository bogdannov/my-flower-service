import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Config } from "../config/Config";
import { UnauthorizedError } from "../errors";

export interface JwtPayload {
  sub: string;
  iss: string;
  aud: string | string[];
  exp: number;
  iat: number;
}

// Used only for local development / serverless-offline.
// In production, API Gateway verifies the JWT before the Lambda is invoked.
export async function verifyJwt(token: string, config: Config): Promise<JwtPayload> {
  const { AUTH0_DOMAIN, AUTH0_AUDIENCE } = config.get();

  try {
    const JWKS = createRemoteJWKSet(new URL(`https://${AUTH0_DOMAIN}/.well-known/jwks.json`));

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://${AUTH0_DOMAIN}/`,
      audience: AUTH0_AUDIENCE,
    });

    return payload as unknown as JwtPayload;
  } catch {
    throw new UnauthorizedError("Invalid or expired token");
  }
}

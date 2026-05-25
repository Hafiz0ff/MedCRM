export type JwtPortalPayload = {
  sub: string; // patient portal account id
  phone_e164: string;
  session_id: string;
};

export type AuthenticatedPortalUser = {
  accountId: string;
  phoneE164: string;
  sessionId: string;
};

import passport from "@outlinewiki/koa-passport";
import { Strategy as SamlStrategy } from "@node-saml/passport-saml";
import Router from "koa-router";
import type { Request } from "koa";

import { slugifyDomain } from "@shared/utils/domains";
import { parseEmail } from "@shared/utils/email";
import accountProvisioner from "@server/commands/accountProvisioner";
import { AuthenticationError } from "@server/errors";
import passportMiddleware from "@server/middlewares/passport";
import type { User } from "@server/models";
import type { AuthenticationResult } from "@server/types";
import {
  getTeamFromContext,
  getClientFromOAuthState,
  getUserFromOAuthState,
} from "@server/utils/passport";
import { createContext } from "@server/context";
import env from "../env";

const router = new Router();

function samlGroups(profile: Record<string, unknown>) {
  const keys = [
    "groups",
    "memberOf",
    "http://schemas.xmlsoap.org/claims/Group",
    "http://schemas.microsoft.com/ws/2008/06/identity/claims/groups",
  ];
  for (const key of keys) {
    const raw = profile[key];
    if (raw === undefined || raw === null) {
      continue;
    }
    const list = Array.isArray(raw) ? raw : [raw];
    return list.map((item) => String(item));
  }
  return [];
}

if (env.SAML_SSO_ENDPOINT && env.SAML_CERT) {
  const strategy = new SamlStrategy(
    {
      callbackUrl: `${env.URL}/auth/saml.callback`,
      entryPoint: env.SAML_SSO_ENDPOINT,
      issuer: env.URL,
      idpCert: env.SAML_CERT.replace(/\\n/g, "\n"),
      identifierFormat:
        "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
      wantAssertionsSigned: true,
      passReqToCallback: true,
    },
    async function (
      req: Request,
      profile: Record<string, unknown> | null | undefined,
      done: (
        err: Error | null,
        user: User | null,
        result?: AuthenticationResult
      ) => void
    ) {
      try {
        if (!profile) {
          throw AuthenticationError(
            "SAML assertion was invalid or missing fields, please check your configuration"
          );
        }

        const rawProfile = profile as Record<string, unknown>;
        const emailValue =
          rawProfile[env.SAML_EMAIL_ATTRIBUTE] ?? rawProfile.email;
        const email = Array.isArray(emailValue)
          ? String(emailValue[0] ?? "")
          : typeof emailValue === "string"
            ? emailValue
            : "";
        const nameValue =
          rawProfile[env.SAML_USERNAME_ATTRIBUTE] ??
          rawProfile.displayName ??
          rawProfile.name ??
          email;

        if (!email || !email.includes("@")) {
          throw AuthenticationError(
            "SAML assertion was invalid or missing fields, please check your configuration"
          );
        }

        const context = req.ctx;
        const team = await getTeamFromContext(context);
        const client = getClientFromOAuthState(context);
        const existingUser =
          context.state?.auth?.user ?? (await getUserFromOAuthState(context));

        const result = await accountProvisioner(
          createContext({
            user: existingUser,
            ip: context.ip,
            transaction: context.state?.transaction,
          }),
          {
            team: {
              name: env.APP_NAME,
              domain: parseEmail(email).domain,
              subdomain: slugifyDomain(parseEmail(email).domain),
            },
            user: {
              name: Array.isArray(nameValue)
                ? String(nameValue[0] ?? email)
                : typeof nameValue === "string"
                  ? nameValue
                  : email,
              email,
            },
            authenticationProvider: {
              name: "saml",
              providerId: env.SAML_SSO_ENDPOINT,
            },
            authentication: {
              providerId: email,
              scopes: [],
              accessToken: JSON.stringify(samlGroups(rawProfile)),
            },
          }
        );

        return done(null, result.user, { ...result, client, team });
      } catch (err) {
        return done(err as Error, null);
      }
    },
    function (_req: Request, _profile, done) {
      done(null);
    }
  );

  passport.use("saml", strategy);

  router.get("saml", passport.authenticate("saml"));
  router.post("saml.callback", passportMiddleware("saml"));
  router.get("saml.callback", passportMiddleware("saml"));
}

export default router;

import type { AuthenticationProviderSettings } from "@shared/types";
import type {
  ExternalGroupData,
  GroupSyncProvider,
} from "@server/utils/GroupSyncProvider";

/**
 * SAML has no OAuth access token. The ACS handler serializes assertion groups
 * into the authentication accessToken field so this provider can apply them.
 */
export class SamlGroupSyncProvider implements GroupSyncProvider {
  useGroupClaim = true;

  async fetchUserGroups(
    accessToken: string,
    _settings: AuthenticationProviderSettings
  ): Promise<ExternalGroupData[]> {
    try {
      const parsed = JSON.parse(accessToken) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed
        .map((item) => {
          if (typeof item === "string") {
            return { id: item, name: item };
          }
          if (
            item &&
            typeof item === "object" &&
            "id" in item &&
            "name" in item
          ) {
            return {
              id: String((item as { id: unknown }).id),
              name: String((item as { name: unknown }).name),
            };
          }
          return null;
        })
        .filter((item): item is ExternalGroupData => item !== null);
    } catch {
      return [];
    }
  }
}

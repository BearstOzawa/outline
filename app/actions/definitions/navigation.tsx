import {
  HomeIcon,
  SearchIcon,
  ArchiveIcon,
  TrashIcon,
  SettingsIcon,
  KeyboardIcon,
  EmailIcon,
  LogoutIcon,
  ProfileIcon,
  BrowserIcon,
  ShapesIcon,
  DraftsIcon,
  ImportIcon,
  SparklesIcon,
} from "outline-icons";
import { TeamPreference } from "@shared/types";
import { isMac } from "@shared/utils/browser";
import stores from "~/stores";
import type SearchQuery from "~/models/SearchQuery";
import KeyboardShortcuts from "~/scenes/KeyboardShortcuts";
import {
  createAction,
  createExternalLinkAction,
  createInternalLinkAction,
} from "~/actions";
import { NavigationSection, RecentSearchesSection } from "~/actions/sections";
import Desktop from "~/utils/Desktop";
import {
  homePath,
  searchPath,
  draftsPath,
  archivePath,
  trashPath,
  settingsPath,
} from "~/utils/routeHelpers";

export const navigateToHome = createInternalLinkAction({
  name: ({ t }) => t("Home"),
  analyticsName: "Navigate to home",
  section: NavigationSection,
  shortcut: ["d"],
  icon: <HomeIcon />,
  to: homePath(),
  visible: ({ location }) => location.pathname !== homePath(),
});

export const navigateToRecentSearchQueryActionFactory = (
  searchQuery: SearchQuery
) =>
  createInternalLinkAction({
    section: RecentSearchesSection,
    name: searchQuery.query,
    analyticsName: "Navigate to recent search query",
    icon: <SearchIcon />,
    to: searchPath({ query: searchQuery.query }),
  });

export const navigateToDrafts = createInternalLinkAction({
  name: ({ t }) => t("Drafts"),
  analyticsName: "Navigate to drafts",
  section: NavigationSection,
  icon: <DraftsIcon />,
  to: draftsPath(),
  visible: ({ location }) => location.pathname !== draftsPath(),
});

export const askWorkspaceAI = createAction({
  name: ({ t }) => t("Ask AI"),
  analyticsName: "Ask workspace AI",
  section: NavigationSection,
  icon: <SparklesIcon />,
  visible: ({ stores }) =>
    !!stores.auth.team?.getPreference(TeamPreference.AIAnswers),
  perform: async ({ stores, t }) => {
    const { default: AskAI } = await import("../../../plugins/ee/client/AskAI");
    stores.dialogs.openModal({
      title: t("Ask AI"),
      width: "640px",
      height: "min(80vh, 720px)",
      content: <AskAI />,
    });
  },
});

export const navigateToSearch = createInternalLinkAction({
  name: ({ t }) => t("Search"),
  analyticsName: "Navigate to search",
  section: NavigationSection,
  icon: <SearchIcon />,
  to: searchPath(),
  visible: ({ location }) => location.pathname !== searchPath(),
});

export const navigateToArchive = createInternalLinkAction({
  name: ({ t }) => t("Archive"),
  analyticsName: "Navigate to archive",
  section: NavigationSection,
  shortcut: ["g", "a"],
  icon: <ArchiveIcon />,
  to: archivePath(),
  visible: ({ location }) => location.pathname !== archivePath(),
});

export const navigateToTrash = createInternalLinkAction({
  name: ({ t }) => t("Trash"),
  analyticsName: "Navigate to trash",
  section: NavigationSection,
  icon: <TrashIcon />,
  to: trashPath(),
  visible: ({ location }) => location.pathname !== trashPath(),
});

export const navigateToSettings = createInternalLinkAction({
  name: ({ t }) => t("Settings"),
  analyticsName: "Navigate to settings",
  section: NavigationSection,
  shortcut: ["g", "s"],
  icon: <SettingsIcon />,
  visible: () => stores.policies.abilities(stores.auth.team?.id || "").update,
  to: settingsPath(),
});

export const navigateToWorkspaceSettings = createInternalLinkAction({
  name: ({ t }) => t("Settings"),
  analyticsName: "Navigate to workspace settings",
  section: NavigationSection,
  icon: <SettingsIcon />,
  visible: () => stores.policies.abilities(stores.auth.team?.id || "").update,
  to: settingsPath("details"),
});

/**
 * Only visible to workspaces that appear to be newly created and have little
 * content of their own, so it is intentionally not a root navigation action.
 */
export const navigateToImport = createInternalLinkAction({
  name: ({ t }) => t("Import docs"),
  analyticsName: "Navigate to import",
  section: NavigationSection,
  icon: <ImportIcon />,
  visible: () =>
    stores.policies.abilities(stores.auth.team?.id || "").createImport &&
    stores.collections.all.length === 1 &&
    stores.documents.all.length < 10,
  to: settingsPath("import"),
});

export const navigateToProfileSettings = createInternalLinkAction({
  name: ({ t }) => t("Profile"),
  analyticsName: "Navigate to profile settings",
  section: NavigationSection,
  iconInContextMenu: false,
  icon: <ProfileIcon />,
  to: settingsPath(),
});

export const navigateToTemplateSettings = createInternalLinkAction({
  name: ({ t }) => t("Templates"),
  analyticsName: "Navigate to template settings",
  section: NavigationSection,
  iconInContextMenu: false,
  icon: <ShapesIcon />,
  to: settingsPath("templates"),
});

export const navigateToNotificationSettings = createInternalLinkAction({
  name: ({ t, isMenu }) =>
    isMenu ? t("Notification settings") : t("Notifications"),
  analyticsName: "Navigate to notification settings",
  section: NavigationSection,
  iconInContextMenu: false,
  icon: <EmailIcon />,
  to: settingsPath("notifications"),
});

export const navigateToAccountPreferences = createInternalLinkAction({
  name: ({ t }) => t("Preferences"),
  analyticsName: "Navigate to account preferences",
  section: NavigationSection,
  iconInContextMenu: false,
  icon: <SettingsIcon />,
  to: settingsPath("preferences"),
});

export const toggleSidebar = createAction({
  name: ({ t }) => t("Toggle sidebar"),
  analyticsName: "Toggle sidebar",
  keywords: "hide show navigation",
  section: NavigationSection,
  perform: () => stores.ui.toggleCollapsedSidebar(),
});

export const openKeyboardShortcuts = createAction({
  name: ({ t }) => t("Keyboard shortcuts"),
  analyticsName: "Open keyboard shortcuts",
  section: NavigationSection,
  shortcut: ["?"],
  iconInContextMenu: false,
  icon: <KeyboardIcon />,
  perform: ({ t }) => {
    stores.dialogs.openGuide({
      title: t("Keyboard shortcuts"),
      content: <KeyboardShortcuts />,
    });
  },
});

export const downloadApp = createExternalLinkAction({
  name: ({ t }) =>
    t("Download {{ platform }} app", {
      platform: isMac ? "macOS" : "Windows",
    }),
  analyticsName: "Download app",
  section: NavigationSection,
  iconInContextMenu: false,
  icon: <BrowserIcon />,
  visible: () => false,
  url: "https://desktop.getoutline.com",
  target: "_blank",
});

export const logout = createAction({
  name: ({ t }) => t("Log out"),
  analyticsName: "Log out",
  section: NavigationSection,
  icon: <LogoutIcon />,
  perform: async () => {
    await stores.auth.logout({
      userInitiated: true,
      clearCache: true,
    });
  },
});

export const rootNavigationActions = [
  navigateToHome,
  askWorkspaceAI,
  navigateToDrafts,
  navigateToArchive,
  navigateToTrash,
  downloadApp,
  openKeyboardShortcuts,
  toggleSidebar,
  logout,
];

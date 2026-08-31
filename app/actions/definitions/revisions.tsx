import copy from "copy-to-clipboard";
import { observer } from "mobx-react";
import {
  LinkIcon,
  RestoreIcon,
  TrashIcon,
  DownloadIcon,
  ExportIcon,
  PrintIcon,
  EditIcon,
} from "outline-icons";
import * as React from "react";
import { matchPath } from "react-router-dom";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { ExportContentType } from "@shared/types";
import { RevisionHelper } from "@shared/utils/RevisionHelper";
import Revision from "~/models/Revision";
import stores from "~/stores";
import type { ActionContext } from "~/types";
import {
  ActionSeparator,
  createAction,
  createActionWithChildren,
  createInternalLinkAction,
} from "~/actions";
import { RevisionSection } from "~/actions/sections";
import ConfirmationDialog from "~/components/ConfirmationDialog";
import Flex from "~/components/Flex";
import Input from "~/components/Input";

import history from "~/utils/history";
import { printPage } from "~/utils/print";
import {
  documentHistoryPath,
  matchDocumentHistory,
  urlify,
} from "~/utils/routeHelpers";

function getActiveRevisionId({ location, getActiveModel }: ActionContext) {
  const match = matchPath<{ revisionId: string }>(location.pathname, {
    path: matchDocumentHistory,
  });
  return getActiveModel(Revision)?.id ?? match?.params.revisionId;
}

/**
 * Whether the given revision is the one currently displayed, as opposed to
 * merely the one a menu was opened from.
 */
function isViewingRevision(
  { location, activeDocumentId }: ActionContext,
  revisionId: string
) {
  const match = matchPath<{ revisionId: string }>(location.pathname, {
    path: matchDocumentHistory,
  });
  const viewing = match?.params.revisionId;

  if (!viewing) {
    return false;
  }

  // The most recent revision is addressed by a placeholder in the url.
  return viewing === "latest"
    ? !!activeDocumentId &&
        RevisionHelper.latestId(activeDocumentId) === revisionId
    : viewing === revisionId;
}

export const restoreRevision = createInternalLinkAction({
  name: ({ t }) => t("Restore"),
  analyticsName: "Restore revision",
  icon: <RestoreIcon />,
  section: RevisionSection,
  visible: (context) =>
    !!context.activeDocumentId &&
    stores.policies.abilities(context.activeDocumentId).update &&
    !!getActiveRevisionId(context),
  to: (context) => {
    const revisionId = getActiveRevisionId(context);
    const document = context.activeDocumentId
      ? stores.documents.get(context.activeDocumentId)
      : undefined;

    if (!document || !revisionId) {
      return context.location;
    }

    return {
      pathname: document.url,
      state: { restore: true, revisionId },
    };
  },
});

const RenameRevisionDialog = observer(function RenameRevisionDialog({
  revision,
  onSubmit,
}: {
  revision: Revision;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = React.useState(revision.name ?? "");

  return (
    <ConfirmationDialog
      onSubmit={async () => {
        revision.name = name.trim() || null;
        await revision.save();
        toast.success(t("Revision renamed"));
        onSubmit();
      }}
      submitText={t("Save")}
      savingText={`${t("Saving")}…`}
    >
      <Flex column gap={8}>
        <Input
          autoFocus
          label={t("Name")}
          value={name}
          onChange={(ev) => setName(ev.target.value)}
        />
      </Flex>
    </ConfirmationDialog>
  );
});

export const renameRevision = createAction({
  name: ({ t }) => `${t("Rename")}…`,
  analyticsName: "Rename revision",
  icon: <EditIcon />,
  section: RevisionSection,
  visible: (context) => {
    const revisionId = getActiveRevisionId(context);
    if (!revisionId || !context.activeDocumentId) {
      return false;
    }
    const documentAbilities = stores.policies.abilities(
      context.activeDocumentId
    );
    const revisionAbilities = stores.policies.abilities(revisionId);
    return !!documentAbilities.update && revisionAbilities.update !== false;
  },
  perform: (context) => {
    context.event?.preventDefault();
    const revisionId = getActiveRevisionId(context);
    if (!revisionId) {
      return;
    }

    const revision = stores.revisions.get(revisionId);
    if (!revision) {
      return;
    }

    stores.dialogs.openModal({
      title: context.t("Rename"),
      content: (
        <RenameRevisionDialog
          revision={revision}
          onSubmit={stores.dialogs.closeAllModals}
        />
      ),
    });
  },
});

export const deleteRevision = createAction({
  name: ({ t }) => t("Delete"),
  analyticsName: "Delete revision",
  icon: <TrashIcon />,
  section: RevisionSection,
  dangerous: true,
  visible: (context) => {
    const revisionId = getActiveRevisionId(context);
    if (!revisionId) {
      return false;
    }
    const abilities = stores.policies.abilities(revisionId);
    return abilities.delete === true || !!stores.auth.user?.isAdmin;
  },
  perform: async ({ t, event, activeDocumentId, ...context }) => {
    event?.preventDefault();
    const revisionId = getActiveRevisionId(context);
    if (!revisionId || !activeDocumentId) {
      return;
    }

    const document = stores.documents.get(activeDocumentId);
    const revision = stores.revisions.get(revisionId);
    if (!document || !revision) {
      return;
    }

    stores.dialogs.openModal({
      title: t("Are you sure you want to delete?"),
      content: (
        <ConfirmationDialog
          danger
          onSubmit={async () => {
            await revision.delete();
            toast.success(t("This version of the document was deleted"));
            history.push(documentHistoryPath(document));
          }}
          savingText={`${t("Deleting")}…`}
        >
          {t(
            "Deleting this version of the document will permanently and irrevocably remove it from the history."
          )}
        </ConfirmationDialog>
      ),
    });
  },
});

export const copyLinkToRevisionActionFactory = (revisionId: string) =>
  createAction({
    name: ({ t }) => t("Copy link"),
    analyticsName: "Copy link to revision",
    icon: <LinkIcon />,
    section: RevisionSection,
    perform: async ({ activeDocumentId, t }) => {
      if (!activeDocumentId) {
        return;
      }

      const document = stores.documents.get(activeDocumentId);
      if (!document) {
        return;
      }

      const url = urlify(documentHistoryPath(document, revisionId));

      copy(url, {
        format: "text/plain",
        onCopy: () => {
          toast.message(t("Link copied to clipboard"));
        },
      });
    },
  });

export const downloadRevisionAsHTMLActionFactory = (revisionId: string) =>
  createAction({
    name: ({ t }) => t("HTML"),
    analyticsName: "Download revision as HTML",
    section: RevisionSection,
    keywords: "html export",
    icon: <DownloadIcon />,
    iconInContextMenu: false,
    visible: ({ activeDocumentId }) =>
      !!activeDocumentId &&
      stores.policies.abilities(activeDocumentId).download,
    perform: async () => {
      const revision = stores.revisions.get(revisionId);
      await revision?.download(ExportContentType.Html);
    },
  });

export const downloadRevisionAsMarkdownActionFactory = (revisionId: string) =>
  createAction({
    name: ({ t }) => t("Markdown"),
    analyticsName: "Download revision as Markdown",
    section: RevisionSection,
    keywords: "md markdown export",
    icon: <DownloadIcon />,
    iconInContextMenu: false,
    visible: ({ activeDocumentId }) =>
      !!activeDocumentId &&
      stores.policies.abilities(activeDocumentId).download,
    perform: async () => {
      const revision = stores.revisions.get(revisionId);
      await revision?.download(ExportContentType.Markdown);
    },
  });

export const downloadRevisionAsTextBundleActionFactory = (revisionId: string) =>
  createAction({
    name: ({ t }) => t("TextBundle"),
    analyticsName: "Download revision as TextBundle",
    section: RevisionSection,
    keywords: "textbundle textpack bear ulysses export",
    icon: <DownloadIcon />,
    iconInContextMenu: false,
    visible: ({ activeDocumentId }) =>
      !!activeDocumentId &&
      stores.policies.abilities(activeDocumentId).download,
    perform: async () => {
      const revision = stores.revisions.get(revisionId);
      await revision?.download(ExportContentType.TextBundle);
    },
  });

export const printRevisionActionFactory = (revisionId: string) =>
  createAction({
    name: ({ t }) => t("Print"),
    analyticsName: "Print revision",
    section: RevisionSection,
    icon: <PrintIcon />,
    iconInContextMenu: false,
    // Printing captures whatever is on screen, so it is only offered for the
    // revision currently being viewed.
    visible: (context) =>
      !!window.print && isViewingRevision(context, revisionId),
    perform: () => {
      printPage();
    },
  });

export const exportRevisionActionFactory = (revisionId: string) =>
  createActionWithChildren({
    name: ({ t, isMenu }) => (isMenu ? t("Export") : t("Export revision")),
    analyticsName: "Export revision",
    section: RevisionSection,
    icon: <ExportIcon />,
    keywords: "download export",
    children: [
      downloadRevisionAsMarkdownActionFactory(revisionId),
      downloadRevisionAsHTMLActionFactory(revisionId),
      downloadRevisionAsTextBundleActionFactory(revisionId),
      ActionSeparator,
      printRevisionActionFactory(revisionId),
    ],
  });

export const rootRevisionActions = [];

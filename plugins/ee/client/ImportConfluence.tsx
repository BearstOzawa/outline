import { observer } from "mobx-react";
import { useCallback } from "react";
import { Trans, useTranslation } from "react-i18next";
import { IntegrationService } from "@shared/types";
import Button from "~/components/Button";
import Text from "@shared/components/Text";
import useStores from "~/hooks/useStores";
import DropToImport from "~/scenes/Settings/components/DropToImport";

export const Confluence = observer(() => {
  const { t } = useTranslation();
  const { dialogs } = useStores();

  const handleClick = useCallback(() => {
    dialogs.openModal({
      title: t("Import data"),
      content: <ImportConfluenceDialog />,
    });
  }, [t, dialogs]);

  return (
    <Button type="submit" onClick={handleClick} neutral>
      {t("Import")}…
    </Button>
  );
});

function ImportConfluenceDialog() {
  const { dialogs } = useStores();

  return (
    <>
      <Text as="p">
        <Trans defaults="Where do I find the file?" />
      </Text>
      <Text as="p">
        <Trans
          defaults={`In a Confluence space, navigate to <em>Space Settings -> Manage space -> Export space</em> and choose to export as HTML with the "Normal Export" option.`}
          components={{ em: <em /> }}
        />
      </Text>
      <DropToImport
        onSubmit={dialogs.closeAllModals}
        service={IntegrationService.Confluence}
      >
        <Trans defaults="Drag and drop the zip file from Confluence's HTML export option, or click to upload" />
      </DropToImport>
    </>
  );
}

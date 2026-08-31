import { observer } from "mobx-react";
import { ShapesIcon, PlusIcon, TrashIcon, EditIcon } from "outline-icons";
import { useCallback, useEffect, useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import { toast } from "sonner";
import { errToString } from "@shared/utils/error";
import { Action } from "~/components/Actions";
import Button from "~/components/Button";
import ConfirmationDialog from "~/components/ConfirmationDialog";
import Flex from "~/components/Flex";
import Heading from "~/components/Heading";
import NudeButton from "~/components/NudeButton";
import Empty from "~/components/Empty";
import Scene from "~/components/Scene";
import Text from "~/components/Text";
import useStores from "~/hooks/useStores";
import { client } from "~/utils/ApiClient";
import SettingRow from "~/scenes/Settings/components/SettingRow";
import AttributeForm, { type Attribute, type AttributeType } from "./AttributeForm";

function typeLabel(type: AttributeType, t: (key: string) => string) {
  if (type === "text") {
    return t("Text");
  }
  if (type === "number") {
    return t("Number");
  }
  if (type === "boolean") {
    return t("Boolean");
  }
  return t("List");
}

function AttributesSettings() {
  const { t } = useTranslation();
  const { dialogs } = useStores();
  const [attributes, setAttributes] = useState<Attribute[]>([]);

  const load = useCallback(async () => {
    const res = await client.post("/attributes.list");
    setAttributes(res.data as Attribute[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    dialogs.openModal({
      title: t("New Attribute"),
      content: (
        <AttributeForm
          onSubmit={async (values) => {
            await client.post("/attributes.create", values);
            toast.success(t("Settings saved"));
            await load();
          }}
        />
      ),
    });
  };

  const openEdit = (attribute: Attribute) => {
    dialogs.openModal({
      title: t("Edit attribute"),
      content: (
        <AttributeForm
          attribute={attribute}
          onSubmit={async (values) => {
            await client.post("/attributes.update", {
              id: attribute.id,
              name: values.name,
              required: values.required,
              options: values.options,
            });
            toast.success(t("Settings saved"));
            await load();
          }}
        />
      ),
    });
  };

  const openDelete = (attribute: Attribute) => {
    dialogs.openModal({
      title: t("Are you sure you want to delete?"),
      content: (
        <ConfirmationDialog
          danger
          onSubmit={async () => {
            try {
              await client.post("/attributes.delete", { id: attribute.id });
              await load();
            } catch (err) {
              toast.error(t(errToString(err)));
              return false;
            }
            return undefined;
          }}
        >
          {t("Deleting this attribute will remove it from all documents.")}
        </ConfirmationDialog>
      ),
    });
  };

  return (
    <Scene
      title={t("Data Attributes")}
      icon={<ShapesIcon />}
      actions={
        <Action>
          <Button type="button" onClick={openCreate} icon={<PlusIcon />}>
            {t("New Attribute")}
          </Button>
        </Action>
      }
    >
      <Heading>{t("Data Attributes")}</Heading>
      <Text as="p" type="secondary">
        <Trans defaults="Attributes allow you to define data to be stored with your documents. They can be used to store custom properties, metadata, or any other structured information that is common across documents." />
      </Text>
      {attributes.length === 0 && (
        <Empty>{t("No attributes have been created yet")}</Empty>
      )}
      {attributes.map((attribute) => (
        <SettingRow
          key={attribute.id}
          name={attribute.id ?? attribute.name}
          label={attribute.name}
          description={`${typeLabel(attribute.type, t)}${attribute.required ? "" : ` · ${t("Optional")}`}`}
        >
          <Flex gap={4}>
            <NudeButton onClick={() => openEdit(attribute)} aria-label={t("Edit attribute")}>
              <EditIcon />
            </NudeButton>
            <NudeButton onClick={() => openDelete(attribute)} aria-label={t("Delete")}>
              <TrashIcon />
            </NudeButton>
          </Flex>
        </SettingRow>
      ))}
    </Scene>
  );
}

export default observer(AttributesSettings);

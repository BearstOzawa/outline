import { observer } from "mobx-react";
import * as React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import ConfirmationDialog from "~/components/ConfirmationDialog";
import Flex from "~/components/Flex";
import Input from "~/components/Input";
import type { Option } from "~/components/InputSelect";
import { InputSelect } from "~/components/InputSelect";
import Switch from "~/components/Switch";
import Text from "~/components/Text";

export type AttributeType = "boolean" | "number" | "text" | "list";

export type Attribute = {
  id?: string;
  name: string;
  type: AttributeType;
  required: boolean;
  options: string[] | null;
};

type Props = {
  attribute?: Attribute;
  onSubmit: (attribute: Omit<Attribute, "id">) => Promise<void>;
};

function AttributeForm({ attribute, onSubmit }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState(attribute?.name ?? "");
  const [type, setType] = useState<AttributeType>(attribute?.type ?? "text");
  const [required, setRequired] = useState(attribute?.required ?? false);
  const [options, setOptions] = useState<string[]>(
    attribute?.options?.length ? [...attribute.options, ""] : [""]
  );

  const typeOptions: Option[] = [
    { type: "item", label: t("Text"), value: "text" },
    { type: "item", label: t("Number"), value: "number" },
    { type: "item", label: t("Boolean"), value: "boolean" },
    { type: "item", label: t("List"), value: "list" },
  ];

  return (
    <ConfirmationDialog
      onSubmit={() =>
        onSubmit({
          name: name.trim(),
          type,
          required,
          options:
            type === "list"
              ? options.map((option) => option.trim()).filter(Boolean)
              : undefined,
        })
      }
      submitText={attribute ? t("Save") : t("New Attribute")}
      savingText={`${t("Saving")}…`}
      disabled={!name.trim() || (type === "list" && !options.some((o) => o.trim()))}
    >
      <Flex gap={12} column>
        <Input
          autoFocus
          label={t("Property")}
          value={name}
          onChange={(ev) => setName(ev.target.value)}
          required
        />
        <InputSelect
          label={t("Format")}
          options={typeOptions}
          value={type}
          onChange={(value) => setType(value as AttributeType)}
          disabled={!!attribute}
        />
        {type === "list" && (
          <Flex column gap={8}>
            <Text type="secondary" size="small">
              {t("Add option")}
            </Text>
            {options.map((option, index) => (
              <Input
                key={index}
                value={option}
                onChange={(ev) => {
                  const next = [...options];
                  next[index] = ev.target.value;
                  if (index === options.length - 1 && ev.target.value) {
                    next.push("");
                  }
                  setOptions(next);
                }}
              />
            ))}
          </Flex>
        )}
        <Flex align="center" gap={8} justify="space-between">
          <Text>{t("Optional")}</Text>
          <Switch
            checked={!required}
            onChange={(checked: boolean) => setRequired(!checked)}
          />
        </Flex>
      </Flex>
    </ConfirmationDialog>
  );
}

export default observer(AttributeForm);

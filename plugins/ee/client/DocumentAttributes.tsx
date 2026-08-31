import { observer } from "mobx-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import styled from "styled-components";
import { s } from "@shared/styles";
import { errToString } from "@shared/utils/error";
import useShare from "@shared/hooks/useShare";
import type Document from "~/models/Document";
import Flex from "~/components/Flex";
import Input from "~/components/Input";
import type { Option } from "~/components/InputSelect";
import { InputSelect } from "~/components/InputSelect";
import Switch from "~/components/Switch";
import Text from "~/components/Text";
import usePolicy from "~/hooks/usePolicy";
import { client } from "~/utils/ApiClient";
import type { Attribute } from "./AttributeForm";

type AttributeValue = {
  attributeId: string;
  value: string | number | boolean | null;
};

function DocumentAttributes({ document }: { document: Document }) {
  const { t } = useTranslation();
  const { shareId } = useShare();
  const can = usePolicy(document);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [values, setValues] = useState<
    Record<string, string | number | boolean | null>
  >({});

  const load = useCallback(async () => {
    const res = await client.post("/documentAttributes.list", {
      documentId: document.id,
    });
    const defs = res.data.attributes as Attribute[];
    const rows = res.data.values as AttributeValue[];
    const map: Record<string, string | number | boolean | null> = {};
    for (const row of rows) {
      map[row.attributeId] = row.value;
    }
    setAttributes(defs);
    setValues(map);
  }, [document.id]);

  useEffect(() => {
    if (shareId) {
      return;
    }
    void load();
  }, [load, shareId]);

  if (shareId) {
    return null;
  }

  const save = async (
    attributeId: string,
    value: string | number | boolean | null
  ) => {
    const next = { ...values, [attributeId]: value };
    setValues(next);
    if (!can.update) {
      return;
    }
    try {
      await client.post("/documentAttributes.update", {
        documentId: document.id,
        values: Object.entries(next).map(([id, item]) => ({
          attributeId: id,
          value: item,
        })),
      });
    } catch (err) {
      toast.error(errToString(err));
    }
  };

  if (attributes.length === 0) {
    return null;
  }

  return (
    <Wrap>
      {attributes.map((attribute) => (
        <Row key={attribute.id} gap={12} align="center">
          <Label type="secondary" size="small">
            {attribute.name}
          </Label>
          <Field>
            {attribute.type === "boolean" ? (
              <Flex gap={8} align="center">
                <Switch
                  checked={values[attribute.id ?? ""] === true}
                  disabled={!can.update}
                  onChange={(checked: boolean) =>
                    save(attribute.id ?? "", checked)
                  }
                />
                <Text size="small">
                  {values[attribute.id ?? ""] === true ? t("On") : t("Off")}
                </Text>
              </Flex>
            ) : attribute.type === "list" ? (
              <InputSelect
                short
                label={attribute.name}
                labelHidden
                disabled={!can.update}
                value={String(values[attribute.id ?? ""] ?? "")}
                options={
                  (attribute.options ?? []).map((option) => ({
                    type: "item",
                    label: option,
                    value: option,
                  })) as Option[]
                }
                onChange={(value) => save(attribute.id ?? "", value)}
              />
            ) : (
              <Input
                value={values[attribute.id ?? ""] ?? ""}
                disabled={!can.update}
                type={attribute.type === "number" ? "number" : "text"}
                onChange={(ev) =>
                  setValues({
                    ...values,
                    [attribute.id ?? ""]:
                      attribute.type === "number"
                        ? Number(ev.target.value)
                        : ev.target.value,
                  })
                }
                onBlur={() =>
                  save(attribute.id ?? "", values[attribute.id ?? ""] ?? null)
                }
              />
            )}
          </Field>
        </Row>
      ))}
    </Wrap>
  );
}

const Wrap = styled.div`
  margin: 8px 0 16px;
  max-width: 46em;
`;

const Row = styled(Flex)`
  margin-bottom: 8px;
`;

const Label = styled(Text)`
  width: 160px;
  flex-shrink: 0;
`;

const Field = styled.div`
  flex: 1;
  color: ${s("text")};
`;

export default observer(DocumentAttributes);

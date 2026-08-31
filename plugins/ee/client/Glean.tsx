import { find } from "es-toolkit/compat";
import { observer } from "mobx-react";
import { SearchIcon } from "outline-icons";
import * as React from "react";
import { useForm } from "react-hook-form";
import { useTranslation, Trans } from "react-i18next";
import { toast } from "sonner";
import { IntegrationService, IntegrationType } from "@shared/types";
import { errToString } from "@shared/utils/error";
import env from "~/env";
import type Integration from "~/models/Integration";
import Button from "~/components/Button";
import Heading from "~/components/Heading";
import Input from "~/components/Input";
import Text from "~/components/Text";
import useStores from "~/hooks/useStores";
import { IntegrationScene } from "~/scenes/Settings/components/IntegrationScene";
import SettingRow from "~/scenes/Settings/components/SettingRow";

type FormData = {
  apiEndpoint: string;
  apiSecret: string;
  datasource: string;
};

function GleanSettings() {
  const { integrations } = useStores();
  const { t } = useTranslation();
  const appName = env.APP_NAME;

  const integration = find(integrations.orderedData, {
    type: IntegrationType.Analytics,
    service: IntegrationService.Glean,
  }) as Integration<IntegrationType.Analytics> | undefined;

  const {
    register,
    reset,
    handleSubmit: formHandleSubmit,
    formState,
  } = useForm<FormData>({
    mode: "all",
    defaultValues: {
      apiEndpoint: integration?.settings.apiEndpoint ?? "",
      apiSecret: integration?.settings.apiSecret ?? "",
      datasource: integration?.settings.datasource ?? "",
    },
  });

  React.useEffect(() => {
    reset({
      apiEndpoint: integration?.settings.apiEndpoint ?? "",
      apiSecret: integration?.settings.apiSecret ?? "",
      datasource: integration?.settings.datasource ?? "",
    });
  }, [reset, integration]);

  const handleSubmit = React.useCallback(
    async (data: FormData) => {
      try {
        await integrations.save({
          id: integration?.id,
          type: IntegrationType.Analytics,
          service: IntegrationService.Glean,
          settings: {
            apiEndpoint: data.apiEndpoint.trim(),
            apiSecret: data.apiSecret.trim(),
            datasource: data.datasource.trim(),
          },
        });
        toast.success(t("Settings saved"));
      } catch (err) {
        toast.error(errToString(err));
      }
    },
    [integrations, integration, t]
  );

  return (
    <IntegrationScene title="Glean" icon={<SearchIcon />}>
      <Heading>Glean</Heading>
      <Text as="p" type="secondary">
        <Trans
          defaults="Automatically index and search document content from {{appName}} inside <4>Glean</4> in realtime."
          values={{ appName }}
          components={{ 4: <strong /> }}
        />
      </Text>
      <form onSubmit={formHandleSubmit(handleSubmit)}>
        <SettingRow
          name="apiEndpoint"
          label={t("API Endpoint")}
          description={t("API Endpoint")}
        >
          <Input
            required
            placeholder="https://customer-be.glean.com"
            {...register("apiEndpoint", { required: true })}
          />
        </SettingRow>
        <SettingRow
          name="apiSecret"
          label={t("API Secret")}
          description={t("API Secret")}
        >
          <Input
            required
            type="password"
            autoComplete="off"
            {...register("apiSecret", { required: true })}
          />
        </SettingRow>
        <SettingRow
          name="datasource"
          label={t("Datasource")}
          description={t("Datasource")}
          border={false}
        >
          <Input required {...register("datasource", { required: true })} />
        </SettingRow>
        <Button type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? `${t("Saving")}…` : t("Save")}
        </Button>
      </form>
    </IntegrationScene>
  );
}

export default observer(GleanSettings);

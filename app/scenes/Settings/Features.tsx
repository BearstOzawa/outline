import { observer } from "mobx-react";
import { CopyIcon, SparklesIcon } from "outline-icons";
import * as React from "react";
import { useTranslation, Trans } from "react-i18next";
import { toast } from "sonner";
import { TeamPreference } from "@shared/types";
import { errToString } from "@shared/utils/error";
import { TeamValidation } from "@shared/validations";
import ButtonSmall from "~/components/ButtonSmall";
import Heading from "~/components/Heading";
import Scene from "~/components/Scene";
import Switch from "~/components/Switch";
import Text from "~/components/Text";
import useCurrentTeam from "~/hooks/useCurrentTeam";
import SettingRow from "./components/SettingRow";
import Input from "~/components/Input";
import Tooltip from "~/components/Tooltip";
import CopyToClipboard from "~/components/CopyToClipboard";
import NudeButton from "~/components/NudeButton";
import { useTheme } from "styled-components";
import { client } from "~/utils/ApiClient";

type AIStatus = {
  embeddings: {
    configured: boolean;
    available: boolean;
    eligibleDocuments: number;
    indexedDocuments: number;
    staleDocuments: number;
    pendingDocuments: number;
    lastIndexedAt: string | null;
  };
  rerank: {
    configured: boolean;
    available: boolean;
  };
};

function Features() {
  const { t } = useTranslation();
  const team = useCurrentTeam();
  const theme = useTheme();
  const [status, setStatus] = React.useState<AIStatus | null>(null);
  const [indexing, setIndexing] = React.useState(false);

  const loadStatus = React.useCallback(async () => {
    const res = await client.post("/ai.status");
    setStatus(res.data as AIStatus);
    return res.data as AIStatus;
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    void loadStatus().catch(() => {
      if (!cancelled) {
        setStatus(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [loadStatus]);

  const handleMCPChange = React.useCallback(
    async (checked: boolean) => {
      team.setPreference(TeamPreference.MCP, checked);
      await team.save();
      toast.success(t("Settings saved"));
    },
    [team, t]
  );

  const handleAIAnswersChange = React.useCallback(
    async (checked: boolean) => {
      team.setPreference(TeamPreference.AIAnswers, checked);
      if (!checked) {
        team.setPreference(TeamPreference.AIVectorSearch, false);
        team.setPreference(TeamPreference.AIRerank, false);
      }
      await team.save();
      toast.success(t("Settings saved"));
    },
    [team, t]
  );

  const handleAIVectorSearchChange = React.useCallback(
    async (checked: boolean) => {
      team.setPreference(TeamPreference.AIVectorSearch, checked);
      await team.save();
      toast.success(t("Settings saved"));
      if (checked) {
        void loadStatus().catch(() => undefined);
      }
    },
    [team, t, loadStatus]
  );

  const handleIndexNow = React.useCallback(async () => {
    if (indexing) {
      return;
    }
    setIndexing(true);
    try {
      await client.post("/ai.index", { verify: true });
      toast.success(t("Indexing started"));
      for (let i = 0; i < 24; i++) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
        const next = await loadStatus();
        if ((next.embeddings.pendingDocuments ?? 0) === 0) {
          break;
        }
      }
    } catch (err) {
      toast.error(t(errToString(err)));
    } finally {
      setIndexing(false);
    }
  }, [indexing, loadStatus, t]);

  const handleAIRerankChange = React.useCallback(
    async (checked: boolean) => {
      team.setPreference(TeamPreference.AIRerank, checked);
      await team.save();
      toast.success(t("Settings saved"));
    },
    [team, t]
  );

  const handleGuidanceMCPChange = React.useCallback(
    async (ev: React.ChangeEvent<HTMLTextAreaElement>) => {
      team.guidanceMCP = ev.target.value || null;
    },
    [team]
  );

  const handleGuidanceMCPBlur = React.useCallback(async () => {
    await team.save();
    toast.success(t("Settings saved"));
  }, [team, t]);

  const handleCopied = React.useCallback(() => {
    toast.success(t("Copied to clipboard"));
  }, [t]);

  const mcpEndpoint = window.location.origin + "/mcp";

  return (
    <Scene title={t("AI")} icon={<SparklesIcon />}>
      <Heading>{t("AI")}</Heading>
      <Text as="p" type="secondary">
        <Trans>Manage AI and integration features for your workspace.</Trans>
      </Text>

      <SettingRow
        name={TeamPreference.MCP}
        label={t("MCP server")}
        border={!team.getPreference(TeamPreference.MCP)}
        description={
          <>
            <Text type="secondary" as="p">
              {t(
                "Allow members to connect to this workspace with MCP to read and write data."
              )}
            </Text>
            {team.getPreference(TeamPreference.MCP) && (
              <>
                <Text
                  type="secondary"
                  as="p"
                  style={{ marginTop: 8, marginBottom: 4 }}
                >
                  {t(
                    "Use the following endpoint to connect to the MCP server from your app."
                  )}
                </Text>
                <Input readOnly value={mcpEndpoint}>
                  <Tooltip content={t("Copy URL")} placement="top">
                    <CopyToClipboard text={mcpEndpoint} onCopy={handleCopied}>
                      <NudeButton type="button" style={{ marginRight: 3 }}>
                        <CopyIcon color={theme.placeholder} size={18} />
                      </NudeButton>
                    </CopyToClipboard>
                  </Tooltip>
                </Input>
              </>
            )}
          </>
        }
      >
        <Switch
          id={TeamPreference.MCP}
          name={TeamPreference.MCP}
          checked={team.getPreference(TeamPreference.MCP)}
          onChange={handleMCPChange}
        />
      </SettingRow>

      {team.getPreference(TeamPreference.MCP) && (
        <SettingRow
          name="guidanceMCP"
          label={t("Additional guidance")}
          description={
            <>
              <div style={{ marginBottom: 8 }}>
                {t(
                  "You can use these optional instructions to tell MCP clients how to use your knowledge base."
                )}
              </div>
              <Input
                id="guidanceMCP"
                type="textarea"
                autoSize
                minHeight="6lh"
                maxHeight="20lh"
                value={team.guidanceMCP ?? ""}
                maxLength={TeamValidation.maxGuidanceMCPLength}
                warningLimit={TeamValidation.warnGuidanceMCPLength}
                onChange={handleGuidanceMCPChange}
                onBlur={handleGuidanceMCPBlur}
              />
            </>
          }
        />
      )}

      <SettingRow
        name={TeamPreference.AIAnswers}
        label={t("AI answers")}
        description={t(
          "Answer questions with your own documents. Used by Ask AI, search, and summaries."
        )}
      >
        <Switch
          id={TeamPreference.AIAnswers}
          name={TeamPreference.AIAnswers}
          checked={!!team.getPreference(TeamPreference.AIAnswers)}
          onChange={handleAIAnswersChange}
        />
      </SettingRow>

      <SettingRow
        name={TeamPreference.AIVectorSearch}
        label={t("Vector search")}
        description={
          <>
            {t(
              "Find related documents by meaning, not just keywords. Helps when a question is phrased differently from the original text."
            )}
            {status && (
              <Text
                type="tertiary"
                size="xsmall"
                style={{ marginTop: 8, display: "block" }}
              >
                {!status.embeddings.configured
                  ? t("Embeddings are not configured on this server.")
                  : !status.embeddings.available
                    ? t("Embeddings are temporarily unavailable.")
                    : status.embeddings.eligibleDocuments === 0
                      ? t("No documents indexed yet.")
                      : t(
                          "{{ indexed }} / {{ eligible }} documents have embeddings.",
                          {
                            indexed: status.embeddings.indexedDocuments,
                            eligible: status.embeddings.eligibleDocuments,
                          }
                        )}
                {status.embeddings.configured &&
                status.embeddings.available &&
                (status.embeddings.pendingDocuments ?? 0) > 0
                  ? ` ${t("{{ count }} not indexed yet.", {
                      count: status.embeddings.pendingDocuments,
                    })}`
                  : null}
              </Text>
            )}
            {status?.embeddings.configured &&
              !!team.getPreference(TeamPreference.AIVectorSearch) && (
                <div style={{ marginTop: 8 }}>
                  <ButtonSmall
                    onClick={() => void handleIndexNow()}
                    disabled={indexing || !status.embeddings.available}
                    neutral
                    borderOnHover
                  >
                    {indexing ? t("Indexing…") : t("Index now")}
                  </ButtonSmall>
                </div>
              )}
          </>
        }
      >
        <Switch
          id={TeamPreference.AIVectorSearch}
          name={TeamPreference.AIVectorSearch}
          checked={!!team.getPreference(TeamPreference.AIVectorSearch)}
          disabled={!team.getPreference(TeamPreference.AIAnswers)}
          onChange={handleAIVectorSearchChange}
        />
      </SettingRow>

      <SettingRow
        name={TeamPreference.AIRerank}
        label={t("Reranking")}
        description={
          <>
            {t(
              "From what was found, keep the most relevant parts for the answer. More accurate, uses an extra model."
            )}
            {status && (
              <Text
                type="tertiary"
                size="xsmall"
                style={{ marginTop: 8, display: "block" }}
              >
                {!status.rerank.configured
                  ? t("Reranking is not configured on this server.")
                  : status.rerank.available
                    ? t("Rerank model is ready.")
                    : t("Rerank model is temporarily unavailable.")}
              </Text>
            )}
          </>
        }
        border={false}
      >
        <Switch
          id={TeamPreference.AIRerank}
          name={TeamPreference.AIRerank}
          checked={!!team.getPreference(TeamPreference.AIRerank)}
          disabled={!team.getPreference(TeamPreference.AIAnswers)}
          onChange={handleAIRerankChange}
        />
      </SettingRow>
    </Scene>
  );
}

export default observer(Features);

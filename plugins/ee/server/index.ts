import { sequelize } from "@server/storage/database";
import { Hook, PluginManager } from "@server/utils/PluginManager";
import config from "../plugin.json";
import attributes from "./api/attributes";
import ai from "./api/ai";
import conversations from "./api/conversations";
import saml from "./auth/saml";
import env from "./env";
import Attribute from "./models/Attribute";
import DocumentAttribute from "./models/DocumentAttribute";
import DocumentEmbedding from "./models/DocumentEmbedding";
import AIConversation from "./models/AIConversation";
import { ConfluenceImportsProcessor } from "./processors/ConfluenceImportsProcessor";
import DocumentEmbeddingProcessor from "./processors/DocumentEmbeddingProcessor";
import GleanProcessor from "./processors/GleanProcessor";
import { SamlGroupSyncProvider } from "./SamlGroupSyncProvider";
import BackfillDocumentEmbeddingsTask from "./tasks/BackfillDocumentEmbeddingsTask";
import ConfluenceHTMLImportTask from "./tasks/ConfluenceHTMLImportTask";
import IndexDocumentEmbeddingsTask from "./tasks/IndexDocumentEmbeddingsTask";

sequelize.addModels([
  Attribute,
  DocumentAttribute,
  DocumentEmbedding,
  AIConversation,
]);

PluginManager.add([
  {
    ...config,
    type: Hook.API,
    value: attributes,
  },
  {
    ...config,
    type: Hook.API,
    value: ai,
  },
  {
    ...config,
    type: Hook.API,
    value: conversations,
  },
  {
    ...config,
    type: Hook.Processor,
    value: ConfluenceImportsProcessor,
  },
  {
    ...config,
    type: Hook.Processor,
    value: GleanProcessor,
  },
  {
    ...config,
    type: Hook.Processor,
    value: DocumentEmbeddingProcessor,
  },
  {
    ...config,
    type: Hook.Task,
    value: ConfluenceHTMLImportTask,
  },
  {
    ...config,
    type: Hook.Task,
    value: IndexDocumentEmbeddingsTask,
  },
  {
    ...config,
    type: Hook.Task,
    value: BackfillDocumentEmbeddingsTask,
  },
]);

if (env.SAML_SSO_ENDPOINT && env.SAML_CERT) {
  PluginManager.add([
    {
      name: env.SAML_DISPLAY_NAME,
      type: Hook.AuthProvider,
      value: { router: saml, id: "saml" },
    },
    {
      name: env.SAML_DISPLAY_NAME,
      type: Hook.GroupSyncProvider,
      value: { id: "saml", provider: new SamlGroupSyncProvider() },
    },
  ]);
}

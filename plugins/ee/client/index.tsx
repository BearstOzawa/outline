import { CollectionIcon, PadlockIcon, ShapesIcon } from "outline-icons";

import { createLazyComponent } from "~/components/LazyLoad";
import { Hook, PluginManager } from "~/utils/PluginManager";
import config from "../plugin.json";
import Icon from "./Icon";
import SamlIcon from "./SamlIcon";
import { Confluence } from "./ImportConfluence";

PluginManager.add([
  {
    id: "audit-log",
    name: "Audit Log",
    type: Hook.Settings,
    value: {
      group: "Workspace",
      after: "Security",
      icon: PadlockIcon,
      description:
        "The audit log details the history of security related and other events across your knowledge base.",
      component: createLazyComponent(() => import("./AuditLog")),
      enabled: (_team, user) => user.isAdmin,
    },
  },
  {
    id: "collections-admin",
    name: "Collections",
    type: Hook.Settings,
    value: {
      group: "Workspace",
      after: "Groups",
      icon: CollectionIcon,
      description:
        "Manage the permissions and settings of all collections in the knowledge base. As a workspace admin you can also administer private collections.",
      component: createLazyComponent(() => import("./Collections")),
      enabled: (_team, user) => user.isAdmin,
    },
  },
  {
    id: "attributes",
    name: "Data Attributes",
    type: Hook.Settings,
    value: {
      group: "Workspace",
      after: "Templates",
      icon: ShapesIcon,
      description:
        "Attributes allow you to define data to be stored with your documents. They can be used to store custom properties, metadata, or any other structured information that is common across documents.",
      component: createLazyComponent(() => import("./Attributes")),
      enabled: (_team, user) => user.isAdmin,
    },
  },
  {
    id: "document-ai-summary",
    name: "AI summary",
    type: Hook.DocumentMeta,
    priority: 0,
    value: {
      component: createLazyComponent(() => import("./DocumentSummary")),
    },
  },
  {
    id: "attributes-meta",
    name: "Data Attributes",
    type: Hook.DocumentMeta,
    priority: 10,
    value: {
      component: createLazyComponent(() => import("./DocumentAttributes")),
    },
  },
  {
    id: "glean",
    name: "Glean",
    type: Hook.Settings,
    value: {
      group: "Integrations",
      icon: Icon,
      description:
        "Automatically index and search document content from Outline inside Glean in realtime.",
      component: createLazyComponent(() => import("./Glean")),
      enabled: (_team, user) => user.isAdmin,
    },
  },
  {
    id: "confluence",
    name: "Confluence",
    type: Hook.Imports,
    value: {
      title: "Confluence",
      subtitle: "Import pages from a Confluence instance",
      icon: <CollectionIcon size={28} />,
      action: <Confluence />,
    },
  },
  {
    ...config,
    type: Hook.Icon,
    value: Icon,
  },
  {
    id: "saml",
    name: "SAML",
    type: Hook.Icon,
    value: SamlIcon,
  },
]);

import { IntegrationService, IntegrationType } from "@shared/types";
import { Document, Integration, Team } from "@server/models";
import Logger from "@server/logging/Logger";
import BaseProcessor from "@server/queues/processors/BaseProcessor";
import type { Event } from "@server/types";

export default class GleanProcessor extends BaseProcessor {
  static applicableEvents: Event["name"][] = [
    "documents.publish",
    "documents.update",
    "documents.delete",
    "documents.permanent_delete",
    "documents.unpublish",
    "documents.archive",
  ];

  public async perform(event: Event) {
    if (!("documentId" in event) || !event.documentId) {
      return;
    }

    const integration = (await Integration.findOne({
      where: {
        teamId: event.teamId,
        type: IntegrationType.Analytics,
        service: IntegrationService.Glean,
      },
    })) as Integration<IntegrationType.Analytics> | null;

    const endpoint = integration?.settings.apiEndpoint?.replace(/\/+$/, "");
    const secret = integration?.settings.apiSecret;
    const datasource = integration?.settings.datasource;
    if (!endpoint || !secret || !datasource) {
      return;
    }

    const headers = {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    };

    if (
      event.name === "documents.delete" ||
      event.name === "documents.permanent_delete" ||
      event.name === "documents.unpublish" ||
      event.name === "documents.archive"
    ) {
      const response = await fetch(`${endpoint}/api/index/v1/deletedocument`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          datasource,
          object: { id: event.documentId },
        }),
      });
      if (!response.ok) {
        Logger.warn("Glean document delete failed", {
          status: response.status,
          documentId: event.documentId,
        });
      }
      return;
    }

    const document = await Document.findByPk(event.documentId);
    const team = await Team.findByPk(event.teamId);
    if (!document || !team || document.isDraft) {
      return;
    }

    const response = await fetch(`${endpoint}/api/index/v1/indexdocument`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        datasource,
        object: {
          id: document.id,
          title: document.titleWithDefault,
          body: {
            mimeType: "text/plain",
            textContent: (document.text || "").slice(0, 100000),
          },
          viewURL: `${team.url}${document.url}`,
          permissions: { allowAnonymousAccess: false },
        },
      }),
    });
    if (!response.ok) {
      Logger.warn("Glean document index failed", {
        status: response.status,
        documentId: document.id,
      });
    }
  }
}

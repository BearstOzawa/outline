import { IntegrationService } from "@shared/types";
import type { Import, ImportTask } from "@server/models";
import MarkdownImportsProcessor from "@server/queues/processors/MarkdownImportsProcessor";
import ConfluenceHTMLImportTask from "../tasks/ConfluenceHTMLImportTask";

type Service = IntegrationService.Markdown | IntegrationService.Confluence;

export class ConfluenceImportsProcessor extends MarkdownImportsProcessor {
  protected canProcess(importModel: Import<Service>): boolean {
    return importModel.service === IntegrationService.Confluence;
  }

  protected async scheduleTask(importTask: ImportTask<Service>): Promise<void> {
    await new ConfluenceHTMLImportTask().schedule({
      importTaskId: importTask.id,
    });
  }
}

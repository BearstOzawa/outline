import path from "node:path";
import { DocumentValidation } from "@shared/validations";
import type { IntegrationService } from "@shared/types";
import { DocumentConverter } from "@server/converters/DocumentConverter";
import type { ImportTask } from "@server/models";
import MarkdownAPIImportTask from "@server/queues/tasks/MarkdownAPIImportTask";
import type { ZipTreeNode } from "@server/utils/ZipHelper";

type Service = IntegrationService.Markdown | IntegrationService.Confluence;

const SKIP_HTML = /^(index|page-information|search-results|space-tools)\.html$/i;

export default class ConfluenceHTMLImportTask extends MarkdownAPIImportTask {
  protected async scheduleNextTask(
    importTask: ImportTask<Service>
  ): Promise<void> {
    await new ConfluenceHTMLImportTask().schedule({
      importTaskId: importTask.id,
    });
  }

  protected isDocumentFile(fileName: string): boolean {
    const ext = path.extname(fileName).toLowerCase();
    if (ext === ".html" || ext === ".htm") {
      return !SKIP_HTML.test(path.basename(fileName));
    }
    return super.isDocumentFile(fileName);
  }

  protected async loadDocumentText(
    node: ZipTreeNode,
    entry: { readBuffer: (maxSize: number) => Promise<Buffer> }
  ): Promise<string | undefined> {
    const ext = path.extname(node.name).toLowerCase();
    if (ext === ".html" || ext === ".htm") {
      if (!this.isDocumentFile(node.name)) {
        return undefined;
      }
      const buffer = await entry.readBuffer(DocumentValidation.maxStateLength);
      const converted = await DocumentConverter.convert(
        buffer,
        node.name,
        "text/html",
        { extractTitle: this.shouldExtractTitleFromHeading() }
      );
      return converted.text;
    }
    return super.loadDocumentText(node, entry);
  }

  /**
   * Confluence HTML exports often wrap pages in a single space-named folder.
   */
  protected resolveCollectionRootNodes(nodes: ZipTreeNode[]): ZipTreeNode[] {
    if (nodes.length === 1 && nodes[0].children.length > 0) {
      return nodes[0].children;
    }
    return nodes;
  }
}

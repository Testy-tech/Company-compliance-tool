import "server-only";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { jurisdictionSchema, type Jurisdiction, type JurisdictionId } from "./schema";

/** Storage boundary for the knowledge base, so a database can replace the JSON files later. */
export interface KnowledgeBaseRepository {
  list(): Promise<Jurisdiction[]>;
  get(id: JurisdictionId): Promise<Jurisdiction | null>;
}

export class FileKnowledgeBaseRepository implements KnowledgeBaseRepository {
  constructor(private readonly dir = path.join(process.cwd(), "content", "jurisdictions")) {}

  async list(): Promise<Jurisdiction[]> {
    const files = (await readdir(this.dir)).filter((f) => f.endsWith(".json")).sort();
    return Promise.all(files.map((f) => this.read(f)));
  }

  async get(id: JurisdictionId): Promise<Jurisdiction | null> {
    try {
      return await this.read(`${id}.json`);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }

  private async read(file: string): Promise<Jurisdiction> {
    const raw = JSON.parse(await readFile(path.join(this.dir, file), "utf8"));
    return jurisdictionSchema.parse(raw);
  }
}

export const knowledgeBase: KnowledgeBaseRepository = new FileKnowledgeBaseRepository();

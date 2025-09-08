import { BaseStore, type Item } from "@langchain/langgraph";
import {
  // BaseStore,
  type OperationResults,
  // type Item,
  type Operation,
  MatchCondition,
  ListNamespacesOperation,
  PutOperation,
  SearchOperation,
  GetOperation,
  type IndexConfig,
  type SearchItem,
} from "./base.js";
import { tokenizePath, compareValues, getTextAtPath } from "./utils.js";
import {
  type ObjectId,
  type MongoClient,
  type Db as MongoDatabase,
} from "mongodb";
import { validateNamespace } from "./base.js";

interface StoreItem extends Item {
  _id?: ObjectId;

  /** namespace: ["documents", "user1","ssss","ddd"] */
  namespace: string[];
  /** path: "a/b/c" */
  key: string;
  /** prefixes: ["a","a/b","a/b/c"] */
  // prefixes: string[];
  /** depth: ns.length */
  // depth: number;

  /** object */
  value: Record<string, any>;

  /** createdAt: Date */
  createdAt: Date;
  /** updatedAt: Date */
  updatedAt: Date;
}

/**
 * In-memory key-value store with optional vector search.
 *
 * A lightweight store implementation using JavaScript Maps. Supports basic
 * key-value operations and vector search when configured with embeddings.
 *
 * @example
 * ```typescript
 * // Basic key-value storage
 * const store = new InMemoryStore();
 * await store.put(["users", "123"], "prefs", { theme: "dark" });
 * const item = await store.get(["users", "123"], "prefs");
 *
 * // Vector search with embeddings
 * import { OpenAIEmbeddings } from "@langchain/openai";
 * const store = new InMemoryStore({
 *   index: {
 *     dims: 1536,
 *     embeddings: new OpenAIEmbeddings({ modelName: "text-embedding-3-small" }),
 *   }
 * });
 *
 * // Store documents
 * await store.put(["docs"], "doc1", { text: "Python tutorial" });
 * await store.put(["docs"], "doc2", { text: "TypeScript guide" });
 *
 * // Search by similarity
 * const results = await store.search(["docs"], { query: "python programming" });
 * ```
 *
 * @warning This store keeps all data in memory. Data is lost when the process exits.
 * For persistence, use a database-backed store.
 */
export class InMemoryStore extends BaseStore {
  protected client: MongoClient;

  protected db: MongoDatabase;

  storeCollectionName = "stores";

  constructor({
    client,
    dbName,
    storeCollectionName,
  }: {
    client: MongoClient;
    dbName?: string;
    storeCollectionName?: string;
  }) {
    super();
    this.client = client;
    this.db = this.client.db(dbName);
    this.storeCollectionName = storeCollectionName ?? this.storeCollectionName;
  }

  async batch<Op extends readonly Operation[]>(
    operations: Op
  ): Promise<OperationResults<Op>> {
    return [] as OperationResults<Op>;
  }

  /**
   * Store or update an item.
   *
   * @param namespace Hierarchical path for the item
   * @param key Unique identifier within the namespace
   * @param value Object containing the item's data
   * @param index Optional indexing configuration
   *
   * @example
   * // Simple storage
   * await store.put(["docs"], "report", { title: "Annual Report" });
   *
   * // With specific field indexing
   * await store.put(
   *   ["docs"],
   *   "report",
   *   {
   *     title: "Q4 Report",
   *     chapters: [{ content: "..." }, { content: "..." }]
   *   },
   *   ["title", "chapters[*].content"]
   * );
   */
  async put(
    namespace: string[],
    key: string,
    value: Record<string, any>,
    index?: false | string[]
  ): Promise<void> {
    validateNamespace(namespace);

    const doc: StoreItem = {
      namespace,
      key: namespace.join("/"),
      // /** prefixes: ["a","a/b","a/b/c"] */
      // prefixes: string[];
      // /** depth: ns.length */
      // depth: number;
      value,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const upsertQuery = {
      key,
    };
    await this.db
      .collection(this.storeCollectionName)
      .updateOne(upsertQuery, { $set: doc }, { upsert: true });
  }
}

import {
  BaseStore,
  type Item,
  type OperationResults,
  type Operation,
  type MatchCondition,
  type ListNamespacesOperation,
  type PutOperation,
  type SearchOperation,
  type GetOperation,
  // type IndexConfig,
  // type SearchItem
} from "@langchain/langgraph";
import { tokenizePath, compareValues, getTextAtPath } from "./utils.js";
import {
  type ObjectId,
  type MongoClient,
  type Db as MongoDatabase,
  type FindOneOptions,
  type Abortable,
  type Filter,
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

  /** type guard is PutOperation */
  private isPutOperation(op: Operation): op is PutOperation {
    return "value" in op && "namespace" in op && "key" in op;
  }

  /** type guard is GetOperation  */
  private isGetOperation(op: Operation): op is GetOperation {
    return (
      "namespace" in op &&
      "key" in op &&
      !("value" in op) &&
      !("namespacePrefix" in op)
    );
  }
  /** type guard is SearchOperation  */
  private isSearchOperation(op: Operation): op is SearchOperation {
    return "namespacePrefix" in op;
  }
  /** type guard is ListNamespacesOperation  */
  private isListNamespacesOperation(
    op: Operation
  ): op is ListNamespacesOperation {
    return "limit" in op && "offset" in op && !("namespace" in op);
  }

  async batch<Op extends readonly Operation[]>(
    operations: Op
  ): Promise<OperationResults<Op>> {
    const promises = operations.map((operation) => {
      if (this.isPutOperation(operation)) {
        // 類型現在是 PutOperation
        const { namespace, key, value } = operation;

        validateNamespace(namespace);

        const doc: StoreItem = {
          namespace,
          key,
          value: value ?? {},
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const upsertQuery = {
          namespace,
          key,
        };
        return this.db
          .collection(this.storeCollectionName)
          .updateOne(upsertQuery, { $set: doc }, { upsert: true });
      }
      if (this.isGetOperation(operation)) {
        // 類型現在是 GetOperation
        const { namespace, key } = operation;

        validateNamespace(namespace);

        const filterQuery = {
          namespace,
          key,
        };

        return this.db0.collection<Item>(this.storeCollectionName);

        (1).findOne(filterQuery);
      }
      if (this.isSearchOperation(operation)) {
        // 類型現在是 PutOperation
        return this.db.collection<Item>(this.storeCollectionName).findOne({});
      }
      // if (this.isListNamespacesOperation(operation)) {
      // 類型現在是 PutOperation
      return this.db.collection<Item>(this.storeCollectionName).findOne({});
      // }
    });

    const res = await Promise.all(promises);

    return res as OperationResults<Op>;
    // return [] as OperationResults<Op>;
  }

  /**
   * Retrieve a single item by its namespace and key.
   *
   * @param namespace Hierarchical path for the item
   * @param key Unique identifier within the namespace
   * @returns Promise resolving to the item or null if not found
   */
  async get(namespace: string[], key: string): Promise<Item | null> {
    const filterQuery = {
      namespace,
      key,
    };

    const doc = await this.db
      .collection<Item>(this.storeCollectionName)
      .findOne(filterQuery);

    return doc;
  }

  async find(
    namespace: string[],
    key: string,
    query: Filter<Item>,
    option: Omit<FindOneOptions, "timeoutMode"> & Abortable
  ): Promise<Item | null> {
    const filterQuery = {
      namespace,
      key,
      ...query,
    };

    const doc = await this.db
      .collection<Item>(this.storeCollectionName)
      .findOne(filterQuery, option);

    return doc;
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
      key,
      value,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const upsertQuery = {
      namespace,
      key,
    };
    await this.db
      .collection(this.storeCollectionName)
      .updateOne(upsertQuery, { $set: doc }, { upsert: true });
  }
}

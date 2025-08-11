import "dotenv/config";
import fs from "node:fs";
import pdf from "pdf-parse";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone as PineconeClient } from "@pinecone-database/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";

console.log("process.env.PINECONE_INDEX", process.env.PINECONE_INDEX);
console.log("process.env.PINECONE_API_KEY", process.env.PINECONE_API_KEY);
const embedding = async () => {
  try {
    const dataBuffer = fs.readFileSync("slave.pdf"); // 替換成你的 PDF 路徑

    const pdfData = await pdf(dataBuffer).then(function (data) {
      return data;
    });

    // console.log("✅ PDF 提取完成", pdfData);

    const text_splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 200,
      chunkOverlap: 50,
      // chunkSize: number;
      // chunkOverlap: number;
      // keepSeparator: boolean;
      // lengthFunction?: ((text: string) => number) | ((text: string) => Promise<number>);
    });
    const documents = await text_splitter.splitDocuments([
      new Document({
        pageContent: pdfData.text,
        // metadata: { source: "pdf" },
      }),
    ]);

    const embeddings = new OpenAIEmbeddings({
      model: "text-embedding-3-large",
      dimensions: 1024,
    });

    const pinecone = new PineconeClient();

    // Will automatically read the PINECONE_API_KEY env var
    const indexName = process.env.PINECONE_INDEX?.trim() || "penny-dev";
    console.log("使用的 index 名稱:", indexName);
    const pineconeIndex = pinecone.Index(indexName);

    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex,
      // Maximum number of batch requests to allow at once. Each batch is 1000 vectors.
      maxConcurrency: 5,
      // You can pass a namespace here too
      // namespace: "foo",
    });

    await vectorStore.addDocuments(documents);

    console.log("✅ 分割完成", documents);
  } catch (error) {
    console.error("❌ 錯誤:", error);
  }
};

embedding();

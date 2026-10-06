import "dotenv/config";

// This module must be the first runtime import in each PostgreSQL integration test.
// Select the database before any module can construct the shared Prisma client.
const configured = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!configured) throw new Error("Configure TEST_DATABASE_URL com um PostgreSQL migrado para executar os testes de integração.");
const testUrl = new URL(configured);
if (!process.env.TEST_DATABASE_URL) {
  if (!["localhost", "127.0.0.1"].includes(testUrl.hostname)) {
    throw new Error("Configure TEST_DATABASE_URL explicitamente para usar um banco de testes remoto.");
  }
  testUrl.pathname = "/restaurante_test";
}
process.env.DATABASE_URL = testUrl.toString();\n
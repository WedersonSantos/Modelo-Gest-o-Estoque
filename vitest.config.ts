import "dotenv/config";
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
if(process.argv.some(arg=>arg.includes("tests/integration"))){
 const url=new URL(process.env.TEST_DATABASE_URL??process.env.DATABASE_URL??"postgresql://restaurante:restaurante_local@127.0.0.1:55432/restaurante_test");
 if(!process.env.TEST_DATABASE_URL)url.pathname="/restaurante_test";
 process.env.DATABASE_URL=url.toString();
}
export default defineConfig({ resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } }, test: { environment: "node", testTimeout: 20000, hookTimeout: 30000 } });

import "dotenv/config";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
const configured=process.env.TEST_DATABASE_URL;
const url=new URL(configured??process.env.DATABASE_URL??"postgresql://restaurante:restaurante_local@127.0.0.1:55432/restaurante_test");
if(!configured)url.pathname="/restaurante_test";
if(url.toString()===process.env.DATABASE_URL)throw new Error("O banco de testes deve ser diferente do banco da aplicação.");
const r=spawnSync(process.execPath,[resolve("node_modules/prisma/build/index.js"),"migrate","deploy"],{stdio:"inherit",env:{...process.env,DATABASE_URL:url.toString(),DIRECT_URL:url.toString()}});
process.exit(r.status??1);

// Uso: node app/tests/ferramentas/hash_pacote.mjs <arquivo.vistoria> — imprime o hash calculado pelo app.
import { readFileSync } from "node:fs";
import { hashPacote } from "../../js/pacote.js";

const pacote = JSON.parse(readFileSync(process.argv[2], "utf8"));
console.log(await hashPacote(pacote));

// Imprime o vistoria.json da vistoria fictícia (teste de contrato com o PC, tests/test_app_js.py).
import { exportarVistoria } from "../../js/estado.js";
import { montarDemo } from "./demo.mjs";

process.stdout.write(JSON.stringify(exportarVistoria(montarDemo())));

import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Cifragem de credencial de terceiro guardada no banco (hoje: a chave da conta
// Asaas de cada negócio, ver lib/tenant-asaas.ts). AES-256-GCM: além de cifrar,
// autentica — chave adulterada no banco falha ao decifrar em vez de virar lixo.
//
// APP_ENCRYPTION_KEY = 32 bytes em base64. Trocar a chave invalida o que já
// está gravado: os negócios teriam que reconectar a conta.

const FORMATO = "v1"; // v1:<iv>:<tag>:<dados>, tudo em base64

function chave(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "APP_ENCRYPTION_KEY não configurada — sem ela não dá pra guardar credencial de pagamento.",
    );
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error("APP_ENCRYPTION_KEY precisa ter 32 bytes em base64.");
  }
  return buf;
}

export function encryptSecret(texto: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", chave(), iv);
  const dados = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  return [
    FORMATO,
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    dados.toString("base64"),
  ].join(":");
}

export function decryptSecret(guardado: string): string {
  const [versao, iv, tag, dados] = guardado.split(":");
  if (versao !== FORMATO || !iv || !tag || !dados) {
    throw new Error("Credencial guardada em formato desconhecido.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    chave(),
    Buffer.from(iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dados, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** Só os últimos dígitos, pra mostrar no painel sem expor a chave. */
export function mascararChave(apiKey: string): string {
  return `••••${apiKey.slice(-6)}`;
}

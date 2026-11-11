// Gera JWT_SECRET e as chaves anon/service_role (HS256), formato Supabase.
import crypto from "node:crypto";
const secret = process.argv[2] || crypto.randomBytes(32).toString("hex");
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const sign = (role) => {
  const h = b64({ alg: "HS256", typ: "JWT" });
  const p = b64({ role, iss: "supabase", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 3600 });
  const s = crypto.createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url");
  return `${h}.${p}.${s}`;
};
console.log(`JWT_SECRET=${secret}\nANON_KEY=${sign("anon")}\nSERVICE_ROLE_KEY=${sign("service_role")}`);

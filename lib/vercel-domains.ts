const TOKEN = process.env.VERCEL_ACCESS_TOKEN;
const PROJECT_ID = "prj_oUYIGT4imZWXgb7ut1Q63q1HcavU";
const TEAM_ID = "team_hq2j9eG1LqfOoElKKd0UZrYO";

const BASE = `https://api.vercel.com/v10/projects/${PROJECT_ID}/domains?teamId=${TEAM_ID}`;

export async function addVercelDomain(domain: string): Promise<void> {
  if (!TOKEN) return;
  await fetch(BASE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: domain }),
  });
}

export async function removeVercelDomain(domain: string): Promise<void> {
  if (!TOKEN) return;
  await fetch(
    `https://api.vercel.com/v10/projects/${PROJECT_ID}/domains/${domain}?teamId=${TEAM_ID}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${TOKEN}` },
    },
  );
}

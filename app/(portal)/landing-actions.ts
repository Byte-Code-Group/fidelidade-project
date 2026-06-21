"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

export async function submitLead(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const business = String(formData.get("business") ?? "").trim();
  const segment = String(formData.get("segment") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!name || !email || !business || !segment) {
    redirect("/?error=campos");
  }

  const db = createAdminClient();
  await db.from("leads").insert({ name, email, business, segment, phone: phone || null });

  // Notifica o admin da plataforma
  await sendEmail({
    to: "gustavo.junio2003@gmail.com",
    subject: `Novo lead: ${business} (${segment})`,
    html: `
      <p><strong>Nome:</strong> ${name}</p>
      <p><strong>E-mail:</strong> ${email}</p>
      <p><strong>Negócio:</strong> ${business}</p>
      <p><strong>Segmento:</strong> ${segment}</p>
      ${phone ? `<p><strong>Telefone:</strong> ${phone}</p>` : ""}
    `,
  });

  redirect("/?enviado=1");
}

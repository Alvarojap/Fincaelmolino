import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import webpush from "npm:web-push@3.6.7";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;

webpush.setVapidDetails("mailto:admin@fincaelmolino.com", VAPID_PUBLIC, VAPID_PRIVATE);

const headers = {
  "Content-Type": "application/json",
  apikey: SB_SERVICE_KEY,
  Authorization: `Bearer ${SB_SERVICE_KEY}`,
};

async function sbGet(path: string) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function sbPost(table: string, body: unknown) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

serve(async () => {
  try {
    // Calculate tomorrow's date in Europe/Madrid timezone
    const now = new Date();
    const madrid = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
    const tomorrow = new Date(madrid);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const fechaManana = tomorrow.toISOString().split("T")[0];

    // Get pending visits for tomorrow
    const visitas = await sbGet(
      `visitas?select=*&estado=eq.pendiente&fecha=eq.${fechaManana}`
    );

    if (!visitas.length) {
      return new Response(JSON.stringify({ ok: true, msg: "No hay visitas mañana" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get admin and comercial users
    const usuarios = await sbGet(
      `usuarios?select=id,nombre,rol&or=(rol.eq.admin,rol.eq.comercial)`
    );
    const userIds = usuarios.map((u: { id: string }) => u.id);

    if (!userIds.length) {
      return new Response(JSON.stringify({ ok: true, msg: "No hay usuarios admin/comercial" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get push subscriptions for those users
    const subs = await sbGet(
      `push_subscriptions?select=*&user_id=in.(${userIds.join(",")})`
    );

    // Build notification content
    const lineas = visitas.map(
      (v: { hora: string; nombre: string; tipo_evento: string; invitados: number }) =>
        `• ${v.hora?.slice(0, 5) || "Sin hora"} — ${v.nombre} (${v.tipo_evento}${v.invitados ? `, ~${v.invitados} inv.` : ""})`
    );
    const body =
      visitas.length === 1
        ? `Mañana tienes una visita:\n${lineas[0]}`
        : `Mañana tienes ${visitas.length} visitas:\n${lineas.join("\n")}`;

    const payload = JSON.stringify({
      title: "📋 Recordatorio de visita",
      body,
      tag: "recordatorio-visita",
    });

    // Send web push to each subscription
    let enviados = 0;
    let errores = 0;
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        );
        enviados++;
      } catch (err: unknown) {
        errores++;
        // If subscription expired/invalid, delete it
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await fetch(
            `${SB_URL}/rest/v1/push_subscriptions?id=eq.${sub.id}`,
            { method: "DELETE", headers }
          );
        }
      }
    }

    // Create in-app notifications for each user
    for (const u of usuarios) {
      await sbPost("notificaciones", { para: u.id, txt: body });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        visitas: visitas.length,
        pushEnviados: enviados,
        pushErrores: errores,
        notificacionesCreadas: usuarios.length,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

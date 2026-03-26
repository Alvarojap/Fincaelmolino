import { useState, useEffect, useRef, useCallback } from "react";

// ─── SUPABASE ────────────────────────────────────────────────────────────────
const SB_URL = "https://bqubxkuuyohuatdothwx.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxdWJ4a3V1eW9odWF0ZG90aHd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NTE0MzgsImV4cCI6MjA5MDAyNzQzOH0.kwYPiTj0KOmw9RAm88DNceAYdFC3yHF4ogSzXXwSIDA";

const HDR = { "Content-Type": "application/json", "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}` };
const HDRA = (tok) => ({ ...HDR, "Authorization": `Bearer ${tok}` });

// REST helpers
async function sbGet(table, params = "", tok = SB_KEY) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}${params}`, { headers: HDRA(tok) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function sbPost(table, body, tok = SB_KEY) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: "POST", headers: { ...HDRA(tok), "Prefer": "return=representation" },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function sbPatch(table, filter, body, tok = SB_KEY) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${filter}`, {
    method: "PATCH", headers: { ...HDRA(tok), "Prefer": "return=representation" },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function sbDelete(table, filter, tok = SB_KEY) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${filter}`, {
    method: "DELETE", headers: HDRA(tok)
  });
  if (!r.ok) throw new Error(await r.text());
}
async function sbUpsert(table, body, tok = SB_KEY) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: "POST", headers: { ...HDRA(tok), "Prefer": "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// Auth helpers
async function authLogin(email, password) {
  const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: HDR, body: JSON.stringify({ email, password })
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error_description || d.message || "Error de login");
  return d; // { access_token, user, ... }
}
async function authLogout(tok) {
  await fetch(`${SB_URL}/auth/v1/logout`, { method: "POST", headers: HDRA(tok) });
}

// Storage: subir foto
async function uploadFoto(file, tok) {
  const ext = file.name.split(".").pop();
  const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const r = await fetch(`${SB_URL}/storage/v1/object/fotos/${path}`, {
    method: "POST", headers: { "apikey": SB_KEY, "Authorization": `Bearer ${tok}`, "Content-Type": file.type },
    body: file
  });
  if (!r.ok) throw new Error(await r.text());
  return `${SB_URL}/storage/v1/object/public/fotos/${path}`;
}

// Realtime subscription
function sbSubscribe(table, filter, onEvent) {
  const chan = `realtime:public:${table}${filter ? ":" + filter : ""}`;
  const ws = new WebSocket(`${SB_URL.replace("https", "wss")}/realtime/v1/websocket?apikey=${SB_KEY}&vsn=1.0.0`);
  ws.onopen = () => {
    ws.send(JSON.stringify({ topic: "realtime:public", event: "phx_join", payload: {}, ref: null }));
    ws.send(JSON.stringify({
      topic: chan, event: "phx_join",
      payload: { config: { broadcast: { self: true }, presence: { key: "" } } }, ref: null
    }));
  };
  ws.onmessage = (e) => {
    try { const d = JSON.parse(e.data); if (d.event === "INSERT" || d.event === "UPDATE" || d.event === "DELETE") onEvent(d); } catch(_) {}
  };
  return () => ws.close();
}

// ─── DATOS ESTÁTICOS ─────────────────────────────────────────────────────────
// ── Función que detecta la temporada según el mes actual
function getTemporada() {
  const m = new Date().getMonth() + 1;
  if (m >= 4 && m <= 5)  return "primavera";
  if (m >= 6 && m <= 9)  return "verano";
  return "invierno";
}

const TEMPORADA_LBL = {
  primavera: "🌸 Primavera (Abril–Mayo)",
  verano:    "☀️ Verano (Junio–Septiembre)",
  invierno:  "🍂 Invierno (Octubre–Marzo)",
};

const JARDIN_T = {
  primavera: [
    { id:"p1",  txt:"Riego semanal completado (césped + plantas + revisión zonas)", zona:"Riego",   frec:1 },
    { id:"p2",  txt:"Cortar césped",                                                zona:"Césped",  frec:1 },
    { id:"p3",  txt:"Perfilar bordes del césped",                                   zona:"Césped",  frec:1 },
    { id:"p4",  txt:"Soplado general (hojas, ramas, suciedad)",                     zona:"General", frec:1 },
    { id:"p5",  txt:"Limpiar camino de entrada",                                    zona:"Accesos", frec:1 },
    { id:"p6",  txt:"Limpiar porche zona baños y BBQ",                              zona:"Porche",  frec:1 },
    { id:"p7",  txt:"Vaciar papeleras",                                             zona:"General", frec:1 },
    { id:"p8",  txt:"Limpiar piscina (superficie + fondo rápido)",                  zona:"Piscina", frec:1 },
    { id:"p9",  txt:"Reponer cloro piscina",                                        zona:"Piscina", frec:1 },
    { id:"p10", txt:"Eliminar malas hierbas visibles",                              zona:"General", frec:1 },
    { id:"p11", txt:"Revisión general visual del jardín",                           zona:"General", frec:1 },
    { id:"p12", txt:"Abonar césped",                                                zona:"Césped",  frec:2 },
    { id:"p13", txt:"Limpieza profunda de grava (nivelar + retirar suciedad)",      zona:"Grava",   frec:2 },
    { id:"p14", txt:"Limpieza de bordes y rincones",                                zona:"General", frec:2 },
    { id:"p15", txt:"Recoger manguera (bien enrollada)",                            zona:"Cierre",  frec:1 },
    { id:"p16", txt:"Recoger herramientas y material",                              zona:"Cierre",  frec:1 },
    { id:"p17", txt:"Dejar jardín limpio y ordenado",                               zona:"Cierre",  frec:1 },
  ],
  verano: [
    { id:"v1",  txt:"Riego diario completado (césped + plantas, mañana o noche)",   zona:"Riego",   frec:1 },
    { id:"v2",  txt:"Revisión visual rápida + retirar hojas y suciedad",            zona:"General", frec:1 },
    { id:"v3",  txt:"Cortar césped",                                                zona:"Césped",  frec:1 },
    { id:"v4",  txt:"Perfilar bordes",                                              zona:"Césped",  frec:1 },
    { id:"v5",  txt:"Soplado general",                                              zona:"General", frec:1 },
    { id:"v6",  txt:"Limpiar camino de entrada",                                    zona:"Accesos", frec:1 },
    { id:"v7",  txt:"Limpiar porche zona baños y BBQ",                              zona:"Porche",  frec:1 },
    { id:"v8",  txt:"Limpiar piscina (fondo + paredes)",                            zona:"Piscina", frec:1 },
    { id:"v9",  txt:"Ajustar cloro y pH",                                           zona:"Piscina", frec:1 },
    { id:"v10", txt:"Limpiar y ordenar zona piscina",                               zona:"Piscina", frec:1 },
    { id:"v11", txt:"Vaciar papeleras",                                             zona:"General", frec:1 },
    { id:"v12", txt:"Eliminar malas hierbas visibles",                              zona:"General", frec:1 },
    { id:"v13", txt:"Eliminación profunda de malas hierbas (raíz)",                 zona:"General", frec:2 },
    { id:"v14", txt:"Limpieza y nivelado de grava",                                 zona:"Grava",   frec:2 },
    { id:"v15", txt:"Limpieza de drenajes y rejillas",                              zona:"General", frec:2 },
    { id:"v16", txt:"Abonar césped",                                                zona:"Césped",  frec:4 },
    { id:"v17", txt:"Revisión de ramas secas o caídas",                             zona:"General", frec:4 },
    { id:"v18", txt:"Limpieza profunda de pavimentos (manchas)",                    zona:"Accesos", frec:4 },
    { id:"v19", txt:"Recoger manguera",                                             zona:"Cierre",  frec:1 },
    { id:"v20", txt:"Recoger herramientas",                                         zona:"Cierre",  frec:1 },
    { id:"v21", txt:"Dejar todo perfecto visualmente",                              zona:"Cierre",  frec:1 },
  ],
  invierno: [
    { id:"i1",  txt:"Riego semanal (según clima)",                                  zona:"Riego",   frec:1 },
    { id:"i2",  txt:"Soplado de hojas",                                             zona:"General", frec:1 },
    { id:"i3",  txt:"Limpiar camino de entrada",                                    zona:"Accesos", frec:1 },
    { id:"i4",  txt:"Limpiar porche zona baños y BBQ",                              zona:"Porche",  frec:1 },
    { id:"i5",  txt:"Limpieza general del jardín",                                  zona:"General", frec:1 },
    { id:"i6",  txt:"Vaciar papeleras",                                             zona:"General", frec:1 },
    { id:"i7",  txt:"Limpiar piscina",                                              zona:"Piscina", frec:2 },
    { id:"i8",  txt:"Ajustar cloro",                                                zona:"Piscina", frec:2 },
    { id:"i9",  txt:"Revisar estado del agua",                                      zona:"Piscina", frec:2 },
    { id:"i10", txt:"Eliminar malas hierbas visibles",                              zona:"General", frec:2 },
    { id:"i11", txt:"Cortar césped",                                                zona:"Césped",  frec:4 },
    { id:"i12", txt:"Perfilar bordes",                                              zona:"Césped",  frec:4 },
    { id:"i13", txt:"Limpieza profunda de grava",                                   zona:"Grava",   frec:4 },
    { id:"i14", txt:"Revisión general del jardín",                                  zona:"General", frec:4 },
    { id:"i15", txt:"Poda de árboles",                                              zona:"Árboles", frec:12 },
    { id:"i16", txt:"Recorte de setos",                                             zona:"Setos",   frec:12 },
    { id:"i17", txt:"Re-siembra de césped",                                         zona:"Césped",  frec:12 },
    { id:"i18", txt:"Abonado de recuperación",                                      zona:"General", frec:12 },
    { id:"i19", txt:"Limpieza profunda general",                                    zona:"General", frec:12 },
    { id:"i20", txt:"Recoger manguera",                                             zona:"Cierre",  frec:1 },
    { id:"i21", txt:"Recoger herramientas",                                         zona:"Cierre",  frec:1 },
    { id:"i22", txt:"Dejar todo ordenado",                                          zona:"Cierre",  frec:1 },
  ],
};

const JARDIN_CONTROL_FINAL = [
  { id:"cf1", txt:"No hay hojas visibles" },
  { id:"cf2", txt:"No hay malas hierbas visibles" },
  { id:"cf3", txt:"Césped uniforme" },
  { id:"cf4", txt:"Grava limpia y nivelada" },
  { id:"cf5", txt:"Camino limpio" },
  { id:"cf6", txt:"Porche limpio" },
  { id:"cf7", txt:"Piscina limpia" },
  { id:"cf8", txt:"No hay herramientas visibles" },
  { id:"cf9", txt:"Manguera recogida" },
];

const FREC_LBL = { 1:"Cada semana", 2:"Cada 2 semanas", 4:"Cada mes", 12:"Trimestral" };

const LIMP_T = [
  // INICIO
  { id:"l1",  txt:"Ventilar toda la casa (abrir ventanas)",          zona:"General"      },
  { id:"l2",  txt:"Revisar objetos olvidados",                       zona:"General"      },
  { id:"l3",  txt:"Retirar basura de toda la casa",                  zona:"General"      },
  { id:"l4",  txt:"Recoger ropa de cama y toallas usadas",           zona:"General"      },
  { id:"l5",  txt:"Revisar desperfectos (anotar si hay algo roto)",  zona:"General"      },
  // HABITACIONES
  { id:"l6",  txt:"Hacer camas (sábanas limpias, bien estiradas)",   zona:"Habitaciones" },
  { id:"l7",  txt:"Colocar cojines decorativos",                     zona:"Habitaciones" },
  { id:"l8",  txt:"Dejar toallas por huésped",                       zona:"Habitaciones" },
  { id:"l9",  txt:"Limpiar polvo (mesillas, cabecero, lámparas)",    zona:"Habitaciones" },
  { id:"l10", txt:"Revisar armario (limpio y ordenado)",             zona:"Habitaciones" },
  { id:"l11", txt:"Aspirar suelo y alfombras",                       zona:"Habitaciones" },
  { id:"l12", txt:"Fregar suelo habitaciones",                       zona:"Habitaciones" },
  { id:"l13", txt:"Revisar olor (sin olores)",                       zona:"Habitaciones" },
  // BAÑOS
  { id:"l14", txt:"Limpiar y desinfectar WC completo",               zona:"Baños"        },
  { id:"l15", txt:"Limpiar lavabo y grifo (sin marcas)",             zona:"Baños"        },
  { id:"l16", txt:"Limpiar espejo (sin marcas)",                     zona:"Baños"        },
  { id:"l17", txt:"Limpiar ducha/bañera (sin cal)",                  zona:"Baños"        },
  { id:"l18", txt:"Vaciar papelera baños",                           zona:"Baños"        },
  { id:"l19", txt:"Aspirar y fregar suelo baños",                    zona:"Baños"        },
  { id:"l20", txt:"Colocar toallas limpias",                         zona:"Baños"        },
  { id:"l21", txt:"Reponer papel higiénico (mín. 2 rollos)",         zona:"Baños"        },
  { id:"l22", txt:"Reponer gel y champú",                            zona:"Baños"        },
  // COCINA
  { id:"l23", txt:"Limpiar encimera",                                zona:"Cocina"       },
  { id:"l24", txt:"Limpiar vitro / fogones",                         zona:"Cocina"       },
  { id:"l25", txt:"Limpiar fregadero y grifo",                       zona:"Cocina"       },
  { id:"l26", txt:"Limpiar microondas",                              zona:"Cocina"       },
  { id:"l27", txt:"Limpiar horno (si está sucio)",                   zona:"Cocina"       },
  { id:"l28", txt:"Limpiar exterior electrodomésticos",              zona:"Cocina"       },
  { id:"l29", txt:"Revisar y limpiar nevera (sin restos)",           zona:"Cocina"       },
  { id:"l30", txt:"Revisar vajilla limpia y ordenada",               zona:"Cocina"       },
  { id:"l31", txt:"Vaciar basura cocina",                            zona:"Cocina"       },
  { id:"l32", txt:"Reponer café",                                    zona:"Cocina"       },
  { id:"l33", txt:"Reponer bolsas de basura",                        zona:"Cocina"       },
  { id:"l34", txt:"Barrer/aspirar suelo cocina",                     zona:"Cocina"       },
  { id:"l35", txt:"Fregar suelo cocina",                             zona:"Cocina"       },
  // SALÓN / COMEDOR
  { id:"l36", txt:"Limpiar polvo (mesas, muebles, TV)",              zona:"Salón"        },
  { id:"l37", txt:"Aspirar sofá",                                    zona:"Salón"        },
  { id:"l38", txt:"Aspirar alfombras salón",                         zona:"Salón"        },
  { id:"l39", txt:"Limpiar mesa comedor",                            zona:"Salón"        },
  { id:"l40", txt:"Aspirar suelo salón",                             zona:"Salón"        },
  { id:"l41", txt:"Fregar suelo salón",                              zona:"Salón"        },
  // EXTERIOR
  { id:"l42", txt:"Barrer accesos y entrada",                        zona:"Exterior"     },
  { id:"l43", txt:"Limpiar mobiliario exterior",                     zona:"Exterior"     },
  { id:"l44", txt:"Retirar hojas visibles",                          zona:"Exterior"     },
  { id:"l45", txt:"Limpiar porches",                                 zona:"Exterior"     },
  { id:"l46", txt:"Limpiar barbacoa",                                zona:"Exterior"     },
  // LAVANDERÍA
  { id:"l47", txt:"Llevar sábanas y toallas a la lavandería",        zona:"Lavandería"   },
  { id:"l48", txt:"Recoger sábanas de la lavandería",                zona:"Lavandería"   },
  { id:"l49", txt:"Revisar sábanas antes de almacenar",              zona:"Lavandería"   },
  { id:"l50", txt:"Almacenar sábanas en el almacén",                 zona:"Lavandería"   },
  // REPOSICIÓN GENERAL
  { id:"l51", txt:"Papel higiénico en todos los baños",              zona:"Reposición"   },
  { id:"l52", txt:"Toallas en habitaciones y baños",                 zona:"Reposición"   },
  { id:"l53", txt:"Gel y champú en baños",                           zona:"Reposición"   },
  { id:"l54", txt:"Café en cocina",                                  zona:"Reposición"   },
  { id:"l55", txt:"Bolsas de basura",                                zona:"Reposición"   },
  // CONTROL FINAL
  { id:"l56", txt:"Sin pelos en suelos ni baños",                    zona:"Control final"},
  { id:"l57", txt:"Sin manchas en espejos ni grifos",                zona:"Control final"},
  { id:"l58", txt:"Camas perfectas (sin arrugas)",                   zona:"Control final"},
  { id:"l59", txt:"Cocina limpia y ordenada",                        zona:"Control final"},
  { id:"l60", txt:"Casa huele bien",                                 zona:"Control final"},
  { id:"l61", txt:"Basura retirada",                                 zona:"Control final"},
  { id:"l62", txt:"Luces funcionan",                                 zona:"Control final"},
  { id:"l63", txt:"Puertas y ventanas cerradas",                     zona:"Control final"},
];
const ESTADOS = [
  { id:"visita",             lbl:"Visita realizada",   col:"#6366f1" },
  { id:"pendiente_contrato", lbl:"Pendiente de firma", col:"#f59e0b" },
  { id:"contrato_firmado",   lbl:"Contrato firmado",   col:"#3b82f6" },
  { id:"reserva_pagada",     lbl:"Señal pagada",       col:"#8b5cf6" },
  { id:"precio_total",       lbl:"Total pagado",       col:"#10b981" },
  { id:"finalizada",         lbl:"Finalizado",         col:"#6b7280" },
];
const MESES  = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const D_SEM  = ["L","M","X","J","V","S","D"];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function wkNum(d = new Date()) {
  const j = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - j) / 86400000 + j.getDay() + 1) / 7);
}
function wkKey(d) { const dd = d || new Date(); return `${dd.getFullYear()}-W${wkNum(dd)}`; }
function tocaSemana(t, wk) {
  const w = parseInt(wk.split("-W")[1]);
  return (w - (t.ini || 1)) >= 0 && (w - (t.ini || 1)) % t.frec === 0;
}
function fmtDT(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return `${d.toLocaleDateString("es-ES")} ${d.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}`;
}

// ─── WEB PUSH ────────────────────────────────────────────────────────────────
let swReg = null;
async function regSW() {
  if (!("serviceWorker" in navigator)) return;
  try { swReg = await navigator.serviceWorker.register("/sw.js"); } catch(_) {}
}
async function askPerm() {
  if (!("Notification" in window)) return "denied";
  if (Notification.permission === "granted") return "granted";
  return Notification.requestPermission();
}
function sendPush(title, body, tag = "molino") {
  if (swReg?.active) swReg.active.postMessage({ type:"NOTIFY", title, body, tag });
  else if (Notification?.permission === "granted") {
    try { new Notification(title, { body, tag }); } catch(_) {}
  }
}

// ─── LOGO SVG ────────────────────────────────────────────────────────────────
function MolinoLogo({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{display:"inline-block",verticalAlign:"middle",flexShrink:0}}>
      <path d="M42 100 L58 100 L55 55 L45 55 Z" fill="#c9a84c" opacity=".9"/>
      <circle cx="50" cy="52" r="6" fill="#c9a84c"/>
      <path d="M50 46 C48 36 44 20 46 8 C47 4 53 4 54 8 C56 20 52 36 50 46Z" fill="#c9a84c"/>
      <path d="M56 52 C66 50 82 46 94 48 C98 49 98 55 94 56 C82 58 66 54 56 52Z" fill="#c9a84c" opacity=".85"/>
      <path d="M50 58 C52 68 56 84 54 96 C53 100 47 100 46 96 C44 84 48 68 50 58Z" fill="#c9a84c" opacity=".7"/>
      <path d="M44 52 C34 54 18 58 6 56 C2 55 2 49 6 48 C18 46 34 50 44 52Z" fill="#c9a84c" opacity=".55"/>
    </svg>
  );
}

// ─── CSS ─────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{height:100%}
body{font-family:'DM Sans',sans-serif;background:#0f1117;color:#e8e6e1;min-height:100vh;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#13161f}::-webkit-scrollbar-thumb{background:#c9a84c;border-radius:2px}

.app{display:flex;min-height:100vh;min-height:100dvh}
.main{flex:1;min-width:0;display:flex;flex-direction:column;overflow-x:hidden}

.sb{width:248px;min-width:248px;background:#13161f;border-right:1px solid rgba(201,168,76,.15);
  display:flex;flex-direction:column;position:sticky;top:0;height:100vh;height:100dvh;overflow-y:auto;flex-shrink:0}
.sb-logo{padding:20px 18px 15px;border-bottom:1px solid rgba(201,168,76,.1)}
.sb-logo h1{font-family:'Playfair Display',serif;font-size:17px;color:#c9a84c;margin-top:2px}
.sb-logo p{font-size:10px;color:#5a5e6e;margin-top:2px;text-transform:uppercase;letter-spacing:1.5px}
.sb-nav{flex:1;padding:10px 8px;overflow-y:auto}
.nav-sec{font-size:10px;color:#3d4155;text-transform:uppercase;letter-spacing:2px;padding:10px 11px 5px;margin-top:4px}
.nw{position:relative}
.nb{display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:8px;cursor:pointer;
  font-size:13px;color:#7a7f94;transition:all .15s;border:none;background:none;
  width:100%;text-align:left;font-family:'DM Sans',sans-serif;margin-bottom:2px}
.nb:hover{background:rgba(201,168,76,.06);color:#c9c5b8}
.nb.on{background:rgba(201,168,76,.12);color:#c9a84c;font-weight:500}
.nb-ico{font-size:15px;width:20px;text-align:center;flex-shrink:0}
.nb-badge{position:absolute;top:6px;right:8px;background:#e85555;color:#fff;
  border-radius:20px;padding:1px 6px;font-size:10px;font-weight:700;min-width:16px;text-align:center;pointer-events:none}
.sb-user{padding:13px 14px;border-top:1px solid rgba(201,168,76,.1);display:flex;align-items:center;gap:10px;flex-shrink:0}
.av{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#c9a84c,#8b6914);
  display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0}
.uname{font-size:12px;font-weight:500;color:#c9c5b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.urole{font-size:10px;color:#5a5e6e;text-transform:capitalize;margin-top:1px}
.logout-btn{background:none;border:none;cursor:pointer;color:#5a5e6e;font-size:16px;padding:4px;transition:color .2s;flex-shrink:0;line-height:1}
.logout-btn:hover{color:#e85555}

.mob-top{display:none;position:sticky;top:0;z-index:150;background:#13161f;
  border-bottom:1px solid rgba(201,168,76,.12);padding:0 16px;height:52px;
  align-items:center;justify-content:space-between}
.mob-top-title{font-family:'Playfair Display',serif;font-size:15px;color:#c9a84c}
.mob-menu-btn{background:none;border:none;color:#c9c5b8;font-size:24px;cursor:pointer;
  padding:6px;display:flex;align-items:center;justify-content:center;border-radius:8px;line-height:1}
.mob-notif-dot{background:#e85555;color:#fff;border-radius:20px;padding:2px 8px;font-size:11px;font-weight:700}

.drawer-overlay{position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:300;backdrop-filter:blur(2px)}
.drawer{position:fixed;left:0;top:0;bottom:0;width:min(280px,85vw);background:#13161f;
  z-index:400;display:flex;flex-direction:column;overflow-y:auto;
  transform:translateX(-100%);transition:transform .24s cubic-bezier(.4,0,.2,1);
  box-shadow:6px 0 32px rgba(0,0,0,.5)}
.drawer.open{transform:translateX(0)}

.mob-bar{display:none;position:fixed;bottom:0;left:0;right:0;z-index:200;
  background:#13161f;border-top:1px solid rgba(201,168,76,.15);
  padding:6px 8px;padding-bottom:max(6px,env(safe-area-inset-bottom))}
.mob-bar-inner{display:flex;justify-content:space-around;align-items:center}
.mob-btn{display:flex;flex-direction:column;align-items:center;gap:3px;padding:5px 8px;
  border:none;background:none;cursor:pointer;color:#5a5e6e;font-size:10px;
  font-family:'DM Sans',sans-serif;border-radius:10px;transition:color .15s;
  min-width:48px;position:relative;-webkit-tap-highlight-color:transparent}
.mob-btn.on{color:#c9a84c}
.mob-btn.on .mico{transform:scale(1.1)}
.mico{font-size:22px;line-height:1;transition:transform .15s}
.mob-badge{position:absolute;top:1px;right:4px;background:#e85555;color:#fff;
  border-radius:10px;padding:1px 5px;font-size:9px;font-weight:700;min-width:14px;text-align:center}

.ph{padding:26px 32px 20px;border-bottom:1px solid rgba(255,255,255,.05);flex-shrink:0}
.ph h2{font-family:'Playfair Display',serif;font-size:24px;color:#e8e6e1;font-weight:400}
.ph p{color:#5a5e6e;font-size:13px;margin-top:4px}
.pb{padding:24px 32px}

.card{background:#13161f;border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:20px}
.cal-card{background:#13161f;border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:16px}
.chdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;gap:8px}
.ctit{font-size:14px;font-weight:600;color:#c9c5b8}

.btn{padding:8px 16px;border-radius:8px;border:none;cursor:pointer;font-size:13px;font-weight:500;
  font-family:'DM Sans',sans-serif;transition:all .15s;display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.bp{background:#c9a84c;color:#0f1117}.bp:hover{background:#dbb95e}
.bg{background:rgba(255,255,255,.06);color:#c9c5b8;border:1px solid rgba(255,255,255,.1)}.bg:hover{background:rgba(255,255,255,.1)}
.br{background:rgba(232,85,85,.12);color:#e85555;border:1px solid rgba(232,85,85,.2)}.br:hover{background:rgba(232,85,85,.2)}
.sm{padding:6px 12px;font-size:12px}

.fg{margin-bottom:14px}
.fg label{display:block;font-size:10px;color:#7a7f94;margin-bottom:6px;text-transform:uppercase;letter-spacing:.8px}
.fi{width:100%;padding:10px 13px;border-radius:8px;border:1px solid rgba(255,255,255,.1);
  background:#0f1117;color:#e8e6e1;font-size:14px;font-family:'DM Sans',sans-serif;outline:none;transition:border-color .2s;
  -webkit-appearance:none;appearance:none}
.fi:focus{border-color:rgba(201,168,76,.5)}
.fi::placeholder{color:#3d4155}
textarea.fi{resize:vertical;min-height:72px;line-height:1.5}
select.fi{cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%235a5e6e' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:36px}
.mft{display:flex;gap:8px;justify-content:flex-end;margin-top:18px;padding-top:16px;border-top:1px solid rgba(255,255,255,.06)}

.ov{position:fixed;inset:0;background:rgba(0,0,0,.78);backdrop-filter:blur(4px);z-index:1000;
  display:flex;align-items:center;justify-content:center;padding:16px}
.modal{background:#13161f;border:1px solid rgba(201,168,76,.2);border-radius:14px;
  padding:28px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto}
.modal h3{font-family:'Playfair Display',serif;font-size:20px;color:#e8e6e1;margin-bottom:20px}

.cli{display:flex;align-items:flex-start;gap:10px;padding:12px;border-radius:10px;
  border:1px solid rgba(255,255,255,.05);background:#0f1117;margin-bottom:6px}
.cli.done{opacity:.6;background:rgba(16,185,129,.04);border-color:rgba(16,185,129,.12)}
.chk{width:22px;height:22px;border-radius:6px;flex-shrink:0;border:2px solid rgba(255,255,255,.15);
  cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;margin-top:1px}
.chk.on{background:#10b981;border-color:#10b981}
.chk.on::after{content:"✓";color:#fff;font-size:12px;font-weight:700}
.tz{display:inline-block;font-size:10px;padding:2px 7px;border-radius:20px;
  background:rgba(201,168,76,.1);color:#c9a84c;margin-bottom:3px}
.tl{font-size:13px;color:#c9c5b8;line-height:1.4}
.tl.done{text-decoration:line-through;color:#5a5e6e}
.tm{font-size:11px;color:#5a5e6e;margin-top:2px;line-height:1.4}
.nbox{background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.15);border-radius:7px;
  padding:8px 11px;margin-top:6px;font-size:12px;color:#d4a843;line-height:1.4}
.rbox{background:rgba(16,185,129,.06);border:1px solid rgba(16,185,129,.18);border-radius:7px;
  padding:8px 11px;margin-top:6px;font-size:12px;color:#10b981;line-height:1.4}
.ibtn{display:inline-flex;align-items:center;gap:4px;background:rgba(245,158,11,.1);color:#f59e0b;
  border:1px solid rgba(245,158,11,.2);border-radius:20px;padding:4px 9px;font-size:11px;
  cursor:pointer;white-space:nowrap;transition:background .15s;flex-shrink:0;font-family:'DM Sans',sans-serif}
.ibtn:hover{background:rgba(245,158,11,.18)}

.pbtn{display:flex;align-items:center;justify-content:center;gap:7px;padding:11px 16px;
  border-radius:8px;cursor:pointer;background:rgba(201,168,76,.07);color:#c9a84c;
  border:1px dashed rgba(201,168,76,.3);font-size:14px;font-family:'DM Sans',sans-serif;
  font-weight:500;transition:background .2s;width:100%}
.pbtn:hover{background:rgba(201,168,76,.13)}
.pprev{width:100%;max-height:220px;object-fit:cover;border-radius:8px;margin-top:10px}
.pthumb{max-width:100%;max-height:160px;border-radius:8px;object-fit:cover;margin-top:6px;display:block}

.sg{display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:12px;margin-bottom:20px}
.sc{background:#13161f;border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:16px}
.sl{font-size:10px;color:#5a5e6e;text-transform:uppercase;letter-spacing:1px;line-height:1.3}
.sv{font-size:24px;font-weight:700;color:#e8e6e1;margin-top:5px;font-family:'Playfair Display',serif}
.ss{font-size:11px;color:#c9a84c;margin-top:3px}
.prog{height:5px;background:rgba(255,255,255,.07);border-radius:3px;overflow:hidden;margin-top:8px}
.pfill{height:100%;border-radius:3px;background:linear-gradient(90deg,#c9a84c,#10b981);transition:width .4s}

.g2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
hr.div{border:none;border-top:1px solid rgba(255,255,255,.06);margin:14px 0}

.badge{display:inline-block;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:500}
.empty{text-align:center;padding:40px 20px;color:#5a5e6e}
.empty .ico{font-size:36px;margin-bottom:8px;display:block}
.alert{padding:10px 13px;border-radius:8px;font-size:13px;margin-bottom:14px;
  background:rgba(232,85,85,.1);color:#e85555;border:1px solid rgba(232,85,85,.2)}
.tabs{display:flex;gap:3px;background:#0f1117;padding:3px;border-radius:9px;margin-bottom:18px}
.tab{padding:8px 14px;border-radius:7px;cursor:pointer;font-size:12px;color:#7a7f94;
  transition:all .15s;border:none;background:none;font-family:'DM Sans',sans-serif;font-weight:500;white-space:nowrap}
.tab.on{background:#13161f;color:#c9a84c;border:1px solid rgba(201,168,76,.2)}

.cg{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-top:10px}
.ch{text-align:center;font-size:10px;color:#5a5e6e;padding:5px 0;text-transform:uppercase;letter-spacing:.5px}
.cd{aspect-ratio:1;border-radius:7px;border:1px solid rgba(255,255,255,.04);
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  font-size:12px;cursor:pointer;transition:all .15s;background:#0f1117}
.cd:hover{border-color:rgba(201,168,76,.3);background:rgba(201,168,76,.05)}
.cd.empty{background:transparent;border-color:transparent;cursor:default}
.cd.today{border-color:rgba(201,168,76,.5);color:#c9a84c;font-weight:600}
.cd.hasev{background:rgba(99,102,241,.12);border-color:rgba(99,102,241,.3)}
.cd.sel{border-color:#c9a84c;background:rgba(201,168,76,.08)}
.cdot{width:5px;height:5px;border-radius:50%;margin-top:2px}
.cnav{display:flex;align-items:center;gap:12px;margin-bottom:10px}
.cnav button{background:none;border:none;color:#c9a84c;cursor:pointer;font-size:20px;padding:4px 8px;border-radius:6px;line-height:1}
.cnav button:hover{background:rgba(201,168,76,.1)}
.cmon{font-family:'Playfair Display',serif;font-size:18px;color:#e8e6e1}

.chat-outer{display:flex;flex-direction:column;flex:1;overflow:hidden}
.chat-wrap{display:flex;flex:1;overflow:hidden;min-height:0}
.chat-list-col{width:220px;flex-shrink:0;border-right:1px solid rgba(255,255,255,.06);overflow-y:auto;display:flex;flex-direction:column}
.cu{display:flex;align-items:center;gap:9px;padding:12px 14px;cursor:pointer;
  border-bottom:1px solid rgba(255,255,255,.04);transition:background .12s;position:relative}
.cu:hover{background:rgba(255,255,255,.03)}
.cu.on{background:rgba(201,168,76,.08)}
.chat-area{flex:1;display:flex;flex-direction:column;min-width:0;min-height:0}
.chdr2{padding:12px 18px;border-bottom:1px solid rgba(255,255,255,.06);display:flex;align-items:center;gap:10px;flex-shrink:0}
.msgs{flex:1;overflow-y:auto;padding:14px 18px;display:flex;flex-direction:column;gap:8px}
.bub{max-width:72%;padding:10px 14px;border-radius:14px;font-size:13px;line-height:1.5;word-break:break-word}
.bub.me{align-self:flex-end;background:#c9a84c;color:#0f1117;border-bottom-right-radius:3px}
.bub.them{align-self:flex-start;background:#1e2130;border:1px solid rgba(255,255,255,.08);color:#c9c5b8;border-bottom-left-radius:3px}
.bmeta{font-size:10px;opacity:.5;margin-top:4px}
.cinp{display:flex;gap:8px;padding:12px 18px;border-top:1px solid rgba(255,255,255,.06);align-items:flex-end;flex-shrink:0}

.nitem{display:flex;gap:10px;padding:13px 16px;border-bottom:1px solid rgba(255,255,255,.05)}
.nitem.unread{background:rgba(201,168,76,.04);border-left:2px solid #c9a84c}
.ndot{width:7px;height:7px;border-radius:50%;background:#c9a84c;flex-shrink:0;margin-top:5px}
.ndot.read{background:#3d4155}

.pbanner{background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.25);border-radius:9px;
  padding:11px 16px;margin:12px 32px 0;display:flex;align-items:center;justify-content:space-between;gap:10px}
.pbanner span{font-size:13px;color:#a5b4fc}

.lw{min-height:100vh;min-height:100dvh;display:flex;align-items:center;justify-content:center;
  background:#0f1117;position:relative;overflow:hidden;padding:16px}
.lbg{position:absolute;inset:0;opacity:.025;
  background-image:repeating-linear-gradient(0deg,transparent,transparent 40px,rgba(201,168,76,1) 40px,rgba(201,168,76,1) 41px),
  repeating-linear-gradient(90deg,transparent,transparent 40px,rgba(201,168,76,1) 40px,rgba(201,168,76,1) 41px)}
.lc{background:#13161f;border:1px solid rgba(201,168,76,.2);border-radius:18px;
  padding:40px 34px;width:100%;max-width:380px;position:relative}
.llo{text-align:center;margin-bottom:28px}
.llo h1{font-family:'Playfair Display',serif;font-size:26px;color:#c9a84c}
.llo p{font-size:10px;color:#5a5e6e;margin-top:6px;text-transform:uppercase;letter-spacing:2px}

.rc{background:#0f1117;border:1px solid rgba(255,255,255,.06);border-radius:12px;
  padding:15px 17px;margin-bottom:8px;cursor:pointer;transition:all .15s;border-left:3px solid transparent}
.rc:hover{background:rgba(201,168,76,.03)}

/* Spinner de carga */
.spin{display:inline-block;width:18px;height:18px;border:2px solid rgba(201,168,76,.2);
  border-top-color:#c9a84c;border-radius:50%;animation:spin .6s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.loading{display:flex;align-items:center;justify-content:center;min-height:200px;color:#5a5e6e;gap:10px;font-size:14px}

/* ══ RESPONSIVE ══ */
@media (min-width:769px){
  .mob-top,.mob-bar,.drawer,.drawer-overlay,.mob-back{display:none!important}
}
@media (max-width:768px){
  .app>.sb{display:none!important;width:0!important;min-width:0!important;overflow:hidden!important}
  .mob-top{display:flex}.mob-bar{display:block}
  .app{flex-direction:column}.main{width:100%;flex:1;overflow-x:hidden}
  .ph{padding:16px 16px 13px}.ph h2{font-size:20px}
  .pb{padding:14px 12px 96px}
  .g2{grid-template-columns:1fr;gap:12px}
  .sg{grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}
  .sv{font-size:20px}.sc{padding:13px}
  .card{padding:14px;border-radius:10px}.chdr{margin-bottom:13px}
  .cli{padding:13px 11px}.chk{width:26px;height:26px;border-radius:7px}.tl{font-size:14px}
  .btn{font-size:14px;padding:10px 16px}.sm{padding:8px 12px;font-size:12px}
  .tabs{overflow-x:auto;-webkit-overflow-scrolling:touch;flex-wrap:nowrap;scrollbar-width:none;margin-bottom:14px}
  .tabs::-webkit-scrollbar{display:none}.tab{padding:8px 16px;font-size:13px;flex-shrink:0}
  .ov{padding:0;align-items:flex-end}
  .modal{border-radius:20px 20px 0 0;max-height:92vh;padding:20px 16px 32px;max-width:100%;width:100%}
  .modal h3{font-size:18px;margin-bottom:16px}
  .chat-ph{display:none!important}
  .chat-page{display:flex;flex-direction:column;height:calc(100dvh - 52px - 64px);overflow:hidden;position:relative}
  .chat-mobile-list{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch}
  .chat-mobile-area{display:flex;flex-direction:column;height:100%;overflow:hidden;position:relative}
  .chat-mobile-msgs{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px 14px;padding-bottom:80px;display:flex;flex-direction:column;gap:8px}
  .chat-mobile-inp{position:absolute;bottom:0;left:0;right:0;background:#13161f;border-top:1px solid rgba(255,255,255,.1);padding:10px 12px;padding-bottom:max(10px,env(safe-area-inset-bottom));display:flex;gap:8px;align-items:flex-end;z-index:10}
  .bub{max-width:85%;font-size:14px}
  .mob-back{display:inline-flex!important;align-items:center;justify-content:center}
  .chat-desktop{display:none!important}
  .cal-card{padding:12px 10px!important;border-radius:10px!important}
  .cg{gap:2px;margin-top:8px}
  .cd{aspect-ratio:unset!important;height:36px;border-radius:5px;font-size:11px;min-width:0}
  .cdot{width:4px;height:4px;margin-top:1px}
  .ch{font-size:9px;padding:3px 0;letter-spacing:0}.cmon{font-size:15px}.cnav{margin-bottom:8px}
  .pbanner{margin:10px 16px 0;padding:10px 12px}.pbanner span{font-size:12px}
  .lc{padding:32px 24px}
}
@media (max-width:400px){
  .sg{grid-template-columns:1fr 1fr}.sv{font-size:18px}.ph h2{font-size:18px}
  .mob-btn{min-width:44px;font-size:9px}.mico{font-size:20px}
}
@media (min-width:769px){.chat-page{display:none!important}}

.drawer-user-card{padding:20px 16px 16px;border-bottom:1px solid rgba(201,168,76,.12);
  display:flex;align-items:center;gap:12px;
  background:linear-gradient(135deg,rgba(201,168,76,.08),rgba(201,168,76,.02));flex-shrink:0}
.drawer-close{background:none;border:none;color:#5a5e6e;font-size:20px;cursor:pointer;
  padding:4px;margin-left:auto;border-radius:6px;line-height:1;flex-shrink:0}
.drawer-close:hover{color:#c9c5b8;background:rgba(255,255,255,.05)}
`;

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [session,    setSession]    = useState(null);   // { access_token, user }
  const [perfil,     setPerfil]     = useState(null);   // { id, nombre, rol, avatar }
  const [page,       setPage]       = useState("dashboard");
  const [perm,       setPerm]       = useState(typeof Notification !== "undefined" ? Notification.permission : "default");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [authLoad,   setAuthLoad]   = useState(true);

  useEffect(() => {
    regSW();
    // Restaurar sesión del localStorage
    const saved = localStorage.getItem("fm_session");
    if (saved) {
      try {
        const s = JSON.parse(saved);
        setSession(s);
        loadPerfil(s.access_token, s.user.id);
      } catch(_) { localStorage.removeItem("fm_session"); }
    }
    setAuthLoad(false);
  }, []);

  const loadPerfil = async (tok, uid) => {
    try {
      const rows = await sbGet("usuarios", `?id=eq.${uid}&select=*`, tok);
      if (rows[0]) setPerfil(rows[0]);
    } catch(_) {}
  };

  const login = async (email, pass) => {
    const d = await authLogin(email, pass);
    localStorage.setItem("fm_session", JSON.stringify(d));
    setSession(d);
    await loadPerfil(d.access_token, d.user.id);
    setPage("dashboard");
    if (d.user) askPerm().then(setPerm);
  };

  const logout = async () => {
    if (session) await authLogout(session.access_token).catch(()=>{});
    localStorage.removeItem("fm_session");
    setSession(null); setPerfil(null); setPage("dashboard"); setDrawerOpen(false);
  };

  if (authLoad) return <><style>{CSS}</style><div className="loading"><div className="spin" /><span>Cargando…</span></div></>;
  if (!session || !perfil) return <><style>{CSS}</style><LoginScreen onLogin={login} /></>;

  const tok  = session.access_token;
  const rol  = perfil.rol;
  const P    = { perfil, tok, setPage, rol };
  const goTo = id => { setPage(id); setDrawerOpen(false); };

  const PAGES = {
    dashboard:   <Dashboard   {...P} />,
    jcheck:      <JardinCheck {...P} />,
    jadmin:      <JardinAdmin {...P} />,
    incidencias: <Incidencias {...P} />,
    limpieza:    <Limpieza    {...P} />,
    "cal-limp":  <CalLimpieza {...P} />,
    calendario:  <Calendario  {...P} />,
    reservas:    <Reservas    {...P} />,
    "nueva-res": <NuevaReserva {...P} />,
    chat:        <Chat        {...P} />,
    notifs:      <Notifs      {...P} />,
    usuarios:    <Usuarios    {...P} />,
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <Sidebar perfil={perfil} page={page} setPage={setPage} onLogout={logout} />
        <div className="mob-top">
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <MolinoLogo size={22} />
            <span className="mob-top-title">Finca El Molino</span>
          </div>
          <button className="mob-menu-btn" onClick={() => setDrawerOpen(true)}>☰</button>
        </div>
        {drawerOpen && <div className="drawer-overlay" onClick={() => setDrawerOpen(false)} />}
        <div className={`drawer${drawerOpen ? " open" : ""}`}>
          <Sidebar perfil={perfil} page={page} setPage={goTo} onLogout={logout} inDrawer onClose={() => setDrawerOpen(false)} />
        </div>
        <div className="main">
          {perm === "default" && (
            <div className="pbanner">
              <span>🔔 Activa las notificaciones para recibir avisos</span>
              <button className="btn bp sm" onClick={() => askPerm().then(setPerm)}>Activar</button>
            </div>
          )}
          {PAGES[page] ?? <Dashboard {...P} />}
        </div>
        <MobileNav perfil={perfil} page={page} setPage={setPage} />
      </div>
    </>
  );
}

// ─── LOGIN ───────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass,  setPass]  = useState("");
  const [err,   setErr]   = useState("");
  const [load,  setLoad]  = useState(false);

  const go = async () => {
    if (!email || !pass) { setErr("Introduce email y contraseña"); return; }
    setLoad(true); setErr("");
    try { await onLogin(email, pass); }
    catch(e) { setErr(e.message || "Credenciales incorrectas"); }
    finally { setLoad(false); }
  };

  return (
    <div className="lw"><div className="lbg" />
      <div className="lc">
        <div className="llo">
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,marginBottom:8}}>
            <MolinoLogo size={42} />
            <h1>Finca El Molino</h1>
          </div>
          <p>Sistema de Gestión</p>
        </div>
        {err && <div className="alert">{err}</div>}
        <div className="fg"><label>Correo electrónico</label>
          <input className="fi" type="email" inputMode="email" autoComplete="email"
            value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" /></div>
        <div className="fg"><label>Contraseña</label>
          <input className="fi" type="password" autoComplete="current-password"
            value={pass} onChange={e => setPass(e.target.value)}
            onKeyDown={e => e.key === "Enter" && go()} placeholder="••••••••" /></div>
        <button className="btn bp" style={{width:"100%",justifyContent:"center",marginTop:4}}
          onClick={go} disabled={load}>
          {load ? <><div className="spin" style={{width:16,height:16,borderWidth:2}} /> Entrando…</> : "Entrar →"}
        </button>
        <p style={{fontSize:11,color:"#5a5e6e",textAlign:"center",marginTop:16,lineHeight:1.5}}>
          Usa las credenciales que te ha facilitado el administrador de la finca.
        </p>
      </div>
    </div>
  );
}

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────
function Sidebar({ perfil, page, setPage, onLogout, inDrawer, onClose }) {
  const rol = perfil.rol;
  const isA = rol==="admin", isJ = rol==="jardinero", isL = rol==="limpieza", isC = rol==="comercial";
  const RL  = { admin:"Administrador", jardinero:"Jardinero", limpieza:"Limpieza", comercial:"Comercial" };
  const av  = perfil.avatar || perfil.nombre.slice(0,2).toUpperCase();

  const N = ({ ico, lbl, id, badge }) => (
    <div className="nw">
      <button className={`nb${page===id?" on":""}`} onClick={() => setPage(id)}>
        <span className="nb-ico">{ico}</span>{lbl}
      </button>
      {badge > 0 && <span className="nb-badge">{badge > 9 ? "9+" : badge}</span>}
    </div>
  );

  return (
    <aside className="sb">
      {inDrawer ? (
        <div className="drawer-user-card">
          <div className="av" style={{width:42,height:42,fontSize:14}}>{av}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:14,fontWeight:600,color:"#e8e6e1",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{perfil.nombre}</div>
            <div style={{fontSize:11,color:"#c9a84c",marginTop:2}}>{RL[rol]}</div>
          </div>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>
      ) : (
        <div className="sb-logo">
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <MolinoLogo size={26} />
            <div><h1>Finca El Molino</h1><p>Gestión de la finca</p></div>
          </div>
        </div>
      )}
      <nav className="sb-nav">
        <N ico="📊" lbl="Panel principal" id="dashboard" />
        {(isA||isJ) && <>
          <p className="nav-sec">Jardín</p>
          <N ico="✅" lbl={isA?"Checklist jardín":"Mi checklist"} id="jcheck" />
          {isA && <N ico="🌿" lbl="Gestión jardín"  id="jadmin" />}
          {isA && <N ico="⚠️" lbl="Incidencias"     id="incidencias" />}
        </>}
        {(isA||isL) && <>
          <p className="nav-sec">Limpieza</p>
          <N ico="🧹" lbl={isA?"Gestión limpieza":"Mi servicio"} id="limpieza" />
          {isL && <N ico="📅" lbl="Calendario" id="cal-limp" />}
        </>}
        {(isA||isC) && <>
          <p className="nav-sec">Reservas</p>
          <N ico="📅" lbl="Calendario"    id="calendario" />
          <N ico="📋" lbl="Reservas"      id="reservas" />
          {isA && <N ico="➕" lbl="Nueva reserva" id="nueva-res" />}
        </>}
        <p className="nav-sec">Comunicación</p>
        <N ico="💬" lbl={isA?"Chat con equipo":"Chat con admin"} id="chat" />
        <N ico="🔔" lbl="Notificaciones" id="notifs" />
        {isA && <><p className="nav-sec">Admin</p><N ico="👥" lbl="Usuarios" id="usuarios" /></>}
      </nav>
      {!inDrawer && (
        <div className="sb-user">
          <div className="av">{av}</div>
          <div style={{flex:1,minWidth:0}}>
            <div className="uname">{perfil.nombre}</div>
            <div className="urole">{RL[rol]}</div>
          </div>
          <button className="logout-btn" onClick={onLogout} title="Cerrar sesión">⏻</button>
        </div>
      )}
      {inDrawer && (
        <div style={{padding:"12px 14px",borderTop:"1px solid rgba(201,168,76,.1)",marginTop:"auto"}}>
          <button className="btn br" style={{width:"100%",justifyContent:"center"}} onClick={onLogout}>
            ⏻ Cerrar sesión
          </button>
        </div>
      )}
    </aside>
  );
}

// ─── MOBILE NAV ──────────────────────────────────────────────────────────────
function MobileNav({ perfil, page, setPage }) {
  const rol = perfil.rol;
  const isA = rol==="admin", isJ = rol==="jardinero", isL = rol==="limpieza";
  const items = [{ ico:"📊", lbl:"Inicio", id:"dashboard" }];
  if (isA||isJ) items.push({ ico:"✅", lbl:isA?"Jardín":"Checklist", id:isA?"jadmin":"jcheck" });
  if (isA)      items.push({ ico:"⚠️", lbl:"Incidencias", id:"incidencias" });
  if (isA||isL) items.push({ ico:"🧹", lbl:"Limpieza", id:"limpieza" });
  if (!isA&&!isJ&&!isL) items.push({ ico:"📅", lbl:"Calendario", id:"calendario" });
  if (!isA&&!isJ&&!isL) items.push({ ico:"📋", lbl:"Reservas", id:"reservas" });
  items.push({ ico:"💬", lbl:"Chat",   id:"chat"   });
  items.push({ ico:"🔔", lbl:"Avisos", id:"notifs" });
  const shown = items.slice(0,5);
  return (
    <nav className="mob-bar">
      <div className="mob-bar-inner">
        {shown.map(it => (
          <button key={it.id} className={`mob-btn${page===it.id?" on":""}`} onClick={() => setPage(it.id)}>
            <span className="mico">{it.ico}</span>
            <span>{it.lbl}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

// ─── SHARED COMPONENTS ───────────────────────────────────────────────────────
function SC({ lbl, val, sub, prog, valC, onClick }) {
  return (
    <div className="sc" style={onClick?{cursor:"pointer"}:{}} onClick={onClick}>
      <div className="sl">{lbl}</div>
      <div className="sv" style={valC?{color:valC}:{}}>{val}</div>
      {sub && <div className="ss">{sub}</div>}
      {prog !== undefined && <div className="prog"><div className="pfill" style={{width:`${Math.min(prog,1)*100}%`}} /></div>}
    </div>
  );
}
function SBadge({ e }) {
  const est = ESTADOS.find(s => s.id===e);
  if (!est) return null;
  return <span className="badge" style={{background:`${est.col}18`,color:est.col,border:`1px solid ${est.col}30`,display:"inline-block"}}>{est.lbl}</span>;
}
function MTask({ lbl, sub, done }) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:9,padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
      <span style={{fontSize:16,flexShrink:0}}>{done?"✅":"⬜"}</span>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:13,color:done?"#5a5e6e":"#c9c5b8",textDecoration:done?"line-through":"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lbl}</div>
        {sub && <div style={{fontSize:11,color:"#5a5e6e"}}>{sub}</div>}
      </div>
    </div>
  );
}
function NotaModal({ nota, setNota, foto, setFoto, onSave, onClose, tok }) {
  const [uploading, setUploading] = useState(false);
  const handleFoto = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (tok) {
      setUploading(true);
      try { const url = await uploadFoto(f, tok); setFoto(url); }
      catch(_) { /* fallback: base64 */ const r = new FileReader(); r.onload = ev => setFoto(ev.target.result); r.readAsDataURL(f); }
      finally { setUploading(false); }
    } else {
      const r = new FileReader(); r.onload = ev => setFoto(ev.target.result); r.readAsDataURL(f);
    }
  };
  return (
    <div className="ov" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>📝 Nota / Incidencia</h3>
        <div className="fg"><label>Descripción</label>
          <textarea className="fi" rows={4} value={nota} onChange={e => setNota(e.target.value)} placeholder="Describe el problema o incidencia…" />
        </div>
        <div className="fg">
          <label>Foto (opcional)</label>
          <label className="pbtn">
            {uploading ? "⏳ Subiendo…" : `📷 ${foto?"Cambiar foto":"Hacer foto o subir imagen"}`}
            <input type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={handleFoto} />
          </label>
          {foto && <>
            <img src={foto} alt="preview" className="pprev" />
            <button className="btn br sm" style={{marginTop:8}} onClick={() => setFoto(null)}>🗑 Quitar foto</button>
          </>}
        </div>
        <div className="mft">
          <button className="btn bg" onClick={onClose}>Cancelar</button>
          <button className="btn bp" onClick={onSave} disabled={uploading}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
function Dashboard({ perfil, tok, setPage, rol }) {
  const [reservas, setReservas] = useState([]);
  const [jsem,     setJsem]     = useState([]);
  const [jpunt,    setJpunt]    = useState([]);
  const [jfrec,    setJfrec]    = useState({});
  const [load,     setLoad]     = useState(true);
  const cwk = wkKey();

  useEffect(() => {
    (async () => {
      try {
        const [r, js, jp, jf] = await Promise.all([
          sbGet("reservas","?select=*&order=fecha.asc",tok),
          sbGet("jardin_semana",`?semana=eq.${cwk}&select=*`,tok),
          sbGet("jardin_puntual",`?semana=eq.${cwk}&select=*`,tok),
          sbGet("jardin_frecuencias","?select=*",tok),
        ]);
        setReservas(r); setJsem(js); setJpunt(jp);
        const fm = {}; jf.forEach(x => fm[x.tarea_id] = x.frecuencia); setJfrec(fm);
      } catch(_) {}
      setLoad(false);
    })();
  }, []);

  if (load) return <div className="loading"><div className="spin" /><span>Cargando…</span></div>;
  if (rol==="jardinero") return <DashJ perfil={perfil} jsem={jsem} jpunt={jpunt} jfrec={jfrec} cwk={cwk} setPage={setPage} />;
  if (rol==="limpieza")  return <DashL perfil={perfil} setPage={setPage} />;
  if (rol==="comercial") return <DashC perfil={perfil} reservas={reservas} setPage={setPage} />;
  return <DashA reservas={reservas} jsem={jsem} jpunt={jpunt} jfrec={jfrec} cwk={cwk} setPage={setPage} />;
}

function DashA({ reservas, jsem, jpunt, jfrec, cwk, setPage }) {
  const sj   = {}; jsem.forEach(r => sj[r.tarea_id] = r);
  const actv = JARDIN_T[getTemporada()].filter(t => tocaSemana({...t,frec:jfrec[t.id]||t.frec},cwk));
  const comp = actv.filter(t=>sj[t.id]?.done).length + jpunt.filter(t=>t.done).length;
  const tot  = actv.length + jpunt.length;
  const inc  = jsem.filter(r=>r.nota||r.foto_url).length + jpunt.filter(r=>r.nota||r.foto_url).length;
  const ing  = reservas.filter(r=>r.estado==="precio_total"||r.estado==="finalizada").reduce((s,r)=>s+(parseFloat(r.precio)||0),0);
  const prox = [...reservas].find(r=>new Date(r.fecha)>=new Date());
  return <>
    <div className="ph"><h2>Panel administración 👋</h2><p>{new Date().toLocaleDateString("es-ES",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p></div>
    <div className="pb">
      <div className="sg">
        <SC lbl="Reservas totales" val={reservas.length} sub="en la finca" />
        <SC lbl="Ingresos confirmados" val={`${ing.toLocaleString("es-ES")}€`} />
        <SC lbl="Jardín esta semana" val={`${comp}/${tot}`} prog={tot?comp/tot:0} />
        <SC lbl="Incidencias" val={inc} valC={inc>0?"#f59e0b":undefined} sub={inc>0?"⚠️ Ver panel":"Sin incidencias"} onClick={()=>setPage("incidencias")} />
      </div>
      {prox && <div className="card" style={{marginBottom:16,borderLeft:"3px solid #c9a84c"}}>
        <div style={{fontSize:10,color:"#5a5e6e",textTransform:"uppercase",letterSpacing:1,marginBottom:7}}>PRÓXIMO EVENTO</div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
          <div><div style={{fontSize:16,fontWeight:600,color:"#e8e6e1"}}>{prox.nombre}</div>
            <div style={{fontSize:12,color:"#7a7f94",marginTop:4}}>📅 {new Date(prox.fecha).toLocaleDateString("es-ES",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</div>
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            <div style={{fontSize:18,fontWeight:700,color:"#c9a84c"}}>{parseFloat(prox.precio||0).toLocaleString("es-ES")}€</div>
            <SBadge e={prox.estado} />
          </div>
        </div>
      </div>}
      <div className="g2">
        <div className="card">
          <div className="chdr"><span className="ctit">🌿 Jardín esta semana</span><button className="btn bg sm" onClick={()=>setPage("jcheck")}>Ver</button></div>
          {actv.slice(0,5).map(t=><MTask key={t.id} lbl={t.txt} done={sj[t.id]?.done} />)}
        </div>
        <div className="card">
          <div className="chdr"><span className="ctit">📅 Próximas reservas</span><button className="btn bg sm" onClick={()=>setPage("reservas")}>Ver</button></div>
          {reservas.length===0
            ? <div style={{fontSize:12,color:"#5a5e6e"}}>Sin reservas registradas</div>
            : reservas.slice(0,5).map(r=>(
              <div key={r.id} style={{padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,.04)",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                <div style={{minWidth:0}}><div style={{fontSize:13,color:"#c9c5b8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.nombre}</div><div style={{fontSize:11,color:"#5a5e6e"}}>{new Date(r.fecha).toLocaleDateString("es-ES")}</div></div>
                <SBadge e={r.estado} />
              </div>))}
        </div>
      </div>
    </div>
  </>;
}

function DashJ({ perfil, jsem, jpunt, jfrec, cwk, setPage }) {
  const sj   = {}; jsem.forEach(r => sj[r.tarea_id] = r);
  const actv = JARDIN_T[getTemporada()].filter(t=>tocaSemana({...t,frec:jfrec[t.id]||t.frec},cwk));
  const tot  = actv.length+jpunt.length;
  const comp = actv.filter(t=>sj[t.id]?.done).length+jpunt.filter(t=>t.done).length;
  return <>
    <div className="ph"><h2>Hola, {perfil.nombre.split(" ")[0]} 👋</h2><p>{new Date().toLocaleDateString("es-ES",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p></div>
    <div className="pb">
      <div className="sg">
        <SC lbl="Tareas esta semana" val={tot} />
        <SC lbl="Completadas" val={comp} prog={tot?comp/tot:0} valC="#10b981" sub={comp===tot&&tot>0?"¡Al día! ✓":undefined} />
        <SC lbl="Pendientes"  val={tot-comp} valC={tot-comp>0?"#f59e0b":"#10b981"} />
      </div>
      <div className="card">
        <div className="chdr"><span className="ctit">📋 Mis tareas</span><button className="btn bp sm" onClick={()=>setPage("jcheck")}>Ir al checklist →</button></div>
        {actv.slice(0,6).map(t=><MTask key={t.id} lbl={t.txt} sub={t.zona} done={sj[t.id]?.done} />)}
        {jpunt.map(t=><MTask key={t.id} lbl={t.txt} sub="📌 Puntual" done={t.done} />)}
        {tot===0&&<div className="empty"><span className="ico">✅</span><p>Sin tareas esta semana</p></div>}
      </div>
    </div>
  </>;
}

function DashL({ perfil, setPage }) {
  return <>
    <div className="ph"><h2>Hola, {perfil.nombre.split(" ")[0]} 🧹</h2><p>{new Date().toLocaleDateString("es-ES",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p></div>
    <div className="pb">
      <div className="g2">
        {[{ico:"🧹",t:"Mi servicio",s:"Checklist limpieza",id:"limpieza"},{ico:"📅",t:"Calendario",s:"Próximos eventos",id:"cal-limp"}].map(it=>(
          <button key={it.id} className="card" style={{cursor:"pointer",textAlign:"left",border:"1px solid rgba(201,168,76,.15)"}} onClick={()=>setPage(it.id)}>
            <div style={{fontSize:28,marginBottom:8}}>{it.ico}</div>
            <div style={{fontSize:14,fontWeight:600,color:"#c9c5b8"}}>{it.t}</div>
            <div style={{fontSize:12,color:"#5a5e6e",marginTop:3}}>{it.s}</div>
          </button>))}
      </div>
    </div>
  </>;
}

function DashC({ perfil, reservas, setPage }) {
  const pend = reservas.filter(r=>r.estado==="visita"||r.estado==="pendiente_contrato").length;
  return <>
    <div className="ph"><h2>Hola, {perfil.nombre.split(" ")[0]} 👋</h2><p>{new Date().toLocaleDateString("es-ES",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p></div>
    <div className="pb">
      <div className="sg"><SC lbl="Total reservas" val={reservas.length} /><SC lbl="Pendientes de firma" val={pend} valC={pend>0?"#f59e0b":undefined} /></div>
      <div className="g2">
        {[{ico:"📋",t:"Reservas",s:"Listado completo",id:"reservas"},{ico:"📅",t:"Calendario",s:"Disponibilidad",id:"calendario"}].map(it=>(
          <button key={it.id} className="card" style={{cursor:"pointer",textAlign:"left",border:"1px solid rgba(201,168,76,.15)"}} onClick={()=>setPage(it.id)}>
            <div style={{fontSize:28,marginBottom:8}}>{it.ico}</div>
            <div style={{fontSize:14,fontWeight:600,color:"#c9c5b8"}}>{it.t}</div>
            <div style={{fontSize:12,color:"#5a5e6e",marginTop:3}}>{it.s}</div>
          </button>))}
      </div>
    </div>
  </>;
}

// ─── JARDÍN CHECKLIST ────────────────────────────────────────────────────────
function JardinCheck({ perfil, tok, rol }) {
  const isA      = rol === "admin";
  const cwk      = wkKey();
  const temp     = getTemporada();
  const tareasTemp = JARDIN_T[temp]; // tareas de la temporada actual
 
  const [jsem,       setJsem]       = useState([]);
  const [jpunt,      setJpunt]      = useState([]);
  const [jfrec,      setJfrec]      = useState({});
  const [load,       setLoad]       = useState(true);
  const [modal,      setModal]      = useState(null);
  const [nota,       setNota]       = useState("");
  const [foto,       setFoto]       = useState(null);
  const [saving,     setSaving]     = useState(false);
  // Control final
  const [showFinal,  setShowFinal]  = useState(false);
  const [finalCheck, setFinalCheck] = useState({});  // { cf1: true, cf2: false, ... }
  const [finalMode,  setFinalMode]  = useState(null); // "ok" | "incidencia"
  const [finalNota,  setFinalNota]  = useState("");
  const [finalSaving,setFinalSaving]= useState(false);
  const [yaVerificado, setYaVerificado] = useState(null); // registro de verificación
 
  const load_ = async () => {
    const [js, jp, jf, vrf] = await Promise.all([
      sbGet("jardin_semana", `?semana=eq.${cwk}&select=*`, tok),
      sbGet("jardin_puntual", `?semana=eq.${cwk}&select=*`, tok),
      sbGet("jardin_frecuencias", "?select=*", tok),
      // Buscar si ya hay verificación esta semana
      sbGet("jardin_semana", `?semana=eq.${cwk}&tarea_id=eq.VERIFICACION_FINAL&select=*`, tok),
    ]);
    setJsem(js); setJpunt(jp);
    const fm = {}; jf.forEach(x => fm[x.tarea_id] = x.frecuencia); setJfrec(fm);
    setYaVerificado(vrf[0] || null);
    setLoad(false);
  };
  useEffect(() => { load_(); }, []);
 
  const sj      = {}; jsem.forEach(r => sj[r.tarea_id] = r);
  const fr      = jfrec;
  const actv    = tareasTemp.filter(t => tocaSemana({ ...t, frec: fr[t.id] || t.frec }, cwk));
  const inac    = tareasTemp.filter(t => !tocaSemana({ ...t, frec: fr[t.id] || t.frec }, cwk));
  const comp    = actv.filter(t => sj[t.id]?.done).length + jpunt.filter(t => t.done).length;
  const tot     = actv.length + jpunt.length;
  const todoHecho = tot > 0 && comp === tot;
 
  const toggle = async (tareaId, isPunt = false) => {
    if (saving) return;
    setSaving(true);
    try {
      if (!isPunt) {
        const cur = sj[tareaId];
        const nuevoDone = !cur?.done;
        await sbUpsert("jardin_semana", {
          semana: cwk, tarea_id: tareaId,
          done: nuevoDone,
          completado_por: perfil.nombre,
          completado_ts: new Date().toISOString()
        }, tok);
        await load_();
        // Recalcular tras cargar y mostrar ventana final si se acaban de completar todas
        const jsNew = await sbGet("jardin_semana", `?semana=eq.${cwk}&select=*`, tok);
        const sjNew = {}; jsNew.forEach(r => sjNew[r.tarea_id] = r);
        const compNew = actv.filter(t => sjNew[t.id]?.done).length + jpunt.filter(t => t.done).length;
        if (nuevoDone && compNew === tot && !yaVerificado) {
          setFinalCheck({});
          setFinalMode(null);
          setFinalNota("");
          setShowFinal(true);
        }
      } else {
        const cur = jpunt.find(t => t.id === tareaId);
        await sbPatch("jardin_puntual", `id=eq.${tareaId}`, {
          done: !cur?.done,
          completado_por: perfil.nombre,
          completado_ts: new Date().toISOString()
        }, tok);
        await load_();
      }
    } catch(_) {}
    setSaving(false);
  };
 
  const openNota = (id, isPunt) => {
    const e = isPunt ? jpunt.find(t => t.id === id) : (sj[id] || {});
    setNota(e?.nota || ""); setFoto(e?.foto_url || null); setModal({ id, isPunt });
  };
 
const saveNota = async () => {
    if (!modal || saving) return;
    if (!nota.trim() && !foto) { setModal(null); return; }
    setSaving(true);
    try {
      if (!modal.isPunt) {
        await sbUpsert("jardin_semana", {
          semana: cwk, tarea_id: modal.id,
          nota: nota.trim() || null,
          foto_url: foto || null
        }, tok);
      } else {
        await sbPatch("jardin_puntual", `id=eq.${modal.id}`, {
          nota: nota.trim() || null,
          foto_url: foto || null
        }, tok);
      }
      await load_();
    } catch(e) { console.error(e); }
    setSaving(false); setModal(null);
  };
 
  // Guardar verificación final
  const guardarFinal = async (modo) => {
    if (finalSaving) return;
    if (modo === "incidencia" && !finalNota.trim()) return;
    setFinalSaving(true);
    try {
      const notaFinal = modo === "ok"
        ? `✅ Verificado OK · ${new Date().toLocaleString("es-ES")}`
        : `⚠️ Sin verificar: ${finalNota}`;
      await sbUpsert("jardin_semana", {
        semana: cwk,
        tarea_id: "VERIFICACION_FINAL",
        done: modo === "ok",
        completado_por: perfil.nombre,
        completado_ts: new Date().toISOString(),
        nota: notaFinal,
      }, tok);
      // Notificar al admin
      const admins = await sbGet("usuarios", "?rol=eq.admin&select=id", tok);
      const emoji  = modo === "ok" ? "✅" : "⚠️";
      const msg    = modo === "ok"
        ? `${emoji} ${perfil.nombre} ha verificado el jardín. Todo correcto.`
        : `${emoji} ${perfil.nombre} ha cerrado el jardín con incidencias: "${finalNota}"`;
      for (const a of admins) {
        await sbPost("notificaciones", { para: a.id, txt: msg }, tok);
        sendPush("🌾 Finca El Molino", msg, "jardin-verificacion");
      }
      await load_();
      setShowFinal(false);
    } catch(_) {}
    setFinalSaving(false);
  };
 
  if (load) return <div className="loading"><div className="spin" /><span>Cargando…</span></div>;
 
  // Banner de verificación ya completada
  const BannerVerificado = () => {
    if (!yaVerificado) return null;
    const ok = yaVerificado.done;
    return (
      <div style={{
        background: ok ? "rgba(16,185,129,.1)" : "rgba(245,158,11,.1)",
        border: `1px solid ${ok ? "rgba(16,185,129,.3)" : "rgba(245,158,11,.3)"}`,
        borderRadius: 10, padding: "12px 16px", marginBottom: 16,
        display: "flex", alignItems: "center", gap: 10
      }}>
        <span style={{ fontSize: 20 }}>{ok ? "✅" : "⚠️"}</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: ok ? "#10b981" : "#f59e0b" }}>
            {ok ? "Jardín verificado esta semana" : "Semana cerrada con incidencias"}
          </div>
          <div style={{ fontSize: 11, color: "#7a7f94", marginTop: 2 }}>
            {yaVerificado.nota} · {fmtDT(yaVerificado.completado_ts)}
          </div>
        </div>
        {!isA && (
          <button className="btn bg sm" style={{ marginLeft: "auto", flexShrink: 0 }}
            onClick={() => { setFinalCheck({}); setFinalMode(null); setFinalNota(""); setShowFinal(true); }}>
            Cambiar
          </button>
        )}
      </div>
    );
  };
 
  return <>
    <div className="ph">
      <h2>{isA ? "Checklist jardín" : "Mi checklist"}</h2>
      <p>{TEMPORADA_LBL[temp]} · {comp}/{tot} tareas</p>
    </div>
    <div className="pb">
      {/* Barra de progreso */}
      <div className="prog" style={{ marginBottom: 14, height: 7 }}>
        <div className="pfill" style={{ width: `${tot ? (comp / tot) * 100 : 0}%` }} />
      </div>
 
      {/* Banner si ya está verificado */}
      <BannerVerificado />
 
      {/* Botón manual para abrir control final si ya están todas hechas */}
      {todoHecho && !showFinal && !isA && (
        <div style={{ marginBottom: 16, textAlign: "center" }}>
          <button className="btn bp" style={{ width: "100%", justifyContent: "center", fontSize: 15, padding: "12px" }}
            onClick={() => { setFinalCheck({}); setFinalMode(null); setFinalNota(""); setShowFinal(true); }}>
            ✅ Abrir control final del jardín
          </button>
        </div>
      )}
 
      {/* Tareas activas */}
      {actv.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="chdr">
            <span className="ctit">📋 Esta semana</span>
            <span className="badge" style={{ background: "rgba(16,185,129,.1)", color: "#10b981" }}>{actv.length}</span>
          </div>
          {actv.map(t => {
            const e = sj[t.id] || {};
            return (
              <div key={t.id} className={`cli${e.done ? " done" : ""}`}>
                {!isA
                  ? <div className={`chk${e.done ? " on" : ""}`} onClick={() => toggle(t.id)} />
                  : <span style={{ fontSize: 17, flexShrink: 0 }}>{e.done ? "✅" : "⬜"}</span>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span className="tz">{t.zona}</span>
                  <div className={`tl${e.done ? " done" : ""}`}>{t.txt}</div>
                  <div className="tm" style={{ color: "#6366f1" }}>🔁 {FREC_LBL[fr[t.id] || t.frec]}</div>
                  {e.done && <div className="tm">✓ {e.completado_por} · {fmtDT(e.completado_ts)}</div>}
                  {e.nota && <div className="nbox">📝 {e.nota}</div>}
                  {e.foto_url && <img src={e.foto_url} alt="" className="pthumb" />}
                  {e.resp_admin && <div className="rbox">✅ Admin: {e.resp_admin}</div>}
                </div>
                <span className="ibtn" onClick={() => openNota(t.id, false)}>{e.nota || e.foto_url ? "✏️" : "➕"}</span>
              </div>
            );
          })}
        </div>
      )}
 
      {/* Puntuales */}
      {jpunt.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="chdr"><span className="ctit">⭐ Puntuales</span></div>
          {jpunt.map(t => (
            <div key={t.id} className={`cli${t.done ? " done" : ""}`}>
              {!isA
                ? <div className={`chk${t.done ? " on" : ""}`} onClick={() => toggle(t.id, true)} />
                : <span style={{ fontSize: 17, flexShrink: 0 }}>{t.done ? "✅" : "⬜"}</span>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <span className="tz">{t.zona || "General"}</span>
                <div className={`tl${t.done ? " done" : ""}`}>{t.txt}</div>
                <div className="tm" style={{ color: "#f59e0b" }}>📌 Puntual · {t.creado_por}</div>
                {t.done && <div className="tm">✓ {t.completado_por} · {fmtDT(t.completado_ts)}</div>}
                {t.nota && <div className="nbox">📝 {t.nota}</div>}
                {t.foto_url && <img src={t.foto_url} alt="" className="pthumb" />}
                {t.resp_admin && <div className="rbox">✅ Admin: {t.resp_admin}</div>}
              </div>
              <span className="ibtn" onClick={() => openNota(t.id, true)}>{t.nota || t.foto_url ? "✏️" : "➕"}</span>
            </div>
          ))}
        </div>
      )}
 
      {tot === 0 && <div className="empty"><span className="ico">✅</span><p>Sin tareas esta semana</p></div>}
 
      {/* Tareas que no tocan esta semana */}
      {inac.length > 0 && (
        <div className="card" style={{ opacity: .4 }}>
          <div className="chdr"><span className="ctit" style={{ color: "#5a5e6e" }}>⏭ No toca esta semana</span></div>
          {inac.map(t => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,.04)" }}>
              <span style={{ fontSize: 13 }}>⏸</span>
              <div>
                <div style={{ fontSize: 12, color: "#5a5e6e" }}>{t.txt}</div>
                <div style={{ fontSize: 10, color: "#3d4155" }}>🔁 {FREC_LBL[fr[t.id] || t.frec]}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
 
    {/* ── MODAL CONTROL FINAL ── */}
    {showFinal && !isA && (
      <div className="ov" style={{ alignItems: "flex-end", padding: 0 }}>
        <div style={{
          background: "#13161f", border: "1px solid rgba(201,168,76,.25)",
          borderRadius: "20px 20px 0 0", padding: "24px 20px 36px",
          width: "100%", maxWidth: 540, maxHeight: "92vh", overflowY: "auto"
        }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🌿</div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: "#e8e6e1", marginBottom: 4 }}>
              ¡Últimas comprobaciones!
            </div>
            <div style={{ fontSize: 13, color: "#7a7f94" }}>
              Has completado todas las tareas. Antes de cerrar, verifica que todo está correcto.
            </div>
          </div>
 
          {/* Selector de modo */}
          {!finalMode && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              <button
                className="btn bp"
                style={{ width: "100%", justifyContent: "center", padding: "14px", fontSize: 15 }}
                onClick={() => setFinalMode("ok")}>
                ✅ Todo correcto — verificar jardín
              </button>
              <button
                className="btn bg"
                style={{ width: "100%", justifyContent: "center", padding: "14px", fontSize: 15 }}
                onClick={() => setFinalMode("incidencia")}>
                ⚠️ Hay incidencias — cerrar sin verificar
              </button>
            </div>
          )}
 
          {/* Modo OK — checklist final */}
          {finalMode === "ok" && (
            <>
              <div style={{ fontSize: 12, color: "#c9a84c", fontWeight: 600, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>
                ✅ Comprueba cada punto antes de confirmar
              </div>
              {JARDIN_CONTROL_FINAL.map(item => (
                <div key={item.id}
                  onClick={() => setFinalCheck(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "11px 12px",
                    borderRadius: 10, marginBottom: 6, cursor: "pointer",
                    background: finalCheck[item.id] ? "rgba(16,185,129,.08)" : "#0f1117",
                    border: `1px solid ${finalCheck[item.id] ? "rgba(16,185,129,.25)" : "rgba(255,255,255,.06)"}`,
                    transition: "all .15s"
                  }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                    background: finalCheck[item.id] ? "#10b981" : "transparent",
                    border: `2px solid ${finalCheck[item.id] ? "#10b981" : "rgba(255,255,255,.2)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, color: "#fff", fontWeight: 700, transition: "all .15s"
                  }}>{finalCheck[item.id] ? "✓" : ""}</div>
                  <span style={{ fontSize: 14, color: finalCheck[item.id] ? "#10b981" : "#c9c5b8" }}>{item.txt}</span>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button className="btn bg" style={{ flex: 1, justifyContent: "center" }}
                  onClick={() => setFinalMode(null)}>← Volver</button>
                <button
                  className="btn bp"
                  style={{ flex: 2, justifyContent: "center", padding: "12px", fontSize: 15 }}
                  onClick={() => guardarFinal("ok")}
                  disabled={finalSaving}>
                  {finalSaving ? "Guardando…" : "✅ Jardín terminado y verificado"}
                </button>
              </div>
            </>
          )}
 
          {/* Modo INCIDENCIA */}
          {finalMode === "incidencia" && (
            <>
              <div style={{ fontSize: 13, color: "#f59e0b", fontWeight: 600, marginBottom: 10 }}>
                ⚠️ ¿Por qué no se ha podido completar el trabajo?
              </div>
              <textarea
                className="fi"
                rows={4}
                value={finalNota}
                onChange={e => setFinalNota(e.target.value)}
                placeholder="Ej: Falta material para la piscina, queda pendiente para la próxima semana…"
                style={{ marginBottom: 14, fontSize: 14, lineHeight: 1.5 }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn bg" style={{ flex: 1, justifyContent: "center" }}
                  onClick={() => setFinalMode(null)}>← Volver</button>
                <button
                  className="btn"
                  style={{ flex: 2, justifyContent: "center", padding: "12px", fontSize: 15, background: "#f59e0b", color: "#0f1117" }}
                  onClick={() => guardarFinal("incidencia")}
                  disabled={finalSaving || !finalNota.trim()}>
                  {finalSaving ? "Guardando…" : "⚠️ Cerrar con incidencias"}
                </button>
              </div>
            </>
          )}
 
          {/* Botón cerrar sin hacer nada */}
          <button
            onClick={() => setShowFinal(false)}
            style={{
              background: "none", border: "none", color: "#5a5e6e", cursor: "pointer",
              width: "100%", textAlign: "center", marginTop: 16, fontSize: 12,
              fontFamily: "'DM Sans',sans-serif", padding: "8px"
            }}>
            Cerrar y decidir más tarde
          </button>
        </div>
      </div>
    )}
 
    {modal && (
      <NotaModal nota={nota} setNota={setNota} foto={foto} setFoto={setFoto}
        onSave={saveNota} onClose={() => setModal(null)} tok={tok} />
    )}
  </>;
}

// ─── JARDÍN ADMIN ────────────────────────────────────────────────────────────
function JardinAdmin({ perfil, tok }) {
  const cwk = wkKey();
  const [jsem,  setJsem]  = useState([]);
  const [jpunt, setJpunt] = useState([]);
  const [jfrec, setJfrec] = useState({});
  const [load,  setLoad]  = useState(true);
  const [tab,   setTab]   = useState("semana");
  const [editFr,setEditFr]= useState(null);
  const [showM, setShowM] = useState(false);
  const [form,  setForm]  = useState({txt:"",zona:"",sem:cwk});
  const [saving,setSaving]= useState(false);

  const sems = Array.from({length:5},(_,i)=>{
    const d=new Date(); d.setDate(d.getDate()+i*7);
    const k=wkKey(d);
    return {k,lbl:i===0?`Esta semana (${k})`:`Sem ${k.split("-W")[1]} · ${d.toLocaleDateString("es-ES",{day:"numeric",month:"short"})}`};
  });

  const load_ = async () => {
    const [js,jp,jf]=await Promise.all([
      sbGet("jardin_semana",`?semana=eq.${cwk}&select=*`,tok),
      sbGet("jardin_puntual",`?semana=eq.${cwk}&select=*`,tok),
      sbGet("jardin_frecuencias","?select=*",tok),
    ]);
    setJsem(js); setJpunt(jp);
    const fm={}; jf.forEach(x=>fm[x.tarea_id]=x.frecuencia); setJfrec(fm);
    setLoad(false);
  };
  useEffect(()=>{load_();},[]);

  const sj = {}; jsem.forEach(r=>sj[r.tarea_id]=r);
  const getFr = t => jfrec[t.id]||t.frec;
  const actv  = JARDIN_T[getTemporada()].filter(t=>tocaSemana({...t,frec:getFr(t)},cwk));

  const addPunt = async () => {
    if (!form.txt||saving) return;
    setSaving(true);
    try {
      await sbPost("jardin_puntual",{txt:form.txt,zona:form.zona,semana:form.sem,done:false,creado_por:perfil.nombre},tok);
      // Notificar al jardinero
      const usuarios = await sbGet("usuarios","?rol=eq.jardinero&select=id",tok);
      for(const u of usuarios) {
        await sbPost("notificaciones",{para:u.id,txt:`Nueva tarea asignada: "${form.txt}"`},tok);
        sendPush("🌾 Finca El Molino",`Nueva tarea: ${form.txt}`);
      }
      setForm({txt:"",zona:"",sem:cwk}); setShowM(false); await load_();
    } catch(_) {}
    setSaving(false);
  };

  const delPunt = async (id) => {
    await sbDelete("jardin_puntual",`id=eq.${id}`,tok);
    await load_();
  };

  const setFrOv = async (tareaId, v) => {
    await sbUpsert("jardin_frecuencias",{tarea_id:tareaId,frecuencia:parseInt(v),updated_at:new Date().toISOString()},tok);
    setEditFr(null); await load_();
  };

  if (load) return <div className="loading"><div className="spin"/><span>Cargando…</span></div>;

  return <>
    <div className="ph"><h2>Gestión Jardín</h2><p>Seguimiento y planificación</p></div>
    <div className="pb">
      <div className="tabs">
        <button className={`tab${tab==="semana"?" on":""}`} onClick={()=>setTab("semana")}>Esta semana</button>
        <button className={`tab${tab==="frec"?" on":""}`}   onClick={()=>setTab("frec")}>Frecuencias</button>
      </div>
      {tab==="semana"&&<>
        <div className="card" style={{marginBottom:14}}>
          <div className="chdr"><span className="ctit">📋 Tareas fijas</span></div>
          {actv.map(t=>{
            const e=sj[t.id]||{};
            return <div key={t.id} className={`cli${e.done?" done":""}`}>
              <span style={{fontSize:17,flexShrink:0}}>{e.done?"✅":"⬜"}</span>
              <div style={{flex:1,minWidth:0}}>
                <span className="tz">{t.zona}</span>
                <div className="tl">{t.txt}</div>
                <div className="tm" style={{color:"#6366f1"}}>🔁 {FREC_LBL[getFr(t)]}</div>
                {e.done?<div className="tm">✓ {e.completado_por} · {fmtDT(e.completado_ts)}</div>:<div className="tm" style={{color:"#e85555"}}>⏳ Pendiente</div>}
                {e.nota&&<div className="nbox">📝 {e.nota}</div>}
                {e.foto_url&&<img src={e.foto_url} alt="" className="pthumb"/>}
              </div>
            </div>;
          })}
        </div>
        <div className="card">
          <div className="chdr"><span className="ctit">⭐ Puntuales</span><button className="btn bp sm" onClick={()=>setShowM(true)}>+ Asignar</button></div>
          {jpunt.length===0?<div className="empty"><span className="ico">📭</span><p>Sin puntuales</p></div>
            :jpunt.map(t=>(
              <div key={t.id} className={`cli${t.done?" done":""}`}>
                <span style={{fontSize:17,flexShrink:0}}>{t.done?"✅":"⬜"}</span>
                <div style={{flex:1,minWidth:0}}>
                  <span className="tz">{t.zona||"General"}</span>
                  <div className="tl">{t.txt}</div>
                  {t.done?<div className="tm">✓ {t.completado_por}</div>:<div className="tm">⏳ Pendiente</div>}
                </div>
                <button className="btn br sm" onClick={()=>delPunt(t.id)}>🗑</button>
              </div>))}
        </div>
      </>}
      {tab==="frec"&&<div className="card">
        <div className="chdr"><span className="ctit">🔁 Frecuencias</span></div>
        {JARDIN_T[getTemporada()].map(t=>{
          const f=getFr(t),activa=tocaSemana({...t,frec:f},cwk),ed=editFr===t.id;
          return <div key={t.id} style={{padding:"11px 0",borderBottom:"1px solid rgba(255,255,255,.05)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
              <div style={{minWidth:0}}>
                <div style={{fontSize:13,color:activa?"#c9c5b8":"#5a5e6e",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.txt}</div>
                <div style={{fontSize:11,color:"#5a5e6e"}}>{t.zona}</div>
              </div>
              <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
                <span className="badge" style={{background:activa?"rgba(16,185,129,.1)":"rgba(255,255,255,.04)",color:activa?"#10b981":"#5a5e6e"}}>{activa?"Esta sem.":"No esta sem."}</span>
                <button className="btn bg sm" onClick={()=>setEditFr(ed?null:t.id)}>🔁 {FREC_LBL[f]}</button>
              </div>
            </div>
            {ed&&<div style={{marginTop:10,background:"rgba(201,168,76,.06)",border:"1px solid rgba(201,168,76,.15)",borderRadius:8,padding:"12px"}}>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {Object.entries(FREC_LBL).map(([v,l])=><button key={v} className={`btn sm${parseInt(v)===f?" bp":" bg"}`} onClick={()=>setFrOv(t.id,v)}>{l}</button>)}
              </div>
            </div>}
          </div>;
        })}
      </div>}
    </div>
    {showM&&<div className="ov" onClick={()=>setShowM(false)}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <h3>📌 Asignar tarea puntual</h3>
        <div className="fg"><label>Descripción *</label><input className="fi" value={form.txt} onChange={e=>setForm(v=>({...v,txt:e.target.value}))} placeholder="Ej: Limpiar la piscina"/></div>
        <div className="fg"><label>Zona</label><input className="fi" value={form.zona} onChange={e=>setForm(v=>({...v,zona:e.target.value}))} placeholder="Ej: Piscina"/></div>
        <div className="fg"><label>Semana</label>
          <select className="fi" value={form.sem} onChange={e=>setForm(v=>({...v,sem:e.target.value}))}>
            {sems.map(s=><option key={s.k} value={s.k}>{s.lbl}</option>)}
          </select>
        </div>
        <div className="mft"><button className="btn bg" onClick={()=>setShowM(false)}>Cancelar</button><button className="btn bp" onClick={addPunt} disabled={saving}>📌 Asignar y notificar</button></div>
      </div>
    </div>}
  </>;
}

// ─── INCIDENCIAS ─────────────────────────────────────────────────────────────
function Incidencias({ tok }) {
  const [items, setItems] = useState([]);
  const [load,  setLoad]  = useState(true);

  useEffect(() => {
    (async () => {
      const [jsem, jpunt, stk] = await Promise.all([
        sbGet("jardin_semana", "?nota=not.is.null&tarea_id=neq.VERIFICACION_FINAL&select=*", tok),
        sbGet("jardin_puntual", "?nota=not.is.null&select=*", tok),
        sbGet("servicio_tareas", "?nota=not.is.null&select=*,servicios(nombre)", tok),
      ]);
      const all = [
        ...jsem.filter(r => r.nota || r.foto_url).map(r => ({
          ...r, tipo: "Jardín", tag: "🌿",
          tarea: Object.values(JARDIN_T).flat().find(t => t.id === r.tarea_id)?.txt || r.tarea_id,
          zona:  Object.values(JARDIN_T).flat().find(t => t.id === r.tarea_id)?.zona || "—",
          isSemana: true
        })),
        ...jpunt.filter(r => r.nota || r.foto_url).map(r => ({
          ...r, tipo: "Jardín puntual", tag: "📌",
          tarea: r.txt, zona: r.zona || "General"
        })),
        ...stk.filter(r => r.nota || r.foto_url).map(r => ({
          ...r, tipo: `Limpieza: ${r.servicios?.nombre || ""}`, tag: "🧹",
          tarea: r.txt || (LIMP_T.find(t => t.id === r.tarea_id)?.txt) || r.tarea_id,
          zona: r.zona || "—"
        })),
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setItems(all);
      setLoad(false);
    })();
  }, []);

  const saveResp = async (item, resp) => {
    if (item.isSemana) await sbPatch("jardin_semana", `id=eq.${item.id}`, { resp_admin: resp, resp_ts: new Date().toISOString() }, tok);
    else if (item.tipo.startsWith("Jardín")) await sbPatch("jardin_puntual", `id=eq.${item.id}`, { resp_admin: resp, resp_ts: new Date().toISOString() }, tok);
    else await sbPatch("servicio_tareas", `id=eq.${item.id}`, { resp_admin: resp, resp_ts: new Date().toISOString() }, tok);
    setItems(prev => prev.map(x => x.id === item.id ? { ...x, resp_admin: resp } : x));
  };

  if (load) return <div className="loading"><div className="spin" /><span>Cargando…</span></div>;
  return <>
    <div className="ph"><h2>Incidencias</h2><p>{items.length} anotaciones registradas</p></div>
    <div className="pb">
      {items.length === 0
        ? <div className="empty"><span className="ico">✅</span><p>Sin incidencias registradas</p></div>
        : items.map(inc => <IncCard key={inc.id} inc={inc} onResp={saveResp} />)}
    </div>
  </>;
}
function IncCard({ inc, onResp }) {
  const [show,  setShow]  = useState(false);
  const [reply, setReply] = useState(inc.resp_admin||"");
  const col = inc.tipo.startsWith("Limpieza")?"#6366f1":"#f59e0b";
  return (
    <div className="card" style={{marginBottom:10,borderLeft:`3px solid ${col}`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:10}}>
        <div style={{minWidth:0}}>
          <div style={{fontSize:14,fontWeight:600,color:"#e8e6e1",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{inc.tarea}</div>
          <div style={{display:"flex",gap:6,marginTop:5,flexWrap:"wrap"}}>
            <span className="badge" style={{background:"rgba(201,168,76,.1)",color:"#c9a84c"}}>📍 {inc.zona}</span>
            <span className="badge" style={{background:`${col}18`,color:col}}>{inc.tag} {inc.tipo}</span>
          </div>
        </div>
        <div style={{textAlign:"right",flexShrink:0,fontSize:11,color:"#5a5e6e"}}>
          {inc.completado_por&&<div>👤 {inc.completado_por}</div>}
          <div>🕐 {fmtDT(inc.completado_ts||inc.created_at)}</div>
        </div>
      </div>
      {inc.nota&&<div className="nbox"><div style={{fontSize:10,color:"#f59e0b",fontWeight:600,marginBottom:3}}>📝 NOTA</div>{inc.nota}</div>}
      {inc.foto_url&&<img src={inc.foto_url} alt="" style={{maxWidth:"100%",maxHeight:220,borderRadius:8,marginTop:8,objectFit:"cover",display:"block"}}/>}
      {inc.resp_admin&&<div className="rbox"><div style={{fontSize:10,color:"#10b981",fontWeight:600,marginBottom:3}}>✅ RESPUESTA ADMIN</div>{inc.resp_admin}</div>}
      <div style={{marginTop:10}}><button className="btn bg sm" onClick={()=>setShow(!show)}>{inc.resp_admin?"✏️ Editar respuesta":"💬 Responder"}</button></div>
      {show&&<div style={{marginTop:9}}>
        <textarea className="fi" rows={3} value={reply} onChange={e=>setReply(e.target.value)} placeholder="Escribe tu respuesta…"/>
        <div style={{display:"flex",gap:7,marginTop:7}}>
          <button className="btn bg sm" onClick={()=>setShow(false)}>Cancelar</button>
          <button className="btn bp sm" onClick={()=>{onResp(inc,reply);setShow(false);}}>✓ Guardar</button>
        </div>
      </div>}
    </div>
  );
}

// ─── LIMPIEZA ────────────────────────────────────────────────────────────────
function Limpieza({ perfil, tok, rol }) {
  const isA = rol==="admin";
  const [servicios, setServicios] = useState([]);
  const [actId,     setActId]     = useState(null);
  const [tareas,    setTareas]    = useState([]);
  const [load,      setLoad]      = useState(true);
  const [showNew,   setShowNew]   = useState(false);
  const [showEx,    setShowEx]    = useState(false);
  const [newS,      setNewS]      = useState({nombre:"",fecha:new Date().toISOString().split("T")[0]});
  const [newE,      setNewE]      = useState({txt:"",zona:""});
  const [notaM,     setNotaM]     = useState(null);
  const [nota,      setNota]      = useState("");
  const [foto,      setFoto]      = useState(null);
  const [saving,    setSaving]    = useState(false);

  const loadSrvs = async () => {
    const s = await sbGet("servicios","?select=*&order=fecha.desc",tok);
    setServicios(s);
    if (!isA && s.length>0 && !actId) setActId(s[0].id);
    setLoad(false);
  };
  const loadTareas = async (sid) => {
    if (!sid) return;
    const t = await sbGet("servicio_tareas",`?servicio_id=eq.${sid}&select=*`,tok);
    setTareas(t);
  };
  useEffect(()=>{loadSrvs();},[]);
  useEffect(()=>{if(actId) loadTareas(actId);},[actId]);

  const crearSrv = async () => {
    if (!newS.nombre||saving) return;
    setSaving(true);
    try {
      const [srv] = await sbPost("servicios",{nombre:newS.nombre,fecha:newS.fecha,creado_por:perfil.nombre},tok);
      // Insertar tareas fijas
      for(const t of LIMP_T) await sbPost("servicio_tareas",{servicio_id:srv.id,tarea_id:t.id,zona:t.zona,es_extra:false},tok);
      // Notificar a limpieza
      const us = await sbGet("usuarios","?rol=eq.limpieza&select=id",tok);
      for(const u of us) { await sbPost("notificaciones",{para:u.id,txt:`Nuevo servicio: "${newS.nombre}" — ${new Date(newS.fecha).toLocaleDateString("es-ES")}`},tok); sendPush("🌾 Finca El Molino",`Nuevo servicio: ${newS.nombre}`); }
      setActId(srv.id); setShowNew(false); setNewS({nombre:"",fecha:new Date().toISOString().split("T")[0]}); await loadSrvs();
    } catch(_) {}
    setSaving(false);
  };

  const toggleT = async (tareaId) => {
    if (isA||saving) return;
    setSaving(true);
    const cur = tareas.find(t=>t.id===tareaId);
    await sbPatch("servicio_tareas",`id=eq.${tareaId}`,{done:!cur?.done,completado_por:perfil.nombre,completado_ts:new Date().toISOString()},tok);
    await loadTareas(actId); setSaving(false);
  };

  const addExtra = async () => {
    if (!actId||!newE.txt||saving) return;
    setSaving(true);
    await sbPost("servicio_tareas",{servicio_id:actId,txt:newE.txt,zona:newE.zona,es_extra:true,done:false,creado_por:perfil.nombre},tok);
    setNewE({txt:"",zona:""}); setShowEx(false); await loadTareas(actId); setSaving(false);
  };

  const saveNota = async () => {
    if (!notaM||saving) return;
    setSaving(true);
    await sbPatch("servicio_tareas",`id=eq.${notaM.id}`,{nota,foto_url:foto||null},tok);
    setNotaM(null); await loadTareas(actId); setSaving(false);
  };

  const openN = (t) => { setNota(t.nota||""); setFoto(t.foto_url||null); setNotaM(t); };

  const srv = servicios.find(s=>s.id===actId);
  const fijas = tareas.filter(t=>!t.es_extra);
  const extras = tareas.filter(t=>t.es_extra);
  const comp = tareas.filter(t=>t.done).length;

  if (load) return <div className="loading"><div className="spin"/><span>Cargando…</span></div>;
  if (!isA && servicios.length===0) return <><div className="ph"><h2>Mi servicio</h2></div><div className="pb"><div className="empty"><span className="ico">🧹</span><p>Sin servicios asignados todavía</p></div></div></>;

  return <>
    <div className="ph"><h2>{isA?"Gestión limpieza":"Mi servicio"}</h2></div>
    <div className="pb">
      <div className="g2" style={{alignItems:"flex-start"}}>
        <div>
          <div className="chdr" style={{marginBottom:12}}><span className="ctit">Servicios</span>{isA&&<button className="btn bp sm" onClick={()=>setShowNew(true)}>+ Nuevo</button>}</div>
          {servicios.map(s=>{
            const tt = s._tareas_count||0;
            return <div key={s.id} className="card" style={{marginBottom:8,cursor:"pointer",borderColor:actId===s.id?"rgba(201,168,76,.35)":undefined}} onClick={()=>setActId(s.id)}>
              <div style={{fontSize:13,fontWeight:600,color:"#c9a84c",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.nombre}</div>
              <div style={{fontSize:11,color:"#7a7f94",marginTop:3}}>📅 {new Date(s.fecha).toLocaleDateString("es-ES")}</div>
            </div>;
          })}
        </div>
        {srv&&<div>
          <div style={{background:"rgba(201,168,76,.08)",border:"1px solid rgba(201,168,76,.15)",borderRadius:10,padding:"12px 16px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
            <div style={{minWidth:0}}><div style={{fontSize:13,fontWeight:600,color:"#c9a84c",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>🧹 {srv.nombre}</div><div style={{fontSize:11,color:"#7a7f94"}}>{new Date(srv.fecha).toLocaleDateString("es-ES")} · {comp}/{tareas.length}</div></div>
           {isA&&<div style={{display:"flex",gap:6,flexShrink:0}}>
  <button className="btn bg sm" onClick={()=>setShowEx(true)}>+ Extra</button>
  <button className="btn br sm" onClick={async()=>{
    if(!window.confirm(`¿Eliminar el servicio "${srv.nombre}"? Esta acción no se puede deshacer.`)) return;
    await sbDelete("servicio_tareas",`servicio_id=eq.${srv.id}`,tok);
    await sbDelete("servicios",`id=eq.${srv.id}`,tok);
    setActId(null); setTareas([]); await loadSrvs();
  }}>🗑 Eliminar</button>
</div>}
          </div>
          {fijas.map(t=>(
            <div key={t.id} className={`cli${t.done?" done":""}`}>
              {!isA?<div className={`chk${t.done?" on":""}`} onClick={()=>toggleT(t.id)}/>:<span style={{fontSize:17,flexShrink:0}}>{t.done?"✅":"⬜"}</span>}
              <div style={{flex:1,minWidth:0}}>
                <span className="tz">{t.zona}</span>
                <div className={`tl${t.done?" done":""}`}>{LIMP_T.find(x=>x.id===t.tarea_id)?.txt||t.txt}</div>
                {t.done&&<div className="tm">✓ {t.completado_por} · {fmtDT(t.completado_ts)}</div>}
                {t.nota&&<div className="nbox">📝 {t.nota}</div>}
                {t.foto_url&&<img src={t.foto_url} alt="" className="pthumb"/>}
              </div>
              <span className="ibtn" onClick={()=>openN(t)}>{t.nota||t.foto_url?"✏️":"➕"}</span>
            </div>))}
          {extras.length>0&&<><hr className="div"/><div style={{fontSize:12,color:"#c9a84c",fontWeight:600,marginBottom:9}}>⭐ Extras</div>
            {extras.map(t=>(
              <div key={t.id} className={`cli${t.done?" done":""}`}>
                {!isA?<div className={`chk${t.done?" on":""}`} onClick={()=>toggleT(t.id)}/>:<span style={{fontSize:17,flexShrink:0}}>{t.done?"✅":"⬜"}</span>}
                <div style={{flex:1,minWidth:0}}>
                  <span className="tz">{t.zona||"General"}</span>
                  <div className={`tl${t.done?" done":""}`}>{t.txt}</div>
                  {t.done&&<div className="tm">✓ {t.completado_por}</div>}
                  {t.nota&&<div className="nbox">📝 {t.nota}</div>}
                </div>
                <span className="ibtn" onClick={()=>openN(t)}>{t.nota||t.foto_url?"✏️":"➕"}</span>
              </div>))}</>}
        </div>}
      </div>
    </div>
    {showNew&&<div className="ov" onClick={()=>setShowNew(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <h3>🧹 Nuevo servicio</h3>
      <div className="fg"><label>Nombre *</label><input className="fi" value={newS.nombre} onChange={e=>setNewS(v=>({...v,nombre:e.target.value}))} placeholder="Ej: Limpieza post-boda García"/></div>
      <div className="fg"><label>Fecha</label><input type="date" className="fi" value={newS.fecha} onChange={e=>setNewS(v=>({...v,fecha:e.target.value}))}/></div>
      <div className="mft"><button className="btn bg" onClick={()=>setShowNew(false)}>Cancelar</button><button className="btn bp" onClick={crearSrv} disabled={saving}>Crear y notificar</button></div>
    </div></div>}
    {showEx&&<div className="ov" onClick={()=>setShowEx(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <h3>➕ Tarea extra</h3>
      <div className="fg"><label>Descripción</label><input className="fi" value={newE.txt} onChange={e=>setNewE(v=>({...v,txt:e.target.value}))} placeholder="Ej: Limpiar jardín de invierno"/></div>
      <div className="fg"><label>Zona</label><input className="fi" value={newE.zona} onChange={e=>setNewE(v=>({...v,zona:e.target.value}))} placeholder="Ej: Exterior"/></div>
      <div className="mft"><button className="btn bg" onClick={()=>setShowEx(false)}>Cancelar</button><button className="btn bp" onClick={addExtra} disabled={saving}>Añadir</button></div>
    </div></div>}
    {notaM&&<NotaModal nota={nota} setNota={setNota} foto={foto} setFoto={setFoto} onSave={saveNota} onClose={()=>setNotaM(null)} tok={tok}/>}
  </>;
}

// ─── CALENDARIO ──────────────────────────────────────────────────────────────
function CalBase({ tok, simple=false }) {
  const today = new Date();
  const [mes, setMes] = useState(today.getMonth());
  const [año, setAño] = useState(today.getFullYear());
  const [sel, setSel] = useState(null);
  const [reservas, setReservas] = useState([]);

  useEffect(()=>{
    sbGet("reservas","?select=*&order=fecha.asc",tok).then(setReservas).catch(()=>{});
  },[]);

  const pm=()=>mes===0?(setMes(11),setAño(y=>y-1)):setMes(m=>m-1);
  const nm=()=>mes===11?(setMes(0),setAño(y=>y+1)):setMes(m=>m+1);
  const ds=d=>`${año}-${String(mes+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const gr=d=>reservas.filter(r=>r.fecha===ds(d));
  const off=new Date(año,mes,1).getDay(); const ofs=off===0?6:off-1; const dim=new Date(año,mes+1,0).getDate();
  const rsvMes=reservas.filter(r=>{const d=new Date(r.fecha);return d.getMonth()===mes&&d.getFullYear()===año;}).sort((a,b)=>new Date(a.fecha)-new Date(b.fecha));

  return <>
    <div className="cal-card" style={{overflow:"hidden"}}>
      <div className="cnav"><button onClick={pm}>‹</button><span className="cmon">{MESES[mes]} {año}</span><button onClick={nm}>›</button></div>
      <div className="cg">
        {D_SEM.map(d=><div key={d} className="ch">{d}</div>)}
        {Array(ofs).fill(null).map((_,i)=><div key={`e${i}`} className="cd empty"/>)}
        {Array(dim).fill(null).map((_,i)=>{
          const d=i+1,rsv=gr(d),isT=d===today.getDate()&&mes===today.getMonth()&&año===today.getFullYear();
          return <div key={d} className={`cd${isT?" today":""}${rsv.length?" hasev":""}${!simple&&sel===d?" sel":""}`} onClick={()=>!simple&&setSel(sel===d?null:d)}>
            <span>{d}</span>{rsv.length>0&&<div className="cdot" style={{background:simple?"#6366f1":(ESTADOS.find(e=>e.id===rsv[0].estado)?.col||"#6366f1")}}/>}
          </div>;
        })}
      </div>
      <div style={{marginTop:10,display:"flex",gap:6,flexWrap:"wrap"}}>
        {simple
          ? <div style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"#7a7f94"}}><div style={{width:7,height:7,borderRadius:"50%",background:"#6366f1",flexShrink:0}}/>Día con reserva</div>
          : ESTADOS.map(e=><div key={e.id} style={{display:"flex",alignItems:"center",gap:3,color:"#7a7f94"}}><div style={{width:6,height:6,borderRadius:"50%",background:e.col,flexShrink:0}}/><span style={{fontSize:10,whiteSpace:"nowrap"}}>{e.lbl}</span></div>)}
      </div>
    </div>
    <div style={{marginTop:14}}>
      {!simple&&(sel
        ? gr(sel).length===0
          ? <div className="card"><div className="empty"><span className="ico">✅</span><p>{sel} de {MESES[mes]} — Libre</p></div></div>
          : gr(sel).map(r=>{
              const est=ESTADOS.find(e=>e.id===r.estado);
              return <div key={r.id} className="card" style={{marginBottom:8,borderLeft:`3px solid ${est?.col||"#6366f1"}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                  <div style={{minWidth:0}}><div style={{fontSize:14,fontWeight:600,color:"#e8e6e1"}}>{r.nombre}</div>{r.tipo&&<div style={{fontSize:12,color:"#7a7f94",marginTop:3}}>🎉 {r.tipo}</div>}{r.precio&&<div style={{fontSize:12,color:"#c9a84c",marginTop:2}}>💰 {parseFloat(r.precio).toLocaleString("es-ES")}€</div>}</div>
                  {est&&<span className="badge" style={{background:`${est.col}18`,color:est.col,border:`1px solid ${est.col}30`,flexShrink:0}}>{est.lbl}</span>}
                </div>
              </div>;})
        : <div className="card"><div className="empty"><span className="ico">📅</span><p>Pulsa un día para ver detalles</p></div></div>
      )}
      {simple&&(rsvMes.length===0
        ? <div className="card"><div className="empty"><span className="ico">✅</span><p>Sin eventos este mes</p></div></div>
        : rsvMes.map(r=><div key={r.id} className="card" style={{marginBottom:8,borderLeft:"3px solid #6366f1"}}>
            <div style={{fontSize:13,fontWeight:600,color:"#e8e6e1"}}>{r.nombre}</div>
            <div style={{fontSize:12,color:"#7a7f94",marginTop:3}}>📅 {new Date(r.fecha).toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"})}</div>
            {r.tipo&&<div style={{fontSize:11,color:"#5a5e6e",marginTop:2}}>🎉 {r.tipo}</div>}
          </div>))}
    </div>
  </>;
}
function Calendario({ tok }) { return <><div className="ph"><h2>Calendario de reservas</h2></div><div className="pb" style={{maxWidth:900}}><CalBase tok={tok}/></div></>; }
function CalLimpieza({ tok }) { return <><div className="ph"><h2>Calendario</h2><p>Organiza tu servicio según los eventos</p></div><div className="pb" style={{maxWidth:900}}><CalBase tok={tok} simple/></div></>; }

// ─── RESERVAS ────────────────────────────────────────────────────────────────
function Reservas({ tok, rol }) {
  const isA = rol==="admin";
  const [reservas, setReservas] = useState([]);
  const [filtro,   setFiltro]   = useState("todas");
  const [sel,      setSel]      = useState(null);
  const [load,     setLoad]     = useState(true);

  const load_ = async () => { const r=await sbGet("reservas","?select=*&order=fecha.desc",tok); setReservas(r); setLoad(false); };
  useEffect(()=>{load_();},[]);

  const cambiarE = async (id,e) => {
    await sbPatch("reservas",`id=eq.${id}`,{estado:e,updated_at:new Date().toISOString()},tok);
    setReservas(prev=>prev.map(r=>r.id===id?{...r,estado:e}:r));
    setSel(p=>p?.id===id?{...p,estado:e}:p);
  };
  const del = async (id) => { await sbDelete("reservas",`id=eq.${id}`,tok); setReservas(prev=>prev.filter(r=>r.id!==id)); setSel(null); };

  if (load) return <div className="loading"><div className="spin"/><span>Cargando…</span></div>;
  const lista = reservas.filter(r=>filtro==="todas"||r.estado===filtro);

  return <>
    <div className="ph"><h2>Reservas</h2><p>{reservas.length} registradas</p></div>
    <div className="pb">
      <div className="tabs">
        <button className={`tab${filtro==="todas"?" on":""}`} onClick={()=>setFiltro("todas")}>Todas</button>
        {ESTADOS.map(e=><button key={e.id} className={`tab${filtro===e.id?" on":""}`} onClick={()=>setFiltro(e.id)}>{e.lbl}</button>)}
      </div>
      <div className="g2" style={{alignItems:"flex-start"}}>
        <div>
          {lista.length===0?<div className="empty"><span className="ico">📋</span><p>Sin reservas</p></div>
            :lista.map(r=>{
              const est=ESTADOS.find(e=>e.id===r.estado);
              return <div key={r.id} className="rc" style={{borderLeftColor:est?.col}} onClick={()=>setSel(r)}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:600,color:"#e8e6e1",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.nombre}</div>
                    <div style={{fontSize:11,color:"#7a7f94",marginTop:3}}>📅 {new Date(r.fecha).toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>
                    {r.tipo&&<div style={{fontSize:11,color:"#5a5e6e"}}>🎉 {r.tipo}</div>}
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:16,fontWeight:700,color:"#c9a84c"}}>{parseFloat(r.precio||0).toLocaleString("es-ES")}€</div>
                    {est&&<span className="badge" style={{background:`${est.col}18`,color:est.col,border:`1px solid ${est.col}30`,display:"inline-block",marginTop:3}}>{est.lbl}</span>}
                  </div>
                </div>
              </div>;
            })}
        </div>
        {sel&&<div className="card" style={{position:"sticky",top:20}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:16,gap:8}}>
            <div style={{minWidth:0}}><div style={{fontSize:18,fontWeight:700,color:"#e8e6e1",fontFamily:"'Playfair Display',serif"}}>{sel.nombre}</div><SBadge e={sel.estado}/></div>
            <button className="btn bg sm" style={{flexShrink:0}} onClick={()=>setSel(null)}>✕</button>
          </div>
          <div className="g2" style={{marginBottom:14}}>
            {[{l:"FECHA",v:new Date(sel.fecha).toLocaleDateString("es-ES",{day:"numeric",month:"long",year:"numeric"})},{l:"PRECIO",v:`${parseFloat(sel.precio||0).toLocaleString("es-ES")}€`,gold:true},{l:"TIPO",v:sel.tipo},{l:"CONTACTO",v:sel.contacto}].filter(x=>x.v).map(x=>(
              <div key={x.l} style={{background:"#0f1117",borderRadius:8,padding:11}}>
                <div style={{fontSize:10,color:"#5a5e6e"}}>{x.l}</div>
                <div style={{fontSize:x.gold?16:12,fontWeight:x.gold?700:400,color:x.gold?"#c9a84c":"#e8e6e1",marginTop:3}}>{x.v}</div>
              </div>))}
          </div>
          {sel.obs&&<div style={{background:"#0f1117",borderRadius:8,padding:11,marginBottom:14}}><div style={{fontSize:10,color:"#5a5e6e",marginBottom:5}}>OBSERVACIONES</div><div style={{fontSize:12,color:"#c9c5b8",lineHeight:1.5}}>{sel.obs}</div></div>}
          {isA&&<><hr className="div"/>
            <div style={{fontSize:10,color:"#5a5e6e",marginBottom:9,textTransform:"uppercase",letterSpacing:1}}>Cambiar estado</div>
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              {ESTADOS.map(e=><button key={e.id} className="btn bg" style={{justifyContent:"flex-start",borderColor:sel.estado===e.id?e.col:undefined,color:sel.estado===e.id?e.col:undefined}} onClick={()=>cambiarE(sel.id,e.id)}>
                <span style={{width:7,height:7,borderRadius:"50%",background:e.col,display:"inline-block",flexShrink:0}}/>{e.lbl}{sel.estado===e.id?" ✓":""}
              </button>)}
            </div>
            <hr className="div"/>
            <button className="btn br" style={{width:"100%",justifyContent:"center"}} onClick={()=>del(sel.id)}>🗑 Eliminar reserva</button>
          </>}
        </div>}
      </div>
    </div>
  </>;
}

function NuevaReserva({ perfil, tok, setPage }) {
  const [form, setForm] = useState({nombre:"",fecha:"",tipo:"Boda",precio:"",contacto:"",obs:"",estado:"visita"});
  const [ok, setOk] = useState(false); const [saving, setSaving] = useState(false);
  const tipos = ["Boda","Cumpleaños","Comunión","Bautizo","Aniversario","Empresa","Otro"];
  const submit = async () => {
    if (!form.nombre||!form.fecha||saving) return;
    setSaving(true);
    try { await sbPost("reservas",{...form,precio:parseFloat(form.precio)||0,creado_por:perfil.id},tok); setOk(true); setTimeout(()=>{setOk(false);setPage("reservas");},2000); setForm({nombre:"",fecha:"",tipo:"Boda",precio:"",contacto:"",obs:"",estado:"visita"}); }
    catch(_) {}
    setSaving(false);
  };
  return <>
    <div className="ph"><h2>Nueva reserva</h2></div>
    <div className="pb"><div style={{maxWidth:600}}>
      {ok&&<div style={{background:"rgba(16,185,129,.1)",border:"1px solid rgba(16,185,129,.3)",borderRadius:10,padding:"12px 15px",marginBottom:16,color:"#10b981",fontSize:13}}>✅ Reserva creada. Redirigiendo…</div>}
      <div className="card">
        <div className="fg"><label>Nombre del cliente *</label><input className="fi" value={form.nombre} onChange={e=>setForm(v=>({...v,nombre:e.target.value}))} placeholder="Ej: María y Carlos García"/></div>
        <div className="g2">
          <div className="fg"><label>Fecha *</label><input type="date" className="fi" value={form.fecha} onChange={e=>setForm(v=>({...v,fecha:e.target.value}))}/></div>
          <div className="fg"><label>Tipo</label><select className="fi" value={form.tipo} onChange={e=>setForm(v=>({...v,tipo:e.target.value}))}>{tipos.map(t=><option key={t}>{t}</option>)}</select></div>
        </div>
        <div className="g2">
          <div className="fg"><label>Precio (€)</label><input type="number" inputMode="numeric" className="fi" value={form.precio} onChange={e=>setForm(v=>({...v,precio:e.target.value}))} placeholder="0"/></div>
          <div className="fg"><label>Contacto</label><input className="fi" type="tel" inputMode="tel" value={form.contacto} onChange={e=>setForm(v=>({...v,contacto:e.target.value}))} placeholder="600 000 000"/></div>
        </div>
        <div className="fg"><label>Estado inicial</label><select className="fi" value={form.estado} onChange={e=>setForm(v=>({...v,estado:e.target.value}))}>{ESTADOS.map(e=><option key={e.id} value={e.id}>{e.lbl}</option>)}</select></div>
        <div className="fg"><label>Observaciones</label><textarea className="fi" rows={3} value={form.obs} onChange={e=>setForm(v=>({...v,obs:e.target.value}))} placeholder="Notas, menú, decoración…"/></div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><button className="btn bg" onClick={()=>setPage("reservas")}>Cancelar</button><button className="btn bp" onClick={submit} disabled={saving}>✓ Crear reserva</button></div>
      </div>
    </div></div>
  </>;
}

// ─── CHAT ────────────────────────────────────────────────────────────────────
function Chat({ perfil, tok, rol }) {
  const isA   = rol==="admin";
  const [usuarios, setUsuarios] = useState([]);
  const [conId,    setConId]    = useState(isA ? null : "admin");
  const [msgs,     setMsgs]     = useState([]);
  const [txt,      setTxt]      = useState("");
  const [fotoMsg,  setFotoMsg]  = useState(null);
  const [mobView,  setMobView]  = useState(isA?"list":"chat");
  const [load,     setLoad]     = useState(true);
  const endRef   = useRef(null);
  const inputRef = useRef(null);

  const myId = isA ? "admin" : perfil.id;

  useEffect(()=>{
    sbGet("usuarios","?rol=neq.admin&select=*",tok).then(u=>{setUsuarios(u);setLoad(false);}).catch(()=>setLoad(false));
  },[]);

  useEffect(()=>{
    if (!conId) return;
    const otherId = conId;
    sbGet("mensajes",`?or=(and(de.eq.${myId},para.eq.${otherId}),and(de.eq.${otherId},para.eq.${myId}))&order=created_at.asc`,tok)
      .then(setMsgs).catch(()=>{});
    // Marcar leídos
    sbPatch("mensajes",`para=eq.${myId}&de=eq.${otherId}&leido=eq.false`,{leido:true},tok).catch(()=>{});
  },[conId]);

  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},[msgs.length]);

  const send = async () => {
    if ((!txt.trim()&&!fotoMsg)||!conId) return;
    const body={de:String(myId),para:String(conId),txt:txt.trim()||null,foto_url:fotoMsg||null,leido:false};
    setTxt(""); setFotoMsg(null);
    try {
      const [m]=await sbPost("mensajes",body,tok);
      setMsgs(prev=>[...prev,m]);
    } catch(_) {}
    setTimeout(()=>inputRef.current?.focus(),0);
  };

  const selectU = (id) => { setConId(String(id)); setMobView("chat"); };
  const conUser = usuarios.find(u=>String(u.id)===String(conId));

  const msgsList = (
    <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:8,padding:"14px 16px"}}>
      {msgs.length===0&&<div style={{textAlign:"center",color:"#5a5e6e",fontSize:13,padding:"36px 0"}}>Comienza la conversación…</div>}
      {msgs.map(m=>{
        const mine=String(m.de)===String(myId);
        return <div key={m.id} className={`bub${mine?" me":" them"}`}>
          {m.txt&&<div>{m.txt}</div>}
          {m.foto_url&&<img src={m.foto_url} alt="" style={{maxWidth:200,maxHeight:160,borderRadius:8,marginTop:6,objectFit:"cover",display:"block"}}/>}
          <div className="bmeta">{fmtDT(m.created_at)}</div>
        </div>;
      })}
      <div ref={endRef}/>
    </div>
  );

  const inputBar = (isInline) => (
    <div style={{flexShrink:0,borderTop:"1px solid rgba(255,255,255,.08)",padding:"10px 14px",
      display:"flex",gap:8,alignItems:"flex-end",background:"#13161f",
      ...(isInline?{}:{position:"absolute",bottom:0,left:0,right:0,zIndex:10})}}>
      <div style={{flex:1,minWidth:0}}>
        {fotoMsg&&<div style={{marginBottom:8,position:"relative",display:"inline-block"}}>
          <img src={fotoMsg} alt="" style={{height:50,borderRadius:6,objectFit:"cover"}}/>
          <button onClick={()=>setFotoMsg(null)} style={{position:"absolute",top:-6,right:-6,background:"#e85555",border:"none",borderRadius:"50%",width:18,height:18,cursor:"pointer",color:"#fff",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>}
        <textarea ref={inputRef} className="fi" rows={2} value={txt} onChange={e=>setTxt(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&window.innerWidth>768){e.preventDefault();send();}}}
          placeholder="Escribe un mensaje…" style={{resize:"none",fontSize:15,lineHeight:1.5}}/>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:6,flexShrink:0}}>
        <label style={{cursor:"pointer",width:44,height:44,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,color:"#c9a84c",fontSize:20,display:"flex",alignItems:"center",justifyContent:"center"}}>
          📷<input type="file" accept="image/*" capture="environment" style={{display:"none"}}
            onChange={async e=>{const f=e.target.files[0];if(f){try{const url=await uploadFoto(f,tok);setFotoMsg(url);}catch(_){const r=new FileReader();r.onload=ev=>setFotoMsg(ev.target.result);r.readAsDataURL(f);}}}}/>
        </label>
        <button onClick={send} style={{width:44,height:44,background:"#c9a84c",border:"none",borderRadius:10,color:"#0f1117",fontSize:22,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>→</button>
      </div>
    </div>
  );

  if (load) return <div className="loading"><div className="spin"/><span>Cargando…</span></div>;

  return <>
    <div className="ph chat-ph"><h2>💬 {isA?"Chat con el equipo":"Chat con administración"}</h2></div>
    {/* Desktop */}
    <div className="chat-desktop" style={{display:"flex",height:"calc(100vh - 128px)",minHeight:300,overflow:"hidden"}}>
      {isA&&<div className="chat-list-col">
        <div style={{padding:"12px 14px 8px",fontSize:10,color:"#5a5e6e",textTransform:"uppercase",letterSpacing:1}}>Conversaciones</div>
        {usuarios.map(u=><div key={u.id} className={`cu${String(conId)===String(u.id)?" on":""}`} onClick={()=>selectU(u.id)}>
          <div className="av" style={{width:32,height:32,fontSize:11}}>{u.avatar||u.nombre.slice(0,2).toUpperCase()}</div>
          <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,color:"#c9c5b8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.nombre}</div><div style={{fontSize:10,color:"#5a5e6e",textTransform:"capitalize"}}>{u.rol}</div></div>
        </div>)}
      </div>}
      {conId ? <div className="chat-area">
        <div className="chdr2">
          <div className="av" style={{width:32,height:32,fontSize:11}}>{isA?(conUser?.avatar||conUser?.nombre?.slice(0,2).toUpperCase()||"?"):"AD"}</div>
          <div><div style={{fontSize:13,fontWeight:600,color:"#e8e6e1"}}>{isA?(conUser?.nombre||"…"):"Administración"}</div><div style={{fontSize:10,color:"#5a5e6e",textTransform:"capitalize"}}>{isA?(conUser?.rol||""):"admin"}</div></div>
        </div>
        <div className="msgs">{msgs.length===0&&<div style={{textAlign:"center",color:"#5a5e6e",fontSize:13,padding:"36px 0"}}>Comienza la conversación…</div>}
          {msgs.map(m=>{const mine=String(m.de)===String(myId);return <div key={m.id} className={`bub${mine?" me":" them"}`}>{m.txt&&<div>{m.txt}</div>}{m.foto_url&&<img src={m.foto_url} alt="" style={{maxWidth:200,maxHeight:160,borderRadius:8,marginTop:6,objectFit:"cover",display:"block"}}/>}<div className="bmeta">{fmtDT(m.created_at)}</div></div>;})}
          <div ref={endRef}/>
        </div>
        {inputBar(true)}
      </div> : <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}><div className="empty"><span className="ico">💬</span><p>Selecciona una conversación</p></div></div>}
    </div>
    {/* Mobile */}
    <div className="chat-page">
      {isA&&mobView==="list"&&<div className="chat-mobile-list">
        <div style={{padding:"14px 16px 8px",fontSize:10,color:"#5a5e6e",textTransform:"uppercase",letterSpacing:1}}>Conversaciones</div>
        {usuarios.map(u=><div key={u.id} className="cu" style={{padding:"14px 16px",borderBottom:"1px solid rgba(255,255,255,.06)"}} onClick={()=>selectU(u.id)}>
          <div className="av" style={{width:40,height:40,fontSize:13}}>{u.avatar||u.nombre.slice(0,2).toUpperCase()}</div>
          <div style={{flex:1,minWidth:0,marginLeft:4}}><div style={{fontSize:15,color:"#c9c5b8",fontWeight:500}}>{u.nombre}</div><div style={{fontSize:12,color:"#5a5e6e",textTransform:"capitalize",marginTop:2}}>{u.rol}</div></div>
          <span style={{color:"#5a5e6e",fontSize:22}}>›</span>
        </div>)}
      </div>}
      {(mobView==="chat"||!isA)&&conId&&<div className="chat-mobile-area">
        <div style={{flexShrink:0,padding:"11px 16px",borderBottom:"1px solid rgba(255,255,255,.07)",display:"flex",alignItems:"center",gap:10,background:"#13161f"}}>
          {isA&&<button onClick={()=>setMobView("list")} style={{background:"none",border:"none",color:"#c9a84c",fontSize:26,cursor:"pointer",padding:"0 8px 0 0",lineHeight:1,flexShrink:0}}>‹</button>}
          <div className="av" style={{width:36,height:36,fontSize:12,flexShrink:0}}>{isA?(conUser?.avatar||conUser?.nombre?.slice(0,2).toUpperCase()||"?"):"AD"}</div>
          <div><div style={{fontSize:14,fontWeight:600,color:"#e8e6e1"}}>{isA?(conUser?.nombre||"…"):"Administración"}</div><div style={{fontSize:11,color:"#5a5e6e",textTransform:"capitalize"}}>{isA?(conUser?.rol||""):"admin"}</div></div>
        </div>
        <div className="chat-mobile-msgs">{msgs.length===0&&<div style={{textAlign:"center",color:"#5a5e6e",fontSize:13,padding:"32px 0"}}>Comienza la conversación…</div>}
          {msgs.map(m=>{const mine=String(m.de)===String(myId);return <div key={m.id} className={`bub${mine?" me":" them"}`}>{m.txt&&<div>{m.txt}</div>}{m.foto_url&&<img src={m.foto_url} alt="" style={{maxWidth:"70%",borderRadius:8,marginTop:6,objectFit:"cover",display:"block"}}/>}<div className="bmeta">{fmtDT(m.created_at)}</div></div>;})}
          <div ref={endRef}/>
        </div>
        <div className="chat-mobile-inp">
          <div style={{flex:1,minWidth:0}}>
            {fotoMsg&&<div style={{marginBottom:8,position:"relative",display:"inline-block"}}><img src={fotoMsg} alt="" style={{height:48,borderRadius:6,objectFit:"cover"}}/><button onClick={()=>setFotoMsg(null)} style={{position:"absolute",top:-6,right:-6,background:"#e85555",border:"none",borderRadius:"50%",width:18,height:18,cursor:"pointer",color:"#fff",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button></div>}
            <textarea ref={inputRef} className="fi" rows={2} value={txt} onChange={e=>setTxt(e.target.value)} placeholder="Escribe un mensaje…" style={{resize:"none",fontSize:15,lineHeight:1.5,minHeight:44}}/>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6,flexShrink:0}}>
            <label style={{cursor:"pointer",width:44,height:44,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,color:"#c9a84c",fontSize:20,display:"flex",alignItems:"center",justifyContent:"center"}}>
              📷<input type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={async e=>{const f=e.target.files[0];if(f){try{const url=await uploadFoto(f,tok);setFotoMsg(url);}catch(_){const r=new FileReader();r.onload=ev=>setFotoMsg(ev.target.result);r.readAsDataURL(f);}}}}/>
            </label>
            <button onClick={send} style={{width:44,height:44,background:"#c9a84c",border:"none",borderRadius:10,color:"#0f1117",fontSize:22,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>→</button>
          </div>
        </div>
      </div>}
    </div>
  </>;
}

// ─── NOTIFICACIONES ──────────────────────────────────────────────────────────
function Notifs({ perfil, tok, rol }) {
  const isA = rol==="admin";
  const [notifs, setNotifs] = useState([]);
  const [usuarios,setUsuarios]=useState([]);
  const [dest,   setDest]   = useState("");
  const [txt,    setTxt]    = useState("");
  const [load,   setLoad]   = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(()=>{
    (async()=>{
      const n = isA
        ? await sbGet("notificaciones","?select=*,usuarios(nombre,rol)&order=created_at.desc",tok)
        : await sbGet("notificaciones",`?para=eq.${perfil.id}&order=created_at.desc`,tok);
      setNotifs(n);
      if(isA){const u=await sbGet("usuarios","?rol=neq.admin&select=*",tok);setUsuarios(u);}
      setLoad(false);
    })();
  },[]);

  const enviar = async () => {
    if (!txt.trim()||!dest||saving) return;
    setSaving(true);
    const targets = dest==="todos" ? usuarios : usuarios.filter(u=>String(u.id)===dest);
    for(const u of targets){ await sbPost("notificaciones",{para:u.id,txt},tok); sendPush("🌾 Finca El Molino",txt,`notif-${u.id}`); }
    setTxt(""); setDest(""); setSaving(false);
  };

  const leer = async (id) => {
    await sbPatch("notificaciones",`id=eq.${id}`,{leida:true},tok);
    setNotifs(prev=>prev.map(n=>n.id===id?{...n,leida:true}:n));
  };

  if (load) return <div className="loading"><div className="spin"/><span>Cargando…</span></div>;
  const RL={jardinero:"Jardinero",limpieza:"Limpieza",comercial:"Comercial"};

  return <>
    <div className="ph"><h2>🔔 Notificaciones</h2><p>{isA?"Envía avisos al equipo":`${notifs.filter(n=>!n.leida).length} sin leer`}</p></div>
    <div className="pb">
      {isA&&<div className="card" style={{marginBottom:20}}>
        <div className="ctit" style={{marginBottom:14}}>📢 Enviar aviso</div>
        <div className="fg"><label>Destinatario</label>
          <select className="fi" value={dest} onChange={e=>setDest(e.target.value)}>
            <option value="">Selecciona…</option>
            <option value="todos">📢 Todos los operarios</option>
            {usuarios.map(u=><option key={u.id} value={String(u.id)}>{u.nombre} ({RL[u.rol]||u.rol})</option>)}
          </select>
        </div>
        <div className="fg"><label>Mensaje</label><textarea className="fi" rows={3} value={txt} onChange={e=>setTxt(e.target.value)} placeholder="Ej: Esta semana hay que revisar el riego antes del jueves…"/></div>
        <button className="btn bp" onClick={enviar} disabled={saving}>📤 Enviar</button>
      </div>}
      {notifs.length===0?<div className="empty"><span className="ico">🔔</span><p>Sin notificaciones</p></div>
        :<div className="card" style={{padding:0,overflow:"hidden"}}>
          {notifs.map(n=>{
            const destU=isA?(n.usuarios||null):null;
            return <div key={n.id} className={`nitem${!n.leida?" unread":""}`}>
              <div className={`ndot${n.leida?" read":""}`}/>
              <div style={{flex:1,minWidth:0}}>
                {isA&&destU&&<div style={{fontSize:10,color:"#c9a84c",marginBottom:3}}>→ {destU.nombre}</div>}
                <div style={{fontSize:13,color:n.leida?"#7a7f94":"#c9c5b8",lineHeight:1.4}}>{n.txt}</div>
                <div style={{fontSize:10,color:"#5a5e6e",marginTop:4}}>{fmtDT(n.created_at)}</div>
              </div>
              {!n.leida&&!isA&&<button className="btn bg sm" style={{flexShrink:0}} onClick={()=>leer(n.id)}>✓</button>}
            </div>;
          })}
        </div>}
    </div>
  </>;
}

// ─── USUARIOS (admin) ────────────────────────────────────────────────────────
function Usuarios({ tok }) {
  const [usuarios, setUsuarios] = useState([]);
  const [load, setLoad] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({email:"",password:"",nombre:"",rol:"jardinero"});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(()=>{
    sbGet("usuarios","?select=*&order=rol.asc",tok).then(setUsuarios).catch(()=>{}).finally(()=>setLoad(false));
  },[]);

  const crearUsuario = async () => {
    if (!form.email||!form.password||!form.nombre||saving) return;
    setSaving(true); setErr("");
    try {
      // Crear en Auth via Admin API
      const r = await fetch(`${SB_URL}/auth/v1/admin/users`,{
        method:"POST",
        headers:{...HDR,"Authorization":`Bearer ${tok}`},
        body:JSON.stringify({email:form.email,password:form.password,email_confirm:true})
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message||"Error al crear usuario");
      // Insertar perfil
      await sbPost("usuarios",{id:d.id,nombre:form.nombre,rol:form.rol,avatar:form.nombre.slice(0,2).toUpperCase()},tok);
      setShowAdd(false); setForm({email:"",password:"",nombre:"",rol:"jardinero"});
      const u = await sbGet("usuarios","?select=*&order=rol.asc",tok); setUsuarios(u);
    } catch(e){ setErr(e.message||"Error"); }
    setSaving(false);
  };

  const RL={admin:"Administrador",jardinero:"Jardinero",limpieza:"Limpieza",comercial:"Comercial"};
  const RC={admin:"#c9a84c",jardinero:"#10b981",limpieza:"#6366f1",comercial:"#f59e0b"};

  if (load) return <div className="loading"><div className="spin"/><span>Cargando…</span></div>;

  return <>
    <div className="ph"><h2>Usuarios del sistema</h2><p>Gestión de accesos</p></div>
    <div className="pb">
      <div style={{marginBottom:20}}><button className="btn bp" onClick={()=>setShowAdd(true)}>➕ Añadir usuario</button></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(250px,1fr))",gap:14}}>
        {usuarios.map(u=>(
          <div key={u.id} className="card">
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
              <div style={{width:44,height:44,borderRadius:"50%",background:`${RC[u.rol]||"#c9a84c"}20`,border:`2px solid ${RC[u.rol]||"#c9a84c"}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:RC[u.rol]||"#c9a84c",flexShrink:0}}>{u.avatar||u.nombre.slice(0,2).toUpperCase()}</div>
              <div style={{minWidth:0}}>
                <div style={{fontSize:14,fontWeight:600,color:"#e8e6e1",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.nombre}</div>
                <span className="badge" style={{background:`${RC[u.rol]||"#c9a84c"}15`,color:RC[u.rol]||"#c9a84c",border:`1px solid ${RC[u.rol]||"#c9a84c"}30`,marginTop:3,display:"inline-block"}}>{RL[u.rol]||u.rol}</span>
              </div>
            </div>
            <div style={{fontSize:11,color:"#3d4155"}}>🔑 {u.id.slice(0,8)}…</div>
          </div>
        ))}
      </div>
    </div>
    {showAdd&&<div className="ov" onClick={()=>setShowAdd(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <h3>➕ Nuevo usuario</h3>
      {err&&<div className="alert">{err}</div>}
      <div className="fg"><label>Nombre completo</label><input className="fi" value={form.nombre} onChange={e=>setForm(v=>({...v,nombre:e.target.value}))} placeholder="Ej: Carlos García"/></div>
      <div className="fg"><label>Email</label><input className="fi" type="email" value={form.email} onChange={e=>setForm(v=>({...v,email:e.target.value}))} placeholder="carlos@elmolino.es"/></div>
      <div className="fg"><label>Contraseña inicial</label><input className="fi" type="text" value={form.password} onChange={e=>setForm(v=>({...v,password:e.target.value}))} placeholder="min. 6 caracteres"/></div>
      <div className="fg"><label>Rol</label>
        <select className="fi" value={form.rol} onChange={e=>setForm(v=>({...v,rol:e.target.value}))}>
          <option value="jardinero">Jardinero</option>
          <option value="limpieza">Limpieza</option>
          <option value="comercial">Comercial</option>
          <option value="admin">Administrador</option>
        </select>
      </div>
      <p style={{fontSize:11,color:"#5a5e6e",marginBottom:14,lineHeight:1.5}}>El usuario recibirá su email y contraseña para acceder a la app. Puede cambiar la contraseña desde su perfil.</p>
      <div className="mft"><button className="btn bg" onClick={()=>setShowAdd(false)}>Cancelar</button><button className="btn bp" onClick={crearUsuario} disabled={saving}>{saving?"Creando…":"Crear usuario"}</button></div>
    </div></div>}
  </>;
}

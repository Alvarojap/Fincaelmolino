import { useState, useEffect, useRef } from "react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

// ─── SUPABASE ────────────────────────────────────────────────────────────────
const SB_URL = "https://bqubxkuuyohuatdothwx.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxdWJ4a3V1eW9odWF0ZG90aHd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NTE0MzgsImV4cCI6MjA5MDAyNzQzOH0.kwYPiTj0KOmw9RAm88DNceAYdFC3yHF4ogSzXXwSIDA";
const HDR  = { "Content-Type":"application/json","apikey":SB_KEY,"Authorization":`Bearer ${SB_KEY}` };
const HDRA = tok => ({ ...HDR, "Authorization":`Bearer ${tok}` });

async function sbGet(table, params="", tok=SB_KEY) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}${params}`,{headers:HDRA(tok)});
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function sbPost(table, body, tok=SB_KEY) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}`,{
    method:"POST", headers:{...HDRA(tok),"Prefer":"return=representation"},
    body:JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function sbPatch(table, filter, body, tok=SB_KEY) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${filter}`,{
    method:"PATCH", headers:{...HDRA(tok),"Prefer":"return=representation"},
    body:JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function sbDelete(table, filter, tok=SB_KEY) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${filter}`,{method:"DELETE",headers:HDRA(tok)});
  if (!r.ok) throw new Error(await r.text());
}
async function sbUpsert(table, body, tok=SB_KEY) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}`,{
    method:"POST", headers:{...HDRA(tok),"Prefer":"resolution=merge-duplicates,return=representation"},
    body:JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function authLogin(email, password) {
  const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`,{
    method:"POST", headers:HDR, body:JSON.stringify({email,password})
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error_description||d.message||"Error de login");
  return d;
}
async function authLogout(tok) {
  await fetch(`${SB_URL}/auth/v1/logout`,{method:"POST",headers:HDRA(tok)});
}
async function uploadFoto(file, tok) {
  const ext = file.name.split(".").pop();
  const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const r = await fetch(`${SB_URL}/storage/v1/object/fotos/${path}`,{
    method:"POST", headers:{"apikey":SB_KEY,"Authorization":`Bearer ${tok}`,"Content-Type":file.type},
    body:file
  });
  if (!r.ok) throw new Error(await r.text());
  return `${SB_URL}/storage/v1/object/public/fotos/${path}`;
}

// ─── DATOS ESTÁTICOS ─────────────────────────────────────────────────────────
function getTemporada() {
  const m = new Date().getMonth()+1;
  if (m>=4&&m<=5) return "primavera";
  if (m>=6&&m<=9) return "verano";
  return "invierno";
}
const TEMPORADA_LBL = {
  primavera:"🌸 Primavera (Abril–Mayo)",
  verano:"☀️ Verano (Junio–Septiembre)",
  invierno:"🍂 Invierno (Octubre–Marzo)"
};
const JARDIN_T = {
  primavera:[
    {id:"p1", txt:"Riego semanal completado (césped + plantas + revisión zonas)", zona:"Riego",   frec:1},
    {id:"p2", txt:"Cortar césped",                                                zona:"Césped",  frec:1},
    {id:"p3", txt:"Perfilar bordes del césped",                                   zona:"Césped",  frec:1},
    {id:"p4", txt:"Soplado general (hojas, ramas, suciedad)",                     zona:"General", frec:1},
    {id:"p5", txt:"Limpiar camino de entrada",                                    zona:"Accesos", frec:1},
    {id:"p6", txt:"Limpiar porche zona baños y BBQ",                              zona:"Porche",  frec:1},
    {id:"p7", txt:"Vaciar papeleras",                                             zona:"General", frec:1},
    {id:"p8", txt:"Limpiar piscina (superficie + fondo rápido)",                  zona:"Piscina", frec:1},
    {id:"p9", txt:"Reponer cloro piscina",                                        zona:"Piscina", frec:1},
    {id:"p10",txt:"Eliminar malas hierbas visibles",                              zona:"General", frec:1},
    {id:"p11",txt:"Revisión general visual del jardín",                           zona:"General", frec:1},
    {id:"p12",txt:"Abonar césped",                                                zona:"Césped",  frec:2},
    {id:"p13",txt:"Limpieza profunda de grava (nivelar + retirar suciedad)",      zona:"Grava",   frec:2},
    {id:"p14",txt:"Limpieza de bordes y rincones",                                zona:"General", frec:2},
    {id:"p15",txt:"Recoger manguera (bien enrollada)",                            zona:"Cierre",  frec:1},
    {id:"p16",txt:"Recoger herramientas y material",                              zona:"Cierre",  frec:1},
    {id:"p17",txt:"Dejar jardín limpio y ordenado",                               zona:"Cierre",  frec:1},
  ],
  verano:[
    {id:"v1", txt:"Riego diario completado (césped + plantas, mañana o noche)",   zona:"Riego",   frec:1},
    {id:"v2", txt:"Revisión visual rápida + retirar hojas y suciedad",            zona:"General", frec:1},
    {id:"v3", txt:"Cortar césped",                                                zona:"Césped",  frec:1},
    {id:"v4", txt:"Perfilar bordes",                                              zona:"Césped",  frec:1},
    {id:"v5", txt:"Soplado general",                                              zona:"General", frec:1},
    {id:"v6", txt:"Limpiar camino de entrada",                                    zona:"Accesos", frec:1},
    {id:"v7", txt:"Limpiar porche zona baños y BBQ",                              zona:"Porche",  frec:1},
    {id:"v8", txt:"Limpiar piscina (fondo + paredes)",                            zona:"Piscina", frec:1},
    {id:"v9", txt:"Ajustar cloro y pH",                                           zona:"Piscina", frec:1},
    {id:"v10",txt:"Limpiar y ordenar zona piscina",                               zona:"Piscina", frec:1},
    {id:"v11",txt:"Vaciar papeleras",                                             zona:"General", frec:1},
    {id:"v12",txt:"Eliminar malas hierbas visibles",                              zona:"General", frec:1},
    {id:"v13",txt:"Eliminación profunda de malas hierbas (raíz)",                 zona:"General", frec:2},
    {id:"v14",txt:"Limpieza y nivelado de grava",                                 zona:"Grava",   frec:2},
    {id:"v15",txt:"Limpieza de drenajes y rejillas",                              zona:"General", frec:2},
    {id:"v16",txt:"Abonar césped",                                                zona:"Césped",  frec:4},
    {id:"v17",txt:"Revisión de ramas secas o caídas",                             zona:"General", frec:4},
    {id:"v18",txt:"Limpieza profunda de pavimentos (manchas)",                    zona:"Accesos", frec:4},
    {id:"v19",txt:"Recoger manguera",                                             zona:"Cierre",  frec:1},
    {id:"v20",txt:"Recoger herramientas",                                         zona:"Cierre",  frec:1},
    {id:"v21",txt:"Dejar todo perfecto visualmente",                              zona:"Cierre",  frec:1},
  ],
  invierno:[
    {id:"i1", txt:"Riego semanal (según clima)",                                  zona:"Riego",   frec:1},
    {id:"i2", txt:"Soplado de hojas",                                             zona:"General", frec:1},
    {id:"i3", txt:"Limpiar camino de entrada",                                    zona:"Accesos", frec:1},
    {id:"i4", txt:"Limpiar porche zona baños y BBQ",                              zona:"Porche",  frec:1},
    {id:"i5", txt:"Limpieza general del jardín",                                  zona:"General", frec:1},
    {id:"i6", txt:"Vaciar papeleras",                                             zona:"General", frec:1},
    {id:"i7", txt:"Limpiar piscina",                                              zona:"Piscina", frec:2},
    {id:"i8", txt:"Ajustar cloro",                                                zona:"Piscina", frec:2},
    {id:"i9", txt:"Revisar estado del agua",                                      zona:"Piscina", frec:2},
    {id:"i10",txt:"Eliminar malas hierbas visibles",                              zona:"General", frec:2},
    {id:"i11",txt:"Cortar césped",                                                zona:"Césped",  frec:4},
    {id:"i12",txt:"Perfilar bordes",                                              zona:"Césped",  frec:4},
    {id:"i13",txt:"Limpieza profunda de grava",                                   zona:"Grava",   frec:4},
    {id:"i14",txt:"Revisión general del jardín",                                  zona:"General", frec:4},
    {id:"i15",txt:"Poda de árboles",                                              zona:"Árboles", frec:12},
    {id:"i16",txt:"Recorte de setos",                                             zona:"Setos",   frec:12},
    {id:"i17",txt:"Re-siembra de césped",                                         zona:"Césped",  frec:12},
    {id:"i18",txt:"Abonado de recuperación",                                      zona:"General", frec:12},
    {id:"i19",txt:"Limpieza profunda general",                                    zona:"General", frec:12},
    {id:"i20",txt:"Recoger manguera",                                             zona:"Cierre",  frec:1},
    {id:"i21",txt:"Recoger herramientas",                                         zona:"Cierre",  frec:1},
    {id:"i22",txt:"Dejar todo ordenado",                                          zona:"Cierre",  frec:1},
  ]
};
const JARDIN_CF = [
  {id:"cf1",txt:"No hay hojas visibles"},
  {id:"cf2",txt:"No hay malas hierbas visibles"},
  {id:"cf3",txt:"Césped uniforme"},
  {id:"cf4",txt:"Grava limpia y nivelada"},
  {id:"cf5",txt:"Camino limpio"},
  {id:"cf6",txt:"Porche limpio"},
  {id:"cf7",txt:"Piscina limpia"},
  {id:"cf8",txt:"No hay herramientas visibles"},
  {id:"cf9",txt:"Manguera recogida"},
];
const LIMP_T = [
  {id:"l1", txt:"Ventilar toda la casa (abrir ventanas)",         zona:"General"},
  {id:"l2", txt:"Revisar objetos olvidados",                      zona:"General"},
  {id:"l3", txt:"Retirar basura de toda la casa",                 zona:"General"},
  {id:"l4", txt:"Recoger ropa de cama y toallas usadas",          zona:"General"},
  {id:"l5", txt:"Revisar desperfectos (anotar si hay algo roto)", zona:"General"},
  {id:"l6", txt:"Hacer camas (sábanas limpias, bien estiradas)",  zona:"Habitaciones"},
  {id:"l7", txt:"Colocar cojines decorativos",                    zona:"Habitaciones"},
  {id:"l8", txt:"Dejar toallas por huésped",                      zona:"Habitaciones"},
  {id:"l9", txt:"Limpiar polvo (mesillas, cabecero, lámparas)",   zona:"Habitaciones"},
  {id:"l10",txt:"Revisar armario (limpio y ordenado)",            zona:"Habitaciones"},
  {id:"l11",txt:"Aspirar suelo y alfombras",                      zona:"Habitaciones"},
  {id:"l12",txt:"Fregar suelo habitaciones",                      zona:"Habitaciones"},
  {id:"l13",txt:"Revisar olor (sin olores)",                      zona:"Habitaciones"},
  {id:"l14",txt:"Limpiar y desinfectar WC completo",              zona:"Baños"},
  {id:"l15",txt:"Limpiar lavabo y grifo (sin marcas)",            zona:"Baños"},
  {id:"l16",txt:"Limpiar espejo (sin marcas)",                    zona:"Baños"},
  {id:"l17",txt:"Limpiar ducha/bañera (sin cal)",                 zona:"Baños"},
  {id:"l18",txt:"Vaciar papelera baños",                          zona:"Baños"},
  {id:"l19",txt:"Aspirar y fregar suelo baños",                   zona:"Baños"},
  {id:"l20",txt:"Colocar toallas limpias",                        zona:"Baños"},
  {id:"l21",txt:"Reponer papel higiénico (mín. 2 rollos)",        zona:"Baños"},
  {id:"l22",txt:"Reponer gel y champú",                           zona:"Baños"},
  {id:"l23",txt:"Limpiar encimera",                               zona:"Cocina"},
  {id:"l24",txt:"Limpiar vitro / fogones",                        zona:"Cocina"},
  {id:"l25",txt:"Limpiar fregadero y grifo",                      zona:"Cocina"},
  {id:"l26",txt:"Limpiar microondas",                             zona:"Cocina"},
  {id:"l27",txt:"Limpiar horno (si está sucio)",                  zona:"Cocina"},
  {id:"l28",txt:"Limpiar exterior electrodomésticos",             zona:"Cocina"},
  {id:"l29",txt:"Revisar y limpiar nevera (sin restos)",          zona:"Cocina"},
  {id:"l30",txt:"Revisar vajilla limpia y ordenada",              zona:"Cocina"},
  {id:"l31",txt:"Vaciar basura cocina",                           zona:"Cocina"},
  {id:"l32",txt:"Reponer café",                                   zona:"Cocina"},
  {id:"l33",txt:"Reponer bolsas de basura",                       zona:"Cocina"},
  {id:"l34",txt:"Barrer/aspirar suelo cocina",                    zona:"Cocina"},
  {id:"l35",txt:"Fregar suelo cocina",                            zona:"Cocina"},
  {id:"l36",txt:"Limpiar polvo (mesas, muebles, TV)",             zona:"Salón"},
  {id:"l37",txt:"Aspirar sofá",                                   zona:"Salón"},
  {id:"l38",txt:"Aspirar alfombras salón",                        zona:"Salón"},
  {id:"l39",txt:"Limpiar mesa comedor",                           zona:"Salón"},
  {id:"l40",txt:"Aspirar suelo salón",                            zona:"Salón"},
  {id:"l41",txt:"Fregar suelo salón",                             zona:"Salón"},
  {id:"l42",txt:"Barrer accesos y entrada",                       zona:"Exterior"},
  {id:"l43",txt:"Limpiar mobiliario exterior",                    zona:"Exterior"},
  {id:"l44",txt:"Retirar hojas visibles",                         zona:"Exterior"},
  {id:"l45",txt:"Limpiar porches",                                zona:"Exterior"},
  {id:"l46",txt:"Limpiar barbacoa",                               zona:"Exterior"},
  {id:"l47",txt:"Llevar sábanas y toallas a la lavandería",       zona:"Lavandería"},
  {id:"l48",txt:"Recoger sábanas de la lavandería",               zona:"Lavandería"},
  {id:"l49",txt:"Revisar sábanas antes de almacenar",             zona:"Lavandería"},
  {id:"l50",txt:"Almacenar sábanas en el almacén",                zona:"Lavandería"},
  {id:"l51",txt:"Papel higiénico en todos los baños",             zona:"Reposición"},
  {id:"l52",txt:"Toallas en habitaciones y baños",                zona:"Reposición"},
  {id:"l53",txt:"Gel y champú en baños",                          zona:"Reposición"},
  {id:"l54",txt:"Café en cocina",                                 zona:"Reposición"},
  {id:"l55",txt:"Bolsas de basura",                               zona:"Reposición"},
  {id:"l56",txt:"Sin pelos en suelos ni baños",                   zona:"Control final"},
  {id:"l57",txt:"Sin manchas en espejos ni grifos",               zona:"Control final"},
  {id:"l58",txt:"Camas perfectas (sin arrugas)",                  zona:"Control final"},
  {id:"l59",txt:"Cocina limpia y ordenada",                       zona:"Control final"},
  {id:"l60",txt:"Casa huele bien",                                zona:"Control final"},
  {id:"l61",txt:"Basura retirada",                                zona:"Control final"},
  {id:"l62",txt:"Luces funcionan",                                zona:"Control final"},
  {id:"l63",txt:"Puertas y ventanas cerradas",                    zona:"Control final"},
];
const ESTADOS = [
  {id:"visita",             lbl:"Visita realizada",   col:"#6366f1"},
  {id:"pendiente_contrato", lbl:"Pendiente de firma", col:"#f59e0b"},
  {id:"contrato_firmado",   lbl:"Contrato firmado",   col:"#3b82f6"},
  {id:"reserva_pagada",     lbl:"Señal pagada",       col:"#8b5cf6"},
  {id:"precio_total",       lbl:"Total pagado",       col:"#10b981"},
  {id:"finalizada",         lbl:"Finalizado",         col:"#6b7280"},
  {id:"cancelada",          lbl:"Cancelada",          col:"#e85555"},
];
const FREC_LBL = {1:"Cada semana",2:"Cada 2 semanas",4:"Cada mes",12:"Trimestral"};
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const D_SEM = ["L","M","X","J","V","S","D"];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function wkNum(d=new Date()){const j=new Date(d.getFullYear(),0,1);return Math.ceil(((d-j)/86400000+j.getDay()+1)/7);}
function wkKey(d){const dd=d||new Date();return `${dd.getFullYear()}-W${wkNum(dd)}`;}
function tocaSemana(t,wk){const w=parseInt(wk.split("-W")[1]);return (w-(t.ini||1))>=0&&(w-(t.ini||1))%t.frec===0;}
function fmtDT(ts){if(!ts)return "—";const d=new Date(ts);return `${d.toLocaleDateString("es-ES")} ${d.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}`;}
function semanaRango(semana){
  const [y,wS]=semana.split("-W");const w=parseInt(wS);
  const d1=new Date(parseInt(y),0,1+(w-1)*7);
  const d2=new Date(d1);d2.setDate(d2.getDate()+6);
  const f=d=>d.toLocaleDateString("es-ES",{day:"numeric",month:"short"});
  return `${f(d1)} – ${f(d2)}`;
}

// ─── PUSH ────────────────────────────────────────────────────────────────────
const VAPID_PUBLIC="BP-c4VnGEBjkN782qzYSnB8BbrSkKK9rXK5HC3MyxAtscKzh-Wcs4D5E9t8YJpWNnp92r_lZYvSlG-9oW5qSapQ";
let swReg=null;
let swReady=null;
async function regSW(){if(!("serviceWorker"in navigator))return;try{swReg=await navigator.serviceWorker.register("/sw.js");swReady=navigator.serviceWorker.ready;}catch(_){}}
async function askPerm(){if(!("Notification"in window))return "denied";if(Notification.permission==="granted")return "granted";return Notification.requestPermission();}
function sendPush(title,body,tag="molino"){
  if(swReg?.active)swReg.active.postMessage({type:"NOTIFY",title,body,tag});
  else if(Notification?.permission==="granted"){try{new Notification(title,{body,tag});}catch(_){}}
}
async function subscribePush(userId,tok){
  if(!("PushManager"in window))return;
  try{
    const reg=swReady?await swReady:swReg;
    if(!reg)return;
    let sub=await reg.pushManager.getSubscription();
    if(!sub){
      const key=Uint8Array.from(atob(VAPID_PUBLIC.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));
      sub=await swReg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
    }
    const {endpoint,keys}=sub.toJSON();
    await fetch(`${SB_URL}/rest/v1/push_subscriptions`,{
      method:"POST",headers:{...HDRA(tok),"Prefer":"resolution=merge-duplicates,return=minimal"},
      body:JSON.stringify({user_id:userId,endpoint,p256dh:keys.p256dh,auth:keys.auth})
    });
  }catch(_){}
}

// ─── LOGO ────────────────────────────────────────────────────────────────────
function MolinoLogo({size=22}){
  return <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{display:"inline-block",verticalAlign:"middle",flexShrink:0}}>
    <path d="M42 100 L58 100 L55 55 L45 55 Z" fill="#c9a84c" opacity=".9"/>
    <circle cx="50" cy="52" r="6" fill="#c9a84c"/>
    <path d="M50 46 C48 36 44 20 46 8 C47 4 53 4 54 8 C56 20 52 36 50 46Z" fill="#c9a84c"/>
    <path d="M56 52 C66 50 82 46 94 48 C98 49 98 55 94 56 C82 58 66 54 56 52Z" fill="#c9a84c" opacity=".85"/>
    <path d="M50 58 C52 68 56 84 54 96 C53 100 47 100 46 96 C44 84 48 68 50 58Z" fill="#c9a84c" opacity=".7"/>
    <path d="M44 52 C34 54 18 58 6 56 C2 55 2 49 6 48 C18 46 34 50 44 52Z" fill="#c9a84c" opacity=".55"/>
  </svg>;
}

// ─── CSS ─────────────────────────────────────────────────────────────────────
const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{height:100%}
body{font-family:'DM Sans',sans-serif;background:#0f1117;color:#e8e6e1;min-height:100vh;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#13161f}::-webkit-scrollbar-thumb{background:#c9a84c;border-radius:2px}
.app{display:flex;min-height:100vh;min-height:100dvh}
.main{flex:1;min-width:0;display:flex;flex-direction:column;overflow-x:hidden}
.sb{width:248px;min-width:248px;background:#13161f;border-right:1px solid rgba(201,168,76,.15);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;height:100dvh;overflow-y:auto;flex-shrink:0}
.sb-logo{padding:20px 18px 15px;border-bottom:1px solid rgba(201,168,76,.1)}
.sb-logo h1{font-family:'Playfair Display',serif;font-size:17px;color:#c9a84c;margin-top:2px}
.sb-logo p{font-size:10px;color:#5a5e6e;margin-top:2px;text-transform:uppercase;letter-spacing:1.5px}
.sb-nav{flex:1;padding:10px 8px;overflow-y:auto}
.nav-sec{font-size:10px;color:#3d4155;text-transform:uppercase;letter-spacing:2px;padding:10px 11px 5px;margin-top:4px}
.nw{position:relative}
.nb{display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:8px;cursor:pointer;font-size:13px;color:#7a7f94;transition:all .15s;border:none;background:none;width:100%;text-align:left;font-family:'DM Sans',sans-serif;margin-bottom:2px}
.nb:hover{background:rgba(201,168,76,.06);color:#c9c5b8}
.nb.on{background:rgba(201,168,76,.12);color:#c9a84c;font-weight:500}
.nb-ico{font-size:15px;width:20px;text-align:center;flex-shrink:0}
.nb-badge{position:absolute;top:6px;right:8px;background:#e85555;color:#fff;border-radius:20px;padding:1px 6px;font-size:10px;font-weight:700;min-width:16px;text-align:center;pointer-events:none}
.sb-user{padding:13px 14px;border-top:1px solid rgba(201,168,76,.1);display:flex;align-items:center;gap:10px;flex-shrink:0}
.av{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#c9a84c,#8b6914);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0}
.uname{font-size:12px;font-weight:500;color:#c9c5b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.urole{font-size:10px;color:#5a5e6e;text-transform:capitalize;margin-top:1px}
.logout-btn{background:none;border:none;cursor:pointer;color:#5a5e6e;font-size:16px;padding:4px;transition:color .2s;flex-shrink:0;line-height:1}
.logout-btn:hover{color:#e85555}
.mob-top{display:none;position:sticky;top:0;z-index:150;background:#13161f;border-bottom:1px solid rgba(201,168,76,.12);padding:0 16px;height:52px;align-items:center;justify-content:space-between}
.mob-top-title{font-family:'Playfair Display',serif;font-size:15px;color:#c9a84c}
.mob-menu-btn{background:none;border:none;color:#c9c5b8;font-size:24px;cursor:pointer;padding:6px;display:flex;align-items:center;justify-content:center;border-radius:8px;line-height:1}
.drawer-overlay{position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:300;backdrop-filter:blur(2px)}
.drawer{position:fixed;left:0;top:0;bottom:0;width:min(280px,85vw);background:#13161f;z-index:400;display:flex;flex-direction:column;overflow-y:auto;transform:translateX(-100%);transition:transform .24s cubic-bezier(.4,0,.2,1);box-shadow:6px 0 32px rgba(0,0,0,.5)}
.drawer.open{transform:translateX(0)}
.mob-bar{display:none;position:fixed;bottom:0;left:0;right:0;z-index:200;background:#13161f;border-top:1px solid rgba(201,168,76,.15);padding:6px 8px;padding-bottom:max(6px,env(safe-area-inset-bottom))}
.mob-bar-inner{display:flex;justify-content:space-around;align-items:center}
.mob-btn{display:flex;flex-direction:column;align-items:center;gap:3px;padding:5px 8px;border:none;background:none;cursor:pointer;color:#5a5e6e;font-size:10px;font-family:'DM Sans',sans-serif;border-radius:10px;transition:color .15s;min-width:48px;position:relative;-webkit-tap-highlight-color:transparent}
.mob-btn.on{color:#c9a84c}
.mob-btn.on .mico{transform:scale(1.1)}
.mico{font-size:22px;line-height:1;transition:transform .15s;display:inline-block;position:relative}
.ph{padding:26px 32px 20px;border-bottom:1px solid rgba(255,255,255,.05);flex-shrink:0}
.ph h2{font-family:'Playfair Display',serif;font-size:24px;color:#e8e6e1;font-weight:400}
.ph p{color:#5a5e6e;font-size:13px;margin-top:4px}
.pb{padding:24px 32px}
.card{background:#13161f;border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:20px}
.cal-card{background:#13161f;border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:16px}
.chdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;gap:8px}
.ctit{font-size:14px;font-weight:600;color:#c9c5b8}
.btn{padding:8px 16px;border-radius:8px;border:none;cursor:pointer;font-size:13px;font-weight:500;font-family:'DM Sans',sans-serif;transition:all .15s;display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.bp{background:#c9a84c;color:#0f1117}.bp:hover{background:#dbb95e}
.bg{background:rgba(255,255,255,.06);color:#c9c5b8;border:1px solid rgba(255,255,255,.1)}.bg:hover{background:rgba(255,255,255,.1)}
.br{background:rgba(232,85,85,.12);color:#e85555;border:1px solid rgba(232,85,85,.2)}.br:hover{background:rgba(232,85,85,.2)}
.sm{padding:6px 12px;font-size:12px}
.fg{margin-bottom:14px}
.fg label{display:block;font-size:10px;color:#7a7f94;margin-bottom:6px;text-transform:uppercase;letter-spacing:.8px}
.fi{width:100%;padding:10px 13px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:#0f1117;color:#e8e6e1;font-size:14px;font-family:'DM Sans',sans-serif;outline:none;transition:border-color .2s;-webkit-appearance:none;appearance:none}
.fi:focus{border-color:rgba(201,168,76,.5)}
.fi::placeholder{color:#3d4155}
textarea.fi{resize:vertical;min-height:72px;line-height:1.5}
select.fi{cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%235a5e6e' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:36px}
.mft{display:flex;gap:8px;justify-content:flex-end;margin-top:18px;padding-top:16px;border-top:1px solid rgba(255,255,255,.06)}
.ov{position:fixed;inset:0;background:rgba(0,0,0,.78);backdrop-filter:blur(4px);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px}
.modal{background:#13161f;border:1px solid rgba(201,168,76,.2);border-radius:14px;padding:28px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto}
.modal h3{font-family:'Playfair Display',serif;font-size:20px;color:#e8e6e1;margin-bottom:20px}
.cli{display:flex;align-items:flex-start;gap:10px;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,.05);background:#0f1117;margin-bottom:6px}
.cli.done{opacity:.6;background:rgba(16,185,129,.04);border-color:rgba(16,185,129,.12)}
.chk{width:22px;height:22px;border-radius:6px;flex-shrink:0;border:2px solid rgba(255,255,255,.15);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;margin-top:1px}
.chk.on{background:#10b981;border-color:#10b981}
.chk.on::after{content:"✓";color:#fff;font-size:12px;font-weight:700}
.tz{display:inline-block;font-size:10px;padding:2px 7px;border-radius:20px;background:rgba(201,168,76,.1);color:#c9a84c;margin-bottom:3px}
.tl{font-size:13px;color:#c9c5b8;line-height:1.4}
.tl.done{text-decoration:line-through;color:#5a5e6e}
.tm{font-size:11px;color:#5a5e6e;margin-top:2px;line-height:1.4}
.nbox{background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.15);border-radius:7px;padding:8px 11px;margin-top:6px;font-size:12px;color:#d4a843;line-height:1.4}
.rbox{background:rgba(16,185,129,.06);border:1px solid rgba(16,185,129,.18);border-radius:7px;padding:8px 11px;margin-top:6px;font-size:12px;color:#10b981;line-height:1.4}
.ibtn{display:inline-flex;align-items:center;gap:4px;background:rgba(245,158,11,.1);color:#f59e0b;border:1px solid rgba(245,158,11,.2);border-radius:20px;padding:4px 9px;font-size:11px;cursor:pointer;white-space:nowrap;transition:background .15s;flex-shrink:0;font-family:'DM Sans',sans-serif}
.ibtn:hover{background:rgba(245,158,11,.18)}
.pbtn{display:flex;align-items:center;justify-content:center;gap:7px;padding:11px 16px;border-radius:8px;cursor:pointer;background:rgba(201,168,76,.07);color:#c9a84c;border:1px dashed rgba(201,168,76,.3);font-size:14px;font-family:'DM Sans',sans-serif;font-weight:500;transition:background .2s;width:100%}
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
.alert{padding:10px 13px;border-radius:8px;font-size:13px;margin-bottom:14px;background:rgba(232,85,85,.1);color:#e85555;border:1px solid rgba(232,85,85,.2)}
.tabs{display:flex;gap:3px;background:#0f1117;padding:3px;border-radius:9px;margin-bottom:18px}
.tab{padding:8px 14px;border-radius:7px;cursor:pointer;font-size:12px;color:#7a7f94;transition:all .15s;border:none;background:none;font-family:'DM Sans',sans-serif;font-weight:500;white-space:nowrap}
.tab.on{background:#13161f;color:#c9a84c;border:1px solid rgba(201,168,76,.2)}
.cg{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-top:10px}
.ch{text-align:center;font-size:10px;color:#5a5e6e;padding:5px 0;text-transform:uppercase;letter-spacing:.5px}
.cd{aspect-ratio:1;border-radius:7px;border:1px solid rgba(255,255,255,.04);display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:12px;cursor:pointer;transition:all .15s;background:#0f1117}
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
.cu{display:flex;align-items:center;gap:9px;padding:12px 14px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.04);transition:background .12s;position:relative}
.cu:hover{background:rgba(255,255,255,.03)}
.cu.on{background:rgba(201,168,76,.08)}
.msgs{flex:1;overflow-y:auto;padding:14px 18px;display:flex;flex-direction:column;gap:8px}
.bub{max-width:72%;padding:10px 14px;border-radius:14px;font-size:13px;line-height:1.5;word-break:break-word}
.bub.me{align-self:flex-end;background:#c9a84c;color:#0f1117;border-bottom-right-radius:3px}
.bub.them{align-self:flex-start;background:#1e2130;border:1px solid rgba(255,255,255,.08);color:#c9c5b8;border-bottom-left-radius:3px}
.bmeta{font-size:10px;opacity:.5;margin-top:4px}
.nitem{display:flex;gap:10px;padding:13px 16px;border-bottom:1px solid rgba(255,255,255,.05)}
.nitem.unread{background:rgba(201,168,76,.04);border-left:2px solid #c9a84c}
.ndot{width:7px;height:7px;border-radius:50%;background:#c9a84c;flex-shrink:0;margin-top:5px}
.ndot.read{background:#3d4155}
.pbanner{background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.25);border-radius:9px;padding:11px 16px;margin:12px 32px 0;display:flex;align-items:center;justify-content:space-between;gap:10px}
.pbanner span{font-size:13px;color:#a5b4fc}
.lw{min-height:100vh;min-height:100dvh;display:flex;align-items:center;justify-content:center;background:#0f1117;position:relative;overflow:hidden;padding:16px}
.lbg{position:absolute;inset:0;opacity:.025;background-image:repeating-linear-gradient(0deg,transparent,transparent 40px,rgba(201,168,76,1) 40px,rgba(201,168,76,1) 41px),repeating-linear-gradient(90deg,transparent,transparent 40px,rgba(201,168,76,1) 40px,rgba(201,168,76,1) 41px)}
.lc{background:#13161f;border:1px solid rgba(201,168,76,.2);border-radius:18px;padding:40px 34px;width:100%;max-width:380px;position:relative}
.llo{text-align:center;margin-bottom:28px}
.llo h1{font-family:'Playfair Display',serif;font-size:26px;color:#c9a84c}
.llo p{font-size:10px;color:#5a5e6e;margin-top:6px;text-transform:uppercase;letter-spacing:2px}
.rc{background:#0f1117;border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:15px 17px;margin-bottom:8px;cursor:pointer;transition:all .15s;border-left:3px solid transparent}
.rc:hover{background:rgba(201,168,76,.03)}
.spin{display:inline-block;width:18px;height:18px;border:2px solid rgba(201,168,76,.2);border-top-color:#c9a84c;border-radius:50%;animation:spin .6s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.loading{display:flex;align-items:center;justify-content:center;min-height:200px;color:#5a5e6e;gap:10px;font-size:14px}
.drawer-user-card{padding:20px 16px 16px;border-bottom:1px solid rgba(201,168,76,.12);display:flex;align-items:center;gap:12px;background:linear-gradient(135deg,rgba(201,168,76,.08),rgba(201,168,76,.02));flex-shrink:0}
.drawer-close{background:none;border:none;color:#5a5e6e;font-size:20px;cursor:pointer;padding:4px;margin-left:auto;border-radius:6px;line-height:1;flex-shrink:0}
.drawer-close:hover{color:#c9c5b8;background:rgba(255,255,255,.05)}
.chat-list-col{width:220px;flex-shrink:0;border-right:1px solid rgba(255,255,255,.06);overflow-y:auto;display:flex;flex-direction:column}
.chat-area{flex:1;display:flex;flex-direction:column;min-width:0;min-height:0}
.chdr2{padding:12px 18px;border-bottom:1px solid rgba(255,255,255,.06);display:flex;align-items:center;gap:10px;flex-shrink:0}
@media (min-width:769px){
  .mob-top,.mob-bar,.drawer,.drawer-overlay,.mob-back{display:none!important}
  .chat-mobile-wrap{display:none!important}
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
  .chat-list-col{display:none}
  .chat-area{display:flex;flex-direction:column;height:calc(100dvh - 52px - 64px);overflow:hidden;position:relative}
  .msgs{padding:12px 14px;padding-bottom:80px}
  .bub{max-width:85%;font-size:14px}
  .chat-inp-wrap{position:absolute;bottom:0;left:0;right:0;background:#13161f;border-top:1px solid rgba(255,255,255,.1);padding:10px 12px;padding-bottom:max(10px,env(safe-area-inset-bottom));z-index:10}
  .cal-card{padding:12px 10px!important;border-radius:10px!important}
  .cg{gap:2px;margin-top:8px}
  .cd{aspect-ratio:unset!important;height:36px;border-radius:5px;font-size:11px;min-width:0}
  .cdot{width:4px;height:4px;margin-top:1px}
  .ch{font-size:9px;padding:3px 0;letter-spacing:0}.cmon{font-size:15px}.cnav{margin-bottom:8px}
  .pbanner{margin:10px 16px 0;padding:10px 12px}.pbanner span{font-size:12px}
  .lc{padding:32px 24px}
  .chat-desktop-only{display:none!important}
  .chat-mobile-wrap{display:flex;flex-direction:column;height:calc(100dvh - 52px - 64px);overflow:hidden}
}
@media (max-width:400px){.sg{grid-template-columns:1fr 1fr}.sv{font-size:18px}.ph h2{font-size:18px}.mob-btn{min-width:44px;font-size:9px}.mico{font-size:20px}}
`;


// ─── AUTO RECURRENTES ────────────────────────────────────────────────────────
async function autoRecurrentes(tok,setToast){
  const hoy=new Date();
  const y=hoy.getFullYear(),m=String(hoy.getMonth()+1).padStart(2,"0");
  const lsKey=`fm_recurrentes_${y}_${m}`;
  if(localStorage.getItem(lsKey))return;
  try{
    const recurrentes=await sbGet("gastos","?recurrente=eq.true&frecuencia=eq.mensual&select=*",tok);
    if(recurrentes.length===0){localStorage.setItem(lsKey,"1");return;}
    const primerDia=`${y}-${m}-01`;
    const yaExisten=await sbGet("gastos",`?fecha=eq.${primerDia}&origen=eq.auto_recurrente&select=concepto`,tok).catch(()=>[]);
    const existentes=new Set(yaExisten.map(g=>g.concepto));
    let insertados=0;
    for(const g of recurrentes){
      if(existentes.has(g.concepto))continue;
      await sbPost("gastos",{fecha:primerDia,categoria:g.categoria,concepto:g.concepto,importe:g.importe,recurrente:false,origen:"auto_recurrente",notas:`Auto-generado desde gasto recurrente`},tok).catch(()=>{});
      insertados++;
    }
    localStorage.setItem(lsKey,"1");
    if(insertados>0){
      const mesNombre=MESES[hoy.getMonth()];
      setToast(`✅ Se han registrado ${insertados} gasto${insertados>1?"s":""} recurrente${insertados>1?"s":""} de ${mesNombre}`);
      setTimeout(()=>setToast(null),5000);
    }
  }catch(_){}
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [session,    setSession]    = useState(null);
  const [perfil,     setPerfil]     = useState(null);
  const [page,       setPage]       = useState("dashboard");
  const [perm,       setPerm]       = useState(typeof Notification!=="undefined"?Notification.permission:"default");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [authLoad,   setAuthLoad]   = useState(true);
  const [toast,      setToast]      = useState(null);

  useEffect(()=>{
    regSW();
    const saved=localStorage.getItem("fm_session");
    if(saved){
      try{
        const s=JSON.parse(saved);
        setSession(s);
        sbGet("usuarios",`?id=eq.${s.user.id}&select=*`,s.access_token)
          .then(rows=>{
            if(rows[0]){
              setPerfil(rows[0]);
              subscribePush(s.user.id,s.access_token);
              if(rows[0].rol==="admin")autoRecurrentes(s.access_token,setToast);
            }
          })
          .catch(()=>{});
      }catch(_){localStorage.removeItem("fm_session");}
    }
    setAuthLoad(false);
  },[]);

  const login=async(email,pass)=>{
    const d=await authLogin(email,pass);
    localStorage.setItem("fm_session",JSON.stringify(d));
    setSession(d);
    const rows=await sbGet("usuarios",`?id=eq.${d.user.id}&select=*`,d.access_token);
    if(rows[0])setPerfil(rows[0]);
    setPage("dashboard");
    askPerm().then(p=>{setPerm(p);if(p==="granted")subscribePush(d.user.id,d.access_token);});
  };

  const logout=async()=>{
    if(session)await authLogout(session.access_token).catch(()=>{});
    localStorage.removeItem("fm_session");
    setSession(null);setPerfil(null);setPage("dashboard");setDrawerOpen(false);
  };

  if(authLoad)return <><style>{CSS}</style><div className="loading"><div className="spin"/><span>Cargando…</span></div></>;
  if(!session||!perfil)return <><style>{CSS}</style><LoginScreen onLogin={login}/></>;

  const tok=session.access_token;
  const rol=perfil.rol;
  const P={perfil,tok,setPage,rol};
  const goTo=id=>{setPage(id);setDrawerOpen(false);};

  const PAGES={
    dashboard:   <Dashboard   {...P}/>,
    jcheck:      <JardinCheck {...P}/>,
    jadmin:      <JardinAdmin {...P}/>,
    incidencias: <Incidencias {...P}/>,
    limpieza:    <Limpieza    {...P}/>,
    "cal-limp":  <CalLimpieza {...P}/>,
    "cal-jardin": <CalJardin    {...P}/>,
    calendario:  <Calendario  {...P} rol={rol}/>,
    reservas:    <Reservas    {...P} perfil={perfil}/>,
    "nueva-res": <NuevaReserva {...P}/>,
    visitas:     <Visitas     {...P}/>,
    airbnb:      <ReservasAirbnb {...P}/>,
    chat:        <Chat        {...P}/>,
    notifs:      <Notifs      {...P}/>,
    usuarios:    <Usuarios    {...P}/>,
    gastos:      <Gastos      {...P}/>,
    jardineros:  <Jardineros  {...P}/>,
  };

  return <>
    <style>{CSS}</style>
    <div className="app">
      <Sidebar perfil={perfil} page={page} setPage={setPage} onLogout={logout}/>
      <div className="mob-top">
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <MolinoLogo size={22}/>
          <span className="mob-top-title">Finca El Molino</span>
        </div>
        <button className="mob-menu-btn" onClick={()=>setDrawerOpen(true)}>☰</button>
      </div>
      {drawerOpen&&<div className="drawer-overlay" onClick={()=>setDrawerOpen(false)}/>}
      <div className={`drawer${drawerOpen?" open":""}`}>
        <Sidebar perfil={perfil} page={page} setPage={goTo} onLogout={logout} inDrawer onClose={()=>setDrawerOpen(false)}/>
      </div>
      <div className="main">
        {perm==="default"&&(
          <div className="pbanner">
            <span>🔔 Activa las notificaciones para recibir avisos</span>
            <button className="btn bp sm" onClick={()=>askPerm().then(setPerm)}>Activar</button>
          </div>
        )}
        {PAGES[page]??<Dashboard {...P}/>}
      </div>
      <MobileNav perfil={perfil} page={page} setPage={setPage} tok={tok}/>
      {toast&&<div style={{position:"fixed",bottom:80,left:"50%",transform:"translateX(-50%)",background:"#13161f",border:"1px solid rgba(16,185,129,.3)",borderRadius:12,padding:"12px 20px",color:"#10b981",fontSize:13,fontWeight:500,zIndex:9999,boxShadow:"0 8px 32px rgba(0,0,0,.5)",whiteSpace:"nowrap",maxWidth:"90vw"}} onClick={()=>setToast(null)}>{toast}</div>}
    </div>
  </>;
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginScreen({onLogin}){
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [err,setErr]=useState("");
  const [load,setLoad]=useState(false);
  const go=async()=>{
    if(!email||!pass){setErr("Introduce email y contraseña");return;}
    setLoad(true);setErr("");
    try{await onLogin(email,pass);}
    catch(e){setErr(e.message||"Credenciales incorrectas");}
    finally{setLoad(false);}
  };
  return <div className="lw"><div className="lbg"/>
    <div className="lc">
      <div className="llo">
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,marginBottom:8}}>
          <MolinoLogo size={42}/><h1>Finca El Molino</h1>
        </div>
        <p>Sistema de Gestión</p>
      </div>
      {err&&<div className="alert">{err}</div>}
      <div className="fg"><label>Correo electrónico</label>
        <input className="fi" type="email" inputMode="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@email.com"/>
      </div>
      <div className="fg"><label>Contraseña</label>
        <input className="fi" type="password" autoComplete="current-password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} placeholder="••••••••"/>
      </div>
      <button className="btn bp" style={{width:"100%",justifyContent:"center",marginTop:4}} onClick={go} disabled={load}>
        {load?<><div className="spin" style={{width:16,height:16,borderWidth:2}}/> Entrando…</>:"Entrar →"}
      </button>
      <p style={{fontSize:11,color:"#5a5e6e",textAlign:"center",marginTop:16,lineHeight:1.5}}>
        Usa las credenciales que te ha facilitado el administrador de la finca.
      </p>
    </div>
  </div>;
}

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────
function Sidebar({perfil,page,setPage,onLogout,inDrawer,onClose}){
  const rol=perfil.rol;
  const isA=rol==="admin",isJ=rol==="jardinero",isL=rol==="limpieza",isC=rol==="comercial";
  const RL={admin:"Administrador",jardinero:"Jardinero",limpieza:"Limpieza",comercial:"Comercial"};
  const av=perfil.avatar||perfil.nombre.slice(0,2).toUpperCase();
  const N=({ico,lbl,id,badge})=>(
    <div className="nw">
      <button className={`nb${page===id?" on":""}`} onClick={()=>setPage(id)}>
        <span className="nb-ico">{ico}</span>{lbl}
      </button>
      {badge>0&&<span className="nb-badge">{badge>9?"9+":badge}</span>}
    </div>
  );
  return <aside className="sb">
    {inDrawer?(
      <div className="drawer-user-card">
        <div className="av" style={{width:42,height:42,fontSize:14}}>{av}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14,fontWeight:600,color:"#e8e6e1",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{perfil.nombre}</div>
          <div style={{fontSize:11,color:"#c9a84c",marginTop:2}}>{RL[rol]}</div>
        </div>
        <button className="drawer-close" onClick={onClose}>✕</button>
      </div>
    ):(
      <div className="sb-logo">
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <MolinoLogo size={26}/>
          <div><h1>Finca El Molino</h1><p>Gestión de la finca</p></div>
        </div>
      </div>
    )}
    <nav className="sb-nav">
      <N ico="📊" lbl="Panel principal" id="dashboard"/>
      {(isA||isJ)&&<><p className="nav-sec">Jardín</p>
        <N ico="✅" lbl={isA?"Checklist jardín":"Mi checklist"} id="jcheck"/>
        {isA&&<N ico="🌿" lbl="Gestión jardín" id="jadmin"/>}
        {isA&&<N ico="⚠️" lbl="Incidencias" id="incidencias"/>}
        {isJ&&<N ico="📅" lbl="Calendario" id="cal-jardin"/>}
      </>}
      {(isA||isL)&&<><p className="nav-sec">Limpieza</p>
        <N ico="🧹" lbl={isA?"Gestión limpieza":"Mi servicio"} id="limpieza"/>
        {isL&&<N ico="📅" lbl="Calendario" id="cal-limp"/>}
      </>}
      {(isA||isC)&&<><p className="nav-sec">Reservas</p>
        <N ico="📅" lbl="Calendario" id="calendario"/>
        <N ico="📋" lbl="Reservas" id="reservas"/>
        {isA&&<N ico="➕" lbl="Nueva reserva" id="nueva-res"/>}
        <N ico="👁" lbl="Visitas" id="visitas"/>
        {isA&&<N ico="🏠" lbl="Airbnb" id="airbnb"/>}
      </>}
      <p className="nav-sec">Comunicación</p>
      <N ico="💬" lbl={isA?"Chat con equipo":"Chat con admin"} id="chat"/>
      <N ico="🔔" lbl="Notificaciones" id="notifs"/>
      {isA&&<><p className="nav-sec">Admin</p><N ico="💸" lbl="Gastos" id="gastos"/><N ico="🌿" lbl="Jardineros" id="jardineros"/><N ico="👥" lbl="Usuarios" id="usuarios"/></>}
    </nav>
    {!inDrawer&&(
      <div className="sb-user">
        <div className="av">{av}</div>
        <div style={{flex:1,minWidth:0}}>
          <div className="uname">{perfil.nombre}</div>
          <div className="urole">{RL[rol]}</div>
        </div>
        <button className="logout-btn" onClick={onLogout} title="Cerrar sesión">⏻</button>
      </div>
    )}
    {inDrawer&&(
      <div style={{padding:"12px 14px",borderTop:"1px solid rgba(201,168,76,.1)",marginTop:"auto"}}>
        <button className="btn br" style={{width:"100%",justifyContent:"center"}} onClick={onLogout}>⏻ Cerrar sesión</button>
      </div>
    )}
  </aside>;
}

// ─── MOBILE NAV ──────────────────────────────────────────────────────────────
function MobileNav({perfil,page,setPage,tok}){
  const rol=perfil.rol;
  const isA=rol==="admin",isJ=rol==="jardinero",isL=rol==="limpieza";
  const myId=isA?"admin":String(perfil.id);
  const [chatBadge,setChatBadge]=useState(0);

  useEffect(()=>{
    if(!tok)return;
    const check=async()=>{
      try{
        const r=await sbGet("mensajes",`?para=eq.${myId}&leido=eq.false&select=id`,tok);
        setChatBadge(r.length);
      }catch(_){}
    };
    check();
    const t=setInterval(check,20000);
    return()=>clearInterval(t);
  },[page,tok]);

  const items=[{ico:"📊",lbl:"Inicio",id:"dashboard"}];
  if(isA||isJ)items.push({ico:"✅",lbl:isA?"Jardín":"Checklist",id:isA?"jadmin":"jcheck"});
  if(isJ)items.push({ico:"📅",lbl:"Calendario",id:"cal-jardin"});
  if(isA)items.push({ico:"⚠️",lbl:"Incidencias",id:"incidencias"});
  if(isA||isL)items.push({ico:"🧹",lbl:"Limpieza",id:"limpieza"});
  if(!isA&&!isJ&&!isL)items.push({ico:"📅",lbl:"Calendario",id:"calendario"});
  if(!isA&&!isJ&&!isL)items.push({ico:"📋",lbl:"Reservas",id:"reservas"});
  if(!isA&&!isJ&&!isL)items.push({ico:"👁",lbl:"Visitas",id:"visitas"});
  items.push({ico:"💬",lbl:"Chat",id:"chat",badge:chatBadge});
  items.push({ico:"🔔",lbl:"Avisos",id:"notifs"});
  const shown=items.slice(0,5);

  return <nav className="mob-bar">
    <div className="mob-bar-inner">
      {shown.map(it=>(
        <button key={it.id} className={`mob-btn${page===it.id?" on":""}`} onClick={()=>setPage(it.id)}>
          <span className="mico">
            {it.ico}
            {(it.badge||0)>0&&(
              <span style={{position:"absolute",top:-4,right:-8,background:"#e85555",color:"#fff",borderRadius:20,padding:"1px 5px",fontSize:9,fontWeight:700,minWidth:14,textAlign:"center",lineHeight:"14px"}}>
                {it.badge>9?"9+":it.badge}
              </span>
            )}
          </span>
          <span>{it.lbl}</span>
        </button>
      ))}
    </div>
  </nav>;
}

// ─── SHARED COMPONENTS ───────────────────────────────────────────────────────
function SC({lbl,val,sub,prog,valC,onClick}){
  return <div className="sc" style={onClick?{cursor:"pointer"}:{}} onClick={onClick}>
    <div className="sl">{lbl}</div>
    <div className="sv" style={valC?{color:valC}:{}}>{val}</div>
    {sub&&<div className="ss">{sub}</div>}
    {prog!==undefined&&<div className="prog"><div className="pfill" style={{width:`${Math.min(prog,1)*100}%`}}/></div>}
  </div>;
}
function SBadge({e}){
  const est=ESTADOS.find(s=>s.id===e);
  if(!est)return null;
  return <span className="badge" style={{background:`${est.col}18`,color:est.col,border:`1px solid ${est.col}30`,display:"inline-block"}}>{est.lbl}</span>;
}
function MTask({lbl,sub,done}){
  return <div style={{display:"flex",alignItems:"center",gap:9,padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
    <span style={{fontSize:16,flexShrink:0}}>{done?"✅":"⬜"}</span>
    <div style={{flex:1,minWidth:0}}>
      <div style={{fontSize:13,color:done?"#5a5e6e":"#c9c5b8",textDecoration:done?"line-through":"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lbl}</div>
      {sub&&<div style={{fontSize:11,color:"#5a5e6e"}}>{sub}</div>}
    </div>
  </div>;
}
function NotaModal({nota,setNota,foto,setFoto,onSave,onClose,tok}){
  const [uploading,setUploading]=useState(false);
  const handleFoto=async e=>{
    const f=e.target.files[0];if(!f)return;
    setUploading(true);
    try{const url=await uploadFoto(f,tok);setFoto(url);}
    catch(_){const r=new FileReader();r.onload=ev=>setFoto(ev.target.result);r.readAsDataURL(f);}
    finally{setUploading(false);}
  };
  return <div className="ov" onClick={onClose}>
    <div className="modal" onClick={e=>e.stopPropagation()}>
      <h3>📝 Nota / Incidencia</h3>
      <div className="fg"><label>Descripción</label>
        <textarea className="fi" rows={4} value={nota} onChange={e=>setNota(e.target.value)} placeholder="Describe el problema o incidencia…"/>
      </div>
      <div className="fg">
        <label>Foto (opcional)</label>
        <label className="pbtn">
          {uploading?"⏳ Subiendo…":`📷 ${foto?"Cambiar foto":"Hacer foto o subir imagen"}`}
          <input type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={handleFoto}/>
        </label>
        {foto&&<>
          <img src={foto} alt="preview" className="pprev"/>
          <button className="btn br sm" style={{marginTop:8}} onClick={()=>setFoto(null)}>🗑 Quitar foto</button>
        </>}
      </div>
      <div className="mft">
        <button className="btn bg" onClick={onClose}>Cancelar</button>
        <button className="btn bp" onClick={onSave} disabled={uploading}>Guardar</button>
      </div>
    </div>
  </div>;
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
function Dashboard({perfil,tok,setPage,rol}){
  const [reservas,setReservas]=useState([]);
  const [jsem,setJsem]=useState([]);
  const [jpunt,setJpunt]=useState([]);
  const [load,setLoad]=useState(true);
  const cwk=wkKey();
  useEffect(()=>{
    (async()=>{
      try{
        const [r,js,jp]=await Promise.all([
          sbGet("reservas","?select=*&order=fecha.asc",tok),
          sbGet("jardin_semana",`?semana=eq.${cwk}&select=*`,tok),
          sbGet("jardin_puntual",`?semana=eq.${cwk}&select=*`,tok),
        ]);
        setReservas(r);setJsem(js);setJpunt(jp);
      }catch(_){}
      setLoad(false);
    })();
  },[]);
  if(load)return <div className="loading"><div className="spin"/><span>Cargando…</span></div>;
  if(rol==="jardinero")return <DashJ perfil={perfil} jsem={jsem} jpunt={jpunt} cwk={cwk} setPage={setPage} tok={tok}/>;
  if(rol==="limpieza") return <DashL perfil={perfil} setPage={setPage}/>;
  if(rol==="comercial")return <DashC perfil={perfil} reservas={reservas} setPage={setPage}/>;
  return <DashA reservas={reservas} jsem={jsem} jpunt={jpunt} cwk={cwk} setPage={setPage} tok={tok}/>;
}
// ─── FINANCIAL KPIs ─────────────────────────────────────────────────────────
function FinancialKPIs({tok}){
  const hoy=new Date();
  const hoyStr=hoy.toISOString().split("T")[0];
  const añoActual=hoy.getFullYear();
  const [periodo,setPeriodo]=useState("año");
  const [rangoDesde,setRangoDesde]=useState(hoyStr);
  const [rangoHasta,setRangoHasta]=useState(hoyStr);
  const [data,setData]=useState(null);
  const [load,setLoad]=useState(true);

  const getRango=()=>{
    if(periodo==="año") return {desde:`${añoActual}-01-01`,hasta:`${añoActual}-12-31`};
    if(periodo==="mes"){
      const m=String(hoy.getMonth()+1).padStart(2,"0");
      const lastDay=new Date(añoActual,hoy.getMonth()+1,0).getDate();
      return {desde:`${añoActual}-${m}-01`,hasta:`${añoActual}-${m}-${String(lastDay).padStart(2,"0")}`};
    }
    if(periodo==="semana"){
      const d=new Date(hoy);const day=d.getDay();const diff=d.getDate()-day+(day===0?-6:1);
      const lunes=new Date(d.setDate(diff));const domingo=new Date(lunes);domingo.setDate(lunes.getDate()+6);
      return {desde:lunes.toISOString().split("T")[0],hasta:domingo.toISOString().split("T")[0]};
    }
    return {desde:rangoDesde,hasta:rangoHasta};
  };

  const cargar=async()=>{
    setLoad(true);
    try{
      const {desde,hasta}=getRango();
      const [reservas,airbnbs,gastos,configRows]=await Promise.all([
        sbGet("reservas",`?fecha=gte.${desde}&fecha=lte.${hasta}&select=*`,tok),
        sbGet("reservas_airbnb",`?fecha_entrada=gte.${desde}&fecha_entrada=lte.${hasta}&select=*`,tok),
        sbGet("gastos",`?fecha=gte.${desde}&fecha=lte.${hasta}&select=*`,tok).catch(()=>[]),
        sbGet("configuracion","?select=*",tok).catch(()=>[]),
      ]);
      const cfg={};configRows.forEach(c=>cfg[c.clave]=c.valor);
      const comisionPct=parseFloat(cfg.comision_pct)||10;

      // Facturación proyectada
      const factEventos=reservas.reduce((s,r)=>s+(parseFloat(r.precio_total)||parseFloat(r.precio)||0),0);
      const factAirbnb=airbnbs.reduce((s,a)=>s+(parseFloat(a.precio)||0),0);
      const facturacion=factEventos+factAirbnb;

      // Ya cobrado
      let cobradoEventos=0;
      for(const r of reservas){
        const seña=parseFloat(r.seña_importe)||0;
        const precioTotal=parseFloat(r.precio_total)||parseFloat(r.precio)||0;
        if(r.seña_cobrada)cobradoEventos+=seña;
        if(r.saldo_cobrado)cobradoEventos+=(precioTotal-seña);
      }
      const cobradoAirbnb=airbnbs.filter(a=>a.cobrado||a.fecha_entrada<hoyStr).reduce((s,a)=>s+(parseFloat(a.precio)||0),0);
      const yaCobrado=cobradoEventos+cobradoAirbnb;

      // Pendiente de cobro
      const pendiente=facturacion-yaCobrado;

      // Gastos reales
      const gastosReales=gastos.reduce((s,g)=>s+(parseFloat(g.importe)||0),0);

      // Gastos proyectados año
      let gastosProyectados=gastosReales;
      if(periodo==="año"){
        const mesActual=hoy.getMonth()+1;
        const mesesRestantes=12-mesActual;
        const gastosRecurrentes=gastos.filter(g=>g.recurrente);
        if(gastosRecurrentes.length>0&&mesActual>0){
          const mediaRecurrente=gastosRecurrentes.reduce((s,g)=>s+(parseFloat(g.importe)||0),0)/mesActual;
          gastosProyectados=gastosReales+(mediaRecurrente*mesesRestantes);
        }
      }

      // Beneficio estimado
      const beneficio=yaCobrado-gastosReales;

      // Comisión gestor
      const comision=facturacion*(comisionPct/100);

      setData({facturacion,yaCobrado,pendiente,gastosReales,gastosProyectados,beneficio,comision,comisionPct,desde,hasta});
    }catch(e){console.error("KPI error:",e);setData(null);}
    setLoad(false);
  };

  useEffect(()=>{cargar();},[periodo,rangoDesde,rangoHasta]);

  const fmt=v=>`${v.toLocaleString("es-ES",{minimumFractionDigits:0,maximumFractionDigits:0})}€`;

  return <div className="card" style={{marginBottom:16}}>
    <div className="chdr"><span className="ctit">💰 KPIs financieros</span></div>
    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
      {[{id:"año",lbl:"Este año"},{id:"mes",lbl:"Este mes"},{id:"semana",lbl:"Esta semana"},{id:"rango",lbl:"Rango"}].map(p=>(
        <button key={p.id} className={`btn sm${periodo===p.id?" bp":" bg"}`} onClick={()=>setPeriodo(p.id)}>{p.lbl}</button>
      ))}
    </div>
    {periodo==="rango"&&(
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <input type="date" className="fi" value={rangoDesde} onChange={e=>setRangoDesde(e.target.value)} style={{flex:1,minWidth:130}}/>
        <span style={{color:"#5a5e6e",fontSize:12}}>→</span>
        <input type="date" className="fi" value={rangoHasta} onChange={e=>setRangoHasta(e.target.value)} style={{flex:1,minWidth:130}}/>
      </div>
    )}
    {load?<div style={{display:"flex",alignItems:"center",gap:8,justifyContent:"center",padding:"20px 0",color:"#5a5e6e",fontSize:13}}><div className="spin" style={{width:16,height:16,borderWidth:2}}/>Calculando…</div>
    :data?<>
      {data.desde&&<div style={{fontSize:11,color:"#5a5e6e",marginBottom:12}}>📅 {new Date(data.desde+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"})} – {new Date(data.hasta+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short",year:"numeric"})}</div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10}}>
        <div style={{background:"#0f1117",borderRadius:10,padding:"12px 14px",borderLeft:"3px solid #c9a84c"}}>
          <div style={{fontSize:10,color:"#7a7f94",textTransform:"uppercase",letterSpacing:.5}}>Facturación proyectada</div>
          <div style={{fontSize:20,fontWeight:700,color:"#c9a84c",marginTop:5,fontFamily:"'Playfair Display',serif"}}>{fmt(data.facturacion)}</div>
        </div>
        <div style={{background:"#0f1117",borderRadius:10,padding:"12px 14px",borderLeft:"3px solid #10b981"}}>
          <div style={{fontSize:10,color:"#7a7f94",textTransform:"uppercase",letterSpacing:.5}}>Ya cobrado</div>
          <div style={{fontSize:20,fontWeight:700,color:"#10b981",marginTop:5,fontFamily:"'Playfair Display',serif"}}>{fmt(data.yaCobrado)}</div>
        </div>
        <div style={{background:"#0f1117",borderRadius:10,padding:"12px 14px",borderLeft:`3px solid ${data.pendiente>0?"#f59e0b":"#10b981"}`}}>
          <div style={{fontSize:10,color:"#7a7f94",textTransform:"uppercase",letterSpacing:.5}}>Pendiente de cobro</div>
          <div style={{fontSize:20,fontWeight:700,color:data.pendiente>0?"#f59e0b":"#10b981",marginTop:5,fontFamily:"'Playfair Display',serif"}}>{fmt(data.pendiente)}</div>
        </div>
        <div style={{background:"#0f1117",borderRadius:10,padding:"12px 14px",borderLeft:"3px solid #e85555"}}>
          <div style={{fontSize:10,color:"#7a7f94",textTransform:"uppercase",letterSpacing:.5}}>Gastos reales</div>
          <div style={{fontSize:20,fontWeight:700,color:"#e85555",marginTop:5,fontFamily:"'Playfair Display',serif"}}>{fmt(data.gastosReales)}</div>
        </div>
        <div style={{background:"#0f1117",borderRadius:10,padding:"12px 14px",borderLeft:"3px solid #e85555",opacity:.8}}>
          <div style={{fontSize:10,color:"#7a7f94",textTransform:"uppercase",letterSpacing:.5}}>Gastos proyectados año</div>
          <div style={{fontSize:20,fontWeight:700,color:"#e85555",marginTop:5,fontFamily:"'Playfair Display',serif"}}>{fmt(data.gastosProyectados)}</div>
        </div>
        <div style={{background:"#0f1117",borderRadius:10,padding:"12px 14px",borderLeft:`3px solid ${data.beneficio>=0?"#10b981":"#e85555"}`}}>
          <div style={{fontSize:10,color:"#7a7f94",textTransform:"uppercase",letterSpacing:.5}}>Beneficio estimado</div>
          <div style={{fontSize:20,fontWeight:700,color:data.beneficio>=0?"#10b981":"#e85555",marginTop:5,fontFamily:"'Playfair Display',serif"}}>{fmt(data.beneficio)}</div>
        </div>
        <div style={{background:"#0f1117",borderRadius:10,padding:"12px 14px",borderLeft:"3px solid #6366f1"}}>
          <div style={{fontSize:10,color:"#7a7f94",textTransform:"uppercase",letterSpacing:.5}}>Comisión gestor ({data.comisionPct}%)</div>
          <div style={{fontSize:20,fontWeight:700,color:"#6366f1",marginTop:5,fontFamily:"'Playfair Display',serif"}}>{fmt(data.comision)}</div>
        </div>
      </div>
    </>:<div style={{color:"#5a5e6e",fontSize:13,padding:"16px 0",textAlign:"center"}}>No se pudieron cargar los datos</div>}
  </div>;
}

// ─── FINANCIAL CHARTS ───────────────────────────────────────────────────────
const MESES_CORTO=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const CHART_COLORS={facturacion:"#c9a84c",cobrado:"#10b981",gastos:"#e85555",beneficio:"#6366f1",eventos:"#c9a84c",airbnb:"#10b981",prev:"#7a7f94"};
const ChartTooltipStyle={contentStyle:{background:"#13161f",border:"1px solid rgba(201,168,76,.25)",borderRadius:10,fontSize:12,color:"#c9c5b8"},itemStyle:{color:"#c9c5b8"},labelStyle:{color:"#c9a84c",fontWeight:600,marginBottom:4}};
const fmtK=v=>v>=1000?`${(v/1000).toFixed(v>=10000?0:1)}k`:`${v}`;

function FinancialCharts({tok}){
  const hoy=new Date();
  const añoActual=hoy.getFullYear();
  const hoyStr=hoy.toISOString().split("T")[0];
  const [monthly,setMonthly]=useState([]);
  const [weekly,setWeekly]=useState([]);
  const [pie,setPie]=useState([]);
  const [prev2025,setPrev2025]=useState(0);
  const [vista,setVista]=useState("mes");
  const [load,setLoad]=useState(true);

  useEffect(()=>{
    (async()=>{
      try{
        const desde=`${añoActual}-01-01`,hasta=`${añoActual}-12-31`;
        const [reservas,airbnbs,gastos,configRows]=await Promise.all([
          sbGet("reservas",`?fecha=gte.${desde}&fecha=lte.${hasta}&select=*`,tok),
          sbGet("reservas_airbnb",`?fecha_entrada=gte.${desde}&fecha_entrada=lte.${hasta}&select=*`,tok),
          sbGet("gastos",`?fecha=gte.${desde}&fecha=lte.${hasta}&select=*`,tok).catch(()=>[]),
          sbGet("configuracion","?select=*",tok).catch(()=>[]),
        ]);
        const cfg={};configRows.forEach(c=>cfg[c.clave]=c.valor);
        const f2025=parseFloat(cfg.facturacion_2025)||0;
        setPrev2025(f2025);

        // ── Datos mensuales ──
        const mData=MESES_CORTO.map((lbl,i)=>{
          const m=String(i+1).padStart(2,"0");
          const rM=reservas.filter(r=>r.fecha?.slice(5,7)===m);
          const aM=airbnbs.filter(a=>a.fecha_entrada?.slice(5,7)===m);
          const gM=gastos.filter(g=>g.fecha?.slice(5,7)===m);
          const fact=rM.reduce((s,r)=>s+(parseFloat(r.precio_total)||parseFloat(r.precio)||0),0)
                    +aM.reduce((s,a)=>s+(parseFloat(a.precio)||0),0);
          let cob=0;
          for(const r of rM){
            const seña=parseFloat(r.seña_importe)||0;
            const pt=parseFloat(r.precio_total)||parseFloat(r.precio)||0;
            if(r.seña_cobrada)cob+=seña;
            if(r.saldo_cobrado)cob+=(pt-seña);
          }
          cob+=aM.filter(a=>a.cobrado||a.fecha_entrada<hoyStr).reduce((s,a)=>s+(parseFloat(a.precio)||0),0);
          const gst=gM.reduce((s,g)=>s+(parseFloat(g.importe)||0),0);
          return {name:lbl,facturacion:Math.round(fact),cobrado:Math.round(cob),gastos:Math.round(gst),beneficio:Math.round(cob-gst),prev2025:f2025>0?Math.round(f2025/12):0};
        });
        setMonthly(mData);

        // ── Datos semanales ──
        const wMap={};
        const d0=new Date(añoActual,0,1);
        while(d0.getFullYear()===añoActual){
          const wk=wkKey(d0);
          if(!wMap[wk])wMap[wk]={name:`S${wk.split("-W")[1]}`,facturacion:0,cobrado:0,gastos:0,beneficio:0};
          d0.setDate(d0.getDate()+1);
        }
        for(const r of reservas){
          const w=wkKey(new Date(r.fecha+"T12:00:00"));
          if(wMap[w]){
            wMap[w].facturacion+=parseFloat(r.precio_total)||parseFloat(r.precio)||0;
            const seña=parseFloat(r.seña_importe)||0;
            const pt=parseFloat(r.precio_total)||parseFloat(r.precio)||0;
            if(r.seña_cobrada)wMap[w].cobrado+=seña;
            if(r.saldo_cobrado)wMap[w].cobrado+=(pt-seña);
          }
        }
        for(const a of airbnbs){
          const w=wkKey(new Date(a.fecha_entrada+"T12:00:00"));
          if(wMap[w]){
            wMap[w].facturacion+=parseFloat(a.precio)||0;
            if(a.cobrado||a.fecha_entrada<hoyStr)wMap[w].cobrado+=parseFloat(a.precio)||0;
          }
        }
        for(const g of gastos){
          const w=wkKey(new Date(g.fecha+"T12:00:00"));
          if(wMap[w])wMap[w].gastos+=parseFloat(g.importe)||0;
        }
        const wData=Object.values(wMap).map(w=>({...w,facturacion:Math.round(w.facturacion),cobrado:Math.round(w.cobrado),gastos:Math.round(w.gastos),beneficio:Math.round(w.cobrado-w.gastos)}));
        setWeekly(wData);

        // ── Pie data ──
        const totalEventos=reservas.reduce((s,r)=>s+(parseFloat(r.precio_total)||parseFloat(r.precio)||0),0);
        const totalAirbnb=airbnbs.reduce((s,a)=>s+(parseFloat(a.precio)||0),0);
        setPie([{name:"Eventos",value:Math.round(totalEventos)},{name:"Airbnb",value:Math.round(totalAirbnb)}]);
      }catch(e){console.error("Charts error:",e);}
      setLoad(false);
    })();
  },[]);

  if(load)return <div style={{display:"flex",alignItems:"center",gap:8,justifyContent:"center",padding:"20px 0",color:"#5a5e6e",fontSize:13}}><div className="spin" style={{width:16,height:16,borderWidth:2}}/>Cargando gráficas…</div>;

  const chartData=vista==="mes"?monthly:weekly;
  const pieTotal=pie.reduce((s,p)=>s+p.value,0);

  return <>
    {/* GRÁFICA 1 — Evolución mensual/semanal */}
    <div className="card" style={{marginBottom:16}}>
      <div className="chdr">
        <span className="ctit">📊 Evolución {añoActual}</span>
        <div style={{display:"flex",gap:4}}>
          <button className={`btn sm${vista==="mes"?" bp":" bg"}`} onClick={()=>setVista("mes")}>Mes</button>
          <button className={`btn sm${vista==="semana"?" bp":" bg"}`} onClick={()=>setVista("semana")}>Semana</button>
        </div>
      </div>
      <div style={{width:"100%",height:280}}>
        <ResponsiveContainer>
          <ComposedChart data={chartData} margin={{top:5,right:5,left:-15,bottom:5}}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)"/>
            <XAxis dataKey="name" tick={{fontSize:10,fill:"#5a5e6e"}} axisLine={{stroke:"rgba(255,255,255,.08)"}} tickLine={false} interval={vista==="semana"?3:"preserveStartEnd"}/>
            <YAxis tick={{fontSize:10,fill:"#5a5e6e"}} axisLine={false} tickLine={false} tickFormatter={fmtK}/>
            <Tooltip {...ChartTooltipStyle} formatter={(v,n)=>[`${v.toLocaleString("es-ES")}€`,n]}/>
            <Legend wrapperStyle={{fontSize:11,paddingTop:8}}/>
            <Bar dataKey="facturacion" name="Facturación" fill={CHART_COLORS.facturacion} radius={[3,3,0,0]} barSize={vista==="semana"?4:undefined}/>
            <Bar dataKey="cobrado" name="Cobrado" fill={CHART_COLORS.cobrado} radius={[3,3,0,0]} barSize={vista==="semana"?4:undefined}/>
            <Bar dataKey="gastos" name="Gastos" fill={CHART_COLORS.gastos} radius={[3,3,0,0]} barSize={vista==="semana"?4:undefined}/>
            <Line type="monotone" dataKey="beneficio" name="Beneficio" stroke={CHART_COLORS.beneficio} strokeWidth={2} dot={vista==="mes"?{r:3,fill:CHART_COLORS.beneficio}:false}/>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>

    {/* GRÁFICA 2 — Comparativa anual (solo si hay dato 2025) */}
    {prev2025>0&&(
      <div className="card" style={{marginBottom:16}}>
        <div className="chdr"><span className="ctit">📈 Comparativa {añoActual-1} vs {añoActual}</span></div>
        <div style={{width:"100%",height:240}}>
          <ResponsiveContainer>
            <LineChart data={monthly} margin={{top:5,right:5,left:-15,bottom:5}}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)"/>
              <XAxis dataKey="name" tick={{fontSize:10,fill:"#5a5e6e"}} axisLine={{stroke:"rgba(255,255,255,.08)"}} tickLine={false}/>
              <YAxis tick={{fontSize:10,fill:"#5a5e6e"}} axisLine={false} tickLine={false} tickFormatter={fmtK}/>
              <Tooltip {...ChartTooltipStyle} formatter={(v,n)=>[`${v.toLocaleString("es-ES")}€`,n]}/>
              <Legend wrapperStyle={{fontSize:11,paddingTop:8}}/>
              <Line type="monotone" dataKey="prev2025" name={`${añoActual-1} (proy.)`} stroke={CHART_COLORS.prev} strokeWidth={2} strokeDasharray="6 3" dot={{r:3,fill:CHART_COLORS.prev}}/>
              <Line type="monotone" dataKey="facturacion" name={`${añoActual}`} stroke={CHART_COLORS.facturacion} strokeWidth={2} dot={{r:3,fill:CHART_COLORS.facturacion}}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    )}

    {/* GRÁFICA 3 — Desglose por fuente */}
    {pieTotal>0&&(
      <div className="card" style={{marginBottom:16}}>
        <div className="chdr"><span className="ctit">🍩 Ingresos por fuente</span></div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:24,flexWrap:"wrap"}}>
          <div style={{width:180,height:180}}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pie} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" strokeWidth={0} label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                  <Cell fill={CHART_COLORS.eventos}/>
                  <Cell fill={CHART_COLORS.airbnb}/>
                </Pie>
                <Tooltip {...ChartTooltipStyle} formatter={(v)=>[`${v.toLocaleString("es-ES")}€`]}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {pie.map((p,i)=>(
              <div key={p.name} style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:12,height:12,borderRadius:3,background:i===0?CHART_COLORS.eventos:CHART_COLORS.airbnb,flexShrink:0}}/>
                <div>
                  <div style={{fontSize:13,color:"#c9c5b8",fontWeight:500}}>{p.name}</div>
                  <div style={{fontSize:16,fontWeight:700,color:i===0?CHART_COLORS.eventos:CHART_COLORS.airbnb,fontFamily:"'Playfair Display',serif"}}>{p.value.toLocaleString("es-ES")}€</div>
                  <div style={{fontSize:11,color:"#5a5e6e"}}>{pieTotal>0?((p.value/pieTotal)*100).toFixed(1):0}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )}
  </>;
}

// ─── ATENCIÓN AHORA ─────────────────────────────────────────────────────────
function AtencionAhora({tok,setPage}){
  const [llegadas,setLlegadas]=useState([]);
  const [acciones,setAcciones]=useState([]);
  const [solicitudes,setSolicitudes]=useState([]);
  const [srvLimp,setSrvLimp]=useState([]);
  const [srvJard,setSrvJard]=useState([]);
  const [load,setLoad]=useState(true);

  useEffect(()=>{
    (async()=>{
      try{
        const hoy=new Date();
        const hoyStr=hoy.toISOString().split("T")[0];
        const en7=new Date(hoy);en7.setDate(en7.getDate()+7);
        const en7Str=en7.toISOString().split("T")[0];
        const ACTIVOS=["visita","pendiente_contrato","contrato_firmado","reserva_pagada","precio_total"];

        const [airbnbs,reservas,visitas,sols,sLimp,sJard]=await Promise.all([
          sbGet("reservas_airbnb",`?fecha_entrada=gte.${hoyStr}&fecha_entrada=lte.${en7Str}&select=*`,tok),
          sbGet("reservas",`?fecha=gte.${hoyStr}&fecha=lte.${en7Str}&select=*`,tok),
          sbGet("visitas",`?fecha=gte.${hoyStr}&fecha=lte.${en7Str}&estado=eq.pendiente&select=*`,tok).catch(()=>[]),
          sbGet("solicitudes_desbloqueo","?estado=eq.pendiente&select=*&order=created_at.desc",tok).catch(()=>[]),
          sbGet("servicios","?select=*",tok).catch(()=>[]),
          sbGet("jardin_servicios","?estado=eq.activo&select=*",tok).catch(()=>[]),
        ]);

        // Llegadas
        const ll=[];
        for(const a of airbnbs){
          const noches=Math.round((new Date(a.fecha_salida)-new Date(a.fecha_entrada))/(86400000));
          ll.push({tipo:"airbnb",nombre:a.huesped,fecha:a.fecha_entrada,detalle:`${noches} noche${noches!==1?"s":""}${a.personas?` · ${a.personas} pers.`:""}`});
        }
        for(const r of reservas.filter(r=>ACTIVOS.includes(r.estado))){
          ll.push({tipo:"evento",nombre:r.nombre,fecha:r.fecha,detalle:r.tipo||"Evento"});
        }
        ll.sort((a,b)=>a.fecha.localeCompare(b.fecha));
        setLlegadas(ll);

        // Acciones requeridas
        const acc=[];
        const todasRes=await sbGet("reservas","?select=*",tok);
        for(const r of todasRes){
          if(r.estado==="cancelada"||r.estado==="finalizada")continue;
          if(!r.contrato_firmado){
            acc.push({tipo:"contrato",nombre:r.nombre,fecha:r.fecha,detalle:"Contrato pendiente de firma",id:r.id});
          }else if(r.estado==="contrato_firmado"&&!r.seña_cobrada){
            acc.push({tipo:"seña",nombre:r.nombre,fecha:r.fecha,detalle:"Señal pendiente de cobro",id:r.id});
          }
        }
        for(const v of visitas){
          acc.push({tipo:"visita",nombre:v.nombre,fecha:v.fecha,detalle:`Visita ${v.hora?.slice(0,5)||""} · ${v.tipo_evento||""}`.trim()});
        }
        acc.sort((a,b)=>a.fecha.localeCompare(b.fecha));
        setAcciones(acc);

        setSolicitudes(sols);
        setSrvLimp(sLimp.filter(s=>s.estado==="en_curso"));
        setSrvJard(sJard);
      }catch(e){console.error("AtencionAhora:",e);}
      setLoad(false);
    })();
  },[]);

  if(load)return <div style={{display:"flex",alignItems:"center",gap:8,justifyContent:"center",padding:"20px 0",color:"#5a5e6e",fontSize:13}}><div className="spin" style={{width:16,height:16,borderWidth:2}}/>Cargando…</div>;

  const totalItems=llegadas.length+acciones.length+solicitudes.length+srvLimp.length+srvJard.length;
  if(totalItems===0)return null;

  const fmtF=f=>new Date(f+"T12:00:00").toLocaleDateString("es-ES",{weekday:"short",day:"numeric",month:"short"});
  const tagStyle=(bg,col)=>({display:"inline-block",fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:4,background:bg,color:col,letterSpacing:.5,flexShrink:0});

  return <div className="card" style={{marginBottom:16}}>
    <div className="chdr"><span className="ctit">⚡ Atención ahora</span><span className="badge" style={{background:"rgba(232,85,85,.1)",color:"#e85555",border:"1px solid rgba(232,85,85,.2)"}}>{totalItems}</span></div>

    {/* LLEGADAS */}
    {llegadas.length>0&&<>
      <div style={{fontSize:11,color:"#c9a84c",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:8,marginTop:4}}>🏠 Próximas llegadas esta semana</div>
      {llegadas.map((l,i)=>(
        <div key={`ll-${i}`} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"#0f1117",borderRadius:8,marginBottom:5}}>
          <span style={l.tipo==="airbnb"?tagStyle("rgba(16,185,129,.15)","#10b981"):tagStyle("rgba(99,102,241,.15)","#a5b4fc")}>{l.tipo==="airbnb"?"AIRBNB":"EVENTO"}</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,color:"#e8e6e1",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.nombre}</div>
            <div style={{fontSize:11,color:"#5a5e6e"}}>{l.detalle}</div>
          </div>
          <div style={{fontSize:12,color:"#7a7f94",flexShrink:0}}>📅 {fmtF(l.fecha)}</div>
        </div>
      ))}
    </>}

    {/* ACCIONES */}
    {acciones.length>0&&<>
      <div style={{fontSize:11,color:"#f59e0b",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:8,marginTop:llegadas.length>0?16:4}}>📋 Requieren acción</div>
      {acciones.map((a,i)=>(
        <div key={`ac-${i}`} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"#0f1117",borderRadius:8,marginBottom:5,cursor:a.tipo==="visita"?"pointer":a.id?"pointer":"default"}} onClick={()=>{if(a.tipo==="visita")setPage("visitas");else if(a.id)setPage("reservas");}}>
          <span style={{fontSize:16,flexShrink:0}}>{a.tipo==="contrato"?"✍️":a.tipo==="seña"?"💰":"👁"}</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,color:"#e8e6e1",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.nombre}</div>
            <div style={{fontSize:11,color:"#f59e0b"}}>{a.detalle}</div>
          </div>
          <div style={{fontSize:12,color:"#7a7f94",flexShrink:0}}>📅 {fmtF(a.fecha)}</div>
        </div>
      ))}
    </>}

    {/* SOLICITUDES */}
    {solicitudes.length>0&&<>
      <div style={{fontSize:11,color:"#e85555",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:8,marginTop:(llegadas.length+acciones.length)>0?16:4}}>🔓 Solicitudes de desbloqueo</div>
      {solicitudes.map(s=>{
        const fF=new Date(s.fecha+"T12:00:00").toLocaleDateString("es-ES",{weekday:"short",day:"numeric",month:"short"});
        return <div key={s.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"#0f1117",borderRadius:8,marginBottom:5,cursor:"pointer"}} onClick={()=>setPage("notifs")}>
          <span style={{fontSize:16,flexShrink:0}}>🔒</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,color:"#e8e6e1",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.solicitado_por}</div>
            <div style={{fontSize:11,color:"#e85555"}}>{s.motivo||"Solicitud de desbloqueo"}</div>
          </div>
          <div style={{fontSize:12,color:"#7a7f94",flexShrink:0}}>📅 {fF}</div>
        </div>;
      })}
    </>}

    {/* SERVICIOS ACTIVOS */}
    {(srvLimp.length>0||srvJard.length>0)&&<>
      <div style={{fontSize:11,color:"#6366f1",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:8,marginTop:(llegadas.length+acciones.length+solicitudes.length)>0?16:4}}>🧹 Servicios activos</div>
      {srvLimp.map(s=>(
        <div key={`sl-${s.id}`} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"#0f1117",borderRadius:8,marginBottom:5,cursor:"pointer"}} onClick={()=>setPage("limpieza")}>
          <span style={tagStyle("rgba(99,102,241,.15)","#a5b4fc")}>LIMPIEZA</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,color:"#e8e6e1",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>🧹 {s.nombre}</div>
            <div style={{fontSize:11,color:"#5a5e6e"}}>📅 {new Date(s.fecha).toLocaleDateString("es-ES",{day:"numeric",month:"short"})}</div>
          </div>
        </div>
      ))}
      {srvJard.map(s=>{
        const fi=new Date(s.fecha_inicio+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"});
        const ff=new Date(s.fecha_fin+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"});
        return <div key={`sj-${s.id}`} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"#0f1117",borderRadius:8,marginBottom:5,cursor:"pointer"}} onClick={()=>setPage("jadmin")}>
          <span style={tagStyle("rgba(16,185,129,.15)","#10b981")}>JARDÍN</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,color:"#e8e6e1",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>🌿 {s.nombre}</div>
            <div style={{fontSize:11,color:"#5a5e6e"}}>📅 {fi} – {ff}{s.jardinero_nombre?` · 👤 ${s.jardinero_nombre}`:""}</div>
          </div>
        </div>;
      })}
    </>}
  </div>;
}

// ─── AUTO-COBRO AIRBNB ──────────────────────────────────────────────────────
async function autoCobrarAirbnb(tok){
  const hoyStr=new Date().toISOString().split("T")[0];
  const ssKey=`airbnb_autocobro_${hoyStr}`;
  if(sessionStorage.getItem(ssKey))return;
  try{
    const pendientes=await sbGet("reservas_airbnb",`?fecha_entrada=lt.${hoyStr}&cobrado=eq.false&select=*`,tok);
    if(pendientes.length===0){sessionStorage.setItem(ssKey,"1");return;}
    const configRows=await sbGet("configuracion","?select=*",tok).catch(()=>[]);
    const cfg={};configRows.forEach(c=>cfg[c.clave]=c.valor);
    const comisionPct=parseFloat(cfg.comision_pct)||10;
    for(const a of pendientes){
      await sbPatch("reservas_airbnb",`id=eq.${a.id}`,{cobrado:true},tok);
      const precio=parseFloat(a.precio)||0;
      if(precio>0){
        const concepto=`Comisión Airbnb - ${a.huesped}`;
        const existe=await sbGet("gastos",`?concepto=eq.${encodeURIComponent(concepto)}&select=id`,tok).catch(()=>[]);
        if(existe.length===0){
          await sbPost("gastos",{fecha:hoyStr,categoria:"comision",concepto,importe:Math.round(precio*comisionPct/100*100)/100,origen:"auto_comision"},tok).catch(()=>{});
        }
      }
    }
    sessionStorage.setItem(ssKey,"1");
  }catch(_){}
}

function DashA({reservas,jsem,jpunt,cwk,setPage,tok}){
  useEffect(()=>{autoCobrarAirbnb(tok);},[]);
  const temp=getTemporada();
  const sj={}; jsem.forEach(r=>sj[r.tarea_id]=r);
  const actv=JARDIN_T[temp].filter(t=>tocaSemana({...t,frec:t.frec},cwk));
  const comp=actv.filter(t=>sj[t.id]?.done).length+jpunt.filter(t=>t.done).length;
  const tot=actv.length+jpunt.length;
  const inc=jsem.filter(r=>r.nota&&r.tarea_id!=="VERIFICACION_FINAL").length+jpunt.filter(r=>r.nota).length;
  const ing=reservas.filter(r=>r.estado==="precio_total"||r.estado==="finalizada").reduce((s,r)=>s+(parseFloat(r.precio)||0),0);
  const prox=[...reservas].find(r=>new Date(r.fecha)>=new Date());
  return <>
    <div className="ph"><h2>Panel administración 👋</h2><p>{new Date().toLocaleDateString("es-ES",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p></div>
    <div className="pb">
      <div className="sg">
        <SC lbl="Reservas activas" val={reservas.filter(r=>["visita","pendiente_contrato","contrato_firmado","reserva_pagada","precio_total"].includes(r.estado)).length} sub="en curso"/>
        <SC lbl="Ingresos confirmados" val={`${ing.toLocaleString("es-ES")}€`}/>
        <SC lbl="Jardín esta semana" val={`${comp}/${tot}`} prog={tot?comp/tot:0}/>
        <SC lbl="Incidencias" val={inc} valC={inc>0?"#f59e0b":undefined} sub={inc>0?"⚠️ Ver panel":"Sin incidencias"} onClick={()=>setPage("incidencias")}/>
      </div>
      <FinancialKPIs tok={tok}/>
      <FinancialCharts tok={tok}/>
      <AtencionAhora tok={tok} setPage={setPage}/>
      {prox&&<div className="card" style={{marginBottom:16,borderLeft:"3px solid #c9a84c"}}>
        <div style={{fontSize:10,color:"#5a5e6e",textTransform:"uppercase",letterSpacing:1,marginBottom:7}}>PRÓXIMO EVENTO</div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
          <div><div style={{fontSize:16,fontWeight:600,color:"#e8e6e1"}}>{prox.nombre}</div><div style={{fontSize:12,color:"#7a7f94",marginTop:4}}>📅 {new Date(prox.fecha).toLocaleDateString("es-ES",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</div></div>
          <div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:18,fontWeight:700,color:"#c9a84c"}}>{parseFloat(prox.precio||0).toLocaleString("es-ES")}€</div><SBadge e={prox.estado}/></div>
        </div>
      </div>}
      <div className="g2">
        <div className="card"><div className="chdr"><span className="ctit">🌿 Jardín esta semana</span><button className="btn bg sm" onClick={()=>setPage("jcheck")}>Ver</button></div>{actv.slice(0,5).map(t=><MTask key={t.id} lbl={t.txt} done={sj[t.id]?.done}/>)}</div>
        <div className="card"><div className="chdr"><span className="ctit">📅 Próximas reservas</span><button className="btn bg sm" onClick={()=>setPage("reservas")}>Ver</button></div>
          {reservas.length===0?<div style={{fontSize:12,color:"#5a5e6e"}}>Sin reservas registradas</div>
            :reservas.slice(0,5).map(r=><div key={r.id} style={{padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,.04)",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}><div style={{minWidth:0}}><div style={{fontSize:13,color:"#c9c5b8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.nombre}</div><div style={{fontSize:11,color:"#5a5e6e"}}>{new Date(r.fecha).toLocaleDateString("es-ES")}</div></div><SBadge e={r.estado}/></div>)}
        </div>
      </div>
    </div>
  </>;
}
function DashJ({perfil,jsem,jpunt,cwk,setPage,tok}){
  const temp=getTemporada();
  const sj={}; jsem.forEach(r=>sj[r.tarea_id]=r);
  const actv=JARDIN_T[temp].filter(t=>tocaSemana({...t,frec:t.frec},cwk));
  const tot=actv.length+jpunt.length;
  const comp=actv.filter(t=>sj[t.id]?.done).length+jpunt.filter(t=>t.done).length;

  // Servicio activo de jardinería
  const [srvActivo,setSrvActivo]=useState(null);
  const [srvTareas,setSrvTareas]=useState([]);
  const [jornada,setJornada]=useState(null); // jornada hoy
  const [elapsed,setElapsed]=useState(0);
  const [pausado,setPausado]=useState(false);
  const [saving2,setSaving2]=useState(false);
  const [showFinJornada,setShowFinJornada]=useState(false);
  const [showFinSrv,setShowFinSrv]=useState(false);
  const [showNuevaJornada,setShowNuevaJornada]=useState(false);
  const hoyStr=new Date().toISOString().split("T")[0];
  const lsKey=`fm_jornada_inicio_${perfil.id}`;

  const loadSrvActivo=async()=>{
    try{
      const srvs=await sbGet("servicios_jardineria",`?estado=eq.en_curso&jardinero_id=eq.${perfil.id}&select=*`,tok).catch(()=>[]);
      if(srvs.length===0){setSrvActivo(null);return;}
      const s=srvs[0];setSrvActivo(s);
      // Tareas (stored as jsonb array or separate table)
      if(Array.isArray(s.tareas)&&s.tareas.length>0){
        // If tareas is simple string array, convert to objects
        const tareasObj=s.tareas.map((t,i)=>typeof t==="string"?{idx:i,txt:t,done:false}:t);
        // Load completion state from tareas_completadas jsonb
        const completadas=s.tareas_completadas||[];
        setSrvTareas(tareasObj.map(t=>({...t,done:completadas.includes(t.idx!==undefined?t.idx:t.txt)})));
      }
      // Jornada de hoy
      const jHoy=await sbGet("jornadas_jardineria",`?servicio_id=eq.${s.id}&fecha=eq.${hoyStr}&select=*`,tok).catch(()=>[]);
      if(jHoy.length>0){
        setJornada(jHoy[0]);
        const pausas=jHoy[0].pausas||[];
        const ultimaPausa=pausas[pausas.length-1];
        setPausado(ultimaPausa&&!ultimaPausa.fin?true:false);
        if(!localStorage.getItem(lsKey))localStorage.setItem(lsKey,jHoy[0].hora_inicio);
      }else{
        setJornada(null);
        // Si hay servicio en curso pero no jornada hoy → preguntar
        if(s)setShowNuevaJornada(true);
      }
    }catch(_){}
  };
  useEffect(()=>{if(tok)loadSrvActivo();},[]);

  // Cronómetro
  useEffect(()=>{
    if(!jornada||jornada.hora_fin)return;
    const calc=()=>{
      const ini=localStorage.getItem(lsKey)||jornada.hora_inicio;
      if(!ini)return 0;
      const [h,m]=ini.split(":").map(Number);
      const iniMs=new Date();iniMs.setHours(h,m,0,0);
      let totalMs=Date.now()-iniMs.getTime();
      // Descontar pausas
      const pausas=jornada.pausas||[];
      for(const p of pausas){
        if(p.inicio&&p.fin)totalMs-=(p.fin-p.inicio);
        else if(p.inicio&&!p.fin)totalMs-=(Date.now()-p.inicio);
      }
      return Math.max(0,Math.floor(totalMs/1000));
    };
    setElapsed(calc());
    const iv=setInterval(()=>setElapsed(calc()),1000);
    return()=>clearInterval(iv);
  },[jornada,pausado]);

  const fmtElapsed=s=>{const h=Math.floor(s/3600);const m=Math.floor((s%3600)/60);const ss=s%60;return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(ss).padStart(2,"0")}`;};
  const fmtHM=mins=>{const h=Math.floor(mins/60);const m=Math.round(mins%60);return `${h}h ${m}min`;};

  const iniciarJornada=async()=>{
    if(saving2||!srvActivo)return;setSaving2(true);
    const ahora=new Date();
    const hi=`${String(ahora.getHours()).padStart(2,"0")}:${String(ahora.getMinutes()).padStart(2,"0")}`;
    try{
      const [j]=await sbPost("jornadas_jardineria",{servicio_id:srvActivo.id,jardinero_id:perfil.id,fecha:hoyStr,hora_inicio:hi,pausas:[]},tok);
      setJornada(j);localStorage.setItem(lsKey,hi);setPausado(false);setShowNuevaJornada(false);
    }catch(_){}
    setSaving2(false);
  };

  const togglePausa=async()=>{
    if(!jornada||saving2)return;setSaving2(true);
    const pausas=[...(jornada.pausas||[])];
    if(!pausado){pausas.push({inicio:Date.now(),fin:null});}
    else{const last=pausas[pausas.length-1];if(last)last.fin=Date.now();}
    try{
      await sbPatch("jornadas_jardineria",`id=eq.${jornada.id}`,{pausas},tok);
      setJornada(prev=>({...prev,pausas}));setPausado(!pausado);
    }catch(_){}
    setSaving2(false);
  };

  const terminarJornada=async()=>{
    if(!jornada||saving2)return;setSaving2(true);
    const ahora=new Date();
    const hf=`${String(ahora.getHours()).padStart(2,"0")}:${String(ahora.getMinutes()).padStart(2,"0")}`;
    // Cerrar pausa abierta
    const pausas=[...(jornada.pausas||[])];
    const last=pausas[pausas.length-1];
    if(last&&!last.fin)last.fin=Date.now();
    const durMin=Math.max(0,Math.round(elapsed/60));
    try{
      await sbPatch("jornadas_jardineria",`id=eq.${jornada.id}`,{hora_fin:hf,duracion_minutos:durMin,pausas},tok);
      // Update horas_totales on servicio
      const horasJornada=Math.round(durMin/60*100)/100;
      const prevHoras=parseFloat(srvActivo.horas_totales)||0;
      await sbPatch("servicios_jardineria",`id=eq.${srvActivo.id}`,{horas_totales:prevHoras+horasJornada},tok).catch(()=>{});
      localStorage.removeItem(lsKey);
      setJornada(prev=>({...prev,hora_fin:hf,duracion_minutos:durMin}));setShowFinJornada(false);
      await loadSrvActivo();
    }catch(_){}
    setSaving2(false);
  };

  const toggleTareaSrv=async(idx)=>{
    if(!srvActivo||saving2)return;setSaving2(true);
    const newTareas=srvTareas.map(t=>t.idx===idx?{...t,done:!t.done}:t);
    setSrvTareas(newTareas);
    const completadas=newTareas.filter(t=>t.done).map(t=>t.idx);
    try{await sbPatch("servicios_jardineria",`id=eq.${srvActivo.id}`,{tareas_completadas:completadas},tok);}catch(_){}
    setSaving2(false);
  };

  const completarServicio=async()=>{
    if(!srvActivo||saving2)return;setSaving2(true);
    try{
      // Cerrar jornada si está abierta
      if(jornada&&!jornada.hora_fin)await terminarJornada();
      const horasT=parseFloat(srvActivo.horas_totales)||0;
      const mod=srvActivo.modalidad||"por_horas";
      let costeTotal=0;
      if(mod==="por_horas")costeTotal=Math.round(horasT*(parseFloat(srvActivo.tarifa_hora)||0)*100)/100;
      else if(mod==="precio_fijo_servicio")costeTotal=parseFloat(srvActivo.importe_fijo)||0;
      const costeHoraReal=horasT>0?Math.round(costeTotal/horasT*100)/100:0;
      await sbPatch("servicios_jardineria",`id=eq.${srvActivo.id}`,{estado:"finalizado",coste_total:costeTotal,coste_hora_real:costeHoraReal},tok);
      // Notificar admin
      const admins=await sbGet("usuarios","?rol=eq.admin&select=id",tok);
      const msg=`🌿 ${perfil.nombre} ha completado el servicio "${srvActivo.titulo}". Total: ${horasT}h. Coste: ${costeTotal}€.`;
      for(const a of admins){await sbPost("notificaciones",{para:a.id,txt:msg},tok);sendPush("🌿 Finca El Molino",msg,"jardin-srv-fin");}
      localStorage.removeItem(lsKey);setShowFinSrv(false);setSrvActivo(null);
    }catch(_){}
    setSaving2(false);
  };

  const todasTareasOk=srvTareas.length>0&&srvTareas.every(t=>t.done);
  const totalAcum=parseFloat(srvActivo?.horas_totales||0);

  return <>
    <div className="ph"><h2>Hola, {perfil.nombre.split(" ")[0]} 👋</h2><p>{new Date().toLocaleDateString("es-ES",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p></div>
    <div className="pb">
      {/* SERVICIO ACTIVO */}
      {srvActivo&&<div className="card" style={{marginBottom:16,border:"1px solid rgba(16,185,129,.3)",background:"rgba(16,185,129,.04)"}}>
        <div className="chdr"><span className="ctit">🌿 Servicio activo</span></div>
        <div style={{fontSize:16,fontWeight:600,color:"#e8e6e1",marginBottom:6}}>{srvActivo.titulo}</div>
        <div style={{fontSize:12,color:"#7a7f94",marginBottom:12}}>Tareas: {srvTareas.filter(t=>t.done).length} de {srvTareas.length} completadas</div>

        {/* Cronómetro */}
        {jornada&&!jornada.hora_fin&&<>
          <div style={{textAlign:"center",padding:"16px 0",marginBottom:12,background:"#0f1117",borderRadius:12}}>
            <div style={{fontSize:11,color:pausado?"#f59e0b":"#10b981",textTransform:"uppercase",letterSpacing:1,fontWeight:600,marginBottom:6}}>{pausado?"⏸ En pausa":"⏱️ Esta jornada"}</div>
            <div style={{fontSize:36,fontWeight:700,color:pausado?"#f59e0b":"#c9a84c",fontFamily:"monospace",letterSpacing:2}}>{fmtElapsed(elapsed)}</div>
            {totalAcum>0&&<div style={{fontSize:12,color:"#5a5e6e",marginTop:6}}>📅 Total acumulado: {fmtHM(totalAcum*60)}</div>}
          </div>
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            <button className={`btn ${pausado?"bp":"bg"}`} style={{flex:1,justifyContent:"center",padding:"12px",fontSize:14}} onClick={togglePausa} disabled={saving2}>{pausado?"▶️ Reanudar":"⏸️ Pausar"}</button>
            <button className="btn" style={{flex:1,justifyContent:"center",padding:"12px",fontSize:14,background:"#6366f1",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:500}} onClick={()=>setShowFinJornada(true)}>🌙 Terminar jornada</button>
          </div>
        </>}
        {jornada?.hora_fin&&<div style={{background:"rgba(99,102,241,.08)",border:"1px solid rgba(99,102,241,.2)",borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:13,color:"#a5b4fc",textAlign:"center"}}>✅ Jornada de hoy completada — {fmtHM(jornada.duracion_minutos||0)}</div>}
        {!jornada&&!showNuevaJornada&&<button className="btn bp" style={{width:"100%",justifyContent:"center",padding:"14px",fontSize:15,marginBottom:14}} onClick={iniciarJornada} disabled={saving2}>▶️ Iniciar jornada</button>}

        {/* Checklist */}
        {srvTareas.map(t=><div key={t.idx} className={`cli${t.done?" done":""}`} style={{marginBottom:4}}>
          <div className={`chk${t.done?" on":""}`} onClick={()=>toggleTareaSrv(t.idx)} style={{cursor:"pointer"}}/>
          <div style={{flex:1,minWidth:0}}><div className={`tl${t.done?" done":""}`}>{t.txt}</div></div>
        </div>)}

        {/* Completar servicio */}
        {todasTareasOk&&(!jornada||jornada.hora_fin)&&<button className="btn bp" style={{width:"100%",justifyContent:"center",padding:"14px",fontSize:15,marginTop:12,background:"#10b981"}} onClick={()=>setShowFinSrv(true)}>✅ Marcar servicio completado</button>}
      </div>}

      <div className="sg"><SC lbl="Tareas esta semana" val={tot}/><SC lbl="Completadas" val={comp} prog={tot?comp/tot:0} valC="#10b981" sub={comp===tot&&tot>0?"¡Al día! ✓":undefined}/><SC lbl="Pendientes" val={tot-comp} valC={tot-comp>0?"#f59e0b":"#10b981"}/></div>
      <div className="card"><div className="chdr"><span className="ctit">📋 Mis tareas</span><button className="btn bp sm" onClick={()=>setPage("jcheck")}>Ir al checklist →</button></div>
        {actv.slice(0,6).map(t=><MTask key={t.id} lbl={t.txt} sub={t.zona} done={sj[t.id]?.done}/>)}
        {jpunt.map(t=><MTask key={t.id} lbl={t.txt} sub="📌 Puntual" done={t.done}/>)}
        {tot===0&&<div className="empty"><span className="ico">✅</span><p>Sin tareas esta semana</p></div>}
      </div>
    </div>

    {/* Modal nueva jornada */}
    {showNuevaJornada&&<div className="ov"><div className="modal" style={{maxWidth:400,textAlign:"center"}}>
      <div style={{fontSize:36,marginBottom:8}}>🌿</div>
      <h3>Tienes un servicio en curso</h3>
      <p style={{fontSize:13,color:"#7a7f94",marginBottom:20,lineHeight:1.5}}>"{srvActivo?.titulo}" está activo. ¿Empezar la jornada de hoy?</p>
      <button className="btn bp" style={{width:"100%",justifyContent:"center",padding:"14px",fontSize:15}} onClick={iniciarJornada} disabled={saving2}>{saving2?"Iniciando…":"▶️ Empezar jornada"}</button>
      <button onClick={()=>setShowNuevaJornada(false)} style={{background:"none",border:"none",color:"#5a5e6e",cursor:"pointer",width:"100%",textAlign:"center",marginTop:12,fontSize:12,fontFamily:"'DM Sans',sans-serif",padding:"8px"}}>Ahora no</button>
    </div></div>}

    {/* Modal terminar jornada */}
    {showFinJornada&&<div className="ov"><div className="modal" style={{maxWidth:400,textAlign:"center"}}>
      <div style={{fontSize:36,marginBottom:8}}>🌙</div>
      <h3>¿Terminas por hoy?</h3>
      <div style={{fontSize:24,fontWeight:700,color:"#c9a84c",fontFamily:"monospace",margin:"16px 0"}}>{fmtElapsed(elapsed)}</div>
      <p style={{fontSize:13,color:"#7a7f94",marginBottom:20}}>Llevas {fmtHM(Math.round(elapsed/60))}</p>
      <button className="btn bp" style={{width:"100%",justifyContent:"center",padding:"14px",fontSize:15}} onClick={terminarJornada} disabled={saving2}>{saving2?"Guardando…":"✅ Terminar jornada"}</button>
      <button className="btn bg" style={{width:"100%",justifyContent:"center",marginTop:8}} onClick={()=>setShowFinJornada(false)}>Cancelar</button>
    </div></div>}

    {/* Modal completar servicio */}
    {showFinSrv&&<div className="ov"><div className="modal" style={{maxWidth:440,textAlign:"center"}}>
      <div style={{fontSize:36,marginBottom:8}}>✅</div>
      <h3>Completar servicio</h3>
      <p style={{fontSize:13,color:"#7a7f94",marginBottom:16,lineHeight:1.5}}>"{srvActivo?.titulo}" — todas las tareas completadas.</p>
      <div style={{background:"#0f1117",borderRadius:10,padding:"14px",marginBottom:20}}>
        <div style={{fontSize:12,color:"#5a5e6e",marginBottom:6}}>Total acumulado: <strong style={{color:"#c9a84c"}}>{fmtHM(totalAcum*60)}</strong></div>
      </div>
      <button className="btn bp" style={{width:"100%",justifyContent:"center",padding:"14px",fontSize:15,background:"#10b981"}} onClick={completarServicio} disabled={saving2}>{saving2?"Finalizando…":"✅ Confirmar y notificar al admin"}</button>
      <button className="btn bg" style={{width:"100%",justifyContent:"center",marginTop:8}} onClick={()=>setShowFinSrv(false)}>Cancelar</button>
    </div></div>}
  </>;
}
function DashL({perfil,setPage}){
  return <>
    <div className="ph"><h2>Hola, {perfil.nombre.split(" ")[0]} 🧹</h2><p>{new Date().toLocaleDateString("es-ES",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p></div>
    <div className="pb"><div className="g2">
      {[{ico:"🧹",t:"Mi servicio",s:"Checklist limpieza",id:"limpieza"},{ico:"📅",t:"Calendario",s:"Próximos eventos",id:"cal-limp"}].map(it=>(
        <button key={it.id} className="card" style={{cursor:"pointer",textAlign:"left",border:"1px solid rgba(201,168,76,.15)"}} onClick={()=>setPage(it.id)}>
          <div style={{fontSize:28,marginBottom:8}}>{it.ico}</div><div style={{fontSize:14,fontWeight:600,color:"#c9c5b8"}}>{it.t}</div><div style={{fontSize:12,color:"#5a5e6e",marginTop:3}}>{it.s}</div>
        </button>))}
    </div></div>
  </>;
}
function DashC({perfil,reservas,setPage}){
  const pend=reservas.filter(r=>r.estado==="visita"||r.estado==="pendiente_contrato").length;
  return <>
    <div className="ph"><h2>Hola, {perfil.nombre.split(" ")[0]} 👋</h2><p>{new Date().toLocaleDateString("es-ES",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p></div>
    <div className="pb">
      <div className="sg"><SC lbl="Reservas activas" val={reservas.filter(r=>["visita","pendiente_contrato","contrato_firmado","reserva_pagada","precio_total"].includes(r.estado)).length} sub="en curso"/><SC lbl="Pendientes de firma" val={pend} valC={pend>0?"#f59e0b":undefined}/></div>
      <div className="g2">{[{ico:"📋",t:"Reservas",s:"Listado completo",id:"reservas"},{ico:"📅",t:"Calendario",s:"Disponibilidad",id:"calendario"}].map(it=>(
        <button key={it.id} className="card" style={{cursor:"pointer",textAlign:"left",border:"1px solid rgba(201,168,76,.15)"}} onClick={()=>setPage(it.id)}>
          <div style={{fontSize:28,marginBottom:8}}>{it.ico}</div><div style={{fontSize:14,fontWeight:600,color:"#c9c5b8"}}>{it.t}</div><div style={{fontSize:12,color:"#5a5e6e",marginTop:3}}>{it.s}</div>
        </button>))}</div>
    </div>
  </>;
}

// ─── SEMANA ARCHIVADA ─────────────────────────────────────────────────────────
function SemanaArchivada({semana,estado,nota}){
  const [open,setOpen]=useState(false);
  const ok=estado===true;
  const rango=semanaRango(semana);
  return <div style={{background:ok?"rgba(16,185,129,.06)":"rgba(245,158,11,.06)",border:`1px solid ${ok?"rgba(16,185,129,.2)":"rgba(245,158,11,.2)"}`,borderRadius:10,marginBottom:8,overflow:"hidden"}}>
    <div onClick={()=>setOpen(!open)} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",cursor:"pointer"}}>
      <span style={{fontSize:18}}>{ok?"✅":"⚠️"}</span>
      <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:ok?"#10b981":"#f59e0b"}}>Semana del {rango}</div><div style={{fontSize:11,color:"#7a7f94",marginTop:2}}>{ok?"Jardín verificado ✓":"Cerrado con incidencias"}</div></div>
      <span style={{color:"#5a5e6e",fontSize:18,transition:"transform .2s",transform:open?"rotate(90deg)":"none"}}>›</span>
    </div>
    {open&&<div style={{padding:"0 14px 14px",borderTop:"1px solid rgba(255,255,255,.05)"}}>
      {nota&&<div style={{fontSize:12,color:"#c9c5b8",marginTop:10,lineHeight:1.5}}>📝 {nota}</div>}
      <div style={{fontSize:11,color:"#5a5e6e",marginTop:6}}>Archivada · {semana}</div>
    </div>}
  </div>;
}

// ─── JARDÍN CHECKLIST ────────────────────────────────────────────────────────
function JardinCheck({perfil,tok,rol}){
  const isA=rol==="admin";
  const cwk=wkKey();
  const temp=getTemporada();
  const tareasTemp=JARDIN_T[temp];
  const [jsem,setJsem]=useState([]);
  const [jpunt,setJpunt]=useState([]);
  const [jfrec,setJfrec]=useState({});
  const [load,setLoad]=useState(true);
  const [saving,setSaving]=useState(false);
  const [modal,setModal]=useState(null);
  const [nota,setNota]=useState("");
  const [foto,setFoto]=useState(null);
  const [showFinal,setShowFinal]=useState(false);
  const [finalCheck,setFinalCheck]=useState({});
  const [finalMode,setFinalMode]=useState(null);
  const [finalNota,setFinalNota]=useState("");
  const [finalSaving,setFinalSaving]=useState(false);
  const [yaVerif,setYaVerif]=useState(null);
  const [historial,setHistorial]=useState([]);
  // Servicios a medida
  const [misSrvs,setMisSrvs]=useState([]);
  const [srvOpen,setSrvOpen]=useState({});
  const [srvModal,setSrvModal]=useState(null);
  const [srvNota,setSrvNota]=useState("");
  const [srvFoto,setSrvFoto]=useState(null);

  const load_=async()=>{
    try{
      const [js,jp,jf,vrf,hist,svs]=await Promise.all([
        sbGet("jardin_semana",`?semana=eq.${cwk}&select=*`,tok),
        sbGet("jardin_puntual",`?semana=eq.${cwk}&select=*`,tok),
        sbGet("jardin_frecuencias","?select=*",tok),
        sbGet("jardin_semana",`?semana=eq.${cwk}&tarea_id=eq.VERIFICACION_FINAL&select=*`,tok),
        sbGet("jardin_semana",`?tarea_id=eq.VERIFICACION_FINAL&semana=neq.${cwk}&select=*&order=semana.desc&limit=8`,tok),
        sbGet("jardin_servicios",`?select=*,jardin_servicio_tareas(*)&estado=eq.activo&jardinero_id=eq.${perfil.id}`,tok),
      ]);
      setJsem(js);setJpunt(jp);
      const fm={}; jf.forEach(x=>fm[x.tarea_id]=x.frecuencia); setJfrec(fm);
      setYaVerif(vrf[0]||null);
      setHistorial(hist);
      setMisSrvs(svs);
    }catch(_){}
    setLoad(false);
  };
  useEffect(()=>{load_();},[]);

  const sj={}; jsem.forEach(r=>sj[r.tarea_id]=r);
  const fr=jfrec;
  const actv=tareasTemp.filter(t=>tocaSemana({...t,frec:fr[t.id]||t.frec},cwk));
  const inac=tareasTemp.filter(t=>!tocaSemana({...t,frec:fr[t.id]||t.frec},cwk));
  const comp=actv.filter(t=>sj[t.id]?.done).length+jpunt.filter(t=>t.done).length;
  const tot=actv.length+jpunt.length;
  const todoHecho=tot>0&&comp===tot;

  const toggle=async(tareaId,isPunt=false)=>{
    if(saving)return;
    setSaving(true);
    try{
      if(!isPunt){
        const cur=sj[tareaId];
        const nuevoDone=!cur?.done;
        if(cur?.id){
          // Registro existe — actualizar
          await sbPatch("jardin_semana",`id=eq.${cur.id}`,{
            done:nuevoDone,
            completado_por:nuevoDone?perfil.nombre:null,
            completado_ts:nuevoDone?new Date().toISOString():null,
          },tok);
        }else{
          // Registro nuevo — crear
          await sbPost("jardin_semana",{
            semana:cwk,tarea_id:tareaId,
            done:true,
            completado_por:perfil.nombre,
            completado_ts:new Date().toISOString(),
            nota:null,foto_url:null,
          },tok);
        }
        await load_();
        if(!isA&&nuevoDone){
          const jsNew=await sbGet("jardin_semana",`?semana=eq.${cwk}&select=*`,tok);
          const sjNew={}; jsNew.forEach(r=>sjNew[r.tarea_id]=r);
          const compNew=actv.filter(t=>sjNew[t.id]?.done).length+jpunt.filter(t=>t.done).length;
          if(compNew===tot&&!yaVerif){setFinalCheck({});setFinalMode(null);setFinalNota("");setShowFinal(true);}
        }
      }else{
        const cur=jpunt.find(t=>t.id===tareaId);
        await sbPatch("jardin_puntual",`id=eq.${tareaId}`,{
          done:!cur?.done,
          completado_por:!cur?.done?perfil.nombre:null,
          completado_ts:!cur?.done?new Date().toISOString():null,
        },tok);
        await load_();
      }
    }catch(e){console.error("toggle error:",e);}
    setSaving(false);
  };

  const openNota=(id,isPunt)=>{
    const e=isPunt?jpunt.find(t=>t.id===id):(sj[id]||{});
    setNota(e?.nota||"");setFoto(e?.foto_url||null);setModal({id,isPunt});
  };

  const saveNota=async()=>{
    if(!modal||saving)return;
    if(!nota.trim()&&!foto){setModal(null);return;}
    setSaving(true);
    try{
      if(!modal.isPunt){
        const cur=sj[modal.id]||{};
        if(cur.id){
          await sbPatch("jardin_semana",`id=eq.${cur.id}`,{
            nota:nota.trim()||null,
            foto_url:foto||null,
          },tok);
        }else{
          await sbPost("jardin_semana",{
            semana:cwk,tarea_id:modal.id,
            done:false,
            completado_por:null,
            completado_ts:null,
            nota:nota.trim()||null,
            foto_url:foto||null,
          },tok);
        }
      }else{
        await sbPatch("jardin_puntual",`id=eq.${modal.id}`,{nota:nota.trim()||null,foto_url:foto||null},tok);
      }
      await load_();
    }catch(e){console.error("saveNota:",e);}
    setSaving(false);setModal(null);
  };

  const toggleSrvTarea=async(tareaId,cur)=>{
    if(saving)return;setSaving(true);
    try{
      await sbPatch("jardin_servicio_tareas",`id=eq.${tareaId}`,{
        done:!cur,completado_por:!cur?perfil.nombre:null,completado_ts:!cur?new Date().toISOString():null
      },tok);
      await load_();
    }catch(_){}setSaving(false);
  };
  const saveSrvNota=async()=>{
    if(!srvModal||saving)return;
    setSaving(true);
    try{
      await sbPatch("jardin_servicio_tareas",`id=eq.${srvModal}`,{nota:srvNota.trim()||null,foto_url:srvFoto||null},tok);
      await load_();
    }catch(_){}
    setSaving(false);setSrvModal(null);
  };
  const openSrvNota=(t)=>{setSrvNota(t.nota||"");setSrvFoto(t.foto_url||null);setSrvModal(t.id);};

  const guardarFinal=async(modo)=>{
    if(finalSaving)return;
    if(modo==="incidencia"&&!finalNota.trim())return;
    setFinalSaving(true);
    try{
      const notaFinal=modo==="ok"?`✅ Verificado OK · ${new Date().toLocaleString("es-ES")}`:`⚠️ Sin verificar: ${finalNota}`;
      await sbUpsert("jardin_semana",{semana:cwk,tarea_id:"VERIFICACION_FINAL",done:modo==="ok",completado_por:perfil.nombre,completado_ts:new Date().toISOString(),nota:notaFinal},tok);
      const admins=await sbGet("usuarios","?rol=eq.admin&select=id",tok);
      const emoji=modo==="ok"?"✅":"⚠️";
      const msg=modo==="ok"?`${emoji} ${perfil.nombre} ha verificado el jardín. Todo correcto.`:`${emoji} ${perfil.nombre} ha cerrado el jardín con incidencias: "${finalNota}"`;
      for(const a of admins){await sbPost("notificaciones",{para:a.id,txt:msg},tok);sendPush("🌾 Finca El Molino",msg,"jardin-verificacion");}
      await load_();setShowFinal(false);
    }catch(_){}
    setFinalSaving(false);
  };

  if(load)return <div className="loading"><div className="spin"/><span>Cargando…</span></div>;

  const BannerVerif=()=>{
    if(!yaVerif)return null;
    const ok=yaVerif.done;
    return <div style={{background:ok?"rgba(16,185,129,.1)":"rgba(245,158,11,.1)",border:`1px solid ${ok?"rgba(16,185,129,.3)":"rgba(245,158,11,.3)"}`,borderRadius:10,padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:10}}>
      <span style={{fontSize:20}}>{ok?"✅":"⚠️"}</span>
      <div><div style={{fontSize:13,fontWeight:600,color:ok?"#10b981":"#f59e0b"}}>{ok?"Jardín verificado esta semana":"Semana cerrada con incidencias"}</div><div style={{fontSize:11,color:"#7a7f94",marginTop:2}}>{yaVerif.nota} · {fmtDT(yaVerif.completado_ts)}</div></div>
      {!isA&&<button className="btn bg sm" style={{marginLeft:"auto",flexShrink:0}} onClick={()=>{setFinalCheck({});setFinalMode(null);setFinalNota("");setShowFinal(true);}}>Cambiar</button>}
    </div>;
  };

  return <>
    <div className="ph"><h2>{isA?"Checklist jardín":"Mi checklist"}</h2><p>{TEMPORADA_LBL[temp]} · {comp}/{tot} tareas</p></div>
    <div className="pb">
      <div className="prog" style={{marginBottom:14,height:7}}><div className="pfill" style={{width:`${tot?(comp/tot)*100:0}%`}}/></div>
      <BannerVerif/>
      {todoHecho&&!showFinal&&!isA&&(
        <div style={{marginBottom:16}}>
          <button className="btn bp" style={{width:"100%",justifyContent:"center",fontSize:15,padding:"12px"}} onClick={()=>{setFinalCheck({});setFinalMode(null);setFinalNota("");setShowFinal(true);}}>✅ Abrir control final del jardín</button>
        </div>
      )}
      {actv.length>0&&(
        <div className="card" style={{marginBottom:14}}>
          <div className="chdr"><span className="ctit">📋 Esta semana</span><span className="badge" style={{background:"rgba(16,185,129,.1)",color:"#10b981"}}>{comp}/{actv.length}</span></div>
          {actv.map(t=>{
            const e=sj[t.id]||{};
            return <div key={t.id} className={`cli${e.done?" done":""}`}>
              <div className={`chk${e.done?" on":""}`} onClick={()=>toggle(t.id)} style={{cursor:"pointer"}}/>
              <div style={{flex:1,minWidth:0}}>
                <span className="tz">{t.zona}</span>
                <div className={`tl${e.done?" done":""}`}>{t.txt}</div>
                <div className="tm" style={{color:"#6366f1"}}>🔁 {FREC_LBL[fr[t.id]||t.frec]}</div>
                {e.done&&<div className="tm">✓ {e.completado_por} · {fmtDT(e.completado_ts)}</div>}
                {e.nota&&<div className="nbox">📝 {e.nota}</div>}
                {e.foto_url&&<img src={e.foto_url} alt="" className="pthumb"/>}
                {e.resp_admin&&<div className="rbox">✅ Admin: {e.resp_admin}</div>}
              </div>
              <span className="ibtn" onClick={()=>openNota(t.id,false)}>{e.nota||e.foto_url?"✏️":"➕"}</span>
            </div>;
          })}
        </div>
      )}
      {jpunt.length>0&&(
        <div className="card" style={{marginBottom:14}}>
          <div className="chdr"><span className="ctit">⭐ Puntuales</span></div>
          {jpunt.map(t=>(
            <div key={t.id} className={`cli${t.done?" done":""}`}>
              <div className={`chk${t.done?" on":""}`} onClick={()=>toggle(t.id,true)} style={{cursor:"pointer"}}/>
              <div style={{flex:1,minWidth:0}}>
                <span className="tz">{t.zona||"General"}</span>
                <div className={`tl${t.done?" done":""}`}>{t.txt}</div>
                <div className="tm" style={{color:"#f59e0b"}}>📌 Puntual · {t.creado_por}</div>
                {t.done&&<div className="tm">✓ {t.completado_por} · {fmtDT(t.completado_ts)}</div>}
                {t.nota&&<div className="nbox">📝 {t.nota}</div>}
                {t.foto_url&&<img src={t.foto_url} alt="" className="pthumb"/>}
                {t.resp_admin&&<div className="rbox">✅ Admin: {t.resp_admin}</div>}
              </div>
              <span className="ibtn" onClick={()=>openNota(t.id,true)}>{t.nota||t.foto_url?"✏️":"➕"}</span>
            </div>
          ))}
        </div>
      )}
      {misSrvs.length>0&&misSrvs.map(s=>{const tareas=s.jardin_servicio_tareas||[];const hechas=tareas.filter(t=>t.done).length;
        const fi=new Date(s.fecha_inicio+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"});
        const ff=new Date(s.fecha_fin+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"});
        const abierto=srvOpen[s.id];
        return <div key={s.id} className="card" style={{marginBottom:14,border:"1px solid rgba(201,168,76,.2)"}}>
          <div className="chdr" onClick={()=>setSrvOpen(prev=>({...prev,[s.id]:!prev[s.id]}))} style={{cursor:"pointer"}}>
            <span className="ctit">{abierto?"▼":"▶"} 🌿 {s.nombre}</span>
            <span className="badge" style={{background:"rgba(201,168,76,.1)",color:"#c9a84c"}}>{hechas}/{tareas.length}</span>
          </div>
          <div style={{padding:"2px 0",fontSize:12,color:"#7a7f94"}}>📅 {fi} – {ff}</div>
          {abierto&&<>
            {s.notas&&<div className="nbox" style={{margin:"6px 0"}}>📝 {s.notas}</div>}
            <div className="prog" style={{margin:"8px 0",height:5}}><div className="pfill" style={{width:`${tareas.length?(hechas/tareas.length)*100:0}%`,background:"#c9a84c"}}/></div>
            {tareas.map(t=><div key={t.id} className={`cli${t.done?" done":""}`}>
              <div className={`chk${t.done?" on":""}`} onClick={()=>toggleSrvTarea(t.id,t.done)} style={{cursor:"pointer"}}/>
              <div style={{flex:1,minWidth:0}}>
                <div className={`tl${t.done?" done":""}`}>{t.txt}</div>
                {t.done&&<div className="tm">✓ {t.completado_por} · {fmtDT(t.completado_ts)}</div>}
                {t.nota&&<div className="nbox">📝 {t.nota}</div>}
                {t.foto_url&&<img src={t.foto_url} alt="" className="pthumb"/>}
              </div>
              <span className="ibtn" onClick={()=>openSrvNota(t)}>{t.nota||t.foto_url?"✏️":"➕"}</span>
            </div>)}
            {hechas===tareas.length&&tareas.length>0&&<div style={{textAlign:"center",padding:"10px 0",fontSize:13,color:"#10b981",fontWeight:600}}>✅ ¡Servicio completado!</div>}
          </>}
        </div>;
      })}
      {tot===0&&misSrvs.length===0&&<div className="empty"><span className="ico">✅</span><p>Sin tareas esta semana</p></div>}
      {inac.length>0&&(
        <div className="card" style={{opacity:.4}}>
          <div className="chdr"><span className="ctit" style={{color:"#5a5e6e"}}>⏭ No toca esta semana</span></div>
          {inac.map(t=>(
            <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
              <span style={{fontSize:13}}>⏸</span>
              <div><div style={{fontSize:12,color:"#5a5e6e"}}>{t.txt}</div><div style={{fontSize:10,color:"#3d4155"}}>🔁 {FREC_LBL[fr[t.id]||t.frec]}</div></div>
            </div>
          ))}
        </div>
      )}
      {historial.length>0&&(
        <div style={{marginTop:24}}>
          <div style={{fontSize:11,color:"#5a5e6e",textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>📁 Semanas anteriores</div>
          {historial.map(h=><SemanaArchivada key={h.id} semana={h.semana} estado={h.done} nota={h.nota}/>)}
        </div>
      )}
    </div>

    {showFinal&&!isA&&(
      <div className="ov" style={{alignItems:"flex-end",padding:0}}>
        <div style={{background:"#13161f",border:"1px solid rgba(201,168,76,.25)",borderRadius:"20px 20px 0 0",padding:"24px 20px 36px",width:"100%",maxWidth:540,maxHeight:"92vh",overflowY:"auto"}}>
          <div style={{textAlign:"center",marginBottom:20}}>
            <div style={{fontSize:36,marginBottom:8}}>🌿</div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,color:"#e8e6e1",marginBottom:4}}>¡Últimas comprobaciones!</div>
            <div style={{fontSize:13,color:"#7a7f94"}}>Has completado todas las tareas. Antes de cerrar, verifica que todo está correcto.</div>
          </div>
          {!finalMode&&(
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
              <button className="btn bp" style={{width:"100%",justifyContent:"center",padding:"14px",fontSize:15}} onClick={()=>setFinalMode("ok")}>✅ Todo correcto — verificar jardín</button>
              <button className="btn bg" style={{width:"100%",justifyContent:"center",padding:"14px",fontSize:15}} onClick={()=>setFinalMode("incidencia")}>⚠️ Hay incidencias — cerrar sin verificar</button>
            </div>
          )}
          {finalMode==="ok"&&<>
            <div style={{fontSize:12,color:"#c9a84c",fontWeight:600,marginBottom:12,textTransform:"uppercase",letterSpacing:1}}>✅ Comprueba cada punto antes de confirmar</div>
            {JARDIN_CF.map(item=>(
              <div key={item.id} onClick={()=>setFinalCheck(prev=>({...prev,[item.id]:!prev[item.id]}))}
                style={{display:"flex",alignItems:"center",gap:12,padding:"11px 12px",borderRadius:10,marginBottom:6,cursor:"pointer",background:finalCheck[item.id]?"rgba(16,185,129,.08)":"#0f1117",border:`1px solid ${finalCheck[item.id]?"rgba(16,185,129,.25)":"rgba(255,255,255,.06)"}`,transition:"all .15s"}}>
                <div style={{width:24,height:24,borderRadius:6,flexShrink:0,background:finalCheck[item.id]?"#10b981":"transparent",border:`2px solid ${finalCheck[item.id]?"#10b981":"rgba(255,255,255,.2)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"#fff",fontWeight:700}}>{finalCheck[item.id]?"✓":""}</div>
                <span style={{fontSize:14,color:finalCheck[item.id]?"#10b981":"#c9c5b8"}}>{item.txt}</span>
              </div>
            ))}
            <div style={{display:"flex",gap:8,marginTop:16}}>
              <button className="btn bg" style={{flex:1,justifyContent:"center"}} onClick={()=>setFinalMode(null)}>← Volver</button>
              <button className="btn bp" style={{flex:2,justifyContent:"center",padding:"12px",fontSize:15}} onClick={()=>guardarFinal("ok")} disabled={finalSaving}>{finalSaving?"Guardando…":"✅ Jardín terminado y verificado"}</button>
            </div>
          </>}
          {finalMode==="incidencia"&&<>
            <div style={{fontSize:13,color:"#f59e0b",fontWeight:600,marginBottom:10}}>⚠️ ¿Por qué no se ha podido completar el trabajo?</div>
            <textarea className="fi" rows={4} value={finalNota} onChange={e=>setFinalNota(e.target.value)} placeholder="Ej: Falta material para la piscina…" style={{marginBottom:14,fontSize:14,lineHeight:1.5}}/>
            <div style={{display:"flex",gap:8}}>
              <button className="btn bg" style={{flex:1,justifyContent:"center"}} onClick={()=>setFinalMode(null)}>← Volver</button>
              <button className="btn" style={{flex:2,justifyContent:"center",padding:"12px",fontSize:15,background:"#f59e0b",color:"#0f1117"}} onClick={()=>guardarFinal("incidencia")} disabled={finalSaving||!finalNota.trim()}>{finalSaving?"Guardando…":"⚠️ Cerrar con incidencias"}</button>
            </div>
          </>}
          <button onClick={()=>setShowFinal(false)} style={{background:"none",border:"none",color:"#5a5e6e",cursor:"pointer",width:"100%",textAlign:"center",marginTop:16,fontSize:12,fontFamily:"'DM Sans',sans-serif",padding:"8px"}}>Cerrar y decidir más tarde</button>
        </div>
      </div>
    )}
    {modal&&<NotaModal nota={nota} setNota={setNota} foto={foto} setFoto={setFoto} onSave={saveNota} onClose={()=>setModal(null)} tok={tok}/>}
    {srvModal&&<NotaModal nota={srvNota} setNota={setSrvNota} foto={srvFoto} setFoto={setSrvFoto} onSave={saveSrvNota} onClose={()=>setSrvModal(null)} tok={tok}/>}
  </>;
}

// ─── JARDÍN ADMIN ────────────────────────────────────────────────────────────
function JardinAdmin({perfil,tok}){
  const cwk=wkKey();
  const hoy=new Date().toISOString().split("T")[0];
  const [jsem,setJsem]=useState([]);const [jpunt,setJpunt]=useState([]);const [jfrec,setJfrec]=useState({});
  const [load,setLoad]=useState(true);const [tab,setTab]=useState("semana");const [editFr,setEditFr]=useState(null);
  const [showM,setShowM]=useState(false);const [form,setForm]=useState({txt:"",zona:"",sem:cwk});const [saving,setSaving]=useState(false);
  // Servicios a medida
  const [srvs,setSrvs]=useState([]);const [showSrv,setShowSrv]=useState(false);const [selSrv,setSelSrv]=useState(null);
  const [jardineros,setJardineros]=useState([]);
  const srvVacio={nombre:"",fecha_inicio:hoy,fecha_fin:hoy,jardinero_id:"",notas:""};
  const [srvForm,setSrvForm]=useState(srvVacio);
  const [srvTareas,setSrvTareas]=useState([]);
  const [nuevaTarea,setNuevaTarea]=useState("");
  const sems=Array.from({length:5},(_,i)=>{const d=new Date();d.setDate(d.getDate()+i*7);const k=wkKey(d);return {k,lbl:i===0?`Esta semana (${k})`:`Sem ${k.split("-W")[1]} · ${d.toLocaleDateString("es-ES",{day:"numeric",month:"short"})}`};});
  const load_=async()=>{
    const [js,jp,jf,sv,jds]=await Promise.all([
      sbGet("jardin_semana",`?semana=eq.${cwk}&select=*`,tok),
      sbGet("jardin_puntual",`?semana=eq.${cwk}&select=*`,tok),
      sbGet("jardin_frecuencias","?select=*",tok),
      sbGet("jardin_servicios","?select=*,jardin_servicio_tareas(*)&order=created_at.desc",tok),
      sbGet("usuarios","?rol=eq.jardinero&select=id,nombre",tok),
    ]);
    setJsem(js);setJpunt(jp);const fm={}; jf.forEach(x=>fm[x.tarea_id]=x.frecuencia); setJfrec(fm);
    setSrvs(sv);setJardineros(jds);setLoad(false);
  };
  useEffect(()=>{load_();},[]);
  const sj={}; jsem.forEach(r=>sj[r.tarea_id]=r);
  const getFr=t=>jfrec[t.id]||t.frec;
  const actv=JARDIN_T[getTemporada()].filter(t=>tocaSemana({...t,frec:getFr(t)},cwk));
  const addPunt=async()=>{
    if(!form.txt||saving)return;setSaving(true);
    try{
      await sbPost("jardin_puntual",{txt:form.txt,zona:form.zona,semana:form.sem,done:false,creado_por:perfil.nombre},tok);
      const us=await sbGet("usuarios","?rol=eq.jardinero&select=id",tok);
      for(const u of us){await sbPost("notificaciones",{para:u.id,txt:`Nueva tarea asignada: "${form.txt}"`},tok);sendPush("🌾 Finca El Molino",`Nueva tarea: ${form.txt}`);}
      setForm({txt:"",zona:"",sem:cwk});setShowM(false);await load_();
    }catch(_){}setSaving(false);
  };
  const delPunt=async id=>{await sbDelete("jardin_puntual",`id=eq.${id}`,tok);await load_();};
  const setFrOv=async(tareaId,v)=>{await sbUpsert("jardin_frecuencias",{tarea_id:tareaId,frecuencia:parseInt(v),updated_at:new Date().toISOString()},tok);setEditFr(null);await load_();};

  // ─ Servicios a medida ─
  const addTareaTemp=()=>{if(!nuevaTarea.trim())return;setSrvTareas(prev=>[...prev,nuevaTarea.trim()]);setNuevaTarea("");};
  const removeTareaTemp=i=>setSrvTareas(prev=>prev.filter((_,idx)=>idx!==i));
  const crearServicio=async()=>{
    if(!srvForm.nombre||!srvForm.fecha_inicio||!srvForm.fecha_fin||!srvForm.jardinero_id||srvTareas.length===0||saving)return;
    setSaving(true);
    try{
      const jd=jardineros.find(j=>j.id===srvForm.jardinero_id);
      const [srv]=await sbPost("jardin_servicios",{
        nombre:srvForm.nombre,fecha_inicio:srvForm.fecha_inicio,fecha_fin:srvForm.fecha_fin,
        jardinero_id:srvForm.jardinero_id,jardinero_nombre:jd?.nombre||"",
        estado:"activo",notas:srvForm.notas||null,creado_por:perfil.nombre
      },tok);
      for(const txt of srvTareas){await sbPost("jardin_servicio_tareas",{servicio_id:srv.id,txt,done:false},tok);}
      const fi=new Date(srvForm.fecha_inicio+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"long"});
      const ff=new Date(srvForm.fecha_fin+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"long"});
      const msg=`Nuevo servicio de jardinería: "${srvForm.nombre}" (${fi} – ${ff}). ${srvTareas.length} tareas asignadas.`;
      await sbPost("notificaciones",{para:srvForm.jardinero_id,txt:msg},tok);
      sendPush("🌿 Finca El Molino",msg,"jardin-servicio");
      setShowSrv(false);setSrvForm(srvVacio);setSrvTareas([]);await load_();
    }catch(_){}setSaving(false);
  };
  const finalizarServicio=async id=>{
    await sbPatch("jardin_servicios",`id=eq.${id}`,{estado:"completado"},tok);await load_();
  };
  const cancelarServicio=async id=>{
    await sbPatch("jardin_servicios",`id=eq.${id}`,{estado:"cancelado"},tok);await load_();
  };

  if(load)return <div className="loading"><div className="spin"/><span>Cargando…</span></div>;

  const srvsActivos=srvs.filter(s=>s.estado==="activo");
  const srvsHist=srvs.filter(s=>s.estado!=="activo");

  return <>
    <div className="ph"><h2>Gestión Jardín</h2><p>Seguimiento y planificación</p></div>
    <div className="pb">
      <div className="tabs">
        <button className={`tab${tab==="semana"?" on":""}`} onClick={()=>setTab("semana")}>Esta semana</button>
        <button className={`tab${tab==="servicios"?" on":""}`} onClick={()=>setTab("servicios")}>Servicios</button>
        <button className={`tab${tab==="frec"?" on":""}`} onClick={()=>setTab("frec")}>Frecuencias</button>
      </div>
      {tab==="semana"&&<>
        <div className="card" style={{marginBottom:14}}>
          <div className="chdr"><span className="ctit">📋 Tareas fijas</span></div>
          {actv.map(t=>{const e=sj[t.id]||{};return <div key={t.id} className={`cli${e.done?" done":""}`}>
            <span style={{fontSize:17,flexShrink:0}}>{e.done?"✅":"⬜"}</span>
            <div style={{flex:1,minWidth:0}}><span className="tz">{t.zona}</span><div className="tl">{t.txt}</div><div className="tm" style={{color:"#6366f1"}}>🔁 {FREC_LBL[getFr(t)]}</div>
              {e.done?<div className="tm">✓ {e.completado_por} · {fmtDT(e.completado_ts)}</div>:<div className="tm" style={{color:"#e85555"}}>⏳ Pendiente</div>}
              {e.nota&&<div className="nbox">📝 {e.nota}</div>}{e.foto_url&&<img src={e.foto_url} alt="" className="pthumb"/>}
            </div>
          </div>;})}
        </div>
        <div className="card">
          <div className="chdr"><span className="ctit">⭐ Puntuales</span><button className="btn bp sm" onClick={()=>setShowM(true)}>+ Asignar</button></div>
          {jpunt.length===0?<div className="empty"><span className="ico">📭</span><p>Sin puntuales</p></div>
            :jpunt.map(t=><div key={t.id} className={`cli${t.done?" done":""}`}>
              <span style={{fontSize:17,flexShrink:0}}>{t.done?"✅":"⬜"}</span>
              <div style={{flex:1,minWidth:0}}><span className="tz">{t.zona||"General"}</span><div className="tl">{t.txt}</div>{t.done?<div className="tm">✓ {t.completado_por}</div>:<div className="tm">⏳ Pendiente</div>}{t.nota&&<div className="nbox">📝 {t.nota}</div>}</div>
              <button className="btn br sm" onClick={()=>delPunt(t.id)}>🗑</button>
            </div>)}
        </div>
      </>}
      {tab==="servicios"&&<>
        <div style={{marginBottom:14}}>
          <button className="btn bp" style={{width:"100%",justifyContent:"center",padding:"12px",fontSize:15}} onClick={()=>{setSrvForm(srvVacio);setSrvTareas([]);setShowSrv(true);}}>+ Crear servicio a medida</button>
        </div>
        {srvsActivos.length===0&&srvsHist.length===0&&<div className="empty"><span className="ico">🌿</span><p>Sin servicios creados</p></div>}
        {srvsActivos.map(s=>{const tareas=s.jardin_servicio_tareas||[];const hechas=tareas.filter(t=>t.done).length;
          const fi=new Date(s.fecha_inicio+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"});
          const ff=new Date(s.fecha_fin+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"});
          const abierto=selSrv===s.id;
          return <div key={s.id} className="card" style={{marginBottom:14}}>
            <div className="chdr" onClick={()=>setSelSrv(abierto?null:s.id)} style={{cursor:"pointer"}}>
              <span className="ctit">{abierto?"▼":"▶"} 🌿 {s.nombre}</span>
              <span className="badge" style={{background:"rgba(16,185,129,.1)",color:"#10b981"}}>{hechas}/{tareas.length}</span>
            </div>
            <div style={{padding:"4px 0 0",fontSize:12,color:"#7a7f94",display:"flex",gap:12,flexWrap:"wrap"}}>
              <span>📅 {fi} – {ff}</span>
              <span>👤 {s.jardinero_nombre}</span>
            </div>
            {abierto&&<>
              <div style={{marginTop:10}}>
                {tareas.map(t=><div key={t.id} className={`cli${t.done?" done":""}`} style={{padding:"8px 0"}}>
                  <span style={{fontSize:17,flexShrink:0}}>{t.done?"✅":"⬜"}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div className="tl">{t.txt}</div>
                    {t.done?<div className="tm">✓ {t.completado_por} · {fmtDT(t.completado_ts)}</div>:<div className="tm" style={{color:"#e85555"}}>⏳ Pendiente</div>}
                    {t.nota&&<div className="nbox">📝 {t.nota}</div>}
                    {t.foto_url&&<img src={t.foto_url} alt="" className="pthumb"/>}
                  </div>
                </div>)}
              </div>
              {s.notas&&<div className="nbox" style={{marginTop:8}}>📝 {s.notas}</div>}
              <div style={{display:"flex",gap:8,marginTop:12}}>
                {hechas===tareas.length&&tareas.length>0&&<button className="btn bp sm" onClick={()=>finalizarServicio(s.id)}>✅ Finalizar</button>}
                <button className="btn br sm" onClick={()=>cancelarServicio(s.id)}>Cancelar servicio</button>
              </div>
            </>}
          </div>;
        })}
        {srvsHist.length>0&&<>
          <div style={{fontSize:11,color:"#5a5e6e",textTransform:"uppercase",letterSpacing:1.5,marginTop:20,marginBottom:10}}>📁 Historial</div>
          {srvsHist.map(s=>{const tareas=s.jardin_servicio_tareas||[];const hechas=tareas.filter(t=>t.done).length;
            const fi=new Date(s.fecha_inicio+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"});
            const ff=new Date(s.fecha_fin+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"});
            return <div key={s.id} className="card" style={{marginBottom:10,opacity:.6}}>
              <div className="chdr">
                <span className="ctit">{s.estado==="completado"?"✅":"❌"} {s.nombre}</span>
                <span className="badge" style={{background:s.estado==="completado"?"rgba(16,185,129,.1)":"rgba(232,85,85,.1)",color:s.estado==="completado"?"#10b981":"#e85555"}}>{s.estado==="completado"?"Completado":"Cancelado"}</span>
              </div>
              <div style={{fontSize:12,color:"#5a5e6e"}}>📅 {fi} – {ff} · 👤 {s.jardinero_nombre} · {hechas}/{tareas.length} tareas</div>
            </div>;
          })}
        </>}
      </>}
      {tab==="frec"&&<div className="card">
        <div className="chdr"><span className="ctit">🔁 Frecuencias</span></div>
        {JARDIN_T[getTemporada()].map(t=>{
          const f=getFr(t),activa=tocaSemana({...t,frec:f},cwk),ed=editFr===t.id;
          return <div key={t.id} style={{padding:"11px 0",borderBottom:"1px solid rgba(255,255,255,.05)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
              <div style={{minWidth:0}}><div style={{fontSize:13,color:activa?"#c9c5b8":"#5a5e6e",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.txt}</div><div style={{fontSize:11,color:"#5a5e6e"}}>{t.zona}</div></div>
              <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
                <span className="badge" style={{background:activa?"rgba(16,185,129,.1)":"rgba(255,255,255,.04)",color:activa?"#10b981":"#5a5e6e"}}>{activa?"Esta sem.":"No esta sem."}</span>
                <button className="btn bg sm" onClick={()=>setEditFr(ed?null:t.id)}>🔁 {FREC_LBL[f]}</button>
              </div>
            </div>
            {ed&&<div style={{marginTop:10,background:"rgba(201,168,76,.06)",border:"1px solid rgba(201,168,76,.15)",borderRadius:8,padding:"12px"}}><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{Object.entries(FREC_LBL).map(([v,l])=><button key={v} className={`btn sm${parseInt(v)===f?" bp":" bg"}`} onClick={()=>setFrOv(t.id,v)}>{l}</button>)}</div></div>}
          </div>;
        })}
      </div>}
    </div>
    {showM&&<div className="ov" onClick={()=>setShowM(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <h3>📌 Asignar tarea puntual</h3>
      <div className="fg"><label>Descripción *</label><input className="fi" value={form.txt} onChange={e=>setForm(v=>({...v,txt:e.target.value}))} placeholder="Ej: Limpiar la piscina"/></div>
      <div className="fg"><label>Zona</label><input className="fi" value={form.zona} onChange={e=>setForm(v=>({...v,zona:e.target.value}))} placeholder="Ej: Piscina"/></div>
      <div className="fg"><label>Semana</label><select className="fi" value={form.sem} onChange={e=>setForm(v=>({...v,sem:e.target.value}))}>{sems.map(s=><option key={s.k} value={s.k}>{s.lbl}</option>)}</select></div>
      <div className="mft"><button className="btn bg" onClick={()=>setShowM(false)}>Cancelar</button><button className="btn bp" onClick={addPunt} disabled={saving}>📌 Asignar y notificar</button></div>
    </div></div>}
    {showSrv&&<div className="ov" onClick={()=>setShowSrv(false)}><div className="modal" onClick={e=>e.stopPropagation()} style={{maxHeight:"90vh",overflowY:"auto"}}>
      <h3>🌿 Crear servicio a medida</h3>
      <div className="fg"><label>Nombre del servicio *</label><input className="fi" value={srvForm.nombre} onChange={e=>setSrvForm(v=>({...v,nombre:e.target.value}))} placeholder="Ej: Preparación jardín boda García"/></div>
      <div style={{display:"flex",gap:10}}>
        <div className="fg" style={{flex:1}}><label>Fecha inicio *</label><input className="fi" type="date" value={srvForm.fecha_inicio} onChange={e=>setSrvForm(v=>({...v,fecha_inicio:e.target.value}))}/></div>
        <div className="fg" style={{flex:1}}><label>Fecha fin *</label><input className="fi" type="date" value={srvForm.fecha_fin} onChange={e=>setSrvForm(v=>({...v,fecha_fin:e.target.value}))}/></div>
      </div>
      <div className="fg"><label>Jardinero asignado *</label><select className="fi" value={srvForm.jardinero_id} onChange={e=>setSrvForm(v=>({...v,jardinero_id:e.target.value}))}>
        <option value="">Seleccionar jardinero…</option>
        {jardineros.map(j=><option key={j.id} value={j.id}>{j.nombre}</option>)}
      </select></div>
      <div className="fg"><label>Notas (opcional)</label><textarea className="fi" rows={2} value={srvForm.notas} onChange={e=>setSrvForm(v=>({...v,notas:e.target.value}))} placeholder="Instrucciones adicionales…"/></div>
      <div className="fg">
        <label>Tareas ({srvTareas.length})</label>
        <div style={{display:"flex",gap:8}}>
          <input className="fi" style={{flex:1}} value={nuevaTarea} onChange={e=>setNuevaTarea(e.target.value)} placeholder="Escribir tarea…" onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addTareaTemp();}}}/>
          <button className="btn bp sm" onClick={addTareaTemp} style={{flexShrink:0}}>+ Añadir</button>
        </div>
        {srvTareas.length>0&&<div style={{marginTop:10}}>
          {srvTareas.map((t,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:"rgba(255,255,255,.03)",borderRadius:8,marginBottom:4}}>
            <span style={{color:"#c9a84c",fontSize:13,flexShrink:0}}>{i+1}.</span>
            <span style={{flex:1,fontSize:13,color:"#c9c5b8"}}>{t}</span>
            <button onClick={()=>removeTareaTemp(i)} style={{background:"none",border:"none",color:"#e85555",cursor:"pointer",fontSize:15,padding:"0 4px"}}>×</button>
          </div>)}
        </div>}
      </div>
      <div className="mft"><button className="btn bg" onClick={()=>setShowSrv(false)}>Cancelar</button><button className="btn bp" onClick={crearServicio} disabled={saving||!srvForm.nombre||!srvForm.jardinero_id||srvTareas.length===0}>{saving?"Creando…":"🌿 Crear y notificar"}</button></div>
    </div></div>}
  </>;
}

// ─── INCIDENCIAS ─────────────────────────────────────────────────────────────
function Incidencias({tok}){
  const [items,setItems]=useState([]);const [load,setLoad]=useState(true);
  useEffect(()=>{
    (async()=>{
      try{
        const [jsem,jpunt,stk]=await Promise.all([
          sbGet("jardin_semana","?nota=not.is.null&tarea_id=neq.VERIFICACION_FINAL&select=*",tok),
          sbGet("jardin_puntual","?nota=not.is.null&select=*",tok),
          sbGet("servicio_tareas","?nota=not.is.null&select=*,servicios(nombre)",tok),
        ]);
        const todasTareas=Object.values(JARDIN_T).flat();
        const all=[
          ...jsem.map(r=>({...r,tipo:"Jardín",tag:"🌿",tarea:todasTareas.find(t=>t.id===r.tarea_id)?.txt||r.tarea_id,zona:todasTareas.find(t=>t.id===r.tarea_id)?.zona||"—",isSemana:true})),
          ...jpunt.map(r=>({...r,tipo:"Jardín puntual",tag:"📌",tarea:r.txt,zona:r.zona||"General"})),
          ...stk.map(r=>({...r,tipo:`Limpieza: ${r.servicios?.nombre||""}`,tag:"🧹",tarea:r.txt||(LIMP_T.find(t=>t.id===r.tarea_id)?.txt)||r.tarea_id,zona:r.zona||"—"})),
        ].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
        setItems(all);
      }catch(e){console.error(e);}
      setLoad(false);
    })();
  },[]);
  const saveResp=async(item,resp)=>{
    if(item.isSemana)await sbPatch("jardin_semana",`id=eq.${item.id}`,{resp_admin:resp,resp_ts:new Date().toISOString()},tok);
    else if(item.tipo.startsWith("Jardín"))await sbPatch("jardin_puntual",`id=eq.${item.id}`,{resp_admin:resp,resp_ts:new Date().toISOString()},tok);
    else await sbPatch("servicio_tareas",`id=eq.${item.id}`,{resp_admin:resp,resp_ts:new Date().toISOString()},tok);
    setItems(prev=>prev.map(x=>x.id===item.id?{...x,resp_admin:resp}:x));
  };
  if(load)return <div className="loading"><div className="spin"/><span>Cargando…</span></div>;
  return <>
    <div className="ph"><h2>Incidencias</h2><p>{items.length} anotaciones registradas</p></div>
    <div className="pb">{items.length===0?<div className="empty"><span className="ico">✅</span><p>Sin incidencias registradas</p></div>:items.map(inc=><IncCard key={inc.id} inc={inc} onResp={saveResp}/>)}</div>
  </>;
}
function IncCard({inc,onResp}){
  const [show,setShow]=useState(false);const [reply,setReply]=useState(inc.resp_admin||"");
  const col=inc.tipo.startsWith("Limpieza")?"#6366f1":"#f59e0b";
  return <div className="card" style={{marginBottom:10,borderLeft:`3px solid ${col}`}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:10}}>
      <div style={{minWidth:0}}>
        <div style={{fontSize:14,fontWeight:600,color:"#e8e6e1",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{inc.tarea}</div>
        <div style={{display:"flex",gap:6,marginTop:5,flexWrap:"wrap"}}>
          <span className="badge" style={{background:"rgba(201,168,76,.1)",color:"#c9a84c"}}>📍 {inc.zona}</span>
          <span className="badge" style={{background:`${col}18`,color:col}}>{inc.tag} {inc.tipo}</span>
        </div>
      </div>
      <div style={{textAlign:"right",flexShrink:0,fontSize:11,color:"#5a5e6e"}}>{inc.completado_por&&<div>👤 {inc.completado_por}</div>}<div>🕐 {fmtDT(inc.completado_ts||inc.created_at)}</div></div>
    </div>
    {inc.nota&&<div className="nbox"><div style={{fontSize:10,color:"#f59e0b",fontWeight:600,marginBottom:3}}>📝 NOTA</div>{inc.nota}</div>}
    {inc.foto_url&&<img src={inc.foto_url} alt="" style={{maxWidth:"100%",maxHeight:220,borderRadius:8,marginTop:8,objectFit:"cover",display:"block"}}/>}
    {inc.resp_admin&&<div className="rbox"><div style={{fontSize:10,color:"#10b981",fontWeight:600,marginBottom:3}}>✅ RESPUESTA ADMIN</div>{inc.resp_admin}</div>}
    <div style={{marginTop:10}}><button className="btn bg sm" onClick={()=>setShow(!show)}>{inc.resp_admin?"✏️ Editar respuesta":"💬 Responder"}</button></div>
    {show&&<div style={{marginTop:9}}>
      <textarea className="fi" rows={3} value={reply} onChange={e=>setReply(e.target.value)} placeholder="Escribe tu respuesta…"/>
      <div style={{display:"flex",gap:7,marginTop:7}}><button className="btn bg sm" onClick={()=>setShow(false)}>Cancelar</button><button className="btn bp sm" onClick={()=>{onResp(inc,reply);setShow(false);}}>✓ Guardar</button></div>
    </div>}
  </div>;
}

// ─── LIMPIEZA ────────────────────────────────────────────────────────────────
const LIMP_CF = [
  {id:"cf1", txt:"Sin pelos en suelos ni baños"},
  {id:"cf2", txt:"Sin manchas en espejos ni grifos"},
  {id:"cf3", txt:"Camas perfectas, sin arrugas"},
  {id:"cf4", txt:"Cocina limpia y ordenada"},
  {id:"cf5", txt:"Casa huele bien"},
  {id:"cf6", txt:"Basura retirada"},
  {id:"cf7", txt:"Luces funcionan"},
  {id:"cf8", txt:"Puertas y ventanas cerradas"},
  {id:"cf9", txt:"Reposición completa (toallas, papel, café…)"},
];

function Limpieza({perfil,tok,rol}){
  const isA=rol==="admin";
  const isL=rol==="limpieza";
  const [servicios,setServicios]=useState([]);
  const [actId,setActId]=useState(null);
  const [tareas,setTareas]=useState([]);
  const [load,setLoad]=useState(true);
  const [saving,setSaving]=useState(false);
  const [showNew,setShowNew]=useState(false);
  const [showEx,setShowEx]=useState(false);
  const [newS,setNewS]=useState({nombre:"",fecha:new Date().toISOString().split("T")[0],limpiadora_id:"",modalidad_pago:"",tarifa_hora:"",precio_fijo_acordado:"",permuta_descripcion:""});
  const [newE,setNewE]=useState({txt:"",zona:""});
  // Limpiadoras
  const [limpiadoras,setLimpiadoras]=useState([]);
  const [limpTab,setLimpTab]=useState("servicios"); // "servicios" | "limpiadoras"
  const [showLForm,setShowLForm]=useState(false);
  const [lForm,setLForm]=useState({nombre:"",modalidad:"por_horas",tarifa_hora:"",notas:""});
  const [analLimp,setAnalLimp]=useState(null);
  const [analLData,setAnalLData]=useState(null);
  const [analLLoad,setAnalLLoad]=useState(false);
  const [notaM,setNotaM]=useState(null);
  const [nota,setNota]=useState("");
  const [foto,setFoto]=useState(null);
  // Verificación final
  const [showFinal,setShowFinal]=useState(false);
  const [finalCheck,setFinalCheck]=useState({});
  const [finalMode,setFinalMode]=useState(null);
  const [finalNota,setFinalNota]=useState("");
  const [finalSaving,setFinalSaving]=useState(false);
  // Paso hora fin
  const [finalStep,setFinalStep]=useState("check"); // "check" | "hora"
  const [horaFin,setHoraFin]=useState("");
  const [tarifaHora,setTarifaHora]=useState(0);
  const [horasCalc,setHorasCalc]=useState(0);
  const [costeCalc,setCosteCalc]=useState(0);

  const loadSrvs=async()=>{
    const [s,limps]=await Promise.all([
      sbGet("servicios","?select=*&order=fecha.desc",tok),
      isA?sbGet("limpiadoras","?select=*&order=nombre.asc",tok).catch(()=>[]):Promise.resolve([]),
    ]);
    setServicios(s);setLimpiadoras(limps);
    if(!isA&&s.length>0&&!actId)setActId(s[0].id);
    setLoad(false);
  };
  const loadTareas=async sid=>{
    if(!sid)return;
    const t=await sbGet("servicio_tareas",`?servicio_id=eq.${sid}&select=*`,tok);
    setTareas(t);
  };
  useEffect(()=>{loadSrvs();},[]);
  useEffect(()=>{if(actId)loadTareas(actId);},[actId]);

  const crearSrv=async()=>{
    if(!newS.nombre||saving)return;setSaving(true);
    try{
      const limpSel=limpiadoras.find(l=>String(l.id)===String(newS.limpiadora_id));
      const srvData={nombre:newS.nombre,fecha:newS.fecha,creado_por:perfil.nombre};
      if(newS.limpiadora_id){
        srvData.limpiadora_id=newS.limpiadora_id;
        srvData.limpiadora_nombre=limpSel?.nombre||"";
        srvData.modalidad_pago=newS.modalidad_pago||null;
        if(newS.modalidad_pago==="por_horas")srvData.tarifa_hora_aplicada=parseFloat(newS.tarifa_hora)||null;
        if(newS.modalidad_pago==="precio_fijo_servicio")srvData.precio_fijo_acordado=parseFloat(newS.precio_fijo_acordado)||null;
        if(newS.modalidad_pago==="permuta")srvData.permuta_descripcion=newS.permuta_descripcion||null;
      }
      const [srv]=await sbPost("servicios",srvData,tok);
      for(const t of LIMP_T)await sbPost("servicio_tareas",{servicio_id:srv.id,tarea_id:t.id,zona:t.zona,es_extra:false},tok);
      const us=await sbGet("usuarios","?rol=eq.limpieza&select=id",tok);
      for(const u of us){await sbPost("notificaciones",{para:u.id,txt:`Nuevo servicio: "${newS.nombre}" — ${new Date(newS.fecha).toLocaleDateString("es-ES")}`},tok);sendPush("🌾 Finca El Molino",`Nuevo servicio: ${newS.nombre}`);}
      setActId(srv.id);setShowNew(false);setNewS({nombre:"",fecha:new Date().toISOString().split("T")[0],limpiadora_id:"",modalidad_pago:"",tarifa_hora:"",precio_fijo_acordado:"",permuta_descripcion:""});await loadSrvs();
    }catch(_){}setSaving(false);
  };

  const toggleT=async tareaId=>{
    if(isA||saving)return;
    setSaving(true);
    const cur=tareas.find(t=>t.id===tareaId);
    const nuevoDone=!cur?.done;
    await sbPatch("servicio_tareas",`id=eq.${tareaId}`,{
      done:nuevoDone,
      completado_por:nuevoDone?perfil.nombre:null,
      completado_ts:nuevoDone?new Date().toISOString():null,
    },tok);
    await loadTareas(actId);
    // Comprobar si están todas hechas para abrir verificación
    const updated=await sbGet("servicio_tareas",`?servicio_id=eq.${actId}&select=*`,tok);
    const srv=servicios.find(s=>s.id===actId);
    const yaVerif=srv?.verificado;
    const todas=updated.every(t=>t.done);
    if(todas&&!yaVerif&&!isA){
      setFinalCheck({});setFinalMode(null);setFinalNota("");setFinalStep("check");setShowFinal(true);
    }
    setSaving(false);
  };

  const addExtra=async()=>{
    if(!actId||!newE.txt||saving)return;setSaving(true);
    await sbPost("servicio_tareas",{servicio_id:actId,txt:newE.txt,zona:newE.zona,es_extra:true,done:false,creado_por:perfil.nombre},tok);
    setNewE({txt:"",zona:""});setShowEx(false);await loadTareas(actId);setSaving(false);
  };

  const saveNota=async()=>{
    if(!notaM||saving)return;setSaving(true);
    await sbPatch("servicio_tareas",`id=eq.${notaM.id}`,{nota,foto_url:foto||null},tok);
    setNotaM(null);await loadTareas(actId);setSaving(false);
  };
  const openN=t=>{setNota(t.nota||"");setFoto(t.foto_url||null);setNotaM(t);};

  const iniciarServicio=async()=>{
    if(!actId||saving)return;
    setSaving(true);
    const ahora=new Date();
    const hi=`${String(ahora.getHours()).padStart(2,"0")}:${String(ahora.getMinutes()).padStart(2,"0")}`;
    try{
      await sbPatch("servicios",`id=eq.${actId}`,{hora_inicio:hi},tok);
      await loadSrvs();
    }catch(_){}
    setSaving(false);
  };

  const prepararPasoHora=async()=>{
    const ahora=new Date();
    const hfDefault=`${String(ahora.getHours()).padStart(2,"0")}:${String(ahora.getMinutes()).padStart(2,"0")}`;
    setHoraFin(hfDefault);
    const srv_=servicios.find(s=>s.id===actId);
    const mod=srv_?.modalidad_pago||"por_horas";
    // Tarifa: de la limpiadora asignada o fallback a configuracion
    let tarifa=0;
    if(mod==="por_horas"){
      if(srv_?.tarifa_hora_aplicada)tarifa=parseFloat(srv_.tarifa_hora_aplicada);
      else if(srv_?.limpiadora_id){
        const limp=limpiadoras.find(l=>String(l.id)===String(srv_.limpiadora_id));
        if(limp?.tarifa_hora)tarifa=parseFloat(limp.tarifa_hora);
      }
      if(!tarifa){
        try{const cfgRows=await sbGet("configuracion","?select=*",tok).catch(()=>[]);const cfg={};cfgRows.forEach(c=>cfg[c.clave]=c.valor);tarifa=parseFloat(cfg.tarifa_hora_limpiadora)||0;}catch(_){}
      }
    }
    setTarifaHora(tarifa);
    // Calcular horas
    const horaInicioStr=srv_?.hora_inicio||null;
    const createdAt=srv_?.created_at||null;
    let hIni=null;
    if(horaInicioStr){
      const [h,m]=horaInicioStr.split(":").map(Number);
      hIni=h+m/60;
    }else if(createdAt){
      const d=new Date(createdAt);
      hIni=d.getHours()+d.getMinutes()/60;
    }
    const [hfH,hfM]=hfDefault.split(":").map(Number);
    const hFin=hfH+hfM/60;
    const horas=hIni!==null?Math.max(0,Math.round((hFin-hIni)*100)/100):0;
    setHorasCalc(horas);
    // Coste según modalidad
    if(mod==="permuta"){setCosteCalc(0);}
    else if(mod==="precio_fijo_servicio"){setCosteCalc(parseFloat(srv_?.precio_fijo_acordado)||0);}
    else{setCosteCalc(tarifa>0?Math.round(horas*tarifa*100)/100:0);}
    setFinalStep("hora");
  };

  const recalcHora=(newHoraFin)=>{
    setHoraFin(newHoraFin);
    const srv_=servicios.find(s=>s.id===actId);
    const horaInicioStr=srv_?.hora_inicio||null;
    const createdAt=srv_?.created_at||null;
    let hIni=null;
    if(horaInicioStr){
      const [h,m]=horaInicioStr.split(":").map(Number);
      hIni=h+m/60;
    }else if(createdAt){
      const d=new Date(createdAt);
      hIni=d.getHours()+d.getMinutes()/60;
    }
    const [hfH,hfM]=newHoraFin.split(":").map(Number);
    const hFin=hfH+hfM/60;
    const horas=hIni!==null?Math.max(0,Math.round((hFin-hIni)*100)/100):0;
    setHorasCalc(horas);
    setCosteCalc(tarifaHora>0?Math.round(horas*tarifaHora*100)/100:0);
  };

  const guardarFinal=async(modo)=>{
    if(finalSaving)return;
    if(modo==="ok"){
      await prepararPasoHora();
      return;
    }
    if(modo==="incidencia"&&!finalNota.trim())return;
    setFinalSaving(true);
    try{
      const notaFinal=`⚠️ Con incidencias: ${finalNota}`;
      await sbPatch("servicios",`id=eq.${actId}`,{
        verificado:true,
        verificado_ok:false,
        verificado_nota:notaFinal,
        verificado_por:perfil.nombre,
        verificado_ts:new Date().toISOString(),
      },tok);
      const admins=await sbGet("usuarios","?rol=eq.admin&select=id",tok);
      const srv=servicios.find(s=>s.id===actId);
      const msg=`⚠️ ${perfil.nombre} ha cerrado "${srv?.nombre}" con incidencias: "${finalNota}"`;
      for(const a of admins){
        await sbPost("notificaciones",{para:a.id,txt:msg},tok);
        sendPush("🌾 Finca El Molino",msg,"limpieza-verificacion");
      }
      await loadSrvs();
      setShowFinal(false);setFinalStep("check");
    }catch(_){}
    setFinalSaving(false);
  };

  const confirmarConHora=async()=>{
    if(finalSaving)return;
    setFinalSaving(true);
    try{
      const hoyStr=new Date().toISOString().split("T")[0];
      const notaFinal=`✅ Verificado OK · ${new Date().toLocaleString("es-ES")} · ${horasCalc}h`;
      const patchData={
        verificado:true,
        verificado_ok:true,
        verificado_nota:notaFinal,
        verificado_por:perfil.nombre,
        verificado_ts:new Date().toISOString(),
        hora_fin:horaFin,
        coste_calculado:costeCalc||null,
        tarifa_hora_aplicada:tarifaHora||null,
      };
      await sbPatch("servicios",`id=eq.${actId}`,patchData,tok).catch(()=>{
        // Si campos no existen, reintentar sin ellos
        return sbPatch("servicios",`id=eq.${actId}`,{verificado:true,verificado_ok:true,verificado_nota:notaFinal,verificado_por:perfil.nombre,verificado_ts:new Date().toISOString()},tok);
      });
      // Insertar gasto según modalidad
      const srv_g=servicios.find(s=>s.id===actId);
      const mod=srv_g?.modalidad_pago||"por_horas";
      const fechaFmt=new Date(srv_g?.fecha+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"});
      if(mod==="permuta"){
        await sbPost("gastos",{fecha:hoyStr,categoria:"Personal",concepto:`Permuta: ${srv_g?.permuta_descripcion||"Limpieza"} - ${srv_g?.nombre||"Servicio"} - ${fechaFmt}`,importe:0,origen:"auto_limpieza"},tok).catch(()=>{});
      }else if(mod==="precio_fijo_servicio"&&costeCalc>0){
        await sbPost("gastos",{fecha:hoyStr,categoria:"Personal",concepto:`Limpieza - ${srv_g?.nombre||"Servicio"} - ${fechaFmt}`,importe:costeCalc,origen:"auto_limpieza"},tok).catch(()=>{});
      }else if(tarifaHora>0&&costeCalc>0){
        await sbPost("gastos",{fecha:hoyStr,categoria:"Personal",concepto:`Limpieza - ${srv_g?.nombre||"Servicio"} - ${fechaFmt}`,importe:costeCalc,origen:"auto_limpieza"},tok).catch(()=>{});
      }
      const admins=await sbGet("usuarios","?rol=eq.admin&select=id",tok);
      const srv=servicios.find(s=>s.id===actId);
      const costoTxt=tarifaHora>0?` (${horasCalc}h × ${tarifaHora}€ = ${costeCalc}€)`:"";
      const msg=`✅ ${perfil.nombre} ha verificado el servicio "${srv?.nombre}". Todo listo.${costoTxt}`;
      for(const a of admins){
        await sbPost("notificaciones",{para:a.id,txt:msg},tok);
        sendPush("🌾 Finca El Molino",msg,"limpieza-verificacion");
      }
      await loadSrvs();
      setShowFinal(false);setFinalStep("check");
    }catch(_){}
    setFinalSaving(false);
  };

  const openN2=t=>{setNota(t.nota||"");setFoto(t.foto_url||null);setNotaM(t);};

  // Limpiadoras CRUD
  const crearLimpiadora=async()=>{
    if(!lForm.nombre||saving)return;setSaving(true);
    try{
      await sbPost("limpiadoras",{nombre:lForm.nombre,modalidad:lForm.modalidad,tarifa_hora:lForm.modalidad==="por_horas"?parseFloat(lForm.tarifa_hora)||null:null,notas:lForm.notas||null,activa:true},tok);
      setShowLForm(false);setLForm({nombre:"",modalidad:"por_horas",tarifa_hora:"",notas:""});await loadSrvs();
    }catch(_){}setSaving(false);
  };
  const toggleLimpActiva=async l=>{await sbPatch("limpiadoras",`id=eq.${l.id}`,{activa:!l.activa},tok);await loadSrvs();};
  const verAnalLimp=async l=>{
    if(analLimp?.id===l.id){setAnalLimp(null);return;}
    setAnalLimp(l);setAnalLLoad(true);setAnalLData(null);
    try{
      const añoActual=new Date().getFullYear();
      const srvs=await sbGet("servicios",`?limpiadora_id=eq.${l.id}&fecha=gte.${añoActual}-01-01&select=*`,tok).catch(()=>[]);
      const totalSrvs=srvs.length;
      let horasTotal=0,costeTotal=0;
      const permutas=[];
      for(const s of srvs){
        if(s.hora_inicio&&s.hora_fin){
          const [h1,m1]=s.hora_inicio.split(":").map(Number);
          const [h2,m2]=s.hora_fin.split(":").map(Number);
          horasTotal+=Math.max(0,(h2+m2/60)-(h1+m1/60));
        }
        costeTotal+=parseFloat(s.coste_calculado)||0;
        if(s.modalidad_pago==="permuta")permutas.push(s.permuta_descripcion||`Permuta - ${s.nombre}`);
      }
      const euroHoraReal=horasTotal>0?Math.round(costeTotal/horasTotal*100)/100:0;
      setAnalLData({totalSrvs,horasTotal:Math.round(horasTotal*10)/10,costeTotal:Math.round(costeTotal),euroHoraReal,permutas});
    }catch(_){}
    setAnalLLoad(false);
  };
  const selLimpiadora=(id)=>{
    const l=limpiadoras.find(x=>String(x.id)===String(id));
    setNewS(prev=>({...prev,limpiadora_id:id,modalidad_pago:l?.modalidad||"por_horas",tarifa_hora:l?.modalidad==="por_horas"?String(l?.tarifa_hora||""):""}));
  };

  if(load)return <div className="loading"><div className="spin"/><span>Cargando…</span></div>;
  if(!isA&&servicios.length===0)return <><div className="ph"><h2>Mi servicio</h2></div><div className="pb"><div className="empty"><span className="ico">🧹</span><p>Sin servicios asignados todavía</p></div></div></>;

  const srv=servicios.find(s=>s.id===actId);
  const fijas=tareas.filter(t=>!t.es_extra);
  const extras=tareas.filter(t=>t.es_extra);
  const comp=tareas.filter(t=>t.done).length;
  const tot=tareas.length;
  const todoHecho=tot>0&&comp===tot;
  const yaVerif=srv?.verificado;

  return <>
    <div className="ph"><h2>{isA?"Gestión limpieza":"Mi servicio"}</h2></div>
    <div className="pb">
      {isA&&<div className="tabs" style={{marginBottom:14}}>
        <button className={`tab${limpTab==="servicios"?" on":""}`} onClick={()=>setLimpTab("servicios")}>🧹 Servicios</button>
        <button className={`tab${limpTab==="limpiadoras"?" on":""}`} onClick={()=>setLimpTab("limpiadoras")}>👤 Limpiadoras ({limpiadoras.length})</button>
      </div>}

      {/* ── TAB LIMPIADORAS (solo admin) ── */}
      {isA&&limpTab==="limpiadoras"&&<>
        <div style={{marginBottom:14}}><button className="btn bp" onClick={()=>{setLForm({nombre:"",modalidad:"por_horas",tarifa_hora:"",notas:""});setShowLForm(true);}}>➕ Nueva limpiadora</button></div>
        {limpiadoras.length===0?<div className="empty"><span className="ico">🧹</span><p>Sin limpiadoras registradas</p></div>
        :limpiadoras.map(l=>{
          const modLbl={por_horas:"Por horas",precio_fijo_servicio:"Precio fijo",permuta:"Permuta"}[l.modalidad]||l.modalidad;
          const tarifaLbl=l.tarifa_hora&&l.modalidad==="por_horas"?`${l.tarifa_hora}€/h`:"—";
          const abierto=analLimp?.id===l.id;
          return <div key={l.id} className="card" style={{marginBottom:10,borderLeft:`3px solid ${l.activa?"#6366f1":"#5a5e6e"}`,opacity:l.activa?1:.6}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:15,fontWeight:600,color:"#e8e6e1"}}>{l.nombre}</div>
                <div style={{display:"flex",gap:6,marginTop:5,flexWrap:"wrap"}}>
                  <span className="badge" style={{background:"rgba(99,102,241,.1)",color:"#a5b4fc"}}>{modLbl}</span>
                  <span className="badge" style={{background:"rgba(255,255,255,.06)",color:"#7a7f94"}}>{tarifaLbl}</span>
                  <span className="badge" style={{background:l.activa?"rgba(16,185,129,.1)":"rgba(107,114,128,.1)",color:l.activa?"#10b981":"#6b7280"}}>{l.activa?"Activa":"Inactiva"}</span>
                </div>
                {l.notas&&<div style={{fontSize:11,color:"#5a5e6e",marginTop:4}}>{l.notas}</div>}
              </div>
              <div style={{display:"flex",gap:6,flexShrink:0}}>
                <button className="btn bg sm" onClick={()=>verAnalLimp(l)}>{abierto?"▲":"📊"}</button>
                <button className="btn bg sm" onClick={()=>toggleLimpActiva(l)}>{l.activa?"Desactivar":"Activar"}</button>
              </div>
            </div>
            {abierto&&<div style={{marginTop:14,paddingTop:14,borderTop:"1px solid rgba(255,255,255,.06)"}}>
              {analLLoad?<div style={{color:"#5a5e6e",fontSize:13}}>Cargando…</div>
              :analLData?<>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:8,marginBottom:10}}>
                  <div style={{background:"#0f1117",borderRadius:8,padding:"10px 12px"}}><div style={{fontSize:10,color:"#5a5e6e"}}>SERVICIOS AÑO</div><div style={{fontSize:18,fontWeight:700,color:"#c9a84c",marginTop:3}}>{analLData.totalSrvs}</div></div>
                  <div style={{background:"#0f1117",borderRadius:8,padding:"10px 12px"}}><div style={{fontSize:10,color:"#5a5e6e"}}>HORAS TOTAL</div><div style={{fontSize:18,fontWeight:700,color:"#c9a84c",marginTop:3}}>{analLData.horasTotal}h</div></div>
                  <div style={{background:"#0f1117",borderRadius:8,padding:"10px 12px"}}><div style={{fontSize:10,color:"#5a5e6e"}}>COSTE TOTAL</div><div style={{fontSize:18,fontWeight:700,color:"#e85555",marginTop:3}}>{analLData.costeTotal}€</div></div>
                  <div style={{background:"#0f1117",borderRadius:8,padding:"10px 12px"}}><div style={{fontSize:10,color:"#5a5e6e"}}>💡 €/HORA REAL</div><div style={{fontSize:18,fontWeight:700,color:"#6366f1",marginTop:3}}>{analLData.euroHoraReal>0?`${analLData.euroHoraReal}€`:"—"}</div></div>
                </div>
                {analLData.permutas.length>0&&<div style={{marginTop:8}}>
                  <div style={{fontSize:10,color:"#c9a84c",fontWeight:600,textTransform:"uppercase",letterSpacing:.5,marginBottom:6}}>Permutas</div>
                  {analLData.permutas.map((p,i)=><div key={i} style={{fontSize:12,color:"#7a7f94",padding:"4px 0"}}>🔄 {p}</div>)}
                </div>}
              </>:<div style={{color:"#5a5e6e",fontSize:13}}>Sin datos</div>}
            </div>}
          </div>;
        })}
      </>}

      {/* ── TAB SERVICIOS ── */}
      {(isA?limpTab==="servicios":true)&&<div className="g2" style={{alignItems:"flex-start"}}>
        {/* LISTA SERVICIOS */}
        <div>
          <div className="chdr" style={{marginBottom:12}}>
            <span className="ctit">Servicios</span>
            {isA&&<button className="btn bp sm" onClick={()=>setShowNew(true)}>+ Nuevo</button>}
          </div>
          {servicios.map(s=>{
            const vOk=s.verificado&&s.verificado_ok;
            const vInc=s.verificado&&!s.verificado_ok;
            return <div key={s.id} className="card" style={{marginBottom:8,cursor:"pointer",borderColor:actId===s.id?"rgba(201,168,76,.35)":undefined}} onClick={()=>setActId(s.id)}>
              <div style={{fontSize:13,fontWeight:600,color:"#c9a84c",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>🧹 {s.nombre}</div>
              <div style={{fontSize:11,color:"#7a7f94",marginTop:3}}>📅 {new Date(s.fecha).toLocaleDateString("es-ES")}</div>
              {s.verificado&&<div style={{marginTop:5,fontSize:11,color:vOk?"#10b981":"#f59e0b",fontWeight:600}}>{vOk?"✅ Verificado":"⚠️ Con incidencias"}</div>}
            </div>;
          })}
        </div>

        {/* DETALLE SERVICIO */}
        {srv&&<div>
          {/* Banner verificado */}
          {yaVerif&&<div style={{background:srv.verificado_ok?"rgba(16,185,129,.1)":"rgba(245,158,11,.1)",border:`1px solid ${srv.verificado_ok?"rgba(16,185,129,.3)":"rgba(245,158,11,.3)"}`,borderRadius:10,padding:"12px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:20}}>{srv.verificado_ok?"✅":"⚠️"}</span>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:srv.verificado_ok?"#10b981":"#f59e0b"}}>{srv.verificado_ok?"Servicio verificado":"Cerrado con incidencias"}</div>
              <div style={{fontSize:11,color:"#7a7f94",marginTop:2}}>{srv.verificado_nota}</div>
            </div>
          </div>}

          {/* Cabecera servicio */}
          <div style={{background:"rgba(201,168,76,.08)",border:"1px solid rgba(201,168,76,.15)",borderRadius:10,padding:"12px 16px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
            <div style={{minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,color:"#c9a84c",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>🧹 {srv.nombre}</div>
              <div style={{fontSize:11,color:"#7a7f94"}}>{new Date(srv.fecha).toLocaleDateString("es-ES")} · {comp}/{tot} tareas</div>
            </div>
            {isA&&<div style={{display:"flex",gap:6,flexShrink:0}}>
              <button className="btn bg sm" onClick={()=>setShowEx(true)}>+ Extra</button>
              <button className="btn br sm" onClick={async()=>{if(!window.confirm(`¿Eliminar "${srv.nombre}"?`))return;await sbDelete("servicio_tareas",`servicio_id=eq.${srv.id}`,tok);await sbDelete("servicios",`id=eq.${srv.id}`,tok);setActId(null);setTareas([]);await loadSrvs();}}>🗑</button>
            </div>}
          </div>

          {/* Hora inicio — limpiadora */}
          {isL&&!yaVerif&&<>
            {!srv.hora_inicio?(
              <button className="btn bp" style={{width:"100%",justifyContent:"center",padding:"14px",fontSize:15,marginBottom:14}} onClick={iniciarServicio} disabled={saving}>▶️ Iniciar servicio</button>
            ):(
              <div style={{background:"rgba(16,185,129,.08)",border:"1px solid rgba(16,185,129,.2)",borderRadius:10,padding:"10px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:18}}>⏱️</span>
                <div style={{fontSize:13,color:"#10b981",fontWeight:500}}>En curso desde las <strong>{srv.hora_inicio?.slice(0,5)}</strong></div>
              </div>
            )}
          </>}

          {/* Barra progreso */}
          <div className="prog" style={{marginBottom:14,height:7}}>
            <div className="pfill" style={{width:`${tot?(comp/tot)*100:0}%`}}/>
          </div>

          {/* Botón verificación si todo hecho y no verificado */}
          {!isA&&todoHecho&&!yaVerif&&(
            <div style={{marginBottom:14}}>
              <button className="btn bp" style={{width:"100%",justifyContent:"center",fontSize:15,padding:"12px"}} onClick={()=>{setFinalCheck({});setFinalMode(null);setFinalNota("");setFinalStep("check");setShowFinal(true);}}>
                ✅ Abrir verificación final del servicio
              </button>
            </div>
          )}

          {/* TAREAS FIJAS */}
          {fijas.map(t=>(
            <div key={t.id} className={`cli${t.done?" done":""}`}>
              {!isA
                ?<div className={`chk${t.done?" on":""}`} onClick={()=>toggleT(t.id)} style={{cursor:"pointer"}}/>
                :<span style={{fontSize:17,flexShrink:0}}>{t.done?"✅":"⬜"}</span>}
              <div style={{flex:1,minWidth:0}}>
                <span className="tz">{t.zona}</span>
                <div className={`tl${t.done?" done":""}`}>{LIMP_T.find(x=>x.id===t.tarea_id)?.txt||t.txt}</div>
                {t.done&&<div className="tm">✓ {t.completado_por} · {fmtDT(t.completado_ts)}</div>}
                {t.nota&&<div className="nbox">📝 {t.nota}</div>}
                {t.foto_url&&<img src={t.foto_url} alt="" className="pthumb"/>}
              </div>
              <span className="ibtn" onClick={()=>openN2(t)}>{t.nota||t.foto_url?"✏️":"➕"}</span>
            </div>
          ))}

          {/* EXTRAS */}
          {extras.length>0&&<>
            <hr className="div"/>
            <div style={{fontSize:12,color:"#c9a84c",fontWeight:600,marginBottom:9}}>⭐ Extras</div>
            {extras.map(t=>(
              <div key={t.id} className={`cli${t.done?" done":""}`}>
                {!isA
                  ?<div className={`chk${t.done?" on":""}`} onClick={()=>toggleT(t.id)} style={{cursor:"pointer"}}/>
                  :<span style={{fontSize:17,flexShrink:0}}>{t.done?"✅":"⬜"}</span>}
                <div style={{flex:1,minWidth:0}}>
                  <span className="tz">{t.zona||"General"}</span>
                  <div className={`tl${t.done?" done":""}`}>{t.txt}</div>
                  {t.done&&<div className="tm">✓ {t.completado_por}</div>}
                  {t.nota&&<div className="nbox">📝 {t.nota}</div>}
                </div>
                <span className="ibtn" onClick={()=>openN2(t)}>{t.nota||t.foto_url?"✏️":"➕"}</span>
              </div>
            ))}
          </>}
        </div>}
      </div>}
    </div>

    {/* MODAL NUEVO SERVICIO */}
    {showNew&&<div className="ov" onClick={()=>setShowNew(false)}>
      <div className="modal" style={{maxHeight:"90vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <h3>🧹 Nuevo servicio</h3>
        <div className="fg"><label>Nombre *</label><input className="fi" value={newS.nombre} onChange={e=>setNewS(v=>({...v,nombre:e.target.value}))} placeholder="Ej: Limpieza post-boda García"/></div>
        <div className="fg"><label>Fecha</label><input type="date" className="fi" value={newS.fecha} onChange={e=>setNewS(v=>({...v,fecha:e.target.value}))}/></div>
        {limpiadoras.length>0&&<>
          <div className="fg"><label>Limpiadora</label>
            <select className="fi" value={newS.limpiadora_id} onChange={e=>selLimpiadora(e.target.value)}>
              <option value="">Sin asignar</option>
              {limpiadoras.filter(l=>l.activa).map(l=><option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select>
          </div>
          {newS.limpiadora_id&&<>
            <div className="fg"><label>Modalidad de pago</label>
              <select className="fi" value={newS.modalidad_pago} onChange={e=>setNewS(v=>({...v,modalidad_pago:e.target.value}))}>
                <option value="por_horas">Por horas</option>
                <option value="precio_fijo_servicio">Precio fijo</option>
                <option value="permuta">Permuta</option>
              </select>
            </div>
            {newS.modalidad_pago==="por_horas"&&<div className="fg"><label>Tarifa €/hora</label><input type="number" inputMode="decimal" className="fi" value={newS.tarifa_hora} onChange={e=>setNewS(v=>({...v,tarifa_hora:e.target.value}))} placeholder="Ej: 12"/></div>}
            {newS.modalidad_pago==="precio_fijo_servicio"&&<div className="fg"><label>Importe acordado (€)</label><input type="number" inputMode="decimal" className="fi" value={newS.precio_fijo_acordado} onChange={e=>setNewS(v=>({...v,precio_fijo_acordado:e.target.value}))} placeholder="Ej: 80"/></div>}
            {newS.modalidad_pago==="permuta"&&<div className="fg"><label>Descripción del acuerdo</label><input className="fi" value={newS.permuta_descripcion} onChange={e=>setNewS(v=>({...v,permuta_descripcion:e.target.value}))} placeholder="Ej: 1 noche en la casa"/></div>}
          </>}
        </>}
        <div className="mft"><button className="btn bg" onClick={()=>setShowNew(false)}>Cancelar</button><button className="btn bp" onClick={crearSrv} disabled={saving}>Crear y notificar</button></div>
      </div>
    </div>}

    {/* MODAL EXTRA */}
    {showEx&&<div className="ov" onClick={()=>setShowEx(false)}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <h3>➕ Tarea extra</h3>
        <div className="fg"><label>Descripción</label><input className="fi" value={newE.txt} onChange={e=>setNewE(v=>({...v,txt:e.target.value}))} placeholder="Ej: Limpiar terraza exterior"/></div>
        <div className="fg"><label>Zona</label><input className="fi" value={newE.zona} onChange={e=>setNewE(v=>({...v,zona:e.target.value}))} placeholder="Ej: Exterior"/></div>
        <div className="mft"><button className="btn bg" onClick={()=>setShowEx(false)}>Cancelar</button><button className="btn bp" onClick={addExtra} disabled={saving}>Añadir</button></div>
      </div>
    </div>}

    {/* MODAL NUEVA LIMPIADORA */}
    {showLForm&&<div className="ov" onClick={()=>setShowLForm(false)}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <h3>🧹 Nueva limpiadora</h3>
        <div className="fg"><label>Nombre *</label><input className="fi" value={lForm.nombre} onChange={e=>setLForm(v=>({...v,nombre:e.target.value}))} placeholder="Ej: María López"/></div>
        <div className="fg"><label>Modalidad</label><select className="fi" value={lForm.modalidad} onChange={e=>setLForm(v=>({...v,modalidad:e.target.value}))}>
          <option value="por_horas">Por horas</option>
          <option value="precio_fijo_servicio">Precio fijo por servicio</option>
          <option value="permuta">Permuta</option>
        </select></div>
        {lForm.modalidad==="por_horas"&&<div className="fg"><label>Tarifa €/hora</label><input type="number" inputMode="decimal" className="fi" value={lForm.tarifa_hora} onChange={e=>setLForm(v=>({...v,tarifa_hora:e.target.value}))} placeholder="Ej: 12"/></div>}
        {lForm.modalidad==="permuta"&&<div style={{fontSize:12,color:"#7a7f94",marginBottom:14,background:"rgba(201,168,76,.06)",borderRadius:8,padding:"10px 12px"}}>El acuerdo de permuta se define por cada servicio.</div>}
        <div className="fg"><label>Notas (opcional)</label><textarea className="fi" rows={2} value={lForm.notas} onChange={e=>setLForm(v=>({...v,notas:e.target.value}))} placeholder="Notas…"/></div>
        <div className="mft"><button className="btn bg" onClick={()=>setShowLForm(false)}>Cancelar</button><button className="btn bp" onClick={crearLimpiadora} disabled={saving||!lForm.nombre}>{saving?"Guardando…":"🧹 Crear"}</button></div>
      </div>
    </div>}

    {/* NOTA INCIDENCIA */}
    {notaM&&<NotaModal nota={nota} setNota={setNota} foto={foto} setFoto={setFoto} onSave={saveNota} onClose={()=>setNotaM(null)} tok={tok}/>}
    {/* MODAL VERIFICACIÓN FINAL */}
    {showFinal&&!isA&&(
      <div className="ov" style={{alignItems:"flex-end",padding:0}}>
        <div style={{background:"#13161f",border:"1px solid rgba(201,168,76,.25)",borderRadius:"20px 20px 0 0",padding:"24px 20px 36px",width:"100%",maxWidth:540,maxHeight:"92vh",overflowY:"auto"}}>
          <div style={{textAlign:"center",marginBottom:20}}>
            <div style={{fontSize:36,marginBottom:8}}>🧹</div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,color:"#e8e6e1",marginBottom:4}}>¡Comprobación final!</div>
            <div style={{fontSize:13,color:"#7a7f94"}}>Has completado todas las tareas. Verifica que la casa está perfecta antes de cerrar.</div>
          </div>

          {!finalMode&&(
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
              <button className="btn bp" style={{width:"100%",justifyContent:"center",padding:"14px",fontSize:15}} onClick={()=>setFinalMode("ok")}>✅ Todo correcto — casa lista</button>
              <button className="btn bg" style={{width:"100%",justifyContent:"center",padding:"14px",fontSize:15}} onClick={()=>setFinalMode("incidencia")}>⚠️ Hay incidencias — cerrar con nota</button>
            </div>
          )}

          {finalMode==="ok"&&finalStep==="check"&&<>
            <div style={{fontSize:12,color:"#c9a84c",fontWeight:600,marginBottom:12,textTransform:"uppercase",letterSpacing:1}}>✅ Marca cada punto antes de confirmar</div>
            {LIMP_CF.map(item=>(
              <div key={item.id} onClick={()=>setFinalCheck(prev=>({...prev,[item.id]:!prev[item.id]}))}
                style={{display:"flex",alignItems:"center",gap:12,padding:"11px 12px",borderRadius:10,marginBottom:6,cursor:"pointer",background:finalCheck[item.id]?"rgba(16,185,129,.08)":"#0f1117",border:`1px solid ${finalCheck[item.id]?"rgba(16,185,129,.25)":"rgba(255,255,255,.06)"}`,transition:"all .15s"}}>
                <div style={{width:24,height:24,borderRadius:6,flexShrink:0,background:finalCheck[item.id]?"#10b981":"transparent",border:`2px solid ${finalCheck[item.id]?"#10b981":"rgba(255,255,255,.2)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"#fff",fontWeight:700}}>{finalCheck[item.id]?"✓":""}</div>
                <span style={{fontSize:14,color:finalCheck[item.id]?"#10b981":"#c9c5b8"}}>{item.txt}</span>
              </div>
            ))}
            <div style={{display:"flex",gap:8,marginTop:16}}>
              <button className="btn bg" style={{flex:1,justifyContent:"center"}} onClick={()=>setFinalMode(null)}>← Volver</button>
              <button className="btn bp" style={{flex:2,justifyContent:"center",padding:"12px",fontSize:15}} onClick={()=>guardarFinal("ok")} disabled={finalSaving}>✅ Servicio terminado y verificado</button>
            </div>
          </>}
          {finalMode==="ok"&&finalStep==="hora"&&(()=>{
            const srvM=servicios.find(s=>s.id===actId);
            const mod=srvM?.modalidad_pago||"por_horas";
            return <>
            <div style={{textAlign:"center",marginBottom:16}}>
              <div style={{fontSize:28,marginBottom:6}}>🕐</div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:"#e8e6e1",marginBottom:4}}>¿A qué hora has terminado?</div>
            </div>
            <div className="fg">
              <label>Hora de finalización</label>
              <input type="time" className="fi" value={horaFin} onChange={e=>recalcHora(e.target.value)} style={{fontSize:18,textAlign:"center",padding:"12px"}}/>
            </div>
            {horasCalc>0&&<div style={{background:"rgba(201,168,76,.06)",border:"1px solid rgba(201,168,76,.15)",borderRadius:10,padding:"14px 16px",marginBottom:14}}>
              <div style={{fontSize:13,color:"#c9c5b8",marginBottom:6}}>⏱ Has trabajado <strong style={{color:"#c9a84c"}}>{horasCalc} horas</strong></div>
              {mod==="permuta"?<div style={{fontSize:14,color:"#a5b4fc"}}>🔄 Permuta: {srvM?.permuta_descripcion||"Acuerdo de permuta"} — Coste: 0€</div>
              :mod==="precio_fijo_servicio"?<div style={{fontSize:14,color:"#e8e6e1"}}>Precio fijo acordado: <strong style={{color:"#c9a84c",fontSize:18}}>{costeCalc}€</strong></div>
              :tarifaHora>0?<div style={{fontSize:14,color:"#e8e6e1"}}>Coste: <strong>{horasCalc}</strong> × <strong>{tarifaHora}€/h</strong> = <strong style={{color:"#c9a84c",fontSize:18}}>{costeCalc}€</strong></div>
              :<div style={{fontSize:12,color:"#f59e0b",marginTop:4}}>⚠️ Configura la tarifa por hora en Ajustes para calcular el coste automáticamente</div>}
            </div>}
            {horasCalc===0&&<div style={{background:"rgba(245,158,11,.06)",border:"1px solid rgba(245,158,11,.15)",borderRadius:8,padding:"10px 12px",marginBottom:14,fontSize:12,color:"#f59e0b"}}>No se ha podido calcular la duración. Puedes continuar igualmente.</div>}
            <div style={{display:"flex",gap:8,marginTop:8}}>
              <button className="btn bg" style={{flex:1,justifyContent:"center"}} onClick={()=>setFinalStep("check")}>← Volver</button>
              <button className="btn bp" style={{flex:2,justifyContent:"center",padding:"12px",fontSize:15}} onClick={confirmarConHora} disabled={finalSaving}>{finalSaving?"Guardando…":"✅ Confirmar y cerrar servicio"}</button>
            </div>
          </>;})()}

          {finalMode==="incidencia"&&<>
            <div style={{fontSize:13,color:"#f59e0b",fontWeight:600,marginBottom:10}}>⚠️ ¿Qué incidencia hay?</div>
            <textarea className="fi" rows={4} value={finalNota} onChange={e=>setFinalNota(e.target.value)} placeholder="Ej: Falta reponer gel en baño principal, mancha en sofá…" style={{marginBottom:14,fontSize:14,lineHeight:1.5}}/>
            <div style={{display:"flex",gap:8}}>
              <button className="btn bg" style={{flex:1,justifyContent:"center"}} onClick={()=>setFinalMode(null)}>← Volver</button>
              <button className="btn" style={{flex:2,justifyContent:"center",padding:"12px",fontSize:15,background:"#f59e0b",color:"#0f1117"}} onClick={()=>guardarFinal("incidencia")} disabled={finalSaving||!finalNota.trim()}>{finalSaving?"Guardando…":"⚠️ Cerrar con incidencias"}</button>
            </div>
          </>}

          <button onClick={()=>{setShowFinal(false);setFinalStep("check");}} style={{background:"none",border:"none",color:"#5a5e6e",cursor:"pointer",width:"100%",textAlign:"center",marginTop:16,fontSize:12,fontFamily:"'DM Sans',sans-serif",padding:"8px"}}>Cerrar y decidir más tarde</button>
        </div>
      </div>
    )}
  </>;
}

// ─── CHAT ────────────────────────────────────────────────────────────────────
function Chat({perfil,tok,rol}){
  const isA=rol==="admin";
  const myId=isA?"admin":String(perfil.id);
  const [usuarios,setUsuarios]=useState([]);const [conId,setConId]=useState(isA?null:"admin");
  const [msgs,setMsgs]=useState([]);const [txt,setTxt]=useState("");const [fotoMsg,setFotoMsg]=useState(null);
  const [load,setLoad]=useState(true);const [unread,setUnread]=useState({});
  const endRef=useRef(null);const inputRef=useRef(null);

  const loadUnread=async()=>{
    try{const r=await sbGet("mensajes",`?para=eq.${myId}&leido=eq.false&select=de`,tok);const counts={};r.forEach(m=>{counts[String(m.de)]=(counts[String(m.de)]||0)+1;});setUnread(counts);}catch(_){}
  };
  useEffect(()=>{sbGet("usuarios","?rol=neq.admin&select=*",tok).then(u=>{setUsuarios(u);setLoad(false);loadUnread();}).catch(()=>setLoad(false));},[]);
  useEffect(()=>{
    if(!conId)return;
    const otherId=String(conId);
    sbGet("mensajes",`?or=(and(de.eq.${myId},para.eq.${otherId}),and(de.eq.${otherId},para.eq.${myId}))&order=created_at.asc`,tok).then(setMsgs).catch(()=>{});
    sbPatch("mensajes",`para=eq.${myId}&de=eq.${otherId}&leido=eq.false`,{leido:true},tok).then(()=>setUnread(prev=>({...prev,[otherId]:0}))).catch(()=>{});
  },[conId]);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},[msgs.length]);

  const send=async()=>{
    if((!txt.trim()&&!fotoMsg)||!conId)return;
    const body={de:myId,para:String(conId),txt:txt.trim()||null,foto_url:fotoMsg||null,leido:false};
    setTxt("");setFotoMsg(null);
    try{const [m]=await sbPost("mensajes",body,tok);setMsgs(prev=>[...prev,m]);sendPush("💬 Finca El Molino",`Nuevo mensaje de ${isA?"Administración":perfil.nombre}`,"chat-msg");}catch(_){}
    setTimeout(()=>inputRef.current?.focus(),0);
  };
  const selectU=id=>{setConId(String(id));};
  const conUser=usuarios.find(u=>String(u.id)===String(conId));

  if(load)return <div className="loading"><div className="spin"/><span>Cargando…</span></div>;
  return <>
    {/* DESKTOP */}
    <div className="ph chat-desktop-only"><h2>💬 {isA?"Chat con el equipo":"Chat con administración"}</h2></div>
    <div style={{display:"flex",height:"calc(100vh - 128px)",minHeight:300,overflow:"hidden"}} className="chat-desktop-only">
      {isA&&<div className="chat-list-col">
        <div style={{padding:"12px 14px 8px",fontSize:10,color:"#5a5e6e",textTransform:"uppercase",letterSpacing:1}}>Conversaciones</div>
        {usuarios.map(u=><div key={u.id} className={`cu${String(conId)===String(u.id)?" on":""}`} onClick={()=>selectU(u.id)}>
          <div className="av" style={{width:32,height:32,fontSize:11}}>{u.avatar||u.nombre.slice(0,2).toUpperCase()}</div>
          <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,color:"#c9c5b8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.nombre}</div><div style={{fontSize:10,color:"#5a5e6e",textTransform:"capitalize"}}>{u.rol}</div></div>
          {(unread[String(u.id)]||0)>0&&<span style={{background:"#e85555",color:"#fff",borderRadius:20,padding:"2px 7px",fontSize:11,fontWeight:700,flexShrink:0}}>{unread[String(u.id)]}</span>}
        </div>)}
      </div>}
      {conId?<div className="chat-area">
        <div className="chdr2">
          <div className="av" style={{width:32,height:32,fontSize:11}}>{isA?(conUser?.avatar||conUser?.nombre?.slice(0,2).toUpperCase()||"?"):"AD"}</div>
          <div><div style={{fontSize:13,fontWeight:600,color:"#e8e6e1"}}>{isA?(conUser?.nombre||"…"):"Administración"}</div><div style={{fontSize:10,color:"#5a5e6e",textTransform:"capitalize"}}>{isA?(conUser?.rol||""):"admin"}</div></div>
        </div>
        <div className="msgs">
          {msgs.length===0&&<div style={{textAlign:"center",color:"#5a5e6e",fontSize:13,padding:"36px 0"}}>Comienza la conversación…</div>}
          {msgs.map(m=>{const mine=String(m.de)===myId;return <div key={m.id} className={`bub${mine?" me":" them"}`}>{m.txt&&<div>{m.txt}</div>}{m.foto_url&&<img src={m.foto_url} alt="" style={{maxWidth:200,maxHeight:160,borderRadius:8,marginTop:6,objectFit:"cover",display:"block"}}/>}<div className="bmeta">{fmtDT(m.created_at)}</div></div>;})}
          <div ref={endRef}/>
        </div>
        {/* INPUT DESKTOP */}
        <div style={{flexShrink:0,borderTop:"1px solid rgba(255,255,255,.08)",padding:"10px 14px",display:"flex",gap:8,alignItems:"flex-end",background:"#13161f"}}>
          <div style={{flex:1,minWidth:0}}>
            {fotoMsg&&<div style={{marginBottom:8,position:"relative",display:"inline-block"}}><img src={fotoMsg} alt="" style={{height:50,borderRadius:6,objectFit:"cover"}}/><button onClick={()=>setFotoMsg(null)} style={{position:"absolute",top:-6,right:-6,background:"#e85555",border:"none",borderRadius:"50%",width:18,height:18,cursor:"pointer",color:"#fff",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button></div>}
            <textarea ref={inputRef} className="fi" rows={2} value={txt} onChange={e=>setTxt(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&window.innerWidth>768){e.preventDefault();send();}}} placeholder="Escribe un mensaje…" style={{resize:"none",fontSize:15,lineHeight:1.5}}/>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6,flexShrink:0}}>
            <label style={{cursor:"pointer",width:44,height:44,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,color:"#c9a84c",fontSize:20,display:"flex",alignItems:"center",justifyContent:"center"}}>
              📷<input type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={async e=>{const f=e.target.files[0];if(f){try{const url=await uploadFoto(f,tok);setFotoMsg(url);}catch(_){const r=new FileReader();r.onload=ev=>setFotoMsg(ev.target.result);r.readAsDataURL(f);}}}}/>
            </label>
            <button onClick={send} style={{width:44,height:44,background:"#c9a84c",border:"none",borderRadius:10,color:"#0f1117",fontSize:22,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>→</button>
          </div>
        </div>
      </div>:<div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}><div className="empty"><span className="ico">💬</span><p>Selecciona una conversación</p></div></div>}
    </div>

    {/* MÓVIL */}
    <div className="chat-mobile-wrap">
      {isA&&!conId&&<>
        <div style={{padding:"16px 16px 8px",borderBottom:"1px solid rgba(255,255,255,.06)"}}><div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:"#e8e6e1"}}>💬 Chat con el equipo</div></div>
        <div style={{flex:1,overflowY:"auto"}}>
          {usuarios.map(u=><div key={u.id} className="cu" style={{padding:"14px 16px",borderBottom:"1px solid rgba(255,255,255,.06)"}} onClick={()=>selectU(u.id)}>
            <div className="av" style={{width:40,height:40,fontSize:13}}>{u.avatar||u.nombre.slice(0,2).toUpperCase()}</div>
            <div style={{flex:1,minWidth:0,marginLeft:4}}><div style={{fontSize:15,color:"#c9c5b8",fontWeight:500}}>{u.nombre}</div><div style={{fontSize:12,color:"#5a5e6e",textTransform:"capitalize",marginTop:2}}>{u.rol}</div></div>
            {(unread[String(u.id)]||0)>0?<span style={{background:"#e85555",color:"#fff",borderRadius:20,padding:"3px 9px",fontSize:12,fontWeight:700}}>{unread[String(u.id)]}</span>:<span style={{color:"#5a5e6e",fontSize:22}}>›</span>}
          </div>)}
        </div>
      </>}
      {conId&&<div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden",position:"relative"}}>
        <div style={{flexShrink:0,padding:"11px 16px",borderBottom:"1px solid rgba(255,255,255,.07)",display:"flex",alignItems:"center",gap:10,background:"#13161f"}}>
          {isA&&<button onClick={()=>setConId(null)} style={{background:"none",border:"none",color:"#c9a84c",fontSize:26,cursor:"pointer",padding:"0 8px 0 0",lineHeight:1,flexShrink:0}}>‹</button>}
          <div className="av" style={{width:36,height:36,fontSize:12,flexShrink:0}}>{isA?(conUser?.avatar||conUser?.nombre?.slice(0,2).toUpperCase()||"?"):"AD"}</div>
          <div><div style={{fontSize:14,fontWeight:600,color:"#e8e6e1"}}>{isA?(conUser?.nombre||"…"):"Administración"}</div><div style={{fontSize:11,color:"#5a5e6e",textTransform:"capitalize"}}>{isA?(conUser?.rol||""):"admin"}</div></div>
        </div>
        <div className="msgs" style={{flex:1,overflowY:"auto",paddingBottom:80}}>
          {msgs.length===0&&<div style={{textAlign:"center",color:"#5a5e6e",fontSize:13,padding:"32px 0"}}>Comienza la conversación…</div>}
          {msgs.map(m=>{const mine=String(m.de)===myId;return <div key={m.id} className={`bub${mine?" me":" them"}`}>{m.txt&&<div>{m.txt}</div>}{m.foto_url&&<img src={m.foto_url} alt="" style={{maxWidth:"70%",borderRadius:8,marginTop:6,objectFit:"cover",display:"block"}}/>}<div className="bmeta">{fmtDT(m.created_at)}</div></div>;})}
          <div ref={endRef}/>
        </div>
        {/* INPUT MÓVIL */}
        <div style={{position:"absolute",bottom:0,left:0,right:0,zIndex:10,flexShrink:0,borderTop:"1px solid rgba(255,255,255,.08)",padding:"10px 14px",display:"flex",gap:8,alignItems:"flex-end",background:"#13161f"}}>
          <div style={{flex:1,minWidth:0}}>
            {fotoMsg&&<div style={{marginBottom:8,position:"relative",display:"inline-block"}}><img src={fotoMsg} alt="" style={{height:50,borderRadius:6,objectFit:"cover"}}/><button onClick={()=>setFotoMsg(null)} style={{position:"absolute",top:-6,right:-6,background:"#e85555",border:"none",borderRadius:"50%",width:18,height:18,cursor:"pointer",color:"#fff",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button></div>}
            <textarea className="fi" rows={2} value={txt} onChange={e=>setTxt(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}} placeholder="Escribe un mensaje…" style={{resize:"none",fontSize:15,lineHeight:1.5}}/>
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

// ─── DISPONIBILIDAD ───────────────────────────────────────────────────────────
async function checkDisponibilidad(fecha, tok){
  // Returns {libre, conflictos:[{tipo,nombre,detalle}]}
  const [reservas, airbnbs] = await Promise.all([
    sbGet("reservas", `?fecha=eq.${fecha}&select=nombre,tipo,estado`, tok),
    sbGet("reservas_airbnb", `?fecha_entrada=lte.${fecha}&fecha_salida=gte.${fecha}&select=huesped,fecha_entrada,fecha_salida`, tok),
  ]);
  const conflictos=[
    ...reservas.filter(r=>["visita","pendiente_contrato","contrato_firmado","reserva_pagada","precio_total"].includes(r.estado)).map(r=>({tipo:"evento",nombre:r.nombre,detalle:`Evento: ${r.tipo||""}`,color:"#6366f1"})),
    ...airbnbs.map(a=>({tipo:"airbnb",nombre:"Alojamiento turístico",detalle:`Airbnb: ${a.huesped}`,color:"#10b981"})),
  ];
  return {libre:conflictos.length===0, conflictos};
}

// ─── MODAL DISPONIBILIDAD ─────────────────────────────────────────────────────
function ModalOcupado({fecha,conflictos,tipoAccion,perfil,tok,onCerrar,onForzar}){
  const [motivo,setMotivo]=useState("");
  const [saving,setSaving]=useState(false);
  const [enviado,setEnviado]=useState(false);

  const fmtFecha=new Date(fecha+"T12:00:00").toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  const tipoLbl={visita:"una visita",reserva:"una reserva de evento",airbnb:"una reserva Airbnb"}[tipoAccion]||"una reserva";

  const solicitar=async()=>{
    if(saving)return;
    setSaving(true);
    try{
      // Crear solicitud de desbloqueo
      const [sol]=await sbPost("solicitudes_desbloqueo",{
        fecha,
        motivo:motivo||`Solicitud de ${tipoLbl}`,
        solicitado_por:perfil.nombre,
        solicitado_por_id:perfil.id,
        tipo_accion:tipoAccion,
        estado:"pendiente",
      },tok);
      // Notificar a admins
      const admins=await sbGet("usuarios","?rol=eq.admin&select=id",tok);
      const msg=`🔒 ${perfil.nombre} solicita ${tipoLbl} el ${fmtFecha}. La fecha está ocupada. Revisa las solicitudes para aprobar o rechazar.`;
      for(const a of admins){
        await sbPost("notificaciones",{para:a.id,txt:msg},tok);
        sendPush("🔒 Solicitud de desbloqueo",msg,"desbloqueo");
      }
      setEnviado(true);
    }catch(_){}
    setSaving(false);
  };

  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.82)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,overflowY:"auto"}}>
    <div style={{background:"#13161f",border:"1px solid rgba(201,168,76,.2)",borderRadius:14,padding:"24px 20px",width:"100%",maxWidth:460,position:"relative"}} onClick={e=>e.stopPropagation()}>
      {!enviado?<>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:40,marginBottom:10}}>🔒</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:19,color:"#e8e6e1",marginBottom:8}}>Fecha no disponible</div>
          <div style={{fontSize:13,color:"#7a7f94",lineHeight:1.5}}>El <strong style={{color:"#c9c5b8"}}>{fmtFecha}</strong> ya tiene reservas activas.</div>
        </div>
        <div style={{marginBottom:16}}>
          {conflictos.map((c,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"#0f1117",borderRadius:8,marginBottom:6,borderLeft:`3px solid ${c.color}`}}>
              <span style={{fontSize:16}}>{c.tipo==="airbnb"?"🏠":"🎉"}</span>
              <div><div style={{fontSize:13,color:"#c9c5b8",fontWeight:500}}>{c.nombre}</div><div style={{fontSize:11,color:"#5a5e6e"}}>{c.detalle}</div></div>
            </div>
          ))}
        </div>
        <div style={{background:"rgba(201,168,76,.06)",border:"1px solid rgba(201,168,76,.15)",borderRadius:10,padding:"14px",marginBottom:12}}>
          <div style={{fontSize:13,color:"#c9a84c",fontWeight:600,marginBottom:6}}>¿Necesitas usar esta fecha?</div>
          <div style={{fontSize:12,color:"#7a7f94",marginBottom:10,lineHeight:1.5}}>Solicita al administrador que autorice una franja horaria concreta.</div>
          <textarea className="fi" rows={3} value={motivo} onChange={e=>setMotivo(e.target.value)} placeholder="Ej: Visita rápida por la mañana, los huéspedes llegan a las 16:00…" style={{fontSize:13,marginBottom:10}}/>
          <button className="btn bp" style={{width:"100%",justifyContent:"center",padding:"12px",fontSize:14}} onClick={solicitar} disabled={saving}>
            {saving?"Enviando…":"📨 Solicitar desbloqueo"}
          </button>
        </div>
        <button className="btn bg" style={{width:"100%",justifyContent:"center",marginTop:4}} onClick={onCerrar}>← Volver sin solicitar</button>
      </>:<>
        <div style={{textAlign:"center",padding:"16px 0"}}>
          <div style={{fontSize:44,marginBottom:12}}>📨</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:"#e8e6e1",marginBottom:10}}>Solicitud enviada</div>
          <div style={{fontSize:13,color:"#7a7f94",lineHeight:1.6,marginBottom:20}}>El administrador ha recibido tu solicitud y te notificará si aprueba una franja horaria.</div>
          <button className="btn bp" style={{width:"100%",justifyContent:"center",padding:"12px",fontSize:14}} onClick={onCerrar}>Entendido</button>
        </div>
      </>}
    </div>
  </div>;
}

// ─── PANEL SOLICITUDES (para admin en Notificaciones) ─────────────────────────
function PanelSolicitudes({tok,perfil}){
  const [solicitudes,setSolicitudes]=useState([]);
  const [load,setLoad]=useState(true);
  const [sel,setSel]=useState(null);
  const [horaP,setHoraP]=useState("10:00");
  const [notaA,setNotaA]=useState("");
  const [saving,setSaving]=useState(false);

  const load_=async()=>{
    try{const s=await sbGet("solicitudes_desbloqueo","?estado=eq.pendiente&select=*&order=created_at.desc",tok);setSolicitudes(s);}catch(_){}
    setLoad(false);
  };
  useEffect(()=>{load_();},[]);

  const responder=async(accion)=>{
    if(!sel||saving)return;
    setSaving(true);
    try{
      await sbPatch("solicitudes_desbloqueo",`id=eq.${sel.id}`,{
        estado:accion,
        hora_permitida:accion==="aprobada"?horaP:null,
        nota_admin:notaA||null,
        respondido_por:perfil.nombre,
        respondido_ts:new Date().toISOString(),
      },tok);
      const fmtF=new Date(sel.fecha+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"long"});
      const tipoLbl={visita:"una visita",reserva:"una reserva",airbnb:"una reserva Airbnb"}[sel.tipo_accion]||"la acción";
      let msg="";
      if(accion==="aprobada"){
        msg=`✅ Solicitud aprobada: puedes hacer ${tipoLbl} el ${fmtF} de ${horaP} a ${notaA||"la hora indicada"}. ${notaA?`Nota: ${notaA}`:""}`;
      }else{
        msg=`❌ Solicitud rechazada para el ${fmtF}. ${notaA?`Motivo: ${notaA}`:"Contacta con el administrador."}`;
      }
      // Notificar al solicitante
      if(sel.solicitado_por_id){
        await sbPost("notificaciones",{para:sel.solicitado_por_id,txt:msg},tok);
        sendPush("🌾 Finca El Molino",msg,"solicitud-resp");
      }
      setSel(null);setHoraP("10:00");setNotaA("");
      await load_();
    }catch(_){}
    setSaving(false);
  };

  if(load)return <div style={{color:"#5a5e6e",fontSize:13,padding:"8px 0"}}>Cargando…</div>;
  if(solicitudes.length===0)return <div style={{background:"rgba(16,185,129,.06)",border:"1px solid rgba(16,185,129,.15)",borderRadius:10,padding:"12px 16px",fontSize:13,color:"#10b981",marginBottom:16}}>✅ Sin solicitudes de desbloqueo pendientes</div>;

  return <div style={{marginBottom:20}}>
    <div style={{fontSize:11,color:"#e85555",textTransform:"uppercase",letterSpacing:1,fontWeight:600,marginBottom:10}}>🔒 Solicitudes de desbloqueo ({solicitudes.length})</div>
    {solicitudes.map(s=>{
      const fmtF=new Date(s.fecha+"T12:00:00").toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"});
      const tipoLbl={visita:"Visita",reserva:"Reserva evento",airbnb:"Reserva Airbnb"}[s.tipo_accion]||s.tipo_accion;
      return <div key={s.id} className="card" style={{marginBottom:10,borderLeft:"3px solid #e85555"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:10}}>
          <div>
            <div style={{fontSize:14,fontWeight:600,color:"#e8e6e1"}}>🔒 {tipoLbl} · {fmtF}</div>
            <div style={{fontSize:12,color:"#7a7f94",marginTop:3}}>Solicitado por <strong>{s.solicitado_por}</strong></div>
            {s.motivo&&<div style={{fontSize:12,color:"#c9c5b8",marginTop:5,background:"#0f1117",borderRadius:7,padding:"6px 10px"}}>{s.motivo}</div>}
          </div>
          <span style={{fontSize:10,color:"#5a5e6e",flexShrink:0}}>{fmtDT(s.created_at)}</span>
        </div>
        {sel?.id===s.id?(
          <div style={{background:"rgba(201,168,76,.06)",border:"1px solid rgba(201,168,76,.15)",borderRadius:10,padding:"12px"}}>
            <div className="fg" style={{marginBottom:10}}>
              <label>Hora permitida</label>
              <input type="time" className="fi" value={horaP} onChange={e=>setHoraP(e.target.value)}/>
            </div>
            <div className="fg" style={{marginBottom:10}}>
              <label>Nota para el solicitante</label>
              <textarea className="fi" rows={2} value={notaA} onChange={e=>setNotaA(e.target.value)} placeholder="Ej: Solo de 10:00 a 11:30, los huéspedes llegan a las 16:00"/>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button className="btn bg" style={{flex:1,justifyContent:"center"}} onClick={()=>setSel(null)}>Cancelar</button>
              <button className="btn br" style={{flex:1,justifyContent:"center"}} onClick={()=>responder("rechazada")} disabled={saving}>❌ Rechazar</button>
              <button className="btn bp" style={{flex:2,justifyContent:"center"}} onClick={()=>responder("aprobada")} disabled={saving}>{saving?"…":"✅ Aprobar"}</button>
            </div>
          </div>
        ):(
          <button className="btn bp" style={{width:"100%",justifyContent:"center"}} onClick={()=>{setSel(s);setHoraP("10:00");setNotaA("");}}>Revisar y responder</button>
        )}
      </div>;
    })}
  </div>;
}

function Notifs({perfil,tok,rol}){
  const isA=rol==="admin";
  const [notifs,setNotifs]=useState([]);const [usuarios,setUsuarios]=useState([]);
  const [dest,setDest]=useState("");const [txt,setTxt]=useState("");const [load,setLoad]=useState(true);const [saving,setSaving]=useState(false);
  useEffect(()=>{(async()=>{const n=isA?await sbGet("notificaciones","?select=*,usuarios(nombre,rol)&order=created_at.desc",tok):await sbGet("notificaciones",`?para=eq.${perfil.id}&order=created_at.desc`,tok);setNotifs(n);if(isA){const u=await sbGet("usuarios","?rol=neq.admin&select=*",tok);setUsuarios(u);}setLoad(false);})();},[]);
  const enviar=async()=>{if(!txt.trim()||!dest||saving)return;setSaving(true);const targets=dest==="todos"?usuarios:usuarios.filter(u=>String(u.id)===dest);for(const u of targets){await sbPost("notificaciones",{para:u.id,txt},tok);sendPush("🌾 Finca El Molino",txt,`notif-${u.id}`);}setTxt("");setDest("");setSaving(false);};
  const leer=async id=>{await sbPatch("notificaciones",`id=eq.${id}`,{leida:true},tok);setNotifs(prev=>prev.map(n=>n.id===id?{...n,leida:true}:n));};
  if(load)return <div className="loading"><div className="spin"/><span>Cargando…</span></div>;
  const RL={jardinero:"Jardinero",limpieza:"Limpieza",comercial:"Comercial"};
  return <>
    <div className="ph"><h2>🔔 Notificaciones</h2><p>{isA?"Envía avisos al equipo":`${notifs.filter(n=>!n.leida).length} sin leer`}</p></div>
    <div className="pb">
      {isA&&<PanelSolicitudes tok={tok} perfil={perfil}/>}
      {isA&&<div className="card" style={{marginBottom:20}}>
        <div className="ctit" style={{marginBottom:14}}>📢 Enviar aviso</div>
        <div className="fg"><label>Destinatario</label><select className="fi" value={dest} onChange={e=>setDest(e.target.value)}><option value="">Selecciona…</option><option value="todos">📢 Todos los operarios</option>{usuarios.map(u=><option key={u.id} value={String(u.id)}>{u.nombre} ({RL[u.rol]||u.rol})</option>)}</select></div>
        <div className="fg"><label>Mensaje</label><textarea className="fi" rows={3} value={txt} onChange={e=>setTxt(e.target.value)} placeholder="Ej: Esta semana hay que revisar el riego antes del jueves…"/></div>
        <button className="btn bp" onClick={enviar} disabled={saving}>📤 Enviar</button>
      </div>}
      {notifs.length===0?<div className="empty"><span className="ico">🔔</span><p>Sin notificaciones</p></div>
        :<div className="card" style={{padding:0,overflow:"hidden"}}>
          {notifs.map(n=>{const destU=isA?(n.usuarios||null):null;return <div key={n.id} className={`nitem${!n.leida?" unread":""}`}>
            <div className={`ndot${n.leida?" read":""}`}/><div style={{flex:1,minWidth:0}}>{isA&&destU&&<div style={{fontSize:10,color:"#c9a84c",marginBottom:3}}>→ {destU.nombre}</div>}<div style={{fontSize:13,color:n.leida?"#7a7f94":"#c9c5b8",lineHeight:1.4}}>{n.txt}</div><div style={{fontSize:10,color:"#5a5e6e",marginTop:4}}>{fmtDT(n.created_at)}</div></div>
            {!n.leida&&!isA&&<button className="btn bg sm" style={{flexShrink:0}} onClick={()=>leer(n.id)}>✓</button>}
          </div>;})}
        </div>}
    </div>
  </>;
}

// ─── USUARIOS ────────────────────────────────────────────────────────────────
function Usuarios({tok}){
  const [usuarios,setUsuarios]=useState([]);const [load,setLoad]=useState(true);const [showAdd,setShowAdd]=useState(false);
  const [form,setForm]=useState({email:"",password:"",nombre:"",rol:"jardinero"});const [saving,setSaving]=useState(false);const [err,setErr]=useState("");
  useEffect(()=>{sbGet("usuarios","?select=*&order=rol.asc",tok).then(setUsuarios).catch(()=>{}).finally(()=>setLoad(false));},[]);
  const crearUsuario=async()=>{
    if(!form.email||!form.password||!form.nombre||saving)return;setSaving(true);setErr("");
    try{
      const r=await fetch(`${SB_URL}/auth/v1/admin/users`,{method:"POST",headers:{...HDR,"Authorization":`Bearer ${tok}`},body:JSON.stringify({email:form.email,password:form.password,email_confirm:true})});
      const d=await r.json();if(!r.ok)throw new Error(d.message||"Error al crear usuario");
      await sbPost("usuarios",{id:d.id,nombre:form.nombre,rol:form.rol,avatar:form.nombre.slice(0,2).toUpperCase()},tok);
      setShowAdd(false);setForm({email:"",password:"",nombre:"",rol:"jardinero"});
      const u=await sbGet("usuarios","?select=*&order=rol.asc",tok);setUsuarios(u);
    }catch(e){setErr(e.message||"Error");}setSaving(false);
  };
  const RL={admin:"Administrador",jardinero:"Jardinero",limpieza:"Limpieza",comercial:"Comercial"};
  const RC={admin:"#c9a84c",jardinero:"#10b981",limpieza:"#6366f1",comercial:"#f59e0b"};
  if(load)return <div className="loading"><div className="spin"/><span>Cargando…</span></div>;
  return <>
    <div className="ph"><h2>Usuarios del sistema</h2><p>Gestión de accesos</p></div>
    <div className="pb">
      <div style={{marginBottom:20}}><button className="btn bp" onClick={()=>setShowAdd(true)}>➕ Añadir usuario</button></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(250px,1fr))",gap:14}}>
        {usuarios.map(u=><div key={u.id} className="card">
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
            <div style={{width:44,height:44,borderRadius:"50%",background:`${RC[u.rol]||"#c9a84c"}20`,border:`2px solid ${RC[u.rol]||"#c9a84c"}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:RC[u.rol]||"#c9a84c",flexShrink:0}}>{u.avatar||u.nombre.slice(0,2).toUpperCase()}</div>
            <div style={{minWidth:0}}><div style={{fontSize:14,fontWeight:600,color:"#e8e6e1",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.nombre}</div><span className="badge" style={{background:`${RC[u.rol]||"#c9a84c"}15`,color:RC[u.rol]||"#c9a84c",border:`1px solid ${RC[u.rol]||"#c9a84c"}30`,marginTop:3,display:"inline-block"}}>{RL[u.rol]||u.rol}</span></div>
          </div>
          <div style={{fontSize:11,color:"#3d4155"}}>🔑 {u.id.slice(0,8)}…</div>
        </div>)}
      </div>
    </div>
    {showAdd&&<div className="ov" onClick={()=>setShowAdd(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <h3>➕ Nuevo usuario</h3>{err&&<div className="alert">{err}</div>}
      <div className="fg"><label>Nombre completo</label><input className="fi" value={form.nombre} onChange={e=>setForm(v=>({...v,nombre:e.target.value}))} placeholder="Ej: Carlos García"/></div>
      <div className="fg"><label>Email</label><input className="fi" type="email" value={form.email} onChange={e=>setForm(v=>({...v,email:e.target.value}))} placeholder="carlos@elmolino.es"/></div>
      <div className="fg"><label>Contraseña inicial</label><input className="fi" type="text" value={form.password} onChange={e=>setForm(v=>({...v,password:e.target.value}))} placeholder="min. 6 caracteres"/></div>
      <div className="fg"><label>Rol</label><select className="fi" value={form.rol} onChange={e=>setForm(v=>({...v,rol:e.target.value}))}><option value="jardinero">Jardinero</option><option value="limpieza">Limpieza</option><option value="comercial">Comercial</option><option value="admin">Administrador</option></select></div>
      <div className="mft"><button className="btn bg" onClick={()=>setShowAdd(false)}>Cancelar</button><button className="btn bp" onClick={crearUsuario} disabled={saving}>{saving?"Creando…":"Crear usuario"}</button></div>
    </div></div>}
  </>;
}

// ─── JARDINEROS ─────────────────────────────────────────────────────────────
const MODAL_JARDINERO=["Fijo mensual","Por horas","Precio fijo por servicio"];

function Jardineros({tok,rol}){
  if(rol!=="admin")return null;
  const [tab,setTab]=useState("jardineros");
  const [jardineros,setJardineros]=useState([]);
  const [servicios,setServicios]=useState([]);
  const [load,setLoad]=useState(true);
  // Jardinero form
  const [showJForm,setShowJForm]=useState(false);
  const [jForm,setJForm]=useState({nombre:"",modalidad:"Fijo mensual",tarifa:"",notas:""});
  const [saving,setSaving]=useState(false);
  // Análisis
  const [analisis,setAnalisis]=useState(null);
  const [analLoad,setAnalLoad]=useState(false);
  const [analData,setAnalData]=useState(null);
  // Servicio form
  const [showSForm,setShowSForm]=useState(false);
  const sFormVacio={jardinero_id:"",titulo:"",descripcion:"",modalidad:"",tarifa_hora:"",importe_fijo:"",fecha_inicio:new Date().toISOString().split("T")[0],tareas:[]};
  const [sForm,setSForm]=useState(sFormVacio);
  const [nuevaTarea,setNuevaTarea]=useState("");
  // Servicio tabs
  const [srvTab,setSrvTab]=useState("activos");

  const load_=async()=>{
    try{
      const [j,s]=await Promise.all([
        sbGet("jardineros","?select=*&order=nombre.asc",tok),
        sbGet("servicios_jardineria","?select=*&order=created_at.desc",tok),
      ]);
      setJardineros(j);setServicios(s);
    }catch(_){}
    setLoad(false);
  };
  useEffect(()=>{load_();},[]);

  const crearJardinero=async()=>{
    if(!jForm.nombre||saving)return;
    setSaving(true);
    try{
      await sbPost("jardineros",{
        nombre:jForm.nombre,modalidad:jForm.modalidad,
        tarifa:parseFloat(jForm.tarifa)||null,
        notas:jForm.notas||null,activo:true
      },tok);
      setShowJForm(false);setJForm({nombre:"",modalidad:"Fijo mensual",tarifa:"",notas:""});
      await load_();
    }catch(_){}
    setSaving(false);
  };

  const toggleActivo=async(j)=>{
    await sbPatch("jardineros",`id=eq.${j.id}`,{activo:!j.activo},tok);
    await load_();
  };

  const verAnalisis=async(j)=>{
    if(analisis?.id===j.id){setAnalisis(null);return;}
    setAnalisis(j);setAnalLoad(true);setAnalData(null);
    try{
      const hoy=new Date();
      const añoActual=hoy.getFullYear();
      const mesActual=String(hoy.getMonth()+1).padStart(2,"0");
      const jornadas=await sbGet("jornadas_jardineria",`?jardinero_id=eq.${j.id}&fecha=gte.${añoActual}-01-01&select=*`,tok).catch(()=>[]);
      // Mes actual
      const jorMes=jornadas.filter(x=>x.fecha?.slice(5,7)===mesActual);
      const horasMes=jorMes.reduce((s,x)=>s+(parseFloat(x.horas)||0),0);
      const costeMes=jorMes.reduce((s,x)=>s+(parseFloat(x.coste)||0),0);
      // Año
      const horasAño=jornadas.reduce((s,x)=>s+(parseFloat(x.horas)||0),0);
      const costeAño=jornadas.reduce((s,x)=>s+(parseFloat(x.coste)||0),0);
      const euroHoraReal=horasAño>0?Math.round(costeAño/horasAño*100)/100:0;
      // Barras por mes
      const barras=Array.from({length:12},(_,i)=>{
        const m=String(i+1).padStart(2,"0");
        const h=jornadas.filter(x=>x.fecha?.slice(5,7)===m).reduce((s,x)=>s+(parseFloat(x.horas)||0),0);
        return {name:MESES_CORTO[i],horas:Math.round(h*10)/10};
      });
      setAnalData({horasMes:Math.round(horasMes*10)/10,costeMes:Math.round(costeMes),horasAño:Math.round(horasAño*10)/10,costeAño:Math.round(costeAño),euroHoraReal,barras});
    }catch(_){}
    setAnalLoad(false);
  };

  const selJardinero=(id)=>{
    const j=jardineros.find(x=>String(x.id)===String(id));
    setSForm(prev=>({...prev,jardinero_id:id,modalidad:j?.modalidad||"Por horas",tarifa_hora:j?.modalidad==="Por horas"?String(j?.tarifa||""):""}));
  };

  const addTareaSrv=()=>{if(!nuevaTarea.trim())return;setSForm(prev=>({...prev,tareas:[...prev.tareas,nuevaTarea.trim()]}));setNuevaTarea("");};
  const removeTareaSrv=i=>setSForm(prev=>({...prev,tareas:prev.tareas.filter((_,idx)=>idx!==i)}));

  const crearServicio=async()=>{
    if(!sForm.jardinero_id||!sForm.titulo||saving)return;
    setSaving(true);
    try{
      const j=jardineros.find(x=>String(x.id)===String(sForm.jardinero_id));
      await sbPost("servicios_jardineria",{
        jardinero_id:sForm.jardinero_id,
        jardinero_nombre:j?.nombre||"",
        titulo:sForm.titulo,
        descripcion:sForm.descripcion||null,
        modalidad:sForm.modalidad,
        tarifa_hora:sForm.modalidad==="Por horas"?parseFloat(sForm.tarifa_hora)||null:null,
        importe_fijo:sForm.modalidad==="Precio fijo por servicio"?parseFloat(sForm.importe_fijo)||null:null,
        fecha_inicio:sForm.fecha_inicio,
        tareas:sForm.tareas,
        estado:"activo"
      },tok);
      setShowSForm(false);setSForm(sFormVacio);setNuevaTarea("");await load_();
    }catch(_){}
    setSaving(false);
  };

  const [showFinSrvAdmin,setShowFinSrvAdmin]=useState(null);
  const [finSaving,setFinSaving]=useState(false);

  const finalizarSrv=async(id,registrarGasto=false)=>{
    setFinSaving(true);
    try{
      const s=servicios.find(x=>x.id===id);
      const horasT=parseFloat(s?.horas_totales)||0;
      const mod=s?.modalidad||"por_horas";
      let costeTotal=0;
      if(mod==="por_horas")costeTotal=Math.round(horasT*(parseFloat(s?.tarifa_hora)||0)*100)/100;
      else if(mod==="precio_fijo_servicio")costeTotal=parseFloat(s?.importe_fijo)||0;
      const costeHoraReal=horasT>0?Math.round(costeTotal/horasT*100)/100:0;
      await sbPatch("servicios_jardineria",`id=eq.${id}`,{estado:"finalizado",coste_total:costeTotal,coste_hora_real:costeHoraReal},tok);
      if(registrarGasto&&costeTotal>0){
        const hoyStr=new Date().toISOString().split("T")[0];
        await sbPost("gastos",{fecha:hoyStr,categoria:"Personal",concepto:`Jardinería - ${s?.titulo||"Servicio"}`,importe:costeTotal,origen:"auto_jardineria"},tok).catch(()=>{});
      }
      setShowFinSrvAdmin(null);await load_();
    }catch(_){}
    setFinSaving(false);
  };

  if(load)return <div className="loading"><div className="spin"/><span>Cargando…</span></div>;

  const srvsActivos=servicios.filter(s=>s.estado==="activo"||s.estado==="en_curso");
  const srvsFinalizados=servicios.filter(s=>s.estado!=="activo");

  return <>
    <div className="ph"><h2>🌿 Jardineros</h2><p>Gestión de jardineros y servicios</p></div>
    <div className="pb">
      <div className="tabs">
        <button className={`tab${tab==="jardineros"?" on":""}`} onClick={()=>setTab("jardineros")}>👤 Jardineros ({jardineros.length})</button>
        <button className={`tab${tab==="servicios"?" on":""}`} onClick={()=>setTab("servicios")}>📋 Servicios ({servicios.length})</button>
      </div>

      {/* ── TAB JARDINEROS ── */}
      {tab==="jardineros"&&<>
        <div style={{marginBottom:14}}><button className="btn bp" onClick={()=>{setJForm({nombre:"",modalidad:"Fijo mensual",tarifa:"",notas:""});setShowJForm(true);}}>➕ Nuevo jardinero</button></div>
        {jardineros.length===0?<div className="empty"><span className="ico">🌿</span><p>Sin jardineros registrados</p></div>
        :jardineros.map(j=>{
          const modLbl=j.modalidad||"—";
          const tarifaLbl=j.tarifa?(j.modalidad==="Fijo mensual"?`${j.tarifa}€/mes`:j.modalidad==="Por horas"?`${j.tarifa}€/h`:`${j.tarifa}€`):"—";
          const abierto=analisis?.id===j.id;
          return <div key={j.id} className="card" style={{marginBottom:10,borderLeft:`3px solid ${j.activo?"#10b981":"#5a5e6e"}`,opacity:j.activo?1:.6}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:15,fontWeight:600,color:"#e8e6e1",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{j.nombre}</div>
                <div style={{display:"flex",gap:6,marginTop:5,flexWrap:"wrap"}}>
                  <span className="badge" style={{background:"rgba(201,168,76,.1)",color:"#c9a84c"}}>{modLbl}</span>
                  <span className="badge" style={{background:"rgba(255,255,255,.06)",color:"#7a7f94"}}>{tarifaLbl}</span>
                  <span className="badge" style={{background:j.activo?"rgba(16,185,129,.1)":"rgba(107,114,128,.1)",color:j.activo?"#10b981":"#6b7280"}}>{j.activo?"Activo":"Inactivo"}</span>
                </div>
                {j.notas&&<div style={{fontSize:11,color:"#5a5e6e",marginTop:4}}>{j.notas}</div>}
              </div>
              <div style={{display:"flex",gap:6,flexShrink:0}}>
                <button className="btn bg sm" onClick={()=>verAnalisis(j)}>{abierto?"▲ Cerrar":"📊 Análisis"}</button>
                <button className="btn bg sm" onClick={()=>toggleActivo(j)}>{j.activo?"Desactivar":"Activar"}</button>
              </div>
            </div>
            {/* ANÁLISIS (solo admin, nunca en DOM para otros roles) */}
            {abierto&&<div style={{marginTop:14,paddingTop:14,borderTop:"1px solid rgba(255,255,255,.06)"}}>
              {analLoad?<div style={{color:"#5a5e6e",fontSize:13,padding:"8px 0"}}>Cargando análisis…</div>
              :analData?<>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:8,marginBottom:14}}>
                  <div style={{background:"#0f1117",borderRadius:8,padding:"10px 12px"}}>
                    <div style={{fontSize:10,color:"#5a5e6e"}}>HORAS ESTE MES</div>
                    <div style={{fontSize:18,fontWeight:700,color:"#c9a84c",marginTop:3}}>{analData.horasMes}h</div>
                  </div>
                  <div style={{background:"#0f1117",borderRadius:8,padding:"10px 12px"}}>
                    <div style={{fontSize:10,color:"#5a5e6e"}}>COSTE ESTE MES</div>
                    <div style={{fontSize:18,fontWeight:700,color:"#e85555",marginTop:3}}>{analData.costeMes}€</div>
                  </div>
                  <div style={{background:"#0f1117",borderRadius:8,padding:"10px 12px"}}>
                    <div style={{fontSize:10,color:"#5a5e6e"}}>HORAS ESTE AÑO</div>
                    <div style={{fontSize:18,fontWeight:700,color:"#c9a84c",marginTop:3}}>{analData.horasAño}h</div>
                  </div>
                  <div style={{background:"#0f1117",borderRadius:8,padding:"10px 12px"}}>
                    <div style={{fontSize:10,color:"#5a5e6e"}}>COSTE ESTE AÑO</div>
                    <div style={{fontSize:18,fontWeight:700,color:"#e85555",marginTop:3}}>{analData.costeAño}€</div>
                  </div>
                  <div style={{background:"#0f1117",borderRadius:8,padding:"10px 12px"}}>
                    <div style={{fontSize:10,color:"#5a5e6e"}}>💡 €/HORA REAL</div>
                    <div style={{fontSize:18,fontWeight:700,color:"#6366f1",marginTop:3}}>{analData.euroHoraReal>0?`${analData.euroHoraReal}€`:"—"}</div>
                  </div>
                </div>
                <div style={{fontSize:11,color:"#c9a84c",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Horas por mes</div>
                <div style={{width:"100%",height:140}}>
                  <ResponsiveContainer>
                    <BarChart data={analData.barras} margin={{top:5,right:5,left:-20,bottom:5}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)"/>
                      <XAxis dataKey="name" tick={{fontSize:9,fill:"#5a5e6e"}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fontSize:9,fill:"#5a5e6e"}} axisLine={false} tickLine={false}/>
                      <Tooltip contentStyle={{background:"#13161f",border:"1px solid rgba(201,168,76,.25)",borderRadius:8,fontSize:12}} formatter={v=>[`${v}h`]}/>
                      <Bar dataKey="horas" fill="#c9a84c" radius={[3,3,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>:<div style={{color:"#5a5e6e",fontSize:13}}>Sin datos de jornadas</div>}
            </div>}
          </div>;
        })}
      </>}

      {/* ── TAB SERVICIOS ── */}
      {tab==="servicios"&&<>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,gap:12,flexWrap:"wrap"}}>
          <div className="tabs" style={{marginBottom:0}}>
            <button className={`tab${srvTab==="activos"?" on":""}`} onClick={()=>setSrvTab("activos")}>🟢 Activos ({srvsActivos.length})</button>
            <button className={`tab${srvTab==="finalizados"?" on":""}`} onClick={()=>setSrvTab("finalizados")}>✅ Finalizados ({srvsFinalizados.length})</button>
          </div>
          <button className="btn bp" onClick={()=>{setSForm(sFormVacio);setNuevaTarea("");setShowSForm(true);}}>➕ Nuevo servicio</button>
        </div>
        {(srvTab==="activos"?srvsActivos:srvsFinalizados).length===0
          ?<div className="empty"><span className="ico">📋</span><p>Sin servicios {srvTab}</p></div>
          :(srvTab==="activos"?srvsActivos:srvsFinalizados).map(s=>{
            const modLbl=s.modalidad||"—";
            const costeLbl=s.modalidad==="Por horas"&&s.tarifa_hora?`${s.tarifa_hora}€/h`:s.modalidad==="Precio fijo por servicio"&&s.importe_fijo?`${parseFloat(s.importe_fijo).toLocaleString("es-ES")}€ fijo`:s.modalidad==="Fijo mensual"?"Fijo mensual":"—";
            return <div key={s.id} className="card" style={{marginBottom:10,borderLeft:`3px solid ${s.estado==="activo"?"#10b981":"#6b7280"}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:15,fontWeight:600,color:"#e8e6e1",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.titulo}</div>
                  <div style={{display:"flex",gap:6,marginTop:5,flexWrap:"wrap"}}>
                    <span className="badge" style={{background:"rgba(16,185,129,.1)",color:"#10b981"}}>👤 {s.jardinero_nombre}</span>
                    <span className="badge" style={{background:"rgba(201,168,76,.1)",color:"#c9a84c"}}>{modLbl}</span>
                    <span className="badge" style={{background:"rgba(255,255,255,.06)",color:"#7a7f94"}}>{costeLbl}</span>
                  </div>
                  {s.descripcion&&<div style={{fontSize:12,color:"#7a7f94",marginTop:5}}>{s.descripcion}</div>}
                  {s.fecha_inicio&&<div style={{fontSize:11,color:"#5a5e6e",marginTop:3}}>📅 Inicio: {new Date(s.fecha_inicio+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short",year:"numeric"})}</div>}
                  {Array.isArray(s.tareas)&&s.tareas.length>0&&<div style={{marginTop:8}}>
                    {s.tareas.map((t,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 0",fontSize:12,color:"#c9c5b8"}}>
                      <span style={{color:"#c9a84c",fontSize:11,flexShrink:0}}>{i+1}.</span>{t}
                    </div>)}
                  </div>}
                </div>
                {(s.estado==="activo"||s.estado==="en_curso")&&<button className="btn bp sm" style={{flexShrink:0}} onClick={()=>setShowFinSrvAdmin(s)}>✅ Finalizar</button>}
              </div>
            </div>;
          })}
      </>}
    </div>

    {/* MODAL NUEVO JARDINERO */}
    {showJForm&&<div className="ov" onClick={()=>setShowJForm(false)}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <h3>🌿 Nuevo jardinero</h3>
        <div className="fg"><label>Nombre *</label><input className="fi" value={jForm.nombre} onChange={e=>setJForm(v=>({...v,nombre:e.target.value}))} placeholder="Ej: Carlos García"/></div>
        <div className="fg"><label>Modalidad</label><select className="fi" value={jForm.modalidad} onChange={e=>setJForm(v=>({...v,modalidad:e.target.value}))}>{MODAL_JARDINERO.map(m=><option key={m}>{m}</option>)}</select></div>
        {jForm.modalidad==="Fijo mensual"&&<div className="fg"><label>Tarifa mensual (€)</label><input type="number" inputMode="decimal" className="fi" value={jForm.tarifa} onChange={e=>setJForm(v=>({...v,tarifa:e.target.value}))} placeholder="Ej: 800"/></div>}
        {jForm.modalidad==="Por horas"&&<div className="fg"><label>Tarifa por hora (€)</label><input type="number" inputMode="decimal" className="fi" value={jForm.tarifa} onChange={e=>setJForm(v=>({...v,tarifa:e.target.value}))} placeholder="Ej: 15"/></div>}
        {jForm.modalidad==="Precio fijo por servicio"&&<div style={{fontSize:12,color:"#7a7f94",marginBottom:14,background:"rgba(201,168,76,.06)",borderRadius:8,padding:"10px 12px"}}>El precio se define por cada servicio concreto.</div>}
        <div className="fg"><label>Notas (opcional)</label><textarea className="fi" rows={2} value={jForm.notas} onChange={e=>setJForm(v=>({...v,notas:e.target.value}))} placeholder="Notas sobre el jardinero…"/></div>
        <div className="mft"><button className="btn bg" onClick={()=>setShowJForm(false)}>Cancelar</button><button className="btn bp" onClick={crearJardinero} disabled={saving||!jForm.nombre}>{saving?"Guardando…":"🌿 Crear jardinero"}</button></div>
      </div>
    </div>}

    {/* MODAL NUEVO SERVICIO */}
    {showSForm&&<div className="ov" onClick={()=>setShowSForm(false)}>
      <div className="modal" style={{maxHeight:"90vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <h3>📋 Nuevo servicio de jardinería</h3>
        <div className="fg"><label>Jardinero *</label>
          <select className="fi" value={sForm.jardinero_id} onChange={e=>selJardinero(e.target.value)}>
            <option value="">Seleccionar…</option>
            {jardineros.filter(j=>j.activo).map(j=><option key={j.id} value={j.id}>{j.nombre} ({j.modalidad})</option>)}
          </select>
        </div>
        <div className="fg"><label>Título *</label><input className="fi" value={sForm.titulo} onChange={e=>setSForm(v=>({...v,titulo:e.target.value}))} placeholder="Ej: Mantenimiento semanal abril"/></div>
        <div className="fg"><label>Descripción</label><textarea className="fi" rows={2} value={sForm.descripcion} onChange={e=>setSForm(v=>({...v,descripcion:e.target.value}))} placeholder="Detalles del servicio…"/></div>
        {sForm.jardinero_id&&<>
          <div className="fg"><label>Modalidad de pago</label>
            <select className="fi" value={sForm.modalidad} onChange={e=>setSForm(v=>({...v,modalidad:e.target.value}))}>{MODAL_JARDINERO.map(m=><option key={m}>{m}</option>)}</select>
          </div>
          {sForm.modalidad==="Por horas"&&<div className="fg"><label>Tarifa €/hora</label><input type="number" inputMode="decimal" className="fi" value={sForm.tarifa_hora} onChange={e=>setSForm(v=>({...v,tarifa_hora:e.target.value}))} placeholder="Ej: 15"/></div>}
          {sForm.modalidad==="Precio fijo por servicio"&&<div className="fg"><label>Importe total acordado (€)</label><input type="number" inputMode="decimal" className="fi" value={sForm.importe_fijo} onChange={e=>setSForm(v=>({...v,importe_fijo:e.target.value}))} placeholder="Ej: 500"/></div>}
          {sForm.modalidad==="Fijo mensual"&&<div style={{fontSize:12,color:"#7a7f94",marginBottom:14,background:"rgba(201,168,76,.06)",borderRadius:8,padding:"10px 12px"}}>El jardinero tiene tarifa fija mensual. El coste se gestiona automáticamente.</div>}
        </>}
        <div className="fg"><label>Fecha inicio prevista</label><input type="date" className="fi" value={sForm.fecha_inicio} onChange={e=>setSForm(v=>({...v,fecha_inicio:e.target.value}))}/></div>
        <div className="fg">
          <label>Tareas ({sForm.tareas.length})</label>
          <div style={{display:"flex",gap:8}}>
            <input className="fi" style={{flex:1}} value={nuevaTarea} onChange={e=>setNuevaTarea(e.target.value)} placeholder="Escribir tarea…" onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addTareaSrv();}}}/>
            <button className="btn bp sm" onClick={addTareaSrv} style={{flexShrink:0}}>+</button>
          </div>
          {sForm.tareas.length>0&&<div style={{marginTop:8}}>
            {sForm.tareas.map((t,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",background:"rgba(255,255,255,.03)",borderRadius:8,marginBottom:4}}>
              <span style={{color:"#c9a84c",fontSize:12,flexShrink:0}}>{i+1}.</span>
              <span style={{flex:1,fontSize:13,color:"#c9c5b8"}}>{t}</span>
              <button onClick={()=>removeTareaSrv(i)} style={{background:"none",border:"none",color:"#e85555",cursor:"pointer",fontSize:15,padding:"0 4px"}}>×</button>
            </div>)}
          </div>}
        </div>
        <div className="mft"><button className="btn bg" onClick={()=>setShowSForm(false)}>Cancelar</button><button className="btn bp" onClick={crearServicio} disabled={saving||!sForm.jardinero_id||!sForm.titulo}>{saving?"Creando…":"📋 Crear servicio"}</button></div>
      </div>
    </div>}

    {/* MODAL FINALIZAR SERVICIO ADMIN */}
    {showFinSrvAdmin&&<div className="ov" onClick={()=>setShowFinSrvAdmin(null)}>
      <div className="modal" style={{maxWidth:440}} onClick={e=>e.stopPropagation()}>
        <h3>✅ Finalizar servicio</h3>
        {(()=>{
          const s=showFinSrvAdmin;
          const horasT=parseFloat(s.horas_totales)||0;
          const mod=s.modalidad||"por_horas";
          let costeTotal=0;
          if(mod==="por_horas")costeTotal=Math.round(horasT*(parseFloat(s.tarifa_hora)||0)*100)/100;
          else if(mod==="precio_fijo_servicio")costeTotal=parseFloat(s.importe_fijo)||0;
          return <>
            <div style={{background:"rgba(201,168,76,.06)",border:"1px solid rgba(201,168,76,.15)",borderRadius:10,padding:"14px",marginBottom:16}}>
              <div style={{fontSize:14,fontWeight:600,color:"#c9a84c",marginBottom:6}}>{s.titulo}</div>
              <div style={{fontSize:13,color:"#c9c5b8"}}>👤 {s.jardinero_nombre} · ⏱ {horasT}h</div>
              <div style={{fontSize:16,fontWeight:700,color:"#e8e6e1",marginTop:8}}>Coste: {costeTotal.toLocaleString("es-ES")}€</div>
              {horasT>0&&<div style={{fontSize:12,color:"#6366f1",marginTop:3}}>💡 €/hora real: {(costeTotal/horasT).toFixed(2)}€</div>}
            </div>
            <div style={{fontSize:13,color:"#7a7f94",marginBottom:16}}>¿Registrar {costeTotal}€ como gasto de jardinería?</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <button className="btn bp" style={{width:"100%",justifyContent:"center",padding:"12px",fontSize:14}} onClick={()=>finalizarSrv(s.id,true)} disabled={finSaving}>{finSaving?"Procesando…":"✅ Finalizar y registrar gasto"}</button>
              <button className="btn bg" style={{width:"100%",justifyContent:"center"}} onClick={()=>finalizarSrv(s.id,false)} disabled={finSaving}>Finalizar sin registrar gasto</button>
              <button className="btn bg" style={{width:"100%",justifyContent:"center"}} onClick={()=>setShowFinSrvAdmin(null)}>Cancelar</button>
            </div>
          </>;
        })()}
      </div>
    </div>}
  </>;
}

// ─── GASTOS ─────────────────────────────────────────────────────────────────
const GASTO_CATS=["Personal","Suministros","Consumibles","Material & Reposición","Mantenimiento","Comisión gestor","Otros"];
const GASTO_AUTO=["auto_comision","auto_limpieza","auto_jardineria","auto_recurrente"];

function Gastos({tok}){
  const hoy=new Date();
  const hoyStr=hoy.toISOString().split("T")[0];
  const mesIni=`${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,"0")}-01`;
  const mesFin=(()=>{const ld=new Date(hoy.getFullYear(),hoy.getMonth()+1,0);return ld.toISOString().split("T")[0];})();

  const [gastos,setGastos]=useState([]);
  const [load,setLoad]=useState(true);
  const [desde,setDesde]=useState(mesIni);
  const [hasta,setHasta]=useState(mesFin);
  const [catFiltro,setCatFiltro]=useState("todas");
  const [showForm,setShowForm]=useState(false);
  const [saving,setSaving]=useState(false);

  const formVacio={fecha:hoyStr,categoria:"Personal",concepto:"",importe:"",recurrente:false,frecuencia:"mensual",notas:""};
  const [form,setForm]=useState(formVacio);

  const load_=async()=>{
    setLoad(true);
    try{
      const g=await sbGet("gastos",`?fecha=gte.${desde}&fecha=lte.${hasta}&select=*&order=fecha.desc,created_at.desc`,tok);
      setGastos(g);
    }catch(_){}
    setLoad(false);
  };
  useEffect(()=>{load_();},[desde,hasta]);

  const crear=async()=>{
    if(!form.concepto||!form.importe||saving)return;
    setSaving(true);
    try{
      await sbPost("gastos",{
        fecha:form.fecha,categoria:form.categoria,concepto:form.concepto,
        importe:parseFloat(form.importe)||0,
        recurrente:form.recurrente,
        frecuencia:form.recurrente?form.frecuencia:null,
        notas:form.notas||null,origen:"manual"
      },tok);
      setShowForm(false);setForm(formVacio);await load_();
    }catch(_){}
    setSaving(false);
  };

  const eliminar=async g=>{
    if(!window.confirm(`¿Eliminar "${g.concepto}"?`))return;
    await sbDelete("gastos",`id=eq.${g.id}`,tok);
    await load_();
  };

  const filtrados=catFiltro==="todas"?gastos:gastos.filter(g=>g.categoria===catFiltro);
  const total=filtrados.reduce((s,g)=>s+(parseFloat(g.importe)||0),0);
  const cats=[...new Set(gastos.map(g=>g.categoria).filter(Boolean))];

  const periodos=[
    {lbl:"Este mes",d:mesIni,h:mesFin},
    {lbl:"Este año",d:`${hoy.getFullYear()}-01-01`,h:`${hoy.getFullYear()}-12-31`},
    {lbl:"Último trimestre",d:(()=>{const d=new Date(hoy);d.setMonth(d.getMonth()-3);return d.toISOString().split("T")[0];})(),h:hoyStr},
  ];

  const origenLbl=o=>{
    if(o==="auto_comision")return "Comisión auto";
    if(o==="auto_recurrente")return "Recurrente auto";
    if(o==="auto_limpieza")return "Limpieza auto";
    if(o==="auto_jardineria")return "Jardinería auto";
    return null;
  };

  return <>
    <div className="ph"><h2>💸 Gastos</h2><p>Control de gastos de la finca</p></div>
    <div className="pb">
      {/* FILTROS PERÍODO */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
        {periodos.map(p=>(
          <button key={p.lbl} className={`btn sm${desde===p.d&&hasta===p.h?" bp":" bg"}`} onClick={()=>{setDesde(p.d);setHasta(p.h);}}>{p.lbl}</button>
        ))}
      </div>
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <input type="date" className="fi" value={desde} onChange={e=>setDesde(e.target.value)} style={{flex:1,minWidth:130}}/>
        <span style={{color:"#5a5e6e",fontSize:12}}>→</span>
        <input type="date" className="fi" value={hasta} onChange={e=>setHasta(e.target.value)} style={{flex:1,minWidth:130}}/>
      </div>

      {/* FILTRO CATEGORÍA */}
      {cats.length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:14}}>
        <button className={`btn sm${catFiltro==="todas"?" bp":" bg"}`} onClick={()=>setCatFiltro("todas")}>Todas</button>
        {cats.map(c=><button key={c} className={`btn sm${catFiltro===c?" bp":" bg"}`} onClick={()=>setCatFiltro(c)}>{c}</button>)}
      </div>}

      {/* TOTAL + BOTÓN */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,gap:12,flexWrap:"wrap"}}>
        <div style={{background:"rgba(232,85,85,.08)",border:"1px solid rgba(232,85,85,.2)",borderRadius:10,padding:"12px 18px"}}>
          <div style={{fontSize:10,color:"#e85555",textTransform:"uppercase",letterSpacing:.5}}>Total período</div>
          <div style={{fontSize:22,fontWeight:700,color:"#e85555",fontFamily:"'Playfair Display',serif"}}>{total.toLocaleString("es-ES",{minimumFractionDigits:0,maximumFractionDigits:2})}€</div>
          <div style={{fontSize:11,color:"#5a5e6e"}}>{filtrados.length} gasto{filtrados.length!==1?"s":""}</div>
        </div>
        <button className="btn bp" onClick={()=>{setForm(formVacio);setShowForm(true);}}>➕ Añadir gasto</button>
      </div>

      {/* LISTADO */}
      {load?<div className="loading"><div className="spin"/><span>Cargando…</span></div>
      :filtrados.length===0?<div className="empty"><span className="ico">💸</span><p>Sin gastos en este período</p></div>
      :filtrados.map(g=>{
        const esAuto=GASTO_AUTO.includes(g.origen);
        const olbl=origenLbl(g.origen);
        return <div key={g.id} className="card" style={{marginBottom:8,borderLeft:`3px solid ${g.categoria==="Comisión gestor"?"#6366f1":"#e85555"}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:14,fontWeight:600,color:"#e8e6e1",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{g.concepto}</div>
              <div style={{display:"flex",gap:6,marginTop:5,flexWrap:"wrap"}}>
                <span className="badge" style={{background:"rgba(232,85,85,.1)",color:"#e85555"}}>{g.categoria||"Sin categoría"}</span>
                {g.recurrente&&<span className="badge" style={{background:"rgba(201,168,76,.1)",color:"#c9a84c"}}>🔁 {g.frecuencia||"mensual"}</span>}
                {olbl&&<span className="badge" style={{background:"rgba(99,102,241,.1)",color:"#a5b4fc"}}>{olbl}</span>}
              </div>
              <div style={{fontSize:11,color:"#5a5e6e",marginTop:4}}>📅 {new Date(g.fecha+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"long",year:"numeric"})}</div>
              {g.notas&&<div style={{fontSize:11,color:"#7a7f94",marginTop:3}}>{g.notas}</div>}
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontSize:18,fontWeight:700,color:"#e85555",fontFamily:"'Playfair Display',serif"}}>{parseFloat(g.importe||0).toLocaleString("es-ES")}€</div>
              {!esAuto&&<button className="btn br sm" style={{marginTop:6}} onClick={()=>eliminar(g)}>🗑</button>}
            </div>
          </div>
        </div>;
      })}
    </div>

    {/* MODAL NUEVO GASTO */}
    {showForm&&<div className="ov" onClick={()=>setShowForm(false)}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <h3>💸 Añadir gasto</h3>
        <div className="g2">
          <div className="fg"><label>Fecha *</label><input type="date" className="fi" value={form.fecha} onChange={e=>setForm(v=>({...v,fecha:e.target.value}))}/></div>
          <div className="fg"><label>Categoría</label><select className="fi" value={form.categoria} onChange={e=>setForm(v=>({...v,categoria:e.target.value}))}>{GASTO_CATS.map(c=><option key={c}>{c}</option>)}</select></div>
        </div>
        <div className="fg"><label>Concepto *</label><input className="fi" value={form.concepto} onChange={e=>setForm(v=>({...v,concepto:e.target.value}))} placeholder="Ej: Compra de cloro para piscina"/></div>
        <div className="fg"><label>Importe (€) *</label><input type="number" inputMode="decimal" className="fi" value={form.importe} onChange={e=>setForm(v=>({...v,importe:e.target.value}))} placeholder="0"/></div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
          <div onClick={()=>setForm(v=>({...v,recurrente:!v.recurrente}))}
            style={{width:22,height:22,borderRadius:6,flexShrink:0,border:`2px solid ${form.recurrente?"#c9a84c":"rgba(255,255,255,.15)"}`,background:form.recurrente?"#c9a84c":"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:12,color:"#fff",fontWeight:700}}>
            {form.recurrente?"✓":""}
          </div>
          <span style={{fontSize:13,color:"#c9c5b8"}}>¿Es recurrente?</span>
          {form.recurrente&&<select className="fi" value={form.frecuencia} onChange={e=>setForm(v=>({...v,frecuencia:e.target.value}))} style={{width:"auto",flex:"none",padding:"6px 30px 6px 10px"}}>
            <option value="mensual">Mensual</option>
            <option value="anual">Anual</option>
          </select>}
        </div>
        <div className="fg"><label>Notas (opcional)</label><textarea className="fi" rows={2} value={form.notas} onChange={e=>setForm(v=>({...v,notas:e.target.value}))} placeholder="Detalles adicionales…"/></div>
        <div className="mft">
          <button className="btn bg" onClick={()=>setShowForm(false)}>Cancelar</button>
          <button className="btn bp" onClick={crear} disabled={saving||!form.concepto||!form.importe}>{saving?"Guardando…":"💸 Guardar gasto"}</button>
        </div>
      </div>
    </div>}
  </>;
}

// ─── CALENDARIO ──────────────────────────────────────────────────────────────
// helper: given airbnb rows, get all dates in range
function airbnbFechas(airbnbs){
  const fechas=new Set();
  for(const a of airbnbs){
    const d=new Date(a.fecha_entrada+"T12:00:00");
    const fin=new Date(a.fecha_salida+"T12:00:00");
    while(d<=fin){
      fechas.add(d.toISOString().split("T")[0]);
      d.setDate(d.getDate()+1);
    }
  }
  return fechas;
}

// CalBase now receives rol to filter info
function CalBase({tok,rol="admin"}){
  const isA=rol==="admin";
  const isC=rol==="comercial";
  const isL=rol==="limpieza";
  const isJ=rol==="jardinero";

  const today=new Date();
  const [mes,setMes]=useState(today.getMonth());
  const [año,setAño]=useState(today.getFullYear());
  const [sel,setSel]=useState(null);
  const [reservas,setReservas]=useState([]);
  const [airbnbs,setAirbnbs]=useState([]);
  const [busqueda,setBusqueda]=useState("");
  const [resultadoBusqueda,setResultadoBusqueda]=useState(null);

  useEffect(()=>{
    sbGet("reservas","?select=*&order=fecha.asc",tok).then(setReservas).catch(()=>{});
    sbGet("reservas_airbnb","?select=*&order=fecha_entrada.asc",tok).then(setAirbnbs).catch(()=>{});
  },[]);

  const pm=()=>mes===0?(setMes(11),setAño(y=>y-1)):setMes(m=>m-1);
  const nm=()=>mes===11?(setMes(0),setAño(y=>y+1)):setMes(m=>m+1);
  const ds=d=>`${año}-${String(mes+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

  // Dates blocked by airbnb
  const airbnbDates=airbnbFechas(airbnbs);

  // Reservas normales para un día
  const grReservas=d=>reservas.filter(r=>r.fecha===ds(d));
  // Airbnbs que cubren un día
  const grAirbnb=d=>{
    const fecha=ds(d);
    return airbnbs.filter(a=>a.fecha_entrada<=fecha&&a.fecha_salida>=fecha);
  };

  const off=new Date(año,mes,1).getDay();
  const ofs=off===0?6:off-1;
  const dim=new Date(año,mes+1,0).getDate();

  const rsvMes=reservas.filter(r=>{const d=new Date(r.fecha);return d.getMonth()===mes&&d.getFullYear()===año;}).sort((a,b)=>new Date(a.fecha)-new Date(b.fecha));
  const airbnbMes=airbnbs.filter(a=>{
    // Show if range overlaps with current month
    const ini=new Date(a.fecha_entrada+"T12:00:00");
    const fin=new Date(a.fecha_salida+"T12:00:00");
    return (ini.getMonth()===mes&&ini.getFullYear()===año)||(fin.getMonth()===mes&&fin.getFullYear()===año)||(ini<new Date(año,mes,1)&&fin>=new Date(año,mes,1));
  });

  const buscar=()=>{
    if(!busqueda)return;
    const fecha=busqueda;
    const rsvFecha=reservas.filter(r=>r.fecha===fecha);
    const airFecha=airbnbs.filter(a=>a.fecha_entrada<=fecha&&a.fecha_salida>=fecha);
    const ocupado=rsvFecha.length>0||airFecha.length>0;
    const d=new Date(fecha+"T12:00:00");
    setMes(d.getMonth());setAño(d.getFullYear());setSel(d.getDate());
    setResultadoBusqueda({fecha,reservas:rsvFecha,airbnbs:airFecha,libre:!ocupado});
  };
  const limpiarBusqueda=()=>{setBusqueda("");setResultadoBusqueda(null);setSel(null);};

  const fmtRango=a=>`${new Date(a.fecha_entrada+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"})} – ${new Date(a.fecha_salida+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"})}`;

  return <>
    {/* BUSCADOR - visible para admin y comercial */}
    {(isA||isC)&&<div style={{background:"#13161f",border:"1px solid rgba(201,168,76,.2)",borderRadius:12,padding:"14px 16px",marginBottom:14}}>
      <div style={{fontSize:11,color:"#c9a84c",textTransform:"uppercase",letterSpacing:1,fontWeight:600,marginBottom:10}}>🔍 Consultar disponibilidad</div>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        <input type="date" className="fi" value={busqueda} onChange={e=>{setBusqueda(e.target.value);setResultadoBusqueda(null);}} style={{flex:1,minWidth:140}}/>
        <button className="btn bp" onClick={buscar} disabled={!busqueda} style={{flexShrink:0}}>Buscar</button>
        {resultadoBusqueda&&<button className="btn bg" onClick={limpiarBusqueda} style={{flexShrink:0}}>✕</button>}
      </div>
      {resultadoBusqueda&&(
        <div style={{marginTop:12,padding:"12px 14px",borderRadius:10,background:resultadoBusqueda.libre?"rgba(16,185,129,.08)":"rgba(232,85,85,.08)",border:`1px solid ${resultadoBusqueda.libre?"rgba(16,185,129,.25)":"rgba(232,85,85,.25)"}`}}>
          <div style={{fontSize:14,fontWeight:600,color:resultadoBusqueda.libre?"#10b981":"#e85555",marginBottom:(resultadoBusqueda.reservas.length+resultadoBusqueda.airbnbs.length)>0?8:0}}>
            {resultadoBusqueda.libre?"✅ Fecha disponible — sin reservas":"❌ Fecha no disponible"}
          </div>
          {/* Comercial: solo muestra "Ocupado" sin detalles de airbnb */}
          {isC&&!resultadoBusqueda.libre&&resultadoBusqueda.airbnbs.length>0&&resultadoBusqueda.reservas.length===0&&(
            <div style={{fontSize:13,color:"#e85555"}}>🔴 Fecha bloqueada</div>
          )}
          {/* Admin: muestra todo */}
          {isA&&resultadoBusqueda.reservas.map(r=>{
            const est=ESTADOS.find(e=>e.id===r.estado);
            return <div key={r.id} style={{display:"flex",justifyContent:"space-between",gap:8,marginTop:6,paddingTop:6,borderTop:"1px solid rgba(255,255,255,.06)"}}>
              <div><div style={{fontSize:13,fontWeight:600,color:"#e8e6e1"}}>{r.nombre}</div>{r.tipo&&<div style={{fontSize:11,color:"#7a7f94"}}>🎉 {r.tipo}</div>}</div>
              {est&&<span className="badge" style={{background:`${est.col}18`,color:est.col,border:`1px solid ${est.col}30`,flexShrink:0}}>{est.lbl}</span>}
            </div>;
          })}
          {isA&&resultadoBusqueda.airbnbs.map(a=>(
            <div key={a.id} style={{display:"flex",justifyContent:"space-between",gap:8,marginTop:6,paddingTop:6,borderTop:"1px solid rgba(255,255,255,.06)"}}>
              <div><div style={{fontSize:13,fontWeight:600,color:"#e8e6e1"}}>🏠 {a.huesped}</div><div style={{fontSize:11,color:"#7a7f94"}}>{fmtRango(a)}</div></div>
              <span className="badge" style={{background:"rgba(16,185,129,.12)",color:"#10b981",border:"1px solid rgba(16,185,129,.25)",flexShrink:0}}>Airbnb</span>
            </div>
          ))}
          {/* Comercial: muestra evento pero no airbnb info */}
          {isC&&resultadoBusqueda.reservas.map(r=>{
            const est=ESTADOS.find(e=>e.id===r.estado);
            return <div key={r.id} style={{display:"flex",justifyContent:"space-between",gap:8,marginTop:6,paddingTop:6,borderTop:"1px solid rgba(255,255,255,.06)"}}>
              <div><div style={{fontSize:13,fontWeight:600,color:"#e8e6e1"}}>{r.nombre}</div>{r.tipo&&<div style={{fontSize:11,color:"#7a7f94"}}>🎉 {r.tipo}</div>}</div>
              {est&&<span className="badge" style={{background:`${est.col}18`,color:est.col,border:`1px solid ${est.col}30`,flexShrink:0}}>{est.lbl}</span>}
            </div>;
          })}
        </div>
      )}
    </div>}

    {/* CALENDARIO */}
    <div className="cal-card" style={{overflow:"hidden"}}>
      <div className="cnav"><button onClick={pm}>‹</button><span className="cmon">{MESES[mes]} {año}</span><button onClick={nm}>›</button></div>
      <div className="cg">
        {D_SEM.map(d=><div key={d} className="ch">{d}</div>)}
        {Array(ofs).fill(null).map((_,i)=><div key={`e${i}`} className="cd empty"/>)}
        {Array(dim).fill(null).map((_,i)=>{
          const d=i+1;
          const fecha=ds(d);
          const rsv=grReservas(d);
          const airD=grAirbnb(d);
          const isT=d===today.getDate()&&mes===today.getMonth()&&año===today.getFullYear();
          const isBusq=resultadoBusqueda&&fecha===resultadoBusqueda.fecha;
          const hasAir=airD.length>0;
          const hasRsv=rsv.length>0;
          return <div key={d}
            className={`cd${isT?" today":""}${(hasRsv||hasAir)?" hasev":""}${sel===d?" sel":""}`}
            style={{
              ...(isBusq?{boxShadow:"0 0 0 2px #c9a84c",background:"rgba(201,168,76,.12)"}:{}),
              // Airbnb days: reddish tint (for comercial just shows blocked, no info)
              ...(hasAir&&!hasRsv?{background:"rgba(232,85,85,.08)"}:{}),
            }}
            onClick={()=>setSel(sel===d?null:d)}>
            <span>{d}</span>
            {hasRsv&&<div className="cdot" style={{background:ESTADOS.find(e=>e.id===rsv[0].estado)?.col||"#6366f1"}}/>}
            {hasAir&&!hasRsv&&<div className="cdot" style={{background:"#e85555"}}/>}
            {hasAir&&hasRsv&&<div style={{display:"flex",gap:2,marginTop:2}}><div className="cdot" style={{background:ESTADOS.find(e=>e.id===rsv[0].estado)?.col||"#6366f1"}}/><div className="cdot" style={{background:"#e85555"}}/></div>}
          </div>;
        })}
      </div>
    </div>

    {/* LEYENDA */}
    <div style={{display:"flex",gap:12,marginTop:8,marginBottom:4,flexWrap:"wrap"}}>
      <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"#7a7f94"}}><div style={{width:8,height:8,borderRadius:"50%",background:"#6366f1"}}/> Evento</div>
      {(isA||isL||isJ)&&<div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"#7a7f94"}}><div style={{width:8,height:8,borderRadius:"50%",background:"#e85555"}}/> {isC?"Bloqueado":"Airbnb"}</div>}
      {isC&&<div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"#7a7f94"}}><div style={{width:8,height:8,borderRadius:"50%",background:"#e85555"}}/> No disponible</div>}
    </div>

    {/* DETALLE DÍA SELECCIONADO */}
    {sel&&<div style={{marginTop:10}}>
      {/* Eventos del día */}
      {grReservas(sel).length===0&&grAirbnb(sel).length===0&&(
        <div className="card"><div className="empty"><span className="ico">✅</span><p>{sel} de {MESES[mes]} — Libre</p></div></div>
      )}
      {grReservas(sel).map(r=>{
        const est=ESTADOS.find(e=>e.id===r.estado);
        return <div key={r.id} className="card" style={{marginBottom:8,borderLeft:`3px solid ${est?.col||"#6366f1"}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
            <div style={{minWidth:0}}>
              <div style={{fontSize:14,fontWeight:600,color:"#e8e6e1"}}>{r.nombre}</div>
              {r.tipo&&<div style={{fontSize:12,color:"#7a7f94",marginTop:3}}>🎉 {r.tipo}</div>}
              {isA&&r.precio&&<div style={{fontSize:12,color:"#c9a84c",marginTop:2}}>💰 {parseFloat(r.precio).toLocaleString("es-ES")}€</div>}
            </div>
            {est&&<span className="badge" style={{background:`${est.col}18`,color:est.col,border:`1px solid ${est.col}30`,flexShrink:0}}>{est.lbl}</span>}
          </div>
        </div>;
      })}
      {/* Airbnb del día — admin y limpieza ven info, comercial ve bloqueado, jardinero ve rango */}
      {grAirbnb(sel).map(a=>(
        isC
          ?<div key={a.id} className="card" style={{marginBottom:8,borderLeft:"3px solid #e85555"}}>
            <div style={{fontSize:14,fontWeight:600,color:"#e85555"}}>🔴 Fecha no disponible</div>
          </div>
          :<div key={a.id} className="card" style={{marginBottom:8,borderLeft:"3px solid #10b981"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
              <div>
                <div style={{fontSize:12,color:"#10b981",fontWeight:600,marginBottom:3}}>🏠 Airbnb</div>
                {(isA||isL)&&<div style={{fontSize:14,fontWeight:600,color:"#e8e6e1"}}>{a.huesped}</div>}
                {isJ&&<div style={{fontSize:14,fontWeight:600,color:"#e8e6e1"}}>Alojamiento turístico</div>}
                <div style={{fontSize:12,color:"#7a7f94",marginTop:3}}>📅 {fmtRango(a)}{a.personas?` · 👥 ${a.personas} personas`:""}</div>
                {isA&&a.precio&&<div style={{fontSize:12,color:"#c9a84c",marginTop:2}}>💰 {parseFloat(a.precio).toLocaleString("es-ES")}€</div>}
              </div>
              <span className="badge" style={{background:"rgba(16,185,129,.12)",color:"#10b981",border:"1px solid rgba(16,185,129,.25)",flexShrink:0}}>Airbnb</span>
            </div>
          </div>
      ))}
    </div>}

    {/* LISTA MES - para limpieza y jardinero */}
    {(isL||isJ)&&!sel&&<div style={{marginTop:14}}>
      {rsvMes.length===0&&airbnbMes.length===0
        ?<div className="card"><div className="empty"><span className="ico">✅</span><p>Sin eventos este mes</p></div></div>
        :<>
          {rsvMes.map(r=><div key={r.id} className="card" style={{marginBottom:8,borderLeft:"3px solid #6366f1"}}>
            <div style={{fontSize:13,fontWeight:600,color:"#e8e6e1"}}>{r.nombre}</div>
            <div style={{fontSize:12,color:"#7a7f94",marginTop:3}}>📅 {new Date(r.fecha).toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"})}</div>
            {r.tipo&&<div style={{fontSize:11,color:"#5a5e6e",marginTop:2}}>🎉 {r.tipo}</div>}
          </div>)}
          {airbnbMes.map(a=><div key={a.id} className="card" style={{marginBottom:8,borderLeft:"3px solid #10b981"}}>
            <div style={{fontSize:13,fontWeight:600,color:"#e8e6e1"}}>{isL?`🏠 Airbnb: ${a.huesped}`:"🏠 Alojamiento turístico"}</div>
            <div style={{fontSize:12,color:"#7a7f94",marginTop:3}}>📅 {fmtRango(a)}{a.personas?` · 👥 ${a.personas} personas`:""}</div>
          </div>)}
        </>}
    </div>}
  </>;
}

function Calendario({tok,rol}){
  return <><div className="ph"><h2>Calendario de reservas</h2></div><div className="pb" style={{maxWidth:900}}><CalBase tok={tok} rol={rol}/></div></>;
}
function CalLimpieza({tok}){
  return <><div className="ph"><h2>Calendario</h2><p>Próximos eventos y alojamientos</p></div><div className="pb" style={{maxWidth:900}}><CalBase tok={tok} rol="limpieza"/></div></>;
}
function CalJardin({tok}){
  return <><div className="ph"><h2>Calendario de la finca</h2><p>Próximos eventos y alojamientos</p></div><div className="pb" style={{maxWidth:900}}><CalBase tok={tok} rol="jardinero"/></div></>;
}

// ─── HELPERS HISTORIAL Y DOCS ────────────────────────────────────────────────
async function addHistorial(entidad_tipo, entidad_id, texto, creado_por, tok, tipo="auto"){
  try{await sbPost("historial",{entidad_tipo,entidad_id,texto,tipo,creado_por},tok);}catch(_){}
}
async function uploadDoc(file, tok){
  const ext=file.name.split(".").pop();
  const path=`${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const r=await fetch(`${SB_URL}/storage/v1/object/documentos/${path}`,{
    method:"POST",headers:{"apikey":SB_KEY,"Authorization":`Bearer ${tok}`,"Content-Type":file.type},body:file
  });
  if(!r.ok)throw new Error(await r.text());
  return {url:`${SB_URL}/storage/v1/object/public/documentos/${path}`,nombre:file.name,tipo_archivo:file.type};
}

// ─── HISTORIAL COMPONENT ──────────────────────────────────────────────────────
function Historial({entidad_tipo,entidad_id,tok,perfil}){
  const [items,setItems]=useState([]);
  const [open,setOpen]=useState(false);
  const [nota,setNota]=useState("");
  const [saving,setSaving]=useState(false);
  const [load,setLoad]=useState(false);

  const cargar=async()=>{
    setLoad(true);
    try{
      const h=await sbGet("historial",`?entidad_tipo=eq.${entidad_tipo}&entidad_id=eq.${entidad_id}&order=created_at.asc`,tok);
      setItems(h);
    }catch(_){}
    setLoad(false);
  };

  useEffect(()=>{if(open)cargar();},[open]);

  const addNota=async()=>{
    if(!nota.trim()||saving)return;
    setSaving(true);
    await addHistorial(entidad_tipo,entidad_id,nota.trim(),perfil.nombre,tok,"manual");
    setNota("");await cargar();setSaving(false);
  };

  const iconTipo=(txt)=>{
    if(txt.includes("creada")||txt.includes("registrada"))return "✨";
    if(txt.includes("realizada"))return "✅";
    if(txt.includes("reserva"))return "📋";
    if(txt.includes("cancelad"))return "❌";
    if(txt.includes("presentó"))return "🚫";
    if(txt.includes("contrato")||txt.includes("firmado"))return "✍️";
    if(txt.includes("pago")||txt.includes("pagado"))return "💰";
    return "📝";
  };

  return <div style={{marginTop:16,borderTop:"1px solid rgba(255,255,255,.06)",paddingTop:14}}>
    <button onClick={()=>setOpen(!open)} style={{background:"none",border:"none",cursor:"pointer",color:"#7a7f94",fontSize:13,display:"flex",alignItems:"center",gap:6,padding:0,fontFamily:"'DM Sans',sans-serif",width:"100%",justifyContent:"space-between"}}>
      <span>📋 Historial de movimientos</span>
      <span style={{transition:"transform .2s",transform:open?"rotate(90deg)":"none",fontSize:16}}>›</span>
    </button>
    {open&&<div style={{marginTop:12}}>
      {load?<div style={{color:"#5a5e6e",fontSize:13,padding:"8px 0"}}>Cargando…</div>
        :items.length===0?<div style={{color:"#3d4155",fontSize:13,padding:"8px 0",fontStyle:"italic"}}>Sin movimientos registrados</div>
        :<div style={{position:"relative",paddingLeft:20}}>
          <div style={{position:"absolute",left:7,top:0,bottom:0,width:1,background:"rgba(255,255,255,.08)"}}/>
          {items.map((h,i)=>(
            <div key={h.id} style={{position:"relative",marginBottom:12}}>
              <div style={{position:"absolute",left:-20,top:2,width:14,height:14,borderRadius:"50%",background:h.tipo==="manual"?"#c9a84c":"#3d4155",border:"2px solid #0f1117",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8}}/>
              <div style={{fontSize:12,color:h.tipo==="manual"?"#c9c5b8":"#7a7f94",lineHeight:1.4}}>{iconTipo(h.texto)} {h.texto}</div>
              <div style={{fontSize:10,color:"#3d4155",marginTop:2}}>{fmtDT(h.created_at)}{h.creado_por&&` · ${h.creado_por}`}</div>
            </div>
          ))}
        </div>}
      <div style={{marginTop:10,display:"flex",gap:6}}>
        <input className="fi" value={nota} onChange={e=>setNota(e.target.value)} placeholder="Añadir nota manual…" style={{fontSize:12,padding:"7px 10px"}} onKeyDown={e=>e.key==="Enter"&&addNota()}/>
        <button className="btn bp sm" onClick={addNota} disabled={saving||!nota.trim()}>+</button>
      </div>
    </div>}
  </div>;
}

// ─── DOCUMENTOS COMPONENT ────────────────────────────────────────────────────
function Documentos({entidad_tipo,entidad_id,tok,perfil}){
  const [docs,setDocs]=useState([]);
  const [open,setOpen]=useState(false);
  const [uploading,setUploading]=useState(false);
  const [load,setLoad]=useState(false);

  const cargar=async()=>{
    setLoad(true);
    try{
      const d=await sbGet("documentos",`?entidad_tipo=eq.${entidad_tipo}&entidad_id=eq.${entidad_id}&order=created_at.desc`,tok);
      setDocs(d);
    }catch(_){}
    setLoad(false);
  };

  useEffect(()=>{if(open)cargar();},[open]);

  const subir=async(e)=>{
    const files=Array.from(e.target.files);
    if(!files.length)return;
    setUploading(true);
    for(const file of files){
      try{
        const {url,nombre,tipo_archivo}=await uploadDoc(file,tok);
        await sbPost("documentos",{entidad_tipo,entidad_id,nombre,url,tipo_archivo,subido_por:perfil.nombre},tok);
      }catch(_){}
    }
    await cargar();
    setUploading(false);
    e.target.value="";
  };

  const eliminar=async(doc)=>{
    if(!window.confirm(`¿Eliminar "${doc.nombre}"?`))return;
    await sbDelete("documentos",`id=eq.${doc.id}`,tok);
    setDocs(prev=>prev.filter(d=>d.id!==doc.id));
  };

  const icono=(tipo)=>{
    if(!tipo)return "📄";
    if(tipo.includes("pdf"))return "📑";
    if(tipo.includes("image"))return "🖼️";
    if(tipo.includes("word")||tipo.includes("document"))return "📝";
    if(tipo.includes("sheet")||tipo.includes("excel"))return "📊";
    return "📄";
  };

  return <div style={{marginTop:16,borderTop:"1px solid rgba(255,255,255,.06)",paddingTop:14}}>
    <button onClick={()=>setOpen(!open)} style={{background:"none",border:"none",cursor:"pointer",color:"#7a7f94",fontSize:13,display:"flex",alignItems:"center",gap:6,padding:0,fontFamily:"'DM Sans',sans-serif",width:"100%",justifyContent:"space-between"}}>
      <span>📁 Documentos {docs.length>0&&!open?`(${docs.length})`:""}</span>
      <span style={{transition:"transform .2s",transform:open?"rotate(90deg)":"none",fontSize:16}}>›</span>
    </button>
    {open&&<div style={{marginTop:12}}>
      {load?<div style={{color:"#5a5e6e",fontSize:13}}>Cargando…</div>
        :docs.length===0?<div style={{color:"#3d4155",fontSize:13,fontStyle:"italic",marginBottom:10}}>Sin documentos adjuntos</div>
        :<div style={{marginBottom:10}}>
          {docs.map(doc=>(
            <div key={doc.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:"#0f1117",borderRadius:8,marginBottom:6}}>
              <span style={{fontSize:18,flexShrink:0}}>{icono(doc.tipo_archivo)}</span>
              <div style={{flex:1,minWidth:0}}>
                <a href={doc.url} target="_blank" rel="noreferrer" style={{fontSize:13,color:"#c9a84c",textDecoration:"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"block"}}>{doc.nombre}</a>
                <div style={{fontSize:10,color:"#3d4155"}}>{doc.subido_por} · {fmtDT(doc.created_at)}</div>
              </div>
              <button onClick={()=>eliminar(doc)} style={{background:"none",border:"none",color:"#5a5e6e",cursor:"pointer",fontSize:16,padding:4,flexShrink:0}}>🗑</button>
            </div>
          ))}
        </div>}
      <label className="pbtn" style={{fontSize:13,padding:"9px 14px"}}>
        {uploading?"⏳ Subiendo…":"📎 Adjuntar documento"}
        <input type="file" multiple style={{display:"none"}} onChange={subir} disabled={uploading}/>
      </label>
    </div>}
  </div>;
}

// ─── RESERVAS ────────────────────────────────────────────────────────────────
function Reservas({tok,rol,perfil}){
  const isA=rol==="admin";
  const ACTIVOS=["visita","pendiente_contrato","contrato_firmado","reserva_pagada","precio_total"];
  const [reservas,setReservas]=useState([]);
  const [filtro,setFiltro]=useState("activas");
  const [sel,setSel]=useState(null);
  const [load,setLoad]=useState(true);
  const [showSeña,setShowSeña]=useState(false);
  const [señaImporte,setSeñaImporte]=useState("");
  const [showPagoTotal,setShowPagoTotal]=useState(false);
  const [cobroSaving,setCobroSaving]=useState(false);

  const load_=async()=>{
    const r=await sbGet("reservas","?select=*&order=fecha.asc",tok);
    // Auto-finalizar reservas pasadas que siguen activas
    const hoy=new Date().toISOString().split("T")[0];
    const ACTIVOS_=["visita","pendiente_contrato","contrato_firmado","reserva_pagada","precio_total"];
    const pasadas=r.filter(x=>x.fecha<hoy&&ACTIVOS_.includes(x.estado));
    for(const p of pasadas){
      await sbPatch("reservas",`id=eq.${p.id}`,{estado:"finalizada"},tok).catch(()=>{});
      p.estado="finalizada";
    }
    setReservas(r);setLoad(false);
  };
  useEffect(()=>{load_();},[]);

  const cambiarE=async(id,e)=>{
    await sbPatch("reservas",`id=eq.${id}`,{estado:e,updated_at:new Date().toISOString()},tok);
    const est=ESTADOS.find(s=>s.id===e);
    await addHistorial("reserva",id,`Estado cambiado a: ${est?.lbl||e}`,perfil?.nombre||"Admin",tok);
    setReservas(prev=>prev.map(r=>r.id===id?{...r,estado:e}:r));
    setSel(p=>p?.id===id?{...p,estado:e}:p);
  };

  const del=async id=>{
    await sbDelete("reservas",`id=eq.${id}`,tok);
    setReservas(prev=>prev.filter(r=>r.id!==id));
    setSel(null);
  };

  const registrarSeña=async()=>{
    if(!sel||cobroSaving||!señaImporte)return;
    setCobroSaving(true);
    try{
      const imp=parseFloat(señaImporte)||0;
      const hoyStr=new Date().toISOString().split("T")[0];
      await sbPatch("reservas",`id=eq.${sel.id}`,{seña_importe:imp,seña_cobrada:true,seña_fecha:hoyStr,estado_pago:"seña_cobrada"},tok);
      await addHistorial("reserva",sel.id,`Seña cobrada: ${imp.toLocaleString("es-ES")}€`,perfil?.nombre||"Admin",tok);
      const updated={...sel,seña_importe:imp,seña_cobrada:true,seña_fecha:hoyStr,estado_pago:"seña_cobrada"};
      setReservas(prev=>prev.map(r=>r.id===sel.id?{...r,...updated}:r));
      setSel(updated);
      setShowSeña(false);setSeñaImporte("");
    }catch(_){}
    setCobroSaving(false);
  };

  const registrarPagoTotal=async()=>{
    if(!sel||cobroSaving)return;
    setCobroSaving(true);
    try{
      const hoyStr=new Date().toISOString().split("T")[0];
      await sbPatch("reservas",`id=eq.${sel.id}`,{saldo_cobrado:true,saldo_fecha:hoyStr,estado_pago:"pagado_completo"},tok);
      const precioTotal=parseFloat(sel.precio_total)||parseFloat(sel.precio)||0;
      await addHistorial("reserva",sel.id,`Pago total registrado. Total: ${precioTotal.toLocaleString("es-ES")}€`,perfil?.nombre||"Admin",tok);
      // Auto-insertar comisión en gastos
      const configRows=await sbGet("configuracion","?select=*",tok).catch(()=>[]);
      const cfg={};configRows.forEach(c=>cfg[c.clave]=c.valor);
      const comisionPct=parseFloat(cfg.comision_pct)||10;
      const comision=Math.round(precioTotal*comisionPct/100*100)/100;
      if(comision>0){
        await sbPost("gastos",{fecha:hoyStr,categoria:"comision",concepto:`Comisión gestor - ${sel.nombre}`,importe:comision,origen:"auto_comision"},tok).catch(()=>{});
      }
      const updated={...sel,saldo_cobrado:true,saldo_fecha:hoyStr,estado_pago:"pagado_completo"};
      setReservas(prev=>prev.map(r=>r.id===sel.id?{...r,...updated}:r));
      setSel(updated);
      setShowPagoTotal(false);
    }catch(_){}
    setCobroSaving(false);
  };

  if(load)return <div className="loading"><div className="spin"/><span>Cargando…</span></div>;

  const activas=reservas.filter(r=>ACTIVOS.includes(r.estado));
  const finalizadas=reservas.filter(r=>r.estado==="finalizada");
  const canceladas=reservas.filter(r=>r.estado==="cancelada");
  const lista=filtro==="activas"?activas:filtro==="finalizadas"?finalizadas:filtro==="canceladas"?canceladas:reservas;

  const RCard=({r})=>{
    const est=ESTADOS.find(e=>e.id===r.estado);
    return <div className="rc" style={{borderLeftColor:est?.col}} onClick={()=>setSel(r)}>
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
  };

  return <>
    <div className="ph">
      <h2>Reservas</h2>
      <p>{activas.length} activas · {finalizadas.length} finalizadas · {canceladas.length} canceladas</p>
    </div>
    <div className="pb">
      <div className="tabs">
        <button className={`tab${filtro==="activas"?" on":""}`} onClick={()=>{setFiltro("activas");setSel(null);}}>🟢 Activas ({activas.length})</button>
        <button className={`tab${filtro==="finalizadas"?" on":""}`} onClick={()=>{setFiltro("finalizadas");setSel(null);}}>✅ Finalizadas ({finalizadas.length})</button>
        <button className={`tab${filtro==="canceladas"?" on":""}`} onClick={()=>{setFiltro("canceladas");setSel(null);}}>❌ Canceladas ({canceladas.length})</button>
        <button className={`tab${filtro==="todas"?" on":""}`} onClick={()=>{setFiltro("todas");setSel(null);}}>📋 Todas ({reservas.length})</button>
      </div>
      <div className="g2" style={{alignItems:"flex-start"}}>
        <div>
          {lista.length===0
            ?<div className="empty"><span className="ico">📋</span><p>Sin reservas en esta categoría</p></div>
            :lista.map(r=><RCard key={r.id} r={r}/>)}
        </div>
        {sel&&<div className="card" style={{position:"sticky",top:20}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:16,gap:8}}>
            <div style={{minWidth:0}}><div style={{fontSize:18,fontWeight:700,color:"#e8e6e1",fontFamily:"'Playfair Display',serif"}}>{sel.nombre}</div><SBadge e={sel.estado}/></div>
            <button className="btn bg sm" style={{flexShrink:0}} onClick={()=>setSel(null)}>✕</button>
          </div>
          <div className="g2" style={{marginBottom:14}}>
            {[{l:"FECHA",v:new Date(sel.fecha).toLocaleDateString("es-ES",{day:"numeric",month:"long",year:"numeric"})},{l:"PRECIO",v:`${parseFloat(sel.precio||0).toLocaleString("es-ES")}€`,gold:true},{l:"TIPO",v:sel.tipo},{l:"CONTACTO",v:sel.contacto}].filter(x=>x.v).map(x=><div key={x.l} style={{background:"#0f1117",borderRadius:8,padding:11}}><div style={{fontSize:10,color:"#5a5e6e"}}>{x.l}</div><div style={{fontSize:x.gold?16:12,fontWeight:x.gold?700:400,color:x.gold?"#c9a84c":"#e8e6e1",marginTop:3}}>{x.v}</div></div>)}
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
            {/* ── CONTROLES DE COBRO ── */}
            <hr className="div"/>
            <div style={{fontSize:10,color:"#5a5e6e",marginBottom:9,textTransform:"uppercase",letterSpacing:1}}>Estado de cobro</div>
            {(()=>{
              const ep=sel.estado_pago||"pendiente";
              const seña=parseFloat(sel.seña_importe)||0;
              const pt=parseFloat(sel.precio_total)||parseFloat(sel.precio)||0;
              return <>
                {/* Badge estado pago */}
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                  <span className="badge" style={{
                    background:ep==="pagado_completo"?"rgba(16,185,129,.12)":ep==="seña_cobrada"?"rgba(201,168,76,.12)":"rgba(245,158,11,.12)",
                    color:ep==="pagado_completo"?"#10b981":ep==="seña_cobrada"?"#c9a84c":"#f59e0b",
                    border:`1px solid ${ep==="pagado_completo"?"rgba(16,185,129,.3)":ep==="seña_cobrada"?"rgba(201,168,76,.3)":"rgba(245,158,11,.3)"}`
                  }}>{ep==="pagado_completo"?"✅ Pagado completo":ep==="seña_cobrada"?`💰 Seña cobrada: ${seña.toLocaleString("es-ES")}€`:"⏳ Pendiente de cobro"}</span>
                </div>
                {ep==="seña_cobrada"&&<div style={{fontSize:12,color:"#7a7f94",marginBottom:10}}>Saldo pendiente: <strong style={{color:"#f59e0b"}}>{(pt-seña).toLocaleString("es-ES")}€</strong></div>}
                {sel.seña_fecha&&<div style={{fontSize:11,color:"#5a5e6e",marginBottom:4}}>Seña registrada: {new Date(sel.seña_fecha+"T12:00:00").toLocaleDateString("es-ES")}</div>}
                {sel.saldo_fecha&&<div style={{fontSize:11,color:"#5a5e6e",marginBottom:4}}>Saldo registrado: {new Date(sel.saldo_fecha+"T12:00:00").toLocaleDateString("es-ES")}</div>}
                {/* Botón registrar seña */}
                {(ep==="pendiente"||!sel.estado_pago)&&sel.estado!=="cancelada"&&sel.estado!=="finalizada"&&(
                  <button className="btn bp" style={{width:"100%",justifyContent:"center",marginTop:6}} onClick={()=>{setSeñaImporte("");setShowSeña(true);}}>💰 Registrar seña cobrada</button>
                )}
                {/* Botón registrar pago total */}
                {ep==="seña_cobrada"&&(
                  <button className="btn bp" style={{width:"100%",justifyContent:"center",marginTop:6,background:"#10b981"}} onClick={()=>setShowPagoTotal(true)}>✅ Registrar pago total</button>
                )}
              </>;
            })()}
          </>}
          <Historial entidad_tipo="reserva" entidad_id={sel.id} tok={tok} perfil={perfil||{nombre:"Admin"}}/>
          <Documentos entidad_tipo="reserva" entidad_id={sel.id} tok={tok} perfil={perfil||{nombre:"Admin"}}/>
        </div>}
      </div>
    </div>
    {/* MODAL SEÑA */}
    {showSeña&&sel&&<div className="ov" onClick={()=>setShowSeña(false)}>
      <div className="modal" style={{maxWidth:400}} onClick={e=>e.stopPropagation()}>
        <h3>💰 Registrar seña cobrada</h3>
        <div style={{background:"rgba(201,168,76,.06)",border:"1px solid rgba(201,168,76,.15)",borderRadius:10,padding:"12px 14px",marginBottom:16}}>
          <div style={{fontSize:13,color:"#c9a84c",fontWeight:600}}>{sel.nombre}</div>
          <div style={{fontSize:12,color:"#7a7f94",marginTop:3}}>Precio total: {(parseFloat(sel.precio_total)||parseFloat(sel.precio)||0).toLocaleString("es-ES")}€</div>
        </div>
        <div className="fg">
          <label>Importe de la seña (€) *</label>
          <input type="number" inputMode="decimal" className="fi" value={señaImporte} onChange={e=>setSeñaImporte(e.target.value)} placeholder="Ej: 1500" autoFocus/>
        </div>
        <div className="mft">
          <button className="btn bg" onClick={()=>setShowSeña(false)}>Cancelar</button>
          <button className="btn bp" onClick={registrarSeña} disabled={cobroSaving||!señaImporte}>{cobroSaving?"Guardando…":"💰 Confirmar cobro"}</button>
        </div>
      </div>
    </div>}
    {/* MODAL PAGO TOTAL */}
    {showPagoTotal&&sel&&<div className="ov" onClick={()=>setShowPagoTotal(false)}>
      <div className="modal" style={{maxWidth:420}} onClick={e=>e.stopPropagation()}>
        <h3>✅ Confirmar pago total</h3>
        <div style={{background:"rgba(201,168,76,.06)",border:"1px solid rgba(201,168,76,.15)",borderRadius:10,padding:"12px 14px",marginBottom:16}}>
          <div style={{fontSize:13,color:"#c9a84c",fontWeight:600}}>{sel.nombre}</div>
          {(()=>{const pt=parseFloat(sel.precio_total)||parseFloat(sel.precio)||0;const seña=parseFloat(sel.seña_importe)||0;return <>
            <div style={{fontSize:12,color:"#7a7f94",marginTop:6}}>Precio total: <strong style={{color:"#e8e6e1"}}>{pt.toLocaleString("es-ES")}€</strong></div>
            <div style={{fontSize:12,color:"#7a7f94",marginTop:3}}>Seña cobrada: <strong style={{color:"#10b981"}}>−{seña.toLocaleString("es-ES")}€</strong></div>
            <hr className="div"/>
            <div style={{fontSize:16,fontWeight:700,color:"#c9a84c"}}>Saldo pendiente: {(pt-seña).toLocaleString("es-ES")}€</div>
          </>;})()}
        </div>
        <div style={{background:"rgba(16,185,129,.06)",border:"1px solid rgba(16,185,129,.15)",borderRadius:8,padding:"10px 12px",marginBottom:14,fontSize:12,color:"#10b981"}}>
          ✅ Se generará automáticamente el gasto de comisión del gestor
        </div>
        <div className="mft">
          <button className="btn bg" onClick={()=>setShowPagoTotal(false)}>Cancelar</button>
          <button className="btn bp" style={{background:"#10b981"}} onClick={registrarPagoTotal} disabled={cobroSaving}>{cobroSaving?"Procesando…":"✅ Confirmar pago completo"}</button>
        </div>
      </div>
    </div>}
  </>;
}

function NuevaReserva({perfil,tok,setPage}){
  const [form,setForm]=useState({nombre:"",fecha:"",tipo:"Boda",precio:"",contacto:"",obs:"",estado:"visita"});
  const [ok,setOk]=useState(false);const [saving,setSaving]=useState(false);
  const tipos=["Boda","Cumpleaños","Comunión","Bautizo","Aniversario","Empresa","Otro"];
  const [bloqueadoR,setBloqueadoR]=useState(null);

  const submit=async()=>{
    if(!form.nombre||!form.fecha||saving)return;setSaving(true);
    try{
      const disp=await checkDisponibilidad(form.fecha,tok);
      if(!disp.libre){setSaving(false);setBloqueadoR(disp.conflictos);return;}
      const [res]=await sbPost("reservas",{...form,precio:parseFloat(form.precio)||0,creado_por:perfil.id},tok);
      await addHistorial("reserva",res.id,`Reserva creada por ${perfil.nombre}`,perfil.nombre,tok);
      setOk(true);setTimeout(()=>{setOk(false);setPage("reservas");},2000);
      setForm({nombre:"",fecha:"",tipo:"Boda",precio:"",contacto:"",obs:"",estado:"visita"});
    }catch(_){}setSaving(false);
  };
  return <>
    <div className="ph"><h2>Nueva reserva</h2></div>
    <div className="pb"><div style={{maxWidth:600}}>
      {ok&&<div style={{background:"rgba(16,185,129,.1)",border:"1px solid rgba(16,185,129,.3)",borderRadius:10,padding:"12px 15px",marginBottom:16,color:"#10b981",fontSize:13}}>✅ Reserva creada. Redirigiendo…</div>}
      <div className="card">
        <div className="fg"><label>Nombre del cliente *</label><input className="fi" value={form.nombre} onChange={e=>setForm(v=>({...v,nombre:e.target.value}))} placeholder="Ej: María y Carlos García"/></div>
        <div className="g2"><div className="fg"><label>Fecha *</label><input type="date" className="fi" value={form.fecha} onChange={e=>setForm(v=>({...v,fecha:e.target.value}))}/></div><div className="fg"><label>Tipo</label><select className="fi" value={form.tipo} onChange={e=>setForm(v=>({...v,tipo:e.target.value}))}>{tipos.map(t=><option key={t}>{t}</option>)}</select></div></div>
        <div className="g2"><div className="fg"><label>Precio (€)</label><input type="number" inputMode="numeric" className="fi" value={form.precio} onChange={e=>setForm(v=>({...v,precio:e.target.value}))} placeholder="0"/></div><div className="fg"><label>Contacto</label><input className="fi" type="tel" inputMode="tel" value={form.contacto} onChange={e=>setForm(v=>({...v,contacto:e.target.value}))} placeholder="600 000 000"/></div></div>
        <div className="fg"><label>Estado inicial</label><select className="fi" value={form.estado} onChange={e=>setForm(v=>({...v,estado:e.target.value}))}>{ESTADOS.map(e=><option key={e.id} value={e.id}>{e.lbl}</option>)}</select></div>
        <div className="fg"><label>Observaciones</label><textarea className="fi" rows={3} value={form.obs} onChange={e=>setForm(v=>({...v,obs:e.target.value}))} placeholder="Notas, menú, decoración…"/></div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><button className="btn bg" onClick={()=>setPage("reservas")}>Cancelar</button><button className="btn bp" onClick={submit} disabled={saving}>✓ Crear reserva</button></div>
      </div>
    </div></div>
    {bloqueadoR&&<ModalOcupado fecha={form.fecha} conflictos={bloqueadoR} tipoAccion="reserva" perfil={perfil} tok={tok} onCerrar={()=>setBloqueadoR(null)} onForzar={()=>setBloqueadoR(null)}/>}
  </>;
}

// ─── VISITAS ─────────────────────────────────────────────────────────────────
const TIPOS_EVENTO = ["Boda","Comunión","Bautizo","Cumpleaños","Aniversario","Empresa","Otro"];
const ESTADOS_VISITA = {
  pendiente:      {lbl:"Pendiente",           col:"#f59e0b"},
  realizada:      {lbl:"Realizada",           col:"#10b981"},
  convertida:     {lbl:"Reserva formalizada", col:"#6366f1"},
  no_presentado:  {lbl:"No se presentó",      col:"#e85555"},
  cancelada:      {lbl:"Cancelada",           col:"#6b7280"},
  reserva_cancelada:{lbl:"Reserva cancelada", col:"#e85555"},
};

function Visitas({perfil,tok,rol}){
  const isA=rol==="admin", isC=rol==="comercial";
  const puedeEditar=isA||isC;
  const hoy=new Date().toISOString().split("T")[0];

  const [visitas,setVisitas]=useState([]);
  const [load,setLoad]=useState(true);
  const [tab,setTab]=useState("proximas");
  const [showForm,setShowForm]=useState(false);
  const [sel,setSel]=useState(null);
  const [showConvertir,setShowConvertir]=useState(false);
  const [showNoPresentado,setShowNoPresentado]=useState(false);
  const [showRevertir,setShowRevertir]=useState(false);
  const [notaCancelacion,setNotaCancelacion]=useState("");
  const [saving,setSaving]=useState(false);

  const formVacio={nombre:"",fecha:hoy,hora:"10:00",tipo_evento:"Boda",invitados:"",telefono:"",email:"",nota:""};
  const [form,setForm]=useState(formVacio);
  const [formRes,setFormRes]=useState({fecha_evento:"",precio:"",contacto:"",obs:"",estado:"visita"});

  const load_=async()=>{
    try{const v=await sbGet("visitas","?select=*&order=fecha.asc,hora.asc",tok);setVisitas(v);}catch(_){}
    setLoad(false);
  };
  useEffect(()=>{load_();},[]);

  const proximas=visitas.filter(v=>v.estado==="pendiente");
  const anteriores=visitas.filter(v=>v.estado!=="pendiente");

  const [bloqueado,setBloqueado]=useState(null); // {conflictos}

  const crearVisita=async()=>{
    if(!form.nombre||!form.fecha||!form.hora||saving)return;
    setSaving(true);
    try{
      const disp=await checkDisponibilidad(form.fecha,tok);
      if(!disp.libre){setSaving(false);setShowForm(false);setBloqueado(disp.conflictos);return;}
      const [v]=await sbPost("visitas",{...form,invitados:parseInt(form.invitados)||null,estado:"pendiente",creado_por:perfil.nombre},tok);
      await addHistorial("visita",v.id,`Visita registrada para el ${new Date(form.fecha+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"long",year:"numeric"})} a las ${form.hora}`,perfil.nombre,tok);
      setShowForm(false);setForm(formVacio);await load_();
    }catch(_){}
    setSaving(false);
  };

  const marcarRealizada=async()=>{
    if(!sel)return;
    await sbPatch("visitas",`id=eq.${sel.id}`,{estado:"realizada"},tok);
    await addHistorial("visita",sel.id,"Visita realizada en la finca",perfil.nombre,tok);
    setSel(prev=>({...prev,estado:"realizada"}));
    await load_();
  };

  const marcarNoPresentado=async(accion)=>{
    if(!sel||saving)return;
    setSaving(true);
    try{
      await sbPatch("visitas",`id=eq.${sel.id}`,{estado:"no_presentado"},tok);
      await addHistorial("visita",sel.id,"El cliente no se presentó a la visita",perfil.nombre,tok);
      setShowNoPresentado(false);
      if(accion==="reprogramar"){
        setForm({nombre:sel.nombre,fecha:hoy,hora:sel.hora?.slice(0,5)||"10:00",tipo_evento:sel.tipo_evento||"Boda",invitados:sel.invitados||"",telefono:sel.telefono||"",email:sel.email||"",nota:sel.nota||""});
        setSel(null);setShowForm(true);
      }else{setSel(null);}
      await load_();
    }catch(_){}
    setSaving(false);
  };

  const guardarNota=async(v,nota)=>{
    await sbPatch("visitas",`id=eq.${v.id}`,{nota},tok);
    setSel(prev=>prev?{...prev,nota}:prev);
    await load_();
  };

  const abrirConvertir=()=>{
    setFormRes({fecha_evento:"",precio:"",contacto:sel.telefono||"",obs:sel.nota||"",estado:"visita"});
    setShowConvertir(true);
  };

  const convertirEnReserva=async()=>{
    if(!sel||saving||!formRes.fecha_evento)return;
    setSaving(true);
    try{
      const [res]=await sbPost("reservas",{nombre:sel.nombre,fecha:formRes.fecha_evento,tipo:sel.tipo_evento||"Boda",precio:parseFloat(formRes.precio)||0,contacto:formRes.contacto||"",obs:formRes.obs||"",estado:formRes.estado||"visita",creado_por:perfil.id},tok);
      await sbPatch("visitas",`id=eq.${sel.id}`,{estado:"convertida",reserva_id:res.id},tok);
      await addHistorial("visita",sel.id,`Visita convertida en reserva para el ${new Date(formRes.fecha_evento+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"long",year:"numeric"})}`,perfil.nombre,tok);
      await addHistorial("reserva",res.id,`Reserva creada a partir de visita de ${sel.nombre}`,perfil.nombre,tok);
      setSel(prev=>({...prev,estado:"convertida",reserva_id:res.id}));
      setShowConvertir(false);await load_();
    }catch(_){}
    setSaving(false);
  };

  const revertirReserva=async()=>{
    if(!sel||saving||!notaCancelacion.trim())return;
    setSaving(true);
    try{
      await sbPatch("visitas",`id=eq.${sel.id}`,{estado:"reserva_cancelada",nota_cancelacion:notaCancelacion},tok);
      if(sel.reserva_id){
        await sbPatch("reservas",`id=eq.${sel.reserva_id}`,{estado:"cancelada",obs:`CANCELADA: ${notaCancelacion}`},tok);
        await addHistorial("reserva",sel.reserva_id,`Reserva cancelada: ${notaCancelacion}`,perfil.nombre,tok);
      }
      await addHistorial("visita",sel.id,`Reserva cancelada: ${notaCancelacion}`,perfil.nombre,tok);
      setSel(prev=>({...prev,estado:"reserva_cancelada",nota_cancelacion:notaCancelacion}));
      setShowRevertir(false);setNotaCancelacion("");await load_();
    }catch(_){}
    setSaving(false);
  };

  if(load)return <div className="loading"><div className="spin"/><span>Cargando…</span></div>;
  const lista=tab==="proximas"?proximas:anteriores;

  return <>
    <div className="ph">
      <h2>👁 Visitas</h2>
      <p>{proximas.length} próximas · {anteriores.length} anteriores</p>
    </div>
    <div className="pb">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,gap:12,flexWrap:"wrap"}}>
        <div className="tabs" style={{marginBottom:0}}>
          <button className={`tab${tab==="proximas"?" on":""}`} onClick={()=>setTab("proximas")}>📅 Próximas ({proximas.length})</button>
          <button className={`tab${tab==="anteriores"?" on":""}`} onClick={()=>setTab("anteriores")}>📁 Anteriores ({anteriores.length})</button>
        </div>
        {puedeEditar&&<button className="btn bp" onClick={()=>{setForm(formVacio);setShowForm(true);}}>➕ Nueva visita</button>}
      </div>

      {lista.length===0&&<div className="empty"><span className="ico">{tab==="proximas"?"📅":"📁"}</span><p>{tab==="proximas"?"No hay visitas programadas":"No hay visitas anteriores"}</p></div>}

      {lista.map(v=>{
        const est=ESTADOS_VISITA[v.estado]||ESTADOS_VISITA.pendiente;
        const fechaFmt=new Date(v.fecha+"T12:00:00").toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
        return <div key={v.id} className="card" style={{marginBottom:10,borderLeft:`3px solid ${est.col}`,cursor:"pointer"}} onClick={()=>setSel(v)}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
            <div style={{minWidth:0}}>
              <div style={{fontSize:15,fontWeight:600,color:"#e8e6e1",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.nombre}</div>
              <div style={{fontSize:12,color:"#7a7f94",marginTop:4}}>📅 {fechaFmt} · 🕐 {v.hora?.slice(0,5)||"—"}</div>
              <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
                <span className="badge" style={{background:`${est.col}18`,color:est.col,border:`1px solid ${est.col}30`}}>{est.lbl}</span>
                {v.tipo_evento&&<span className="badge" style={{background:"rgba(201,168,76,.1)",color:"#c9a84c"}}>🎉 {v.tipo_evento}</span>}
                {v.invitados&&<span className="badge" style={{background:"rgba(255,255,255,.06)",color:"#7a7f94"}}>👥 {v.invitados} inv.</span>}
              </div>
            </div>
            <span style={{color:"#5a5e6e",fontSize:22,flexShrink:0}}>›</span>
          </div>
          {v.nota&&<div className="nbox" style={{marginTop:10}}>💬 {v.nota}</div>}
          {v.nota_cancelacion&&<div style={{marginTop:8,fontSize:12,color:"#e85555",background:"rgba(232,85,85,.06)",border:"1px solid rgba(232,85,85,.15)",borderRadius:7,padding:"6px 10px"}}>❌ {v.nota_cancelacion}</div>}
        </div>;
      })}
    </div>

    {/* MODAL NUEVA VISITA */}
    {showForm&&<div className="ov" onClick={()=>setShowForm(false)}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <h3>📅 Nueva visita</h3>
        <div className="fg"><label>Nombre pareja / cliente *</label><input className="fi" value={form.nombre} onChange={e=>setForm(v=>({...v,nombre:e.target.value}))} placeholder="Ej: Laura y Antonio García"/></div>
        <div className="g2">
          <div className="fg"><label>Fecha visita *</label><input type="date" className="fi" value={form.fecha} onChange={e=>setForm(v=>({...v,fecha:e.target.value}))}/></div>
          <div className="fg"><label>Hora *</label><input type="time" className="fi" value={form.hora} onChange={e=>setForm(v=>({...v,hora:e.target.value}))}/></div>
        </div>
        <div className="g2">
          <div className="fg"><label>Tipo de evento</label><select className="fi" value={form.tipo_evento} onChange={e=>setForm(v=>({...v,tipo_evento:e.target.value}))}>{TIPOS_EVENTO.map(t=><option key={t}>{t}</option>)}</select></div>
          <div className="fg"><label>Invitados estimados</label><input type="number" inputMode="numeric" className="fi" value={form.invitados} onChange={e=>setForm(v=>({...v,invitados:e.target.value}))} placeholder="Ej: 120"/></div>
        </div>
        <div className="g2">
          <div className="fg"><label>Teléfono</label><input className="fi" type="tel" value={form.telefono} onChange={e=>setForm(v=>({...v,telefono:e.target.value}))} placeholder="600 000 000"/></div>
          <div className="fg"><label>Email</label><input className="fi" type="email" value={form.email} onChange={e=>setForm(v=>({...v,email:e.target.value}))} placeholder="correo@email.com"/></div>
        </div>
        <div className="fg"><label>Observaciones iniciales</label><textarea className="fi" rows={3} value={form.nota} onChange={e=>setForm(v=>({...v,nota:e.target.value}))} placeholder="Notas previas a la visita…"/></div>
        <div className="mft"><button className="btn bg" onClick={()=>setShowForm(false)}>Cancelar</button><button className="btn bp" onClick={crearVisita} disabled={saving}>{saving?"Guardando…":"✓ Crear visita"}</button></div>
      </div>
    </div>}

    {/* MODAL DETALLE VISITA */}
    {sel&&!showConvertir&&!showNoPresentado&&!showRevertir&&<div className="ov" onClick={()=>setSel(null)}>
      <div className="modal" style={{maxWidth:560}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,gap:8}}>
          <div style={{minWidth:0}}>
            <h3 style={{marginBottom:6}}>{sel.nombre}</h3>
            {(()=>{const est=ESTADOS_VISITA[sel.estado]||ESTADOS_VISITA.pendiente;return <span className="badge" style={{background:`${est.col}18`,color:est.col,border:`1px solid ${est.col}30`}}>{est.lbl}</span>;})()}
          </div>
          <button className="btn bg sm" style={{flexShrink:0}} onClick={()=>setSel(null)}>✕</button>
        </div>

        <div className="g2" style={{marginBottom:14}}>
          {[
            {l:"FECHA VISITA",v:new Date(sel.fecha+"T12:00:00").toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long",year:"numeric"})},
            {l:"HORA",v:sel.hora?.slice(0,5)},
            {l:"TIPO",v:sel.tipo_evento},
            {l:"INVITADOS",v:sel.invitados?`${sel.invitados} personas`:null},
            {l:"TELÉFONO",v:sel.telefono},
            {l:"EMAIL",v:sel.email},
          ].filter(x=>x.v).map(x=><div key={x.l} style={{background:"#0f1117",borderRadius:8,padding:"10px 12px"}}>
            <div style={{fontSize:10,color:"#5a5e6e",marginBottom:3}}>{x.l}</div>
            <div style={{fontSize:13,color:"#e8e6e1"}}>{x.v}</div>
          </div>)}
        </div>

        {sel.nota_cancelacion&&<div style={{marginBottom:14,padding:"10px 12px",background:"rgba(232,85,85,.06)",border:"1px solid rgba(232,85,85,.2)",borderRadius:8,fontSize:13,color:"#e85555"}}>❌ Motivo cancelación: {sel.nota_cancelacion}</div>}

        <NotaVisita sel={sel} onGuardar={guardarNota} puedeEditar={puedeEditar}/>

        {/* ACCIONES */}
        {puedeEditar&&sel.estado==="pendiente"&&(
          <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:16,paddingTop:14,borderTop:"1px solid rgba(255,255,255,.06)"}}>
            <div style={{display:"flex",gap:8}}>
              <button className="btn bg" style={{flex:1,justifyContent:"center"}} onClick={marcarRealizada}>✅ Realizada</button>
              <button className="btn bp" style={{flex:1,justifyContent:"center"}} onClick={abrirConvertir}>🔄 Convertir en reserva</button>
            </div>
            <button className="btn br" style={{width:"100%",justifyContent:"center"}} onClick={()=>setShowNoPresentado(true)}>❌ No se ha presentado</button>
          </div>
        )}
        {puedeEditar&&sel.estado==="realizada"&&(
          <div style={{marginTop:16,paddingTop:14,borderTop:"1px solid rgba(255,255,255,.06)"}}>
            <button className="btn bp" style={{width:"100%",justifyContent:"center"}} onClick={abrirConvertir}>🔄 Convertir en reserva</button>
          </div>
        )}
        {puedeEditar&&sel.estado==="convertida"&&(
          <div style={{marginTop:16,paddingTop:14,borderTop:"1px solid rgba(255,255,255,.06)"}}>
            <div style={{padding:"10px 12px",background:"rgba(99,102,241,.08)",border:"1px solid rgba(99,102,241,.2)",borderRadius:8,fontSize:13,color:"#a5b4fc",marginBottom:10,textAlign:"center"}}>
              ✅ Reserva formalizada en el calendario
            </div>
            <button className="btn br" style={{width:"100%",justifyContent:"center"}} onClick={()=>{setNotaCancelacion("");setShowRevertir(true);}}>↩️ Cancelar esta reserva</button>
          </div>
        )}
        {sel.estado==="no_presentado"&&<div style={{marginTop:16,padding:"10px 12px",background:"rgba(232,85,85,.08)",border:"1px solid rgba(232,85,85,.2)",borderRadius:8,fontSize:13,color:"#e85555",textAlign:"center"}}>❌ El cliente no se presentó a esta visita</div>}
        {sel.estado==="reserva_cancelada"&&<div style={{marginTop:16,padding:"10px 12px",background:"rgba(107,114,128,.08)",border:"1px solid rgba(107,114,128,.2)",borderRadius:8,fontSize:13,color:"#9ca3af",textAlign:"center"}}>↩️ Reserva cancelada</div>}

        {sel.creado_por&&<div style={{marginTop:12,fontSize:11,color:"#3d4155",textAlign:"right"}}>Creada por {sel.creado_por}</div>}

        <Historial entidad_tipo="visita" entidad_id={sel.id} tok={tok} perfil={perfil}/>
        <Documentos entidad_tipo="visita" entidad_id={sel.id} tok={tok} perfil={perfil}/>
      </div>
    </div>}

    {/* MODAL NO SE PRESENTÓ */}
    {sel&&showNoPresentado&&<div className="ov" onClick={()=>setShowNoPresentado(false)}>
      <div className="modal" style={{maxWidth:420}} onClick={e=>e.stopPropagation()}>
        <h3>❌ No se presentó</h3>
        <p style={{fontSize:13,color:"#7a7f94",marginBottom:20,lineHeight:1.6}}>
          <strong style={{color:"#e8e6e1"}}>{sel.nombre}</strong> no se ha presentado a la visita del {new Date(sel.fecha+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"long"})} a las {sel.hora?.slice(0,5)||"—"}.<br/><br/>¿Qué deseas hacer?
        </p>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <button className="btn bp" style={{width:"100%",justifyContent:"center",padding:"14px",fontSize:14}} onClick={()=>marcarNoPresentado("reprogramar")} disabled={saving}>📅 Marcar y programar nueva visita</button>
          <button className="btn br" style={{width:"100%",justifyContent:"center",padding:"14px",fontSize:14}} onClick={()=>marcarNoPresentado("cancelar")} disabled={saving}>🗑 Marcar y cancelar</button>
        </div>
        <button className="btn bg" style={{width:"100%",justifyContent:"center",marginTop:10}} onClick={()=>setShowNoPresentado(false)}>Volver</button>
      </div>
    </div>}

    {/* MODAL CANCELAR RESERVA */}
    {sel&&showRevertir&&<div className="ov" onClick={()=>setShowRevertir(false)}>
      <div className="modal" style={{maxWidth:440}} onClick={e=>e.stopPropagation()}>
        <h3>↩️ Cancelar reserva</h3>
        <p style={{fontSize:13,color:"#7a7f94",marginBottom:16,lineHeight:1.5}}>
          La reserva de <strong style={{color:"#e8e6e1"}}>{sel.nombre}</strong> quedará cancelada. Indica el motivo:
        </p>
        <div className="fg">
          <label>Motivo de cancelación *</label>
          <textarea className="fi" rows={4} value={notaCancelacion} onChange={e=>setNotaCancelacion(e.target.value)} placeholder="Ej: No firmaron el contrato, encontraron otra finca…"/>
        </div>
        {!notaCancelacion.trim()&&<div style={{fontSize:12,color:"#e85555",marginBottom:10}}>⚠️ El motivo es obligatorio</div>}
        <div className="mft">
          <button className="btn bg" onClick={()=>setShowRevertir(false)}>Cancelar</button>
          <button className="btn br" onClick={revertirReserva} disabled={saving||!notaCancelacion.trim()}>{saving?"Procesando…":"↩️ Confirmar cancelación"}</button>
        </div>
      </div>
    </div>}

    {/* MODAL CONVERTIR EN RESERVA */}
    {sel&&showConvertir&&<div className="ov" onClick={()=>setShowConvertir(false)}>
      <div className="modal" style={{maxWidth:500}} onClick={e=>e.stopPropagation()}>
        <h3>🔄 Formalizar reserva</h3>
        <div style={{background:"rgba(201,168,76,.06)",border:"1px solid rgba(201,168,76,.15)",borderRadius:10,padding:"12px 14px",marginBottom:18}}>
          <div style={{fontSize:13,color:"#c9a84c",fontWeight:600,marginBottom:2}}>{sel.nombre}</div>
          <div style={{fontSize:12,color:"#7a7f94"}}>🎉 {sel.tipo_evento} · 👥 {sel.invitados||"—"} invitados</div>
        </div>
        <div className="fg">
          <label>📅 Fecha del evento * <span style={{color:"#e85555",fontSize:11}}>(día de la boda/evento)</span></label>
          <input type="date" className="fi" value={formRes.fecha_evento} onChange={e=>setFormRes(v=>({...v,fecha_evento:e.target.value}))}/>
        </div>
        <div className="g2">
          <div className="fg"><label>Precio (€)</label><input type="number" inputMode="numeric" className="fi" value={formRes.precio} onChange={e=>setFormRes(v=>({...v,precio:e.target.value}))} placeholder="0"/></div>
          <div className="fg"><label>Contacto</label><input className="fi" type="tel" value={formRes.contacto} onChange={e=>setFormRes(v=>({...v,contacto:e.target.value}))} placeholder="600 000 000"/></div>
        </div>
        <div className="fg"><label>Estado inicial</label>
          <select className="fi" value={formRes.estado} onChange={e=>setFormRes(v=>({...v,estado:e.target.value}))}>
            {ESTADOS.map(e=><option key={e.id} value={e.id}>{e.lbl}</option>)}
          </select>
        </div>
        <div className="fg"><label>Observaciones</label><textarea className="fi" rows={3} value={formRes.obs} onChange={e=>setFormRes(v=>({...v,obs:e.target.value}))} placeholder="Notas para la reserva…"/></div>
        {!formRes.fecha_evento&&<div style={{fontSize:12,color:"#e85555",marginBottom:10}}>⚠️ La fecha del evento es obligatoria</div>}
        <div className="mft">
          <button className="btn bg" onClick={()=>setShowConvertir(false)}>Cancelar</button>
          <button className="btn bp" onClick={convertirEnReserva} disabled={saving||!formRes.fecha_evento}>{saving?"Creando…":"✅ Crear reserva"}</button>
        </div>
      </div>
    </div>}

    {/* MODAL FECHA OCUPADA */}
    {bloqueado&&<ModalOcupado fecha={form.fecha} conflictos={bloqueado} tipoAccion="visita" perfil={perfil} tok={tok} onCerrar={()=>setBloqueado(null)} onForzar={()=>setBloqueado(null)}/>}
  </>;
}

function NotaVisita({sel,onGuardar,puedeEditar}){
  const [editando,setEditando]=useState(false);
  const [txt,setTxt]=useState(sel.nota||"");
  const [saving,setSaving]=useState(false);
  const guardar=async()=>{
    setSaving(true);await onGuardar(sel,txt);setSaving(false);setEditando(false);
  };
  return <div style={{marginBottom:4}}>
    <div style={{fontSize:10,color:"#5a5e6e",textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>Observaciones / Nota comercial</div>
    {editando?(
      <>
        <textarea className="fi" rows={4} value={txt} onChange={e=>setTxt(e.target.value)} placeholder="Ej: Les ha encantado la finca, piden presupuesto esta semana…" style={{marginBottom:8}}/>
        <div style={{display:"flex",gap:6}}>
          <button className="btn bg sm" onClick={()=>{setTxt(sel.nota||"");setEditando(false);}}>Cancelar</button>
          <button className="btn bp sm" onClick={guardar} disabled={saving}>{saving?"Guardando…":"✓ Guardar"}</button>
        </div>
      </>
    ):(
      <div style={{background:"#0f1117",borderRadius:8,padding:"10px 12px",minHeight:52,position:"relative"}}>
        {sel.nota?<div style={{fontSize:13,color:"#c9c5b8",lineHeight:1.5,paddingRight:80}}>{sel.nota}</div>:<div style={{fontSize:13,color:"#3d4155",fontStyle:"italic"}}>Sin observaciones todavía…</div>}
        {puedeEditar&&<button className="btn bg sm" style={{position:"absolute",top:8,right:8}} onClick={()=>setEditando(true)}>{sel.nota?"✏️":"➕ Añadir"}</button>}
      </div>
    )}
  </div>;
}

// ─── RESERVAS AIRBNB ─────────────────────────────────────────────────────────
function ReservasAirbnb({perfil,tok,rol}){
  const isA=rol==="admin";
  const [airbnbs,setAirbnbs]=useState([]);
  const [load,setLoad]=useState(true);
  const [showForm,setShowForm]=useState(false);
  const [sel,setSel]=useState(null);
  const [saving,setSaving]=useState(false);
  const hoy=new Date().toISOString().split("T")[0];
  const formVacio={huesped:"",fecha_entrada:hoy,fecha_salida:hoy,personas:"",precio:"",notas:""};
  const [form,setForm]=useState(formVacio);

  const load_=async()=>{
    try{const a=await sbGet("reservas_airbnb","?select=*&order=fecha_entrada.asc",tok);setAirbnbs(a);}catch(_){}
    setLoad(false);
  };
  useEffect(()=>{load_();},[]);

  const proximas=airbnbs.filter(a=>a.fecha_salida>=hoy);
  const anteriores=airbnbs.filter(a=>a.fecha_salida<hoy);
  const [tab,setTab]=useState("proximas");

  const [bloqueadoA,setBloqueadoA]=useState(null);
  const [fechaBloqA,setFechaBloqA]=useState(null);

  const crear=async()=>{
    if(!form.huesped||!form.fecha_entrada||!form.fecha_salida||saving)return;
    if(form.fecha_salida<form.fecha_entrada){alert("La fecha de salida no puede ser anterior a la de entrada");return;}
    setSaving(true);
    // Check every date in range
    const d=new Date(form.fecha_entrada+"T12:00:00");
    const fin=new Date(form.fecha_salida+"T12:00:00");
    let conflictoEncontrado=null;
    let fechaConflicto=null;
    while(d<=fin){
      const fecha=d.toISOString().split("T")[0];
      const disp=await checkDisponibilidad(fecha,tok);
      if(!disp.libre){conflictoEncontrado=disp.conflictos;fechaConflicto=fecha;break;}
      d.setDate(d.getDate()+1);
    }
    if(conflictoEncontrado){setSaving(false);setShowForm(false);setBloqueadoA(conflictoEncontrado);setFechaBloqA(fechaConflicto);return;}
    try{
      await sbPost("reservas_airbnb",{
        ...form,
        personas:parseInt(form.personas)||null,
        precio:parseFloat(form.precio)||null,
        creado_por:perfil.nombre,
      },tok);
      setShowForm(false);setForm(formVacio);await load_();
    }catch(_){}
    setSaving(false);
  };

  const eliminar=async id=>{
    if(!window.confirm("¿Eliminar esta reserva Airbnb?"))return;
    await sbDelete("reservas_airbnb",`id=eq.${id}`,tok);
    await load_();setSel(null);
  };

  const fmtRango=a=>{
    const ini=new Date(a.fecha_entrada+"T12:00:00").toLocaleDateString("es-ES",{weekday:"short",day:"numeric",month:"short",year:"numeric"});
    const fin=new Date(a.fecha_salida+"T12:00:00").toLocaleDateString("es-ES",{weekday:"short",day:"numeric",month:"short",year:"numeric"});
    return `${ini} → ${fin}`;
  };
  const noches=a=>Math.round((new Date(a.fecha_salida)-new Date(a.fecha_entrada))/(1000*60*60*24));

  if(load)return <div className="loading"><div className="spin"/><span>Cargando…</span></div>;

  const lista=tab==="proximas"?proximas:anteriores;

  return <>
    <div className="ph">
      <h2>🏠 Reservas Airbnb</h2>
      <p>{proximas.length} próximas · {anteriores.length} anteriores</p>
    </div>
    <div className="pb">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,gap:12,flexWrap:"wrap"}}>
        <div className="tabs" style={{marginBottom:0}}>
          <button className={`tab${tab==="proximas"?" on":""}`} onClick={()=>setTab("proximas")}>📅 Próximas ({proximas.length})</button>
          <button className={`tab${tab==="anteriores"?" on":""}`} onClick={()=>setTab("anteriores")}>📁 Anteriores ({anteriores.length})</button>
        </div>
        {isA&&<button className="btn bp" onClick={()=>{setForm(formVacio);setShowForm(true);}}>➕ Nueva reserva</button>}
      </div>

      {lista.length===0&&<div className="empty"><span className="ico">🏠</span><p>{tab==="proximas"?"No hay reservas próximas":"No hay reservas anteriores"}</p></div>}

      {lista.map(a=>{
        const n=noches(a);
        return <div key={a.id} className="card" style={{marginBottom:10,borderLeft:"3px solid #10b981",cursor:"pointer"}} onClick={()=>setSel(a)}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
            <div style={{minWidth:0}}>
              <div style={{fontSize:15,fontWeight:600,color:"#e8e6e1",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>🏠 {a.huesped}</div>
              <div style={{fontSize:12,color:"#7a7f94",marginTop:4}}>📅 {fmtRango(a)}</div>
              <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
                <span className="badge" style={{background:"rgba(16,185,129,.1)",color:"#10b981",border:"1px solid rgba(16,185,129,.25)"}}>Airbnb · {n} noche{n!==1?"s":""}</span>
                {a.personas&&<span className="badge" style={{background:"rgba(255,255,255,.06)",color:"#7a7f94"}}>👥 {a.personas} personas</span>}
                {a.precio&&<span className="badge" style={{background:"rgba(201,168,76,.1)",color:"#c9a84c"}}>💰 {parseFloat(a.precio).toLocaleString("es-ES")}€</span>}
              </div>
            </div>
            <span style={{color:"#5a5e6e",fontSize:22,flexShrink:0}}>›</span>
          </div>
          {a.notas&&<div className="nbox" style={{marginTop:10}}>📝 {a.notas}</div>}
        </div>;
      })}
    </div>

    {/* MODAL NUEVA RESERVA */}
    {showForm&&<div className="ov" onClick={()=>setShowForm(false)}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <h3>🏠 Nueva reserva Airbnb</h3>
        <div className="fg"><label>Nombre del huésped *</label><input className="fi" value={form.huesped} onChange={e=>setForm(v=>({...v,huesped:e.target.value}))} placeholder="Ej: Familia Martínez"/></div>
        <div className="g2">
          <div className="fg"><label>Fecha entrada *</label><input type="date" className="fi" value={form.fecha_entrada} onChange={e=>setForm(v=>({...v,fecha_entrada:e.target.value}))}/></div>
          <div className="fg"><label>Fecha salida *</label><input type="date" className="fi" value={form.fecha_salida} onChange={e=>setForm(v=>({...v,fecha_salida:e.target.value}))}/></div>
        </div>
        {form.fecha_entrada&&form.fecha_salida&&form.fecha_salida>=form.fecha_entrada&&(
          <div style={{fontSize:12,color:"#c9a84c",marginBottom:10}}>🌙 {Math.round((new Date(form.fecha_salida)-new Date(form.fecha_entrada))/(1000*60*60*24))} noches</div>
        )}
        <div className="g2">
          <div className="fg"><label>Personas</label><input type="number" inputMode="numeric" className="fi" value={form.personas} onChange={e=>setForm(v=>({...v,personas:e.target.value}))} placeholder="Ej: 4"/></div>
          <div className="fg"><label>Precio total (€)</label><input type="number" inputMode="numeric" className="fi" value={form.precio} onChange={e=>setForm(v=>({...v,precio:e.target.value}))} placeholder="0"/></div>
        </div>
        <div className="fg"><label>Notas</label><textarea className="fi" rows={3} value={form.notas} onChange={e=>setForm(v=>({...v,notas:e.target.value}))} placeholder="Observaciones, necesidades especiales…"/></div>
        <div className="mft"><button className="btn bg" onClick={()=>setShowForm(false)}>Cancelar</button><button className="btn bp" onClick={crear} disabled={saving}>{saving?"Guardando…":"✓ Crear reserva"}</button></div>
      </div>
    </div>}

    {/* MODAL DETALLE */}
    {sel&&<div className="ov" onClick={()=>setSel(null)}>
      <div className="modal" style={{maxWidth:500}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,gap:8}}>
          <div>
            <h3 style={{marginBottom:6}}>🏠 {sel.huesped}</h3>
            <span className="badge" style={{background:"rgba(16,185,129,.12)",color:"#10b981",border:"1px solid rgba(16,185,129,.25)"}}>Airbnb · {noches(sel)} noches</span>
          </div>
          <button className="btn bg sm" style={{flexShrink:0}} onClick={()=>setSel(null)}>✕</button>
        </div>
        <div className="g2" style={{marginBottom:14}}>
          {[
            {l:"ENTRADA",v:new Date(sel.fecha_entrada+"T12:00:00").toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long",year:"numeric"})},
            {l:"SALIDA",v:new Date(sel.fecha_salida+"T12:00:00").toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long",year:"numeric"})},
            {l:"PERSONAS",v:sel.personas?`${sel.personas} personas`:null},
            {l:"PRECIO",v:sel.precio?`${parseFloat(sel.precio).toLocaleString("es-ES")}€`:null,gold:true},
          ].filter(x=>x.v).map(x=><div key={x.l} style={{background:"#0f1117",borderRadius:8,padding:"10px 12px"}}>
            <div style={{fontSize:10,color:"#5a5e6e",marginBottom:3}}>{x.l}</div>
            <div style={{fontSize:x.gold?16:13,fontWeight:x.gold?700:400,color:x.gold?"#c9a84c":"#e8e6e1"}}>{x.v}</div>
          </div>)}
        </div>
        {sel.notas&&<div style={{background:"#0f1117",borderRadius:8,padding:"10px 12px",marginBottom:14}}>
          <div style={{fontSize:10,color:"#5a5e6e",marginBottom:5}}>NOTAS</div>
          <div style={{fontSize:13,color:"#c9c5b8",lineHeight:1.5}}>{sel.notas}</div>
        </div>}
        <div style={{background:"rgba(232,85,85,.06)",border:"1px solid rgba(232,85,85,.15)",borderRadius:8,padding:"10px 12px",marginBottom:14,fontSize:12,color:"#e85555"}}>
          🔴 Estas fechas quedan bloqueadas automáticamente en el calendario
        </div>
        {sel.creado_por&&<div style={{fontSize:11,color:"#3d4155",marginBottom:14,textAlign:"right"}}>Creada por {sel.creado_por}</div>}
        {isA&&<button className="btn br" style={{width:"100%",justifyContent:"center"}} onClick={()=>eliminar(sel.id)}>🗑 Eliminar reserva</button>}
      </div>
    </div>}

    {/* MODAL FECHA OCUPADA */}
    {bloqueadoA&&fechaBloqA&&<ModalOcupado fecha={fechaBloqA} conflictos={bloqueadoA} tipoAccion="airbnb" perfil={perfil} tok={tok} onCerrar={()=>{setBloqueadoA(null);setFechaBloqA(null);}} onForzar={()=>{setBloqueadoA(null);setFechaBloqA(null);}}/>}
  </>;
}

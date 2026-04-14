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
const LIMP_ZONAS=[
  {id:"general",emoji:"🏠",nombre:"Tareas generales",orden:0,tareas:[
    {id:"g1",txt:"Abrir ventanas de toda la casa para ventilar"},{id:"g2",txt:"Revisar objetos olvidados por los huéspedes"},{id:"g3",txt:"Retirar ropa de cama y toallas sucias de toda la casa"},{id:"g4",txt:"Revisión general del estado de la casa (anotar desperfectos)"},
  ]},
  {id:"banio_pb",emoji:"🚿",nombre:"Baño compartido planta baja",orden:1,foto_requerida:true,tareas:[
    {id:"bpb1",txt:"Limpiar plato de ducha"},{id:"bpb2",txt:"Limpiar inodoro completo"},{id:"bpb3",txt:"Limpiar espejo (sin marcas)"},{id:"bpb4",txt:"Limpiar ventana"},{id:"bpb5",txt:"Limpiar armario/mueble"},{id:"bpb6",txt:"Reponer papel higiénico (mín. 2 rollos)"},{id:"bpb7",txt:"Reponer gel, champú y acondicionador"},{id:"bpb8",txt:"Cambiar bolsa del cubo de basura"},{id:"bpb9",txt:"Fregar suelo"},
  ]},
  {id:"hab_mat_pb",emoji:"🛏️",nombre:"Habitación matrimonio planta baja",orden:2,foto_requerida:true,tareas:[
    {id:"hmpb1",txt:"Limpiar ventana"},{id:"hmpb2",txt:"Quitar polvo de armario y mobiliario"},{id:"hmpb3",txt:"Aspirar suelo y alfombra"},{id:"hmpb4",txt:"Hacer la cama (sábanas limpias)"},{id:"hmpb5",txt:"Colocar toallas"},{id:"hmpb6",txt:"Fregar suelo"},
  ]},
  {id:"hab_2c_pb",emoji:"🛏️",nombre:"Habitación dos camas planta baja",orden:3,foto_requerida:true,tareas:[
    {id:"h2pb1",txt:"Limpiar ventana"},{id:"h2pb2",txt:"Quitar polvo de armario y mobiliario"},{id:"h2pb3",txt:"Aspirar suelo"},{id:"h2pb4",txt:"Hacer las dos camas (sábanas limpias)"},{id:"h2pb5",txt:"Colocar toallas"},{id:"h2pb6",txt:"Fregar suelo"},
  ]},
  {id:"pasillo_pb",emoji:"🚪",nombre:"Pasillo planta baja",orden:4,tareas:[
    {id:"ppb1",txt:"Limpiar puertas"},{id:"ppb2",txt:"Aspirar pasillo"},{id:"ppb3",txt:"Fregar pasillo"},
  ]},
  {id:"hab_principal",emoji:"⭐",nombre:"Habitación principal con baño en suite",orden:5,foto_requerida:true,subzonas:[
    {id:"banio_suite",nombre:"Baño en suite",tareas:[
      {id:"bs1",txt:"Limpiar ducha/bañera completa"},{id:"bs2",txt:"Limpiar inodoro"},{id:"bs3",txt:"Limpiar espejo (sin marcas)"},{id:"bs4",txt:"Reponer toallas"},{id:"bs5",txt:"Reponer papel higiénico"},{id:"bs6",txt:"Reponer gel, champú y acondicionador"},{id:"bs7",txt:"Cambiar bolsa del cubo de basura"},{id:"bs8",txt:"Aspirar y fregar suelo del baño"},
    ]},
    {id:"hab_suite",nombre:"Habitación",tareas:[
      {id:"hs1",txt:"Limpiar dos ventanas y cristales"},{id:"hs2",txt:"Quitar polvo de armario y mobiliario"},{id:"hs3",txt:"Aspirar suelo"},{id:"hs4",txt:"Hacer la cama (sábanas limpias)"},{id:"hs5",txt:"Colocar toallas decorativas a los pies de la cama"},{id:"hs6",txt:"Fregar suelo"},{id:"hs7",txt:"Cerrar puerta del baño"},
    ]},
  ]},
  {id:"hab_mat_pa",emoji:"🛏️",nombre:"Habitación matrimonio planta alta",orden:6,foto_requerida:true,tareas:[
    {id:"hmpa1",txt:"Limpiar ventana"},{id:"hmpa2",txt:"Quitar polvo de armario y mobiliario"},{id:"hmpa3",txt:"Aspirar suelo"},{id:"hmpa4",txt:"Hacer la cama (sábanas limpias)"},{id:"hmpa5",txt:"Colocar toallas"},{id:"hmpa6",txt:"Fregar suelo"},
  ]},
  {id:"hab_2c_pa",emoji:"🛏️",nombre:"Habitación dos camas planta alta",orden:7,foto_requerida:true,tareas:[
    {id:"h2pa1",txt:"Limpiar ventana"},{id:"h2pa2",txt:"Quitar polvo de armario y mobiliario"},{id:"h2pa3",txt:"Aspirar suelo"},{id:"h2pa4",txt:"Hacer las dos camas (sábanas limpias)"},{id:"h2pa5",txt:"Colocar toallas respectivas"},{id:"h2pa6",txt:"Fregar suelo"},
  ]},
  {id:"pasillo_pa",emoji:"🚪",nombre:"Pasillo y escalera planta alta",orden:8,tareas:[
    {id:"ppa1",txt:"Limpiar barandilla"},{id:"ppa2",txt:"Aspirar pasillo"},{id:"ppa3",txt:"Fregar pasillo"},{id:"ppa4",txt:"Aspirar escalera"},{id:"ppa5",txt:"Fregar escalera"},
  ]},
  {id:"cocina",emoji:"🍳",nombre:"Cocina",orden:9,foto_requerida:true,tareas:[
    {id:"co1",txt:"Limpiar azulejos y salpicadero"},{id:"co2",txt:"Limpiar armarios exteriores"},{id:"co3",txt:"Comprobar lavavajillas (vacío y limpio)"},{id:"co4",txt:"Limpiar microondas interior y exterior"},{id:"co5",txt:"Limpiar frigorífico (sin restos, sin olores)"},{id:"co6",txt:"Limpiar encimera"},{id:"co7",txt:"Limpiar fregadero y grifo"},{id:"co8",txt:"Comprobar vajilla ordenada"},{id:"co9",txt:"Reponer café"},{id:"co10",txt:"Comprobar y reponer aceite"},{id:"co11",txt:"Comprobar y reponer sal"},{id:"co12",txt:"Barrer y fregar suelo cocina"},
  ]},
  {id:"banio_salon",emoji:"🚿",nombre:"Baño de servicio salón",orden:10,foto_requerida:true,tareas:[
    {id:"bs1x",txt:"Limpiar azulejos"},{id:"bs2x",txt:"Limpiar espejo (sin marcas)"},{id:"bs3x",txt:"Limpiar ventana"},{id:"bs4x",txt:"Limpiar armario/mueble"},{id:"bs5x",txt:"Limpiar inodoro completo"},{id:"bs6x",txt:"Reponer papel higiénico"},{id:"bs7x",txt:"Reponer gel, champú y acondicionador"},{id:"bs8x",txt:"Cambiar bolsa del cubo de basura"},{id:"bs9x",txt:"Fregar suelo"},
  ]},
  {id:"salon",emoji:"🛋️",nombre:"Salón",orden:11,foto_requerida:true,tareas:[
    {id:"sl1",txt:"Barrer y fregar suelo del salón"},{id:"sl2",txt:"Aspirar sofás"},{id:"sl3",txt:"Comprobar fundas de sofás (¿necesitan lavado?)"},{id:"sl4",txt:"Limpiar mesa central"},{id:"sl5",txt:"Limpiar televisión y mueble TV"},{id:"sl6",txt:"Quitar polvo de todos los muebles y superficies"},{id:"sl7",txt:"Limpiar cuadros"},{id:"sl8",txt:"Limpiar encimeras y mesas auxiliares"},{id:"sl9",txt:"Limpiar cristales y ventanas"},{id:"sl10",txt:"Golpear y colocar cojines perfectamente"},{id:"sl11",txt:"Ordenar decoración (revistas, libros, objetos)"},{id:"sl12",txt:"Limpiar enchufes e interruptores"},
  ]},
  {id:"comedor",emoji:"🍽️",nombre:"Comedor",orden:12,foto_requerida:true,tareas:[
    {id:"cm1",txt:"Barrer y fregar suelo"},{id:"cm2",txt:"Aspirar alfombra"},{id:"cm3",txt:"Limpiar mesa del comedor"},{id:"cm4",txt:"Limpiar sillas (revisar estado)"},{id:"cm5",txt:"Limpiar decoración centro de mesa"},{id:"cm6",txt:"Colocar mesa perfectamente"},{id:"cm7",txt:"Limpiar enchufes e interruptores"},{id:"cm8",txt:"Quitar polvo de muebles"},{id:"cm9",txt:"Comprobar cuadros y decoración en su sitio"},
  ]},
  {id:"exteriores",emoji:"🏡",nombre:"Exteriores",orden:13,tareas:[
    {id:"ex1",txt:"Limpiar barbacoa"},{id:"ex2",txt:"Ordenar zona barbacoa"},{id:"ex3",txt:"Barrer porche frontal"},{id:"ex4",txt:"Limpiar sofás exteriores porche frontal"},{id:"ex5",txt:"Colocar cojines porche frontal"},{id:"ex6",txt:"Barrer porches laterales"},{id:"ex7",txt:"Limpiar sofás exteriores porches laterales"},{id:"ex8",txt:"Colocar cojines porches laterales"},
  ]},
];
// Flat list for service creation and lookups
const LIMP_T=LIMP_ZONAS.flatMap(z=>{
  const tareasDirectas=(z.tareas||[]).map(t=>({...t,zona:z.nombre}));
  const tareasSubzonas=(z.subzonas||[]).flatMap(sz=>sz.tareas.map(t=>({...t,zona:z.nombre+" — "+sz.nombre})));
  return [...tareasDirectas,...tareasSubzonas];
});
// Helper: get all tareas of a zona (including subzonas)
function getZonaTareas(z){return z.subzonas?z.subzonas.flatMap(sz=>sz.tareas):z.tareas||[];};
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
async function subscribePush(userId,tok,role){
  try{
    if(!("PushManager"in window)||!swReg)return;
    const reg=swReady?await swReady:swReg;
    if(!reg)return;
    let sub=await reg.pushManager.getSubscription().catch(()=>null);
    if(!sub){
      try{
        const key=Uint8Array.from(atob(VAPID_PUBLIC.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));
        sub=await swReg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
      }catch(_){return;}
    }
    if(!sub)return;
    const json=sub.toJSON();
    if(!json?.endpoint)return;
    const body={user_id:userId,endpoint:json.endpoint};
    if(json.keys?.p256dh)body.p256dh=json.keys.p256dh;
    if(json.keys?.auth)body.auth=json.keys.auth;
    if(role)body.role=role;
    await fetch(`${SB_URL}/rest/v1/push_subscriptions`,{
      method:"POST",headers:{...HDRA(tok),"Prefer":"resolution=merge-duplicates,return=minimal"},
      body:JSON.stringify(body)
    }).catch(()=>{});
  }catch(_){}
}
async function notificarRoles(roles,titulo,cuerpo,tag,tok){
  try{
    // Notify users with matching roles via in-app notifications
    const usuarios=await sbGet("usuarios",`?select=id,rol`,tok).catch(()=>[]);
    const targets=usuarios.filter(u=>roles.includes(u.rol));
    for(const u of targets){
      await sbPost("notificaciones",{para:u.id,txt:cuerpo},tok).catch(()=>{});
    }
    // Local push for current user
    sendPush(titulo,cuerpo,tag);
  }catch(_){}
}
async function checkNotifDiaria(tok){
  const hoyStr=new Date().toISOString().split("T")[0];
  const lsKey=`fm_notif_check_${hoyStr}`;
  if(localStorage.getItem(lsKey))return;
  try{
    const en7=new Date();en7.setDate(en7.getDate()+7);
    const en7Str=en7.toISOString().split("T")[0];
    const [reservas,airbnbs]=await Promise.all([
      sbGet("reservas",`?fecha=gte.${hoyStr}&fecha=lte.${en7Str}&estado=neq.cancelada&estado=neq.finalizada&select=id`,tok).catch(()=>[]),
      sbGet("reservas_airbnb",`?fecha_entrada=gte.${hoyStr}&fecha_entrada=lte.${en7Str}&select=id`,tok).catch(()=>[]),
    ]);
    const total=reservas.length+airbnbs.length;
    if(total>0)sendPush("📅 Finca El Molino",`Esta semana: ${total} llegada${total>1?"s":""} próxima${total>1?"s":""}`,`resumen-semanal-${hoyStr}`);
    localStorage.setItem(lsKey,"1");
  }catch(_){}
}

// ─── LOGO ────────────────────────────────────────────────────────────────────
function MolinoLogo({size=22}){
  return <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{display:"inline-block",verticalAlign:"middle",flexShrink:0}}>
    <path d="M42 100 L58 100 L55 55 L45 55 Z" fill="#EC683E" opacity=".9"/>
    <circle cx="50" cy="52" r="6" fill="#EC683E"/>
    <path d="M50 46 C48 36 44 20 46 8 C47 4 53 4 54 8 C56 20 52 36 50 46Z" fill="#EC683E"/>
    <path d="M56 52 C66 50 82 46 94 48 C98 49 98 55 94 56 C82 58 66 54 56 52Z" fill="#EC683E" opacity=".85"/>
    <path d="M50 58 C52 68 56 84 54 96 C53 100 47 100 46 96 C44 84 48 68 50 58Z" fill="#EC683E" opacity=".7"/>
    <path d="M44 52 C34 54 18 58 6 56 C2 55 2 49 6 48 C18 46 34 50 44 52Z" fill="#EC683E" opacity=".55"/>
  </svg>;
}

// ─── ICON COMPONENT ──────────────────────────────────────────────────────────
const ICON_PATHS={
  dashboard:`<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>`,
  garden:`<path d="M12 22V12m0 0C12 7 7 4 3 6m9 6c0-5 5-8 9-6"/><path d="M7 17c0-3 2.2-5 5-5s5 2 5 5"/>`,
  cleaning:`<path d="M9 21h6m-3-4v4"/><path d="M12 3a6 6 0 016 6c0 3-2 5-4 7H8c-2-2-4-4-4-7a6 6 0 016-6z"/>`,
  calendar:`<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`,
  reservations:`<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>`,
  visits:`<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`,
  airbnb:`<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>`,
  chat:`<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>`,
  notifications:`<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>`,
  users:`<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>`,
  settings:`<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9c.26.46.4.98.42 1.51"/>`,
  expenses:`<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>`,
  gardeners:`<path d="M12 22V12m0 0c0-4-4-7-8-5m8 5c0-4 4-7 8-5"/><circle cx="12" cy="5" r="3"/>`,
  incidencias:`<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`,
  check:`<polyline points="20 6 9 17 4 12"/>`,
  plus:`<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>`,
  new_res:`<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>`,
  limpiadoras:`<circle cx="12" cy="7" r="4"/><path d="M5.5 21a6.5 6.5 0 0113 0"/>`,
  logout:`<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>`,
  menu:`<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>`,
  close:`<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`,
  back:`<polyline points="15 18 9 12 15 6"/>`,
};
function Icon({name,size=20,color="currentColor",sw=1.8}){
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{display:"inline-block",verticalAlign:"middle",flexShrink:0}} dangerouslySetInnerHTML={{__html:ICON_PATHS[name]||""}}/>;
}

// ─── CSS ─────────────────────────────────────────────────────────────────────
const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700;800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{height:100%}
body{font-family:'Inter Tight',sans-serif;background:#ECEAE5;color:#1A1A1A;min-height:100vh;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:#F0EDE8}::-webkit-scrollbar-thumb{background:#EC683E;border-radius:10px}
.app{display:flex;min-height:100vh;min-height:100dvh}
.main{flex:1;min-width:0;display:flex;flex-direction:column;overflow-x:hidden}
.sb{width:256px;min-width:256px;background:#FFFFFF;border-right:1px solid rgba(0,0,0,.06);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;height:100dvh;overflow-y:auto;flex-shrink:0}
.sb-logo{padding:24px 20px 18px;border-bottom:1px solid rgba(0,0,0,.06)}
.sb-logo h1{font-family:'Inter Tight',sans-serif;font-size:18px;color:#EC683E;font-weight:800;margin-top:2px}
.sb-logo p{font-size:10px;color:#BFBAB4;margin-top:3px;text-transform:uppercase;letter-spacing:1.5px;font-weight:500}
.sb-nav{flex:1;padding:12px 10px;overflow-y:auto}
.nav-sec{font-size:9px;color:#BFBAB4;text-transform:uppercase;letter-spacing:2px;padding:14px 12px 6px;margin-top:2px;font-weight:700}
.nw{position:relative}
.nb{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;cursor:pointer;font-size:13px;color:#8A8580;transition:all .15s ease;border:none;background:none;width:100%;text-align:left;font-family:'Inter Tight',sans-serif;font-weight:500;margin-bottom:2px}
.nb:hover{background:#F5F3F0;color:#1A1A1A}
.nb.on{background:#EC683E;color:#FFFFFF;font-weight:600;box-shadow:0 4px 12px rgba(236,104,62,.25)}
.nb-ico{font-size:16px;width:22px;text-align:center;flex-shrink:0}
.nb-badge{position:absolute;top:6px;right:8px;background:#F35757;color:#fff;border-radius:20px;padding:1px 6px;font-size:10px;font-weight:700;min-width:16px;text-align:center;pointer-events:none}
.sb-user{padding:16px;border-top:1px solid rgba(0,0,0,.06);display:flex;align-items:center;gap:12px;flex-shrink:0}
.av{width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#EC683E,#AFA3FF);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;flex-shrink:0}
.uname{font-size:13px;font-weight:700;color:#1A1A1A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.urole{font-size:11px;color:#8A8580;text-transform:capitalize;margin-top:1px}
.logout-btn{background:none;border:none;cursor:pointer;color:#BFBAB4;font-size:18px;padding:6px;transition:all .15s ease;flex-shrink:0;line-height:1;border-radius:8px}
.logout-btn:hover{color:#F35757;background:#FEE8E8}
.mob-top{display:none;position:sticky;top:0;z-index:150;background:#FFFFFF;border-bottom:1px solid rgba(0,0,0,.06);padding:0 16px;height:56px;align-items:center;justify-content:space-between}
.mob-top-title{font-family:'Inter Tight',sans-serif;font-size:16px;color:#EC683E;font-weight:800}
.mob-menu-btn{background:none;border:none;color:#1A1A1A;font-size:24px;cursor:pointer;padding:8px;display:flex;align-items:center;justify-content:center;border-radius:12px;line-height:1;transition:background .15s}
.mob-menu-btn:active{background:#F0EDE8}
.drawer-overlay{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:300;backdrop-filter:blur(10px)}
.drawer{position:fixed;left:0;top:0;bottom:0;width:min(300px,85vw);background:#FFFFFF;z-index:400;display:flex;flex-direction:column;overflow-y:auto;transform:translateX(-100%);transition:transform .28s cubic-bezier(.4,0,.2,1);box-shadow:8px 0 40px rgba(0,0,0,.1)}
.drawer.open{transform:translateX(0)}
.mob-bar{display:none;position:fixed;bottom:0;left:0;right:0;z-index:200;background:#FFFFFF;border-top:1px solid rgba(0,0,0,.06);padding:6px 8px;padding-bottom:max(6px,env(safe-area-inset-bottom))}
.mob-bar-inner{display:flex;justify-content:space-around;align-items:center}
.mob-btn{display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 10px;border:none;background:none;cursor:pointer;color:#BFBAB4;font-size:9px;font-family:'Inter Tight',sans-serif;font-weight:600;border-radius:14px;transition:all .15s ease;min-width:52px;position:relative;-webkit-tap-highlight-color:transparent}
.mob-btn.on{color:#EC683E}
.mob-btn.on .mico{background:#EC683E;color:#fff;border-radius:100px;padding:4px 14px;box-shadow:0 2px 8px rgba(236,104,62,.3)}
.mico{font-size:24px;line-height:1;transition:all .2s ease;display:inline-block;position:relative;padding:4px 8px;border-radius:100px}
.ph{padding:28px 32px 22px;flex-shrink:0}
.ph h2{font-family:'Inter Tight',sans-serif;font-size:28px;color:#1A1A1A;font-weight:800;letter-spacing:-.3px}
.ph p{color:#8A8580;font-size:13px;margin-top:5px;font-weight:500}
.pb{padding:24px 32px}
.card{background:#FFFFFF;border:none;border-radius:18px;padding:22px;box-shadow:0 2px 12px rgba(0,0,0,.05);transition:all .15s ease}
@media(min-width:769px){.card:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,.08)}}
.cal-card{background:#FFFFFF;border:none;border-radius:18px;padding:18px;box-shadow:0 2px 12px rgba(0,0,0,.05)}
.chdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;gap:8px}
.ctit{font-size:15px;font-weight:700;color:#1A1A1A}
.btn{padding:9px 18px;border-radius:100px;border:none;cursor:pointer;font-size:13px;font-weight:600;font-family:'Inter Tight',sans-serif;transition:all .15s ease;display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.btn:active{transform:scale(.97)}
.bp{background:#1A1A1A;color:#FFFFFF}.bp:hover{background:#EC683E;box-shadow:0 4px 12px rgba(236,104,62,.25)}
.bg{background:#F0EDE8;color:#1A1A1A;border:none}.bg:hover{background:#E5E1DB}
.br{background:#FEE8E8;color:#F35757;border:none}.br:hover{background:#FDCECE}
.sm{padding:7px 14px;font-size:12px}
.fg{margin-bottom:16px}
.fg label{display:block;font-size:11px;color:#8A8580;margin-bottom:7px;text-transform:uppercase;letter-spacing:.5px;font-weight:700}
.fi{width:100%;padding:11px 14px;border-radius:12px;border:1.5px solid transparent;background:#F5F3F0;color:#1A1A1A;font-size:14px;font-family:'Inter Tight',sans-serif;outline:none;transition:all .2s ease;-webkit-appearance:none;appearance:none}
.fi:focus{border-color:#EC683E;background:#FFFFFF;box-shadow:0 0 0 3px rgba(236,104,62,.1)}
.fi::placeholder{color:#BFBAB4}
textarea.fi{resize:vertical;min-height:72px;line-height:1.5}
select.fi{cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238A8580' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;padding-right:38px}
.mft{display:flex;gap:8px;justify-content:flex-end;margin-top:20px;padding-top:18px;border-top:1px solid rgba(0,0,0,.06)}
.ov{position:fixed;inset:0;background:rgba(0,0,0,.4);backdrop-filter:blur(10px);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px}
@keyframes modalIn{from{opacity:0;transform:scale(.94) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
@keyframes modalSlideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
.modal{background:#FFFFFF;border:none;border-radius:24px;padding:30px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto;box-shadow:0 12px 48px rgba(0,0,0,.12);animation:modalIn .22s cubic-bezier(.34,1.56,.64,1)}
.modal h3{font-family:'Inter Tight',sans-serif;font-size:20px;color:#1A1A1A;font-weight:800;margin-bottom:22px}
.cli{display:flex;align-items:flex-start;gap:12px;padding:14px;border-radius:14px;border:none;background:#FFFFFF;margin-bottom:6px;box-shadow:0 1px 4px rgba(0,0,0,.04);transition:all .15s ease}
.cli.done{opacity:.65;background:#F5FFF0}
.chk{width:28px;height:28px;border-radius:8px;flex-shrink:0;border:2.5px solid #BFBAB4;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s cubic-bezier(.4,0,.2,1);margin-top:1px}
.chk:hover{border-color:#A6BE59}
.chk.on{background:#A6BE59;border-color:#A6BE59;animation:chkPop .2s ease}
@keyframes chkPop{0%{transform:scale(1)}50%{transform:scale(1.2)}100%{transform:scale(1)}}
.chk.on::after{content:"✓";color:#fff;font-size:14px;font-weight:800}
.tz{display:inline-block;font-size:10px;padding:3px 8px;border-radius:100px;background:rgba(236,104,62,.08);color:#EC683E;margin-bottom:4px;font-weight:700}
.tl{font-size:14px;color:#1A1A1A;line-height:1.5;font-weight:500}
.tl.done{text-decoration:line-through;color:#A6BE59}
.tm{font-size:11px;color:#8A8580;margin-top:3px;line-height:1.4}
.nbox{background:#FFFBEB;border:none;border-radius:12px;padding:10px 13px;margin-top:8px;font-size:12px;color:#8A7020;line-height:1.5}
.rbox{background:#F5FFF0;border:none;border-radius:12px;padding:10px 13px;margin-top:8px;font-size:12px;color:#6B8A20;line-height:1.5}
.ibtn{display:inline-flex;align-items:center;gap:4px;background:#F0EDE8;color:#EC683E;border:none;border-radius:100px;padding:5px 10px;font-size:11px;cursor:pointer;white-space:nowrap;transition:all .15s ease;flex-shrink:0;font-family:'Inter Tight',sans-serif;font-weight:600}
.ibtn:hover{background:#EC683E;color:#fff}
.pbtn{display:flex;align-items:center;justify-content:center;gap:7px;padding:12px 16px;border-radius:14px;cursor:pointer;background:#F5F3F0;color:#EC683E;border:2px dashed #BFBAB4;font-size:14px;font-family:'Inter Tight',sans-serif;font-weight:600;transition:all .2s ease;width:100%}
.pbtn:hover{background:#ECEAE5;border-color:#EC683E}
.pprev{width:100%;max-height:220px;object-fit:cover;border-radius:14px;margin-top:10px}
.pthumb{max-width:100%;max-height:160px;border-radius:14px;object-fit:cover;margin-top:8px;display:block}
.sg{display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:14px;margin-bottom:22px}
.sc{background:#FFFFFF;border:none;border-radius:18px;padding:18px;box-shadow:0 2px 12px rgba(0,0,0,.05);transition:all .15s ease}
.sc:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(0,0,0,.08)}
.sl{font-size:10px;color:#8A8580;text-transform:uppercase;letter-spacing:.5px;line-height:1.3;font-weight:700}
.sv{font-size:28px;font-weight:800;color:#1A1A1A;margin-top:6px;font-family:'Inter Tight',sans-serif;letter-spacing:-.3px}
.ss{font-size:11px;color:#EC683E;margin-top:4px;font-weight:600}
.prog{height:10px;background:#F0EDE8;border-radius:10px;overflow:hidden;margin-top:8px;position:relative}
.pfill{height:100%;border-radius:10px;background:linear-gradient(90deg,#EC683E,#AFA3FF);transition:width .4s ease}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
hr.div{border:none;border-top:1px solid rgba(0,0,0,.06);margin:16px 0}
.badge{display:inline-block;padding:3px 10px;border-radius:100px;font-size:11px;font-weight:600}
.empty{text-align:center;padding:48px 20px;color:#8A8580}
.empty .ico{font-size:48px;margin-bottom:12px;display:block}
.empty p{font-size:14px;line-height:1.6}
.alert{padding:12px 16px;border-radius:14px;font-size:13px;margin-bottom:16px;background:#FEE8E8;color:#F35757;border:none;font-weight:500}
.tabs{display:flex;gap:4px;background:#F0EDE8;padding:4px;border-radius:14px;margin-bottom:20px}
.tab{padding:9px 16px;border-radius:10px;cursor:pointer;font-size:12px;color:#8A8580;transition:all .15s ease;border:none;background:none;font-family:'Inter Tight',sans-serif;font-weight:600;white-space:nowrap}
.tab.on{background:#FFFFFF;color:#1A1A1A;box-shadow:0 2px 8px rgba(0,0,0,.06)}
.cg{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-top:12px}
.ch{text-align:center;font-size:10px;color:#8A8580;padding:6px 0;text-transform:uppercase;letter-spacing:.5px;font-weight:700}
.cd{aspect-ratio:1;border-radius:12px;border:1.5px solid transparent;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:12px;font-weight:500;cursor:pointer;transition:all .15s ease;background:#F5F3F0;color:#1A1A1A}
.cd:hover{border-color:#EC683E;background:rgba(236,104,62,.05);transform:scale(1.02)}
.cd.empty{background:transparent;border-color:transparent;cursor:default;transform:none}
.cd.today{border-color:#EC683E;color:#EC683E;font-weight:800;background:rgba(236,104,62,.06)}
.cd.hasev{background:rgba(175,163,255,.12);border-color:rgba(175,163,255,.35)}
.cd.sel{border-color:#EC683E;background:rgba(236,104,62,.1);box-shadow:0 0 0 3px rgba(236,104,62,.12)}
.cdot{width:5px;height:5px;border-radius:50%;margin-top:2px}
.cnav{display:flex;align-items:center;gap:12px;margin-bottom:12px}
.cnav button{background:none;border:none;color:#EC683E;cursor:pointer;font-size:22px;padding:6px 10px;border-radius:10px;line-height:1;transition:all .15s ease}
.cnav button:hover{background:rgba(236,104,62,.08)}
.cmon{font-family:'Inter Tight',sans-serif;font-size:20px;color:#1A1A1A;font-weight:800}
.cu{display:flex;align-items:center;gap:10px;padding:14px 16px;cursor:pointer;border-bottom:1px solid rgba(0,0,0,.04);transition:all .12s ease;position:relative;border-radius:8px;margin:2px 0}
.cu:hover{background:#F5F3F0}
.cu.on{background:rgba(236,104,62,.06)}
.msgs{flex:1;overflow-y:auto;padding:16px 18px;display:flex;flex-direction:column;gap:8px;background:#ECEAE5}
.bub{max-width:72%;padding:11px 15px;border-radius:16px;font-size:13px;line-height:1.5;word-break:break-word;transition:all .1s ease}
.bub.me{align-self:flex-end;background:#1A1A1A;color:#FFFFFF;border-bottom-right-radius:4px}
.bub.them{align-self:flex-start;background:#FFFFFF;border:none;color:#1A1A1A;border-bottom-left-radius:4px;box-shadow:0 1px 6px rgba(0,0,0,.06)}
.bmeta{font-size:10px;opacity:.45;margin-top:4px;font-weight:500}
.nitem{display:flex;gap:12px;padding:14px 18px;border-bottom:1px solid rgba(0,0,0,.05);transition:background .1s ease}
.nitem.unread{background:rgba(236,104,62,.04);border-left:3px solid #EC683E}
.ndot{width:8px;height:8px;border-radius:50%;background:#EC683E;flex-shrink:0;margin-top:5px}
.ndot.read{background:#BFBAB4}
.pbanner{background:rgba(127,178,255,.1);border:none;border-radius:14px;padding:12px 18px;margin:12px 32px 0;display:flex;align-items:center;justify-content:space-between;gap:10px}
.pbanner span{font-size:13px;color:#5A8AD4;font-weight:500}
.lw{min-height:100vh;min-height:100dvh;display:flex;align-items:center;justify-content:center;background:#ECEAE5;position:relative;overflow:hidden;padding:16px}
.lbg{position:absolute;inset:0;opacity:.025;background-image:radial-gradient(circle at 25% 25%,rgba(236,104,62,.15) 0%,transparent 50%),radial-gradient(circle at 75% 75%,rgba(175,163,255,.15) 0%,transparent 50%)}
.lc{background:#FFFFFF;border:none;border-radius:28px;padding:44px 38px;width:100%;max-width:400px;position:relative;box-shadow:0 12px 48px rgba(0,0,0,.08)}
.llo{text-align:center;margin-bottom:32px}
.llo h1{font-family:'Inter Tight',sans-serif;font-size:28px;color:#EC683E;font-weight:800}
.llo p{font-size:10px;color:#8A8580;margin-top:8px;text-transform:uppercase;letter-spacing:2px;font-weight:600}
.rc{background:#FFFFFF;border:none;border-radius:16px;padding:18px 20px;margin-bottom:10px;cursor:pointer;transition:all .18s ease;border-left:3px solid transparent;box-shadow:0 1px 6px rgba(0,0,0,.04)}
.rc:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.10)}
.rc:active{transform:scale(.98)}
.detail-panel{animation:panelIn .22s ease}
@keyframes panelIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}
.spin{display:inline-block;width:18px;height:18px;border:2.5px solid rgba(236,104,62,.15);border-top-color:#EC683E;border-radius:50%;animation:spin .6s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.loading{display:flex;align-items:center;justify-content:center;min-height:200px;color:#8A8580;gap:10px;font-size:14px;font-weight:500}
.drawer-user-card{padding:22px 18px 18px;border-bottom:1px solid rgba(0,0,0,.06);display:flex;align-items:center;gap:14px;background:linear-gradient(135deg,rgba(236,104,62,.04),rgba(175,163,255,.04));flex-shrink:0}
.drawer-close{background:none;border:none;color:#8A8580;font-size:22px;cursor:pointer;padding:6px;margin-left:auto;border-radius:8px;line-height:1;flex-shrink:0;transition:all .15s ease}
.drawer-close:hover{color:#1A1A1A;background:#F5F3F0}
.chat-list-col{width:240px;flex-shrink:0;border-right:1px solid rgba(0,0,0,.06);overflow-y:auto;display:flex;flex-direction:column;background:#FFFFFF}
.chat-area{flex:1;display:flex;flex-direction:column;min-width:0;min-height:0}
.chdr2{padding:14px 20px;border-bottom:1px solid rgba(0,0,0,.06);display:flex;align-items:center;gap:12px;flex-shrink:0;background:#FFFFFF}
@media (min-width:769px){
  .mob-top,.mob-bar,.drawer,.drawer-overlay,.mob-back{display:none!important}
  .chat-mobile-wrap{display:none!important}
}
@media (max-width:768px){
  .app>.sb{display:none!important;width:0!important;min-width:0!important;overflow:hidden!important}
  .mob-top{display:flex}.mob-bar{display:block}
  .app{flex-direction:column}.main{width:100%;flex:1;overflow-x:hidden}
  .ph{padding:18px 16px 14px}.ph h2{font-size:24px}
  .pb{padding:16px 14px 96px}
  .g2{grid-template-columns:1fr;gap:12px}
  .sg{grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}
  .sv{font-size:24px}.sc{padding:14px}
  .card{padding:16px;border-radius:16px}.card:hover{transform:none}
  .chdr{margin-bottom:13px}
  .cli{padding:14px 12px}.chk{width:30px;height:30px;border-radius:8px}.tl{font-size:15px}
  .btn{font-size:14px;padding:12px 18px;min-height:44px}.sm{padding:8px 14px;font-size:12px;min-height:auto}
  .tabs{overflow-x:auto;-webkit-overflow-scrolling:touch;flex-wrap:nowrap;scrollbar-width:none;margin-bottom:16px}
  .tabs::-webkit-scrollbar{display:none}.tab{padding:9px 18px;font-size:13px;flex-shrink:0}
  .ov{padding:0;align-items:flex-end}
  .modal{border-radius:24px 24px 0 0;max-height:92vh;padding:24px 18px 36px;max-width:100%;width:100%;animation:modalSlideUp .28s cubic-bezier(.34,1.56,.64,1)}
  .modal h3{font-size:19px;margin-bottom:18px}
  .modal .btn{min-height:52px;font-size:15px}
  .chat-list-col{display:none}
  .chat-area{display:flex;flex-direction:column;height:calc(100dvh - 56px - 68px);overflow:hidden;position:relative}
  .msgs{padding:12px 14px;padding-bottom:80px}
  .bub{max-width:85%;font-size:14px}
  .chat-inp-wrap{position:absolute;bottom:0;left:0;right:0;background:#FFFFFF;border-top:1px solid rgba(0,0,0,.06);padding:10px 12px;padding-bottom:max(10px,env(safe-area-inset-bottom));z-index:10}
  .cal-card{padding:14px 12px!important;border-radius:16px!important}
  .cg{gap:3px;margin-top:8px}
  .cd{aspect-ratio:unset!important;height:38px;border-radius:8px;font-size:11px;min-width:0}
  .cdot{width:4px;height:4px;margin-top:1px}
  .ch{font-size:9px;padding:4px 0;letter-spacing:0}.cmon{font-size:16px}.cnav{margin-bottom:8px}
  .pbanner{margin:10px 16px 0;padding:10px 14px}.pbanner span{font-size:12px}
  .lc{padding:36px 28px;border-radius:24px}
  .chat-desktop-only{display:none!important}
  .chat-mobile-wrap{display:flex;flex-direction:column;height:calc(100dvh - 56px - 68px);overflow:hidden}
}
@media (max-width:400px){.sg{grid-template-columns:1fr 1fr}.sv{font-size:22px}.ph h2{font-size:22px}.mob-btn{min-width:46px;font-size:9px}.mico{font-size:22px}}
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

  const [opDesactivado,setOpDesactivado]=useState(false);

  useEffect(()=>{
    regSW();
    // Check operario session first
    const opSaved=localStorage.getItem("fm_operario_session");
    if(opSaved){
      try{
        const op=JSON.parse(opSaved);
        // Verify still active
        sbGet("operarios",`?id=eq.${op.id}&select=*`).then(rows=>{
          if(rows[0]&&rows[0].activo){
            setSession({access_token:SB_KEY});
            setPerfil({id:op.id,nombre:op.nombre,rol:op.rol,referencia_id:op.referencia_id,es_operario:true,avatar:op.avatar||op.nombre.slice(0,2).toUpperCase()});
          }else{
            localStorage.removeItem("fm_operario_session");
            if(rows[0]&&!rows[0].activo)setOpDesactivado(true);
          }
        }).catch(()=>{localStorage.removeItem("fm_operario_session");});
      }catch(_){localStorage.removeItem("fm_operario_session");}
      setAuthLoad(false);return;
    }
    const saved=localStorage.getItem("fm_session");
    if(saved){
      try{
        const s=JSON.parse(saved);
        setSession(s);
        sbGet("usuarios",`?id=eq.${s.user.id}&select=*`,s.access_token)
          .then(rows=>{
            if(rows[0]){
              setPerfil(rows[0]);
              subscribePush(s.user.id,s.access_token,rows[0].rol);
              if(rows[0].rol==="admin"){autoRecurrentes(s.access_token,setToast);checkNotifDiaria(s.access_token);}
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
    askPerm().then(p=>{setPerm(p);if(p==="granted")subscribePush(d.user.id,d.access_token,rows[0]?.rol);});
  };

  const loginOperario=(op)=>{
    localStorage.setItem("fm_operario_session",JSON.stringify(op));
    setSession({access_token:SB_KEY});
    setPerfil({id:op.id,nombre:op.nombre,rol:op.rol,referencia_id:op.referencia_id,es_operario:true,avatar:op.avatar||op.nombre.slice(0,2).toUpperCase()});
    setPage("dashboard");setOpDesactivado(false);
  };

  const logout=async()=>{
    if(perfil?.es_operario){
      localStorage.removeItem("fm_operario_session");
    }else{
      if(session?.access_token&&session.access_token!==SB_KEY)await authLogout(session.access_token).catch(()=>{});
      localStorage.removeItem("fm_session");
    }
    setSession(null);setPerfil(null);setPage("dashboard");setDrawerOpen(false);
  };

  if(authLoad)return <><style>{CSS}</style><div className="loading"><div className="spin"/><span>Cargando…</span></div></>;
  if(!session||!perfil)return <><style>{CSS}</style><LoginScreen onLogin={login} onLoginOperario={loginOperario} desactivado={opDesactivado}/></>;

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
    ajustes:     <Ajustes     {...P}/>,
    limpiadoras:  <LimpiadorasPage {...P}/>,
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
        <button className="mob-menu-btn" onClick={()=>setDrawerOpen(true)}><Icon name="menu" size={22}/></button>
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
      {toast&&<div style={{position:"fixed",bottom:80,left:"50%",transform:"translateX(-50%)",background:"#FFFFFF",border:"1px solid rgba(16,185,129,.3)",borderRadius:12,padding:"12px 20px",color:"#A6BE59",fontSize:13,fontWeight:500,zIndex:9999,boxShadow:"0 8px 32px rgba(0,0,0,.5)",whiteSpace:"nowrap",maxWidth:"90vw"}} onClick={()=>setToast(null)}>{toast}</div>}
    </div>
  </>;
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginScreen({onLogin,onLoginOperario,desactivado}){
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [err,setErr]=useState("");
  const [load,setLoad]=useState(false);
  // Operario states
  const [modo,setModo]=useState("admin"); // "admin" | "seleccion" | "pin"
  const [operarios,setOperarios]=useState([]);
  const [selOp,setSelOp]=useState(null);
  const [pin,setPin]=useState("");
  const [pinErr,setPinErr]=useState(false);
  const [opLoad,setOpLoad]=useState(false);

  const go=async()=>{
    if(!email||!pass){setErr("Introduce email y contraseña");return;}
    setLoad(true);setErr("");
    try{await onLogin(email,pass);}
    catch(e){setErr(e.message||"Credenciales incorrectas");}
    finally{setLoad(false);}
  };

  const cargarOperarios=async()=>{
    setOpLoad(true);
    try{const ops=await sbGet("operarios","?activo=eq.true&select=*&order=nombre.asc");setOperarios(ops);}catch(_){setOperarios([]);}
    setOpLoad(false);setModo("seleccion");
  };

  const seleccionarOp=(op)=>{setSelOp(op);setPin("");setPinErr(false);setModo("pin");};

  const addDigit=(d)=>{
    if(pin.length>=4)return;
    const newPin=pin+d;
    setPin(newPin);setPinErr(false);
    if(newPin.length===4){
      // Verify
      if(newPin===selOp.pin){
        onLoginOperario(selOp);
      }else{
        setPinErr(true);
        setTimeout(()=>{setPin("");setPinErr(false);},600);
      }
    }
  };
  const delDigit=()=>{setPin(p=>p.slice(0,-1));setPinErr(false);};

  return <div className="lw"><div className="lbg"/>
    {modo==="admin"&&<div className="lc">
      <div className="llo">
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,marginBottom:8}}>
          <MolinoLogo size={42}/><h1>Finca El Molino</h1>
        </div>
        <p>Sistema de Gestión</p>
      </div>
      {desactivado&&<div className="alert">Tu acceso ha sido desactivado. Contacta con el administrador.</div>}
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
      <div style={{display:"flex",alignItems:"center",gap:12,margin:"24px 0 16px"}}>
        <div style={{flex:1,height:1,background:"rgba(0,0,0,.08)"}}/><span style={{fontSize:11,color:"#BFBAB4",fontWeight:600}}>o accede como operario</span><div style={{flex:1,height:1,background:"rgba(0,0,0,.08)"}}/>
      </div>
      <button className="btn bg" style={{width:"100%",justifyContent:"center",fontSize:14,padding:"12px"}} onClick={cargarOperarios}>
        <Icon name="users" size={18} color="#8A8580"/> Soy del equipo
      </button>
    </div>}

    {modo==="seleccion"&&<div className="lc" style={{maxWidth:420}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:24}}>
        <button className="btn bg sm" onClick={()=>setModo("admin")}><Icon name="back" size={16}/></button>
        <div style={{fontSize:18,fontWeight:800,color:"#1A1A1A"}}>Selecciona tu perfil</div>
      </div>
      {opLoad?<div className="loading"><div className="spin"/></div>
      :operarios.length===0?<div style={{textAlign:"center",color:"#8A8580",padding:"20px 0"}}>No hay operarios registrados</div>
      :<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))",gap:12}}>
        {operarios.map(op=>(
          <button key={op.id} onClick={()=>seleccionarOp(op)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,padding:"18px 12px",background:"#F5F3F0",borderRadius:16,border:"none",cursor:"pointer",transition:"all .15s ease",fontFamily:"'Inter Tight',sans-serif"}}>
            <div style={{width:52,height:52,borderRadius:"50%",background:"linear-gradient(135deg,#EC683E,#AFA3FF)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:700,color:"#fff"}}>{op.avatar||op.nombre.slice(0,2).toUpperCase()}</div>
            <div style={{fontSize:13,fontWeight:600,color:"#1A1A1A",textAlign:"center"}}>{op.nombre}</div>
            <span className="badge" style={{background:op.rol==="jardinero"?"rgba(166,190,89,.15)":"rgba(175,163,255,.15)",color:op.rol==="jardinero"?"#6B8A20":"#7B6FCC",fontSize:10}}>{op.rol==="jardinero"?"Jardinero":"Limpieza"}</span>
          </button>
        ))}
      </div>}
    </div>}

    {modo==="pin"&&selOp&&<div className="lc" style={{maxWidth:340,textAlign:"center"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:24}}>
        <button className="btn bg sm" onClick={()=>setModo("seleccion")}><Icon name="back" size={16}/></button>
        <div style={{fontSize:16,fontWeight:700,color:"#1A1A1A"}}>{selOp.nombre}</div>
      </div>
      <div style={{width:60,height:60,borderRadius:"50%",background:"linear-gradient(135deg,#EC683E,#AFA3FF)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:700,color:"#fff",margin:"0 auto 16px"}}>{selOp.avatar||selOp.nombre.slice(0,2).toUpperCase()}</div>
      <div style={{fontSize:14,color:"#8A8580",marginBottom:20}}>Introduce tu PIN</div>
      <div style={{display:"flex",justifyContent:"center",gap:14,marginBottom:28,animation:pinErr?"shake .3s ease":"none"}}>
        {[0,1,2,3].map(i=><div key={i} style={{width:18,height:18,borderRadius:"50%",background:pin.length>i?"#1A1A1A":"transparent",border:`2.5px solid ${pinErr?"#F35757":pin.length>i?"#1A1A1A":"#BFBAB4"}`,transition:"all .15s ease"}}/>)}
      </div>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}`}</style>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,maxWidth:240,margin:"0 auto"}}>
        {[1,2,3,4,5,6,7,8,9,null,0,"del"].map((d,i)=>(
          d===null?<div key={i}/>:
          <button key={i} onClick={()=>d==="del"?delDigit():addDigit(String(d))} style={{width:64,height:64,borderRadius:16,border:"none",background:d==="del"?"transparent":"#F5F3F0",cursor:"pointer",fontSize:d==="del"?16:24,fontWeight:700,color:"#1A1A1A",fontFamily:"'Inter Tight',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .1s ease",margin:"0 auto"}}>
            {d==="del"?<Icon name="back" size={20} color="#8A8580"/>:d}
          </button>
        ))}
      </div>
    </div>}
  </div>;
}

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────
function Sidebar({perfil,page,setPage,onLogout,inDrawer,onClose}){
  const rol=perfil.rol;
  const isA=rol==="admin",isJ=rol==="jardinero",isL=rol==="limpieza",isC=rol==="comercial";
  const RL={admin:"Administrador",jardinero:"Jardinero",limpieza:"Limpieza",comercial:"Comercial"};
  const av=perfil.avatar||perfil.nombre.slice(0,2).toUpperCase();
  const nItem=(ico,lbl,id,badge)=>{
    const on=page===id;
    return <div key={id} className="nw">
      <button className={`nb${on?" on":""}`} onClick={()=>setPage(id)}>
        <span className="nb-ico">{typeof ico==="string"&&ico.length<=2?ico:<Icon name={ico} size={18} color={on?"#FFFFFF":"#8A8580"}/>}</span>{lbl}
      </button>
      {badge>0&&<span className="nb-badge">{badge>9?"9+":badge}</span>}
    </div>;
  };
  return <aside className="sb">
    {inDrawer?(
      <div className="drawer-user-card">
        <div className="av" style={{width:44,height:44,fontSize:14}}>{av}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:15,fontWeight:700,color:"#1A1A1A",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{perfil.nombre}</div>
          <div style={{fontSize:11,color:"#EC683E",marginTop:2,fontWeight:600}}>{RL[rol]}</div>
        </div>
        <button className="drawer-close" onClick={onClose}><Icon name="close" size={20} color="#8A8580"/></button>
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
      {nItem("dashboard","Panel principal","dashboard")}
      {(isA||isJ)&&<><p className="nav-sec">Jardín</p>
        {nItem("check",isA?"Checklist jardín":"Mi checklist","jcheck")}
        {isA&&nItem("garden","Gestión jardín","jadmin")}
        {isA&&nItem("incidencias","Incidencias","incidencias")}
        {isA&&nItem("gardeners","Jardineros","jardineros")}
        {isJ&&nItem("calendar","Calendario","cal-jardin")}
      </>}
      {(isA||isL)&&<><p className="nav-sec">Limpieza</p>
        {nItem("cleaning",isA?"Gestión limpieza":"Mi servicio","limpieza")}
        {isA&&nItem("limpiadoras","Limpiadoras","limpiadoras")}
        {isL&&nItem("calendar","Calendario","cal-limp")}
      </>}
      {(isA||isC)&&<><p className="nav-sec">Reservas</p>
        {nItem("calendar","Calendario","calendario")}
        {nItem("reservations","Reservas","reservas")}
        {isA&&nItem("new_res","Nueva reserva","nueva-res")}
        {nItem("visits","Visitas","visitas")}
        {isA&&nItem("airbnb","Airbnb","airbnb")}
      </>}
      <p className="nav-sec">Comunicación</p>
      {nItem("chat",isA?"Chat con equipo":"Chat con admin","chat")}
      {nItem("notifications","Notificaciones","notifs")}
      {isA&&<><p className="nav-sec">Admin</p>{nItem("expenses","Gastos","gastos")}{nItem("users","Usuarios","usuarios")}{nItem("settings","Ajustes","ajustes")}</>}
    </nav>
    {!inDrawer&&(
      <div className="sb-user">
        <div className="av">{av}</div>
        <div style={{flex:1,minWidth:0}}>
          <div className="uname">{perfil.nombre}</div>
          <div className="urole">{RL[rol]}</div>
        </div>
        <button className="logout-btn" onClick={onLogout} title="Cerrar sesión"><Icon name="logout" size={18}/></button>
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
    if(!tok||perfil?.es_operario)return;
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

  const items=[{ico:"dashboard",lbl:"Inicio",id:"dashboard"}];
  if(isA||isJ)items.push({ico:isA?"garden":"check",lbl:isA?"Jardín":"Checklist",id:isA?"jadmin":"jcheck"});
  if(isJ)items.push({ico:"calendar",lbl:"Calendario",id:"cal-jardin"});
  if(isA)items.push({ico:"incidencias",lbl:"Incidencias",id:"incidencias"});
  if(isA||isL)items.push({ico:"cleaning",lbl:"Limpieza",id:"limpieza"});
  if(!isA&&!isJ&&!isL)items.push({ico:"calendar",lbl:"Calendario",id:"calendario"});
  if(!isA&&!isJ&&!isL)items.push({ico:"reservations",lbl:"Reservas",id:"reservas"});
  if(!isA&&!isJ&&!isL)items.push({ico:"visits",lbl:"Visitas",id:"visitas"});
  items.push({ico:"chat",lbl:"Chat",id:"chat",badge:chatBadge});
  items.push({ico:"notifications",lbl:"Avisos",id:"notifs"});
  const shown=items.slice(0,5);

  return <nav className="mob-bar">
    <div className="mob-bar-inner">
      {shown.map(it=>{
        const on=page===it.id;
        return <button key={it.id} className={`mob-btn${on?" on":""}`} onClick={()=>setPage(it.id)}>
          <span className="mico">
            <Icon name={it.ico} size={22} color={on?"#fff":"#BFBAB4"}/>
            {(it.badge||0)>0&&(
              <span style={{position:"absolute",top:-4,right:-8,background:"#F35757",color:"#fff",borderRadius:20,padding:"1px 5px",fontSize:9,fontWeight:700,minWidth:14,textAlign:"center",lineHeight:"14px"}}>
                {it.badge>9?"9+":it.badge}
              </span>
            )}
          </span>
          <span>{it.lbl}</span>
        </button>;
      })}
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
      {sub&&<div style={{fontSize:11,color:"#8A8580"}}>{sub}</div>}
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
  const [raw,setRaw]=useState({reservas:[],airbnbs:[],gastos:[],cfg:{}});
  const [load,setLoad]=useState(true);
  const [kpiAbierto,setKpiAbierto]=useState(null);

  const getRango=()=>{
    if(periodo==="año")return{desde:`${añoActual}-01-01`,hasta:`${añoActual}-12-31`};
    if(periodo==="mes"){const m=String(hoy.getMonth()+1).padStart(2,"0");const ld=new Date(añoActual,hoy.getMonth()+1,0).getDate();return{desde:`${añoActual}-${m}-01`,hasta:`${añoActual}-${m}-${String(ld).padStart(2,"0")}`};}
    if(periodo==="semana"){const d=new Date(hoy);const day=d.getDay();const diff=d.getDate()-day+(day===0?-6:1);const lun=new Date(d.setDate(diff));const dom=new Date(lun);dom.setDate(lun.getDate()+6);return{desde:lun.toISOString().split("T")[0],hasta:dom.toISOString().split("T")[0]};}
    return{desde:rangoDesde,hasta:rangoHasta};
  };

  const cargar=async()=>{
    setLoad(true);
    try{
      const{desde,hasta}=getRango();
      const[reservas,airbnbs,gastos,configRows]=await Promise.all([
        sbGet("reservas",`?fecha=gte.${desde}&fecha=lte.${hasta}&select=*`,tok),
        sbGet("reservas_airbnb",`?fecha_entrada=gte.${desde}&fecha_entrada=lte.${hasta}&select=*`,tok),
        sbGet("gastos",`?fecha=gte.${desde}&fecha=lte.${hasta}&select=*`,tok).catch(()=>[]),
        sbGet("configuracion","?select=*",tok).catch(()=>[]),
      ]);
      const cfg={};configRows.forEach(c=>cfg[c.clave]=c.valor);
      const comisionPct=parseFloat(cfg.comision_pct)||10;
      const factEventos=reservas.reduce((s,r)=>s+(parseFloat(r.precio_total)||parseFloat(r.precio)||0),0);
      const factAirbnb=airbnbs.reduce((s,a)=>s+(parseFloat(a.precio)||0),0);
      const facturacion=factEventos+factAirbnb;
      let cobradoEventos=0;
      for(const r of reservas){const seña=parseFloat(r.seña_importe)||0;const pt=parseFloat(r.precio_total)||parseFloat(r.precio)||0;if(r.seña_cobrada)cobradoEventos+=seña;if(r.saldo_cobrado)cobradoEventos+=(pt-seña);}
      const cobradoAirbnb=airbnbs.filter(a=>a.cobrado||a.fecha_entrada<hoyStr).reduce((s,a)=>s+(parseFloat(a.precio)||0),0);
      const yaCobrado=cobradoEventos+cobradoAirbnb;
      const pendiente=facturacion-yaCobrado;
      const gastosReales=gastos.reduce((s,g)=>s+(parseFloat(g.importe)||0),0);
      let gastosProyectados=gastosReales;
      if(periodo==="año"){const mA=hoy.getMonth()+1;const mR=12-mA;const gRec=gastos.filter(g=>g.recurrente);if(gRec.length>0&&mA>0){gastosProyectados=gastosReales+(gRec.reduce((s,g)=>s+(parseFloat(g.importe)||0),0)/mA*mR);}}
      const beneficio=yaCobrado-gastosReales;
      const comision=facturacion*(comisionPct/100);
      setData({facturacion,factEventos,factAirbnb,yaCobrado,cobradoEventos,cobradoAirbnb,pendiente,gastosReales,gastosProyectados,beneficio,comision,comisionPct,desde,hasta});
      setRaw({reservas,airbnbs,gastos,cfg});
    }catch(_){setData(null);}
    setLoad(false);
  };

  useEffect(()=>{cargar();},[periodo,rangoDesde,rangoHasta]);

  const fmt=v=>`${v.toLocaleString("es-ES",{minimumFractionDigits:0,maximumFractionDigits:0})}€`;
  const fmtF=f=>f?new Date(f+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"}):"—";
  const toggleKpi=id=>setKpiAbierto(kpiAbierto===id?null:id);
  const panelStyle={background:"#F5F3F0",borderRadius:14,padding:"14px 16px",marginTop:10,fontSize:13,color:"#1A1A1A",lineHeight:1.6};
  const rowStyle={display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid rgba(0,0,0,.04)",gap:8};

  // Alertas
  const alertas=[];
  if(data&&raw.reservas){
    const en30=new Date(Date.now()+30*86400000).toISOString().split("T")[0];
    const urgentes=raw.reservas.filter(r=>r.estado_pago!=="pagado_completo"&&!["cancelada","finalizada"].includes(r.estado)&&r.fecha<=en30);
    if(urgentes.length>0){const imp=urgentes.reduce((s,r)=>s+(parseFloat(r.precio_total)||parseFloat(r.precio)||0)-(parseFloat(r.seña_importe)||0),0);alertas.push({tipo:"rojo",txt:`${urgentes.length} reserva(s) con cobro pendiente en menos de 30 días — ${Math.round(imp).toLocaleString("es-ES")}€ por cobrar`});}
    if(raw.gastos.length>0){const ult=raw.gastos.sort((a,b)=>b.fecha?.localeCompare(a.fecha))[0];const dias=ult?Math.floor((Date.now()-new Date(ult.fecha).getTime())/86400000):999;if(dias>30)alertas.push({tipo:"amarillo",txt:`Llevas ${dias} días sin registrar gastos — ¿están al día?`});}
    if(data.yaCobrado>0&&data.gastosReales/data.yaCobrado>.7)alertas.push({tipo:"rojo",txt:`Los gastos representan el ${Math.round(data.gastosReales/data.yaCobrado*100)}% de lo cobrado — margen ajustado`});
    if(data.beneficio>0&&data.yaCobrado>0)alertas.push({tipo:"verde",txt:`Margen actual: ${Math.round(data.beneficio/data.yaCobrado*100)}% — beneficio de ${fmt(data.beneficio)}`});
  }

  const kpis=[
    {id:"fact",lbl:"Facturación proyectada",val:data?.facturacion,bg:"#EC683E",light:true},
    {id:"cobrado",lbl:"Ya cobrado",val:data?.yaCobrado,bg:"#A6BE59",light:true},
    {id:"pendiente",lbl:"Pendiente de cobro",val:data?.pendiente,bg:"#ECD227",light:false},
    {id:"gastos",lbl:"Gastos reales",val:data?.gastosReales,bg:"#F35757",light:true},
    {id:"gastosProy",lbl:"Gastos proyectados año",val:data?.gastosProyectados,bg:"#F35757",light:true,opacity:.8},
    {id:"beneficio",lbl:"Beneficio estimado",val:data?.beneficio,bg:"#AFA3FF",light:false},
    {id:"comision",lbl:`Comisión gestor (${data?.comisionPct||10}%)`,val:data?.comision,bg:"#7FB2FF",light:false},
  ];

  return <><div className="card" style={{marginBottom:16}}>
    <div className="chdr"><span className="ctit">💰 KPIs financieros</span></div>
    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
      {[{id:"año",lbl:"Este año"},{id:"mes",lbl:"Este mes"},{id:"semana",lbl:"Esta semana"},{id:"rango",lbl:"Rango"}].map(p=>(
        <button key={p.id} className={`btn sm${periodo===p.id?" bp":" bg"}`} onClick={()=>setPeriodo(p.id)}>{p.lbl}</button>
      ))}
    </div>
    {periodo==="rango"&&<div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
      <input type="date" className="fi" value={rangoDesde} onChange={e=>setRangoDesde(e.target.value)} style={{flex:1,minWidth:130}}/>
      <span style={{color:"#8A8580",fontSize:12}}>→</span>
      <input type="date" className="fi" value={rangoHasta} onChange={e=>setRangoHasta(e.target.value)} style={{flex:1,minWidth:130}}/>
    </div>}
    {load?<div style={{display:"flex",alignItems:"center",gap:8,justifyContent:"center",padding:"20px 0",color:"#8A8580",fontSize:13}}><div className="spin" style={{width:16,height:16,borderWidth:2}}/>Calculando…</div>
    :data?<>
      {data.desde&&<div style={{fontSize:11,color:"#8A8580",marginBottom:12}}>📅 {fmtF(data.desde)} – {new Date(data.hasta+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short",year:"numeric"})}</div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10}}>
        {kpis.map(k=>k.val!==undefined&&<div key={k.id}>
          <div onClick={()=>toggleKpi(k.id)} style={{background:k.bg,borderRadius:18,padding:20,cursor:"pointer",opacity:k.opacity||1,transition:"all .15s",border:kpiAbierto===k.id?"3px solid #1A1A1A":"3px solid transparent"}}>
            <div style={{fontSize:10,color:k.light?"rgba(255,255,255,.7)":"rgba(0,0,0,.5)",textTransform:"uppercase",letterSpacing:.5,fontWeight:600}}>{k.lbl}</div>
            <div style={{fontSize:22,fontWeight:800,color:k.light?"#fff":"#1A1A1A",marginTop:5}}>{fmt(k.val)}</div>
          </div>
          {/* Expanded panel */}
          {kpiAbierto===k.id&&<div style={panelStyle}>
            {k.id==="fact"&&(()=>{
              const cw=typeof window!=="undefined"?Math.min(window.innerWidth-80,380):300;
              const mData=MESES_CORTO.map((lbl,i)=>{const m=String(i+1).padStart(2,"0");const ev=raw.reservas.filter(r=>r.fecha?.slice(5,7)===m).reduce((s,r)=>s+(parseFloat(r.precio_total)||parseFloat(r.precio)||0),0);const ab=raw.airbnbs.filter(a=>a.fecha_entrada?.slice(5,7)===m).reduce((s,a)=>s+(parseFloat(a.precio)||0),0);return{name:lbl,Eventos:Math.round(ev),Airbnb:Math.round(ab)};});
              const hasData=mData.some(m=>m.Eventos>0||m.Airbnb>0);
              return <>
              <div style={{fontWeight:700,marginBottom:8}}>Desglose facturación</div>
              <div style={rowStyle}><span>Eventos ({raw.reservas.length})</span><strong>{fmt(data.factEventos)}</strong></div>
              <div style={rowStyle}><span>Airbnb ({raw.airbnbs.length})</span><strong>{fmt(data.factAirbnb)}</strong></div>
              {hasData&&<div style={{marginTop:12,overflow:"hidden"}}>
                <BarChart width={cw} height={120} data={mData} margin={{top:5,right:5,left:-20,bottom:5}}>
                  <XAxis dataKey="name" tick={{fontSize:9,fill:"#8A8580"}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:9,fill:"#8A8580"}} axisLine={false} tickLine={false} tickFormatter={fmtK}/>
                  <Tooltip {...ChartTooltipStyle} formatter={(v,n)=>[`${v.toLocaleString("es-ES")}€`,n]}/>
                  <Bar dataKey="Eventos" fill="#EC683E" radius={[3,3,0,0]}/>
                  <Bar dataKey="Airbnb" fill="#A6BE59" radius={[3,3,0,0]}/>
                </BarChart>
              </div>}
              {raw.reservas.slice(0,5).map(r=><div key={r.id} style={{...rowStyle,fontSize:12,color:"#8A8580"}}><span style={{flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.nombre}</span><span>{fmtF(r.fecha)}</span><strong style={{color:"#1A1A1A"}}>{fmt(parseFloat(r.precio_total)||parseFloat(r.precio)||0)}</strong></div>)}
              {raw.airbnbs.slice(0,3).map(a=><div key={a.id} style={{...rowStyle,fontSize:12,color:"#8A8580"}}><span style={{flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>🏠 {a.huesped}</span><span>{fmtF(a.fecha_entrada)}</span><strong style={{color:"#1A1A1A"}}>{fmt(parseFloat(a.precio)||0)}</strong></div>)}
            </>;})()}
            {k.id==="cobrado"&&<>
              <div style={{fontWeight:700,marginBottom:8}}>Desglose cobros</div>
              <div style={rowStyle}><span>Señas cobradas</span><strong>{fmt(data.cobradoEventos)}</strong></div>
              <div style={rowStyle}><span>Airbnb cobrado</span><strong>{fmt(data.cobradoAirbnb)}</strong></div>
              <div style={{fontWeight:600,marginTop:10,marginBottom:6,fontSize:12,color:"#8A8580"}}>Pendientes de saldo:</div>
              {raw.reservas.filter(r=>r.seña_cobrada&&!r.saldo_cobrado).slice(0,5).map(r=><div key={r.id} style={{...rowStyle,fontSize:12}}><span style={{flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.nombre}</span><span style={{color:"#D4A017"}}>{fmt((parseFloat(r.precio_total)||parseFloat(r.precio)||0)-(parseFloat(r.seña_importe)||0))}</span></div>)}
            </>}
            {k.id==="pendiente"&&<>
              <div style={{fontWeight:700,marginBottom:8}}>Cobros pendientes por urgencia</div>
              {raw.reservas.filter(r=>r.estado_pago!=="pagado_completo"&&!["cancelada","finalizada"].includes(r.estado)).sort((a,b)=>a.fecha?.localeCompare(b.fecha)).slice(0,8).map(r=>{const dias=Math.round((new Date(r.fecha)-new Date())/(86400000));const sem=dias<30?"🔴":dias<90?"🟡":"🟢";const pend=(parseFloat(r.precio_total)||parseFloat(r.precio)||0)-(r.seña_cobrada?parseFloat(r.seña_importe)||0:0);return <div key={r.id} style={{...rowStyle,fontSize:12}}><span>{sem}</span><span style={{flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.nombre}</span><span style={{color:"#8A8580"}}>{fmtF(r.fecha)}</span><strong style={{color:"#D4A017"}}>{fmt(pend)}</strong></div>;})}
            </>}
            {k.id==="gastos"&&(()=>{
              const cats={};raw.gastos.forEach(g=>{const c=g.categoria||"Otros";cats[c]=(cats[c]||0)+(parseFloat(g.importe)||0);});
              const total=data.gastosReales||1;
              const catEntries=Object.entries(cats).sort((a,b)=>b[1]-a[1]);
              const pieColors=["#F35757","#EC683E","#ECD227","#A6BE59","#7FB2FF","#AFA3FF","#BFBAB4"];
              const pieData=catEntries.map(([c,v])=>({name:c,value:Math.round(v)}));
              const cw=typeof window!=="undefined"?Math.min(window.innerWidth-80,380):300;
              return <>
              <div style={{fontWeight:700,marginBottom:8}}>Por categoría</div>
              {pieData.length>1&&<div style={{marginBottom:12,overflow:"hidden"}}>
                <PieChart width={cw} height={160}>
                  <Pie data={pieData} cx={cw/2} cy={80} innerRadius={35} outerRadius={60} dataKey="value" strokeWidth={0}>
                    {pieData.map((_,i)=><Cell key={i} fill={pieColors[i%pieColors.length]}/>)}
                  </Pie>
                  <Tooltip {...ChartTooltipStyle} formatter={v=>[`${v.toLocaleString("es-ES")}€`]}/>
                </PieChart>
              </div>}
              {catEntries.map(([c,v])=><div key={c} style={{marginBottom:6}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}><span>{c}</span><strong>{fmt(v)} ({Math.round(v/total*100)}%)</strong></div>
                <div style={{height:6,background:"#E5E1DB",borderRadius:3,marginTop:3}}><div style={{height:"100%",borderRadius:3,background:"#F35757",width:`${v/total*100}%`}}/></div>
              </div>)}
              <div style={{fontWeight:600,marginTop:10,marginBottom:6,fontSize:12,color:"#8A8580"}}>Últimos gastos:</div>
              {[...raw.gastos].sort((a,b)=>(b.fecha||"").localeCompare(a.fecha||"")).slice(0,6).map(g=><div key={g.id} style={{...rowStyle,fontSize:12}}><span style={{flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{g.concepto}</span><span style={{color:"#8A8580"}}>{fmtF(g.fecha)}</span><strong style={{color:"#F35757"}}>{fmt(parseFloat(g.importe)||0)}</strong></div>)}
            </>;})()}
            {k.id==="gastosProy"&&<>
              <div style={{fontWeight:700,marginBottom:8}}>Proyección anual</div>
              <div style={rowStyle}><span>Gastos reales YTD</span><strong>{fmt(data.gastosReales)}</strong></div>
              <div style={rowStyle}><span>Proyección hasta diciembre</span><strong>{fmt(data.gastosProyectados)}</strong></div>
              <div style={{fontWeight:600,marginTop:10,marginBottom:6,fontSize:12,color:"#8A8580"}}>Gastos recurrentes:</div>
              {raw.gastos.filter(g=>g.recurrente).map(g=><div key={g.id} style={{...rowStyle,fontSize:12}}><span style={{flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>🔁 {g.concepto}</span><strong>{fmt(parseFloat(g.importe)||0)}/mes</strong></div>)}
            </>}
            {k.id==="beneficio"&&(()=>{
              const cw=typeof window!=="undefined"?Math.min(window.innerWidth-80,380):300;
              const bData=MESES_CORTO.map((lbl,i)=>{const m=String(i+1).padStart(2,"0");
                let cob=0;raw.reservas.filter(r=>r.fecha?.slice(5,7)===m).forEach(r=>{const seña=parseFloat(r.seña_importe)||0;const pt=parseFloat(r.precio_total)||parseFloat(r.precio)||0;if(r.seña_cobrada)cob+=seña;if(r.saldo_cobrado)cob+=(pt-seña);});
                cob+=raw.airbnbs.filter(a=>(a.cobrado||a.fecha_entrada<hoyStr)&&a.fecha_entrada?.slice(5,7)===m).reduce((s,a)=>s+(parseFloat(a.precio)||0),0);
                const gst=raw.gastos.filter(g=>g.fecha?.slice(5,7)===m).reduce((s,g)=>s+(parseFloat(g.importe)||0),0);
                return{name:lbl,Beneficio:Math.round(cob-gst)};});
              const hasData=bData.some(m=>m.Beneficio!==0);
              return <>
              <div style={{fontWeight:700,marginBottom:8}}>Análisis de beneficio</div>
              <div style={rowStyle}><span>Cobrado</span><strong style={{color:"#A6BE59"}}>{fmt(data.yaCobrado)}</strong></div>
              <div style={rowStyle}><span>Gastos</span><strong style={{color:"#F35757"}}>−{fmt(data.gastosReales)}</strong></div>
              <div style={{...rowStyle,fontWeight:700,fontSize:16}}><span>Beneficio</span><strong style={{color:data.beneficio>=0?"#A6BE59":"#F35757"}}>{fmt(data.beneficio)}</strong></div>
              {data.yaCobrado>0&&<div style={{marginTop:8,fontSize:12,color:"#8A8580"}}>Margen: <strong style={{color:"#1A1A1A"}}>{Math.round(data.beneficio/data.yaCobrado*100)}%</strong></div>}
              {hasData&&<div style={{marginTop:12,overflow:"hidden"}}>
                <LineChart width={cw} height={120} data={bData} margin={{top:5,right:5,left:-20,bottom:5}}>
                  <XAxis dataKey="name" tick={{fontSize:9,fill:"#8A8580"}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:9,fill:"#8A8580"}} axisLine={false} tickLine={false} tickFormatter={fmtK}/>
                  <Tooltip {...ChartTooltipStyle} formatter={v=>[`${v.toLocaleString("es-ES")}€`]}/>
                  <Line type="monotone" dataKey="Beneficio" stroke="#AFA3FF" strokeWidth={2} dot={{r:3,fill:"#AFA3FF"}}/>
                </LineChart>
              </div>}
            </>;})()}
            {k.id==="comision"&&<>
              <div style={{fontWeight:700,marginBottom:8}}>Comisión gestor</div>
              <div style={rowStyle}><span>Base de cálculo</span><strong>{fmt(data.facturacion)}</strong></div>
              <div style={rowStyle}><span>Porcentaje</span><strong>{data.comisionPct}%</strong></div>
              <div style={{...rowStyle,fontWeight:700}}><span>Total comisión</span><strong style={{color:"#7FB2FF"}}>{fmt(data.comision)}</strong></div>
            </>}
          </div>}
        </div>)}
      </div>
    </>:<div style={{color:"#8A8580",fontSize:13,padding:"16px 0",textAlign:"center"}}>No se pudieron cargar los datos</div>}
  </div>
  {/* ALERTAS */}
  {alertas.length>0&&<div style={{display:"flex",gap:8,overflowX:"auto",marginBottom:16,paddingBottom:4,scrollbarWidth:"none"}}>
    {alertas.map((a,i)=>{const bg=a.tipo==="rojo"?"#FEE8E8":a.tipo==="amarillo"?"#FFF8E1":"#F0F8E8";const col=a.tipo==="rojo"?"#F35757":a.tipo==="amarillo"?"#D4A017":"#6B8A20";
      return <div key={i} style={{background:bg,borderRadius:100,padding:"8px 16px",fontSize:12,color:col,fontWeight:600,whiteSpace:"nowrap",flexShrink:0}}>{a.tipo==="rojo"?"🔴":a.tipo==="amarillo"?"🟡":"🟢"} {a.txt}</div>;
    })}
  </div>}
  </>;
}

// ─── FINANCIAL CHARTS ───────────────────────────────────────────────────────
const MESES_CORTO=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const CHART_COLORS={facturacion:"#EC683E",cobrado:"#A6BE59",gastos:"#F35757",beneficio:"#AFA3FF",eventos:"#EC683E",airbnb:"#A6BE59",prev:"#BFBAB4"};
const ChartTooltipStyle={contentStyle:{background:"#FFFFFF",border:"none",borderRadius:14,fontSize:12,color:"#1A1A1A",boxShadow:"0 4px 20px rgba(0,0,0,.1)",fontFamily:"'Inter Tight',sans-serif"},itemStyle:{color:"#1A1A1A"},labelStyle:{color:"#EC683E",fontWeight:700,marginBottom:4}};
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

  if(load)return <div style={{display:"flex",alignItems:"center",gap:8,justifyContent:"center",padding:"20px 0",color:"#8A8580",fontSize:13}}><div className="spin" style={{width:16,height:16,borderWidth:2}}/>Cargando gráficas…</div>;

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
      <div style={{width:"100%",minHeight:280}}>
        <ResponsiveContainer width="100%" height={280}>
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
        <div style={{width:"100%",minHeight:240}}>
          <ResponsiveContainer width="100%" height={240}>
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
          <div style={{width:180,minHeight:180}}>
            <ResponsiveContainer width={180} height={180}>
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
                  <div style={{fontSize:13,color:"#1A1A1A",fontWeight:500}}>{p.name}</div>
                  <div style={{fontSize:16,fontWeight:700,color:i===0?CHART_COLORS.eventos:CHART_COLORS.airbnb,fontFamily:"'Inter Tight',sans-serif"}}>{p.value.toLocaleString("es-ES")}€</div>
                  <div style={{fontSize:11,color:"#8A8580"}}>{pieTotal>0?((p.value/pieTotal)*100).toFixed(1):0}%</div>
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
          acc.push({tipo:"visita",nombre:v.nombre,fecha:v.fecha,detalle:`Visita ${v.hora?.slice(0,5)||""} · ${v.tipo_evento||""}`.trim(),esCoord:!!v.es_coordinacion});
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

  if(load)return <div style={{display:"flex",alignItems:"center",gap:8,justifyContent:"center",padding:"20px 0",color:"#8A8580",fontSize:13}}><div className="spin" style={{width:16,height:16,borderWidth:2}}/>Cargando…</div>;

  const totalItems=llegadas.length+acciones.length+solicitudes.length+srvLimp.length+srvJard.length;
  if(totalItems===0)return null;

  const fmtF=f=>new Date(f+"T12:00:00").toLocaleDateString("es-ES",{weekday:"short",day:"numeric",month:"short"});
  const tagStyle=(bg,col)=>({display:"inline-block",fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:4,background:bg,color:col,letterSpacing:.5,flexShrink:0});

  return <div className="card" style={{marginBottom:16}}>
    <div className="chdr"><span className="ctit">⚡ Atención ahora</span><span className="badge" style={{background:"rgba(232,85,85,.1)",color:"#F35757",border:"1px solid rgba(232,85,85,.2)"}}>{totalItems}</span></div>

    {/* LLEGADAS */}
    {llegadas.length>0&&<>
      <div style={{fontSize:11,color:"#EC683E",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:8,marginTop:4}}>🏠 Próximas llegadas esta semana</div>
      {llegadas.map((l,i)=>(
        <div key={`ll-${i}`} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"#F5F3F0",borderRadius:8,marginBottom:5}}>
          <span style={l.tipo==="airbnb"?tagStyle("rgba(16,185,129,.15)","#10b981"):tagStyle("rgba(99,102,241,.15)","#a5b4fc")}>{l.tipo==="airbnb"?"AIRBNB":"EVENTO"}</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,color:"#1A1A1A",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.nombre}</div>
            <div style={{fontSize:11,color:"#8A8580"}}>{l.detalle}</div>
          </div>
          <div style={{fontSize:12,color:"#8A8580",flexShrink:0}}>📅 {fmtF(l.fecha)}</div>
        </div>
      ))}
    </>}

    {/* ACCIONES */}
    {acciones.length>0&&<>
      <div style={{fontSize:11,color:"#D4A017",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:8,marginTop:llegadas.length>0?16:4}}>📋 Requieren acción</div>
      {acciones.map((a,i)=>(
        <div key={`ac-${i}`} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"#F5F3F0",borderRadius:8,marginBottom:5,cursor:a.tipo==="visita"?"pointer":a.id?"pointer":"default"}} onClick={()=>{if(a.tipo==="visita")setPage("visitas");else if(a.id)setPage("reservas");}}>
          <span style={{fontSize:16,flexShrink:0}}>{a.tipo==="contrato"?"✍️":a.tipo==="seña"?"💰":"👁"}</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{fontSize:13,color:"#1A1A1A",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1,minWidth:0}}>{a.nombre}</div>
              {a.esCoord&&<span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:"rgba(99,102,241,.15)",color:"#a5b4fc",flexShrink:0,fontWeight:600}}>📋 Coordinación</span>}
            </div>
            <div style={{fontSize:11,color:"#D4A017"}}>{a.detalle}</div>
          </div>
          <div style={{fontSize:12,color:"#8A8580",flexShrink:0}}>📅 {fmtF(a.fecha)}</div>
        </div>
      ))}
    </>}

    {/* SOLICITUDES */}
    {solicitudes.length>0&&<>
      <div style={{fontSize:11,color:"#F35757",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:8,marginTop:(llegadas.length+acciones.length)>0?16:4}}>🔓 Solicitudes de desbloqueo</div>
      {solicitudes.map(s=>{
        const fF=new Date(s.fecha+"T12:00:00").toLocaleDateString("es-ES",{weekday:"short",day:"numeric",month:"short"});
        return <div key={s.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"#F5F3F0",borderRadius:8,marginBottom:5,cursor:"pointer"}} onClick={()=>setPage("notifs")}>
          <span style={{fontSize:16,flexShrink:0}}>🔒</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,color:"#1A1A1A",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.solicitado_por}</div>
            <div style={{fontSize:11,color:"#F35757"}}>{s.motivo||"Solicitud de desbloqueo"}</div>
          </div>
          <div style={{fontSize:12,color:"#8A8580",flexShrink:0}}>📅 {fF}</div>
        </div>;
      })}
    </>}

    {/* SERVICIOS ACTIVOS */}
    {(srvLimp.length>0||srvJard.length>0)&&<>
      <div style={{fontSize:11,color:"#6366f1",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:8,marginTop:(llegadas.length+acciones.length+solicitudes.length)>0?16:4}}>🧹 Servicios activos</div>
      {srvLimp.map(s=>(
        <div key={`sl-${s.id}`} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"#F5F3F0",borderRadius:8,marginBottom:5,cursor:"pointer"}} onClick={()=>setPage("limpieza")}>
          <span style={tagStyle("rgba(99,102,241,.15)","#a5b4fc")}>LIMPIEZA</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,color:"#1A1A1A",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>🧹 {s.nombre}</div>
            <div style={{fontSize:11,color:"#8A8580"}}>📅 {new Date(s.fecha).toLocaleDateString("es-ES",{day:"numeric",month:"short"})}</div>
          </div>
        </div>
      ))}
      {srvJard.map(s=>{
        const fi=new Date(s.fecha_inicio+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"});
        const ff=new Date(s.fecha_fin+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"});
        return <div key={`sj-${s.id}`} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"#F5F3F0",borderRadius:8,marginBottom:5,cursor:"pointer"}} onClick={()=>setPage("jadmin")}>
          <span style={tagStyle("rgba(16,185,129,.15)","#10b981")}>JARDÍN</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,color:"#1A1A1A",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>🌿 {s.nombre}</div>
            <div style={{fontSize:11,color:"#8A8580"}}>📅 {fi} – {ff}{s.jardinero_nombre?` · 👤 ${s.jardinero_nombre}`:""}</div>
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
        <div style={{fontSize:10,color:"#8A8580",textTransform:"uppercase",letterSpacing:1,marginBottom:7}}>PRÓXIMO EVENTO</div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
          <div><div style={{fontSize:16,fontWeight:600,color:"#1A1A1A"}}>{prox.nombre}</div><div style={{fontSize:12,color:"#8A8580",marginTop:4}}>📅 {new Date(prox.fecha).toLocaleDateString("es-ES",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</div></div>
          <div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:18,fontWeight:700,color:"#EC683E"}}>{parseFloat(prox.precio||0).toLocaleString("es-ES")}€</div><SBadge e={prox.estado}/></div>
        </div>
      </div>}
      <div className="g2">
        <div className="card"><div className="chdr"><span className="ctit">🌿 Jardín esta semana</span><button className="btn bg sm" onClick={()=>setPage("jcheck")}>Ver</button></div>{actv.slice(0,5).map(t=><MTask key={t.id} lbl={t.txt} done={sj[t.id]?.done}/>)}</div>
        <div className="card"><div className="chdr"><span className="ctit">📅 Próximas reservas</span><button className="btn bg sm" onClick={()=>setPage("reservas")}>Ver</button></div>
          {reservas.length===0?<div style={{fontSize:12,color:"#8A8580"}}>Sin reservas registradas</div>
            :reservas.slice(0,5).map(r=><div key={r.id} style={{padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,.04)",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}><div style={{minWidth:0}}><div style={{fontSize:13,color:"#1A1A1A",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.nombre}</div><div style={{fontSize:11,color:"#8A8580"}}>{new Date(r.fecha).toLocaleDateString("es-ES")}</div></div><SBadge e={r.estado}/></div>)}
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
  const isA=false; // jardinero view, never admin

  // Servicio activo
  const [srvActivo,setSrvActivo]=useState(null);
  const [srvTareas,setSrvTareas]=useState([]);
  const [srvExtras,setSrvExtras]=useState([]);
  const [jornadaId,setJornadaId]=useState(null);
  const [jornadaFin,setJornadaFin]=useState(false);
  const [jornadaDurMin,setJornadaDurMin]=useState(0);
  const [tiempoJornada,setTiempoJornada]=useState(0);
  const [pausado,setPausado]=useState(false);
  const [pausasArr,setPausasArr]=useState([]);
  const [saving2,setSaving2]=useState(false);
  const [showFinJornada,setShowFinJornada]=useState(false);
  const [showFinSrv,setShowFinSrv]=useState(false);
  const [showNuevaJornada,setShowNuevaJornada]=useState(false);
  const [showExtraForm,setShowExtraForm]=useState(false);
  const [extraForm,setExtraForm]=useState({txt:"",zona:"",nota:"",foto_url:null});
  const [editExtraId,setEditExtraId]=useState(null);
  const [editExtraNota,setEditExtraNota]=useState("");
  const [editExtraFoto,setEditExtraFoto]=useState(null);
  const hoyStr=new Date().toISOString().split("T")[0];
  const jId=perfil.es_operario?perfil.referencia_id:perfil.id;

  const loadSrvActivo=async()=>{
    try{
      const srvs=await sbGet("jardin_servicios",`?jardinero_id=eq.${jId}&estado=eq.activo&select=*`,tok).catch(()=>[]);
      if(srvs.length===0){setSrvActivo(null);setSrvTareas([]);setSrvExtras([]);return;}
      const s=srvs[0];setSrvActivo(s);
      // Tareas
      const allTareas=await sbGet("jardin_servicio_tareas",`?servicio_id=eq.${s.id}&select=*&order=created_at.asc`,tok).catch(()=>[]);
      setSrvTareas(allTareas.filter(t=>!t.añadida_por_jardinero));
      setSrvExtras(allTareas.filter(t=>t.añadida_por_jardinero));
      // Jornada hoy — usar servicio_id_int (integer compatible)
      let jHoy=[];
      try{jHoy=await sbGet("jornadas_jardineria",`?servicio_id_int=eq.${s.id}&hora_inicio=gte.${hoyStr}T00:00:00&hora_inicio=lte.${hoyStr}T23:59:59&select=*`,tok);}catch(_){jHoy=[];}
      if(jHoy.length>0){
        const j=jHoy[0];
        setJornadaId(j.id);setPausasArr(j.pausas||[]);
        localStorage.setItem(`fm_jornada_id_${s.id}`,String(j.id));
        if(j.hora_fin){
          setJornadaFin(true);setJornadaDurMin(j.duracion_minutos||0);
        }else{
          setJornadaFin(false);
          if(!localStorage.getItem(`fm_jornada_inicio_${s.id}`)&&j.hora_inicio){
            const ts=new Date(j.hora_inicio).getTime();
            if(ts>0)localStorage.setItem(`fm_jornada_inicio_${s.id}`,ts.toString());
          }
          const pArr=j.pausas||[];
          const lastP=pArr[pArr.length-1];
          setPausado(!!lastP&&!lastP.fin);
          if(lastP&&!lastP.fin)localStorage.setItem(`fm_jornada_pausado_${s.id}`,String(lastP.inicio));
        }
      }else{
        setJornadaId(null);setJornadaFin(false);
        const lsIni=localStorage.getItem(`fm_jornada_inicio_${s.id}`);
        if(!lsIni)setShowNuevaJornada(true);
      }
    }catch(_){}
  };
  useEffect(()=>{if(tok)loadSrvActivo();},[]);

  // Cronómetro — uses timestamps from localStorage for persistence
  useEffect(()=>{
    const sId=srvActivo?.id;
    if(!sId||jornadaFin)return;
    const inicio=parseInt(localStorage.getItem(`fm_jornada_inicio_${sId}`)||"0");
    if(!inicio)return;
    const calcPausas=()=>{
      let ms=0;
      for(const p of pausasArr){
        if(p.inicio&&p.fin)ms+=(p.fin-p.inicio);
        else if(p.inicio&&!p.fin)ms+=(Date.now()-p.inicio);
      }
      return ms;
    };
    const calc=()=>Math.max(0,Math.floor((Date.now()-inicio-calcPausas())/1000));
    setTiempoJornada(calc());
    const iv=setInterval(()=>setTiempoJornada(calc()),1000);
    return()=>clearInterval(iv);
  },[srvActivo?.id,jornadaFin,pausado,pausasArr]);

  const fmtEl=s=>{const h=Math.floor(s/3600);const m=Math.floor((s%3600)/60);const ss=s%60;return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(ss).padStart(2,"0")}`;};
  const fmtHM=mins=>{const h=Math.floor(mins/60);const m=Math.round(mins%60);return `${h}h ${m}min`;};

  const iniciarJornada=async()=>{
    if(saving2||!srvActivo)return;setSaving2(true);
    const ahora=new Date();
    const tsInicio=ahora.getTime();
    try{
      const [j]=await sbPost("jornadas_jardineria",{servicio_id_int:srvActivo.id,fecha:hoyStr,hora_inicio:ahora.toISOString(),pausas:[]},tok);
      setJornadaId(j.id);setJornadaFin(false);setPausasArr([]);setPausado(false);
      localStorage.setItem(`fm_jornada_inicio_${srvActivo.id}`,tsInicio.toString());
      localStorage.setItem(`fm_jornada_id_${srvActivo.id}`,String(j.id));
      setShowNuevaJornada(false);
    }catch(e){console.error("iniciarJornada:",e);}
    setSaving2(false);
  };

  const togglePausa=async()=>{
    if(!jornadaId||saving2)return;setSaving2(true);
    const newPausas=[...pausasArr];
    if(!pausado){
      newPausas.push({inicio:Date.now(),fin:null});
      localStorage.setItem(`fm_jornada_pausado_${srvActivo.id}`,Date.now().toString());
    }else{
      const last=newPausas[newPausas.length-1];
      if(last)last.fin=Date.now();
      localStorage.removeItem(`fm_jornada_pausado_${srvActivo.id}`);
    }
    try{
      await sbPatch("jornadas_jardineria",`id=eq.${jornadaId}`,{pausas:newPausas},tok);
      setPausasArr(newPausas);setPausado(!pausado);
    }catch(_){}
    setSaving2(false);
  };

  const terminarJornada=async()=>{
    if(!jornadaId||!srvActivo||saving2)return;setSaving2(true);
    const ahora=new Date();
    const newPausas=[...pausasArr];
    const last=newPausas[newPausas.length-1];
    if(last&&!last.fin)last.fin=Date.now();
    const durMin=Math.max(0,Math.round(tiempoJornada/60));
    try{
      await sbPatch("jornadas_jardineria",`id=eq.${jornadaId}`,{hora_fin:ahora.toISOString(),duracion_minutos:durMin,pausas:newPausas},tok);
      const horasJornada=Math.round(durMin/60*100)/100;
      const prevHoras=parseFloat(srvActivo.horas_totales)||0;
      await sbPatch("jardin_servicios",`id=eq.${srvActivo.id}`,{horas_totales:prevHoras+horasJornada},tok).catch(()=>{});
      // Cleanup localStorage
      localStorage.removeItem(`fm_jornada_inicio_${srvActivo.id}`);
      localStorage.removeItem(`fm_jornada_id_${srvActivo.id}`);
      localStorage.removeItem(`fm_jornada_pausado_${srvActivo.id}`);
      setJornadaFin(true);setJornadaDurMin(durMin);setShowFinJornada(false);
      await loadSrvActivo();
    }catch(_){}setSaving2(false);
  };

  const toggleTarea=async(id,cur)=>{
    if(!srvActivo||saving2)return;setSaving2(true);
    try{await sbPatch("jardin_servicio_tareas",`id=eq.${id}`,{done:!cur,completado_por:!cur?perfil.nombre:null,completado_ts:!cur?new Date().toISOString():null},tok);await loadSrvActivo();}catch(_){}
    setSaving2(false);
  };

  const addExtra=async()=>{
    if(!extraForm.txt.trim()||!srvActivo||saving2)return;setSaving2(true);
    try{
      await sbPost("jardin_servicio_tareas",{servicio_id:srvActivo.id,txt:extraForm.txt.trim(),zona:extraForm.zona||null,done:true,es_extra:true,añadida_por_jardinero:true,completado_por:perfil.nombre,completado_ts:new Date().toISOString(),nota:extraForm.nota||null,foto_url:extraForm.foto_url||null},tok);
      setExtraForm({txt:"",zona:"",nota:"",foto_url:null});setShowExtraForm(false);await loadSrvActivo();
    }catch(_){}setSaving2(false);
  };

  const delExtra=async id=>{
    if(!window.confirm("¿Eliminar esta tarea extra?"))return;
    await sbDelete("jardin_servicio_tareas",`id=eq.${id}`,tok);await loadSrvActivo();
  };

  const saveEditExtra=async()=>{
    if(!editExtraId||saving2)return;setSaving2(true);
    try{await sbPatch("jardin_servicio_tareas",`id=eq.${editExtraId}`,{nota:editExtraNota||null,foto_url:editExtraFoto||null},tok);setEditExtraId(null);await loadSrvActivo();}catch(_){}
    setSaving2(false);
  };

  const completarServicio=async()=>{
    if(!srvActivo||saving2)return;setSaving2(true);
    try{
      if(jornadaId&&!jornadaFin)await terminarJornada();
      const s=await sbGet("jardin_servicios",`?id=eq.${srvActivo.id}&select=*`,tok).then(r=>r[0]).catch(()=>srvActivo);
      const horasT=parseFloat(s?.horas_totales)||0;
      const mod=s?.modalidad_pago||s?.modalidad||"por_horas";
      let costeTotal=0;
      if(mod==="por_horas")costeTotal=Math.round(horasT*(parseFloat(s?.tarifa_hora_aplicada)||parseFloat(s?.tarifa_hora)||0)*100)/100;
      else if(mod==="precio_fijo_servicio")costeTotal=parseFloat(s?.precio_fijo_acordado)||parseFloat(s?.importe_fijo)||0;
      const costeHoraReal=horasT>0?Math.round(costeTotal/horasT*100)/100:0;
      await sbPatch("jardin_servicios",`id=eq.${srvActivo.id}`,{estado:"finalizado",fecha_fin:hoyStr,coste_total:costeTotal,coste_hora_real:costeHoraReal},tok).catch(()=>{
        // Fallback if coste columns don't exist
        return sbPatch("jardin_servicios",`id=eq.${srvActivo.id}`,{estado:"completado"},tok);
      });
      const admins=await sbGet("usuarios","?rol=eq.admin&select=id",tok);
      const msg=`🌿 ${perfil.nombre} ha completado "${srvActivo.nombre||srvActivo.titulo}". Total: ${horasT}h. Coste: ${costeTotal}€.`;
      for(const a of admins){await sbPost("notificaciones",{para:a.id,txt:msg},tok);sendPush("🌿 Finca El Molino",msg,"jardin-srv-fin");}
      localStorage.removeItem(`fm_jornada_inicio_${srvActivo.id}`);
      localStorage.removeItem(`fm_jornada_id_${srvActivo.id}`);
      localStorage.removeItem(`fm_jornada_pausado_${srvActivo.id}`);
      setShowFinSrv(false);setSrvActivo(null);setSrvTareas([]);setSrvExtras([]);
    }catch(_){}setSaving2(false);
  };

  const tareasAdminOk=srvTareas.length>0&&srvTareas.every(t=>t.done);
  const totalAcum=parseFloat(srvActivo?.horas_totales||0);

  return <>
    <div className="ph"><h2>Hola, {perfil.nombre.split(" ")[0]} 👋</h2><p>{new Date().toLocaleDateString("es-ES",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p></div>
    <div className="pb">
      {/* SERVICIO ACTIVO */}
      {srvActivo&&<div className="card" style={{marginBottom:16,border:"1px solid rgba(16,185,129,.3)",background:"rgba(16,185,129,.04)"}}>
        <div className="chdr"><span className="ctit">🌿 Servicio activo</span></div>
        <div style={{fontSize:16,fontWeight:600,color:"#1A1A1A",marginBottom:4}}>{srvActivo.nombre||srvActivo.titulo}</div>
        {(srvActivo.fecha_inicio||srvActivo.fecha_fin)&&<div style={{fontSize:11,color:"#8A8580",marginBottom:4}}>📅 {srvActivo.fecha_inicio?new Date(srvActivo.fecha_inicio+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"}):""}{srvActivo.fecha_fin?` → ${new Date(srvActivo.fecha_fin+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"})}`:""}</div>}
        <div style={{fontSize:12,color:"#8A8580",marginBottom:6}}>Tareas: {srvTareas.filter(t=>t.done).length} de {srvTareas.length} completadas{srvExtras.length>0?` + ${srvExtras.length} extra`:""}</div>
        <div className="prog" style={{marginBottom:14,height:8}}><div className="pfill" style={{width:`${srvTareas.length?(srvTareas.filter(t=>t.done).length/srvTareas.length)*100:0}%`}}/></div>

        {/* Cronómetro */}
        {jornadaId&&!jornadaFin&&<>
          <div style={{textAlign:"center",padding:"16px 0",marginBottom:12,background:"#F5F3F0",borderRadius:12}}>
            <div style={{fontSize:11,color:pausado?"#D4A017":"#A6BE59",textTransform:"uppercase",letterSpacing:1,fontWeight:600,marginBottom:6}}>{pausado?"⏸ En pausa":"⏱️ Esta jornada"}</div>
            <div style={{fontSize:36,fontWeight:700,color:pausado?"#D4A017":"#EC683E",fontFamily:"monospace",letterSpacing:2}}>{fmtEl(tiempoJornada)}</div>
            {totalAcum>0&&<div style={{fontSize:12,color:"#8A8580",marginTop:6}}>📅 Total acumulado: {fmtHM(totalAcum*60)}</div>}
          </div>
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            <button className={`btn ${pausado?"bp":"bg"}`} style={{flex:1,justifyContent:"center",padding:"12px",fontSize:14}} onClick={togglePausa} disabled={saving2}>{pausado?"▶️ Reanudar":"⏸️ Pausar"}</button>
            <button className="btn" style={{flex:1,justifyContent:"center",padding:"12px",fontSize:14,background:"#AFA3FF",color:"#fff",border:"none",borderRadius:100,cursor:"pointer",fontFamily:"'Inter Tight',sans-serif",fontWeight:600}} onClick={()=>setShowFinJornada(true)}>🌙 Terminar jornada</button>
          </div>
        </>}
        {jornadaFin&&<div style={{background:"rgba(175,163,255,.08)",border:"1px solid rgba(175,163,255,.2)",borderRadius:12,padding:"10px 14px",marginBottom:12,fontSize:13,color:"#AFA3FF",textAlign:"center"}}>✅ Jornada de hoy completada — {fmtHM(jornadaDurMin||0)}</div>}
        {!jornadaId&&!jornadaFin&&!showNuevaJornada&&<button className="btn bp" style={{width:"100%",justifyContent:"center",padding:"14px",fontSize:15,marginBottom:14}} onClick={iniciarJornada} disabled={saving2}>▶️ Iniciar jornada</button>}

        {/* Checklist tareas asignadas */}
        <div style={{fontSize:11,color:"#EC683E",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:6,marginTop:8}}>Tareas asignadas</div>
        {srvTareas.map(t=><div key={t.id} className={`cli${t.done?" done":""}`} style={{marginBottom:4}}>
          <div className={`chk${t.done?" on":""}`} onClick={()=>toggleTarea(t.id,t.done)} style={{cursor:"pointer"}}/>
          <div style={{flex:1,minWidth:0}}>
            {t.zona&&<span className="tz">{t.zona}</span>}
            <div className={`tl${t.done?" done":""}`}>{t.txt}</div>
            {t.done&&<div className="tm">✓ {t.completado_por} · {fmtDT(t.completado_ts)}</div>}
            {t.nota&&<div className="nbox">📝 {t.nota}</div>}
            {t.foto_url&&<img src={t.foto_url} alt="" className="pthumb"/>}
          </div>
        </div>)}

        {/* Tareas extra del jardinero */}
        {srvExtras.length>0&&<>
          <div style={{fontSize:11,color:"#EC683E",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:6,marginTop:16}}>➕ Tareas adicionales</div>
          {srvExtras.map(t=><div key={t.id} className="cli done" style={{marginBottom:4}}>
            <span style={{fontSize:17,flexShrink:0}}>✅</span>
            <div style={{flex:1,minWidth:0}}>
              <span className="badge" style={{background:"rgba(201,168,76,.12)",color:"#EC683E",fontSize:10,marginBottom:3,display:"inline-block"}}>➕ Extra</span>
              {t.zona&&<span className="tz" style={{marginLeft:4}}>{t.zona}</span>}
              <div className="tl done">{t.txt}</div>
              <div className="tm">✓ {t.completado_por} · {fmtDT(t.completado_ts)}</div>
              {t.nota&&<div className="nbox">📝 {t.nota}</div>}
              {t.foto_url&&<img src={t.foto_url} alt="" className="pthumb"/>}
              {t.resp_admin&&<div className="rbox">✅ Admin: {t.resp_admin}</div>}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:4,flexShrink:0}}>
              <span className="ibtn" onClick={()=>{setEditExtraId(t.id);setEditExtraNota(t.nota||"");setEditExtraFoto(t.foto_url||null);}}>✏️</span>
              <span className="ibtn" style={{background:"rgba(232,85,85,.1)",color:"#F35757",borderColor:"rgba(232,85,85,.2)"}} onClick={()=>delExtra(t.id)}>🗑</span>
            </div>
          </div>)}
        </>}

        {/* Botón añadir extra */}
        <button className="btn bg" style={{width:"100%",justifyContent:"center",marginTop:12}} onClick={()=>{setExtraForm({txt:"",zona:"",nota:"",foto_url:null});setShowExtraForm(true);}}>➕ Añadir tarea realizada</button>

        {/* Completar servicio */}
        {tareasAdminOk&&(!jornadaId||jornadaFin)&&<button className="btn bp" style={{width:"100%",justifyContent:"center",padding:"14px",fontSize:15,marginTop:12,background:"#A6BE59"}} onClick={()=>setShowFinSrv(true)}>✅ Marcar servicio completado</button>}
      </div>}

      {/* Checklist semanal solo si NO hay servicio activo */}
      {!srvActivo&&<>
        <div className="sg"><SC lbl="Tareas esta semana" val={tot}/><SC lbl="Completadas" val={comp} prog={tot?comp/tot:0} valC="#10b981" sub={comp===tot&&tot>0?"¡Al día! ✓":undefined}/><SC lbl="Pendientes" val={tot-comp} valC={tot-comp>0?"#f59e0b":"#10b981"}/></div>
        <div className="card"><div className="chdr"><span className="ctit">📋 Mis tareas</span><button className="btn bp sm" onClick={()=>setPage("jcheck")}>Ir al checklist →</button></div>
          {actv.slice(0,6).map(t=><MTask key={t.id} lbl={t.txt} sub={t.zona} done={sj[t.id]?.done}/>)}
          {jpunt.map(t=><MTask key={t.id} lbl={t.txt} sub="📌 Puntual" done={t.done}/>)}
          {tot===0&&<div className="empty"><span className="ico">✅</span><p>Sin tareas esta semana</p></div>}
        </div>
      </>}
    </div>

    {/* Modal nueva jornada */}
    {showNuevaJornada&&<div className="ov"><div className="modal" style={{maxWidth:400,textAlign:"center"}}>
      <div style={{fontSize:36,marginBottom:8}}>🌿</div>
      <h3>Tienes un servicio en curso</h3>
      <p style={{fontSize:13,color:"#8A8580",marginBottom:20,lineHeight:1.5}}>"{srvActivo?.nombre||srvActivo?.titulo}" está activo. ¿Empezar la jornada de hoy?</p>
      <button className="btn bp" style={{width:"100%",justifyContent:"center",padding:"14px",fontSize:15}} onClick={iniciarJornada} disabled={saving2}>{saving2?"Iniciando…":"▶️ Empezar jornada"}</button>
      <button onClick={()=>setShowNuevaJornada(false)} style={{background:"none",border:"none",color:"#8A8580",cursor:"pointer",width:"100%",textAlign:"center",marginTop:12,fontSize:12,fontFamily:"'DM Sans',sans-serif",padding:"8px"}}>Ahora no</button>
    </div></div>}

    {/* Modal terminar jornada */}
    {showFinJornada&&<div className="ov"><div className="modal" style={{maxWidth:400,textAlign:"center"}}>
      <div style={{fontSize:36,marginBottom:8}}>🌙</div>
      <h3>¿Terminas por hoy?</h3>
      <div style={{fontSize:24,fontWeight:700,color:"#EC683E",fontFamily:"monospace",margin:"16px 0"}}>{fmtEl(tiempoJornada)}</div>
      <p style={{fontSize:13,color:"#8A8580",marginBottom:20}}>Llevas {fmtHM(Math.round(tiempoJornada/60))}</p>
      <button className="btn bp" style={{width:"100%",justifyContent:"center",padding:"14px",fontSize:15}} onClick={terminarJornada} disabled={saving2}>{saving2?"Guardando…":"✅ Terminar jornada"}</button>
      <button className="btn bg" style={{width:"100%",justifyContent:"center",marginTop:8}} onClick={()=>setShowFinJornada(false)}>Cancelar</button>
    </div></div>}

    {/* Modal completar servicio */}
    {showFinSrv&&<div className="ov"><div className="modal" style={{maxWidth:440,textAlign:"center"}}>
      <div style={{fontSize:36,marginBottom:8}}>✅</div>
      <h3>Completar servicio</h3>
      <p style={{fontSize:13,color:"#8A8580",marginBottom:16,lineHeight:1.5}}>"{srvActivo?.nombre||srvActivo?.titulo}" — todas las tareas asignadas completadas.</p>
      <div style={{background:"#F5F3F0",borderRadius:10,padding:"14px",marginBottom:20}}>
        <div style={{fontSize:12,color:"#8A8580"}}>Total acumulado: <strong style={{color:"#EC683E"}}>{fmtHM(totalAcum*60)}</strong></div>
        {srvExtras.length>0&&<div style={{fontSize:12,color:"#EC683E",marginTop:4}}>+ {srvExtras.length} tarea{srvExtras.length>1?"s":""} extra registrada{srvExtras.length>1?"s":""}</div>}
      </div>
      <button className="btn bp" style={{width:"100%",justifyContent:"center",padding:"14px",fontSize:15,background:"#A6BE59"}} onClick={completarServicio} disabled={saving2}>{saving2?"Finalizando…":"✅ Confirmar y notificar al admin"}</button>
      <button className="btn bg" style={{width:"100%",justifyContent:"center",marginTop:8}} onClick={()=>setShowFinSrv(false)}>Cancelar</button>
    </div></div>}

    {/* Modal tarea extra */}
    {showExtraForm&&<div className="ov" onClick={()=>setShowExtraForm(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <h3>➕ Tarea realizada</h3>
      <div className="fg"><label>Descripción *</label><input className="fi" value={extraForm.txt} onChange={e=>setExtraForm(v=>({...v,txt:e.target.value}))} placeholder="Ej: Limpieza de canalones" autoFocus/></div>
      <div className="fg"><label>Zona (opcional)</label><input className="fi" value={extraForm.zona} onChange={e=>setExtraForm(v=>({...v,zona:e.target.value}))} placeholder="Ej: Tejado"/></div>
      <div className="fg"><label>Foto (opcional)</label>
        <label className="pbtn">{extraForm.foto_url?"📷 Cambiar foto":"📷 Hacer foto o subir imagen"}
          <input type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={async e=>{const f=e.target.files[0];if(!f)return;try{const url=await uploadFoto(f,tok);setExtraForm(v=>({...v,foto_url:url}));}catch(_){const r=new FileReader();r.onload=ev=>setExtraForm(v=>({...v,foto_url:ev.target.result}));r.readAsDataURL(f);}}}/>
        </label>
        {extraForm.foto_url&&<><img src={extraForm.foto_url} alt="" className="pprev"/><button className="btn br sm" style={{marginTop:8}} onClick={()=>setExtraForm(v=>({...v,foto_url:null}))}>🗑 Quitar</button></>}
      </div>
      <div className="fg"><label>Comentario (opcional)</label><textarea className="fi" rows={2} value={extraForm.nota} onChange={e=>setExtraForm(v=>({...v,nota:e.target.value}))} placeholder="Notas…"/></div>
      <div className="mft"><button className="btn bg" onClick={()=>setShowExtraForm(false)}>Cancelar</button><button className="btn bp" onClick={addExtra} disabled={saving2||!extraForm.txt.trim()}>{saving2?"Guardando…":"✅ Registrar"}</button></div>
    </div></div>}

    {/* Modal editar extra */}
    {editExtraId&&<NotaModal nota={editExtraNota} setNota={setEditExtraNota} foto={editExtraFoto} setFoto={setEditExtraFoto} onSave={saveEditExtra} onClose={()=>setEditExtraId(null)} tok={tok}/>}
  </>;
}
function DashL({perfil,setPage}){
  return <>
    <div className="ph"><h2>Hola, {perfil.nombre.split(" ")[0]} 🧹</h2><p>{new Date().toLocaleDateString("es-ES",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p></div>
    <div className="pb"><div className="g2">
      {[{ico:"🧹",t:"Mi servicio",s:"Checklist limpieza",id:"limpieza"},{ico:"📅",t:"Calendario",s:"Próximos eventos",id:"cal-limp"}].map(it=>(
        <button key={it.id} className="card" style={{cursor:"pointer",textAlign:"left",border:"1px solid rgba(201,168,76,.15)"}} onClick={()=>setPage(it.id)}>
          <div style={{fontSize:28,marginBottom:8}}>{it.ico}</div><div style={{fontSize:14,fontWeight:600,color:"#1A1A1A"}}>{it.t}</div><div style={{fontSize:12,color:"#8A8580",marginTop:3}}>{it.s}</div>
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
          <div style={{fontSize:28,marginBottom:8}}>{it.ico}</div><div style={{fontSize:14,fontWeight:600,color:"#1A1A1A"}}>{it.t}</div><div style={{fontSize:12,color:"#8A8580",marginTop:3}}>{it.s}</div>
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
      <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:ok?"#10b981":"#f59e0b"}}>Semana del {rango}</div><div style={{fontSize:11,color:"#8A8580",marginTop:2}}>{ok?"Jardín verificado ✓":"Cerrado con incidencias"}</div></div>
      <span style={{color:"#8A8580",fontSize:18,transition:"transform .2s",transform:open?"rotate(90deg)":"none"}}>›</span>
    </div>
    {open&&<div style={{padding:"0 14px 14px",borderTop:"1px solid rgba(255,255,255,.05)"}}>
      {nota&&<div style={{fontSize:12,color:"#1A1A1A",marginTop:10,lineHeight:1.5}}>📝 {nota}</div>}
      <div style={{fontSize:11,color:"#8A8580",marginTop:6}}>Archivada · {semana}</div>
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

  const bannerVerifJsx=yaVerif?(()=>{
    const ok=yaVerif.done;
    return <div style={{background:ok?"rgba(16,185,129,.1)":"rgba(245,158,11,.1)",border:`1px solid ${ok?"rgba(16,185,129,.3)":"rgba(245,158,11,.3)"}`,borderRadius:10,padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:10}}>
      <span style={{fontSize:20}}>{ok?"✅":"⚠️"}</span>
      <div><div style={{fontSize:13,fontWeight:600,color:ok?"#10b981":"#f59e0b"}}>{ok?"Jardín verificado esta semana":"Semana cerrada con incidencias"}</div><div style={{fontSize:11,color:"#8A8580",marginTop:2}}>{yaVerif.nota} · {fmtDT(yaVerif.completado_ts)}</div></div>
      {!isA&&<button className="btn bg sm" style={{marginLeft:"auto",flexShrink:0}} onClick={()=>{setFinalCheck({});setFinalMode(null);setFinalNota("");setShowFinal(true);}}>Cambiar</button>}
    </div>;
  })():null;

  return <>
    <div className="ph"><h2>{isA?"Checklist jardín":"Mi checklist"}</h2><p>{TEMPORADA_LBL[temp]} · {comp}/{tot} tareas</p></div>
    <div className="pb">
      <div className="prog" style={{marginBottom:14,height:7}}><div className="pfill" style={{width:`${tot?(comp/tot)*100:0}%`}}/></div>
      {bannerVerifJsx}
      {todoHecho&&!showFinal&&!isA&&(
        <div style={{marginBottom:16}}>
          <button className="btn bp" style={{width:"100%",justifyContent:"center",fontSize:15,padding:"12px"}} onClick={()=>{setFinalCheck({});setFinalMode(null);setFinalNota("");setShowFinal(true);}}>✅ Abrir control final del jardín</button>
        </div>
      )}
      {actv.length>0&&(
        <div className="card" style={{marginBottom:14}}>
          <div className="chdr"><span className="ctit">📋 Esta semana</span><span className="badge" style={{background:"rgba(16,185,129,.1)",color:"#A6BE59"}}>{comp}/{actv.length}</span></div>
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
                <div className="tm" style={{color:"#D4A017"}}>📌 Puntual · {t.creado_por}</div>
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
            <span className="badge" style={{background:"rgba(201,168,76,.1)",color:"#EC683E"}}>{hechas}/{tareas.length}</span>
          </div>
          <div style={{padding:"2px 0",fontSize:12,color:"#8A8580"}}>📅 {fi} – {ff}</div>
          {abierto&&<>
            {s.notas&&<div className="nbox" style={{margin:"6px 0"}}>📝 {s.notas}</div>}
            <div className="prog" style={{margin:"8px 0",height:5}}><div className="pfill" style={{width:`${tareas.length?(hechas/tareas.length)*100:0}%`,background:"#EC683E"}}/></div>
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
            {hechas===tareas.length&&tareas.length>0&&<div style={{textAlign:"center",padding:"10px 0",fontSize:13,color:"#A6BE59",fontWeight:600}}>✅ ¡Servicio completado!</div>}
          </>}
        </div>;
      })}
      {tot===0&&misSrvs.length===0&&<div className="empty"><span className="ico">✅</span><p>Sin tareas esta semana</p></div>}
      {inac.length>0&&(
        <div className="card" style={{opacity:.4}}>
          <div className="chdr"><span className="ctit" style={{color:"#8A8580"}}>⏭ No toca esta semana</span></div>
          {inac.map(t=>(
            <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
              <span style={{fontSize:13}}>⏸</span>
              <div><div style={{fontSize:12,color:"#8A8580"}}>{t.txt}</div><div style={{fontSize:10,color:"#BFBAB4"}}>🔁 {FREC_LBL[fr[t.id]||t.frec]}</div></div>
            </div>
          ))}
        </div>
      )}
      {historial.length>0&&(
        <div style={{marginTop:24}}>
          <div style={{fontSize:11,color:"#8A8580",textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>📁 Semanas anteriores</div>
          {historial.map(h=><SemanaArchivada key={h.id} semana={h.semana} estado={h.done} nota={h.nota}/>)}
        </div>
      )}
    </div>

    {showFinal&&!isA&&(
      <div className="ov" style={{alignItems:"flex-end",padding:0}}>
        <div style={{background:"#FFFFFF",border:"1px solid rgba(201,168,76,.25)",borderRadius:"20px 20px 0 0",padding:"24px 20px 36px",width:"100%",maxWidth:540,maxHeight:"92vh",overflowY:"auto"}}>
          <div style={{textAlign:"center",marginBottom:20}}>
            <div style={{fontSize:36,marginBottom:8}}>🌿</div>
            <div style={{fontFamily:"'Inter Tight',sans-serif",fontSize:20,color:"#1A1A1A",marginBottom:4}}>¡Últimas comprobaciones!</div>
            <div style={{fontSize:13,color:"#8A8580"}}>Has completado todas las tareas. Antes de cerrar, verifica que todo está correcto.</div>
          </div>
          {!finalMode&&(
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
              <button className="btn bp" style={{width:"100%",justifyContent:"center",padding:"14px",fontSize:15}} onClick={()=>setFinalMode("ok")}>✅ Todo correcto — verificar jardín</button>
              <button className="btn bg" style={{width:"100%",justifyContent:"center",padding:"14px",fontSize:15}} onClick={()=>setFinalMode("incidencia")}>⚠️ Hay incidencias — cerrar sin verificar</button>
            </div>
          )}
          {finalMode==="ok"&&<>
            <div style={{fontSize:12,color:"#EC683E",fontWeight:600,marginBottom:12,textTransform:"uppercase",letterSpacing:1}}>✅ Comprueba cada punto antes de confirmar</div>
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
            <div style={{fontSize:13,color:"#D4A017",fontWeight:600,marginBottom:10}}>⚠️ ¿Por qué no se ha podido completar el trabajo?</div>
            <textarea className="fi" rows={4} value={finalNota} onChange={e=>setFinalNota(e.target.value)} placeholder="Ej: Falta material para la piscina…" style={{marginBottom:14,fontSize:14,lineHeight:1.5}}/>
            <div style={{display:"flex",gap:8}}>
              <button className="btn bg" style={{flex:1,justifyContent:"center"}} onClick={()=>setFinalMode(null)}>← Volver</button>
              <button className="btn" style={{flex:2,justifyContent:"center",padding:"12px",fontSize:15,background:"#f59e0b",color:"#0f1117"}} onClick={()=>guardarFinal("incidencia")} disabled={finalSaving||!finalNota.trim()}>{finalSaving?"Guardando…":"⚠️ Cerrar con incidencias"}</button>
            </div>
          </>}
          <button onClick={()=>setShowFinal(false)} style={{background:"none",border:"none",color:"#8A8580",cursor:"pointer",width:"100%",textAlign:"center",marginTop:16,fontSize:12,fontFamily:"'DM Sans',sans-serif",padding:"8px"}}>Cerrar y decidir más tarde</button>
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
      sbGet("jardineros","?activo=eq.true&select=id,nombre",tok).catch(()=>[]),
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
        nombre:srvForm.nombre,
        fecha_inicio:srvForm.fecha_inicio,
        fecha_fin:srvForm.fecha_fin,
        jardinero_id:srvForm.jardinero_id||null,
        jardinero_nombre:jd?.nombre||"",
        estado:"activo",
        notas:srvForm.notas||null,
        creado_por:perfil.nombre
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
              {e.done?<div className="tm">✓ {e.completado_por} · {fmtDT(e.completado_ts)}</div>:<div className="tm" style={{color:"#F35757"}}>⏳ Pendiente</div>}
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
              <span className="badge" style={{background:"rgba(16,185,129,.1)",color:"#A6BE59"}}>{hechas}/{tareas.length}</span>
            </div>
            <div style={{padding:"4px 0 0",fontSize:12,color:"#8A8580",display:"flex",gap:12,flexWrap:"wrap"}}>
              <span>📅 {fi} – {ff}</span>
              <span>👤 {s.jardinero_nombre}</span>
            </div>
            {abierto&&<>
              <div style={{marginTop:10}}>
                {tareas.map(t=><div key={t.id} className={`cli${t.done?" done":""}`} style={{padding:"8px 0"}}>
                  <span style={{fontSize:17,flexShrink:0}}>{t.done?"✅":"⬜"}</span>
                  <div style={{flex:1,minWidth:0}}>
                    {t.añadida_por_jardinero&&<span className="badge" style={{background:"rgba(201,168,76,.12)",color:"#EC683E",fontSize:10,marginBottom:3,display:"inline-block"}}>👷 Añadida por jardinero</span>}
                    {t.es_extra&&!t.añadida_por_jardinero&&<span className="badge" style={{background:"rgba(201,168,76,.12)",color:"#EC683E",fontSize:10,marginBottom:3,display:"inline-block"}}>➕ Extra</span>}
                    <div className="tl">{t.txt}</div>
                    {t.zona&&<div className="tm" style={{color:"#EC683E"}}>{t.zona}</div>}
                    {t.done?<div className="tm">✓ {t.completado_por} · {fmtDT(t.completado_ts)}</div>:<div className="tm" style={{color:"#F35757"}}>⏳ Pendiente</div>}
                    {t.nota&&<div className="nbox">📝 {t.nota}</div>}
                    {t.foto_url&&<img src={t.foto_url} alt="" className="pthumb"/>}
                    {t.resp_admin&&<div className="rbox">✅ Admin: {t.resp_admin}</div>}
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
          <div style={{fontSize:11,color:"#8A8580",textTransform:"uppercase",letterSpacing:1.5,marginTop:20,marginBottom:10}}>📁 Historial</div>
          {srvsHist.map(s=>{const tareas=s.jardin_servicio_tareas||[];const hechas=tareas.filter(t=>t.done).length;
            const fi=new Date(s.fecha_inicio+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"});
            const ff=new Date(s.fecha_fin+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"});
            return <div key={s.id} className="card" style={{marginBottom:10,opacity:.6}}>
              <div className="chdr">
                <span className="ctit">{s.estado==="completado"?"✅":"❌"} {s.nombre}</span>
                <span className="badge" style={{background:s.estado==="completado"?"rgba(16,185,129,.1)":"rgba(232,85,85,.1)",color:s.estado==="completado"?"#10b981":"#e85555"}}>{s.estado==="completado"?"Completado":"Cancelado"}</span>
              </div>
              <div style={{fontSize:12,color:"#8A8580"}}>📅 {fi} – {ff} · 👤 {s.jardinero_nombre} · {hechas}/{tareas.length} tareas</div>
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
              <div style={{minWidth:0}}><div style={{fontSize:13,color:activa?"#c9c5b8":"#5a5e6e",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.txt}</div><div style={{fontSize:11,color:"#8A8580"}}>{t.zona}</div></div>
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
      <div className="fg"><label>Jardinero asignado *</label>
        {jardineros.length===0?<div style={{fontSize:12,color:"#D4A017",background:"rgba(245,158,11,.06)",borderRadius:8,padding:"10px 12px"}}>⚠️ Añade jardineros en el módulo Jardineros antes de crear servicios</div>
        :<select className="fi" value={srvForm.jardinero_id} onChange={e=>setSrvForm(v=>({...v,jardinero_id:e.target.value}))}>
          <option value="">Seleccionar jardinero…</option>
          {jardineros.map(j=><option key={j.id} value={j.id}>{j.nombre}</option>)}
        </select>}
      </div>
      <div className="fg"><label>Notas (opcional)</label><textarea className="fi" rows={2} value={srvForm.notas} onChange={e=>setSrvForm(v=>({...v,notas:e.target.value}))} placeholder="Instrucciones adicionales…"/></div>
      <div className="fg">
        <label>Tareas ({srvTareas.length})</label>
        <div style={{display:"flex",gap:8}}>
          <input className="fi" style={{flex:1}} value={nuevaTarea} onChange={e=>setNuevaTarea(e.target.value)} placeholder="Escribir tarea…" onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addTareaTemp();}}}/>
          <button className="btn bp sm" onClick={addTareaTemp} style={{flexShrink:0}}>+ Añadir</button>
        </div>
        {srvTareas.length>0&&<div style={{marginTop:10}}>
          {srvTareas.map((t,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:"rgba(255,255,255,.03)",borderRadius:8,marginBottom:4}}>
            <span style={{color:"#EC683E",fontSize:13,flexShrink:0}}>{i+1}.</span>
            <span style={{flex:1,fontSize:13,color:"#1A1A1A"}}>{t}</span>
            <button onClick={()=>removeTareaTemp(i)} style={{background:"none",border:"none",color:"#F35757",cursor:"pointer",fontSize:15,padding:"0 4px"}}>×</button>
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
        <div style={{fontSize:14,fontWeight:600,color:"#1A1A1A",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{inc.tarea}</div>
        <div style={{display:"flex",gap:6,marginTop:5,flexWrap:"wrap"}}>
          <span className="badge" style={{background:"rgba(201,168,76,.1)",color:"#EC683E"}}>📍 {inc.zona}</span>
          <span className="badge" style={{background:`${col}18`,color:col}}>{inc.tag} {inc.tipo}</span>
        </div>
      </div>
      <div style={{textAlign:"right",flexShrink:0,fontSize:11,color:"#8A8580"}}>{inc.completado_por&&<div>👤 {inc.completado_por}</div>}<div>🕐 {fmtDT(inc.completado_ts||inc.created_at)}</div></div>
    </div>
    {inc.nota&&<div className="nbox"><div style={{fontSize:10,color:"#D4A017",fontWeight:600,marginBottom:3}}>📝 NOTA</div>{inc.nota}</div>}
    {inc.foto_url&&<img src={inc.foto_url} alt="" style={{maxWidth:"100%",maxHeight:220,borderRadius:8,marginTop:8,objectFit:"cover",display:"block"}}/>}
    {inc.resp_admin&&<div className="rbox"><div style={{fontSize:10,color:"#A6BE59",fontWeight:600,marginBottom:3}}>✅ RESPUESTA ADMIN</div>{inc.resp_admin}</div>}
    <div style={{marginTop:10}}><button className="btn bg sm" onClick={()=>setShow(!show)}>{inc.resp_admin?"✏️ Editar respuesta":"💬 Responder"}</button></div>
    {show&&<div style={{marginTop:9}}>
      <textarea className="fi" rows={3} value={reply} onChange={e=>setReply(e.target.value)} placeholder="Escribe tu respuesta…"/>
      <div style={{display:"flex",gap:7,marginTop:7}}><button className="btn bg sm" onClick={()=>setShow(false)}>Cancelar</button><button className="btn bp sm" onClick={()=>{onResp(inc,reply);setShow(false);}}>✓ Guardar</button></div>
    </div>}
  </div>;
}

// ─── LIMPIEZA ────────────────────────────────────────────────────────────────
const LIMP_CF = [
  {id:"cf1",txt:"Sin pelos en suelos ni baños"},
  {id:"cf2",txt:"Sin manchas en espejos ni grifos"},
  {id:"cf3",txt:"Camas perfectas, sin arrugas, cojines colocados"},
  {id:"cf4",txt:"Cocina limpia y ordenada"},
  {id:"cf5",txt:"Casa huele bien en todas las habitaciones"},
  {id:"cf6",txt:"Basura retirada de todas las zonas"},
  {id:"cf7",txt:"Luces funcionan correctamente"},
  {id:"cf8",txt:"Puertas y ventanas cerradas"},
  {id:"cf9",txt:"Reposición completa (toallas, papel, gel, champú, café)"},
  {id:"cf10",txt:"Decoración y cojines perfectamente colocados"},
  {id:"cf11",txt:"Sin objetos olvidados por huéspedes"},
  {id:"cf12",txt:"Alarma lista para activar"},
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
  // Zonas state
  const [zonasAbiertas,setZonasAbiertas]=useState({general:true});
  const [zonaFotoId,setZonaFotoId]=useState(null);

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
      // Step 1: INSERT with only base fields that always exist
      const [srv]=await sbPost("servicios",{nombre:newS.nombre,fecha:newS.fecha,creado_por:perfil.nombre},tok);
      // Step 2: PATCH with optional limpiadora fields (may not exist in table)
      if(newS.limpiadora_id&&srv?.id){
        const extra={};
        extra.limpiadora_id=newS.limpiadora_id;
        extra.limpiadora_nombre=limpSel?.nombre||"";
        if(newS.modalidad_pago)extra.modalidad_pago=newS.modalidad_pago;
        if(newS.modalidad_pago==="por_horas")extra.tarifa_hora_aplicada=parseFloat(newS.tarifa_hora)||null;
        if(newS.modalidad_pago==="precio_fijo_servicio")extra.precio_fijo_acordado=parseFloat(newS.precio_fijo_acordado)||null;
        if(newS.modalidad_pago==="permuta")extra.permuta_descripcion=newS.permuta_descripcion||null;
        await sbPatch("servicios",`id=eq.${srv.id}`,extra,tok).catch(()=>{});
      }
      for(const t of LIMP_T)await sbPost("servicio_tareas",{servicio_id:srv.id,tarea_id:t.id,zona:t.zona,es_extra:false},tok);
      const us=await sbGet("usuarios","?rol=eq.limpieza&select=id",tok);
      for(const u of us){await sbPost("notificaciones",{para:u.id,txt:`Nuevo servicio: "${newS.nombre}" — ${new Date(newS.fecha).toLocaleDateString("es-ES")}`},tok);sendPush("🌾 Finca El Molino",`Nuevo servicio: ${newS.nombre}`);}
      setActId(srv.id);setShowNew(false);setNewS({nombre:"",fecha:new Date().toISOString().split("T")[0],limpiadora_id:"",modalidad_pago:"",tarifa_hora:"",precio_fijo_acordado:"",permuta_descripcion:""});await loadSrvs();
    }catch(_){}setSaving(false);
  };

  // Toggle tarea by tarea_id (string like "bpb1") — POST if new, PATCH if exists
  const toggleT=async tareaId=>{
    if(isA||saving)return;
    setSaving(true);
    // tareaId here is the DB row id (integer) for existing tareas
    const cur=tareas.find(t=>t.id===tareaId);
    const nuevoDone=!cur?.done;
    await sbPatch("servicio_tareas",`id=eq.${tareaId}`,{
      done:nuevoDone,
      completado_por:nuevoDone?perfil.nombre:null,
      completado_ts:nuevoDone?new Date().toISOString():null,
    },tok);
    await loadTareas(actId);
    const updated=await sbGet("servicio_tareas",`?servicio_id=eq.${actId}&select=*`,tok);
    const srvC=servicios.find(s=>s.id===actId);
    const yaVerifC=srvC?.verificado;
    const todas=updated.filter(t=>!t.es_extra).every(t=>t.done);
    if(todas&&!yaVerifC&&!isA){
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
  const comp=fijas.filter(t=>t.done).length;
  // Map tarea_id → DB row for zone rendering
  const tMap={};fijas.forEach(t=>{if(t.tarea_id)tMap[t.tarea_id]=t;});
  // Check if tareas use new zone ids
  const allZonaIds=LIMP_ZONAS.flatMap(z=>getZonaTareas(z).map(t=>t.id));
  const useZonas=fijas.some(t=>allZonaIds.includes(t.tarea_id));
  const tot=tareas.length;
  const todoHecho=tot>0&&comp===tot;
  const yaVerif=srv?.verificado;

  return <>
    <div className="ph"><h2>{isA?"Gestión limpieza":"Mi servicio"}</h2></div>
    <div className="pb">
      <div className="g2" style={{alignItems:"flex-start"}}>
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
              <div style={{fontSize:13,fontWeight:600,color:"#EC683E",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>🧹 {s.nombre}</div>
              <div style={{fontSize:11,color:"#8A8580",marginTop:3}}>📅 {new Date(s.fecha).toLocaleDateString("es-ES")}</div>
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
              <div style={{fontSize:11,color:"#8A8580",marginTop:2}}>{srv.verificado_nota}</div>
            </div>
          </div>}

          {/* Cabecera servicio */}
          <div style={{background:"rgba(201,168,76,.08)",border:"1px solid rgba(201,168,76,.15)",borderRadius:10,padding:"12px 16px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
            <div style={{minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,color:"#EC683E",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>🧹 {srv.nombre}</div>
              <div style={{fontSize:11,color:"#8A8580"}}>{new Date(srv.fecha).toLocaleDateString("es-ES")} · {comp}/{tot} tareas</div>
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
                <div style={{fontSize:13,color:"#A6BE59",fontWeight:500}}>En curso desde las <strong>{srv.hora_inicio?.slice(0,5)}</strong></div>
              </div>
            )}
          </>}

          {/* Barra progreso */}
          {(()=>{
            const zComp=useZonas?LIMP_ZONAS.filter(z=>{const cr=tMap[z.id+"_cerrada"];return !!cr?.done;}).length:0;
            const pct=tot?Math.round(comp/tot*100):0;
            return <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,fontSize:12,color:"#8A8580"}}>
              <span>{useZonas?`${zComp}/${LIMP_ZONAS.length} zonas · `:""}{comp}/{tot} tareas</span>
              <span style={{fontWeight:700,color:pct===100?"#A6BE59":"#1A1A1A"}}>{pct}%</span>
            </div>;
          })()}
          <div className="prog" style={{marginBottom:14,height:10}}>
            <div className="pfill" style={{width:`${tot?(comp/tot)*100:0}%`,background:tot&&comp/tot>.8?"#A6BE59":comp/tot>.4?"#EC683E":"#F35757"}}/>
          </div>

          {/* Botón verificación si todo hecho y no verificado */}
          {!isA&&todoHecho&&!yaVerif&&(
            <div style={{marginBottom:14}}>
              <button className="btn bp" style={{width:"100%",justifyContent:"center",fontSize:15,padding:"12px"}} onClick={()=>{setFinalCheck({});setFinalMode(null);setFinalNota("");setFinalStep("check");setShowFinal(true);}}>
                ✅ Abrir verificación final del servicio
              </button>
            </div>
          )}

          {/* TAREAS — zonas o lista plana */}
          {!useZonas?fijas.map(t=>(
            <div key={t.id} className={`cli${t.done?" done":""}`} style={{marginBottom:4}}>
              {!isA?<div className={`chk${t.done?" on":""}`} onClick={()=>toggleT(t.id)} style={{cursor:"pointer"}}/>:<span style={{fontSize:17,flexShrink:0}}>{t.done?"✅":"⬜"}</span>}
              <div style={{flex:1,minWidth:0}}>
                <span className="tz">{t.zona||"General"}</span>
                <div className={`tl${t.done?" done":""}`}>{LIMP_T.find(x=>x.id===t.tarea_id)?.txt||t.txt||t.tarea_id}</div>
                {t.done&&<div className="tm">✓ {t.completado_por}</div>}
                {t.nota&&<div className="nbox">📝 {t.nota}</div>}
                {t.foto_url&&<img src={t.foto_url} alt="" className="pthumb"/>}
              </div>
              <span className="ibtn" onClick={()=>openN2(t)}>{t.nota||t.foto_url?"✏️":"➕"}</span>
            </div>
          )):LIMP_ZONAS.map(zona=>{
            const zt=getZonaTareas(zona);
            const zonaDone=zt.filter(t=>tMap[t.id]?.done).length;
            const zonaTotal=zt.length;
            const zonaCompleta=zonaTotal>0&&zonaDone===zonaTotal;
            const cerradaRow=tMap[zona.id+"_cerrada"];
            const zonaCerrada=!!cerradaRow?.done;
            const abierta=!!zonasAbiertas[zona.id];
            const estadoColor=zonaCerrada?"#A6BE59":zonaDone===0?"#BFBAB4":zonaCompleta?"#A6BE59":"#D4A017";
            const renderTarea=(td)=>{const row=tMap[td.id];return <div key={td.id} className={`cli${row?.done?" done":""}`} style={{marginBottom:4}}>
              {!isA?<div className={`chk${row?.done?" on":""}`} onClick={()=>{if(row)toggleT(row.id);}} style={{cursor:"pointer"}}/>:<span style={{fontSize:17,flexShrink:0}}>{row?.done?"✅":"⬜"}</span>}
              <div style={{flex:1,minWidth:0}}>
                <div className={`tl${row?.done?" done":""}`}>{td.txt}</div>
                {row?.done&&<div className="tm">✓ {row.completado_por}</div>}
                {row?.nota&&<div className="nbox">📝 {row.nota}</div>}
                {row?.foto_url&&<img src={row.foto_url} alt="" className="pthumb"/>}
              </div>
              {row&&<span className="ibtn" onClick={()=>openN2(row)}>{row.nota||row.foto_url?"✏️":"➕"}</span>}
            </div>;};
            return <div key={zona.id} style={{marginBottom:8,borderRadius:14,overflow:"hidden",border:`1.5px solid ${zonaCerrada?"rgba(166,190,89,.3)":abierta?"rgba(236,104,62,.2)":"rgba(0,0,0,.06)"}`,background:zonaCerrada?"rgba(166,190,89,.04)":"#fff"}}>
              <div onClick={()=>setZonasAbiertas(prev=>({...prev,[zona.id]:!prev[zona.id]}))} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",cursor:"pointer",background:zonaCerrada?"rgba(166,190,89,.06)":"transparent"}}>
                <span style={{fontSize:20}}>{zona.emoji}</span>
                <div style={{flex:1,minWidth:0}}><div style={{fontSize:14,fontWeight:600,color:"#1A1A1A"}}>{zona.nombre}</div></div>
                <span className="badge" style={{background:`${estadoColor}18`,color:estadoColor,border:`1px solid ${estadoColor}30`}}>{zonaDone}/{zonaTotal}</span>
                {zonaCerrada&&<span style={{fontSize:16}}>✅</span>}
                <span style={{color:"#BFBAB4",fontSize:18,transition:"transform .2s",transform:abierta?"rotate(90deg)":"none"}}>›</span>
              </div>
              {abierta&&<div style={{padding:"0 14px 14px"}}>
                {zona.subzonas?zona.subzonas.map(sz=>{
                  const szDone=sz.tareas.filter(t=>tMap[t.id]?.done).length;
                  return <div key={sz.id} style={{marginBottom:10}}>
                    <div style={{fontSize:12,fontWeight:700,color:"#8A8580",textTransform:"uppercase",letterSpacing:.5,marginBottom:6,paddingTop:8,borderTop:"1px solid rgba(0,0,0,.04)"}}>{sz.nombre} ({szDone}/{sz.tareas.length})</div>
                    {sz.tareas.map(td=>renderTarea(td))}
                  </div>;
                }):zt.map(td=>renderTarea(td))}
                {!isA&&zonaCompleta&&!zonaCerrada&&<div style={{marginTop:10}}>
                  {zona.foto_requerida?<>
                    <label className="btn bp" style={{width:"100%",justifyContent:"center",cursor:"pointer"}}>
                      📷 Cerrar zona con foto
                      <input type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={async e=>{
                        const f=e.target.files[0];if(!f)return;
                        try{const url=await uploadFoto(f,tok);await sbPost("servicio_tareas",{servicio_id:actId,tarea_id:zona.id+"_cerrada",zona:zona.nombre,done:true,completado_por:perfil.nombre,completado_ts:new Date().toISOString(),foto_url:url,es_extra:false},tok);await loadTareas(actId);}catch(_){}
                      }}/>
                    </label>
                    <button className="btn bg" style={{width:"100%",justifyContent:"center",marginTop:6}} onClick={async()=>{
                      await sbPost("servicio_tareas",{servicio_id:actId,tarea_id:zona.id+"_cerrada",zona:zona.nombre,done:true,completado_por:perfil.nombre,completado_ts:new Date().toISOString(),es_extra:false},tok).catch(()=>{});await loadTareas(actId);
                    }}>Cerrar zona sin foto</button>
                  </>:<button className="btn bp" style={{width:"100%",justifyContent:"center"}} onClick={async()=>{
                    await sbPost("servicio_tareas",{servicio_id:actId,tarea_id:zona.id+"_cerrada",zona:zona.nombre,done:true,completado_por:perfil.nombre,completado_ts:new Date().toISOString(),es_extra:false},tok).catch(()=>{});await loadTareas(actId);
                  }}>✅ Cerrar zona</button>}
                </div>}
                {cerradaRow?.foto_url&&<img src={cerradaRow.foto_url} alt="" className="pthumb" style={{marginTop:8}}/>}
              </div>}
            </div>;
          })}

          {/* EXTRAS */}
          {extras.length>0&&<>
            <hr className="div"/>
            <div style={{fontSize:12,color:"#EC683E",fontWeight:600,marginBottom:9}}>⭐ Extras</div>
            {extras.map(t=>(
              <div key={t.id} className={`cli${t.done?" done":""}`}>
                {!isA?<div className={`chk${t.done?" on":""}`} onClick={()=>toggleT(t.id)} style={{cursor:"pointer"}}/>:<span style={{fontSize:17,flexShrink:0}}>{t.done?"✅":"⬜"}</span>}
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
      </div>
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

    {/* NOTA INCIDENCIA */}
    {notaM&&<NotaModal nota={nota} setNota={setNota} foto={foto} setFoto={setFoto} onSave={saveNota} onClose={()=>setNotaM(null)} tok={tok}/>}
    {/* MODAL VERIFICACIÓN FINAL */}
    {showFinal&&!isA&&(
      <div className="ov" style={{alignItems:"flex-end",padding:0}}>
        <div style={{background:"#FFFFFF",border:"1px solid rgba(201,168,76,.25)",borderRadius:"20px 20px 0 0",padding:"24px 20px 36px",width:"100%",maxWidth:540,maxHeight:"92vh",overflowY:"auto"}}>
          <div style={{textAlign:"center",marginBottom:20}}>
            <div style={{fontSize:36,marginBottom:8}}>🧹</div>
            <div style={{fontFamily:"'Inter Tight',sans-serif",fontSize:20,color:"#1A1A1A",marginBottom:4}}>¡Comprobación final!</div>
            <div style={{fontSize:13,color:"#8A8580"}}>Has completado todas las tareas. Verifica que la casa está perfecta antes de cerrar.</div>
          </div>

          {!finalMode&&(
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
              <button className="btn bp" style={{width:"100%",justifyContent:"center",padding:"14px",fontSize:15}} onClick={()=>setFinalMode("ok")}>✅ Todo correcto — casa lista</button>
              <button className="btn bg" style={{width:"100%",justifyContent:"center",padding:"14px",fontSize:15}} onClick={()=>setFinalMode("incidencia")}>⚠️ Hay incidencias — cerrar con nota</button>
            </div>
          )}

          {finalMode==="ok"&&finalStep==="check"&&<>
            <div style={{fontSize:12,color:"#EC683E",fontWeight:600,marginBottom:12,textTransform:"uppercase",letterSpacing:1}}>✅ Marca cada punto antes de confirmar</div>
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
              <div style={{fontFamily:"'Inter Tight',sans-serif",fontSize:18,color:"#1A1A1A",marginBottom:4}}>¿A qué hora has terminado?</div>
            </div>
            <div className="fg">
              <label>Hora de finalización</label>
              <input type="time" className="fi" value={horaFin} onChange={e=>recalcHora(e.target.value)} style={{fontSize:18,textAlign:"center",padding:"12px"}}/>
            </div>
            {horasCalc>0&&<div style={{background:"rgba(201,168,76,.06)",border:"1px solid rgba(201,168,76,.15)",borderRadius:10,padding:"14px 16px",marginBottom:14}}>
              <div style={{fontSize:13,color:"#1A1A1A",marginBottom:6}}>⏱ Has trabajado <strong style={{color:"#EC683E"}}>{horasCalc} horas</strong></div>
              {mod==="permuta"?<div style={{fontSize:14,color:"#a5b4fc"}}>🔄 Permuta: {srvM?.permuta_descripcion||"Acuerdo de permuta"} — Coste: 0€</div>
              :mod==="precio_fijo_servicio"?<div style={{fontSize:14,color:"#1A1A1A"}}>Precio fijo acordado: <strong style={{color:"#EC683E",fontSize:18}}>{costeCalc}€</strong></div>
              :tarifaHora>0?<div style={{fontSize:14,color:"#1A1A1A"}}>Coste: <strong>{horasCalc}</strong> × <strong>{tarifaHora}€/h</strong> = <strong style={{color:"#EC683E",fontSize:18}}>{costeCalc}€</strong></div>
              :<div style={{fontSize:12,color:"#D4A017",marginTop:4}}>⚠️ Configura la tarifa por hora en Ajustes para calcular el coste automáticamente</div>}
            </div>}
            {horasCalc===0&&<div style={{background:"rgba(245,158,11,.06)",border:"1px solid rgba(245,158,11,.15)",borderRadius:8,padding:"10px 12px",marginBottom:14,fontSize:12,color:"#D4A017"}}>No se ha podido calcular la duración. Puedes continuar igualmente.</div>}
            <div style={{display:"flex",gap:8,marginTop:8}}>
              <button className="btn bg" style={{flex:1,justifyContent:"center"}} onClick={()=>setFinalStep("check")}>← Volver</button>
              <button className="btn bp" style={{flex:2,justifyContent:"center",padding:"12px",fontSize:15}} onClick={confirmarConHora} disabled={finalSaving}>{finalSaving?"Guardando…":"✅ Confirmar y cerrar servicio"}</button>
            </div>
          </>;})()}

          {finalMode==="incidencia"&&<>
            <div style={{fontSize:13,color:"#D4A017",fontWeight:600,marginBottom:10}}>⚠️ ¿Qué incidencia hay?</div>
            <textarea className="fi" rows={4} value={finalNota} onChange={e=>setFinalNota(e.target.value)} placeholder="Ej: Falta reponer gel en baño principal, mancha en sofá…" style={{marginBottom:14,fontSize:14,lineHeight:1.5}}/>
            <div style={{display:"flex",gap:8}}>
              <button className="btn bg" style={{flex:1,justifyContent:"center"}} onClick={()=>setFinalMode(null)}>← Volver</button>
              <button className="btn" style={{flex:2,justifyContent:"center",padding:"12px",fontSize:15,background:"#f59e0b",color:"#0f1117"}} onClick={()=>guardarFinal("incidencia")} disabled={finalSaving||!finalNota.trim()}>{finalSaving?"Guardando…":"⚠️ Cerrar con incidencias"}</button>
            </div>
          </>}

          <button onClick={()=>{setShowFinal(false);setFinalStep("check");}} style={{background:"none",border:"none",color:"#8A8580",cursor:"pointer",width:"100%",textAlign:"center",marginTop:16,fontSize:12,fontFamily:"'DM Sans',sans-serif",padding:"8px"}}>Cerrar y decidir más tarde</button>
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
        <div style={{padding:"12px 14px 8px",fontSize:10,color:"#8A8580",textTransform:"uppercase",letterSpacing:1}}>Conversaciones</div>
        {usuarios.map(u=><div key={u.id} className={`cu${String(conId)===String(u.id)?" on":""}`} onClick={()=>selectU(u.id)}>
          <div className="av" style={{width:32,height:32,fontSize:11}}>{u.avatar||u.nombre.slice(0,2).toUpperCase()}</div>
          <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,color:"#1A1A1A",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.nombre}</div><div style={{fontSize:10,color:"#8A8580",textTransform:"capitalize"}}>{u.rol}</div></div>
          {(unread[String(u.id)]||0)>0&&<span style={{background:"#F35757",color:"#fff",borderRadius:20,padding:"2px 7px",fontSize:11,fontWeight:700,flexShrink:0}}>{unread[String(u.id)]}</span>}
        </div>)}
      </div>}
      {conId?<div className="chat-area">
        <div className="chdr2">
          <div className="av" style={{width:32,height:32,fontSize:11}}>{isA?(conUser?.avatar||conUser?.nombre?.slice(0,2).toUpperCase()||"?"):"AD"}</div>
          <div><div style={{fontSize:13,fontWeight:600,color:"#1A1A1A"}}>{isA?(conUser?.nombre||"…"):"Administración"}</div><div style={{fontSize:10,color:"#8A8580",textTransform:"capitalize"}}>{isA?(conUser?.rol||""):"admin"}</div></div>
        </div>
        <div className="msgs">
          {msgs.length===0&&<div style={{textAlign:"center",color:"#8A8580",fontSize:13,padding:"36px 0"}}>Comienza la conversación…</div>}
          {msgs.map(m=>{const mine=String(m.de)===myId;return <div key={m.id} className={`bub${mine?" me":" them"}`}>{m.txt&&<div>{m.txt}</div>}{m.foto_url&&<img src={m.foto_url} alt="" style={{maxWidth:200,maxHeight:160,borderRadius:8,marginTop:6,objectFit:"cover",display:"block"}}/>}<div className="bmeta">{fmtDT(m.created_at)}</div></div>;})}
          <div ref={endRef}/>
        </div>
        {/* INPUT DESKTOP */}
        <div style={{flexShrink:0,borderTop:"1px solid rgba(255,255,255,.08)",padding:"10px 14px",display:"flex",gap:8,alignItems:"flex-end",background:"#FFFFFF"}}>
          <div style={{flex:1,minWidth:0}}>
            {fotoMsg&&<div style={{marginBottom:8,position:"relative",display:"inline-block"}}><img src={fotoMsg} alt="" style={{height:50,borderRadius:6,objectFit:"cover"}}/><button onClick={()=>setFotoMsg(null)} style={{position:"absolute",top:-6,right:-6,background:"#F35757",border:"none",borderRadius:"50%",width:18,height:18,cursor:"pointer",color:"#fff",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button></div>}
            <textarea ref={inputRef} className="fi" rows={2} value={txt} onChange={e=>setTxt(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&window.innerWidth>768){e.preventDefault();send();}}} placeholder="Escribe un mensaje…" style={{resize:"none",fontSize:15,lineHeight:1.5}}/>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6,flexShrink:0}}>
            <label style={{cursor:"pointer",width:44,height:44,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,color:"#EC683E",fontSize:20,display:"flex",alignItems:"center",justifyContent:"center"}}>
              📷<input type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={async e=>{const f=e.target.files[0];if(f){try{const url=await uploadFoto(f,tok);setFotoMsg(url);}catch(_){const r=new FileReader();r.onload=ev=>setFotoMsg(ev.target.result);r.readAsDataURL(f);}}}}/>
            </label>
            <button onClick={send} style={{width:44,height:44,background:"#EC683E",border:"none",borderRadius:10,color:"#0f1117",fontSize:22,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>→</button>
          </div>
        </div>
      </div>:<div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}><div className="empty"><span className="ico">💬</span><p>Selecciona una conversación</p></div></div>}
    </div>

    {/* MÓVIL */}
    <div className="chat-mobile-wrap">
      {isA&&!conId&&<>
        <div style={{padding:"16px 16px 8px",borderBottom:"1px solid rgba(255,255,255,.06)"}}><div style={{fontFamily:"'Inter Tight',sans-serif",fontSize:18,color:"#1A1A1A"}}>💬 Chat con el equipo</div></div>
        <div style={{flex:1,overflowY:"auto"}}>
          {usuarios.map(u=><div key={u.id} className="cu" style={{padding:"14px 16px",borderBottom:"1px solid rgba(255,255,255,.06)"}} onClick={()=>selectU(u.id)}>
            <div className="av" style={{width:40,height:40,fontSize:13}}>{u.avatar||u.nombre.slice(0,2).toUpperCase()}</div>
            <div style={{flex:1,minWidth:0,marginLeft:4}}><div style={{fontSize:15,color:"#1A1A1A",fontWeight:500}}>{u.nombre}</div><div style={{fontSize:12,color:"#8A8580",textTransform:"capitalize",marginTop:2}}>{u.rol}</div></div>
            {(unread[String(u.id)]||0)>0?<span style={{background:"#F35757",color:"#fff",borderRadius:20,padding:"3px 9px",fontSize:12,fontWeight:700}}>{unread[String(u.id)]}</span>:<span style={{color:"#8A8580",fontSize:22}}>›</span>}
          </div>)}
        </div>
      </>}
      {conId&&<div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden",position:"relative"}}>
        <div style={{flexShrink:0,padding:"11px 16px",borderBottom:"1px solid rgba(255,255,255,.07)",display:"flex",alignItems:"center",gap:10,background:"#FFFFFF"}}>
          {isA&&<button onClick={()=>setConId(null)} style={{background:"none",border:"none",color:"#EC683E",fontSize:26,cursor:"pointer",padding:"0 8px 0 0",lineHeight:1,flexShrink:0}}>‹</button>}
          <div className="av" style={{width:36,height:36,fontSize:12,flexShrink:0}}>{isA?(conUser?.avatar||conUser?.nombre?.slice(0,2).toUpperCase()||"?"):"AD"}</div>
          <div><div style={{fontSize:14,fontWeight:600,color:"#1A1A1A"}}>{isA?(conUser?.nombre||"…"):"Administración"}</div><div style={{fontSize:11,color:"#8A8580",textTransform:"capitalize"}}>{isA?(conUser?.rol||""):"admin"}</div></div>
        </div>
        <div className="msgs" style={{flex:1,overflowY:"auto",paddingBottom:80}}>
          {msgs.length===0&&<div style={{textAlign:"center",color:"#8A8580",fontSize:13,padding:"32px 0"}}>Comienza la conversación…</div>}
          {msgs.map(m=>{const mine=String(m.de)===myId;return <div key={m.id} className={`bub${mine?" me":" them"}`}>{m.txt&&<div>{m.txt}</div>}{m.foto_url&&<img src={m.foto_url} alt="" style={{maxWidth:"70%",borderRadius:8,marginTop:6,objectFit:"cover",display:"block"}}/>}<div className="bmeta">{fmtDT(m.created_at)}</div></div>;})}
          <div ref={endRef}/>
        </div>
        {/* INPUT MÓVIL */}
        <div style={{position:"absolute",bottom:0,left:0,right:0,zIndex:10,flexShrink:0,borderTop:"1px solid rgba(255,255,255,.08)",padding:"10px 14px",display:"flex",gap:8,alignItems:"flex-end",background:"#FFFFFF"}}>
          <div style={{flex:1,minWidth:0}}>
            {fotoMsg&&<div style={{marginBottom:8,position:"relative",display:"inline-block"}}><img src={fotoMsg} alt="" style={{height:50,borderRadius:6,objectFit:"cover"}}/><button onClick={()=>setFotoMsg(null)} style={{position:"absolute",top:-6,right:-6,background:"#F35757",border:"none",borderRadius:"50%",width:18,height:18,cursor:"pointer",color:"#fff",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button></div>}
            <textarea className="fi" rows={2} value={txt} onChange={e=>setTxt(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}} placeholder="Escribe un mensaje…" style={{resize:"none",fontSize:15,lineHeight:1.5}}/>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6,flexShrink:0}}>
            <label style={{cursor:"pointer",width:44,height:44,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,color:"#EC683E",fontSize:20,display:"flex",alignItems:"center",justifyContent:"center"}}>
              📷<input type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={async e=>{const f=e.target.files[0];if(f){try{const url=await uploadFoto(f,tok);setFotoMsg(url);}catch(_){const r=new FileReader();r.onload=ev=>setFotoMsg(ev.target.result);r.readAsDataURL(f);}}}}/>
            </label>
            <button onClick={send} style={{width:44,height:44,background:"#EC683E",border:"none",borderRadius:10,color:"#0f1117",fontSize:22,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>→</button>
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
    ...airbnbs.map(a=>({tipo:"airbnb",nombre:"Alojamiento turístico",detalle:`Airbnb: ${a.huesped}`,color:"#A6BE59"})),
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
      const msg=`🔒 ${perfil.nombre} solicita ${tipoLbl} el ${fmtFecha}. La fecha está ocupada.`;
      await notificarRoles(["admin"],"🔒 Solicitud de desbloqueo",msg,"desbloqueo",tok);
      setEnviado(true);
    }catch(_){}
    setSaving(false);
  };

  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.82)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,overflowY:"auto"}}>
    <div style={{background:"#FFFFFF",border:"1px solid rgba(201,168,76,.2)",borderRadius:14,padding:"24px 20px",width:"100%",maxWidth:460,position:"relative"}} onClick={e=>e.stopPropagation()}>
      {!enviado?<>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:40,marginBottom:10}}>🔒</div>
          <div style={{fontFamily:"'Inter Tight',sans-serif",fontSize:19,color:"#1A1A1A",marginBottom:8}}>Fecha no disponible</div>
          <div style={{fontSize:13,color:"#8A8580",lineHeight:1.5}}>El <strong style={{color:"#1A1A1A"}}>{fmtFecha}</strong> ya tiene reservas activas.</div>
        </div>
        <div style={{marginBottom:16}}>
          {conflictos.map((c,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"#F5F3F0",borderRadius:8,marginBottom:6,borderLeft:`3px solid ${c.color}`}}>
              <span style={{fontSize:16}}>{c.tipo==="airbnb"?"🏠":"🎉"}</span>
              <div><div style={{fontSize:13,color:"#1A1A1A",fontWeight:500}}>{c.nombre}</div><div style={{fontSize:11,color:"#8A8580"}}>{c.detalle}</div></div>
            </div>
          ))}
        </div>
        <div style={{background:"rgba(201,168,76,.06)",border:"1px solid rgba(201,168,76,.15)",borderRadius:10,padding:"14px",marginBottom:12}}>
          <div style={{fontSize:13,color:"#EC683E",fontWeight:600,marginBottom:6}}>¿Necesitas usar esta fecha?</div>
          <div style={{fontSize:12,color:"#8A8580",marginBottom:10,lineHeight:1.5}}>Solicita al administrador que autorice una franja horaria concreta.</div>
          <textarea className="fi" rows={3} value={motivo} onChange={e=>setMotivo(e.target.value)} placeholder="Ej: Visita rápida por la mañana, los huéspedes llegan a las 16:00…" style={{fontSize:13,marginBottom:10}}/>
          <button className="btn bp" style={{width:"100%",justifyContent:"center",padding:"12px",fontSize:14}} onClick={solicitar} disabled={saving}>
            {saving?"Enviando…":"📨 Solicitar desbloqueo"}
          </button>
        </div>
        <button className="btn bg" style={{width:"100%",justifyContent:"center",marginTop:4}} onClick={onCerrar}>← Volver sin solicitar</button>
      </>:<>
        <div style={{textAlign:"center",padding:"16px 0"}}>
          <div style={{fontSize:44,marginBottom:12}}>📨</div>
          <div style={{fontFamily:"'Inter Tight',sans-serif",fontSize:18,color:"#1A1A1A",marginBottom:10}}>Solicitud enviada</div>
          <div style={{fontSize:13,color:"#8A8580",lineHeight:1.6,marginBottom:20}}>El administrador ha recibido tu solicitud y te notificará si aprueba una franja horaria.</div>
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

  if(load)return <div style={{color:"#8A8580",fontSize:13,padding:"8px 0"}}>Cargando…</div>;
  if(solicitudes.length===0)return <div style={{background:"rgba(16,185,129,.06)",border:"1px solid rgba(16,185,129,.15)",borderRadius:10,padding:"12px 16px",fontSize:13,color:"#A6BE59",marginBottom:16}}>✅ Sin solicitudes de desbloqueo pendientes</div>;

  return <div style={{marginBottom:20}}>
    <div style={{fontSize:11,color:"#F35757",textTransform:"uppercase",letterSpacing:1,fontWeight:600,marginBottom:10}}>🔒 Solicitudes de desbloqueo ({solicitudes.length})</div>
    {solicitudes.map(s=>{
      const fmtF=new Date(s.fecha+"T12:00:00").toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"});
      const tipoLbl={visita:"Visita",reserva:"Reserva evento",airbnb:"Reserva Airbnb"}[s.tipo_accion]||s.tipo_accion;
      return <div key={s.id} className="card" style={{marginBottom:10,borderLeft:"3px solid #e85555"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:10}}>
          <div>
            <div style={{fontSize:14,fontWeight:600,color:"#1A1A1A"}}>🔒 {tipoLbl} · {fmtF}</div>
            <div style={{fontSize:12,color:"#8A8580",marginTop:3}}>Solicitado por <strong>{s.solicitado_por}</strong></div>
            {s.motivo&&<div style={{fontSize:12,color:"#1A1A1A",marginTop:5,background:"#F5F3F0",borderRadius:7,padding:"6px 10px"}}>{s.motivo}</div>}
          </div>
          <span style={{fontSize:10,color:"#8A8580",flexShrink:0}}>{fmtDT(s.created_at)}</span>
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
            <div className={`ndot${n.leida?" read":""}`}/><div style={{flex:1,minWidth:0}}>{isA&&destU&&<div style={{fontSize:10,color:"#EC683E",marginBottom:3}}>→ {destU.nombre}</div>}<div style={{fontSize:13,color:n.leida?"#7a7f94":"#c9c5b8",lineHeight:1.4}}>{n.txt}</div><div style={{fontSize:10,color:"#8A8580",marginTop:4}}>{fmtDT(n.created_at)}</div></div>
            {!n.leida&&!isA&&<button className="btn bg sm" style={{flexShrink:0}} onClick={()=>leer(n.id)}>✓</button>}
          </div>;})}
        </div>}
    </div>
  </>;
}

// ─── USUARIOS ────────────────────────────────────────────────────────────────
function Usuarios({tok}){
  const [usuarios,setUsuarios]=useState([]);const [operarios,setOperarios]=useState([]);const [load,setLoad]=useState(true);const [showAdd,setShowAdd]=useState(false);
  const [form,setForm]=useState({email:"",password:"",nombre:"",rol:"jardinero"});const [saving,setSaving]=useState(false);const [err,setErr]=useState("");
  const [showPinModal,setShowPinModal]=useState(null);const [newPin,setNewPin]=useState("");const [newPinConfirm,setNewPinConfirm]=useState("");
  const loadAll=async()=>{
    const [u,o]=await Promise.all([sbGet("usuarios","?select=*&order=rol.asc",tok).catch(()=>[]),sbGet("operarios","?select=*&order=nombre.asc",tok).catch(()=>[])]);
    setUsuarios(u);setOperarios(o);setLoad(false);
  };
  useEffect(()=>{loadAll();},[]);
  const crearUsuario=async()=>{
    if(!form.email||!form.password||!form.nombre||saving)return;setSaving(true);setErr("");
    try{
      const r=await fetch(`${SB_URL}/auth/v1/admin/users`,{method:"POST",headers:{...HDR,"Authorization":`Bearer ${tok}`},body:JSON.stringify({email:form.email,password:form.password,email_confirm:true})});
      const d=await r.json();if(!r.ok)throw new Error(d.message||"Error al crear usuario");
      await sbPost("usuarios",{id:d.id,nombre:form.nombre,rol:form.rol,avatar:form.nombre.slice(0,2).toUpperCase()},tok);
      setShowAdd(false);setForm({email:"",password:"",nombre:"",rol:"jardinero"});
      await loadAll();
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
            <div style={{minWidth:0}}><div style={{fontSize:14,fontWeight:600,color:"#1A1A1A",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.nombre}</div><span className="badge" style={{background:`${RC[u.rol]||"#c9a84c"}15`,color:RC[u.rol]||"#c9a84c",border:`1px solid ${RC[u.rol]||"#c9a84c"}30`,marginTop:3,display:"inline-block"}}>{RL[u.rol]||u.rol}</span></div>
          </div>
          <div style={{fontSize:11,color:"#BFBAB4"}}>🔑 {u.id.slice(0,8)}…</div>
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

    {/* OPERARIOS */}
    {operarios.length>0&&<>
      <div style={{fontSize:11,color:"#EC683E",textTransform:"uppercase",letterSpacing:1,fontWeight:700,marginTop:28,marginBottom:14}}>Operarios (acceso por PIN)</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(250px,1fr))",gap:14}}>
        {operarios.map(o=>{
          const rc=o.rol==="jardinero"?"#A6BE59":"#AFA3FF";
          return <div key={o.id} className="card">
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
              <div style={{width:44,height:44,borderRadius:"50%",background:`${rc}20`,border:`2px solid ${rc}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:rc,flexShrink:0}}>{o.avatar||o.nombre.slice(0,2).toUpperCase()}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:600,color:"#1A1A1A"}}>{o.nombre}</div>
                <div style={{display:"flex",gap:6,marginTop:3}}>
                  <span className="badge" style={{background:`${rc}15`,color:rc}}>{o.rol==="jardinero"?"Jardinero":"Limpieza"}</span>
                  <span className="badge" style={{background:o.activo?"rgba(166,190,89,.1)":"rgba(243,87,87,.1)",color:o.activo?"#A6BE59":"#F35757"}}>{o.activo?"Activo":"Inactivo"}</span>
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:6}}>
              <button className="btn bg sm" style={{flex:1}} onClick={async()=>{await sbPatch("operarios",`id=eq.${o.id}`,{activo:!o.activo},tok);await loadAll();}}>{o.activo?"Desactivar":"Activar"}</button>
              <button className="btn bg sm" onClick={()=>{setShowPinModal(o);setNewPin("");setNewPinConfirm("");}}>Cambiar PIN</button>
            </div>
          </div>;
        })}
      </div>
    </>}

    {/* MODAL CAMBIAR PIN */}
    {showPinModal&&<div className="ov" onClick={()=>setShowPinModal(null)}><div className="modal" style={{maxWidth:360}} onClick={e=>e.stopPropagation()}>
      <h3>Cambiar PIN</h3>
      <div style={{fontSize:13,color:"#8A8580",marginBottom:16}}>{showPinModal.nombre}</div>
      <div className="g2">
        <div className="fg"><label>Nuevo PIN *</label><input className="fi" type="text" inputMode="numeric" maxLength={4} value={newPin} onChange={e=>setNewPin(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder="0000" style={{textAlign:"center",fontSize:20,letterSpacing:8}}/></div>
        <div className="fg"><label>Confirmar *</label><input className="fi" type="text" inputMode="numeric" maxLength={4} value={newPinConfirm} onChange={e=>setNewPinConfirm(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder="0000" style={{textAlign:"center",fontSize:20,letterSpacing:8}}/></div>
      </div>
      {newPin&&newPinConfirm&&newPin!==newPinConfirm&&<div style={{fontSize:12,color:"#F35757",marginBottom:10}}>No coinciden</div>}
      <div className="mft">
        <button className="btn bg" onClick={()=>setShowPinModal(null)}>Cancelar</button>
        <button className="btn bp" disabled={newPin.length!==4||newPin!==newPinConfirm} onClick={async()=>{await sbPatch("operarios",`id=eq.${showPinModal.id}`,{pin:newPin},tok);setShowPinModal(null);}}>Guardar</button>
      </div>
    </div></div>}
  </>;
}

// ─── JARDINEROS ─────────────────────────────────────────────────────────────
const MODAL_JARDINERO=["Fijo mensual","Por horas","Precio fijo por servicio"];

function Jardineros({tok,rol}){
  if(rol!=="admin")return null;
  const [jardineros,setJardineros]=useState([]);
  const [load,setLoad]=useState(true);
  const [showJForm,setShowJForm]=useState(false);
  const [jForm,setJForm]=useState({nombre:"",modalidad:"Fijo mensual",tarifa_mensual:"",tarifa_hora:"",notas:"",pin:"",pinConfirm:""});
  const [saving,setSaving]=useState(false);
  const [analisis,setAnalisis]=useState(null);
  const [analLoad,setAnalLoad]=useState(false);
  const [analData,setAnalData]=useState(null);

  const load_=async()=>{
    try{const j=await sbGet("jardineros","?select=*&order=nombre.asc",tok);setJardineros(j);}catch(_){}
    setLoad(false);
  };
  useEffect(()=>{load_();},[]);

  const crearJardinero=async()=>{
    if(!jForm.nombre||!jForm.pin||jForm.pin.length!==4||jForm.pin!==jForm.pinConfirm||saving)return;
    setSaving(true);
    try{
      const [j]=await sbPost("jardineros",{
        nombre:jForm.nombre,
        modalidad:jForm.modalidad,
        tarifa_mensual:jForm.modalidad==="Fijo mensual"?parseFloat(jForm.tarifa_mensual)||null:null,
        tarifa_hora:jForm.modalidad==="Por horas"?parseFloat(jForm.tarifa_hora)||null:null,
        activo:true,
        notas:jForm.notas||null
      },tok);
      const [op]=await sbPost("operarios",{nombre:jForm.nombre,rol:"jardinero",pin:jForm.pin,referencia_id:j.id,activo:true,avatar:jForm.nombre.slice(0,2).toUpperCase()},tok);
      await sbPatch("jardineros",`id=eq.${j.id}`,{operario_id:op.id},tok).catch(()=>{});
      setShowJForm(false);setJForm({nombre:"",modalidad:"Fijo mensual",tarifa_mensual:"",tarifa_hora:"",notas:"",pin:"",pinConfirm:""});await load_();
    }catch(_){}setSaving(false);
  };
  const toggleActivo=async(j)=>{await sbPatch("jardineros",`id=eq.${j.id}`,{activo:!j.activo},tok);await load_();};
  const verAnalisis=async(j)=>{
    if(analisis?.id===j.id){setAnalisis(null);return;}
    setAnalisis(j);setAnalLoad(true);setAnalData(null);
    try{
      const hoy=new Date();const añoActual=hoy.getFullYear();const mesActual=String(hoy.getMonth()+1).padStart(2,"0");
      const srvsDel=await sbGet("servicios_jardineria",`?jardinero_id=eq.${j.id}&select=id`,tok).catch(()=>[]);
      const srvIds=srvsDel.map(s=>s.id);
      let jornadas=[];
      if(srvIds.length>0){
        try{jornadas=await sbGet("jornadas_jardineria",`?servicio_id_int=in.(${srvIds.join(",")})&select=*`,tok);}
        catch(_){try{jornadas=await sbGet("jornadas_jardineria",`?servicio_id=in.(${srvIds.join(",")})&select=*`,tok);}catch(_2){}}
      }
      const jorMes=jornadas.filter(x=>x.fecha?.slice(5,7)===mesActual);
      const horasMes=jorMes.reduce((s,x)=>s+(parseFloat(x.horas)||0),0);
      const costeMes=jorMes.reduce((s,x)=>s+(parseFloat(x.coste)||0),0);
      const horasAño=jornadas.reduce((s,x)=>s+(parseFloat(x.horas)||0),0);
      const costeAño=jornadas.reduce((s,x)=>s+(parseFloat(x.coste)||0),0);
      const euroHoraReal=horasAño>0?Math.round(costeAño/horasAño*100)/100:0;
      const barras=Array.from({length:12},(_,i)=>{const m=String(i+1).padStart(2,"0");const h=jornadas.filter(x=>x.fecha?.slice(5,7)===m).reduce((s,x)=>s+(parseFloat(x.horas)||0),0);return {name:MESES_CORTO[i],horas:Math.round(h*10)/10};});
      setAnalData({horasMes:Math.round(horasMes*10)/10,costeMes:Math.round(costeMes),horasAño:Math.round(horasAño*10)/10,costeAño:Math.round(costeAño),euroHoraReal,barras});
    }catch(_){}setAnalLoad(false);
  };

  if(load)return <div className="loading"><div className="spin"/><span>Cargando…</span></div>;
  return <>
    <div className="ph"><h2>👷 Jardineros</h2><p>Gestión de jardineros y condiciones</p></div>
    <div className="pb">
      <div style={{marginBottom:14}}><button className="btn bp" onClick={()=>{setJForm({nombre:"",modalidad:"Fijo mensual",tarifa_mensual:"",tarifa_hora:"",notas:"",pin:"",pinConfirm:""});setShowJForm(true);}}>➕ Nuevo jardinero</button></div>
      {jardineros.length===0?<div className="empty"><span className="ico">🌿</span><p>Sin jardineros registrados</p></div>
      :jardineros.map(j=>{
        const modLbl=j.modalidad||"—";
        const tarifaLbl=j.modalidad==="Fijo mensual"&&j.tarifa_mensual?`${j.tarifa_mensual}€/mes`:j.modalidad==="Por horas"&&j.tarifa_hora?`${j.tarifa_hora}€/h`:"—";
        const abierto=analisis?.id===j.id;
        return <div key={j.id} className="card" style={{marginBottom:10,borderLeft:`3px solid ${j.activo?"#10b981":"#5a5e6e"}`,opacity:j.activo?1:.6}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:15,fontWeight:600,color:"#1A1A1A",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{j.nombre}</div>
              <div style={{display:"flex",gap:6,marginTop:5,flexWrap:"wrap"}}>
                <span className="badge" style={{background:"rgba(201,168,76,.1)",color:"#EC683E"}}>{modLbl}</span>
                <span className="badge" style={{background:"rgba(255,255,255,.06)",color:"#8A8580"}}>{tarifaLbl}</span>
                <span className="badge" style={{background:j.activo?"rgba(16,185,129,.1)":"rgba(107,114,128,.1)",color:j.activo?"#10b981":"#6b7280"}}>{j.activo?"Activo":"Inactivo"}</span>
              </div>
              {j.notas&&<div style={{fontSize:11,color:"#8A8580",marginTop:4}}>{j.notas}</div>}
            </div>
            <div style={{display:"flex",gap:6,flexShrink:0}}>
              <button className="btn bg sm" onClick={()=>verAnalisis(j)}>{abierto?"▲ Cerrar":"📊 Análisis"}</button>
              <button className="btn bg sm" onClick={()=>toggleActivo(j)}>{j.activo?"Desactivar":"Activar"}</button>
            </div>
          </div>
          {abierto&&<div style={{marginTop:14,paddingTop:14,borderTop:"1px solid rgba(255,255,255,.06)"}}>
            {analLoad?<div style={{color:"#8A8580",fontSize:13}}>Cargando…</div>
            :analData?<>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:8,marginBottom:14}}>
                {[{l:"HORAS ESTE MES",v:`${analData.horasMes}h`,c:"#c9a84c"},{l:"COSTE ESTE MES",v:`${analData.costeMes}€`,c:"#e85555"},{l:"HORAS ESTE AÑO",v:`${analData.horasAño}h`,c:"#c9a84c"},{l:"COSTE ESTE AÑO",v:`${analData.costeAño}€`,c:"#e85555"},{l:"💡 €/HORA REAL",v:analData.euroHoraReal>0?`${analData.euroHoraReal}€`:"—",c:"#6366f1"}].map(x=>(
                  <div key={x.l} style={{background:"#F5F3F0",borderRadius:8,padding:"10px 12px"}}><div style={{fontSize:10,color:"#8A8580"}}>{x.l}</div><div style={{fontSize:18,fontWeight:700,color:x.c,marginTop:3}}>{x.v}</div></div>
                ))}
              </div>
              <div style={{fontSize:11,color:"#EC683E",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Horas por mes</div>
              <div style={{width:"100%",minHeight:140}}>
                <ResponsiveContainer width="100%" height={140}><BarChart data={analData.barras} margin={{top:5,right:5,left:-20,bottom:5}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)"/><XAxis dataKey="name" tick={{fontSize:9,fill:"#5a5e6e"}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:9,fill:"#5a5e6e"}} axisLine={false} tickLine={false}/><Tooltip contentStyle={{background:"#FFFFFF",border:"1px solid rgba(201,168,76,.25)",borderRadius:8,fontSize:12}} formatter={v=>[`${v}h`]}/><Bar dataKey="horas" fill="#EC683E" radius={[3,3,0,0]}/>
                </BarChart></ResponsiveContainer>
              </div>
            </>:<div style={{color:"#8A8580",fontSize:13}}>Sin datos de jornadas</div>}
          </div>}
        </div>;
      })}
    </div>
    {showJForm&&<div className="ov" onClick={()=>setShowJForm(false)}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <h3>🌿 Nuevo jardinero</h3>
        <div className="fg"><label>Nombre *</label><input className="fi" value={jForm.nombre} onChange={e=>setJForm(v=>({...v,nombre:e.target.value}))} placeholder="Ej: Carlos García"/></div>
        <div className="fg"><label>Modalidad</label><select className="fi" value={jForm.modalidad} onChange={e=>setJForm(v=>({...v,modalidad:e.target.value}))}>{MODAL_JARDINERO.map(m=><option key={m}>{m}</option>)}</select></div>
        {jForm.modalidad==="Fijo mensual"&&<div className="fg"><label>Tarifa mensual (€)</label><input type="number" inputMode="decimal" className="fi" value={jForm.tarifa_mensual} onChange={e=>setJForm(v=>({...v,tarifa_mensual:e.target.value}))} placeholder="Ej: 800"/></div>}
        {jForm.modalidad==="Por horas"&&<div className="fg"><label>Tarifa por hora (€)</label><input type="number" inputMode="decimal" className="fi" value={jForm.tarifa_hora} onChange={e=>setJForm(v=>({...v,tarifa_hora:e.target.value}))} placeholder="Ej: 15"/></div>}
        {jForm.modalidad==="Precio fijo por servicio"&&<div style={{fontSize:12,color:"#8A8580",marginBottom:14,background:"rgba(201,168,76,.06)",borderRadius:8,padding:"10px 12px"}}>El precio se define por cada servicio concreto.</div>}
        <div className="fg"><label>Notas (opcional)</label><textarea className="fi" rows={2} value={jForm.notas} onChange={e=>setJForm(v=>({...v,notas:e.target.value}))} placeholder="Notas…"/></div>
        <hr className="div"/>
        <div style={{fontSize:12,color:"#EC683E",fontWeight:700,marginBottom:10,textTransform:"uppercase",letterSpacing:.5}}>Acceso por PIN</div>
        <div className="g2">
          <div className="fg"><label>PIN (4 dígitos) *</label><input className="fi" type="text" inputMode="numeric" maxLength={4} value={jForm.pin} onChange={e=>setJForm(v=>({...v,pin:e.target.value.replace(/\D/g,"").slice(0,4)}))} placeholder="0000" style={{textAlign:"center",fontSize:20,letterSpacing:8}}/></div>
          <div className="fg"><label>Confirmar PIN *</label><input className="fi" type="text" inputMode="numeric" maxLength={4} value={jForm.pinConfirm} onChange={e=>setJForm(v=>({...v,pinConfirm:e.target.value.replace(/\D/g,"").slice(0,4)}))} placeholder="0000" style={{textAlign:"center",fontSize:20,letterSpacing:8}}/></div>
        </div>
        {jForm.pin&&jForm.pinConfirm&&jForm.pin!==jForm.pinConfirm&&<div style={{fontSize:12,color:"#F35757",marginBottom:10}}>Los PINs no coinciden</div>}
        <div className="mft"><button className="btn bg" onClick={()=>setShowJForm(false)}>Cancelar</button><button className="btn bp" onClick={crearJardinero} disabled={saving||!jForm.nombre||jForm.pin.length!==4||jForm.pin!==jForm.pinConfirm}>{saving?"Guardando…":"🌿 Crear"}</button></div>
      </div>
    </div>}
  </>;
}

// ─── LIMPIADORAS PAGE ────────────────────────────────────────────────────────
function LimpiadorasPage({tok,rol}){
  if(rol!=="admin")return null;
  const [limpiadoras,setLimpiadoras]=useState([]);
  const [load,setLoad]=useState(true);
  const [showForm,setShowForm]=useState(false);
  const [form,setForm]=useState({nombre:"",modalidad:"por_horas",tarifa_hora:"",notas:"",pin:"",pinConfirm:""});
  const [saving,setSaving]=useState(false);
  const [anal,setAnal]=useState(null);
  const [analLoad,setAnalLoad]=useState(false);
  const [analData,setAnalData]=useState(null);

  const load_=async()=>{
    try{const l=await sbGet("limpiadoras","?select=*&order=nombre.asc",tok);setLimpiadoras(l);}catch(_){}
    setLoad(false);
  };
  useEffect(()=>{load_();},[]);

  const crear=async()=>{
    if(!form.nombre||!form.pin||form.pin.length!==4||form.pin!==form.pinConfirm||saving)return;
    setSaving(true);
    try{
      const [l]=await sbPost("limpiadoras",{nombre:form.nombre,modalidad:form.modalidad,tarifa_hora:form.modalidad==="por_horas"?parseFloat(form.tarifa_hora)||null:null,notas:form.notas||null,activa:true},tok);
      const [op]=await sbPost("operarios",{nombre:form.nombre,rol:"limpieza",pin:form.pin,referencia_id:l.id,activo:true,avatar:form.nombre.slice(0,2).toUpperCase()},tok);
      await sbPatch("limpiadoras",`id=eq.${l.id}`,{operario_id:op.id},tok).catch(()=>{});
      setShowForm(false);setForm({nombre:"",modalidad:"por_horas",tarifa_hora:"",notas:"",pin:"",pinConfirm:""});await load_();
    }catch(_){}setSaving(false);
  };
  const toggleActiva=async l=>{await sbPatch("limpiadoras",`id=eq.${l.id}`,{activa:!l.activa},tok);await load_();};
  const verAnal=async l=>{
    if(anal?.id===l.id){setAnal(null);return;}
    setAnal(l);setAnalLoad(true);setAnalData(null);
    try{
      const añoActual=new Date().getFullYear();
      const srvs=await sbGet("servicios",`?limpiadora_id=eq.${l.id}&fecha=gte.${añoActual}-01-01&select=*`,tok).catch(()=>[]);
      let horasT=0,costeT=0;const permutas=[];
      for(const s of srvs){
        if(s.hora_inicio&&s.hora_fin){const [h1,m1]=s.hora_inicio.split(":").map(Number);const [h2,m2]=s.hora_fin.split(":").map(Number);horasT+=Math.max(0,(h2+m2/60)-(h1+m1/60));}
        costeT+=parseFloat(s.coste_calculado)||0;
        if(s.modalidad_pago==="permuta")permutas.push(s.permuta_descripcion||`Permuta - ${s.nombre}`);
      }
      setAnalData({totalSrvs:srvs.length,horasTotal:Math.round(horasT*10)/10,costeTotal:Math.round(costeT),euroHoraReal:horasT>0?Math.round(costeT/horasT*100)/100:0,permutas});
    }catch(_){}setAnalLoad(false);
  };

  if(load)return <div className="loading"><div className="spin"/><span>Cargando…</span></div>;
  return <>
    <div className="ph"><h2>👩 Limpiadoras</h2><p>Gestión de limpiadoras y condiciones</p></div>
    <div className="pb">
      <div style={{marginBottom:14}}><button className="btn bp" onClick={()=>{setForm({nombre:"",modalidad:"por_horas",tarifa_hora:"",notas:"",pin:"",pinConfirm:""});setShowForm(true);}}>➕ Nueva limpiadora</button></div>
      {limpiadoras.length===0?<div className="empty"><span className="ico">🧹</span><p>Sin limpiadoras registradas</p></div>
      :limpiadoras.map(l=>{
        const modLbl={por_horas:"Por horas",precio_fijo_servicio:"Precio fijo",permuta:"Permuta"}[l.modalidad]||l.modalidad;
        const tarifaLbl=l.tarifa_hora&&l.modalidad==="por_horas"?`${l.tarifa_hora}€/h`:"—";
        const abierto=anal?.id===l.id;
        return <div key={l.id} className="card" style={{marginBottom:10,borderLeft:`3px solid ${l.activa?"#6366f1":"#5a5e6e"}`,opacity:l.activa?1:.6}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:15,fontWeight:600,color:"#1A1A1A"}}>{l.nombre}</div>
              <div style={{display:"flex",gap:6,marginTop:5,flexWrap:"wrap"}}>
                <span className="badge" style={{background:"rgba(99,102,241,.1)",color:"#a5b4fc"}}>{modLbl}</span>
                <span className="badge" style={{background:"rgba(255,255,255,.06)",color:"#8A8580"}}>{tarifaLbl}</span>
                <span className="badge" style={{background:l.activa?"rgba(16,185,129,.1)":"rgba(107,114,128,.1)",color:l.activa?"#10b981":"#6b7280"}}>{l.activa?"Activa":"Inactiva"}</span>
              </div>
              {l.notas&&<div style={{fontSize:11,color:"#8A8580",marginTop:4}}>{l.notas}</div>}
            </div>
            <div style={{display:"flex",gap:6,flexShrink:0}}>
              <button className="btn bg sm" onClick={()=>verAnal(l)}>{abierto?"▲":"📊"}</button>
              <button className="btn bg sm" onClick={()=>toggleActiva(l)}>{l.activa?"Desactivar":"Activar"}</button>
            </div>
          </div>
          {abierto&&<div style={{marginTop:14,paddingTop:14,borderTop:"1px solid rgba(255,255,255,.06)"}}>
            {analLoad?<div style={{color:"#8A8580",fontSize:13}}>Cargando…</div>
            :analData?<>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:8,marginBottom:10}}>
                {[{l:"SERVICIOS AÑO",v:analData.totalSrvs,c:"#c9a84c"},{l:"HORAS TOTAL",v:`${analData.horasTotal}h`,c:"#c9a84c"},{l:"COSTE TOTAL",v:`${analData.costeTotal}€`,c:"#e85555"},{l:"💡 €/HORA REAL",v:analData.euroHoraReal>0?`${analData.euroHoraReal}€`:"—",c:"#6366f1"}].map(x=>(
                  <div key={x.l} style={{background:"#F5F3F0",borderRadius:8,padding:"10px 12px"}}><div style={{fontSize:10,color:"#8A8580"}}>{x.l}</div><div style={{fontSize:18,fontWeight:700,color:x.c,marginTop:3}}>{x.v}</div></div>
                ))}
              </div>
              {analData.permutas.length>0&&<div style={{marginTop:8}}>
                <div style={{fontSize:10,color:"#EC683E",fontWeight:600,textTransform:"uppercase",letterSpacing:.5,marginBottom:6}}>Permutas</div>
                {analData.permutas.map((p,i)=><div key={i} style={{fontSize:12,color:"#8A8580",padding:"4px 0"}}>🔄 {p}</div>)}
              </div>}
            </>:<div style={{color:"#8A8580",fontSize:13}}>Sin datos</div>}
          </div>}
        </div>;
      })}
    </div>
    {showForm&&<div className="ov" onClick={()=>setShowForm(false)}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <h3>🧹 Nueva limpiadora</h3>
        <div className="fg"><label>Nombre *</label><input className="fi" value={form.nombre} onChange={e=>setForm(v=>({...v,nombre:e.target.value}))} placeholder="Ej: María López"/></div>
        <div className="fg"><label>Modalidad</label><select className="fi" value={form.modalidad} onChange={e=>setForm(v=>({...v,modalidad:e.target.value}))}>
          <option value="por_horas">Por horas</option><option value="precio_fijo_servicio">Precio fijo por servicio</option><option value="permuta">Permuta</option>
        </select></div>
        {form.modalidad==="por_horas"&&<div className="fg"><label>Tarifa €/hora</label><input type="number" inputMode="decimal" className="fi" value={form.tarifa_hora} onChange={e=>setForm(v=>({...v,tarifa_hora:e.target.value}))} placeholder="Ej: 12"/></div>}
        <div className="fg"><label>Notas (opcional)</label><textarea className="fi" rows={2} value={form.notas} onChange={e=>setForm(v=>({...v,notas:e.target.value}))} placeholder="Notas…"/></div>
        <hr className="div"/>
        <div style={{fontSize:12,color:"#EC683E",fontWeight:700,marginBottom:10,textTransform:"uppercase",letterSpacing:.5}}>Acceso por PIN</div>
        <div className="g2">
          <div className="fg"><label>PIN (4 dígitos) *</label><input className="fi" type="text" inputMode="numeric" maxLength={4} value={form.pin} onChange={e=>setForm(v=>({...v,pin:e.target.value.replace(/\D/g,"").slice(0,4)}))} placeholder="0000" style={{textAlign:"center",fontSize:20,letterSpacing:8}}/></div>
          <div className="fg"><label>Confirmar PIN *</label><input className="fi" type="text" inputMode="numeric" maxLength={4} value={form.pinConfirm} onChange={e=>setForm(v=>({...v,pinConfirm:e.target.value.replace(/\D/g,"").slice(0,4)}))} placeholder="0000" style={{textAlign:"center",fontSize:20,letterSpacing:8}}/></div>
        </div>
        {form.pin&&form.pinConfirm&&form.pin!==form.pinConfirm&&<div style={{fontSize:12,color:"#F35757",marginBottom:10}}>Los PINs no coinciden</div>}
        <div className="mft"><button className="btn bg" onClick={()=>setShowForm(false)}>Cancelar</button><button className="btn bp" onClick={crear} disabled={saving||!form.nombre||form.pin.length!==4||form.pin!==form.pinConfirm}>{saving?"Guardando…":"🧹 Crear"}</button></div>
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
        <span style={{color:"#8A8580",fontSize:12}}>→</span>
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
          <div style={{fontSize:10,color:"#F35757",textTransform:"uppercase",letterSpacing:.5}}>Total período</div>
          <div style={{fontSize:22,fontWeight:700,color:"#F35757",fontFamily:"'Inter Tight',sans-serif"}}>{total.toLocaleString("es-ES",{minimumFractionDigits:0,maximumFractionDigits:2})}€</div>
          <div style={{fontSize:11,color:"#8A8580"}}>{filtrados.length} gasto{filtrados.length!==1?"s":""}</div>
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
              <div style={{fontSize:14,fontWeight:600,color:"#1A1A1A",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{g.concepto}</div>
              <div style={{display:"flex",gap:6,marginTop:5,flexWrap:"wrap"}}>
                <span className="badge" style={{background:"rgba(232,85,85,.1)",color:"#F35757"}}>{g.categoria||"Sin categoría"}</span>
                {g.recurrente&&<span className="badge" style={{background:"rgba(201,168,76,.1)",color:"#EC683E"}}>🔁 {g.frecuencia||"mensual"}</span>}
                {olbl&&<span className="badge" style={{background:"rgba(99,102,241,.1)",color:"#a5b4fc"}}>{olbl}</span>}
              </div>
              <div style={{fontSize:11,color:"#8A8580",marginTop:4}}>📅 {new Date(g.fecha+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"long",year:"numeric"})}</div>
              {g.notas&&<div style={{fontSize:11,color:"#8A8580",marginTop:3}}>{g.notas}</div>}
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontSize:18,fontWeight:700,color:"#F35757",fontFamily:"'Inter Tight',sans-serif"}}>{parseFloat(g.importe||0).toLocaleString("es-ES")}€</div>
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
          <span style={{fontSize:13,color:"#1A1A1A"}}>¿Es recurrente?</span>
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

// ─── AJUSTES ────────────────────────────────────────────────────────────────
const CONFIG_FIELDS=[
  {clave:"tarifa_hora_limpiadora",label:"Tarifa hora limpiadora",desc:"€/hora para cálculo automático",type:"number",placeholder:"Ej: 12"},
  {clave:"tarifa_hora_jardinero",label:"Tarifa hora jardinero",desc:"€/hora referencia",type:"number",placeholder:"Ej: 15"},
  {clave:"comision_pct",label:"Comisión gestor (%)",desc:"% sobre facturación, default 10",type:"number",placeholder:"10"},
  {clave:"facturacion_2025",label:"Facturación total 2025 (€)",desc:"Dato histórico para comparativa anual",type:"number",placeholder:"Ej: 50000"},
];

function Ajustes({tok,rol}){
  if(rol!=="admin")return null;
  const [valores,setValores]=useState({});
  const [load,setLoad]=useState(true);
  const [savingKey,setSavingKey]=useState(null);
  const [feedback,setFeedback]=useState({});
  const [notifPerm,setNotifPerm]=useState(typeof Notification!=="undefined"?Notification.permission:"default");

  useEffect(()=>{
    (async()=>{
      try{
        const rows=await sbGet("configuracion","?select=*",tok);
        const v={};rows.forEach(r=>v[r.clave]=r.valor||"");
        setValores(v);
      }catch(_){}
      setLoad(false);
    })();
  },[]);

  const guardar=async(clave)=>{
    setSavingKey(clave);setFeedback(prev=>({...prev,[clave]:null}));
    try{
      const valor=valores[clave]||"";
      // Upsert: try patch first, then insert
      const existing=await sbGet("configuracion",`?clave=eq.${clave}&select=id`,tok).catch(()=>[]);
      if(existing.length>0){
        await sbPatch("configuracion",`clave=eq.${clave}`,{valor},tok);
      }else{
        await sbPost("configuracion",{clave,valor},tok);
      }
      setFeedback(prev=>({...prev,[clave]:"ok"}));
      setTimeout(()=>setFeedback(prev=>({...prev,[clave]:null})),2000);
    }catch(_){
      setFeedback(prev=>({...prev,[clave]:"error"}));
      setTimeout(()=>setFeedback(prev=>({...prev,[clave]:null})),3000);
    }
    setSavingKey(null);
  };

  const activarNotifs=async()=>{
    const p=await askPerm();
    setNotifPerm(p);
  };

  if(load)return <div className="loading"><div className="spin"/><span>Cargando…</span></div>;

  return <>
    <div className="ph"><h2>⚙️ Ajustes</h2><p>Configuración del sistema</p></div>
    <div className="pb" style={{maxWidth:600}}>
      {/* CONFIGURACIÓN FINANCIERA */}
      <div className="card" style={{marginBottom:16}}>
        <div className="chdr"><span className="ctit">💰 Configuración financiera</span></div>
        {CONFIG_FIELDS.map(f=>(
          <div key={f.clave} style={{marginBottom:16,paddingBottom:16,borderBottom:"1px solid rgba(255,255,255,.06)"}}>
            <div className="fg" style={{marginBottom:8}}>
              <label>{f.label}</label>
              <div style={{fontSize:11,color:"#8A8580",marginBottom:6}}>{f.desc}</div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <input type={f.type} inputMode={f.type==="number"?"decimal":"text"} className="fi" value={valores[f.clave]||""} onChange={e=>setValores(prev=>({...prev,[f.clave]:e.target.value}))} placeholder={f.placeholder} style={{flex:1}}/>
                <button className="btn bp sm" style={{flexShrink:0}} onClick={()=>guardar(f.clave)} disabled={savingKey===f.clave}>
                  {savingKey===f.clave?"…":"Guardar"}
                </button>
              </div>
            </div>
            {feedback[f.clave]==="ok"&&<div style={{fontSize:12,color:"#A6BE59",marginTop:4}}>✅ Guardado</div>}
            {feedback[f.clave]==="error"&&<div style={{fontSize:12,color:"#F35757",marginTop:4}}>❌ Error al guardar</div>}
          </div>
        ))}
      </div>

      {/* NOTIFICACIONES */}
      <div className="card">
        <div className="chdr"><span className="ctit">🔔 Notificaciones</span></div>
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0"}}>
          <span style={{fontSize:24}}>{notifPerm==="granted"?"✅":"⚠️"}</span>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:500,color:notifPerm==="granted"?"#10b981":"#f59e0b"}}>{notifPerm==="granted"?"Notificaciones activas":"Notificaciones desactivadas"}</div>
            <div style={{fontSize:12,color:"#8A8580",marginTop:2}}>{notifPerm==="granted"?"Recibirás avisos en este dispositivo":"Activa las notificaciones para recibir avisos de la finca"}</div>
          </div>
          {notifPerm!=="granted"&&<button className="btn bp" onClick={activarNotifs}>Activar</button>}
        </div>
      </div>
    </div>
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
    {(isA||isC)&&<div style={{background:"#FFFFFF",border:"1px solid rgba(201,168,76,.2)",borderRadius:12,padding:"14px 16px",marginBottom:14}}>
      <div style={{fontSize:11,color:"#EC683E",textTransform:"uppercase",letterSpacing:1,fontWeight:600,marginBottom:10}}>🔍 Consultar disponibilidad</div>
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
            <div style={{fontSize:13,color:"#F35757"}}>🔴 Fecha bloqueada</div>
          )}
          {/* Admin: muestra todo */}
          {isA&&resultadoBusqueda.reservas.map(r=>{
            const est=ESTADOS.find(e=>e.id===r.estado);
            return <div key={r.id} style={{display:"flex",justifyContent:"space-between",gap:8,marginTop:6,paddingTop:6,borderTop:"1px solid rgba(255,255,255,.06)"}}>
              <div><div style={{fontSize:13,fontWeight:600,color:"#1A1A1A"}}>{r.nombre}</div>{r.tipo&&<div style={{fontSize:11,color:"#8A8580"}}>🎉 {r.tipo}</div>}</div>
              {est&&<span className="badge" style={{background:`${est.col}18`,color:est.col,border:`1px solid ${est.col}30`,flexShrink:0}}>{est.lbl}</span>}
            </div>;
          })}
          {isA&&resultadoBusqueda.airbnbs.map(a=>(
            <div key={a.id} style={{display:"flex",justifyContent:"space-between",gap:8,marginTop:6,paddingTop:6,borderTop:"1px solid rgba(255,255,255,.06)"}}>
              <div><div style={{fontSize:13,fontWeight:600,color:"#1A1A1A"}}>🏠 {a.huesped}</div><div style={{fontSize:11,color:"#8A8580"}}>{fmtRango(a)}</div></div>
              <span className="badge" style={{background:"rgba(16,185,129,.12)",color:"#A6BE59",border:"1px solid rgba(16,185,129,.25)",flexShrink:0}}>Airbnb</span>
            </div>
          ))}
          {/* Comercial: muestra evento pero no airbnb info */}
          {isC&&resultadoBusqueda.reservas.map(r=>{
            const est=ESTADOS.find(e=>e.id===r.estado);
            return <div key={r.id} style={{display:"flex",justifyContent:"space-between",gap:8,marginTop:6,paddingTop:6,borderTop:"1px solid rgba(255,255,255,.06)"}}>
              <div><div style={{fontSize:13,fontWeight:600,color:"#1A1A1A"}}>{r.nombre}</div>{r.tipo&&<div style={{fontSize:11,color:"#8A8580"}}>🎉 {r.tipo}</div>}</div>
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
            {hasAir&&!hasRsv&&<div className="cdot" style={{background:"#F35757"}}/>}
            {hasAir&&hasRsv&&<div style={{display:"flex",gap:2,marginTop:2}}><div className="cdot" style={{background:ESTADOS.find(e=>e.id===rsv[0].estado)?.col||"#6366f1"}}/><div className="cdot" style={{background:"#F35757"}}/></div>}
          </div>;
        })}
      </div>
    </div>

    {/* LEYENDA */}
    <div style={{display:"flex",gap:12,marginTop:8,marginBottom:4,flexWrap:"wrap"}}>
      <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"#8A8580"}}><div style={{width:8,height:8,borderRadius:"50%",background:"#6366f1"}}/> Evento</div>
      {(isA||isL||isJ)&&<div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"#8A8580"}}><div style={{width:8,height:8,borderRadius:"50%",background:"#F35757"}}/> {isC?"Bloqueado":"Airbnb"}</div>}
      {isC&&<div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"#8A8580"}}><div style={{width:8,height:8,borderRadius:"50%",background:"#F35757"}}/> No disponible</div>}
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
              <div style={{fontSize:14,fontWeight:600,color:"#1A1A1A"}}>{r.nombre}</div>
              {r.tipo&&<div style={{fontSize:12,color:"#8A8580",marginTop:3}}>🎉 {r.tipo}</div>}
              {isA&&r.precio&&<div style={{fontSize:12,color:"#EC683E",marginTop:2}}>💰 {parseFloat(r.precio).toLocaleString("es-ES")}€</div>}
            </div>
            {est&&<span className="badge" style={{background:`${est.col}18`,color:est.col,border:`1px solid ${est.col}30`,flexShrink:0}}>{est.lbl}</span>}
          </div>
        </div>;
      })}
      {/* Airbnb del día — admin y limpieza ven info, comercial ve bloqueado, jardinero ve rango */}
      {grAirbnb(sel).map(a=>(
        isC
          ?<div key={a.id} className="card" style={{marginBottom:8,borderLeft:"3px solid #e85555"}}>
            <div style={{fontSize:14,fontWeight:600,color:"#F35757"}}>🔴 Fecha no disponible</div>
          </div>
          :<div key={a.id} className="card" style={{marginBottom:8,borderLeft:"3px solid #10b981"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
              <div>
                <div style={{fontSize:12,color:"#A6BE59",fontWeight:600,marginBottom:3}}>🏠 Airbnb</div>
                {(isA||isL)&&<div style={{fontSize:14,fontWeight:600,color:"#1A1A1A"}}>{a.huesped}</div>}
                {isJ&&<div style={{fontSize:14,fontWeight:600,color:"#1A1A1A"}}>Alojamiento turístico</div>}
                <div style={{fontSize:12,color:"#8A8580",marginTop:3}}>📅 {fmtRango(a)}{a.personas?` · 👥 ${a.personas} personas`:""}</div>
                {isA&&a.precio&&<div style={{fontSize:12,color:"#EC683E",marginTop:2}}>💰 {parseFloat(a.precio).toLocaleString("es-ES")}€</div>}
              </div>
              <span className="badge" style={{background:"rgba(16,185,129,.12)",color:"#A6BE59",border:"1px solid rgba(16,185,129,.25)",flexShrink:0}}>Airbnb</span>
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
            <div style={{fontSize:13,fontWeight:600,color:"#1A1A1A"}}>{r.nombre}</div>
            <div style={{fontSize:12,color:"#8A8580",marginTop:3}}>📅 {new Date(r.fecha).toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"})}</div>
            {r.tipo&&<div style={{fontSize:11,color:"#8A8580",marginTop:2}}>🎉 {r.tipo}</div>}
          </div>)}
          {airbnbMes.map(a=><div key={a.id} className="card" style={{marginBottom:8,borderLeft:"3px solid #10b981"}}>
            <div style={{fontSize:13,fontWeight:600,color:"#1A1A1A"}}>{isL?`🏠 Airbnb: ${a.huesped}`:"🏠 Alojamiento turístico"}</div>
            <div style={{fontSize:12,color:"#8A8580",marginTop:3}}>📅 {fmtRango(a)}{a.personas?` · 👥 ${a.personas} personas`:""}</div>
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
    <button onClick={()=>setOpen(!open)} style={{background:"none",border:"none",cursor:"pointer",color:"#8A8580",fontSize:13,display:"flex",alignItems:"center",gap:6,padding:0,fontFamily:"'DM Sans',sans-serif",width:"100%",justifyContent:"space-between"}}>
      <span>📋 Historial de movimientos</span>
      <span style={{transition:"transform .2s",transform:open?"rotate(90deg)":"none",fontSize:16}}>›</span>
    </button>
    {open&&<div style={{marginTop:12}}>
      {load?<div style={{color:"#8A8580",fontSize:13,padding:"8px 0"}}>Cargando…</div>
        :items.length===0?<div style={{color:"#BFBAB4",fontSize:13,padding:"8px 0",fontStyle:"italic"}}>Sin movimientos registrados</div>
        :<div style={{position:"relative",paddingLeft:20}}>
          <div style={{position:"absolute",left:7,top:0,bottom:0,width:1,background:"rgba(255,255,255,.08)"}}/>
          {items.map((h,i)=>(
            <div key={h.id} style={{position:"relative",marginBottom:12}}>
              <div style={{position:"absolute",left:-20,top:2,width:14,height:14,borderRadius:"50%",background:h.tipo==="manual"?"#c9a84c":"#3d4155",border:"2px solid #0f1117",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8}}/>
              <div style={{fontSize:12,color:h.tipo==="manual"?"#c9c5b8":"#7a7f94",lineHeight:1.4}}>{iconTipo(h.texto)} {h.texto}</div>
              <div style={{fontSize:10,color:"#BFBAB4",marginTop:2}}>{fmtDT(h.created_at)}{h.creado_por&&` · ${h.creado_por}`}</div>
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
    <button onClick={()=>setOpen(!open)} style={{background:"none",border:"none",cursor:"pointer",color:"#8A8580",fontSize:13,display:"flex",alignItems:"center",gap:6,padding:0,fontFamily:"'DM Sans',sans-serif",width:"100%",justifyContent:"space-between"}}>
      <span>📁 Documentos {docs.length>0&&!open?`(${docs.length})`:""}</span>
      <span style={{transition:"transform .2s",transform:open?"rotate(90deg)":"none",fontSize:16}}>›</span>
    </button>
    {open&&<div style={{marginTop:12}}>
      {load?<div style={{color:"#8A8580",fontSize:13}}>Cargando…</div>
        :docs.length===0?<div style={{color:"#BFBAB4",fontSize:13,fontStyle:"italic",marginBottom:10}}>Sin documentos adjuntos</div>
        :<div style={{marginBottom:10}}>
          {docs.map(doc=>(
            <div key={doc.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:"#F5F3F0",borderRadius:8,marginBottom:6}}>
              <span style={{fontSize:18,flexShrink:0}}>{icono(doc.tipo_archivo)}</span>
              <div style={{flex:1,minWidth:0}}>
                <a href={doc.url} target="_blank" rel="noreferrer" style={{fontSize:13,color:"#EC683E",textDecoration:"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"block"}}>{doc.nombre}</a>
                <div style={{fontSize:10,color:"#BFBAB4"}}>{doc.subido_por} · {fmtDT(doc.created_at)}</div>
              </div>
              <button onClick={()=>eliminar(doc)} style={{background:"none",border:"none",color:"#8A8580",cursor:"pointer",fontSize:16,padding:4,flexShrink:0}}>🗑</button>
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

// ─── VISITAS COORDINACIÓN (en detalle reserva) ──────────────────────────────
const MOTIVOS_COORD=["Catering","DJ","Florista","Decoración","Fotografía","Reconocimiento general","Otro"];

function VisitasCoordinacion({reservaId,reservaNombre,tok,perfil}){
  const [visitas,setVisitas]=useState([]);
  const [open,setOpen]=useState(false);
  const [showForm,setShowForm]=useState(false);
  const [saving,setSaving]=useState(false);
  const [load,setLoad]=useState(false);
  const formVacio={fecha:new Date().toISOString().split("T")[0],hora:"10:00",motivo:"Catering",asistentes:"",notas:""};
  const [form,setForm]=useState(formVacio);

  const cargar=async()=>{
    setLoad(true);
    try{const v=await sbGet("visitas",`?reserva_id=eq.${reservaId}&order=fecha.asc,hora.asc`,tok);setVisitas(v);}catch(_){}
    setLoad(false);
  };
  useEffect(()=>{if(open)cargar();},[open]);

  const crear=async()=>{
    if(!form.fecha||!form.hora||saving)return;
    setSaving(true);
    try{
      await sbPost("visitas",{
        nombre:`${reservaNombre} - ${form.motivo}`,
        fecha:form.fecha,hora:form.hora,
        tipo_evento:form.motivo,
        motivo_visita:form.motivo,
        nota:form.notas?`${form.asistentes?`Asistentes: ${form.asistentes}. `:""}${form.notas}`:form.asistentes||null,
        telefono:"",email:"",invitados:null,
        estado:"pendiente",
        reserva_id:reservaId,
        es_coordinacion:true,
        creado_por:perfil.nombre
      },tok);
      const fechaFmt=new Date(form.fecha+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"long"});
      await addHistorial("reserva",reservaId,`Visita de coordinación programada: ${form.motivo} el ${fechaFmt} a las ${form.hora}`,perfil.nombre,tok);
      setShowForm(false);setForm(formVacio);await cargar();
    }catch(_){}
    setSaving(false);
  };

  return <div style={{marginTop:16,borderTop:"1px solid rgba(255,255,255,.06)",paddingTop:14}}>
    <button onClick={()=>setOpen(!open)} style={{background:"none",border:"none",cursor:"pointer",color:"#8A8580",fontSize:13,display:"flex",alignItems:"center",gap:6,padding:0,fontFamily:"'DM Sans',sans-serif",width:"100%",justifyContent:"space-between"}}>
      <span>📅 Visitas de coordinación {visitas.length>0&&!open?`(${visitas.length})`:""}</span>
      <span style={{transition:"transform .2s",transform:open?"rotate(90deg)":"none",fontSize:16}}>›</span>
    </button>
    {open&&<div style={{marginTop:12}}>
      {load?<div style={{color:"#8A8580",fontSize:13}}>Cargando…</div>
      :visitas.length===0?<div style={{color:"#BFBAB4",fontSize:13,fontStyle:"italic",marginBottom:10}}>Sin visitas de coordinación</div>
      :<div style={{marginBottom:10}}>
        {visitas.map(v=>{
          const est=ESTADOS_VISITA[v.estado]||ESTADOS_VISITA.pendiente;
          return <div key={v.id} style={{display:"flex",alignItems:"flex-start",gap:8,padding:"8px 10px",background:"#F5F3F0",borderRadius:8,marginBottom:6,borderLeft:`3px solid ${est.col}`}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:3}}>
                <span className="badge" style={{background:"rgba(99,102,241,.1)",color:"#a5b4fc",fontSize:10}}>{v.motivo_visita||v.tipo_evento||"Coordinación"}</span>
                <span className="badge" style={{background:`${est.col}18`,color:est.col,fontSize:10}}>{est.lbl}</span>
              </div>
              <div style={{fontSize:12,color:"#1A1A1A"}}>{new Date(v.fecha+"T12:00:00").toLocaleDateString("es-ES",{weekday:"short",day:"numeric",month:"short"})} · {v.hora?.slice(0,5)||"—"}</div>
              {v.nota&&<div style={{fontSize:11,color:"#8A8580",marginTop:3}}>{v.nota}</div>}
            </div>
          </div>;
        })}
      </div>}
      <button className="btn bp sm" onClick={()=>{setForm(formVacio);setShowForm(true);}}>➕ Programar visita</button>

      {showForm&&<div style={{marginTop:12,background:"rgba(201,168,76,.04)",border:"1px solid rgba(201,168,76,.15)",borderRadius:10,padding:"14px"}}>
        <div style={{fontSize:13,fontWeight:600,color:"#EC683E",marginBottom:12}}>📅 Nueva visita de coordinación</div>
        <div style={{display:"flex",gap:8}}>
          <div className="fg" style={{flex:1}}><label>Fecha *</label><input type="date" className="fi" value={form.fecha} onChange={e=>setForm(v=>({...v,fecha:e.target.value}))}/></div>
          <div className="fg" style={{flex:1}}><label>Hora *</label><input type="time" className="fi" value={form.hora} onChange={e=>setForm(v=>({...v,hora:e.target.value}))}/></div>
        </div>
        <div className="fg"><label>Motivo</label><select className="fi" value={form.motivo} onChange={e=>setForm(v=>({...v,motivo:e.target.value}))}>{MOTIVOS_COORD.map(m=><option key={m}>{m}</option>)}</select></div>
        <div className="fg"><label>Asistentes</label><input className="fi" value={form.asistentes} onChange={e=>setForm(v=>({...v,asistentes:e.target.value}))} placeholder="Ej: Catering La Huerta — Pedro García"/></div>
        <div className="fg"><label>Notas</label><textarea className="fi" rows={2} value={form.notas} onChange={e=>setForm(v=>({...v,notas:e.target.value}))} placeholder="Notas adicionales…"/></div>
        <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
          <button className="btn bg sm" onClick={()=>setShowForm(false)}>Cancelar</button>
          <button className="btn bp sm" onClick={crear} disabled={saving||!form.fecha||!form.hora}>{saving?"Guardando…":"✓ Programar"}</button>
        </div>
      </div>}
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
    const r=reservas.find(x=>x.id===id);
    if(r)notificarRoles(["admin","comercial"],`📋 Reserva actualizada`,`${r.nombre}: ${est?.lbl||e}`,"reserva-estado",tok);
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

  const renderRCard=(r)=>{
    const est=ESTADOS.find(e=>e.id===r.estado);
    return <div key={r.id} className="rc" style={{borderLeftColor:est?.col}} onClick={()=>setSel(r)}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
        <div style={{minWidth:0}}>
          <div style={{fontSize:14,fontWeight:600,color:"#1A1A1A",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.nombre}</div>
          <div style={{fontSize:11,color:"#8A8580",marginTop:3}}>📅 {new Date(r.fecha).toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>
          {r.tipo&&<div style={{fontSize:11,color:"#8A8580"}}>🎉 {r.tipo}</div>}
        </div>
        <div style={{textAlign:"right",flexShrink:0}}>
          <div style={{fontSize:16,fontWeight:700,color:"#EC683E"}}>{parseFloat(r.precio||0).toLocaleString("es-ES")}€</div>
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
            :lista.map(r=>renderRCard(r))}
        </div>
        {sel&&<div className="card detail-panel" style={{position:"sticky",top:20}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:16,gap:8}}>
            <div style={{minWidth:0}}><div style={{fontSize:18,fontWeight:700,color:"#1A1A1A",fontFamily:"'Inter Tight',sans-serif"}}>{sel.nombre}</div><SBadge e={sel.estado}/></div>
            <button className="btn bg sm" style={{flexShrink:0}} onClick={()=>setSel(null)}>✕</button>
          </div>
          <div className="g2" style={{marginBottom:14}}>
            {[{l:"FECHA",v:new Date(sel.fecha).toLocaleDateString("es-ES",{day:"numeric",month:"long",year:"numeric"})},{l:"PRECIO",v:`${parseFloat(sel.precio||0).toLocaleString("es-ES")}€`,gold:true},{l:"TIPO",v:sel.tipo},{l:"CONTACTO",v:sel.contacto}].filter(x=>x.v).map(x=><div key={x.l} style={{background:"#F5F3F0",borderRadius:8,padding:11}}><div style={{fontSize:10,color:"#8A8580"}}>{x.l}</div><div style={{fontSize:x.gold?16:12,fontWeight:x.gold?700:400,color:x.gold?"#c9a84c":"#e8e6e1",marginTop:3}}>{x.v}</div></div>)}
          </div>
          {sel.obs&&<div style={{background:"#F5F3F0",borderRadius:8,padding:11,marginBottom:14}}><div style={{fontSize:10,color:"#8A8580",marginBottom:5}}>OBSERVACIONES</div><div style={{fontSize:12,color:"#1A1A1A",lineHeight:1.5}}>{sel.obs}</div></div>}
          {isA&&<><hr className="div"/>
            <div style={{fontSize:10,color:"#8A8580",marginBottom:9,textTransform:"uppercase",letterSpacing:1}}>Cambiar estado</div>
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              {ESTADOS.map(e=><button key={e.id} className="btn bg" style={{justifyContent:"flex-start",borderColor:sel.estado===e.id?e.col:undefined,color:sel.estado===e.id?e.col:undefined}} onClick={()=>cambiarE(sel.id,e.id)}>
                <span style={{width:7,height:7,borderRadius:"50%",background:e.col,display:"inline-block",flexShrink:0}}/>{e.lbl}{sel.estado===e.id?" ✓":""}
              </button>)}
            </div>
            <hr className="div"/>
            <button className="btn br" style={{width:"100%",justifyContent:"center"}} onClick={()=>del(sel.id)}>🗑 Eliminar reserva</button>
            {/* ── CONTROLES DE COBRO ── */}
            <hr className="div"/>
            <div style={{fontSize:10,color:"#8A8580",marginBottom:9,textTransform:"uppercase",letterSpacing:1}}>Estado de cobro</div>
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
                {ep==="seña_cobrada"&&<div style={{fontSize:12,color:"#8A8580",marginBottom:10}}>Saldo pendiente: <strong style={{color:"#D4A017"}}>{(pt-seña).toLocaleString("es-ES")}€</strong></div>}
                {sel.seña_fecha&&<div style={{fontSize:11,color:"#8A8580",marginBottom:4}}>Seña registrada: {new Date(sel.seña_fecha+"T12:00:00").toLocaleDateString("es-ES")}</div>}
                {sel.saldo_fecha&&<div style={{fontSize:11,color:"#8A8580",marginBottom:4}}>Saldo registrado: {new Date(sel.saldo_fecha+"T12:00:00").toLocaleDateString("es-ES")}</div>}
                {/* Botón registrar seña */}
                {(ep==="pendiente"||!sel.estado_pago)&&sel.estado!=="cancelada"&&sel.estado!=="finalizada"&&(
                  <button className="btn bp" style={{width:"100%",justifyContent:"center",marginTop:6}} onClick={()=>{setSeñaImporte("");setShowSeña(true);}}>💰 Registrar seña cobrada</button>
                )}
                {/* Botón registrar pago total */}
                {ep==="seña_cobrada"&&(
                  <button className="btn bp" style={{width:"100%",justifyContent:"center",marginTop:6,background:"#A6BE59"}} onClick={()=>setShowPagoTotal(true)}>✅ Registrar pago total</button>
                )}
              </>;
            })()}
          </>}
          <Historial entidad_tipo="reserva" entidad_id={sel.id} tok={tok} perfil={perfil||{nombre:"Admin"}}/>
          <Documentos entidad_tipo="reserva" entidad_id={sel.id} tok={tok} perfil={perfil||{nombre:"Admin"}}/>
          <VisitasCoordinacion reservaId={sel.id} reservaNombre={sel.nombre} tok={tok} perfil={perfil||{nombre:"Admin"}}/>
        </div>}
      </div>
    </div>
    {/* MODAL SEÑA */}
    {showSeña&&sel&&<div className="ov" onClick={()=>setShowSeña(false)}>
      <div className="modal" style={{maxWidth:400}} onClick={e=>e.stopPropagation()}>
        <h3>💰 Registrar seña cobrada</h3>
        <div style={{background:"rgba(201,168,76,.06)",border:"1px solid rgba(201,168,76,.15)",borderRadius:10,padding:"12px 14px",marginBottom:16}}>
          <div style={{fontSize:13,color:"#EC683E",fontWeight:600}}>{sel.nombre}</div>
          <div style={{fontSize:12,color:"#8A8580",marginTop:3}}>Precio total: {(parseFloat(sel.precio_total)||parseFloat(sel.precio)||0).toLocaleString("es-ES")}€</div>
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
          <div style={{fontSize:13,color:"#EC683E",fontWeight:600}}>{sel.nombre}</div>
          {(()=>{const pt=parseFloat(sel.precio_total)||parseFloat(sel.precio)||0;const seña=parseFloat(sel.seña_importe)||0;return <>
            <div style={{fontSize:12,color:"#8A8580",marginTop:6}}>Precio total: <strong style={{color:"#1A1A1A"}}>{pt.toLocaleString("es-ES")}€</strong></div>
            <div style={{fontSize:12,color:"#8A8580",marginTop:3}}>Seña cobrada: <strong style={{color:"#A6BE59"}}>−{seña.toLocaleString("es-ES")}€</strong></div>
            <hr className="div"/>
            <div style={{fontSize:16,fontWeight:700,color:"#EC683E"}}>Saldo pendiente: {(pt-seña).toLocaleString("es-ES")}€</div>
          </>;})()}
        </div>
        <div style={{background:"rgba(16,185,129,.06)",border:"1px solid rgba(16,185,129,.15)",borderRadius:8,padding:"10px 12px",marginBottom:14,fontSize:12,color:"#A6BE59"}}>
          ✅ Se generará automáticamente el gasto de comisión del gestor
        </div>
        <div className="mft">
          <button className="btn bg" onClick={()=>setShowPagoTotal(false)}>Cancelar</button>
          <button className="btn bp" style={{background:"#A6BE59"}} onClick={registrarPagoTotal} disabled={cobroSaving}>{cobroSaving?"Procesando…":"✅ Confirmar pago completo"}</button>
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
      const en7=new Date();en7.setDate(en7.getDate()+7);
      if(form.fecha&&form.fecha<=en7.toISOString().split("T")[0]){
        notificarRoles(["admin","comercial","limpieza","jardinero"],"🎉 Nuevo evento",`${form.nombre} el ${new Date(form.fecha+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"long"})}`,"evento-nuevo",tok);
      }
      setOk(true);setTimeout(()=>{setOk(false);setPage("reservas");},2000);
      setForm({nombre:"",fecha:"",tipo:"Boda",precio:"",contacto:"",obs:"",estado:"visita"});
    }catch(_){}setSaving(false);
  };
  return <>
    <div className="ph"><h2>Nueva reserva</h2></div>
    <div className="pb"><div style={{maxWidth:600}}>
      {ok&&<div style={{background:"rgba(16,185,129,.1)",border:"1px solid rgba(16,185,129,.3)",borderRadius:10,padding:"12px 15px",marginBottom:16,color:"#A6BE59",fontSize:13}}>✅ Reserva creada. Redirigiendo…</div>}
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
  const [reservasMap,setReservasMap]=useState({});
  const [load,setLoad]=useState(true);
  const [tab,setTab]=useState("proximas");
  const [filtroTipo,setFiltroTipo]=useState("todas");
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
    try{
      const v=await sbGet("visitas","?select=*&order=fecha.asc,hora.asc",tok);
      setVisitas(v);
      // Load reserva names for coordinacion visitas
      const coordIds=[...new Set(v.filter(x=>x.es_coordinacion&&x.reserva_id).map(x=>x.reserva_id))];
      if(coordIds.length>0){
        const rsvs=await sbGet("reservas",`?id=in.(${coordIds.join(",")})&select=id,nombre`,tok).catch(()=>[]);
        const m={};rsvs.forEach(r=>m[r.id]=r.nombre);setReservasMap(m);
      }
    }catch(_){}
    setLoad(false);
  };
  useEffect(()=>{load_();},[]);

  const filtrarTipo=arr=>{
    if(filtroTipo==="captacion")return arr.filter(v=>!v.es_coordinacion);
    if(filtroTipo==="coordinacion")return arr.filter(v=>v.es_coordinacion);
    return arr;
  };
  const proximas=filtrarTipo(visitas.filter(v=>v.estado==="pendiente"));
  const anteriores=filtrarTipo(visitas.filter(v=>v.estado!=="pendiente"));

  const [bloqueado,setBloqueado]=useState(null); // {conflictos}

  const crearVisita=async()=>{
    if(!form.nombre||!form.fecha||!form.hora||saving)return;
    setSaving(true);
    try{
      const disp=await checkDisponibilidad(form.fecha,tok);
      if(!disp.libre){setSaving(false);setShowForm(false);setBloqueado(disp.conflictos);return;}
      const [v]=await sbPost("visitas",{...form,invitados:parseInt(form.invitados)||null,estado:"pendiente",creado_por:perfil.nombre},tok);
      await addHistorial("visita",v.id,`Visita registrada para el ${new Date(form.fecha+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"long",year:"numeric"})} a las ${form.hora}`,perfil.nombre,tok);
      const en7=new Date();en7.setDate(en7.getDate()+7);
      if(form.fecha&&form.fecha<=en7.toISOString().split("T")[0]){
        notificarRoles(["admin","comercial"],"👁 Nueva visita",`${form.nombre} el ${new Date(form.fecha+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"long"})} a las ${form.hora}`,"visita-nueva",tok);
      }
      setShowForm(false);setForm(formVacio);await load_();
    }catch(_){}
    setSaving(false);
  };

  const marcarRealizada=async()=>{
    if(!sel)return;
    await sbPatch("visitas",`id=eq.${sel.id}`,{estado:"realizada"},tok);
    await addHistorial("visita",sel.id,"Visita realizada en la finca",perfil.nombre,tok);
    if(sel.es_coordinacion&&sel.reserva_id){
      await addHistorial("reserva",sel.reserva_id,`Visita de coordinación realizada: ${sel.motivo_visita||sel.tipo_evento||"Coordinación"}`,perfil.nombre,tok);
    }
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
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,gap:12,flexWrap:"wrap"}}>
        <div className="tabs" style={{marginBottom:0}}>
          <button className={`tab${tab==="proximas"?" on":""}`} onClick={()=>setTab("proximas")}>📅 Próximas ({proximas.length})</button>
          <button className={`tab${tab==="anteriores"?" on":""}`} onClick={()=>setTab("anteriores")}>📁 Anteriores ({anteriores.length})</button>
        </div>
        {puedeEditar&&<button className="btn bp" onClick={()=>{setForm(formVacio);setShowForm(true);}}>➕ Nueva visita</button>}
      </div>
      <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:14}}>
        {[{id:"todas",lbl:"Todas"},{id:"captacion",lbl:"🔍 Captación"},{id:"coordinacion",lbl:"📋 Coordinación"}].map(f=>(
          <button key={f.id} className={`btn sm${filtroTipo===f.id?" bp":" bg"}`} onClick={()=>setFiltroTipo(f.id)}>{f.lbl}</button>
        ))}
      </div>

      {lista.length===0&&<div className="empty"><span className="ico">{tab==="proximas"?"📅":"📁"}</span><p>{tab==="proximas"?"No hay visitas programadas":"No hay visitas anteriores"}</p></div>}

      {lista.map(v=>{
        const est=ESTADOS_VISITA[v.estado]||ESTADOS_VISITA.pendiente;
        const fechaFmt=new Date(v.fecha+"T12:00:00").toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
        return <div key={v.id} className="card" style={{marginBottom:10,borderLeft:`3px solid ${est.col}`,cursor:"pointer"}} onClick={()=>setSel(v)}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
            <div style={{minWidth:0}}>
              <div style={{fontSize:15,fontWeight:600,color:"#1A1A1A",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.nombre}</div>
              <div style={{fontSize:12,color:"#8A8580",marginTop:4}}>📅 {fechaFmt} · 🕐 {v.hora?.slice(0,5)||"—"}</div>
              <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
                <span className="badge" style={{background:`${est.col}18`,color:est.col,border:`1px solid ${est.col}30`}}>{est.lbl}</span>
                {v.es_coordinacion?<span className="badge" style={{background:"rgba(99,102,241,.1)",color:"#a5b4fc",border:"1px solid rgba(99,102,241,.25)"}}>📋 {reservasMap[v.reserva_id]||"Coordinación"}</span>
                :<span className="badge" style={{background:"rgba(245,158,11,.1)",color:"#D4A017",border:"1px solid rgba(245,158,11,.25)"}}>🔍 Captación</span>}
                {v.tipo_evento&&<span className="badge" style={{background:"rgba(201,168,76,.1)",color:"#EC683E"}}>🎉 {v.tipo_evento}</span>}
                {v.invitados&&<span className="badge" style={{background:"rgba(255,255,255,.06)",color:"#8A8580"}}>👥 {v.invitados} inv.</span>}
              </div>
            </div>
            <span style={{color:"#8A8580",fontSize:22,flexShrink:0}}>›</span>
          </div>
          {v.nota&&<div className="nbox" style={{marginTop:10}}>💬 {v.nota}</div>}
          {v.nota_cancelacion&&<div style={{marginTop:8,fontSize:12,color:"#F35757",background:"rgba(232,85,85,.06)",border:"1px solid rgba(232,85,85,.15)",borderRadius:7,padding:"6px 10px"}}>❌ {v.nota_cancelacion}</div>}
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
          ].filter(x=>x.v).map(x=><div key={x.l} style={{background:"#F5F3F0",borderRadius:8,padding:"10px 12px"}}>
            <div style={{fontSize:10,color:"#8A8580",marginBottom:3}}>{x.l}</div>
            <div style={{fontSize:13,color:"#1A1A1A"}}>{x.v}</div>
          </div>)}
        </div>

        {sel.nota_cancelacion&&<div style={{marginBottom:14,padding:"10px 12px",background:"rgba(232,85,85,.06)",border:"1px solid rgba(232,85,85,.2)",borderRadius:8,fontSize:13,color:"#F35757"}}>❌ Motivo cancelación: {sel.nota_cancelacion}</div>}

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
        {sel.estado==="no_presentado"&&<div style={{marginTop:16,padding:"10px 12px",background:"rgba(232,85,85,.08)",border:"1px solid rgba(232,85,85,.2)",borderRadius:8,fontSize:13,color:"#F35757",textAlign:"center"}}>❌ El cliente no se presentó a esta visita</div>}
        {sel.estado==="reserva_cancelada"&&<div style={{marginTop:16,padding:"10px 12px",background:"rgba(107,114,128,.08)",border:"1px solid rgba(107,114,128,.2)",borderRadius:8,fontSize:13,color:"#9ca3af",textAlign:"center"}}>↩️ Reserva cancelada</div>}

        {sel.creado_por&&<div style={{marginTop:12,fontSize:11,color:"#BFBAB4",textAlign:"right"}}>Creada por {sel.creado_por}</div>}

        <Historial entidad_tipo="visita" entidad_id={sel.id} tok={tok} perfil={perfil}/>
        <Documentos entidad_tipo="visita" entidad_id={sel.id} tok={tok} perfil={perfil}/>
      </div>
    </div>}

    {/* MODAL NO SE PRESENTÓ */}
    {sel&&showNoPresentado&&<div className="ov" onClick={()=>setShowNoPresentado(false)}>
      <div className="modal" style={{maxWidth:420}} onClick={e=>e.stopPropagation()}>
        <h3>❌ No se presentó</h3>
        <p style={{fontSize:13,color:"#8A8580",marginBottom:20,lineHeight:1.6}}>
          <strong style={{color:"#1A1A1A"}}>{sel.nombre}</strong> no se ha presentado a la visita del {new Date(sel.fecha+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"long"})} a las {sel.hora?.slice(0,5)||"—"}.<br/><br/>¿Qué deseas hacer?
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
        <p style={{fontSize:13,color:"#8A8580",marginBottom:16,lineHeight:1.5}}>
          La reserva de <strong style={{color:"#1A1A1A"}}>{sel.nombre}</strong> quedará cancelada. Indica el motivo:
        </p>
        <div className="fg">
          <label>Motivo de cancelación *</label>
          <textarea className="fi" rows={4} value={notaCancelacion} onChange={e=>setNotaCancelacion(e.target.value)} placeholder="Ej: No firmaron el contrato, encontraron otra finca…"/>
        </div>
        {!notaCancelacion.trim()&&<div style={{fontSize:12,color:"#F35757",marginBottom:10}}>⚠️ El motivo es obligatorio</div>}
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
          <div style={{fontSize:13,color:"#EC683E",fontWeight:600,marginBottom:2}}>{sel.nombre}</div>
          <div style={{fontSize:12,color:"#8A8580"}}>🎉 {sel.tipo_evento} · 👥 {sel.invitados||"—"} invitados</div>
        </div>
        <div className="fg">
          <label>📅 Fecha del evento * <span style={{color:"#F35757",fontSize:11}}>(día de la boda/evento)</span></label>
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
        {!formRes.fecha_evento&&<div style={{fontSize:12,color:"#F35757",marginBottom:10}}>⚠️ La fecha del evento es obligatoria</div>}
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
    <div style={{fontSize:10,color:"#8A8580",textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>Observaciones / Nota comercial</div>
    {editando?(
      <>
        <textarea className="fi" rows={4} value={txt} onChange={e=>setTxt(e.target.value)} placeholder="Ej: Les ha encantado la finca, piden presupuesto esta semana…" style={{marginBottom:8}}/>
        <div style={{display:"flex",gap:6}}>
          <button className="btn bg sm" onClick={()=>{setTxt(sel.nota||"");setEditando(false);}}>Cancelar</button>
          <button className="btn bp sm" onClick={guardar} disabled={saving}>{saving?"Guardando…":"✓ Guardar"}</button>
        </div>
      </>
    ):(
      <div style={{background:"#F5F3F0",borderRadius:8,padding:"10px 12px",minHeight:52,position:"relative"}}>
        {sel.nota?<div style={{fontSize:13,color:"#1A1A1A",lineHeight:1.5,paddingRight:80}}>{sel.nota}</div>:<div style={{fontSize:13,color:"#BFBAB4",fontStyle:"italic"}}>Sin observaciones todavía…</div>}
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
      // Notificar si llegada próximos 7 días
      const en7=new Date();en7.setDate(en7.getDate()+7);
      if(form.fecha_entrada&&form.fecha_entrada<=en7.toISOString().split("T")[0]){
        notificarRoles(["admin","limpieza","jardinero"],`🏠 Nueva reserva Airbnb`,`${form.huesped} llega el ${new Date(form.fecha_entrada+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"long"})}`,"airbnb-nueva",tok);
      }
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
              <div style={{fontSize:15,fontWeight:600,color:"#1A1A1A",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>🏠 {a.huesped}</div>
              <div style={{fontSize:12,color:"#8A8580",marginTop:4}}>📅 {fmtRango(a)}</div>
              <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
                <span className="badge" style={{background:"rgba(16,185,129,.1)",color:"#A6BE59",border:"1px solid rgba(16,185,129,.25)"}}>Airbnb · {n} noche{n!==1?"s":""}</span>
                {a.personas&&<span className="badge" style={{background:"rgba(255,255,255,.06)",color:"#8A8580"}}>👥 {a.personas} personas</span>}
                {a.precio&&<span className="badge" style={{background:"rgba(201,168,76,.1)",color:"#EC683E"}}>💰 {parseFloat(a.precio).toLocaleString("es-ES")}€</span>}
              </div>
            </div>
            <span style={{color:"#8A8580",fontSize:22,flexShrink:0}}>›</span>
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
          <div style={{fontSize:12,color:"#EC683E",marginBottom:10}}>🌙 {Math.round((new Date(form.fecha_salida)-new Date(form.fecha_entrada))/(1000*60*60*24))} noches</div>
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
            <span className="badge" style={{background:"rgba(16,185,129,.12)",color:"#A6BE59",border:"1px solid rgba(16,185,129,.25)"}}>Airbnb · {noches(sel)} noches</span>
          </div>
          <button className="btn bg sm" style={{flexShrink:0}} onClick={()=>setSel(null)}>✕</button>
        </div>
        <div className="g2" style={{marginBottom:14}}>
          {[
            {l:"ENTRADA",v:new Date(sel.fecha_entrada+"T12:00:00").toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long",year:"numeric"})},
            {l:"SALIDA",v:new Date(sel.fecha_salida+"T12:00:00").toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long",year:"numeric"})},
            {l:"PERSONAS",v:sel.personas?`${sel.personas} personas`:null},
            {l:"PRECIO",v:sel.precio?`${parseFloat(sel.precio).toLocaleString("es-ES")}€`:null,gold:true},
          ].filter(x=>x.v).map(x=><div key={x.l} style={{background:"#F5F3F0",borderRadius:8,padding:"10px 12px"}}>
            <div style={{fontSize:10,color:"#8A8580",marginBottom:3}}>{x.l}</div>
            <div style={{fontSize:x.gold?16:13,fontWeight:x.gold?700:400,color:x.gold?"#c9a84c":"#e8e6e1"}}>{x.v}</div>
          </div>)}
        </div>
        {sel.notas&&<div style={{background:"#F5F3F0",borderRadius:8,padding:"10px 12px",marginBottom:14}}>
          <div style={{fontSize:10,color:"#8A8580",marginBottom:5}}>NOTAS</div>
          <div style={{fontSize:13,color:"#1A1A1A",lineHeight:1.5}}>{sel.notas}</div>
        </div>}
        <div style={{background:"rgba(232,85,85,.06)",border:"1px solid rgba(232,85,85,.15)",borderRadius:8,padding:"10px 12px",marginBottom:14,fontSize:12,color:"#F35757"}}>
          🔴 Estas fechas quedan bloqueadas automáticamente en el calendario
        </div>
        {sel.creado_por&&<div style={{fontSize:11,color:"#BFBAB4",marginBottom:14,textAlign:"right"}}>Creada por {sel.creado_por}</div>}
        {isA&&<button className="btn br" style={{width:"100%",justifyContent:"center"}} onClick={()=>eliminar(sel.id)}>🗑 Eliminar reserva</button>}
      </div>
    </div>}

    {/* MODAL FECHA OCUPADA */}
    {bloqueadoA&&fechaBloqA&&<ModalOcupado fecha={fechaBloqA} conflictos={bloqueadoA} tipoAccion="airbnb" perfil={perfil} tok={tok} onCerrar={()=>{setBloqueadoA(null);setFechaBloqA(null);}} onForzar={()=>{setBloqueadoA(null);setFechaBloqA(null);}}/>}
  </>;
}

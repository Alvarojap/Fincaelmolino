import { useState, useEffect, useRef, createContext, useContext, useMemo } from "react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

// ─── DESIGN TOKENS ──────────────────────────────────────────────────────────
const T={terracotta:"#EC683E",terracottaSoft:"#F2895E",olive:"#A6BE59",oliveSoft:"#BCCE7E",lavender:"#AFA3FF",softBlue:"#7FB2FF",gold:"#ECD227",coral:"#F35757",stone:"#BFB4A4",bg:"#F5F3F0",surface:"#FFFFFF",surfaceAlt:"#EEEAE3",ink:"#1A1A1A",ink2:"#3A3733",ink3:"#7A766F",ink4:"#BFB9AE",line:"#E5E0D6",lineStrong:"#D0CABD",danger:"#D9443A",warning:"#E8A93A",success:"#5A9A4E",r:{sm:12,md:16,lg:20,xl:26,pill:999},sans:'"Inter Tight",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'};

// ─── SUPABASE ────────────────────────────────────────────────────────────────
const SB_URL = "https://bqubxkuuyohuatdothwx.supabase.co";
// Supabase anon key — segura para exponer en cliente (Row Level Security activo)
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxdWJ4a3V1eW9odWF0ZG90aHd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NTE0MzgsImV4cCI6MjA5MDAyNzQzOH0.kwYPiTj0KOmw9RAm88DNceAYdFC3yHF4ogSzXXwSIDA";
// Helper: obtener precio de reserva (unifica precio_total y precio)
const getPrecioReserva=(r)=>parseFloat(r?.precio_total)||(parseFloat(r?.precio_finca||0)+parseFloat(r?.precio_casa||0))||parseFloat(r?.precio)||0;
async function calcularRentabilidadReserva(reserva,tok){
  const id=reserva.id;const pt=getPrecioReserva(reserva);
  const[sL,sJ,lav,gst,cfg]=await Promise.all([
    sbGet("servicios",`?reserva_vinculada_id=eq.${id}&select=nombre,coste_calculado`,tok).catch(()=>[]),
    sbGet("jardin_servicios",`?reserva_vinculada_id=eq.${id}&select=nombre,coste_total`,tok).catch(()=>[]),
    sbGet("lavanderia",`?reserva_vinculada_id=eq.${id}&select=coste`,tok).catch(()=>[]),
    sbGet("gastos",`?reserva_vinculada_id=eq.${id}&select=concepto,importe,categoria`,tok).catch(()=>[]),
    sbGet("configuracion","?select=*",tok).catch(()=>[]),
  ]);
  const c={};cfg.forEach(x=>c[x.clave]=x.valor);const comPct=parseFloat(c.comision_pct)||10;
  const com=pt*(comPct/100);
  const cL=sL.reduce((s,r)=>s+(parseFloat(r.coste_calculado)||0),0);
  const cJ=sJ.reduce((s,r)=>s+(parseFloat(r.coste_total)||0),0);
  const cLav=lav.reduce((s,r)=>s+(parseFloat(r.coste)||0),0);
  const cOtros=gst.filter(g=>g.categoria!=="comision").reduce((s,g)=>s+(parseFloat(g.importe)||0),0);
  const totalC=cL+cJ+cLav+cOtros+com;const ben=pt-totalC;
  return{precioTotal:pt,precioFinca:parseFloat(reserva.precio_finca)||0,precioCasa:parseFloat(reserva.precio_casa)||0,costeLimpieza:cL,costeJardin:cJ,costeLavanderia:cLav,comision:com,comisionPct:comPct,otrosGastos:cOtros,totalCostes:totalC,beneficio:ben,margen:pt>0?Math.round(ben/pt*100):0,nLimp:sL.length,nJard:sJ.length};
}
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
  // Try with provided token first, then fallback to SB_KEY
  let r = await fetch(`${SB_URL}/storage/v1/object/fotos/${path}`,{
    method:"POST", headers:{"apikey":SB_KEY,"Authorization":`Bearer ${tok||SB_KEY}`,"Content-Type":file.type},
    body:file
  });
  if (!r.ok && tok && tok !== SB_KEY) {
    r = await fetch(`${SB_URL}/storage/v1/object/fotos/${path}`,{
      method:"POST", headers:{"apikey":SB_KEY,"Authorization":`Bearer ${SB_KEY}`,"Content-Type":file.type},
      body:file
    });
  }
  if (!r.ok) throw new Error(await r.text());
  return `${SB_URL}/storage/v1/object/public/fotos/${path}`;
}
// Wrapper that always uses SB_KEY for storage (works for all users including operarios)
async function uploadFotoSeguro(file){return uploadFoto(file,SB_KEY);}

// ─── BADGES / NO VISTOS ─────────────────────────────────────────────────────
const BadgeCtx=createContext({noVistos:{total:0,porTipo:{}},refresh:()=>{}});
async function registrarItemNuevo(tipo,itemId,paraUsuarios,tok){for(const uid of paraUsuarios)await sbPost("items_no_vistos",{para_usuario_id:String(uid),tipo,item_id:String(itemId)},tok).catch(()=>{});}
async function marcarVistoTipo(tipo,userId,tok){await sbDelete("items_no_vistos",`para_usuario_id=eq.${userId}&tipo=eq.${tipo}`,tok).catch(()=>{});}
async function marcarVistoItem(tipo,itemId,userId,tok){await sbDelete("items_no_vistos",`para_usuario_id=eq.${userId}&tipo=eq.${tipo}&item_id=eq.${itemId}`,tok).catch(()=>{});}
async function contarNoVistos(userId,tok){const items=await sbGet("items_no_vistos",`?para_usuario_id=eq.${userId}&select=tipo`,tok).catch(()=>[]);const porTipo={};items.forEach(i=>{porTipo[i.tipo]=(porTipo[i.tipo]||0)+1;});return{total:items.length,porTipo};}
async function getUserIdsPorRol(rol,tok){const[u,o]=await Promise.all([sbGet("usuarios",`?rol=eq.${rol}&select=id`,tok).catch(()=>[]),sbGet("operarios",`?rol=eq.${rol}&select=id`,tok).catch(()=>[])]);return[...u,...o].map(x=>x.id);}

// ─── METEO ──────────────────────────────────────────────────────────────────
const AEMET_KEY="eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhbHZhcm9AamFwZXN0dWRpby5jb20iLCJqdGkiOiJhOWM4MGQxNy0yYzBkLTRiN2UtOWU0YS00MTAxYTA4NDQ5ZTMiLCJpc3MiOiJBRU1FVCIsImlhdCI6MTc3NjQ0Mzg5NCwidXNlcklkIjoiYTljODBkMTctMmMwZC00YjdlLTllNGEtNDEwMWEwODQ0OWUzIiwicm9sZSI6IiJ9.aYPcxavIRu6S2j3cp4Sa5TdO5HKS-j0auapg1tzHFEs";
const AEMET_MUNICIPIO="30027";
const METEO_CACHE_KEY="fm_meteo_cache";const METEO_TTL=3*3600000;
function getWIcon(codigo){const c=String(codigo).replace("n","");const n=parseInt(c);if(n===11)return"☀️";if(n===12)return"🌤️";if(n===13)return"🌤️";if(n===14)return"⛅";if(n===15)return"☁️";if(n===16)return"☁️";if(n===17)return"🌫️";if(n===23)return"🌦️";if(n===24||n===25||n===26)return"🌧️";if(n===33)return"🌦️";if(n>=43&&n<=46)return"⛈️";if(n>=51&&n<=54)return"⛈️";if(n===71)return"🌦️";if(n>=72&&n<=74)return"🌧️";return"⛅";}
function getWDesc(codigo){const c=String(codigo).replace("n","");const n=parseInt(c);if(n===11)return"Despejado";if(n===12)return"Poco nuboso";if(n===13)return"Intervalos nubosos";if(n===14)return"Nuboso";if(n===15)return"Muy nuboso";if(n===16)return"Cubierto";if(n===17)return"Nubes altas";if(n===23||n===71)return"Intervalos con lluvia";if(n===24||n===72)return"Nuboso con lluvia";if(n===25||n===73)return"Muy nuboso con lluvia";if(n===26||n===74)return"Cubierto con lluvia";if(n===33)return"Intervalos con nieve";if(n>=43&&n<=46)return"Tormenta";if(n>=51&&n<=54)return"Tormenta";return"Variable";}
async function fetchMeteo(){
  try{
    const cached=localStorage.getItem(METEO_CACHE_KEY);
    if(cached){const{data,ts}=JSON.parse(cached);if(Date.now()-ts<METEO_TTL)return data;}
    const r1=await fetch(`https://opendata.aemet.es/opendata/api/prediccion/especifica/municipio/diaria/${AEMET_MUNICIPIO}/?api_key=${AEMET_KEY}`,{headers:{"Accept":"application/json"}});
    const meta=await r1.json();if(!meta.datos)return null;
    const r2=await fetch(meta.datos);const raw=await r2.json();
    const dias=(raw[0]?.prediccion?.dia||[]).slice(0,7);
    const data=dias.map(dia=>{
      const cielo=dia.estadoCielo||[];const cieloDia=cielo.find(e=>e.periodo==="00-24"||e.periodo==="00-12")||cielo[0]||{};
      const precip=dia.probPrecipitacion||[];const precipDia=precip.find(p=>p.periodo==="00-24"||p.periodo==="00-12")||precip[0]||{};
      const viento=dia.viento||[];const vientoDia=viento.find(v=>v.periodo==="00-24"||v.periodo==="00-12")||viento[0]||{};
      return{fecha:dia.fecha?.split("T")[0],tempMax:dia.temperatura?.maxima,tempMin:dia.temperatura?.minima,precipitacion:parseInt(precipDia.value||0),estadoCielo:cieloDia.value||"11",descripcion:cieloDia.descripcion||"Despejado",viento:parseInt(vientoDia.velocidad||0)};
    });
    localStorage.setItem(METEO_CACHE_KEY,JSON.stringify({data,ts:Date.now()}));
    return data;
  }catch(_){return null;}
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
    const{endpoint,keys}=sub.toJSON();
    await fetch(`${SB_URL}/rest/v1/push_subscriptions?user_id=eq.${encodeURIComponent(String(userId))}`,{method:"DELETE",headers:HDRA(tok)}).catch(()=>{});
    await fetch(`${SB_URL}/rest/v1/push_subscriptions`,{
      method:"POST",
      headers:{...HDRA(tok),"Prefer":"return=minimal"},
      body:JSON.stringify({user_id:String(userId),endpoint,p256dh:keys?.p256dh,auth:keys?.auth})
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
function LogoMark({size=28,color="#A6BE59"}){
  const r=size*0.22;
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" style={{flexShrink:0}}>
    <rect x="4" y="4" width="24" height="24" rx={r} fill={color}/>
    <rect x="10" y="10" width="4" height="12" rx="1.5" fill="#1A1A1A"/>
    <rect x="16" y="10" width="4" height="12" rx="1.5" fill="#1A1A1A"/>
    <rect x="22" y="10" width="2" height="12" rx="1" fill="#1A1A1A" opacity=".5"/>
  </svg>;
}
function Wordmark({size=17,color="#1A1A1A"}){
  return <div style={{display:"inline-flex",alignItems:"center",gap:8}}>
    <LogoMark size={Math.round(size*1.4)}/>
    <span style={{fontFamily:T.sans,fontSize:size,fontWeight:700,color,letterSpacing:-.5}}>Finca El Molino</span>
  </div>;
}

const FmIcon=({name,size=20,stroke="currentColor",sw=2})=>{
  const P={eye:<><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,chevL:<><path d="m15 6-6 6 6 6"/></>,chevR:<><path d="m9 6 6 6-6 6"/></>,chevD:<><path d="m6 9 6 6 6-6"/></>,plus:<><path d="M12 5v14M5 12h14"/></>,check:<><path d="m5 12 5 5L20 7"/></>,x:<><path d="M6 6l12 12M18 6 6 18"/></>,search:<><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,filter:<><path d="M3 5h18l-7 9v5l-4 2v-7L3 5Z"/></>,bell:<><path d="M18 16v-5a6 6 0 1 0-12 0v5l-2 2h16l-2-2Z"/><path d="M10 20a2 2 0 0 0 4 0"/></>,home:<><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/></>,calendar:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></>,users:<><circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M15 20c.1-2.2 1.5-4 4-4 1.3 0 2.4.5 3 1.5"/></>,box:<><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/></>,chart:<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,settings:<><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,edit:<><path d="M4 20h4L20 8l-4-4L4 16v4Z"/></>,arrow:<><path d="M5 12h14M13 6l6 6-6 6"/></>,warn:<><path d="M12 3 2 21h20L12 3Z"/><path d="M12 10v5M12 18h.01"/></>,phone:<><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/></>,mail:<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,more:<><circle cx="5" cy="12" r="1.6" fill={stroke} stroke="none"/><circle cx="12" cy="12" r="1.6" fill={stroke} stroke="none"/><circle cx="19" cy="12" r="1.6" fill={stroke} stroke="none"/></>,clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,euro:<><path d="M17 6a7 7 0 1 0 0 12"/><path d="M4 10h9M4 14h9"/></>,leaf:<><path d="M20 4c-10 0-16 4-16 12a4 4 0 0 0 4 4c8 0 12-6 12-16Z"/><path d="M4 20 14 10"/></>,camera:<><path d="M4 8h3l2-2h6l2 2h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13" r="4"/></>,menu:<><path d="M4 6h16M4 12h16M4 18h16"/></>,key:<><circle cx="8" cy="14" r="4"/><path d="m11 12 9-9M17 6l2 2M15 8l2 2"/></>,sparkle:<><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/></>,whatsapp:<><path d="M4 20l1.5-4A8 8 0 1 1 8 18l-4 2Z"/><path d="M9 10c0 3 2 5 5 5l1-1-2-1-1 1c-1-.5-2-1.5-2.5-2.5l1-1-1-2-1 1c0 .2 0 .3 0 .5Z"/></>};
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{P[name]||null}</svg>;
};

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
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased}
html{height:100%}
body{font-family:'Inter Tight',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F5F3F0;color:#1A1A1A;min-height:100vh;-webkit-tap-highlight-color:transparent}
button{font-family:inherit;-webkit-tap-highlight-color:transparent;cursor:pointer}
input,select,textarea{font-family:inherit}
::-webkit-scrollbar{width:0;height:0}
.app{display:flex;min-height:100vh;min-height:100dvh}
.main{flex:1;min-width:0;display:flex;flex-direction:column;overflow-x:hidden}
.sb{width:256px;min-width:256px;background:#1A1A1A;display:flex;flex-direction:column;position:sticky;top:0;height:100vh;height:100dvh;overflow-y:auto;flex-shrink:0}
.sb-logo{padding:24px 20px 18px;border-bottom:1px solid rgba(255,255,255,.08)}
.sb-logo h1{font-family:inherit;font-size:17px;color:#fff;font-weight:700;letter-spacing:-.5px;margin-top:2px}
.sb-logo p{font-size:9px;color:rgba(255,255,255,.4);margin-top:3px;text-transform:uppercase;letter-spacing:2px;font-weight:600}
.sb-nav{flex:1;padding:12px 10px;overflow-y:auto}
.nav-sec{font-size:9px;color:rgba(255,255,255,.25);text-transform:uppercase;letter-spacing:2px;padding:14px 12px 6px;margin-top:2px;font-weight:700}
.nw{position:relative}
.nb{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;cursor:pointer;font-size:13px;color:rgba(255,255,255,.5);transition:all .15s ease;border:none;background:none;width:100%;text-align:left;font-family:inherit;font-weight:500;margin-bottom:2px}
.nb:hover{background:rgba(255,255,255,.06);color:rgba(255,255,255,.85)}
.nb.on{background:rgba(255,255,255,.08);color:#FFFFFF;font-weight:600}
.nb-ico{font-size:16px;width:22px;text-align:center;flex-shrink:0}
.nb-badge{position:absolute;top:6px;right:8px;background:#EC683E;color:#fff;border-radius:20px;padding:1px 6px;font-size:10px;font-weight:700;min-width:16px;text-align:center;pointer-events:none}
.sb-user{padding:16px;border-top:1px solid rgba(255,255,255,.08);display:flex;align-items:center;gap:12px;flex-shrink:0}
.av{width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#EC683E,#AFA3FF);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;flex-shrink:0}
.uname{font-size:13px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.urole{font-size:11px;color:rgba(255,255,255,.4);text-transform:capitalize;margin-top:1px}
.logout-btn{background:none;border:none;cursor:pointer;color:rgba(255,255,255,.3);font-size:18px;padding:6px;transition:all .15s ease;flex-shrink:0;line-height:1;border-radius:8px}
.logout-btn:hover{color:#F35757;background:rgba(243,87,87,.12)}
.mob-top{display:none;position:sticky;top:0;z-index:150;background:#FFFFFF;border-bottom:1px solid #E5E0D6;padding:0 16px;height:56px;align-items:center;justify-content:space-between}
.mob-top-title{font-family:'Inter Tight',sans-serif;font-size:16px;color:#EC683E;font-weight:800}
.mob-menu-btn{background:none;border:none;color:#1A1A1A;font-size:24px;cursor:pointer;padding:8px;display:flex;align-items:center;justify-content:center;border-radius:10px;line-height:1;transition:background .15s}
.mob-menu-btn:active{background:#F0EEE9}
.drawer-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:300;backdrop-filter:blur(12px)}
.drawer{position:fixed;left:0;top:0;bottom:0;width:min(300px,85vw);background:#1A1A1A;z-index:400;display:flex;flex-direction:column;overflow-y:auto;transform:translateX(-100%);transition:transform .28s cubic-bezier(.4,0,.2,1);box-shadow:8px 0 40px rgba(0,0,0,.2)}
.drawer.open{transform:translateX(0)}
.mob-bar{display:none;position:fixed;bottom:0;left:0;right:0;z-index:90;background:rgba(255,255,255,.96);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-top:1px solid #E5E0D6;padding:6px 8px;padding-bottom:max(22px,env(safe-area-inset-bottom))}
.mob-bar-inner{display:flex;justify-content:space-around;align-items:center}
.mob-btn{display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 10px;border:none;background:none;cursor:pointer;color:#7A766F;font-size:10px;font-family:inherit;font-weight:500;border-radius:14px;transition:all .15s ease;min-width:52px;position:relative;-webkit-tap-highlight-color:transparent}
.mob-btn.on{color:#1A1A1A;font-weight:700}
.mob-btn.on .mico{background:#EC683E;color:#fff;border-radius:100px;padding:4px 14px;box-shadow:0 2px 8px rgba(236,104,62,.3)}
.mico{font-size:24px;line-height:1;transition:all .2s ease;display:inline-block;position:relative;padding:4px 8px;border-radius:100px}
.ph{padding:28px 32px 22px;flex-shrink:0}
.ph h2{font-family:'Inter Tight',sans-serif;font-size:22px;color:#1A1A1A;font-weight:800;letter-spacing:-.5px}
.ph p{color:#8A8580;font-size:13px;margin-top:5px;font-weight:500}
.pb{padding:24px 32px}
.card{background:#FFFFFF;border-radius:16px;box-shadow:0 1px 2px rgba(40,30,20,.04);border:1px solid #E5E0D6;padding:22px;transition:all .15s ease}
@media(min-width:769px){.card:hover{transform:translateY(-1px);box-shadow:0 2px 8px rgba(40,30,20,.06)}}
.cal-card{background:#FFFFFF;border:1px solid #E5E0D6;border-radius:18px;padding:18px;box-shadow:0 1px 3px rgba(40,30,20,.06),0 4px 16px rgba(40,30,20,.08)}
.chdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;gap:8px}
.ctit{font-size:15px;font-weight:700;color:#1A1A1A}
.btn{padding:14px 24px;border-radius:999px;border:none;cursor:pointer;font-size:13px;font-weight:700;letter-spacing:-.2px;font-family:inherit;transition:all .15s ease;display:inline-flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap}
.btn:active{transform:scale(.97)}
.bp{background:#1A1A1A;color:#FFFFFF}.bp:hover{background:#333}
.bg{background:transparent;color:#1A1A1A;border:1px solid #E5E0D6}.bg:hover{background:#F5F3F0;border-color:#D0CABD}
.br{background:#D9443A;color:#FFFFFF;border:none}.br:hover{background:#c33c33}
.sm{padding:7px 14px;font-size:12px}
.fg{margin-bottom:16px}
.fg label{display:block;font-size:10px;color:#8A8580;margin-bottom:7px;text-transform:uppercase;letter-spacing:1.5px;font-weight:600}
.fi{width:100%;padding:12px 14px;border-radius:12px;border:1px solid #E5E0D6;background:#FFFFFF;color:#1A1A1A;font-size:14px;font-family:inherit;outline:none;transition:border-color .15s ease;-webkit-appearance:none;appearance:none}
.fi:focus{border-color:#EC683E;box-shadow:0 0 0 3px rgba(236,104,62,.1)}
.fi::placeholder{color:#BFBAB4}
textarea.fi{resize:vertical;min-height:72px;line-height:1.5}
select.fi{cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238A8580' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;padding-right:38px}
.mft{display:flex;gap:8px;justify-content:flex-end;margin-top:20px;padding-top:18px;border-top:1px solid #E5E0D6}
.ov{position:fixed;inset:0;background:rgba(26,26,26,.45);backdrop-filter:blur(12px);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px}
@keyframes modalIn{from{opacity:0;transform:scale(.94) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
@keyframes modalSlideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
.modal{background:#FFFFFF;border:none;border-radius:24px;padding:30px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto;box-shadow:0 2px 4px rgba(40,30,20,.06),0 24px 60px rgba(40,30,20,.18);animation:modalIn .22s cubic-bezier(.34,1.56,.64,1)}
.modal h3{font-family:'Inter Tight',sans-serif;font-size:20px;color:#1A1A1A;font-weight:800;margin-bottom:22px}
.cli{display:flex;align-items:flex-start;gap:12px;padding:14px;border-radius:14px;border:1px solid #E5E0D6;background:#FFFFFF;margin-bottom:6px;box-shadow:0 1px 3px rgba(40,30,20,.06);transition:all .15s ease}
.cli.done{opacity:.65;background:#F5FFF0}
.chk{width:28px;height:28px;border-radius:8px;flex-shrink:0;border:2.5px solid #BFBAB4;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s cubic-bezier(.4,0,.2,1);margin-top:1px}
.chk:hover{border-color:#A6BE59}
.chk.on{background:#A6BE59;border-color:#A6BE59;animation:chkPop .2s ease}
@keyframes chkPop{0%{transform:scale(1)}50%{transform:scale(1.2)}100%{transform:scale(1)}}
.chk.on::after{content:"✓";color:#fff;font-size:14px;font-weight:800}
.tz{display:inline-block;font-size:10px;padding:3px 8px;border-radius:999px;background:rgba(236,104,62,.08);color:#EC683E;margin-bottom:4px;font-weight:700}
.tl{font-size:14px;color:#1A1A1A;line-height:1.5;font-weight:500}
.tl.done{text-decoration:line-through;color:#A6BE59}
.tm{font-size:11px;color:#8A8580;margin-top:3px;line-height:1.4}
.nbox{background:#FFFBEB;border:none;border-radius:10px;padding:10px 13px;margin-top:8px;font-size:12px;color:#8A7020;line-height:1.5}
.rbox{background:#F5FFF0;border:none;border-radius:10px;padding:10px 13px;margin-top:8px;font-size:12px;color:#6B8A20;line-height:1.5}
.ibtn{display:inline-flex;align-items:center;gap:4px;background:#F0EEE9;color:#EC683E;border:none;border-radius:999px;padding:5px 10px;font-size:11px;cursor:pointer;white-space:nowrap;transition:all .15s ease;flex-shrink:0;font-family:'Inter Tight',sans-serif;font-weight:600}
.ibtn:hover{background:#EC683E;color:#fff}
.pbtn{display:flex;align-items:center;justify-content:center;gap:7px;padding:12px 16px;border-radius:14px;cursor:pointer;background:#F0EEE9;color:#EC683E;border:2px dashed #D5CFC5;font-size:14px;font-family:'Inter Tight',sans-serif;font-weight:600;transition:all .2s ease;width:100%}
.pbtn:hover{background:#E5E0D6;border-color:#EC683E}
.pprev{width:100%;max-height:220px;object-fit:cover;border-radius:14px;margin-top:10px}
.pthumb{max-width:100%;max-height:160px;border-radius:14px;object-fit:cover;margin-top:8px;display:block}
.sg{display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:14px;margin-bottom:22px}
.sc{background:#FFFFFF;border:1px solid #E5E0D6;border-radius:18px;padding:18px;box-shadow:0 1px 3px rgba(40,30,20,.06);transition:all .15s ease}
.sc:hover{transform:translateY(-1px);box-shadow:0 2px 6px rgba(40,30,20,.08),0 4px 16px rgba(40,30,20,.1)}
.sl{font-size:10px;color:#8A8580;text-transform:uppercase;letter-spacing:1.5px;line-height:1.3;font-weight:600}
.sv{font-size:28px;font-weight:800;color:#1A1A1A;margin-top:6px;font-family:'Inter Tight',sans-serif;letter-spacing:-.3px}
.ss{font-size:11px;color:#EC683E;margin-top:4px;font-weight:600}
.prog{height:10px;background:#E5E0D6;border-radius:10px;overflow:hidden;margin-top:8px;position:relative}
.pfill{height:100%;border-radius:10px;background:linear-gradient(90deg,#EC683E,#AFA3FF);transition:width .4s ease}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
hr.div{border:none;border-top:1px solid #E5E0D6;margin:16px 0}
.badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:600}
.empty{text-align:center;padding:48px 20px;color:#8A8580}
.empty .ico{font-size:48px;margin-bottom:12px;display:block}
.empty p{font-size:14px;line-height:1.6}
.alert{padding:12px 16px;border-radius:10px;font-size:13px;margin-bottom:16px;background:#FEE8E8;color:#F35757;border:none;font-weight:500}
.tabs{display:flex;gap:4px;background:#E5E0D6;padding:4px;border-radius:14px;margin-bottom:20px}
.tab{padding:9px 16px;border-radius:10px;cursor:pointer;font-size:12px;color:#8A8580;transition:all .15s ease;border:none;background:none;font-family:'Inter Tight',sans-serif;font-weight:600;white-space:nowrap}
.tab.on{background:#FFFFFF;color:#1A1A1A;box-shadow:0 1px 3px rgba(40,30,20,.08)}
.cg{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-top:12px}
.ch{text-align:center;font-size:10px;color:#8A8580;padding:6px 0;text-transform:uppercase;letter-spacing:.5px;font-weight:700}
.cd{aspect-ratio:1;border-radius:10px;border:1.5px solid transparent;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:12px;font-weight:500;cursor:pointer;transition:all .15s ease;background:#F0EEE9;color:#1A1A1A}
.cd:hover{border-color:#EC683E;background:rgba(236,104,62,.05);transform:scale(1.02)}
.cd.empty{background:transparent;border-color:transparent;cursor:default;transform:none}
.cd.today{border-color:#EC683E;color:#EC683E;font-weight:800;background:rgba(236,104,62,.06)}
.cd.hasev{background:rgba(175,163,255,.12);border-color:rgba(175,163,255,.35)}
.cd.sel{border-color:#EC683E;background:rgba(236,104,62,.1);box-shadow:0 0 0 3px rgba(236,104,62,.12)}
.cd.bloqueado{background:rgba(99,102,241,.06)!important;border-color:rgba(99,102,241,.2)!important;cursor:not-allowed}
.cdot{width:5px;height:5px;border-radius:50%;margin-top:2px}
.cnav{display:flex;align-items:center;gap:12px;margin-bottom:12px}
.cnav button{background:none;border:none;color:#EC683E;cursor:pointer;font-size:22px;padding:6px 10px;border-radius:10px;line-height:1;transition:all .15s ease}
.cnav button:hover{background:rgba(236,104,62,.08)}
.cmon{font-family:'Inter Tight',sans-serif;font-size:20px;color:#1A1A1A;font-weight:800}
.cu{display:flex;align-items:center;gap:10px;padding:14px 16px;cursor:pointer;border-bottom:1px solid #E5E0D6;transition:all .12s ease;position:relative;border-radius:8px;margin:2px 0}
.cu:hover{background:#F0EEE9}
.cu.on{background:rgba(236,104,62,.06)}
.msgs{flex:1;overflow-y:auto;padding:16px 18px;display:flex;flex-direction:column;gap:8px;background:#F0EEE9}
.bub{max-width:72%;padding:11px 15px;border-radius:16px;font-size:13px;line-height:1.5;word-break:break-word;transition:all .1s ease}
.bub.me{align-self:flex-end;background:#1A1A1A;color:#FFFFFF;border-bottom-right-radius:4px}
.bub.them{align-self:flex-start;background:#FFFFFF;border:1px solid #E5E0D6;color:#1A1A1A;border-bottom-left-radius:4px;box-shadow:0 1px 3px rgba(40,30,20,.06)}
.bmeta{font-size:10px;opacity:.45;margin-top:4px;font-weight:500}
.nitem{display:flex;gap:12px;padding:14px 18px;border-bottom:1px solid #E5E0D6;transition:background .1s ease}
.nitem.unread{background:rgba(236,104,62,.04);border-left:3px solid #EC683E}
.ndot{width:8px;height:8px;border-radius:50%;background:#EC683E;flex-shrink:0;margin-top:5px}
.ndot.read{background:#BFBAB4}
.pbanner{background:rgba(127,178,255,.1);border:none;border-radius:14px;padding:12px 18px;margin:12px 32px 0;display:flex;align-items:center;justify-content:space-between;gap:10px}
.pbanner span{font-size:13px;color:#5A8AD4;font-weight:500}
.lw{min-height:100vh;min-height:100dvh;display:flex;align-items:center;justify-content:center;background:#F5F3F0;position:relative;overflow:hidden;padding:16px}
.lbg{position:absolute;inset:0;opacity:.03;background-image:radial-gradient(circle at 25% 25%,rgba(236,104,62,.2) 0%,transparent 50%),radial-gradient(circle at 75% 75%,rgba(175,163,255,.2) 0%,transparent 50%)}
.lc{background:#FFFFFF;border:none;border-radius:24px;padding:44px 38px;width:100%;max-width:400px;position:relative;box-shadow:0 2px 4px rgba(40,30,20,.06),0 24px 60px rgba(40,30,20,.18)}
.llo{text-align:center;margin-bottom:32px}
.llo h1{font-family:'Inter Tight',sans-serif;font-size:28px;color:#1A1A1A;font-weight:800;letter-spacing:-.5px}
.llo p{font-size:9px;color:#8A8580;margin-top:8px;text-transform:uppercase;letter-spacing:2px;font-weight:600}
.rc{background:#FFFFFF;border:1px solid #E5E0D6;border-radius:14px;padding:18px 20px;margin-bottom:10px;cursor:pointer;transition:all .18s ease;border-left:3px solid transparent;box-shadow:0 1px 3px rgba(40,30,20,.06)}
.rc:hover{transform:translateY(-2px);box-shadow:0 2px 6px rgba(40,30,20,.08),0 8px 24px rgba(40,30,20,.12)}
.rc:active{transform:scale(.99)}
.detail-panel{animation:panelIn .22s ease}
@keyframes panelIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}
.spin{display:inline-block;width:18px;height:18px;border:2.5px solid rgba(236,104,62,.15);border-top-color:#EC683E;border-radius:50%;animation:spin .6s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.loading{display:flex;align-items:center;justify-content:center;min-height:200px;color:#8A8580;gap:10px;font-size:14px;font-weight:500}
.drawer-user-card{padding:22px 18px 18px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;gap:14px;background:rgba(255,255,255,.04);flex-shrink:0}
.drawer-close{background:none;border:none;color:rgba(255,255,255,.4);font-size:22px;cursor:pointer;padding:6px;margin-left:auto;border-radius:8px;line-height:1;flex-shrink:0;transition:all .15s ease}
.drawer-close:hover{color:#fff;background:rgba(255,255,255,.1)}
.chat-list-col{width:240px;flex-shrink:0;border-right:1px solid #E5E0D6;overflow-y:auto;display:flex;flex-direction:column;background:#FFFFFF}
.chat-area{flex:1;display:flex;flex-direction:column;min-width:0;min-height:0}
.chdr2{padding:14px 20px;border-bottom:1px solid #E5E0D6;display:flex;align-items:center;gap:12px;flex-shrink:0;background:#FFFFFF}
@media (min-width:769px){
  .mob-top,.mob-bar,.drawer,.drawer-overlay,.mob-back{display:none!important}
  .chat-mobile-wrap{display:none!important}
}
@media (max-width:768px){
  .app>.sb{display:none!important;width:0!important;min-width:0!important;overflow:hidden!important}
  .mob-top{display:flex}.mob-bar{display:block}
  .app{flex-direction:column}.main{width:100%;flex:1;overflow-x:hidden}
  .ph{padding:18px 16px 14px}.ph h2{font-size:22px}
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
  .chat-inp-wrap{position:absolute;bottom:0;left:0;right:0;background:#FFFFFF;border-top:1px solid #E5E0D6;padding:10px 12px;padding-bottom:max(10px,env(safe-area-inset-bottom));z-index:10}
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
  const [navTarget,  setNavTarget]  = useState(null);
  const goToItem=(pg,item)=>{setNavTarget(item);setPage(pg);setDrawerOpen(false);};
  const [perm,       setPerm]       = useState(typeof Notification!=="undefined"?Notification.permission:"default");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [authLoad,   setAuthLoad]   = useState(true);
  const [toast,      setToast]      = useState(null);
  const [noVistos,   setNoVistos]   = useState({total:0,porTipo:{}});

  const [opDesactivado,setOpDesactivado]=useState(false);

  useEffect(()=>{
    regSW();
    // Check operario session first
    const opSaved=localStorage.getItem("fm_operario_session");
    if(opSaved){
      try{
        const op=JSON.parse(opSaved);
        // Set immediately from localStorage, verify in background
        setSession({access_token:SB_KEY});
        setPerfil({id:op.id,nombre:op.nombre,rol:op.rol,referencia_id:op.referencia_id,es_operario:true,avatar:op.avatar||op.nombre.slice(0,2).toUpperCase()});
        setAuthLoad(false);
        // Background verify still active
        sbGet("operarios",`?id=eq.${op.id}&activo=eq.true&select=id`).then(rows=>{
          if(rows.length===0){localStorage.removeItem("fm_operario_session");setSession(null);setPerfil(null);setOpDesactivado(true);}
        }).catch(()=>{});
      }catch(_){localStorage.removeItem("fm_operario_session");setAuthLoad(false);}
      return;
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
              subscribePush(s.user.id,s.access_token);
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
    askPerm().then(p=>{setPerm(p);if(p==="granted")subscribePush(d.user.id,d.access_token);});
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

  // Badge polling — must be before any conditional return to keep hooks order stable
  const tok=session?.access_token||SB_KEY;
  const myUserId=perfil?String(perfil.id):null;
  const refreshNoVistos=async()=>{if(!perfil||!myUserId||!tok)return;try{const tokenQ=perfil?.es_operario?SB_KEY:tok;const nv=await contarNoVistos(myUserId,tokenQ);setNoVistos(nv);}catch(_){}};
  useEffect(()=>{if(!perfil)return;refreshNoVistos();const iv=setInterval(refreshNoVistos,30000);return()=>clearInterval(iv);},[perfil?.id]);

  if(authLoad)return <><style>{CSS}</style><div className="loading"><div className="spin"/><span>Cargando…</span></div></>;
  if(!session||!perfil)return <><style>{CSS}</style><LoginScreen onLogin={login} onLoginOperario={loginOperario} desactivado={opDesactivado}/></>;

  const rol=perfil.rol;
  const P={perfil,tok,setPage,rol,navTarget,setNavTarget,goToItem};
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
    contactos:   <Contactos   {...P}/>,
    visitas:     <Visitas     {...P}/>,
    airbnb:      <ReservasAirbnb {...P}/>,
    chat:        <Chat        {...P}/>,
    notifs:      <Notifs      {...P}/>,
    usuarios:    <Usuarios    {...P}/>,
    gastos:      <Gastos      {...P}/>,
    jardineros:  <Jardineros  {...P}/>,
    ajustes:     <Ajustes     {...P}/>,
    analisis:    <Analisis    {...P}/>,
    limpiadoras:  <LimpiadorasPage {...P}/>,
    lavanderia:  <Lavanderia  {...P}/>,
    almacen:     <AlmacenPage {...P}/>,
  };

  return <BadgeCtx.Provider value={{noVistos,refresh:refreshNoVistos}}>
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
  </BadgeCtx.Provider>;
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
    try{const ops=await sbGet("operarios","?activo=eq.true&select=id,nombre,rol,referencia_id,avatar&order=nombre.asc");setOperarios(ops);}catch(_){setOperarios([]);}
    setOpLoad(false);setModo("seleccion");
  };

  const seleccionarOp=(op)=>{setSelOp(op);setPin("");setPinErr(false);setModo("pin");};

  const addDigit=(d)=>{
    if(pin.length>=4)return;
    const newPin=pin+d;
    setPin(newPin);setPinErr(false);
    if(newPin.length===4){
      const pinLimpio=newPin.toString().trim();
      sbGet("operarios",`?id=eq.${selOp.id}&pin=eq.${pinLimpio}&select=id,nombre,rol,referencia_id,avatar,activo`).then(r=>{
        if(r.length>0&&r[0].activo!==false)onLoginOperario(r[0]);
        else{setPinErr(true);setTimeout(()=>{setPin("");setPinErr(false);},600);}
      }).catch(()=>{setPinErr(true);setTimeout(()=>{setPin("");setPinErr(false);},600);});
    }
  };
  const delDigit=()=>{setPin(p=>p.slice(0,-1));setPinErr(false);};

  const modoTab=modo==="admin"?"email":"pin";
  const setModoTab=(m)=>{if(m==="email")setModo("admin");else cargarOperarios();};

  return <div style={{height:"100vh",height:"100dvh",display:"flex",flexDirection:"column",background:T.bg,fontFamily:T.sans}}>
    <div style={{flex:1,padding:"80px 28px 20px",display:"flex",flexDirection:"column",maxWidth:400,margin:"0 auto",width:"100%"}}>

      {/* Logo */}
      <div style={{textAlign:"center",marginBottom:36}}>
        <div style={{display:"inline-flex",flexDirection:"column",alignItems:"center",gap:12}}>
          <LogoMark size={44}/>
          <div>
            <div style={{fontSize:32,color:T.ink,letterSpacing:-1.2,lineHeight:1,fontWeight:700}}>Finca El Molino</div>
            <div style={{fontSize:11,color:T.ink3,letterSpacing:2,textTransform:"uppercase",fontWeight:600,marginTop:6}}>Murcia · Est. 1892</div>
          </div>
        </div>
      </div>

      {/* Tab Admin / Personal */}
      {modo!=="pin"&&<div style={{display:"flex",background:T.surface,borderRadius:999,padding:4,border:`1px solid ${T.line}`,marginBottom:22}}>
        {[["email","Admin"],["pin","Personal"]].map(([k,l])=>(
          <button key={k} onClick={()=>setModoTab(k)} style={{flex:1,padding:"10px 0",borderRadius:999,border:0,background:modoTab===k?T.ink:"transparent",color:modoTab===k?T.surface:T.ink3,fontFamily:T.sans,fontWeight:600,fontSize:13,cursor:"pointer",letterSpacing:-.1,transition:"all .15s"}}>{l}</button>
        ))}
      </div>}

      {/* Modo Admin — email + password */}
      {modo==="admin"&&<div>
        {desactivado&&<div style={{color:T.danger,fontSize:13,marginBottom:12,textAlign:"center",padding:"10px 14px",background:"rgba(217,68,58,.06)",borderRadius:T.r.sm}}>Tu acceso ha sido desactivado.</div>}
        <label style={{display:"block",fontSize:11,fontWeight:600,color:T.ink3,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Email</label>
        <div style={{marginBottom:14}}>
          <input value={email} onChange={e=>setEmail(e.target.value)} type="email" inputMode="email" autoComplete="email" placeholder="nombre@fincamolino.es" style={{width:"100%",boxSizing:"border-box",padding:"14px 16px",borderRadius:T.r.md,border:`1px solid ${T.line}`,background:T.surface,fontFamily:T.sans,fontSize:14,color:T.ink,outline:"none",transition:"border-color .15s"}} onFocus={e=>e.target.style.borderColor=T.terracotta} onBlur={e=>e.target.style.borderColor=T.line}/>
        </div>
        <label style={{display:"block",fontSize:11,fontWeight:600,color:T.ink3,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Contraseña</label>
        <div style={{marginBottom:20,position:"relative"}}>
          <input type="password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} autoComplete="current-password" placeholder="••••••••" style={{width:"100%",boxSizing:"border-box",padding:"14px 16px",paddingRight:44,borderRadius:T.r.md,border:`1px solid ${T.line}`,background:T.surface,fontFamily:T.sans,fontSize:14,color:T.ink,outline:"none",transition:"border-color .15s"}} onFocus={e=>e.target.style.borderColor=T.terracotta} onBlur={e=>e.target.style.borderColor=T.line}/>
          <span style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",opacity:.4}}><FmIcon name="eye" size={18} stroke={T.ink3}/></span>
        </div>
        {err&&<div style={{color:T.danger,fontSize:13,marginBottom:12,textAlign:"center"}}>{err}</div>}
        <button onClick={go} disabled={load} style={{width:"100%",padding:"16px 0",borderRadius:999,border:0,background:load?T.ink3:T.ink,color:"white",fontFamily:T.sans,fontWeight:700,fontSize:15,letterSpacing:-.2,cursor:load?"default":"pointer",transition:"all .15s"}}>
          {load?<><div className="spin" style={{width:16,height:16,borderWidth:2}}/> Entrando…</>:"Entrar"}
        </button>
      </div>}

      {/* Modo selección operario */}
      {modo==="seleccion"&&<div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
          <button onClick={()=>setModo("admin")} style={{background:"transparent",border:`1px solid ${T.line}`,borderRadius:999,width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><FmIcon name="chevL" size={16} stroke={T.ink}/></button>
          <div style={{fontSize:13,color:T.ink2}}>Selecciona tu perfil</div>
        </div>
        {opLoad?<div className="loading"><div className="spin"/></div>
        :operarios.length===0?<div style={{textAlign:"center",color:T.ink3,padding:"20px 0"}}>No hay operarios registrados</div>
        :<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
          {operarios.map(op=>{const col=op.rol==="jardinero"?T.olive:T.lavender;return(
            <button key={op.id} onClick={()=>seleccionarOp(op)} style={{background:T.surface,border:`1px solid ${T.line}`,borderRadius:T.r.md,padding:"12px 4px",display:"flex",flexDirection:"column",alignItems:"center",gap:6,cursor:"pointer",transition:"all .15s",fontFamily:T.sans}}>
              <div style={{width:44,height:44,borderRadius:999,background:col,color:T.ink,fontWeight:700,fontSize:17,display:"flex",alignItems:"center",justifyContent:"center"}}>{op.avatar||op.nombre?.slice(0,2).toUpperCase()}</div>
              <div><div style={{fontSize:12,fontWeight:600,color:T.ink}}>{op.nombre}</div><div style={{fontSize:9,color:T.ink3}}>{op.rol}</div></div>
            </button>
          );})}
        </div>}
      </div>}

      {/* Modo PIN */}
      {modo==="pin"&&selOp&&<div style={{textAlign:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
          <button onClick={()=>setModo("seleccion")} style={{background:"transparent",border:`1px solid ${T.line}`,borderRadius:999,width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><FmIcon name="chevL" size={16} stroke={T.ink}/></button>
          <div style={{fontSize:14,fontWeight:700,color:T.ink}}>{selOp.nombre}</div>
        </div>
        <div style={{width:60,height:60,borderRadius:999,background:selOp.rol==="jardinero"?T.olive:T.lavender,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:700,color:T.ink,margin:"0 auto 16px"}}>{selOp.avatar||selOp.nombre?.slice(0,2).toUpperCase()}</div>
        <div style={{fontSize:11,fontWeight:600,color:T.ink3,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>PIN de 4 dígitos</div>
        <div style={{display:"flex",justifyContent:"center",gap:10,marginBottom:20,animation:pinErr?"shake .3s ease":"none"}}>
          {[0,1,2,3].map(i=><div key={i} style={{width:48,height:56,borderRadius:T.r.md,background:T.surface,border:`1px solid ${pinErr?T.danger:T.line}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,color:T.ink,transition:"all .15s"}}>{pin.length>i?"•":""}</div>)}
        </div>
        <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}`}</style>
        {pinErr&&<div style={{color:T.danger,fontSize:13,marginBottom:12}}>PIN incorrecto</div>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,maxWidth:240,margin:"0 auto"}}>
          {[1,2,3,4,5,6,7,8,9,null,0,"del"].map((d,i)=>(
            d===null?<div key={i}/>:
            <button key={i} onClick={()=>d==="del"?delDigit():addDigit(String(d))} style={{width:64,height:64,borderRadius:T.r.md,border:"none",background:d==="del"?"transparent":T.surface,cursor:"pointer",fontSize:d==="del"?16:24,fontWeight:700,color:T.ink,fontFamily:T.sans,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .1s",margin:"0 auto",boxShadow:d==="del"?"none":T.shadowSm}}>
              {d==="del"?<FmIcon name="chevL" size={20} stroke={T.ink3}/>:d}
            </button>
          ))}
        </div>
      </div>}
    </div>
    <div style={{padding:"0 28px 32px",textAlign:"center",fontSize:11,color:T.ink4,letterSpacing:.3}}>
      v2.4 · Sistema de gestión Finca El Molino
    </div>
  </div>;
}

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────
function Sidebar({perfil,page,setPage,onLogout,inDrawer,onClose}){
  const rol=perfil.rol;
  const isA=rol==="admin",isJ=rol==="jardinero",isL=rol==="limpieza",isC=rol==="comercial";
  const RL={admin:"Administrador",jardinero:"Jardinero",limpieza:"Limpieza",comercial:"Comercial"};
  const av=perfil.avatar||perfil.nombre.slice(0,2).toUpperCase();
  const{noVistos:nv}=useContext(BadgeCtx);
  const nvMap={reservas:(nv.porTipo?.reserva||0),visitas:(nv.porTipo?.visita||0),chat:(nv.porTipo?.mensaje||0),notifs:(nv.porTipo?.notificacion||0),limpieza:(nv.porTipo?.servicio_limpieza||0)+(nv.porTipo?.servicio_limpieza_fin||0),jcheck:(nv.porTipo?.tarea_jardin||0)+(nv.porTipo?.servicio_jardineria||0)+(nv.porTipo?.servicio_jardineria_fin||0)};
  const nItem=(ico,lbl,id,badge)=>{
    const b=badge||(nvMap[id]||0);
    const on=page===id;
    return <div key={id} className="nw">
      <button className={`nb${on?" on":""}`} onClick={()=>setPage(id)}>
        <span className="nb-ico">{typeof ico==="string"&&ico.length<=2?ico:<Icon name={ico} size={18} color={on?"#FFFFFF":"#8A8580"}/>}</span>{lbl}
      </button>
      {b>0&&<span className="nb-badge">{b>9?"9+":b}</span>}
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
          <LogoMark size={28} color="#A6BE59"/>
          <div><h1>Finca El Molino</h1><p>Murcia · Est. 1892</p></div>
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
        {(isA||isL||isJ)&&nItem("dashboard","Lavandería","lavanderia")}
        {(isA||isL||isJ)&&nItem("reservations","Almacén","almacen")}
        {isL&&nItem("calendar","Calendario","cal-limp")}
      </>}
      {(isA||isC)&&<><p className="nav-sec">Comercial</p>
        {nItem("users","Contactos","contactos")}
        {nItem("visits","Visitas","visitas")}
      </>}
      {(isA||isC)&&<><p className="nav-sec">Reservas</p>
        {nItem("calendar","Calendario","calendario")}
        {nItem("reservations","Reservas","reservas")}
        {isA&&nItem("new_res","Nueva reserva","nueva-res")}
      </>}
      <p className="nav-sec">Comunicación</p>
      {nItem("chat",isA?"Chat con equipo":"Chat con admin","chat")}
      {nItem("notifications","Notificaciones","notifs")}
      {isA&&<><p className="nav-sec">Admin</p>{nItem("expenses","Gastos","gastos")}{nItem("dashboard","Análisis","analisis")}{nItem("users","Usuarios","usuarios")}{nItem("settings","Ajustes","ajustes")}</>}
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
    try{
      const url=await uploadFotoSeguro(f);
      setFoto(url);
    }catch(_){
      // Fallback: read as base64
      try{const reader=new FileReader();reader.onload=ev=>{setFoto(ev.target.result);setUploading(false);};reader.readAsDataURL(f);return;}catch(_2){}
    }
    setUploading(false);
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
function Dashboard({perfil,tok,setPage,rol,goToItem}){
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
  if(rol==="limpieza") return <DashL perfil={perfil} setPage={setPage} tok={tok}/>;
  if(rol==="comercial")return <DashC perfil={perfil} reservas={reservas} setPage={setPage}/>;
  return <DashA reservas={reservas} jsem={jsem} jpunt={jpunt} cwk={cwk} setPage={setPage} tok={tok} perfil={perfil} rol={rol} goToItem={goToItem}/>;
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
      const factEventos=reservas.reduce((s,r)=>s+getPrecioReserva(r),0);
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
    if(urgentes.length>0){const imp=urgentes.reduce((s,r)=>s+getPrecioReserva(r)-(parseFloat(r.seña_importe)||0),0);alertas.push({tipo:"rojo",txt:`${urgentes.length} reserva(s) con cobro pendiente en menos de 30 días — ${Math.round(imp).toLocaleString("es-ES")}€ por cobrar`});}
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

  const renderKpiDetail=(id,d,r,hs,fm,ff,fk,rs,cts,cw)=>{
    const prc=v=>parseFloat(v)||0;
    if(id==="fact"){
      const mData=MESES_CORTO.map((lbl,i)=>{const m=String(i+1).padStart(2,"0");return{name:lbl,Eventos:Math.round(r.reservas.filter(x=>x.fecha?.slice(5,7)===m).reduce((s,x)=>s+(prc(x.precio_total)||prc(x.precio)),0)),Airbnb:Math.round(r.airbnbs.filter(x=>x.fecha_entrada?.slice(5,7)===m).reduce((s,x)=>s+prc(x.precio),0))};});
      const has=mData.some(m=>m.Eventos>0||m.Airbnb>0);
      return <><div style={rs}><span>Eventos ({r.reservas.length})</span><strong>{fm(d.factEventos)}</strong></div>
        <div style={rs}><span>Airbnb ({r.airbnbs.length})</span><strong>{fm(d.factAirbnb)}</strong></div>
        {has&&<div style={{marginTop:12,overflow:"hidden"}}><BarChart width={cw} height={200} data={mData} margin={{top:5,right:5,left:-20,bottom:5}}><XAxis dataKey="name" tick={{fontSize:10,fill:"#8A8580"}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:10,fill:"#8A8580"}} axisLine={false} tickLine={false} tickFormatter={fk}/><Tooltip {...cts} formatter={(v,n)=>[`${v.toLocaleString("es-ES")}€`,n]}/><Bar dataKey="Eventos" fill="#EC683E" radius={[3,3,0,0]}/><Bar dataKey="Airbnb" fill="#A6BE59" radius={[3,3,0,0]}/></BarChart></div>}
        {r.reservas.slice(0,5).map(x=><div key={x.id} style={{...rs,fontSize:12,color:"#8A8580"}}><span style={{flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{x.nombre}</span><span>{ff(x.fecha)}</span><strong style={{color:"#1A1A1A"}}>{fm(prc(x.precio_total)||prc(x.precio))}</strong></div>)}</>;
    }
    if(id==="cobrado") return <><div style={rs}><span>Señas cobradas</span><strong>{fm(d.cobradoEventos)}</strong></div><div style={rs}><span>Airbnb cobrado</span><strong>{fm(d.cobradoAirbnb)}</strong></div><div style={{fontWeight:600,marginTop:10,marginBottom:6,fontSize:12,color:"#8A8580"}}>Pendientes de saldo:</div>{r.reservas.filter(x=>x.seña_cobrada&&!x.saldo_cobrado).slice(0,5).map(x=><div key={x.id} style={{...rs,fontSize:12}}><span style={{flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{x.nombre}</span><span style={{color:"#D4A017"}}>{fm((prc(x.precio_total)||prc(x.precio))-prc(x.seña_importe))}</span></div>)}</>;
    if(id==="pendiente") return <>{r.reservas.filter(x=>x.estado_pago!=="pagado_completo"&&!["cancelada","finalizada"].includes(x.estado)).sort((a,b)=>(a.fecha||"").localeCompare(b.fecha||"")).slice(0,8).map(x=>{const dias=Math.round((new Date(x.fecha)-new Date())/(86400000));const sem=dias<30?"🔴":dias<90?"🟡":"🟢";const pend=(prc(x.precio_total)||prc(x.precio))-(x.seña_cobrada?prc(x.seña_importe):0);return <div key={x.id} style={{...rs,fontSize:12}}><span>{sem}</span><span style={{flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{x.nombre}</span><span style={{color:"#8A8580"}}>{ff(x.fecha)}</span><strong style={{color:"#D4A017"}}>{fm(pend)}</strong></div>;})}</>;
    if(id==="gastos"){
      const cats={};r.gastos.forEach(g=>{const c=g.categoria||"Otros";cats[c]=(cats[c]||0)+prc(g.importe);});const total=d.gastosReales||1;const catE=Object.entries(cats).sort((a,b)=>b[1]-a[1]);
      const pieColors=["#F35757","#EC683E","#ECD227","#A6BE59","#7FB2FF","#AFA3FF","#BFBAB4"];const pieD=catE.map(([c,v])=>({name:c,value:Math.round(v)}));
      return <>{pieD.length>1&&<div style={{overflow:"hidden",marginBottom:12}}><PieChart width={cw} height={180}><Pie data={pieD} cx={cw/2} cy={90} innerRadius={40} outerRadius={70} dataKey="value" strokeWidth={0}>{pieD.map((_,i)=><Cell key={i} fill={pieColors[i%pieColors.length]}/>)}</Pie><Tooltip {...cts} formatter={v=>[`${v.toLocaleString("es-ES")}€`]}/></PieChart></div>}
        {catE.map(([c,v])=><div key={c} style={{marginBottom:6}}><div style={{display:"flex",justifyContent:"space-between",fontSize:12}}><span>{c}</span><strong>{fm(v)} ({Math.round(v/total*100)}%)</strong></div><div style={{height:6,background:"#E5E1DB",borderRadius:3,marginTop:3}}><div style={{height:"100%",borderRadius:3,background:"#F35757",width:`${v/total*100}%`}}/></div></div>)}</>;
    }
    if(id==="gastosProy") return <><div style={rs}><span>Gastos reales YTD</span><strong>{fm(d.gastosReales)}</strong></div><div style={rs}><span>Proyección diciembre</span><strong>{fm(d.gastosProyectados)}</strong></div><div style={{fontWeight:600,marginTop:10,marginBottom:6,fontSize:12,color:"#8A8580"}}>Recurrentes:</div>{r.gastos.filter(g=>g.recurrente).map(g=><div key={g.id} style={{...rs,fontSize:12}}><span style={{flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>🔁 {g.concepto}</span><strong>{fm(prc(g.importe))}/mes</strong></div>)}</>;
    if(id==="beneficio"){
      const bData=MESES_CORTO.map((lbl,i)=>{const m=String(i+1).padStart(2,"0");let cob=0;r.reservas.filter(x=>x.fecha?.slice(5,7)===m).forEach(x=>{if(x.seña_cobrada)cob+=prc(x.seña_importe);if(x.saldo_cobrado)cob+=(prc(x.precio_total)||prc(x.precio))-prc(x.seña_importe);});cob+=r.airbnbs.filter(a=>(a.cobrado||a.fecha_entrada<hs)&&a.fecha_entrada?.slice(5,7)===m).reduce((s,a)=>s+prc(a.precio),0);const gst=r.gastos.filter(g=>g.fecha?.slice(5,7)===m).reduce((s,g)=>s+prc(g.importe),0);return{name:lbl,Beneficio:Math.round(cob-gst)};});
      const has=bData.some(m=>m.Beneficio!==0);
      return <><div style={rs}><span>Cobrado</span><strong style={{color:"#A6BE59"}}>{fm(d.yaCobrado)}</strong></div><div style={rs}><span>Gastos</span><strong style={{color:"#F35757"}}>−{fm(d.gastosReales)}</strong></div><div style={{...rs,fontWeight:700,fontSize:16}}><span>Beneficio</span><strong style={{color:d.beneficio>=0?"#A6BE59":"#F35757"}}>{fm(d.beneficio)}</strong></div>{d.yaCobrado>0&&<div style={{marginTop:8,fontSize:12,color:"#8A8580"}}>Margen: <strong style={{color:"#1A1A1A"}}>{Math.round(d.beneficio/d.yaCobrado*100)}%</strong></div>}
        {has&&<div style={{marginTop:12,overflow:"hidden"}}><LineChart width={cw} height={200} data={bData} margin={{top:5,right:5,left:-20,bottom:5}}><XAxis dataKey="name" tick={{fontSize:10,fill:"#8A8580"}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:10,fill:"#8A8580"}} axisLine={false} tickLine={false} tickFormatter={fk}/><Tooltip {...cts} formatter={v=>[`${v.toLocaleString("es-ES")}€`]}/><Line type="monotone" dataKey="Beneficio" stroke="#AFA3FF" strokeWidth={2} dot={{r:3,fill:"#AFA3FF"}}/></LineChart></div>}</>;
    }
    if(id==="comision") return <><div style={rs}><span>Base de cálculo</span><strong>{fm(d.facturacion)}</strong></div><div style={rs}><span>Porcentaje</span><strong>{d.comisionPct}%</strong></div><div style={{...rs,fontWeight:700}}><span>Total comisión</span><strong style={{color:"#7FB2FF"}}>{fm(d.comision)}</strong></div></>;
    return null;
  };

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
      {/* KPI cards — grid 2col mobile, auto-fill desktop */}
      <style>{`@media(max-width:768px){.kpi-grid{grid-template-columns:1fr 1fr!important}.kpi-grid>div:last-child{grid-column:span 2}}`}</style>
      <div className="kpi-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10}}>
        {kpis.map(k=>k.val!==undefined&&<div key={k.id} onClick={()=>toggleKpi(k.id)} style={{background:k.bg,borderRadius:14,padding:"14px 16px",cursor:"pointer",opacity:k.opacity||1,transition:"all .15s",border:kpiAbierto===k.id?"3px solid #1A1A1A":"3px solid transparent"}}>
          <div style={{fontSize:10,color:k.light?"rgba(255,255,255,.7)":"rgba(0,0,0,.5)",textTransform:"uppercase",letterSpacing:.5,fontWeight:600}}>{k.lbl}</div>
          <div style={{fontSize:22,fontWeight:800,color:k.light?"#fff":"#1A1A1A",marginTop:5}}>{fmt(k.val)}</div>
        </div>)}
      </div>
      {/* Full-width detail panel below KPI row (desktop) */}
      {kpiAbierto&&typeof window!=="undefined"&&window.innerWidth>=768&&(()=>{
        const ak=kpis.find(k=>k.id===kpiAbierto);
        const chartW=Math.min(500,window.innerWidth-400);
        const detailContent=renderKpiDetail(kpiAbierto,data,raw,hoyStr,fmt,fmtF,fmtK,rowStyle,ChartTooltipStyle,chartW);
        return <div style={{background:"#F5F3F0",borderRadius:16,padding:"20px 24px",marginTop:12,animation:"modalIn .2s ease",position:"relative"}}>
          <button onClick={()=>setKpiAbierto(null)} style={{position:"absolute",top:12,right:14,background:"none",border:"none",cursor:"pointer",color:"#8A8580",fontSize:18,lineHeight:1}}>✕</button>
          <div style={{fontSize:14,fontWeight:700,color:ak?.bg||"#1A1A1A",marginBottom:14}}>{ak?.lbl}</div>
          {detailContent}
        </div>;
      })()}
      {/* Mobile bottom sheet */}
      {kpiAbierto&&typeof window!=="undefined"&&window.innerWidth<768&&(()=>{
        const ak=kpis.find(k=>k.id===kpiAbierto);
        const chartW=window.innerWidth-48;
        const detailContent=renderKpiDetail(kpiAbierto,data,raw,hoyStr,fmt,fmtF,fmtK,rowStyle,ChartTooltipStyle,chartW);
        return <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,.4)",backdropFilter:"blur(8px)"}} onClick={()=>setKpiAbierto(null)}>
          <div style={{position:"absolute",bottom:0,left:0,right:0,maxHeight:"90vh",overflowY:"auto",background:"#FFFFFF",borderRadius:"24px 24px 0 0",padding:"20px 20px 36px",animation:"modalSlideUp .28s cubic-bezier(.34,1.56,.64,1)"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontSize:16,fontWeight:800,color:ak?.bg||"#1A1A1A"}}>{ak?.lbl}</div>
              <button onClick={()=>setKpiAbierto(null)} style={{background:"#F0EDE8",border:"none",cursor:"pointer",borderRadius:100,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:"#8A8580"}}>✕</button>
            </div>
            {detailContent}
          </div>
        </div>;
      })()}
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
          const fact=rM.reduce((s,r)=>s+getPrecioReserva(r),0)
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
        const totalEventos=reservas.reduce((s,r)=>s+getPrecioReserva(r),0);
        const totalAirbnb=airbnbs.reduce((s,a)=>s+(parseFloat(a.precio)||0),0);
        setPie([{name:"Eventos",value:Math.round(totalEventos)},{name:"Airbnb",value:Math.round(totalAirbnb)}]);
      }catch(_){}
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
  const [llegadasHoy,setLlegadasHoy]=useState([]);
  const [checkoutsHoy,setCheckoutsHoy]=useState([]);
  const [eventosProx,setEventosProx]=useState([]);
  const [cobrosUrg,setCobrosUrg]=useState([]);
  const [coordItems,setCoordItems]=useState([]);
  const [tareasUrg,setTareasUrg]=useState([]);
  const [stockBajos,setStockBajos]=useState([]);
  const [solicitudes,setSolicitudes]=useState([]);
  const [alertasMeteo,setAlertasMeteo]=useState([]);
  const [srvLimp,setSrvLimp]=useState([]);
  const [srvJard,setSrvJard]=useState([]);
  const [load,setLoad]=useState(true);

  useEffect(()=>{
    (async()=>{
      try{
        const hoy=new Date();const hoyStr=hoy.toISOString().split("T")[0];
        const en7=new Date(hoy);en7.setDate(en7.getDate()+7);const en7Str=en7.toISOString().split("T")[0];
        const en30=new Date(hoy);en30.setDate(en30.getDate()+30);const en30Str=en30.toISOString().split("T")[0];

        const [airbnbs,reservas,sols,sLimp,sJard]=await Promise.all([
          sbGet("reservas_airbnb",`?fecha_entrada=lte.${en7Str}&fecha_salida=gte.${hoyStr}&select=*`,tok).catch(()=>[]),
          sbGet("reservas",`?select=*`,tok).catch(()=>[]),
          sbGet("solicitudes_desbloqueo","?estado=eq.pendiente&select=*&order=created_at.desc",tok).catch(()=>[]),
          sbGet("servicios","?estado=neq.cancelado&estado=neq.finalizado&select=*",tok).catch(()=>[]),
          sbGet("jardin_servicios","?estado=eq.activo&select=*",tok).catch(()=>[]),
        ]);

        // LLEGADAS HOY — Airbnb con fecha_entrada = hoy
        setLlegadasHoy(airbnbs.filter(a=>a.fecha_entrada===hoyStr).map(a=>{
          const noches=Math.round((new Date(a.fecha_salida)-new Date(a.fecha_entrada))/86400000);
          return{nombre:a.huesped,detalle:`${noches} noche${noches!==1?"s":""}${a.personas?` · ${a.personas} pers.`:""}`};
        }));

        // CHECKOUTS HOY — Airbnb con fecha_salida = hoy
        setCheckoutsHoy(airbnbs.filter(a=>a.fecha_salida===hoyStr).map(a=>({nombre:a.huesped})));

        // EVENTOS PRÓXIMOS 7 días — reservas activas
        const activas=reservas.filter(r=>!["cancelada","finalizada"].includes(r.estado));
        setEventosProx(activas.filter(r=>r.fecha>=hoyStr&&r.fecha<=en7Str));

        // COBROS URGENTES — reservas sin pago completo en menos de 30 días
        setCobrosUrg(activas.filter(r=>r.estado_pago!=="pagado_completo"&&!r.seña_cobrada&&r.fecha>=hoyStr&&r.fecha<=en30Str));

        setSolicitudes(sols);
        setSrvLimp(sLimp);
        setSrvJard(sJard);

        // Stock bajo
        try{const arts=await sbGet("almacen_articulos","?activo=eq.true&select=nombre,stock_casa,stock_almacen,stock_minimo",tok);setStockBajos(arts.filter(a=>a.activo!==false&&(parseFloat(a.stock_casa||0)+parseFloat(a.stock_almacen||0))<=(parseFloat(a.stock_minimo||1))));}catch(_){}

        // Tareas urgentes — pendientes vencidas o que vencen hoy
        try{const tu=await sbGet("tareas_comerciales",`?estado=eq.pendiente&fecha_limite=lte.${hoyStr}&order=fecha_limite.asc`,tok);setTareasUrg(tu);}catch(_){}

        // Coordinaciones pendientes — SOLO estados que requieren acción real
        try{const ci=await sbGet("coordinacion_servicios",`?estado=in.(preguntando_si_lista,servicio_creado_pendiente_fecha,pendiente_aprobacion_admin)&select=*&order=created_at.desc&limit=10`,tok);setCoordItems(ci);}catch(_){}

        // Alertas meteorológicas
        try{const dias=await fetchMeteo();if(dias&&dias.length>0){const am=[];const rAll=activas.filter(r=>r.fecha>=hoyStr&&r.fecha<=en7Str);
          dias.forEach(d=>{const f=d.fecha;const rain=d.precipitacion;const wind=d.viento;const evts=rAll.filter(r=>r.fecha===f);const airsD=airbnbs.filter(a=>a.fecha_entrada<=f&&a.fecha_salida>=f);
            if(rain>40&&evts.length>0)am.push({msg:`🌧️ Prob. lluvia ${rain}% el día del evento "${evts[0].nombre}"`,fecha:f});
            if(rain>30&&airsD.length>0)am.push({msg:`🌧️ Prob. lluvia ${rain}% durante estancia de "${airsD[0].huesped}"`,fecha:f});
            if(wind>40)am.push({msg:`💨 Viento fuerte (${wind}km/h) el ${new Date(f+"T12:00:00").toLocaleDateString("es-ES",{weekday:"long",day:"numeric"})}`,fecha:f});
          });setAlertasMeteo(am);}}catch(_){}
      }catch(_){}
      setLoad(false);
    })();
  },[]);

  if(load)return <div style={{display:"flex",alignItems:"center",gap:8,justifyContent:"center",padding:"20px 0",color:"#8A8580",fontSize:13}}><div className="spin" style={{width:16,height:16,borderWidth:2}}/>Cargando…</div>;

  const totalItems=llegadasHoy.length+checkoutsHoy.length+eventosProx.length+cobrosUrg.length+coordItems.length+tareasUrg.length+stockBajos.length+solicitudes.length+alertasMeteo.length+srvLimp.length+srvJard.length;
  if(totalItems===0)return <div className="card" style={{marginBottom:16,textAlign:"center",padding:"24px 16px"}}>
    <div style={{fontSize:28,marginBottom:8}}>✅</div>
    <div style={{fontSize:15,fontWeight:600,color:"#1A1A1A"}}>Todo en orden</div>
    <div style={{fontSize:12,color:"#8A8580",marginTop:4}}>No hay acciones pendientes ahora mismo</div>
  </div>;

  const fmtF=f=>new Date(f+"T12:00:00").toLocaleDateString("es-ES",{weekday:"short",day:"numeric",month:"short"});
  const tagStyle=(bg,col)=>({display:"inline-block",fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:4,background:bg,color:col,letterSpacing:.5,flexShrink:0});
  let secIdx=0;const secMt=()=>secIdx++>0?16:4;

  return <div className="card" style={{marginBottom:16}}>
    <div className="chdr"><span className="ctit">⚡ Atención ahora</span><span className="badge" style={{background:"rgba(232,85,85,.1)",color:"#F35757",border:"1px solid rgba(232,85,85,.2)"}}>{totalItems}</span></div>

    {/* ALERTAS METEO */}
    {alertasMeteo.length>0&&<>
      <div style={{fontSize:11,color:"#7FB2FF",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:8,marginTop:secMt()}}>🌤️ Alertas meteorológicas</div>
      {alertasMeteo.map((a,i)=><div key={`meteo-${i}`} style={{padding:"8px 12px",background:"rgba(127,178,255,.08)",borderRadius:10,marginBottom:5,fontSize:12,color:"#5A8AD4",fontWeight:500}}>{a.msg}</div>)}
    </>}

    {/* LLEGADAS HOY */}
    {llegadasHoy.length>0&&<>
      <div style={{fontSize:11,color:"#10b981",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:8,marginTop:secMt()}}>🏠 Llegadas hoy ({llegadasHoy.length})</div>
      {llegadasHoy.map((l,i)=>(
        <div key={`lh-${i}`} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"#F5F3F0",borderRadius:8,marginBottom:5}}>
          <span style={tagStyle("rgba(16,185,129,.15)","#10b981")}>CHECKIN</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,color:"#1A1A1A",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.nombre}</div>
            <div style={{fontSize:11,color:"#8A8580"}}>{l.detalle}</div>
          </div>
        </div>
      ))}
    </>}

    {/* CHECKOUTS HOY */}
    {checkoutsHoy.length>0&&<>
      <div style={{fontSize:11,color:"#EC683E",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:8,marginTop:secMt()}}>🚪 Checkouts hoy ({checkoutsHoy.length})</div>
      {checkoutsHoy.map((c,i)=>(
        <div key={`co-${i}`} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"#F5F3F0",borderRadius:8,marginBottom:5}}>
          <span style={tagStyle("rgba(236,104,62,.15)","#EC683E")}>CHECKOUT</span>
          <div style={{fontSize:13,color:"#1A1A1A",fontWeight:500}}>{c.nombre}</div>
        </div>
      ))}
    </>}

    {/* EVENTOS PRÓXIMOS 7 DÍAS */}
    {eventosProx.length>0&&<>
      <div style={{fontSize:11,color:"#6366f1",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:8,marginTop:secMt()}}>📅 Eventos próximos 7 días ({eventosProx.length})</div>
      {eventosProx.map(r=>(
        <div key={`ep-${r.id}`} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"#F5F3F0",borderRadius:8,marginBottom:5,cursor:"pointer"}} onClick={()=>setPage("reservas")}>
          <span style={tagStyle("rgba(99,102,241,.15)","#a5b4fc")}>EVENTO</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,color:"#1A1A1A",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.nombre}</div>
            <div style={{fontSize:11,color:"#8A8580"}}>{r.tipo||"Evento"} · {r.estado}</div>
          </div>
          <div style={{fontSize:12,color:"#8A8580",flexShrink:0}}>{fmtF(r.fecha)}</div>
        </div>
      ))}
    </>}

    {/* COBROS URGENTES */}
    {cobrosUrg.length>0&&<>
      <div style={{fontSize:11,color:"#D4A017",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:8,marginTop:secMt()}}>💰 Cobros pendientes ({cobrosUrg.length})</div>
      {cobrosUrg.map(r=>(
        <div key={`cu-${r.id}`} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"#F5F3F0",borderRadius:8,marginBottom:5,cursor:"pointer"}} onClick={()=>setPage("reservas")}>
          <span style={{fontSize:16,flexShrink:0}}>💰</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,color:"#1A1A1A",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.nombre}</div>
            <div style={{fontSize:11,color:"#D4A017"}}>{!r.seña_cobrada?"Señal pendiente":"Pago pendiente"} · {r.estado}</div>
          </div>
          <div style={{fontSize:12,color:"#8A8580",flexShrink:0}}>{fmtF(r.fecha)}</div>
        </div>
      ))}
    </>}

    {/* SOLICITUDES */}
    {solicitudes.length>0&&<>
      <div style={{fontSize:11,color:"#F35757",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:8,marginTop:secMt()}}>🔓 Solicitudes de desbloqueo</div>
      {solicitudes.map(s=>{
        const fF=s.fecha?fmtF(s.fecha):"";
        return <div key={s.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"#F5F3F0",borderRadius:8,marginBottom:5,cursor:"pointer"}} onClick={()=>setPage("notifs")}>
          <span style={{fontSize:16,flexShrink:0}}>🔒</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,color:"#1A1A1A",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.solicitado_por}</div>
            <div style={{fontSize:11,color:"#F35757"}}>{s.motivo||"Solicitud de desbloqueo"}</div>
          </div>
          {fF&&<div style={{fontSize:12,color:"#8A8580",flexShrink:0}}>📅 {fF}</div>}
        </div>;
      })}
    </>}

    {/* SERVICIOS ACTIVOS */}
    {(srvLimp.length>0||srvJard.length>0)&&<>
      <div style={{fontSize:11,color:"#6366f1",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:8,marginTop:secMt()}}>🧹 Servicios activos</div>
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

    {/* COORDINACIÓN PENDIENTE */}
    {coordItems.length>0&&<>
      <div style={{fontSize:11,color:T.lavender,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:8,marginTop:secMt()}}>Coordinación pendiente ({coordItems.length})</div>
      {coordItems.map(c=>{
        const esL=c.tipo?.includes("limpieza");const est=c.estado;
        const sevColor=est==="pendiente_aprobacion_admin"?T.gold:est==="servicio_creado_pendiente_fecha"?T.terracotta:T.softBlue;
        const kindColor=esL?T.lavender:T.olive;const kindIcon=esL?"broom":"sprout";
        return <div key={c.id} style={{background:T.surface,borderRadius:16,padding:14,marginBottom:8,border:`1px solid ${T.line}`,borderLeft:`4px solid ${sevColor}`}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
            <div style={{width:22,height:22,borderRadius:999,background:kindColor,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><FmIcon name={kindIcon} size={12} stroke={T.ink}/></div>
            <div style={{fontSize:11,fontWeight:700,color:T.ink3,textTransform:"uppercase",letterSpacing:.3}}>{esL?"Limpieza":"Jardín"} · {c.respondido_por||"Operario"}</div>
            <div style={{flex:1}}/><div style={{fontSize:10,fontWeight:700,color:sevColor,textTransform:"uppercase"}}>{est==="pendiente_aprobacion_admin"?"Solicitud":"Pendiente"}</div>
          </div>
          <div style={{fontSize:14,fontWeight:700,color:T.ink,letterSpacing:-.2,marginBottom:4}}>{est==="pendiente_aprobacion_admin"?`Solicita limpiar día del checkin`:"Pendiente de confirmación de fecha"}</div>
          {c.fecha_checkout&&<div style={{fontSize:11,color:T.ink3,marginBottom:6}}>{c.tipo_reserva==="airbnb"?"Airbnb":"Evento"} · {new Date(c.fecha_checkout+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"})}</div>}
          {est==="pendiente_aprobacion_admin"&&<div style={{display:"flex",gap:6,marginTop:4}}>
            <button onClick={async()=>{try{await sbPatch("coordinacion_servicios",`id=eq.${c.id}`,{estado:"confirmado"},tok);if(c.respondido_por){const ops=await sbGet("operarios",`?nombre=eq.${encodeURIComponent(c.respondido_por)}&select=id`,tok).catch(()=>[]);for(const op of ops)await sbPost("notificaciones",{para:op.id,txt:`✅ Aprobado: puedes hacer ${esL?"la limpieza":"el jardín"} el ${c.fecha_programada}`},tok).catch(()=>{});}setCoordItems(prev=>prev.filter(x=>x.id!==c.id));}catch(_){}}} style={{padding:"8px 12px",borderRadius:8,background:T.ink,color:"white",border:0,fontFamily:T.sans,fontSize:11,fontWeight:700,cursor:"pointer"}}>✓ Aprobar</button>
            <button onClick={async()=>{try{await sbPatch("coordinacion_servicios",`id=eq.${c.id}`,{estado:"servicio_creado_pendiente_fecha"},tok);if(c.respondido_por){const ops=await sbGet("operarios",`?nombre=eq.${encodeURIComponent(c.respondido_por)}&select=id`,tok).catch(()=>[]);for(const op of ops)await sbPost("notificaciones",{para:op.id,txt:`❌ No aprobado día checkin. Elige otra fecha.`},tok).catch(()=>{});}setCoordItems(prev=>prev.map(x=>x.id===c.id?{...x,estado:"servicio_creado_pendiente_fecha"}:x));}catch(_){}}} style={{padding:"8px 12px",borderRadius:8,background:T.surface,color:T.ink,border:`1px solid ${T.line}`,fontFamily:T.sans,fontSize:11,fontWeight:700,cursor:"pointer"}}>✗ Rechazar</button>
          </div>}
        </div>;
      })}
    </>}

    {/* TAREAS URGENTES */}
    {tareasUrg.length>0&&<>
      <div style={{fontSize:11,color:"#F35757",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:8,marginTop:secMt()}}>🔥 Tareas urgentes ({tareasUrg.length})</div>
      {tareasUrg.map(t=>(
        <div key={`tu-${t.id}`} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"#FEE8E8",borderRadius:8,marginBottom:5,cursor:"pointer"}} onClick={()=>setPage("reservas")}>
          <span style={{fontSize:16,flexShrink:0}}>📌</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,color:"#1A1A1A",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.titulo||t.descripcion}</div>
            <div style={{fontSize:11,color:"#F35757"}}>Vence {fmtF(t.fecha_limite)}</div>
          </div>
        </div>
      ))}
    </>}

    {/* STOCK BAJO */}
    {stockBajos.length>0&&<>
      <div style={{fontSize:11,color:"#F35757",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:8,marginTop:secMt()}}>📦 Stock bajo ({stockBajos.length})</div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {stockBajos.map(a=><span key={a.nombre} className="badge" style={{background:"#FEE8E8",color:"#F35757",cursor:"pointer"}} onClick={()=>setPage("almacen")}>{a.nombre}</span>)}
      </div>
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

function FmPill({color="#1A1A1A",bg,children,icon}){return <span style={{display:"inline-flex",alignItems:"center",gap:5,height:22,padding:"0 9px",borderRadius:999,background:bg||`${color}22`,color,fontSize:11,fontWeight:600,letterSpacing:-.1,lineHeight:1,whiteSpace:"nowrap"}}>{icon&&<span style={{width:6,height:6,borderRadius:999,background:color}}/>}{children}</span>;}
function FmCard({children,style={},pad=16,radius=20,bg="#FFFFFF",onClick}){return <div onClick={onClick} style={{background:bg,borderRadius:radius,padding:pad,border:bg==="#FFFFFF"?`1px solid ${T.line}`:"none",cursor:onClick?"pointer":"default",...style}}>{children}</div>;}
function FmSH({title,action}){return <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:12}}><div style={{fontSize:13,fontWeight:700,color:T.ink,letterSpacing:-.2,textTransform:"uppercase"}}>{title}</div>{action&&<div style={{fontSize:12,color:T.ink3,fontWeight:600,cursor:"pointer"}}>{action}</div>}</div>;}
function DashAlertRow({dot,label,sub,onClick}){return <div onClick={onClick} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 0",cursor:onClick?"pointer":"default"}}><span style={{width:8,height:8,borderRadius:999,background:dot,flexShrink:0}}/><div style={{flex:1}}><div style={{fontSize:12.5,fontWeight:600,color:"white",letterSpacing:-.1}}>{label}</div>{sub&&<div style={{fontSize:11,color:"rgba(255,255,255,.55)"}}>{sub}</div>}</div><FmIcon name="chevR" size={14} stroke="rgba(255,255,255,.45)"/></div>;}
function DashQuickAction({color,icon,label,onClick}){return <button onClick={onClick} style={{background:T.surface,border:`1px solid ${T.line}`,borderRadius:20,padding:"14px 8px",display:"flex",flexDirection:"column",alignItems:"center",gap:8,cursor:"pointer",fontFamily:T.sans,minHeight:90,boxShadow:T.shadowSm,width:"100%"}}><div style={{width:36,height:36,borderRadius:10,background:color+"1f",color,display:"flex",alignItems:"center",justifyContent:"center"}}><FmIcon name={icon} size={18} sw={2} stroke={color}/></div><span style={{fontSize:11,fontWeight:600,color:T.ink,textAlign:"center",lineHeight:1.2,letterSpacing:-.1}}>{label}</span></button>;}
function DashEventRow({color,date,title,price,status,onClick}){return <div onClick={onClick} style={{background:color,borderRadius:20,padding:16,display:"flex",alignItems:"center",gap:14,color:T.ink,cursor:"pointer"}}><div style={{flex:1,minWidth:0}}><div style={{fontSize:11,fontWeight:700,letterSpacing:.3,textTransform:"uppercase",opacity:.75}}>{date} · {status}</div><div style={{fontSize:17,fontWeight:700,letterSpacing:-.4,marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{title}</div><div style={{fontSize:14,fontWeight:600,marginTop:4}}>{price}</div></div><div style={{width:40,height:40,borderRadius:999,background:T.ink,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><FmIcon name="arrow" size={18} stroke={color} sw={2.2}/></div></div>;}

// ─── DESKTOP DASHBOARD COMPONENTS ────────────────────────────────────────────
function BigKpi({label,value,delta,mood="neutral",color=T.olive,onClick}){return<div onClick={onClick} style={{background:T.surface,borderRadius:20,padding:20,border:`1px solid ${T.line}`,cursor:onClick?"pointer":"default"}}><div style={{width:32,height:3,background:color,borderRadius:2,marginBottom:12}}/><div style={{fontSize:11,color:T.ink3,fontWeight:600,letterSpacing:.4,textTransform:"uppercase"}}>{label}</div><div style={{fontSize:32,fontWeight:700,color:T.ink,letterSpacing:-1,lineHeight:1,marginTop:8}}>{value}</div><div style={{fontSize:12,color:T.ink3,marginTop:8,fontWeight:500,display:"flex",alignItems:"center",gap:4}}>{mood==="up"&&<span style={{color:T.success,fontWeight:700}}>↑</span>}{mood==="down"&&<span style={{color:T.danger,fontWeight:700}}>↓</span>}{delta}</div></div>;}
function AttentionPanelDesktop({alertasSimples}){return<div style={{background:"#1A1A1A",borderRadius:24,padding:22,color:"#fff",height:"100%",boxSizing:"border-box"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}><div><div style={{fontSize:11,color:T.gold,letterSpacing:1,textTransform:"uppercase",fontWeight:700}}>Atención ahora</div><div style={{fontSize:22,fontWeight:700,marginTop:4,letterSpacing:-.5}}>{alertasSimples.length} asunto{alertasSimples.length!==1?"s":""}</div></div>{alertasSimples.length>0&&<div style={{background:"rgba(236,210,39,.18)",color:T.gold,padding:"6px 12px",borderRadius:999,fontSize:11,fontWeight:700,letterSpacing:.4,textTransform:"uppercase"}}>Prioridad</div>}</div>{alertasSimples.length===0?<div style={{fontSize:14,color:"rgba(255,255,255,.40)",paddingTop:8}}>✅ Sin asuntos</div>:alertasSimples.map((a,i)=><div key={i} onClick={a.ir} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderTop:i>0?"1px solid rgba(255,255,255,.08)":"none",cursor:a.ir?"pointer":"default"}}><span style={{width:10,height:10,borderRadius:999,background:a.color||T.gold,flexShrink:0}}/><div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,letterSpacing:-.2}}>{a.titulo}</div>{a.sub&&<div style={{fontSize:12,color:"rgba(255,255,255,.55)",fontWeight:500,marginTop:1}}>{a.sub}</div>}</div><FmIcon name="chevR" size={16} stroke="rgba(255,255,255,.5)"/></div>)}</div>;}
function EventosBlockDesktop({reservas,setPage,goToItem}){const hoy=new Date().toISOString().split("T")[0];const prox=reservas.filter(r=>r.estado!=="cancelada"&&r.fecha>=hoy).sort((a,b)=>a.fecha.localeCompare(b.fecha)).slice(0,4);const colors=[T.terracotta,T.lavender,T.gold,T.olive];const fE=v=>(Math.round(parseFloat(v)||0)).toLocaleString("es-ES")+"€";return<div><div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:14}}><div style={{fontSize:13,fontWeight:700,color:T.ink,textTransform:"uppercase",letterSpacing:.4}}>Próximos eventos</div><div onClick={()=>setPage("reservas")} style={{fontSize:12,color:T.ink3,fontWeight:600,cursor:"pointer"}}>Ver todos →</div></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>{prox.map((e,i)=>{const c=colors[i%colors.length];const f=new Date(e.fecha+"T12:00:00").toLocaleDateString("es-ES",{day:"2-digit",month:"short"}).toUpperCase();const ep=e.estado_pago==="pagado_completo"?"Pagado":e.seña_cobrada?"Seña OK":"Saldo pdte";return<div key={e.id} onClick={()=>goToItem?goToItem("reservas",e):setPage("reservas")} style={{background:c,borderRadius:18,padding:18,color:T.ink,cursor:"pointer"}}><div style={{fontSize:11,fontWeight:700,letterSpacing:.3,textTransform:"uppercase",opacity:.75}}>{f} · {ep}</div><div style={{fontSize:17,fontWeight:700,letterSpacing:-.4,marginTop:4,lineHeight:1.15,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.nombre}</div><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:14}}><div style={{fontSize:16,fontWeight:700}}>{fE(getPrecioReserva(e))}</div><div style={{width:36,height:36,borderRadius:999,background:T.ink,display:"flex",alignItems:"center",justifyContent:"center"}}><FmIcon name="arrow" size={16} stroke={c} sw={2.2}/></div></div></div>;})}
    {prox.length===0&&<div style={{gridColumn:"span 2",color:T.ink3,fontSize:13,textAlign:"center",padding:"20px 0"}}>Sin eventos próximos</div>}</div></div>;}
function TareasBlockDesktop({tareas,setPage,goToItem,tok}){const hoy=new Date().toISOString().split("T")[0];const colors=[T.coral,T.gold,T.softBlue,T.lavender,T.olive];return<div><div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:14}}><div style={{fontSize:13,fontWeight:700,color:T.ink,textTransform:"uppercase",letterSpacing:.4}}>Tareas pendientes</div><div style={{fontSize:12,color:T.ink3,fontWeight:600}}>{tareas.length} total</div></div><div style={{display:"flex",flexDirection:"column",gap:10}}>{tareas.slice(0,4).map((t,i)=>{const vencida=t.fecha_limite&&t.fecha_limite<hoy;const color=vencida?T.coral:t.fecha_limite===hoy?T.gold:colors[(i+2)%colors.length];const dl=!t.fecha_limite?"Sin fecha":vencida?"Vencida":t.fecha_limite===hoy?"Hoy":new Date(t.fecha_limite+"T12:00:00").toLocaleDateString("es-ES",{weekday:"short",day:"numeric"});return<div key={t.id} onClick={async()=>{if(t.entidad_id&&goToItem){const tbl=t.entidad_tipo==="reserva"?"reservas":t.entidad_tipo==="visita"?"visitas":"reservas_airbnb";const pg=t.entidad_tipo==="reserva"?"reservas":t.entidad_tipo==="visita"?"visitas":"airbnb";const[item]=await sbGet(tbl,`?id=eq.${t.entidad_id}&select=*`,tok).catch(()=>[]);goToItem(pg,item||null);}else setPage("reservas");}} style={{background:color,borderRadius:18,padding:16,display:"flex",alignItems:"center",gap:14,color:T.ink,cursor:"pointer"}}><div style={{width:36,height:36,borderRadius:10,background:T.ink,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><FmIcon name="check" size={18} stroke={color} sw={2.4}/></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:11,fontWeight:700,letterSpacing:.3,textTransform:"uppercase",opacity:.75}}>{dl} · {t.asignado_nombre||"Admin"}</div><div style={{fontSize:15,fontWeight:700,letterSpacing:-.3,marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.titulo}</div></div><FmIcon name="chevR" size={18} stroke={T.ink} sw={2.4}/></div>;})}
    {tareas.length===0&&<div style={{color:T.ink3,fontSize:13,textAlign:"center",padding:"16px 0"}}>✅ Sin tareas</div>}</div></div>;}
function ContactosBlockDesktop({contactos,setPage}){const colors=[T.lavender,T.olive,T.softBlue,T.coral];return<div><div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:14}}><div style={{fontSize:13,fontWeight:700,color:T.ink,textTransform:"uppercase",letterSpacing:.4}}>Contactos destacados</div><div onClick={()=>setPage("contactos")} style={{fontSize:12,color:T.ink3,fontWeight:600,cursor:"pointer"}}>Todos →</div></div><div style={{background:T.surface,borderRadius:20,border:`1px solid ${T.line}`,overflow:"hidden"}}>{contactos.map((c,i)=>{const color=colors[i%colors.length];const ini=c.nombre?.split(" ").map(p=>p[0]).slice(0,2).join("").toUpperCase()||"??";return<div key={c.id} onClick={()=>setPage("contactos")} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",borderBottom:i<contactos.length-1?`1px solid ${T.line}`:"none",cursor:"pointer"}}><div style={{width:44,height:44,borderRadius:12,background:color,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14,color:T.ink,flexShrink:0}}>{ini}</div><div style={{flex:1,minWidth:0}}><div style={{fontSize:14,fontWeight:700,color:T.ink,letterSpacing:-.2}}>{c.nombre}</div><div style={{fontSize:11,color:T.ink3,fontWeight:500,marginTop:1}}>{c.tipo_evento||"Contacto"} · {c.estado}</div></div>{c.telefono&&<button onClick={e=>{e.stopPropagation();window.open("tel:"+c.telefono);}} style={{width:34,height:34,borderRadius:999,background:T.bg,border:0,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><FmIcon name="phone" size={14} stroke={T.ink} sw={2}/></button>}<button style={{width:34,height:34,borderRadius:999,background:T.ink,border:0,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><FmIcon name="chevR" size={14} stroke="#fff" sw={2.2}/></button></div>;})}
    {contactos.length===0&&<div style={{padding:"16px",color:T.ink3,fontSize:13,textAlign:"center"}}>Sin contactos</div>}</div></div>;}

// ─── OPS HELPERS (Limpieza + Jardinería) ──────────────────────────────────────
const OPS_STATE_META={pendiente:{label:"Sin fecha",color:"#ECD227",bg:"#ECD22722",ink:"#8A6B0F"},pendiente_fecha:{label:"Sin fecha",color:"#ECD227",bg:"#ECD22722",ink:"#8A6B0F"},programado:{label:"Fecha OK",color:"#7FB2FF",bg:"#7FB2FF22",ink:"#2A5BA0"},en_curso:{label:"En curso",color:"#A6BE59",bg:"#A6BE5922",ink:"#4A7A2E"},completado:{label:"Finalizado",color:"#BFB9AE",bg:"#F5F3F0",ink:"#7A766F"},finalizado:{label:"Finalizado",color:"#BFB9AE",bg:"#F5F3F0",ink:"#7A766F"},conflicto:{label:"Conflicto",color:"#D9443A",bg:"#D9443A18",ink:"#9A2A22"},activo:{label:"Activo",color:"#A6BE59",bg:"#A6BE5922",ink:"#4A7A2E"}};
function getOpsMeta(e){return OPS_STATE_META[e]||OPS_STATE_META.pendiente;}
function OpsAvatar({name="?",size=28,color:c}){const cols=["#AFA3FF","#A6BE59","#7FB2FF","#ECD227","#EC683E"];const cl=c||cols[(name||"X").charCodeAt(0)%cols.length];return<div style={{width:size,height:size,borderRadius:999,background:cl,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.4,fontWeight:700,color:"#1A1A1A",fontFamily:T.sans,flexShrink:0}}>{(name||"?")[0].toUpperCase()}</div>;}
function OpsMiniKpi({value,label,color}){return<div style={{background:T.surface,borderRadius:16,padding:"10px 12px",border:`1px solid ${T.line}`}}><div style={{width:22,height:3,background:color,borderRadius:2,marginBottom:6}}/><div style={{fontSize:20,fontWeight:700,color:T.ink,letterSpacing:-.6,lineHeight:1}}>{value}</div><div style={{fontSize:10,color:T.ink3,fontWeight:500,textTransform:"uppercase",letterSpacing:.4,marginTop:4}}>{label}</div></div>;}
function OpsStatePill({estado}){const m=getOpsMeta(estado);return<span style={{display:"inline-flex",alignItems:"center",gap:4,height:20,padding:"0 8px",borderRadius:999,background:m.bg,color:m.ink,fontSize:10,fontWeight:700}}><span style={{width:5,height:5,borderRadius:999,background:m.color}}/>{m.label}</span>;}
function OpsStatMini({label,value,accent}){return<div style={{background:accent?"#EC683E14":T.bg,padding:"8px 10px",borderRadius:8}}><div style={{fontSize:9,color:T.ink3,textTransform:"uppercase",letterSpacing:.4,fontWeight:600}}>{label}</div><div style={{fontSize:14,fontWeight:700,color:accent?"#EC683E":T.ink,marginTop:2}}>{value}</div></div>;}
function OpsServiceCard({s,kind,onClick}){const estado=s.estado||s.state||"pendiente";const meta=getOpsMeta(estado);const zD=s.zonas_completadas||s.zonesDone||0;const zT=s.total_zonas||s.zones||14;const tD=s.tareas_completadas||s.tasksDone||0;const tT=s.total_tareas||s.tasks||1;const progress=kind==="cleaning"?zD/zT:tD/tT;const progressLbl=kind==="cleaning"?`${zD}/${zT} zonas`:`${tD}/${tT} tareas`;const worker=kind==="cleaning"?(s.limpiadora_nombre||s.cleaner||"—"):(s.jardinero_nombre||s.gardener||"—");const titulo=s.titulo||s.title||s.nombre||"Servicio";const fecha=s.fecha||s.date||"Sin fecha";const coste=s.coste_calculado||s.cost||0;const esAuto=s.origen_automatico||s.origin==="auto";const esRec=s.origin==="recurring";const vinculo=s.reserva_nombre||s.linkedTo;const fE=v=>(Math.round(parseFloat(v)||0)).toLocaleString("es-ES")+"€";
  return<div onClick={onClick} style={{background:T.surface,border:`1px solid ${T.line}`,borderRadius:16,padding:14,cursor:"pointer",display:"flex",gap:10,marginBottom:8}}>
    <div style={{width:4,borderRadius:999,background:meta.color,flexShrink:0,alignSelf:"stretch"}}/>
    <div style={{flex:1,minWidth:0}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10}}>
        <div style={{minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3,flexWrap:"wrap"}}>
            <OpsStatePill estado={estado}/>
            {esAuto&&<span style={{display:"inline-flex",height:20,padding:"0 7px",borderRadius:999,background:T.ink3+"22",color:T.ink3,fontSize:10,fontWeight:700}}>Auto</span>}
            {esRec&&<span style={{display:"inline-flex",height:20,padding:"0 7px",borderRadius:999,background:"#7FB2FF22",color:"#2A5BA0",fontSize:10,fontWeight:700}}>Semanal</span>}
            {!esAuto&&!esRec&&<span style={{display:"inline-flex",height:20,padding:"0 7px",borderRadius:999,background:"#AFA3FF22",color:"#4A3A8A",fontSize:10,fontWeight:700}}>Manual</span>}
          </div>
          <div style={{fontSize:14,fontWeight:700,color:T.ink,letterSpacing:-.2}}>{titulo}</div>
          {vinculo&&<div style={{fontSize:11,color:T.ink3,marginTop:2,display:"flex",alignItems:"center",gap:4}}><FmIcon name="calendar" size={10} stroke={T.ink3}/>{vinculo}</div>}
        </div>
        <div style={{textAlign:"right",flexShrink:0}}>
          <div style={{fontSize:14,fontWeight:700,color:T.ink}}>{coste>0?fE(coste):"—"}</div>
          {(s.modalidad_pago==="horas"||s.mode==="horas")&&coste>0&&<div style={{fontSize:10,color:T.ink3,marginTop:2}}>{s.horas_trabajadas||s.hoursLogged||0}h×{s.tarifa_hora||s.rate||0}€</div>}
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginTop:10}}>
        <OpsAvatar name={worker} size={22}/><div style={{fontSize:11,color:T.ink2,fontWeight:600}}>{worker}</div><div style={{width:1,height:12,background:T.line}}/><div style={{fontSize:11,color:T.ink3}}>{typeof fecha==="string"&&fecha.includes("-")?new Date(fecha+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"}):fecha}</div>
      </div>
      {progress>0&&estado!=="completado"&&estado!=="finalizado"&&<div style={{marginTop:10}}>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:T.ink3,marginBottom:4}}><span>{progressLbl}</span><span>{Math.round(progress*100)}%</span></div>
        <div style={{height:4,background:T.bg,borderRadius:999,overflow:"hidden"}}><div style={{width:(progress*100)+"%",height:"100%",background:meta.color}}/></div>
      </div>}
    </div>
  </div>;}

// ─── RESERVAS HELPERS ─────────────────────────────────────────────────────────
function RvKpiBlock({bg,title,sub}){return<div style={{background:bg,borderRadius:16,padding:"12px 12px 14px",color:T.ink}}><div style={{fontSize:22,fontWeight:700,letterSpacing:-.6,lineHeight:1}}>{title}</div><div style={{fontSize:10.5,fontWeight:600,marginTop:4,opacity:.8}}>{sub}</div></div>;}
function RvDesgloseRow({label,value,color}){return<div style={{display:"flex",alignItems:"center",gap:10,padding:"5px 0"}}><div style={{width:4,height:14,borderRadius:2,background:color,flexShrink:0}}/><div style={{flex:1,fontSize:13,color:T.ink}}>{label}</div><div style={{fontSize:14,fontWeight:700,color:T.ink}}>{typeof value==="number"?(Math.round(value)).toLocaleString("es-ES")+"€":value}</div></div>;}
function RvTag({bg,ink,children}){return<span style={{fontSize:9,padding:"2px 7px",borderRadius:999,background:bg,color:ink,fontWeight:700,letterSpacing:.3,textTransform:"uppercase",fontFamily:T.sans}}>{children}</span>;}
const rvStatusMeta=label=>({"Pagado":{bg:"#DCE8BC",ink:"#4D6B1F",dot:"#7E9B3E"},"Seña OK":{bg:"#F8DCC4",ink:"#8F4A1C",dot:"#EC683E"},"Cancelada":{bg:"#F5E0DE",ink:"#9B3C33",dot:"#D9443A"},"Finalizada":{bg:"#EEEAE3",ink:"#7A766F",dot:"#BFB9AE"},"Confirmada":{bg:"#FBF3C7",ink:"#7A6B15",dot:"#ECD227"},"Visita":{bg:"#E9F0FC",ink:"#2B4B80",dot:"#7FB2FF"},"Cobrado":{bg:"#DCE8BC",ink:"#4D6B1F",dot:"#7E9B3E"},"Pendiente":{bg:"#FBDCDC",ink:"#9B3C33",dot:"#F35757"}}[label]||{bg:"#E9F0FC",ink:"#2B4B80",dot:"#7FB2FF"});
const rvStatusLabel=r=>r.estado_pago==="pagado_completo"?"Pagado":r.seña_cobrada?"Seña OK":r.estado==="cancelada"?"Cancelada":r.estado==="finalizada"?"Finalizada":r.estado==="confirmada"?"Confirmada":"Visita";
function RvStatusPill({r,size}){const l=r.cobrado!==undefined?(r.cobrado?"Cobrado":"Pendiente"):rvStatusLabel(r);const m=rvStatusMeta(l);const h=size==="md"?26:22;return<span style={{display:"inline-flex",alignItems:"center",gap:5,height:h,padding:"0 9px",borderRadius:999,background:m.bg,color:m.ink,fontSize:size==="md"?11.5:10.5,fontWeight:700,fontFamily:T.sans,whiteSpace:"nowrap"}}><span style={{width:5,height:5,borderRadius:999,background:m.dot}}/>{l}</span>;}

function RvEventRow({r,onOpen,faded,cancel}){const total=getPrecioReserva(r);const pagado=parseFloat(r.seña_cobrada?r.seña_importe||0:0);const pct=total>0?Math.round(pagado/total*100):0;const fecha=r.fecha?new Date(r.fecha+"T12:00:00"):null;const dia=fecha?fecha.getDate():"—";const mes=fecha?fecha.toLocaleDateString("es-ES",{month:"short"}).toUpperCase():"—";const hasHouse=r.incluye_casa;const fE=v=>(Math.round(parseFloat(v)||0)).toLocaleString("es-ES")+"€";
  return<div onClick={onOpen} style={{background:T.surface,border:`1px solid ${T.line}`,borderRadius:18,padding:14,marginBottom:10,cursor:"pointer",opacity:faded?.7:1}}>
    <div style={{display:"flex",gap:12}}>
      <div style={{width:54,minWidth:54,textAlign:"center",padding:"8px 0",background:hasHouse?T.terracotta:T.gold,borderRadius:13,color:T.ink}}><div style={{fontSize:9,fontWeight:700,letterSpacing:.6,opacity:.85}}>{mes}</div><div style={{fontSize:22,fontWeight:700,letterSpacing:-.7,lineHeight:1}}>{dia}</div></div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,flexWrap:"wrap"}}><span style={{fontSize:10,color:T.ink3,fontWeight:700,letterSpacing:.3}}>#{r.id?.slice(-6)}</span>{hasHouse&&<RvTag bg={T.terracotta+"30"} ink={T.ink}>+ Casa</RvTag>}</div>
        <div style={{fontSize:15.5,fontWeight:700,color:T.ink,letterSpacing:-.35,lineHeight:1.2,marginBottom:6,textDecoration:cancel?"line-through":"none"}}>{r.nombre}</div>
        <div style={{display:"flex",gap:10,fontSize:11,color:T.ink3,fontWeight:500,marginBottom:cancel?0:8}}><span>Finca {fE(r.precio_finca||r.precio||0)}</span>{parseFloat(r.precio_casa||0)>0&&<span>Casa {fE(r.precio_casa)}</span>}</div>
        {!cancel&&total>0&&<div style={{display:"flex",alignItems:"center",gap:8}}><div style={{flex:1,height:6,background:T.bg,borderRadius:999,overflow:"hidden"}}><div style={{width:pct+"%",height:"100%",background:pct===100?T.olive:pct>0?T.gold:T.coral}}/></div><div style={{fontSize:11,fontWeight:700,color:T.ink,letterSpacing:-.2}}>{fE(pagado)}<span style={{color:T.ink3,fontWeight:500}}>/{fE(total)}</span></div></div>}
        <div style={{marginTop:6}}><RvStatusPill r={r}/></div>
      </div>
    </div>
  </div>;}

function RvBnbRow({r,onOpen}){const dias=r.fecha_entrada&&r.fecha_salida?Math.ceil((new Date(r.fecha_salida+"T12:00:00")-new Date(r.fecha_entrada+"T12:00:00"))/(864e5)):0;const fE=v=>(Math.round(parseFloat(v)||0)).toLocaleString("es-ES")+"€";
  return<div onClick={onOpen} style={{background:T.surface,border:`1px solid ${T.line}`,borderRadius:18,padding:14,marginBottom:10,cursor:"pointer"}}>
    <div style={{display:"flex",gap:12}}>
      <div style={{width:54,minWidth:54,padding:"10px 6px",background:T.softBlue,borderRadius:13,color:T.ink,display:"flex",flexDirection:"column",alignItems:"center"}}><FmIcon name="key" size={17} stroke={T.ink} sw={2}/><div style={{fontSize:11,fontWeight:700,marginTop:4,letterSpacing:-.2}}>{dias}n</div></div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}><span style={{fontSize:10,color:T.ink3,fontWeight:700,letterSpacing:.3}}>Airbnb</span></div>
        <div style={{fontSize:15.5,fontWeight:700,color:T.ink,letterSpacing:-.35,lineHeight:1.2,marginBottom:4}}>{r.huesped}</div>
        <div style={{fontSize:11,color:T.ink3,fontWeight:500,marginBottom:8}}>{r.fecha_entrada?new Date(r.fecha_entrada+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"}):"—"} → {r.fecha_salida?new Date(r.fecha_salida+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"}):"—"} · {dias} noche{dias!==1?"s":""}</div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}><div style={{fontSize:15.5,fontWeight:700,color:T.ink,letterSpacing:-.35}}>{fE(getPrecioReserva(r))}</div><RvStatusPill r={r}/></div>
      </div>
    </div>
  </div>;}

function buildRvCalCells(year,month){const dias=new Date(year,month,0).getDate();const pD=(new Date(year,month-1,1).getDay()+6)%7;const c=[];for(let i=0;i<pD;i++)c.push(null);for(let d=1;d<=dias;d++)c.push(d);while(c.length%7!==0)c.push(null);return c;}
function buildRvCalMap(reservas,airbnbs,year,month){const map={};reservas.filter(r=>r.estado!=="cancelada"&&r.fecha).forEach(r=>{const f=new Date(r.fecha+"T12:00:00");if(f.getFullYear()===year&&f.getMonth()===month){const d=f.getDate();map[d]={kind:"event",color:r.incluye_casa?T.terracotta:T.gold,label:r.nombre,ref:r};if(r.incluye_casa){if(d>1&&!map[d-1])map[d-1]={kind:"block",color:T.terracotta+"60"};if(d<31&&!map[d+1])map[d+1]={kind:"block",color:T.terracotta+"60"};}}});airbnbs.forEach(a=>{if(!a.fecha_entrada||!a.fecha_salida)return;const d=new Date(a.fecha_entrada+"T12:00:00");const fin=new Date(a.fecha_salida+"T12:00:00");while(d<fin){if(d.getFullYear()===year&&d.getMonth()===month){const dia=d.getDate();if(!map[dia])map[dia]={kind:"bnb",color:T.softBlue,label:a.huesped?.split(" ")[0],ref:a};}d.setDate(d.getDate()+1);}});return map;}

// ─── DETALLE RESERVA EVENTO (overlay) ────────────────────────────────────────
function RvEventDetail({reserva,tok,perfil,rol,isA,onClose,onChanged,isDesktopPanel=false}){
  const [localR,setLocalR]=useState(reserva);
  useEffect(()=>{setLocalR(reserva);},[reserva?.id]);
  const total=getPrecioReserva(localR);
  const señaImp=parseFloat(localR.seña_importe)||0;
  const pagado=localR.saldo_cobrado?total:localR.seña_cobrada?señaImp:0;
  const pct=total>0?Math.round(pagado/total*100):0;
  const pending=total-pagado;
  const fE=v=>(Math.round(parseFloat(v)||0)).toLocaleString("es-ES")+"€";
  const [showSeña,setShowSeña]=useState(false);
  const [señaImporte,setSeñaImporte]=useState("");
  const [señaMetodo,setSeñaMetodo]=useState("transferencia");
  const [showPagoTotal,setShowPagoTotal]=useState(false);
  const [editPrecios,setEditPrecios]=useState(false);
  const [formPrecios,setFormPrecios]=useState({precio_finca:String(reserva.precio_finca||reserva.precio||""),precio_casa:String(reserva.precio_casa||""),incluye_casa:!!reserva.incluye_casa});
  const [cobroSaving,setCobroSaving]=useState(false);
  const [servicios,setServicios]=useState([]);
  const [contacto,setContacto]=useState(null);
  const [vincularContacto,setVincularContacto]=useState(false);
  const [busqContacto,setBusqContacto]=useState("");
  const [contactosBusq,setContactosBusq]=useState([]);

  useEffect(()=>{
    setContacto(null);
    if(localR?.contacto_id)sbGet("contactos",`?id=eq.${localR.contacto_id}&select=*`,tok).then(r=>setContacto(r?.[0]||null)).catch(()=>setContacto(null));
    sbGet("coordinacion_servicios",`?reserva_id=eq.${localR.id}&select=*&order=created_at.asc&limit=5`,tok).then(setServicios).catch(()=>{});
  },[localR?.id,localR?.contacto_id]);
  useEffect(()=>{if(!busqContacto||busqContacto.length<2){setContactosBusq([]);return;}sbGet("contactos",`?or=(nombre.ilike.*${busqContacto}*,telefono.ilike.*${busqContacto}*)&limit=10`,tok).then(r=>setContactosBusq(r||[])).catch(()=>setContactosBusq([]));},[busqContacto]);

  const fecha=localR.fecha?new Date(localR.fecha+"T12:00:00"):null;
  const fechaFmt=fecha?fecha.toLocaleDateString("es-ES",{day:"numeric",month:"short",year:"numeric"}):"—";
  const initials=(contacto?.nombre||localR.contacto||"").split(" ").map(p=>p[0]).slice(0,2).join("").toUpperCase()||"?";
  const gBtn={width:36,height:36,borderRadius:999,background:"rgba(255,255,255,.14)",border:0,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"};

  const regSeña=async()=>{
    if(!señaImporte||cobroSaving)return;setCobroSaving(true);
    try{const imp=parseFloat(señaImporte)||0;const hoy=new Date().toISOString().split("T")[0];
      await sbPatch("reservas",`id=eq.${localR.id}`,{seña_importe:imp,seña_cobrada:true,seña_fecha:hoy,estado_pago:"seña_cobrada"},tok);
      await addHistorial("reserva",localR.id,`Seña cobrada: ${imp.toLocaleString("es-ES")}€`,perfil?.nombre||"Admin",tok);
      const u={...localR,seña_importe:imp,seña_cobrada:true,seña_fecha:hoy,estado_pago:"seña_cobrada"};
      setLocalR(u);onChanged&&onChanged(u);setShowSeña(false);setSeñaImporte("");}catch(_){}setCobroSaving(false);
  };
  const regPago=async()=>{
    if(cobroSaving)return;setCobroSaving(true);
    try{const hoy=new Date().toISOString().split("T")[0];
      await sbPatch("reservas",`id=eq.${localR.id}`,{saldo_cobrado:true,saldo_fecha:hoy,estado_pago:"pagado_completo"},tok);
      const precioTotal=parseFloat(localR.precio_total)||parseFloat(localR.precio)||0;
      await addHistorial("reserva",localR.id,`Pago total registrado: ${precioTotal.toLocaleString("es-ES")}€`,perfil?.nombre||"Admin",tok);
      const cfgRows=await sbGet("configuracion","?select=*",tok).catch(()=>[]);const cfg={};cfgRows.forEach(c=>cfg[c.clave]=c.valor);
      const comPct=parseFloat(cfg.comision_pct)||10;const comision=Math.round(precioTotal*comPct/100*100)/100;
      if(comision>0)await sbPost("gastos",{fecha:hoy,categoria:"comision",concepto:`Comisión gestor - ${localR.nombre}`,importe:comision,origen:"auto_comision"},tok).catch(()=>{});
      const u={...localR,saldo_cobrado:true,saldo_fecha:hoy,estado_pago:"pagado_completo"};
      setLocalR(u);onChanged&&onChanged(u);setShowPagoTotal(false);}catch(_){}setCobroSaving(false);
  };

  return(
    <div style={{position:isDesktopPanel?"relative":"fixed",inset:isDesktopPanel?"auto":0,background:T.bg,zIndex:isDesktopPanel?"auto":200,overflow:"auto",paddingBottom:40}}>
      {/* Hero oscuro — solo móvil */}
      {!isDesktopPanel&&<div style={{background:"linear-gradient(165deg,#2A2015 0%,#0E0E0E 100%)",paddingTop:54,paddingBottom:22,paddingLeft:20,paddingRight:20,color:"#fff",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",right:-30,top:-40,width:220,height:220,borderRadius:999,background:T.terracotta+"35",filter:"blur(45px)"}}/>
        <div style={{position:"relative",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
          <button onClick={onClose} style={gBtn}><FmIcon name="chevL" size={16} stroke="#fff"/></button>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <span style={{fontSize:11,padding:"4px 10px",borderRadius:999,background:"rgba(255,255,255,.12)",color:"#fff",fontWeight:700,letterSpacing:.3}}>#{localR.id?.slice(-6)}</span>
          </div>
        </div>
        <div style={{position:"relative"}}>
          <div style={{fontSize:11,color:"rgba(255,255,255,.65)",letterSpacing:1,textTransform:"uppercase",fontWeight:600}}>{fechaFmt}{localR.hora_inicio?` · ${localR.hora_inicio}`:""}</div>
          <div style={{fontFamily:T.sans,fontSize:26,fontWeight:700,letterSpacing:-1,lineHeight:1.05,marginTop:4}}>{localR.nombre}</div>
          <div style={{display:"flex",gap:12,marginTop:12,fontSize:12,color:"rgba(255,255,255,.75)",fontWeight:500}}>
            {localR.invitados&&<span style={{display:"inline-flex",alignItems:"center",gap:5}}><FmIcon name="users" size={13} stroke="rgba(255,255,255,.75)"/>{localR.invitados} pax</span>}
            <span style={{display:"inline-flex",alignItems:"center",gap:5}}>{localR.incluye_casa?<><FmIcon name="key" size={13} stroke="rgba(255,255,255,.75)"/>Finca + Casa</>:<><FmIcon name="sparkle" size={13} stroke="rgba(255,255,255,.75)"/>Solo Finca</>}</span>
          </div>
          <div style={{marginTop:14}}><RvStatusPill r={localR} size="md"/></div>
        </div>
      </div>}

      {/* Desktop header inline */}
      {isDesktopPanel&&<div style={{padding:"20px 20px 0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,gap:16}}>
          <div><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}><span style={{fontSize:11,color:T.ink3,fontWeight:700,letterSpacing:.4}}>#{localR.id?.toString().slice(-6)}</span>{localR.incluye_casa&&<RvTag bg={T.terracotta+"30"} ink={T.ink}>+ Casa</RvTag>}<RvStatusPill r={localR} size="md"/></div><div style={{fontSize:28,fontWeight:700,color:T.ink,letterSpacing:-.8,lineHeight:1.05}}>{localR.nombre}</div><div style={{fontSize:13,color:T.ink3,marginTop:4,fontWeight:500}}>{fechaFmt}</div></div>
        </div>
      </div>}

      <div style={{padding:16}}>
        {/* Bloque cobro */}
        {total>0&&<div style={{background:T.surface,border:`1px solid ${T.line}`,borderRadius:20,padding:16,marginBottom:12}}>
          <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:12}}>
            <div style={{fontSize:11,color:T.ink3,letterSpacing:.6,fontWeight:700,textTransform:"uppercase"}}>Estado de cobro</div>
            <div style={{fontSize:11,color:T.ink3,fontWeight:600}}>{pct}% cobrado</div>
          </div>
          <div style={{display:"flex",gap:10,alignItems:"baseline",marginBottom:10}}>
            <div><div style={{fontSize:10,color:T.ink3,fontWeight:600,letterSpacing:.3,textTransform:"uppercase"}}>Cobrado</div><div style={{fontFamily:T.sans,fontSize:26,fontWeight:700,color:T.olive,letterSpacing:-.7,lineHeight:1}}>{fE(pagado)}</div></div>
            <div style={{color:T.ink4,fontSize:22,fontWeight:300}}>/</div>
            <div><div style={{fontSize:10,color:T.ink3,fontWeight:600,letterSpacing:.3,textTransform:"uppercase"}}>Total</div><div style={{fontFamily:T.sans,fontSize:20,fontWeight:700,color:T.ink,letterSpacing:-.5,lineHeight:1}}>{fE(total)}</div></div>
          </div>
          <div style={{height:12,borderRadius:999,background:T.bg,overflow:"hidden",marginBottom:14}}>
            <div style={{width:pct+"%",height:"100%",background:pct===100?T.olive:`linear-gradient(90deg,${T.olive},${T.gold})`}}/>
          </div>
          {pending>0&&isA&&<div style={{background:T.bg,borderRadius:12,padding:"10px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div><div style={{fontSize:11,color:T.ink3,fontWeight:600}}>Pendiente</div><div style={{fontSize:17,fontWeight:700,color:T.ink,letterSpacing:-.4}}>{fE(pending)}</div></div>
            <div style={{display:"flex",gap:6}}>
              {(localR.estado_pago==="pendiente"||!localR.estado_pago)&&localR.estado!=="cancelada"&&<button onClick={()=>setShowSeña(true)} style={{padding:"10px 14px",borderRadius:999,background:T.ink,color:"#fff",border:0,fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:T.sans}}>Registrar seña</button>}
              {localR.estado_pago==="seña_cobrada"&&<button onClick={()=>setShowPagoTotal(true)} style={{padding:"10px 14px",borderRadius:999,background:T.olive,color:T.ink,border:0,fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:T.sans}}>Cobrar saldo</button>}
            </div>
          </div>}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <RvDesgloseRow label="Finca" value={parseFloat(localR.precio_finca||localR.precio)||0} color={T.olive}/>
            {parseFloat(localR.precio_casa||0)>0&&<RvDesgloseRow label="Casa rural" value={parseFloat(localR.precio_casa)} color={T.softBlue}/>}
            {isA&&<button onClick={()=>{setFormPrecios({precio_finca:String(localR.precio_finca||localR.precio||""),precio_casa:String(localR.precio_casa||""),incluye_casa:!!localR.incluye_casa});setEditPrecios(true);}} style={{marginTop:4,background:"transparent",border:`1px solid ${T.line}`,borderRadius:11,padding:"9px 0",color:T.ink2,fontFamily:T.sans,fontSize:12,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6}}><FmIcon name="edit" size={14} stroke={T.ink2}/>{total>0?"Editar precios":"Añadir precios"}</button>}
          </div>
        </div>}
        {total===0&&isA&&<div style={{background:T.surface,border:`1px solid ${T.line}`,borderRadius:20,padding:16,marginBottom:12}}>
          <div style={{color:T.ink3,fontSize:13,marginBottom:10}}>Sin precios asignados</div>
          <button onClick={()=>{setFormPrecios({precio_finca:"",precio_casa:"",incluye_casa:!!localR.incluye_casa});setEditPrecios(true);}} style={{background:T.ink,color:"white",border:0,borderRadius:12,padding:"12px 16px",fontFamily:T.sans,fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:8}}><FmIcon name="edit" size={14} stroke="white"/>Añadir precios</button>
        </div>}

        {/* Rentabilidad */}
        {total>0&&(()=>{const cL=0,cJ=0,cLav=0,com=Math.round(total*.10);const totalC=cL+cJ+cLav+com;const ben=total-totalC;const marginPct=Math.round(ben/total*100);const fE2=v=>Math.round(v).toLocaleString("es-ES")+"€";return(
        <div style={{background:T.olive,borderRadius:20,padding:16,marginBottom:12,color:T.ink}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
            <div><div style={{fontSize:10.5,fontWeight:700,letterSpacing:.6,textTransform:"uppercase",opacity:.75}}>Rentabilidad</div>
              <div style={{fontFamily:T.sans,fontSize:28,fontWeight:700,letterSpacing:-.9,lineHeight:1}}>+{marginPct}%</div>
              <div style={{fontSize:12,fontWeight:600,opacity:.8,marginTop:4}}>Margen estimado · {fE2(ben)}</div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,background:"rgba(26,26,26,.08)",padding:8,borderRadius:12}}>
            {[["Limpieza",cL],["Jardín",cJ],["Lavand.",cLav],["Comisión",com]].map(([k,v])=>(
              <div key={k} style={{textAlign:"center"}}><div style={{fontSize:9,fontWeight:700,letterSpacing:.3,textTransform:"uppercase",color:T.ink,opacity:.7}}>{k}</div><div style={{fontSize:13,fontWeight:700,color:T.ink,fontFamily:T.sans,letterSpacing:-.2}}>{fE2(v)}</div></div>
            ))}
          </div>
        </div>);})()}

        {/* Contacto */}
        <div style={{fontSize:10.5,color:T.ink3,letterSpacing:.6,fontWeight:700,textTransform:"uppercase",marginBottom:10,marginTop:6}}>Contacto vinculado</div>
        {contacto?<div style={{background:T.surface,border:`1px solid ${T.line}`,borderRadius:18,padding:12,marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:42,height:42,borderRadius:999,background:T.terracotta+"40",color:T.ink,fontFamily:T.sans,fontWeight:700,fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{initials}</div>
            <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:T.ink}}>{contacto.nombre}</div><div style={{fontSize:11,color:T.ink3}}>{contacto.telefono||contacto.email||""}</div></div>
            {contacto.telefono&&<button onClick={()=>window.open("https://wa.me/"+(contacto.telefono||"").replace(/\D/g,""))} style={{width:34,height:34,borderRadius:999,background:T.olive,border:0,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><FmIcon name="whatsapp" size={15} stroke={T.ink}/></button>}
            <button onClick={()=>setVincularContacto(true)} style={{width:34,height:34,borderRadius:999,background:T.bg,border:`1px solid ${T.line}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><FmIcon name="edit" size={14} stroke={T.ink3}/></button>
          </div>
        </div>
        :<div style={{background:T.surface,borderRadius:18,padding:14,border:`1px dashed ${T.line}`,marginBottom:12}}>
          <div style={{fontSize:13,color:T.ink3,textAlign:"center",padding:"4px 0",marginBottom:8}}>Sin contacto asignado</div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setVincularContacto(true)} style={{flex:1,padding:"10px 0",borderRadius:12,border:`1px solid ${T.line}`,background:T.surface,color:T.ink,fontFamily:T.sans,fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><FmIcon name="search" size={13} stroke={T.ink}/>Buscar contacto</button>
            <button onClick={()=>{}} style={{flex:1,padding:"10px 0",borderRadius:12,border:0,background:T.ink,color:"#fff",fontFamily:T.sans,fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><FmIcon name="plus" size={13} stroke="white"/>Nuevo contacto</button>
          </div>
        </div>}
        {/* Sheet vincular contacto */}
        {vincularContacto&&<div style={{position:"fixed",inset:0,background:"rgba(20,15,10,.6)",zIndex:1000,display:"flex",alignItems:"flex-end",fontFamily:T.sans}}>
          <div style={{width:"100%",background:T.bg,borderTopLeftRadius:24,borderTopRightRadius:24,maxHeight:"80vh",overflow:"auto",paddingBottom:28}}>
            <div style={{padding:"14px 0 0",display:"flex",justifyContent:"center"}}><div style={{width:44,height:4,borderRadius:999,background:T.line}}/></div>
            <div style={{padding:"14px 20px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${T.line}`}}><div style={{fontSize:18,fontWeight:700,color:T.ink,letterSpacing:-.4}}>Vincular contacto</div><button onClick={()=>{setVincularContacto(false);setBusqContacto("");}} style={{width:30,height:30,borderRadius:999,background:T.surface,border:`1px solid ${T.line}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><FmIcon name="x" size={13} stroke={T.ink}/></button></div>
            <div style={{padding:"12px 20px 8px"}}><div style={{display:"flex",alignItems:"center",gap:8,background:T.surface,borderRadius:12,padding:"10px 14px",border:`1px solid ${T.line}`}}><FmIcon name="search" size={14} stroke={T.ink3}/><input autoFocus value={busqContacto} onChange={e=>setBusqContacto(e.target.value)} placeholder="Buscar por nombre o teléfono…" style={{flex:1,background:"transparent",border:0,outline:"none",fontFamily:T.sans,fontSize:14,color:T.ink}}/></div></div>
            <div style={{padding:"0 20px 12px",display:"flex",flexDirection:"column",gap:6}}>
              {contactosBusq.map(c=><div key={c.id} onClick={async()=>{await sbPatch("reservas",`id=eq.${localR.id}`,{contacto_id:c.id},tok);const u={...localR,contacto_id:c.id};setLocalR(u);onChanged&&onChanged(u);setContacto(c);setVincularContacto(false);setBusqContacto("");}} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:T.surface,borderRadius:14,border:`1px solid ${T.line}`,cursor:"pointer"}}>
                <div style={{width:40,height:40,borderRadius:999,background:T.olive+"40",color:T.ink,fontWeight:700,fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{c.nombre?.split(" ").map(p=>p[0]).slice(0,2).join("").toUpperCase()||"?"}</div>
                <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:T.ink}}>{c.nombre}</div><div style={{fontSize:11,color:T.ink3}}>{c.telefono||c.email||""}</div></div>
                <FmIcon name="chevR" size={14} stroke={T.ink3}/>
              </div>)}
              {busqContacto&&busqContacto.length>=2&&contactosBusq.length===0&&<div style={{textAlign:"center",padding:"20px 0",color:T.ink3,fontSize:13}}>Sin resultados para "{busqContacto}"</div>}
              {(!busqContacto||busqContacto.length<2)&&<div style={{textAlign:"center",padding:"16px 0",color:T.ink3,fontSize:12}}>Escribe para buscar un contacto</div>}
            </div>
          </div>
        </div>}

        {/* Servicios automáticos */}
        {servicios.length>0&&<><div style={{fontSize:10.5,color:T.ink3,letterSpacing:.6,fontWeight:700,textTransform:"uppercase",marginBottom:10,marginTop:6}}>Servicios automáticos</div>
        <div style={{background:T.surface,border:`1px solid ${T.line}`,borderRadius:18,padding:6,marginBottom:12}}>
          {servicios.slice(0,4).map((s,i)=>{
            const esL=s.tipo?.includes("limpieza");const esJ=s.tipo?.includes("jardin");
            const col=esL?T.lavender:esJ?T.olive:T.gold;const icon=esL?"broom":esJ?"sprout":"calendar";
            const fSvc=s.fecha_checkin_siguiente?new Date(s.fecha_checkin_siguiente+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"}):"—";
            return<div key={s.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 10px",borderBottom:i<Math.min(servicios.length,4)-1?`1px solid ${T.line}`:0}}>
              <div style={{width:36,height:36,borderRadius:10,background:col+"50",display:"flex",alignItems:"center",justifyContent:"center"}}><FmIcon name={icon} size={16} stroke={T.ink}/></div>
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:T.ink}}>{esL?"Limpieza":esJ?"Jardinería":"Servicio"} {s.tipo?.includes("pre")?"pre-evento":"post-evento"}</div><div style={{fontSize:11,color:T.ink3}}>{fSvc}</div></div>
              <FmIcon name={s.estado==="completado"?"check":"clock"} size={16} stroke={s.estado==="completado"?T.olive:T.gold}/>
            </div>;
          })}
        </div></>}

        <TareasComerciales entidad_tipo="reserva" entidad_id={localR.id} entidad_nombre={localR.nombre} tok={tok} perfil={perfil||{nombre:"Admin"}} rol={rol}/>
        <Historial entidad_tipo="reserva" entidad_id={localR.id} tok={tok} perfil={perfil||{nombre:"Admin"}}/>
        <Documentos entidad_tipo="reserva" entidad_id={localR.id} tok={tok} perfil={perfil||{nombre:"Admin"}}/>
        <VisitasCoordinacion reservaId={localR.id} reservaNombre={localR.nombre} tok={tok} perfil={perfil||{nombre:"Admin"}}/>
        {isA&&<button onClick={onClose} style={{width:"100%",padding:"13px 16px",borderRadius:14,border:`1px solid ${T.line}`,background:T.surface,color:T.danger,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:T.sans,marginTop:8}}>← Volver a reservas</button>}
      </div>

      {/* Modales cobro */}
      {/* Sheet cobro */}
      {showSeña&&<div style={{position:"fixed",inset:0,background:"rgba(20,15,10,.6)",zIndex:999,display:"flex",alignItems:"flex-end",fontFamily:T.sans}}>
        <div style={{width:"100%",background:T.bg,borderTopLeftRadius:24,borderTopRightRadius:24,maxHeight:"88vh",overflow:"auto",paddingBottom:34}} onClick={e=>e.stopPropagation()}>
          <div style={{padding:"14px 20px 0",display:"flex",justifyContent:"center"}}><div style={{width:44,height:4,borderRadius:999,background:T.line}}/></div>
          <div style={{padding:"14px 20px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${T.line}`}}>
            <div><div style={{fontSize:12,color:T.ink3,fontWeight:500,marginBottom:2}}>{localR.nombre}</div><div style={{fontSize:22,fontWeight:700,color:T.ink,letterSpacing:-.6}}>Registrar cobro</div></div>
            <button onClick={()=>setShowSeña(false)} style={{width:32,height:32,borderRadius:999,background:T.surface,border:`1px solid ${T.line}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><FmIcon name="x" size={15} stroke={T.ink}/></button>
          </div>
          <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:14}}>
            <div style={{background:"linear-gradient(135deg,#1A1A1A,#2a2520)",borderRadius:18,padding:16,color:"#fff"}}>
              <div style={{fontSize:10,color:"rgba(255,255,255,.6)",letterSpacing:1,textTransform:"uppercase",fontWeight:700,marginBottom:4}}>Pendiente de cobro</div>
              <div style={{fontSize:34,fontWeight:700,letterSpacing:-1,lineHeight:1}}>{fE(pending)}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,.5)",marginTop:6}}>Total {fE(total)} · Cobrado {fE(pagado)}</div>
            </div>
            <div>
              <div style={{fontSize:11,color:T.ink3,fontWeight:700,letterSpacing:.5,textTransform:"uppercase",marginBottom:8}}>Importe a cobrar</div>
              <div style={{display:"flex",alignItems:"center",gap:12,background:T.surface,border:`1px solid ${T.line}`,borderRadius:16,padding:"14px 16px"}}>
                <input type="number" inputMode="decimal" value={señaImporte} onChange={e=>setSeñaImporte(e.target.value)} placeholder="0" autoFocus style={{flex:1,background:"transparent",border:0,outline:"none",fontFamily:T.sans,fontSize:26,fontWeight:700,color:T.ink,letterSpacing:-.6}}/>
                <span style={{fontSize:20,fontWeight:700,color:T.ink3}}>€</span>
              </div>
              <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
                {[{l:"Señal 20%",v:Math.round(total*.2)},{l:"50%",v:Math.round(total*.5)},{l:"Total pdte",v:Math.round(pending)}].map((q,i)=><button key={i} onClick={()=>setSeñaImporte(String(q.v))} style={{padding:"7px 12px",borderRadius:999,border:`1px solid ${T.line}`,background:T.surface,color:T.ink2,fontFamily:T.sans,fontSize:11,fontWeight:700,cursor:"pointer"}}>{q.l} · {fE(q.v)}</button>)}
              </div>
            </div>
            {/* Método de pago */}
            <div>
              <div style={{fontSize:11,color:T.ink3,fontWeight:700,letterSpacing:.5,textTransform:"uppercase",marginBottom:8}}>Método de pago</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {[{k:"transferencia",l:"Transferencia",i:"arrow"},{k:"efectivo",l:"Efectivo",i:"euro"},{k:"bizum",l:"Bizum",i:"phone"},{k:"tarjeta",l:"Tarjeta",i:"key"}].map(m=>{const on=(señaMetodo||"transferencia")===m.k;return<button key={m.k} onClick={()=>setSeñaMetodo(m.k)} style={{padding:"12px 10px",borderRadius:14,border:`1px solid ${on?T.ink:T.line}`,background:on?T.ink:T.surface,color:on?"#fff":T.ink,fontFamily:T.sans,fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:7}}><FmIcon name={m.i} size={14} stroke={on?"#fff":T.ink}/>{m.l}</button>;})}
              </div>
            </div>
            <div style={{display:"flex",gap:8,paddingTop:4}}>
              <button onClick={()=>setShowSeña(false)} style={{flex:1,padding:"14px 0",borderRadius:999,border:`1px solid ${T.line}`,background:T.surface,color:T.ink,fontFamily:T.sans,fontWeight:600,fontSize:14,cursor:"pointer"}}>Cancelar</button>
              <button onClick={regSeña} disabled={cobroSaving||!señaImporte} style={{flex:2,padding:"14px 0",borderRadius:999,border:0,background:cobroSaving||!señaImporte?T.ink+"55":T.ink,color:"#fff",fontFamily:T.sans,fontWeight:700,fontSize:14,cursor:cobroSaving||!señaImporte?"not-allowed":"pointer",opacity:cobroSaving||!señaImporte?.5:1}}>{cobroSaving?"Guardando…":"Confirmar cobro"}</button>
            </div>
          </div>
        </div>
      </div>}
      {/* Sheet pago total */}
      {showPagoTotal&&<div style={{position:"fixed",inset:0,background:"rgba(20,15,10,.6)",zIndex:999,display:"flex",alignItems:"flex-end",fontFamily:T.sans}}>
        <div style={{width:"100%",background:T.bg,borderTopLeftRadius:24,borderTopRightRadius:24,paddingBottom:34}} onClick={e=>e.stopPropagation()}>
          <div style={{padding:"14px 20px 0",display:"flex",justifyContent:"center"}}><div style={{width:44,height:4,borderRadius:999,background:T.line}}/></div>
          <div style={{padding:"14px 20px 16px",borderBottom:`1px solid ${T.line}`}}><div style={{fontSize:22,fontWeight:700,color:T.ink,letterSpacing:-.6}}>Confirmar pago total</div></div>
          <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:14}}>
            <div style={{fontSize:13,color:T.ink,fontWeight:600}}>{localR.nombre}</div>
            <div style={{fontSize:12,color:T.ink3}}>Saldo pendiente: <strong style={{color:T.ink}}>{fE(pending)}</strong></div>
            <div style={{background:T.olive+"14",borderRadius:12,padding:"10px 12px",fontSize:12,color:"#4A7A2E"}}>✅ Se generará el gasto de comisión del gestor automáticamente</div>
            <div style={{display:"flex",gap:8}}><button onClick={()=>setShowPagoTotal(false)} style={{flex:1,padding:"14px 0",borderRadius:999,border:`1px solid ${T.line}`,background:T.surface,color:T.ink,fontFamily:T.sans,fontWeight:600,fontSize:14,cursor:"pointer"}}>Cancelar</button><button onClick={regPago} disabled={cobroSaving} style={{flex:2,padding:"14px 0",borderRadius:999,border:0,background:T.olive,color:T.ink,fontFamily:T.sans,fontWeight:700,fontSize:14,cursor:"pointer"}}>{cobroSaving?"Procesando…":"Confirmar pago"}</button></div>
          </div>
        </div>
      </div>}
      {/* Sheet editar precios */}
      {editPrecios&&<div style={{position:"fixed",inset:0,background:"rgba(20,15,10,.6)",zIndex:1000,display:"flex",alignItems:"flex-end",fontFamily:T.sans}}>
        <div style={{width:"100%",background:T.bg,borderTopLeftRadius:24,borderTopRightRadius:24,maxHeight:"88vh",overflow:"auto",paddingBottom:34}} onClick={e=>e.stopPropagation()}>
          <div style={{padding:"14px 20px 0",display:"flex",justifyContent:"center"}}><div style={{width:44,height:4,borderRadius:999,background:T.line}}/></div>
          <div style={{padding:"14px 20px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${T.line}`}}>
            <div style={{fontSize:22,fontWeight:700,color:T.ink,letterSpacing:-.6}}>Editar precios</div>
            <button onClick={()=>setEditPrecios(false)} style={{width:32,height:32,borderRadius:999,background:T.surface,border:`1px solid ${T.line}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><FmIcon name="x" size={15} stroke={T.ink}/></button>
          </div>
          <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:14}}>
            {/* Preview total */}
            <div style={{background:T.surface,borderRadius:16,padding:"12px 14px",border:`1px solid ${T.line}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{fontSize:12,color:T.ink3,fontWeight:500}}>Total reserva</div><div style={{fontSize:20,fontWeight:700,color:T.ink,letterSpacing:-.5}}>{fE((parseFloat(formPrecios.precio_finca)||0)+(formPrecios.incluye_casa?parseFloat(formPrecios.precio_casa)||0:0))}</div></div>
            <div><div style={{fontSize:11,color:T.ink3,fontWeight:700,letterSpacing:.5,textTransform:"uppercase",marginBottom:8}}>Precio finca</div><div style={{display:"flex",alignItems:"center",gap:10,background:T.surface,border:`1px solid ${T.line}`,borderRadius:14,padding:"13px 16px"}}><input type="number" value={formPrecios.precio_finca} onChange={e=>setFormPrecios(v=>({...v,precio_finca:e.target.value}))} placeholder="0" style={{flex:1,background:"transparent",border:0,outline:"none",fontFamily:T.sans,fontSize:22,fontWeight:700,color:T.ink}}/><span style={{fontSize:16,color:T.ink3,fontWeight:700}}>€</span></div></div>
            {/* Toggle casa */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"4px 0"}}><div><div style={{fontSize:13,fontWeight:600,color:T.ink}}>Incluye casa rural</div><div style={{fontSize:11,color:T.ink3,marginTop:2}}>Alojamiento adicional</div></div><button onClick={()=>setFormPrecios(v=>({...v,incluye_casa:!v.incluye_casa}))} style={{width:44,height:24,borderRadius:999,background:formPrecios.incluye_casa?T.olive:T.line,border:0,cursor:"pointer",position:"relative",transition:"background .2s"}}><div style={{width:18,height:18,borderRadius:999,background:"white",position:"absolute",top:3,left:formPrecios.incluye_casa?23:3,transition:"left .2s"}}/></button></div>
            {formPrecios.incluye_casa&&<div><div style={{fontSize:11,color:T.ink3,fontWeight:700,letterSpacing:.5,textTransform:"uppercase",marginBottom:8}}>Precio casa</div><div style={{display:"flex",alignItems:"center",gap:10,background:T.surface,border:`1px solid ${T.line}`,borderRadius:14,padding:"13px 16px"}}><input type="number" value={formPrecios.precio_casa} onChange={e=>setFormPrecios(v=>({...v,precio_casa:e.target.value}))} placeholder="0" style={{flex:1,background:"transparent",border:0,outline:"none",fontFamily:T.sans,fontSize:22,fontWeight:700,color:T.ink}}/><span style={{fontSize:16,color:T.ink3,fontWeight:700}}>€</span></div></div>}
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setEditPrecios(false)} style={{flex:1,padding:"14px 0",borderRadius:999,border:`1px solid ${T.line}`,background:T.surface,color:T.ink,fontFamily:T.sans,fontWeight:600,fontSize:14,cursor:"pointer"}}>Cancelar</button>
              <button onClick={async()=>{const pf=parseFloat(formPrecios.precio_finca)||0;const pc=formPrecios.incluye_casa?parseFloat(formPrecios.precio_casa)||0:0;const nt=pf+pc;await sbPatch("reservas",`id=eq.${localR.id}`,{precio_finca:pf,precio_casa:pc,precio_total:nt,precio:nt,incluye_casa:formPrecios.incluye_casa},tok);const u={...localR,precio_finca:pf,precio_casa:pc,precio_total:nt,precio:nt,incluye_casa:formPrecios.incluye_casa};setLocalR(u);onChanged&&onChanged(u);setEditPrecios(false);}} style={{flex:2,padding:"14px 0",borderRadius:999,border:0,background:T.ink,color:"#fff",fontFamily:T.sans,fontWeight:700,fontSize:14,cursor:"pointer"}}>Guardar precios</button>
            </div>
          </div>
        </div>
      </div>}
    </div>
  );
}

// ─── DETALLE RESERVA AIRBNB (overlay) ────────────────────────────────────────
function RvBnbDetail({reserva,tok,perfil,onClose,onChanged}){
  const [localR,setLocalR]=useState(reserva);
  const dias=localR.fecha_entrada&&localR.fecha_salida?Math.ceil((new Date(localR.fecha_salida+"T12:00:00")-new Date(localR.fecha_entrada+"T12:00:00"))/(864e5)):0;
  const precio=parseFloat(localR.precio)||0;
  const cobrado=localR.cobrado?precio:0;
  const pct=precio>0?Math.round(cobrado/precio*100):0;
  const fE=v=>(Math.round(parseFloat(v)||0)).toLocaleString("es-ES")+"€";
  const inFmt=localR.fecha_entrada?new Date(localR.fecha_entrada+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"}):"—";
  const outFmt=localR.fecha_salida?new Date(localR.fecha_salida+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"}):"—";
  const initials=(localR.huesped||"").split(" ").map(p=>p[0]).slice(0,2).join("").toUpperCase()||"?";
  const [saving,setSaving]=useState(false);
  const gBtn={width:36,height:36,borderRadius:999,background:"rgba(255,255,255,.14)",border:0,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"};

  const regCobro=async()=>{
    if(saving)return;setSaving(true);
    try{await sbPatch("reservas_airbnb",`id=eq.${localR.id}`,{cobrado:true},tok);
      await addHistorial("reserva_airbnb",localR.id,`Cobro registrado: ${fE(precio)}`,perfil?.nombre||"Admin",tok).catch(()=>{});
      const u={...localR,cobrado:true};setLocalR(u);onChanged&&onChanged(u);}catch(_){}setSaving(false);
  };

  return(
    <div style={{position:"fixed",inset:0,background:T.bg,zIndex:200,overflow:"auto",paddingBottom:40}}>
      {/* Hero azul */}
      <div style={{background:"linear-gradient(165deg,#1E3A5F 0%,#0E0E0E 100%)",paddingTop:54,paddingBottom:22,paddingLeft:20,paddingRight:20,color:"#fff",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",right:-30,top:-40,width:220,height:220,borderRadius:999,background:T.softBlue+"55",filter:"blur(45px)"}}/>
        <div style={{position:"relative",display:"flex",justifyContent:"space-between",marginBottom:22}}>
          <button onClick={onClose} style={gBtn}><FmIcon name="chevL" size={16} stroke="#fff"/></button>
          <span style={{fontSize:11,padding:"4px 10px",borderRadius:999,background:"rgba(255,255,255,.12)",color:"#fff",fontWeight:700}}>Airbnb</span>
        </div>
        <div style={{position:"relative"}}>
          <div style={{fontSize:11,letterSpacing:1,textTransform:"uppercase",opacity:.65,fontWeight:600}}>Alojamiento vacacional</div>
          <div style={{fontFamily:T.sans,fontSize:28,fontWeight:700,letterSpacing:-1,lineHeight:1.05,marginTop:4}}>{localR.huesped}</div>
          <div style={{display:"flex",gap:14,marginTop:14}}>
            <div><div style={{fontSize:10,opacity:.6,letterSpacing:.5,fontWeight:600,textTransform:"uppercase"}}>Check-in</div><div style={{fontWeight:700,fontSize:15}}>{inFmt}</div></div>
            <div style={{fontSize:20,opacity:.4,alignSelf:"center"}}>→</div>
            <div><div style={{fontSize:10,opacity:.6,letterSpacing:.5,fontWeight:600,textTransform:"uppercase"}}>Check-out</div><div style={{fontWeight:700,fontSize:15}}>{outFmt}</div></div>
            <div style={{marginLeft:"auto",textAlign:"right"}}><div style={{fontSize:10,opacity:.6,letterSpacing:.5,fontWeight:600,textTransform:"uppercase"}}>Noches</div><div style={{fontWeight:700,fontSize:15}}>{dias}</div></div>
          </div>
          <div style={{marginTop:16}}><RvStatusPill r={localR} size="md"/></div>
        </div>
      </div>

      <div style={{padding:16}}>
        {/* Cobro */}
        <div style={{background:T.surface,border:`1px solid ${T.line}`,borderRadius:20,padding:16,marginBottom:12}}>
          <div style={{fontSize:11,color:T.ink3,letterSpacing:.6,fontWeight:700,textTransform:"uppercase",marginBottom:10}}>Cobro</div>
          <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between"}}>
            <div style={{fontFamily:T.sans,fontSize:30,fontWeight:700,color:T.ink,letterSpacing:-.9,lineHeight:1}}>{fE(precio)}</div>
            <div style={{fontSize:11,color:T.ink3}}>{dias} noches · {fE(Math.round(precio/Math.max(dias,1)))}/n</div>
          </div>
          <div style={{height:10,borderRadius:999,background:T.bg,overflow:"hidden",margin:"14px 0"}}>
            <div style={{width:pct+"%",height:"100%",background:localR.cobrado?T.olive:T.gold}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:12,color:T.ink3,fontWeight:600}}>Cobrado <span style={{color:T.ink,fontWeight:700}}>{fE(cobrado)}</span></div>
            {!localR.cobrado&&precio>0&&<button onClick={regCobro} disabled={saving} style={{padding:"10px 14px",borderRadius:999,background:T.ink,color:"#fff",border:0,fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:T.sans}}>{saving?"…":"Cobrar "}{!saving&&fE(precio)}</button>}
          </div>
        </div>

        {/* Huésped */}
        <div style={{fontSize:10.5,color:T.ink3,letterSpacing:.6,fontWeight:700,textTransform:"uppercase",marginBottom:10,marginTop:6}}>Huésped</div>
        <div style={{background:T.surface,border:`1px solid ${T.line}`,borderRadius:18,padding:12,marginBottom:12,display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:44,height:44,borderRadius:999,background:T.softBlue,color:T.ink,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.sans,fontWeight:700}}>{initials}</div>
          <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,color:T.ink}}>{localR.huesped}</div><div style={{fontSize:11,color:T.ink3}}>{localR.personas?`${localR.personas} personas · `:""}Airbnb</div></div>
        </div>

        {/* Notas */}
        {localR.notas&&<div style={{background:T.surface,border:`1px solid ${T.line}`,borderRadius:14,padding:12,marginBottom:12}}>
          <div style={{fontSize:10,color:T.ink3,fontWeight:600,letterSpacing:.3,textTransform:"uppercase",marginBottom:5}}>Notas</div>
          <div style={{fontSize:13,color:T.ink,lineHeight:1.5}}>{localR.notas}</div>
        </div>}

        <Historial entidad_tipo="reserva_airbnb" entidad_id={localR.id} tok={tok} perfil={perfil||{nombre:"Admin"}}/>
        <button onClick={onClose} style={{width:"100%",padding:"13px 16px",borderRadius:14,border:`1px solid ${T.line}`,background:T.surface,color:T.ink3,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:T.sans,marginTop:8}}>← Volver a reservas</button>
      </div>
    </div>
  );
}

// ─── DESKTOP RESERVAS ─────────────────────────────────────────────────────────
function AppSidebarDesktop({page,setPage,perfil,noVistos}){
  const nav=[{k:"home",i:"home",l:"Inicio",g:"principal"},{k:"contactos",i:"users",l:"Contactos",g:"principal"},{k:"reservas",i:"calendar",l:"Reservas",g:"principal"},{k:"almacen",i:"box",l:"Almacén",g:"principal"},{k:"gastos",i:"euro",l:"Gastos",g:"finanzas"},{k:"analisis",i:"chart",l:"Análisis",g:"finanzas"},{k:"limpieza",i:"settings",l:"Limpieza",g:"operaciones"},{k:"jadmin",i:"leaf",l:"Jardinería",g:"operaciones"},{k:"chat",i:"mail",l:"Mensajes",g:"comunicacion"},{k:"notifs",i:"bell",l:"Alertas",g:"comunicacion",badge:noVistos?.total||0},{k:"usuarios",i:"users",l:"Usuarios",g:"config"},{k:"ajustes",i:"settings",l:"Ajustes",g:"config"}];
  const gs=["principal","finanzas","operaciones","comunicacion","config"];
  const gl={principal:"Principal",finanzas:"Finanzas",operaciones:"Operaciones",comunicacion:"Comunicación",config:"Configuración"};
  return<div style={{width:240,background:T.ink,color:"#fff",display:"flex",flexDirection:"column",flexShrink:0,height:"100vh",position:"sticky",top:0}}>
    <div style={{padding:"22px 20px 18px",borderBottom:"1px solid rgba(255,255,255,.1)"}}><div style={{display:"flex",alignItems:"center",gap:10}}><LogoMark size={28}/><div><div style={{fontSize:15,fontWeight:700,letterSpacing:-.3}}>Finca El Molino</div><div style={{fontSize:10,color:"rgba(255,255,255,.5)",letterSpacing:1,textTransform:"uppercase",fontWeight:600,marginTop:1}}>Admin · {perfil?.nombre?.split(" ")[0]||"Admin"}</div></div></div></div>
    <div style={{flex:1,overflow:"auto",padding:"14px 12px"}}>{gs.map(g=><div key={g} style={{marginBottom:12}}><div style={{fontSize:9,color:"rgba(255,255,255,.35)",fontWeight:700,letterSpacing:1.1,textTransform:"uppercase",padding:"4px 10px 6px"}}>{gl[g]}</div>{nav.filter(n=>n.g===g).map(n=>{const on=n.k===page;return<button key={n.k} onClick={()=>setPage(n.k)} style={{width:"100%",padding:"8px 10px",borderRadius:10,background:on?"rgba(255,255,255,.1)":"transparent",color:on?"#fff":"rgba(255,255,255,.7)",border:0,textAlign:"left",cursor:"pointer",fontFamily:T.sans,display:"flex",alignItems:"center",gap:10,marginBottom:1}}><FmIcon name={n.i} size={15} stroke={on?"#fff":"rgba(255,255,255,.7)"} sw={on?2.2:1.8}/><span style={{flex:1,fontSize:12.5,fontWeight:on?700:500,letterSpacing:-.1}}>{n.l}</span>{n.badge>0&&<span style={{fontSize:9.5,padding:"2px 6px",borderRadius:999,background:T.terracotta,color:T.ink,fontWeight:700}}>{n.badge}</span>}</button>;})}</div>)}</div>
    <div style={{padding:14,borderTop:"1px solid rgba(255,255,255,.1)",display:"flex",alignItems:"center",gap:10}}><div style={{width:34,height:34,borderRadius:10,background:T.terracotta,color:T.ink,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,flexShrink:0}}>{perfil?.nombre?.slice(0,1)||"A"}</div><div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{perfil?.nombre||"Administrador"}</div><div style={{fontSize:10,color:"rgba(255,255,255,.5)"}}>Administrador</div></div></div>
  </div>;
}

function sMeta(s){const m={Visita:{bg:"#E9F0FC",ink:"#2B4B80",dot:"#7FB2FF"},Confirmada:{bg:"#FBF3C7",ink:"#7A6B15",dot:"#ECD227"},"Seña OK":{bg:"#F8DCC4",ink:"#8F4A1C",dot:"#EC683E"},Pagado:{bg:"#DCE8BC",ink:"#4D6B1F",dot:"#7E9B3E"},Finalizada:{bg:"#EEEAE3",ink:"#7A766F",dot:"#BFB9AE"},Cancelada:{bg:"#F5E0DE",ink:"#9B3C33",dot:"#D9443A"},Cobrado:{bg:"#DCE8BC",ink:"#4D6B1F",dot:"#7E9B3E"},Pendiente:{bg:"#FBDCDC",ink:"#9B3C33",dot:"#F35757"}};return m[s]||m.Visita;}
function ReservasDesktopLayout({reservas,airbnbs,setPage,page,perfil,tok,abrirReserva,selAb,setSelAb,sel,setSel,contactoVinc,setShowTipoRes,setEditPrecios,setShowSeña}){
  const[tab,setTab]=useState("activas");const[busq,setBusq]=useState("");
  const fE=v=>(Math.round(parseFloat(v)||0)).toLocaleString("es-ES")+"€";
  const lista=tab==="activas"?reservas.filter(r=>!["cancelada","finalizada"].includes(r.estado||"")):tab==="airbnb"?airbnbs:tab==="finalizadas"?reservas.filter(r=>r.estado==="finalizada"):reservas.filter(r=>r.estado==="cancelada");
  const listaF=busq?lista.filter(r=>(r.nombre||r.huesped||"").toLowerCase().includes(busq.toLowerCase())||(r.id||"").toString().includes(busq)):lista;
  const selActivo=tab==="airbnb"?selAb:sel;
  const navItems=[{k:"home",i:"home",l:"Inicio"},{k:"contactos",i:"users",l:"Contactos"},{k:"reservas",i:"calendar",l:"Reservas"},{k:"almacen",i:"box",l:"Almacén"},{k:"analisis",i:"chart",l:"Análisis"},{k:"limpieza",i:"settings",l:"Limpieza"},{k:"jadmin",i:"leaf",l:"Jardinería"},{k:"gastos",i:"euro",l:"Gastos"},{k:"ajustes",i:"settings",l:"Ajustes"}];
  return <div style={{display:"flex",background:T.bg,fontFamily:T.sans,height:"100vh",color:T.ink,overflow:"hidden",position:"fixed",inset:0,zIndex:1}}>
    <AppSidebarDesktop page={page} setPage={setPage} perfil={perfil}/>
    {/* Panel lista */}
    <div style={{width:380,borderRight:`1px solid ${T.line}`,background:T.surface,display:"flex",flexDirection:"column",height:"100vh",flexShrink:0}}>
      <div style={{padding:"20px 18px 12px",borderBottom:`1px solid ${T.line}`,flexShrink:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div><div style={{fontSize:10,color:T.ink3,fontWeight:700,letterSpacing:.8,textTransform:"uppercase"}}>{new Date().getFullYear()} · Reservas</div><div style={{fontSize:24,fontWeight:700,letterSpacing:-.8,lineHeight:1.1,marginTop:2}}>{tab==="activas"?"Eventos":tab==="airbnb"?"Airbnb":tab==="finalizadas"?"Finalizadas":"Canceladas"}</div></div>
          <button onClick={()=>setShowTipoRes&&setShowTipoRes(true)} style={{height:36,padding:"0 14px",borderRadius:999,background:T.ink,color:"#fff",border:0,fontFamily:T.sans,fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6,flexShrink:0}}><FmIcon name="plus" size={13} stroke="#fff" sw={2.5}/>Nueva</button>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,background:T.bg,borderRadius:12,padding:"9px 12px",marginBottom:12,border:`1px solid ${T.line}`}}><FmIcon name="search" size={14} stroke={T.ink3}/><input value={busq} onChange={e=>setBusq(e.target.value)} placeholder="Buscar reserva…" style={{flex:1,background:"transparent",border:0,outline:"none",fontFamily:T.sans,fontSize:13,color:T.ink}}/>{busq&&<button onClick={()=>setBusq("")} style={{background:"transparent",border:0,cursor:"pointer",padding:0,display:"flex",alignItems:"center"}}><FmIcon name="x" size={13} stroke={T.ink3}/></button>}</div>
        <div style={{display:"flex",gap:2,background:T.bg,borderRadius:999,padding:3}}>
          {[{k:"activas",l:"Eventos",c:reservas.filter(r=>!["cancelada","finalizada"].includes(r.estado||"")).length},{k:"airbnb",l:"Airbnb",c:airbnbs.length},{k:"finalizadas",l:"Final.",c:reservas.filter(r=>r.estado==="finalizada").length},{k:"canceladas",l:"Cancel.",c:reservas.filter(r=>r.estado==="cancelada").length}].map(t=><button key={t.k} onClick={()=>{setTab(t.k);setSel(null);setSelAb(null);}} style={{flex:1,padding:"7px 4px",borderRadius:999,border:0,cursor:"pointer",background:tab===t.k?T.ink:"transparent",color:tab===t.k?"#fff":T.ink2,fontWeight:700,fontSize:10.5,fontFamily:T.sans,whiteSpace:"nowrap"}}>{t.l} <span style={{opacity:.6,fontSize:9}}>{t.c}</span></button>)}
        </div>
      </div>
      <div style={{flex:1,overflow:"auto",padding:"8px 10px"}}>
        {listaF.map(r=>{const on=selActivo?.id===r.id;const eL=r.cobrado?"Cobrado":r.estado_pago==="pagado_completo"?"Pagado":r.seña_cobrada?"Seña OK":r.estado==="cancelada"?"Cancelada":r.estado==="finalizada"?"Finalizada":r.estado==="confirmada"?"Confirmada":"Visita";const m=sMeta(eL);const fechaL=r.fecha?new Date(r.fecha+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"}):r.fecha_entrada?new Date(r.fecha_entrada+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"})+" → "+new Date(r.fecha_salida+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"}):"—";
          return<div key={r.id} onClick={()=>tab==="airbnb"?setSelAb(r):abrirReserva(r)} style={{borderRadius:14,padding:"12px 13px",marginBottom:5,cursor:"pointer",background:on?T.ink:"transparent",border:`1px solid ${on?T.ink2:T.line}`,transition:"all .1s"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:10,fontWeight:700,letterSpacing:.4,color:on?"rgba(255,255,255,.5)":T.ink3}}>#{r.id?.toString().slice(-6)||r.id}</span><span style={{fontSize:11,color:on?"rgba(255,255,255,.6)":T.ink3,fontWeight:500}}>{fechaL}</span></div>
            <div style={{fontSize:13.5,fontWeight:700,letterSpacing:-.25,marginBottom:6,color:on?"#fff":T.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.nombre||r.huesped}</div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>{on?<span style={{fontSize:10.5,color:"rgba(255,255,255,.6)",fontWeight:600}}>{eL}</span>:<span style={{display:"inline-flex",alignItems:"center",gap:4,height:19,padding:"0 7px",borderRadius:999,background:m.bg,color:m.ink,fontSize:10,fontWeight:700}}><span style={{width:4,height:4,borderRadius:999,background:m.dot}}/>{eL}</span>}<span style={{fontSize:13,fontWeight:700,color:on?"#fff":T.ink,letterSpacing:-.3}}>{fE(getPrecioReserva(r))}</span></div>
          </div>;})}
        {listaF.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:T.ink3,fontSize:13}}>Sin resultados</div>}
      </div>
    </div>
    {/* Panel detalle — usa RvEventDetail en modo desktop */}
    <div style={{flex:1,overflow:"auto",background:T.bg,minWidth:0}}>
      {!selActivo?<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",flexDirection:"column",gap:14,color:T.ink3}}><FmIcon name="calendar" size={44} stroke={T.line}/><div style={{fontSize:15,fontWeight:500}}>Selecciona una reserva</div><div style={{fontSize:12,color:T.ink4}}>Verás aquí los detalles, cobros y rentabilidad</div></div>
      :<RvEventDetail reserva={selActivo} tok={tok} perfil={perfil} rol="admin" isA={true} isDesktopPanel={true} onClose={()=>{tab==="airbnb"?setSelAb(null):setSel(null);}} onChanged={u=>{if(tab==="airbnb")setSelAb(u);else{setSel(u);}}}/> }
    </div>
  </div>;
}

function MiniBarChart({data,color}){const max=Math.max(...data.map(d=>d.v),1);const h=60;return<div><div style={{display:"flex",alignItems:"flex-end",gap:3,height:h}}>{data.map((d,i)=><div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",height:h}}><div style={{width:"100%",height:Math.max(2,d.v/max*h),background:d.v>0?color:T.line,borderRadius:3}}/></div>)}</div><div style={{display:"flex",gap:3,marginTop:4}}>{data.map((d,i)=><div key={i} style={{flex:1,textAlign:"center",fontSize:8,color:T.ink3,fontWeight:600}}>{d.l}</div>)}</div></div>;}

function DashA({reservas,jsem,jpunt,cwk,setPage,tok,perfil,rol,goToItem}){
  const[tareasPend,setTareasPend]=useState([]);const[contactosDestacados,setContactosDestacados]=useState([]);
  const[kpiData,setKpiData]=useState(null);const[airbnbs,setAirbnbs]=useState([]);
  const[rangeEvol,setRangeEvol]=useState("mensual");const[kpiAbierto,setKpiAbierto]=useState(null);
  const[coordsPend,setCoordsPend]=useState([]);const[articulosDash,setArticulosDash]=useState([]);const[visitasDash,setVisitasDash]=useState([]);
  useEffect(()=>{autoCobrarAirbnb(tok);ejecutarMotorCoordinacion(tok);
    const hoyLoad=new Date().toISOString().split("T")[0];
    sbGet("tareas_comerciales","?estado=eq.pendiente&order=fecha_limite.asc.nullslast&limit=10&select=*",tok).then(setTareasPend).catch(()=>{});
    sbGet("contactos","?order=updated_at.desc&limit=3&estado=neq.perdido&select=*",tok).then(setContactosDestacados).catch(()=>{});
    sbGet("coordinacion_servicios",`?estado=in.(preguntando_si_lista,servicio_creado_pendiente_fecha,pendiente_aprobacion_admin)&select=*&limit=10`,tok).then(setCoordsPend).catch(()=>{});
    sbGet("almacen_articulos","?activo=neq.false&select=nombre,stock_casa,stock_almacen,stock_minimo",tok).then(setArticulosDash).catch(()=>{});
    sbGet("visitas",`?fecha=eq.${hoyLoad}&estado=eq.pendiente&select=*`,tok).then(setVisitasDash).catch(()=>{});
    (async()=>{try{
      const año=new Date().getFullYear();const hoyStr=new Date().toISOString().split("T")[0];
      const[res,abs,gastos,cfgR]=await Promise.all([sbGet("reservas",`?fecha=gte.${año}-01-01&fecha=lte.${año}-12-31&select=*`,tok),sbGet("reservas_airbnb",`?fecha_entrada=gte.${año}-01-01&fecha_entrada=lte.${año}-12-31&select=*`,tok),sbGet("gastos",`?fecha=gte.${año}-01-01&fecha=lte.${año}-12-31&select=*`,tok).catch(()=>[]),sbGet("configuracion","?select=*",tok).catch(()=>[])]);
      setAirbnbs(abs);const cfg={};cfgR.forEach(c=>cfg[c.clave]=c.valor);const comPct=parseFloat(cfg.comision_pct)||10;
      const fE=res.reduce((s,r)=>s+getPrecioReserva(r),0);const fA=abs.reduce((s,a)=>s+(parseFloat(a.precio)||0),0);const fac=fE+fA;
      let cE=0;for(const r of res){const sn=parseFloat(r.seña_importe)||0;const pt=parseFloat(r.precio_total)||parseFloat(r.precio)||0;if(r.seña_cobrada)cE+=sn;if(r.saldo_cobrado)cE+=(pt-sn);}
      const cA=abs.filter(a=>a.cobrado||a.fecha_entrada<hoyStr).reduce((s,a)=>s+(parseFloat(a.precio)||0),0);
      const yC=cE+cA;const pend=fac-yC;const gR=gastos.reduce((s,g)=>s+(parseFloat(g.importe)||0),0);const ben=yC-gR;const com=fac*(comPct/100);
      setKpiData({facturacion:fac,yaCobrado:yC,pendiente:pend,gastosReales:gR,beneficio:ben,comision:com,comPct,fE,fA,reservas:res,airbnbs:abs,gastos});
    }catch(_){}})();
  },[]);
  const[meteo,setMeteo]=useState(null);
  const cargarMeteo=()=>fetchMeteo().then(d=>{if(d)setMeteo(d);});
  useEffect(()=>{localStorage.removeItem("fm_meteo_cache");cargarMeteo();},[]);
  const hoyS=new Date().toISOString().split("T")[0];
  const fmtE=v=>(Math.round(parseFloat(v)||0)).toLocaleString("es-ES")+"€";

  // Donut data
  const totalEv=kpiData?kpiData.fE:0;const totalAb=kpiData?kpiData.fA:0;const totalGen=totalEv+totalAb||1;
  const pctEv=Math.round(totalEv/totalGen*100);const pctAb=100-pctEv;
  // Donut SVG arcs
  const donutR=48,donutR2=32,cx=60,cy=60;
  const angEv=pctEv/100*360;const rad=Math.PI/180;
  const arcEv=angEv>0?`M${cx+donutR} ${cy} A${donutR} ${donutR} 0 ${angEv>180?1:0} 1 ${cx+donutR*Math.cos((angEv-90)*rad)} ${cy+donutR*Math.sin((angEv-90)*rad)}`:"";

  // Evolution data with benefit line — datos reales agrupados por mes
  const anio=new Date().getFullYear();const mesActual=new Date().getMonth();
  const mesesData=kpiData?Array.from({length:12},(_,mes)=>{
    const reservasMes=(kpiData.reservas||[]).filter(r=>{const f=new Date(r.fecha+"T12:00:00");return f.getFullYear()===anio&&f.getMonth()===mes&&r.estado!=="cancelada";});
    const airbnbMes=(kpiData.airbnbs||[]).filter(a=>{const f=new Date(a.fecha_entrada+"T12:00:00");return f.getFullYear()===anio&&f.getMonth()===mes;});
    const gastosMes=(kpiData.gastos||[]).filter(g=>{const f=new Date(g.fecha+"T12:00:00");return f.getFullYear()===anio&&f.getMonth()===mes;});
    const facturacion=[...reservasMes,...airbnbMes].reduce((s,r)=>s+getPrecioReserva(r),0);
    const gastosTotal=gastosMes.reduce((s,g)=>s+(parseFloat(g.importe)||0),0);
    const beneficio=facturacion-gastosTotal;
    const esFuturo=mes>mesActual;
    return{l:["E","F","M","A","M","J","J","A","S","O","N","D"][mes],facturacion:esFuturo?0:facturacion,proj:facturacion,gastos:esFuturo?0:gastosTotal,ben:esFuturo?0:Math.max(0,beneficio),fut:esFuturo,esActual:mes===mesActual};
  }):[];
  const maxBar=Math.max(...mesesData.map(x=>Math.max(x.facturacion,x.proj)),1)*1.1;

  // Próximo evento (solo 1)
  const proximoEvento=reservas.filter(r=>r.estado!=="cancelada"&&r.fecha>=hoyS).sort((a,b)=>a.fecha.localeCompare(b.fecha))[0];

  // Alertas simples para panel Atención ahora
  const alertasSimples=useMemo(()=>{
    const en30=new Date(Date.now()+30*24*60*60*1000).toISOString().split("T")[0];const lista=[];
    reservas.filter(r=>!["cancelada","finalizada"].includes(r.estado)&&r.estado_pago!=="pagado_completo"&&r.fecha>=hoyS&&r.fecha<=en30).slice(0,2).forEach(r=>{
      const pend=getPrecioReserva(r)-(parseFloat(r.seña_importe)||0);
      lista.push({titulo:`Cobro pendiente · ${r.nombre}`,sub:`${fmtE(pend)} · ${new Date(r.fecha+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"})}`,color:"#D9443A",ir:()=>goToItem?goToItem("reservas",r):setPage("reservas")});
    });
    coordsPend.slice(0,2).forEach(c=>{const esL=c.tipo?.includes("limpieza");
      lista.push({titulo:esL?"Limpieza pendiente confirmar":"Jardín pendiente confirmar",sub:c.fecha_checkout?`Checkout ${new Date(c.fecha_checkout+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"})}`:null,color:T.gold,ir:()=>setPage(esL?"limpieza":"jadmin")});
    });
    tareasPend.filter(t=>t.fecha_limite&&t.fecha_limite<hoyS).slice(0,2).forEach(t=>{
      lista.push({titulo:t.titulo,sub:`Vencida · ${t.entidad_nombre||""}`,color:"#D9443A",ir:async()=>{
        if(t.entidad_tipo==="reserva"){const[r]=await sbGet("reservas",`?id=eq.${t.entidad_id}&select=*`,tok).catch(()=>[]);goToItem?goToItem("reservas",r||null):setPage("reservas");}
        else if(t.entidad_tipo==="visita"){const[v]=await sbGet("visitas",`?id=eq.${t.entidad_id}&select=*`,tok).catch(()=>[]);goToItem?goToItem("visitas",v||null):setPage("visitas");}
        else setPage("contactos");
      }});
    });
    const artBajos=articulosDash.filter(a=>(parseFloat(a.stock_casa||0)+parseFloat(a.stock_almacen||0))<=parseFloat(a.stock_minimo||1));
    if(artBajos.length>0)lista.push({titulo:`Stock bajo · ${artBajos.length} artículo${artBajos.length!==1?"s":""}`,sub:artBajos.slice(0,2).map(a=>a.nombre).join(", "),color:T.softBlue,ir:()=>setPage("almacen")});
    visitasDash.slice(0,1).forEach(v=>lista.push({titulo:`Visita hoy · ${v.nombre}`,sub:v.hora?`${v.hora.slice(0,5)}h`:null,color:T.softBlue,ir:()=>goToItem?goToItem("visitas",v):setPage("visitas")}));
    return lista.slice(0,5);
  },[reservas,coordsPend,tareasPend,articulosDash,visitasDash,hoyS]);

  const[isDesktop,setIsDesktop]=useState(typeof window!=="undefined"&&window.innerWidth>=768);
  useEffect(()=>{const fn=()=>setIsDesktop(window.innerWidth>=768);window.addEventListener("resize",fn);return()=>window.removeEventListener("resize",fn);},[]);

  // Render helpers for reuse in both layouts
  const renderEvolucion=()=>kpiData&&mesesData.length>0?<>
    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:14}}>
      <div><div style={{fontSize:11,color:T.ink3,letterSpacing:.8,textTransform:"uppercase",fontWeight:700}}>Evolución {anio}</div><div style={{fontSize:22,fontWeight:700,color:T.ink,letterSpacing:-.5,marginTop:4}}>{fmtE(kpiData.yaCobrado)}</div></div>
      <div style={{display:"flex",background:T.bg,borderRadius:999,padding:3,gap:2}}>{["mensual","semanal"].map(k=><button key={k} onClick={()=>setRangeEvol(k)} style={{padding:"7px 12px",borderRadius:999,border:0,background:rangeEvol===k?T.ink:"transparent",color:rangeEvol===k?"#fff":T.ink3,fontSize:11,fontWeight:700,cursor:"pointer",textTransform:"capitalize",fontFamily:T.sans}}>{k}</button>)}</div>
    </div>
    <div style={{position:"relative",height:150}}>
      <div style={{display:"flex",alignItems:"flex-end",gap:4,height:150,padding:"0 2px"}}>{mesesData.map((d,i)=>{const rh=Math.max(2,(d.facturacion/maxBar)*150);const ph=Math.max(2,(d.proj/maxBar)*150);return<div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",height:150}}><div style={{position:"relative",width:"100%",height:ph,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>{d.fut&&<div style={{position:"absolute",left:"50%",transform:"translateX(-50%)",bottom:0,width:"70%",height:ph,border:`1.5px dashed ${T.ink3}`,borderRadius:6,background:"transparent"}}/>}{!d.fut&&<div style={{position:"relative",zIndex:1,width:"70%",height:rh,background:d.esActual?T.terracotta:T.olive,borderRadius:6}}/>}</div></div>;})}</div>
      <svg style={{position:"absolute",top:0,left:0,width:"100%",height:150,pointerEvents:"none"}} viewBox={`0 0 ${mesesData.length*100} 150`} preserveAspectRatio="none"><polyline fill="none" stroke={T.lavender} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={mesesData.map((d,i)=>`${i*100+50},${150-Math.max(2,(d.ben/maxBar)*150)}`).join(" ")}/></svg>
    </div>
    <div style={{display:"flex",gap:4,marginTop:6}}>{mesesData.map((d,i)=><div key={i} style={{flex:1,textAlign:"center",fontSize:9,color:T.ink3,fontWeight:600}}>{d.l}</div>)}</div>
    <div style={{display:"flex",gap:14,marginTop:14,paddingTop:12,borderTop:`1px solid ${T.line}`,flexWrap:"wrap"}}>{[{color:T.olive,label:"Real"},{color:"transparent",border:T.ink3,label:"Proyectado"},{color:T.terracotta,label:"Mes actual"},{color:T.lavender,label:"Beneficio"}].map((l,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:10,height:10,borderRadius:3,background:l.color,border:l.border?`1.5px dashed ${l.border}`:"0"}}/><span style={{fontSize:11,color:T.ink2,fontWeight:500}}>{l.label}</span></div>)}</div>
  </>:null;

  const renderDonut=()=>kpiData?<>
    <FmSH title="Ingresos por fuente"/>
    <div style={{display:"flex",alignItems:"center",gap:20}}>
      <svg width={120} height={120} viewBox="0 0 120 120"><circle cx={cx} cy={cy} r={donutR} fill="none" stroke={T.softBlue} strokeWidth={16}/>{pctEv>0&&<circle cx={cx} cy={cy} r={donutR} fill="none" stroke={T.terracotta} strokeWidth={16} strokeDasharray={`${pctEv/100*2*Math.PI*donutR} ${2*Math.PI*donutR}`} strokeDashoffset={2*Math.PI*donutR*0.25} strokeLinecap="round"/>}<circle cx={cx} cy={cy} r={donutR2} fill={T.surface}/><text x={cx} y={cy-4} textAnchor="middle" style={{fontSize:18,fontWeight:700,fill:T.ink}}>—</text><text x={cx} y={cy+12} textAnchor="middle" style={{fontSize:9,fill:T.ink3,fontWeight:500}}>vs {anio-1}</text></svg>
      <div style={{flex:1}}>{[{color:T.terracotta,label:"Eventos",value:fmtE(totalEv),pct:pctEv},{color:T.softBlue,label:"Airbnb",value:fmtE(totalAb),pct:pctAb}].map((s,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><div style={{width:10,height:10,borderRadius:3,background:s.color,flexShrink:0}}/><div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:T.ink}}>{s.label} <span style={{color:T.ink3,fontWeight:500}}>{s.pct}%</span></div><div style={{fontSize:14,fontWeight:700,color:T.ink,marginTop:2}}>{s.value}</div></div></div>)}<div style={{fontSize:11,color:T.ink3,marginTop:4}}>Crecimiento vs {anio-1}: —</div></div>
    </div>
  </>:null;

  const renderKpiDetalle=(idx)=>{const gastos=kpiData?.gastos||[];
    if(idx===0)return<div><div style={{display:"flex",justifyContent:"space-around",marginBottom:12}}><div style={{textAlign:"center"}}><div style={{fontSize:10,color:T.ink3,textTransform:"uppercase",letterSpacing:.5,fontWeight:600}}>Eventos</div><div style={{fontSize:20,fontWeight:700,color:T.terracotta,letterSpacing:-.5}}>{fmtE(kpiData?.fE)}</div><div style={{fontSize:11,color:T.ink3}}>{(kpiData?.reservas||[]).filter(r=>r.estado!=="cancelada").length} reservas</div></div><div style={{textAlign:"center"}}><div style={{fontSize:10,color:T.ink3,textTransform:"uppercase",letterSpacing:.5,fontWeight:600}}>Airbnb</div><div style={{fontSize:20,fontWeight:700,color:T.softBlue,letterSpacing:-.5}}>{fmtE(kpiData?.fA)}</div><div style={{fontSize:11,color:T.ink3}}>{airbnbs.length} reservas</div></div></div><MiniBarChart data={Array.from({length:12},(_,i)=>{const m=[...(kpiData?.reservas||[]),...airbnbs].filter(r=>{const f=new Date((r.fecha||r.fecha_entrada)+"T12:00:00");return f.getFullYear()===anio&&f.getMonth()===i&&r.estado!=="cancelada";});return{l:["E","F","M","A","M","J","J","A","S","O","N","D"][i],v:m.reduce((s,r)=>s+getPrecioReserva(r),0)};})} color={T.olive}/></div>;
    if(idx===1)return<div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>{[{l:"Señas cobradas",v:fmtE(reservas.filter(r=>r.seña_cobrada).reduce((s,r)=>s+(parseFloat(r.seña_importe)||0),0)),c:T.gold},{l:"Pagos totales",v:fmtE(reservas.filter(r=>r.estado_pago==="pagado_completo").reduce((s,r)=>s+getPrecioReserva(r),0)),c:T.olive},{l:"Airbnb cobrado",v:fmtE(airbnbs.filter(a=>a.cobrado).reduce((s,a)=>s+getPrecioReserva(a),0)),c:T.softBlue}].map((it,i)=><div key={i} style={{background:T.bg,borderRadius:12,padding:"10px 8px",textAlign:"center"}}><div style={{fontSize:9,color:T.ink3,textTransform:"uppercase",letterSpacing:.5,fontWeight:600,marginBottom:4}}>{it.l}</div><div style={{fontSize:15,fontWeight:700,color:it.c,letterSpacing:-.3}}>{it.v}</div></div>)}</div></div>;
    if(idx===2)return<div>{reservas.filter(r=>!["cancelada","finalizada"].includes(r.estado)&&r.estado_pago!=="pagado_completo").sort((a,b)=>new Date(a.fecha)-new Date(b.fecha)).slice(0,6).map(r=>{const p=getPrecioReserva(r)-(parseFloat(r.seña_cobrada?r.seña_importe||0:0));const d=Math.ceil((new Date(r.fecha+"T12:00:00")-new Date())/(864e5));const uc=d<30?"#D9443A":d<90?T.gold:T.success;return<div key={r.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${T.line}`}}><span style={{width:8,height:8,borderRadius:999,background:uc,flexShrink:0}}/><div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:T.ink}}>{r.nombre}</div><div style={{fontSize:11,color:T.ink3}}>{r.seña_cobrada?"Falta saldo":"Sin seña"}</div></div><div style={{fontSize:13,fontWeight:700,color:uc}}>{fmtE(p)}</div></div>;})}</div>;
    if(idx===3){const porCat={};gastos.forEach(g=>{porCat[g.categoria]=(porCat[g.categoria]||0)+(parseFloat(g.importe)||0);});const totalG=Object.values(porCat).reduce((s,v)=>s+v,0)||1;const cats=Object.entries(porCat).sort((a,b)=>b[1]-a[1]);const catCol={personal:T.lavender,comision:T.terracotta,consumibles:T.olive,suministros:T.softBlue,mantenimiento:T.gold,otros:T.ink4};return<div>{cats.map(([cat,val],i)=><div key={i} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:12,fontWeight:600,color:T.ink,textTransform:"capitalize"}}>{cat}</span><span style={{fontSize:12,fontWeight:700,color:T.ink}}>{fmtE(val)}</span></div><div style={{height:6,background:T.bg,borderRadius:999}}><div style={{height:6,borderRadius:999,background:catCol[cat]||T.ink3,width:Math.round(val/totalG*100)+"%"}}/></div></div>)}</div>;}
    if(idx===4){const tC=kpiData?.yaCobrado||0;const tG=kpiData?.gastosReales||0;const ben=tC-tG;const mar=tC>0?Math.round(ben/tC*100):0;return<div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>{[{l:"Cobrado",v:fmtE(tC),c:T.olive},{l:"Gastos",v:fmtE(tG),c:"#D9443A"},{l:"Beneficio",v:fmtE(ben),c:T.terracotta}].map((it,i)=><div key={i} style={{background:T.bg,borderRadius:12,padding:"10px 8px",textAlign:"center"}}><div style={{fontSize:9,color:T.ink3,textTransform:"uppercase",letterSpacing:.5,fontWeight:600,marginBottom:4}}>{it.l}</div><div style={{fontSize:15,fontWeight:700,color:it.c,letterSpacing:-.3}}>{it.v}</div></div>)}</div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:T.bg,borderRadius:12}}><span style={{fontSize:13,fontWeight:600,color:T.ink}}>Margen</span><span style={{fontSize:16,fontWeight:700,color:mar>50?T.success:mar>30?T.gold:"#D9443A"}}>{mar}%</span></div></div>;}
    if(idx===5){const comPct=kpiData?.comPct||10;const base=kpiData?.facturacion||0;const comTotal=base*comPct/100;const yaReg=gastos.filter(g=>g.categoria==="comision").reduce((s,g)=>s+(parseFloat(g.importe)||0),0);return<div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>{[{l:"Base cálculo",v:fmtE(base),c:T.ink},{l:`Comisión ${comPct}%`,v:fmtE(comTotal),c:T.terracotta},{l:"Ya registrada",v:fmtE(yaReg),c:T.olive},{l:"Pendiente",v:fmtE(Math.max(0,comTotal-yaReg)),c:T.gold}].map((it,i)=><div key={i} style={{background:T.bg,borderRadius:12,padding:"10px 8px",textAlign:"center"}}><div style={{fontSize:9,color:T.ink3,textTransform:"uppercase",letterSpacing:.5,fontWeight:600,marginBottom:4}}>{it.l}</div><div style={{fontSize:15,fontWeight:700,color:it.c,letterSpacing:-.3}}>{it.v}</div></div>)}</div></div>;}
    return null;
  };

  // ─── DESKTOP LAYOUT ─────────────────────────────────────────────
  if(isDesktop&&kpiData)return <div style={{display:"flex",flexDirection:"column",fontFamily:T.sans,background:T.bg,minHeight:"100%"}}>
    {/* Topbar */}
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"20px 32px",borderBottom:`1px solid ${T.line}`,background:T.bg,position:"sticky",top:0,zIndex:10}}>
      <div><div style={{fontSize:12,color:T.ink3,fontWeight:500}}>{new Date().toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).replace(/^\w/,c=>c.toUpperCase())}</div><div style={{fontSize:28,color:T.ink,letterSpacing:-1,fontWeight:700,lineHeight:1,marginTop:2}}>Buenos días, {perfil?.nombre?.split(" ")[0]||"Admin"}.</div></div>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <button onClick={()=>setPage("notifs")} style={{width:42,height:42,borderRadius:999,background:T.surface,border:`1px solid ${T.line}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",position:"relative"}}><FmIcon name="bell" size={18} stroke={T.ink2}/></button>
        <button onClick={()=>setPage("nueva-res")} style={{height:42,padding:"0 20px",borderRadius:999,background:T.ink,color:"#fff",border:0,fontSize:13,fontWeight:700,letterSpacing:-.2,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}><FmIcon name="plus" size={15} stroke="#fff" sw={2.4}/> Nueva reserva</button>
      </div>
    </div>
    {/* Grid */}
    <div style={{padding:28,display:"flex",flexDirection:"column",gap:20,overflow:"auto",flex:1}}>
      {/* Row 1: 4 KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16}}>
        {[{label:"Facturación proy.",value:fmtE(kpiData.facturacion),delta:`Ev. ${fmtE(kpiData.fE)} + Ab. ${fmtE(kpiData.fA)}`,mood:"up",color:T.olive,idx:0},{label:"Ya cobrado",value:fmtE(kpiData.yaCobrado),delta:`${Math.round(kpiData.yaCobrado/(kpiData.facturacion||1)*100)}% del total`,color:T.softBlue,idx:1},{label:"Pendiente cobro",value:fmtE(kpiData.pendiente),delta:`${reservas.filter(r=>r.estado_pago!=="pagado_completo"&&r.estado!=="cancelada").length} eventos`,color:T.gold,idx:2},{label:"Beneficio est.",value:fmtE(kpiData.beneficio),delta:`${Math.round(kpiData.beneficio/(kpiData.facturacion||1)*100)}% margen`,mood:kpiData.beneficio>0?"up":"down",color:T.terracotta,idx:4}].map(k=><BigKpi key={k.idx} label={k.label} value={k.value} delta={k.delta} mood={k.mood} color={k.color} onClick={()=>setKpiAbierto(kpiAbierto===k.idx?null:k.idx)}/>)}
      </div>
      {/* KPI detalle */}
      {kpiAbierto!==null&&<div style={{background:T.surface,borderRadius:20,border:`1px solid ${T.line}`,padding:20,boxShadow:"0 8px 28px rgba(40,30,20,.10)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><div style={{fontSize:14,fontWeight:700,color:T.ink,textTransform:"uppercase",letterSpacing:-.2}}>{["Facturación proyectada","Ya cobrado","Pendiente de cobro","Gastos reales","Beneficio estimado","Comisión gestor"][kpiAbierto]}</div><button onClick={()=>setKpiAbierto(null)} style={{width:28,height:28,borderRadius:999,background:T.bg,border:0,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><FmIcon name="x" size={14} stroke={T.ink3}/></button></div>
        {renderKpiDetalle(kpiAbierto)}
      </div>}
      {/* Row 2: Evolución + Donut */}
      <div style={{display:"grid",gridTemplateColumns:"1.7fr 1fr",gap:16}}>
        <div style={{background:T.surface,borderRadius:24,padding:24,border:`1px solid ${T.line}`}}>{renderEvolucion()}</div>
        <div style={{background:T.surface,borderRadius:24,padding:24,border:`1px solid ${T.line}`}}>{renderDonut()}</div>
      </div>
      {/* Row 3: Atención + Eventos */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1.4fr",gap:16}}>
        <AttentionPanelDesktop alertasSimples={alertasSimples}/>
        <EventosBlockDesktop reservas={reservas} setPage={setPage} goToItem={goToItem}/>
      </div>
      {/* Row 4: Tareas + Contactos + KPIs secundarios */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
        <TareasBlockDesktop tareas={tareasPend} setPage={setPage} goToItem={goToItem} tok={tok}/>
        <ContactosBlockDesktop contactos={contactosDestacados} setPage={setPage}/>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <BigKpi label="Gastos reales" value={fmtE(kpiData.gastosReales)} delta="YTD" color={T.lavender} onClick={()=>setKpiAbierto(3)}/>
          <BigKpi label="Comisión gestor" value={fmtE(kpiData.comision)} delta={`${kpiData.comPct}% s/fact.`} color="#F2995E" onClick={()=>setKpiAbierto(5)}/>
        </div>
      </div>
    </div>
  </div>;

  return <>
    {/* 1. Greeting */}
    <div style={{padding:"54px 20px 16px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:2}}>
        <div>
          <div style={{fontSize:12,color:T.ink3,fontWeight:500}}>{new Date().toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"}).replace(/^\w/,c=>c.toUpperCase())}</div>
          <div style={{fontSize:34,color:T.ink,letterSpacing:-1.2,lineHeight:1.02,marginTop:4,fontWeight:700}}>Buenos días,<br/>{perfil?.nombre?.split(" ")[0]||"Admin"}.</div>
        </div>
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>setPage("notifs")} style={{width:38,height:38,borderRadius:999,background:T.surface,border:`1px solid ${T.line}`,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",cursor:"pointer"}}><FmIcon name="bell" size={18} stroke={T.ink2}/></button>
          <div style={{width:38,height:38,borderRadius:999,background:T.olive,display:"flex",alignItems:"center",justifyContent:"center",color:T.ink,fontWeight:700,fontSize:15}}>{perfil?.nombre?.slice(0,1)||"A"}</div>
        </div>
      </div>
    </div>

    {/* 2. Meteo */}
    {meteo&&meteo.length>0&&<div style={{padding:"0 20px 16px"}}>
      <FmCard pad={12} radius={20}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <span style={{fontSize:11,fontWeight:600,color:T.ink3,textTransform:"uppercase",letterSpacing:1}}>Próximos 7 días</span>
          <span style={{fontSize:11,color:T.ink3}}>San Javier, Murcia</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
          {meteo.map((dia,i)=>{const esHoy=dia.fecha===hoyS;const d=new Date(dia.fecha+"T12:00:00");const dias=["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
            return <div key={dia.fecha} style={{padding:"6px 2px",borderRadius:12,background:esHoy?T.terracotta+"1a":"transparent",textAlign:"center"}}>
              <div style={{fontSize:9,color:T.ink3,fontWeight:500,textTransform:"uppercase",marginBottom:3}}>{dias[d.getDay()]}</div>
              <div style={{fontSize:20,margin:"2px 0"}}>{getWIcon(dia.estadoCielo)}</div>
              <div style={{fontSize:12,fontWeight:600,color:esHoy?T.terracotta:T.ink,marginTop:2}}>{Math.round(dia.tempMax)}°</div>
            </div>;})}
        </div>
      </FmCard>
    </div>}

    {/* 3. Atención ahora */}
    <div style={{padding:"0 20px 16px"}}>
      <div style={{background:"linear-gradient(135deg, #1A1A1A 0%, #2a2520 100%)",borderRadius:20,padding:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:alertasSimples.length>0?12:0}}>
          <div>
            <div style={{fontSize:10,color:T.gold,letterSpacing:1,textTransform:"uppercase",fontWeight:600,marginBottom:2}}>Atención ahora</div>
            <div style={{fontSize:14,fontWeight:600,letterSpacing:-.2,color:"white"}}>{alertasSimples.length===0?"Todo en orden":`${alertasSimples.length} asunto${alertasSimples.length!==1?"s":""} pendiente${alertasSimples.length!==1?"s":""}`}</div>
          </div>
          {alertasSimples.length>0&&<span style={{display:"inline-flex",alignItems:"center",height:22,padding:"0 9px",borderRadius:999,background:"rgba(236,210,39,.18)",color:T.gold,fontSize:11,fontWeight:600,whiteSpace:"nowrap"}}>Prioridad</span>}
        </div>
        {alertasSimples.length===0?<div style={{fontSize:13,color:"rgba(255,255,255,.40)",paddingTop:4}}>✅ Sin asuntos pendientes</div>
        :<div style={{display:"flex",flexDirection:"column"}}>
          {alertasSimples.map((a,i)=><div key={i} onClick={a.ir} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:i<alertasSimples.length-1?"1px solid rgba(255,255,255,.07)":"none",cursor:a.ir?"pointer":"default"}}>
            <span style={{width:8,height:8,borderRadius:999,background:a.color||T.gold,flexShrink:0}}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,color:"white",letterSpacing:-.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.titulo}</div>
              {a.sub&&<div style={{fontSize:11,color:"rgba(255,255,255,.50)",marginTop:1}}>{a.sub}</div>}
            </div>
            {a.ir&&<FmIcon name="chevR" size={14} stroke="rgba(255,255,255,.35)"/>}
          </div>)}
        </div>}
      </div>
    </div>

    {/* 4. KPIs financieros */}
    {kpiData&&<div style={{padding:"0 20px 18px"}}>
      <FmSH title={`Finanzas · ${new Date().getFullYear()}`} action={<span onClick={()=>setPage("analisis")} style={{cursor:"pointer"}}>Detalle →</span>}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {[
          {label:"Facturación proy.",value:fmtE(kpiData.facturacion),delta:`Ev. ${fmtE(kpiData.fE)} + Ab. ${fmtE(kpiData.fA)}`,mood:"up",color:T.olive},
          {label:"Ya cobrado",value:fmtE(kpiData.yaCobrado),delta:`${Math.round(kpiData.yaCobrado/(kpiData.facturacion||1)*100)}% del total`,mood:"neutral",color:T.softBlue},
          {label:"Pendiente cobro",value:fmtE(kpiData.pendiente),delta:`${reservas.filter(r=>r.estado_pago!=="pagado_completo"&&r.estado!=="cancelada").length} eventos`,mood:"neutral",color:T.gold},
          {label:"Gastos reales",value:fmtE(kpiData.gastosReales),delta:"YTD",mood:"neutral",color:T.lavender},
          {label:"Beneficio est.",value:fmtE(kpiData.beneficio),delta:`${Math.round(kpiData.beneficio/(kpiData.facturacion||1)*100)}% margen`,mood:kpiData.beneficio>0?"up":"down",color:T.terracotta},
          {label:"Comisión gestor",value:fmtE(kpiData.comision),delta:`${kpiData.comPct}% s/fact.`,mood:"neutral",color:"#F2995E"},
        ].map((k,i)=><FmCard key={i} pad={14} radius={20} onClick={()=>setKpiAbierto(kpiAbierto===i?null:i)} style={{border:kpiAbierto===i?`2px solid ${k.color}`:`1px solid ${T.line}`,cursor:"pointer"}}>
          <div style={{width:28,height:3,background:k.color,borderRadius:2,marginBottom:10}}/>
          <div style={{fontSize:10,color:T.ink3,fontWeight:600,letterSpacing:.3,textTransform:"uppercase",marginBottom:4}}>{k.label}</div>
          <div style={{fontSize:22,fontWeight:700,color:T.ink,letterSpacing:-.6,lineHeight:1}}>{k.value}</div>
          <div style={{fontSize:10.5,color:T.ink3,marginTop:6,display:"flex",alignItems:"center",gap:3,fontWeight:500}}>
            {k.mood==="up"&&<span style={{color:T.success,fontWeight:700}}>↑</span>}
            {k.mood==="down"&&<span style={{color:T.danger,fontWeight:700}}>↓</span>}
            {k.delta}
          </div>
        </FmCard>)}
      </div>
    </div>}

    {/* KPI Detalle expandido */}
    {kpiAbierto!==null&&kpiData&&<div style={{margin:"0 20px 16px",background:T.surface,borderRadius:20,border:`1px solid ${T.line}`,padding:16,boxShadow:"0 8px 28px rgba(40,30,20,.10)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:700,color:T.ink,letterSpacing:-.2,textTransform:"uppercase"}}>{["Facturación proyectada","Ya cobrado","Pendiente de cobro","Gastos reales","Beneficio estimado","Comisión gestor"][kpiAbierto]}</div>
        <button onClick={()=>setKpiAbierto(null)} style={{width:28,height:28,borderRadius:999,background:T.bg,border:0,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><FmIcon name="x" size={14} stroke={T.ink3}/></button>
      </div>
      {renderKpiDetalle(kpiAbierto)}
    </div>}

    {/* 5. Evolución chart */}
    {kpiData&&mesesData.length>0&&<div style={{padding:"0 20px 18px"}}><FmCard pad={16} radius={20}>{renderEvolucion()}</FmCard></div>}

    {/* 6. Donut ingresos */}
    {kpiData&&<div style={{padding:"0 20px 18px"}}><FmCard pad={16} radius={20}>{renderDonut()}</FmCard></div>}

    {/* 7. Tareas pendientes */}
    {tareasPend.length>0&&<div style={{padding:"0 20px 18px"}}>
      <FmSH title="Tareas pendientes" action={`${tareasPend.length} total`}/>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {tareasPend.slice(0,4).map(t=>{const color=!t.fecha_limite||t.fecha_limite<hoyS?T.coral:t.fecha_limite===hoyS?T.gold:T.softBlue;const dueLabel=!t.fecha_limite?"Sin fecha":t.fecha_limite===hoyS?"Hoy":t.fecha_limite<hoyS?"Vencida":new Date(t.fecha_limite+"T12:00:00").toLocaleDateString("es-ES",{weekday:"short",day:"numeric"});
          return <div key={t.id} style={{background:color,borderRadius:20,padding:16,display:"flex",alignItems:"center",gap:14,color:T.ink,cursor:"pointer"}} onClick={async()=>{const pg=t.entidad_tipo==="reserva"?"reservas":t.entidad_tipo==="visita"?"visitas":t.entidad_tipo==="airbnb"?"airbnb":"contactos";if(t.entidad_id&&goToItem){const tbl=t.entidad_tipo==="reserva"?"reservas":t.entidad_tipo==="visita"?"visitas":"reservas_airbnb";const[item]=await sbGet(tbl,`?id=eq.${t.entidad_id}&select=*`,tok).catch(()=>[]);goToItem(pg,item||null);}else setPage(pg);}}>
            <div style={{width:32,height:32,borderRadius:8,background:T.ink,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}} onClick={async e=>{e.stopPropagation();try{await sbPatch("tareas_comerciales",`id=eq.${t.id}`,{estado:"hecha",completada_por:perfil.nombre,completada_ts:new Date().toISOString()},tok);if(t.entidad_tipo&&t.entidad_id){await addHistorial(t.entidad_tipo,t.entidad_id,`Tarea completada: "${t.titulo}"`,perfil.nombre,tok).catch(()=>{});const cid=await getContactoDeEntidad(t.entidad_tipo,t.entidad_id,tok);if(cid){const TICONS={llamada:"📞",whatsapp:"💬",email:"📧",seguimiento:"📋",cobro:"💰",contrato:"📄"};const ti=["llamada","whatsapp","email"].includes(t.tipo)?t.tipo:"nota";await autoInteraccion(cid,ti,`${TICONS[t.tipo]||"🔧"} ${t.titulo}`,"positivo",tok,perfil.nombre);}}setTareasPend(prev=>prev.filter(x=>x.id!==t.id));}catch(_){}}}><FmIcon name="check" size={16} stroke={color} sw={2.4}/></div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:.3,textTransform:"uppercase",opacity:.75}}>{dueLabel} · {t.asignado_nombre||"Admin"}</div>
              <div style={{fontSize:15,fontWeight:700,letterSpacing:-.3,marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.titulo}</div>
            </div>
            <FmIcon name="chevR" size={18} stroke={T.ink} sw={2.4}/>
          </div>;})}
      </div>
    </div>}

    {/* 8. Próximo evento (solo 1) */}
    {proximoEvento&&<div style={{padding:"0 20px 18px"}}>
      <FmSH title="Próximo evento"/>
      <DashEventRow color={T.terracotta} date={new Date(proximoEvento.fecha+"T12:00:00").toLocaleDateString("es-ES",{day:"2-digit",month:"short"}).toUpperCase()} title={proximoEvento.nombre} price={fmtE(getPrecioReserva(proximoEvento))} status={proximoEvento.estado_pago==="pagado_completo"?"Pagado":proximoEvento.seña_cobrada?"Seña OK":"Saldo pdte"} onClick={()=>goToItem?goToItem("reservas",proximoEvento):setPage("reservas")}/>
    </div>}

    {/* 9. Contactos destacados */}
    <div style={{padding:"0 20px 24px"}}>
      <FmSH title="Contactos destacados" action={<span onClick={()=>setPage("contactos")} style={{cursor:"pointer"}}>Todos →</span>}/>
      <FmCard pad={4} radius={20}>
        {contactosDestacados.length===0?<div style={{padding:"16px 12px",color:T.ink3,fontSize:13,textAlign:"center"}}>Sin contactos recientes</div>
        :contactosDestacados.map((c,i)=>{const colors=[T.lavender,T.olive,T.softBlue,T.gold,T.terracotta];const color=colors[i%colors.length];const ini=c.nombre?.split(" ").map(p=>p[0]).slice(0,2).join("").toUpperCase()||"??";
          return <div key={c.id} onClick={()=>setPage("contactos")} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 12px",borderBottom:i<contactosDestacados.length-1?`1px solid ${T.line}`:"none",cursor:"pointer"}}>
            <div style={{width:42,height:42,borderRadius:12,background:color,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:13,color:T.ink,flexShrink:0}}>{ini}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:14,fontWeight:700,color:T.ink,letterSpacing:-.2}}>{c.nombre}</div>
              <div style={{fontSize:11,color:T.ink3,fontWeight:500,marginTop:1}}>{c.tipo_evento||"Contacto"} · {c.estado}</div>
            </div>
            {c.telefono&&<button onClick={e=>{e.stopPropagation();window.open("tel:"+c.telefono);}} style={{width:32,height:32,borderRadius:999,background:T.bg,border:0,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><FmIcon name="phone" size={14} stroke={T.ink} sw={2}/></button>}
            <button style={{width:32,height:32,borderRadius:999,background:T.ink,border:0,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><FmIcon name="chevR" size={14} stroke="#fff" sw={2.2}/></button>
          </div>;})}
      </FmCard>
    </div>
  </>;
}
function DashJ({perfil,jsem,jpunt,cwk,setPage,tok}){
  const [meteoJ,setMeteoJ]=useState(null);
  useEffect(()=>{fetchMeteo().then(dias=>{if(dias&&dias.length>=2){const r0=dias[0].precipitacion,r1=dias[1].precipitacion;const maxR=Math.max(r0,r1);if(maxR>30)setMeteoJ({rain:maxR,day:r1>r0?"mañana":"hoy"});}});},[]);
  const temp=getTemporada();
  const sj={}; jsem.forEach(r=>sj[r.tarea_id]=r);
  const actv=JARDIN_T[temp].filter(t=>tocaSemana({...t,frec:t.frec},cwk));
  const tot=actv.length+jpunt.length;
  const comp=actv.filter(t=>sj[t.id]?.done).length+jpunt.filter(t=>t.done).length;
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
  const [coordPJ,setCoordPJ]=useState([]);const [savingCoord,setSavingCoord]=useState(false);
  const [srvJardinActivos,setSrvJardinActivos]=useState([]);
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
      // Jornada hoy
      let jHoy=[];
      try{jHoy=await sbGet("jornadas_jardineria",`?servicio_id=eq.${s.id}&hora_inicio=gte.${hoyStr}T00:00:00&hora_inicio=lte.${hoyStr}T23:59:59&select=*`,tok);}catch(_){jHoy=[];}
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
  const loadCoordYServicios=async()=>{
    const t=perfil?.es_operario?SB_KEY:tok;
    // Coordinaciones pendientes
    sbGet("coordinacion_servicios","?estado=in.(preguntando_si_lista,servicio_creado_pendiente_fecha)&select=*",t).then(r=>setCoordPJ(r.filter(c=>c.tipo?.includes("jardin")))).catch(()=>{});
    // Servicios activos de jardinería (from coord or admin)
    try{const srvs=await sbGet("jardin_servicios",`?jardinero_id=eq.${jId}&estado=eq.activo&select=*`,t).catch(()=>[]);
      for(const s of srvs){s._tareas=await sbGet("jardin_servicio_tareas",`?servicio_id=eq.${s.id}&select=*&order=created_at.asc`,t).catch(()=>[]);}
      setSrvJardinActivos(srvs.filter(s=>!srvActivo||s.id!==srvActivo?.id));// exclude the main active one
    }catch(_){}
  };
  useEffect(()=>{if(tok){loadSrvActivo();loadCoordYServicios();}},[]);

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
      const [j]=await sbPost("jornadas_jardineria",{servicio_id:srvActivo.id,fecha:hoyStr,hora_inicio:ahora.toISOString(),pausas:[]},tok);
      setJornadaId(j.id);setJornadaFin(false);setPausasArr([]);setPausado(false);
      localStorage.setItem(`fm_jornada_inicio_${srvActivo.id}`,tsInicio.toString());
      localStorage.setItem(`fm_jornada_id_${srvActivo.id}`,String(j.id));
      setShowNuevaJornada(false);
    }catch(_){}
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
      const msg=`🌿 ${perfil.nombre} ha completado "${srvActivo.nombre}". Total: ${horasT}h. Coste: ${costeTotal}€.`;
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
    {/* Greeting */}
    <div style={{padding:"54px 20px 16px"}}><div style={{fontSize:12,color:T.ink3,fontWeight:500}}>{new Date().toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"}).replace(/^\w/,c=>c.toUpperCase())}</div><div style={{fontSize:28,fontWeight:700,color:T.ink,letterSpacing:-.8,lineHeight:1.02,marginTop:2}}>Hola, {perfil.nombre.split(" ")[0]} 🌿</div></div>
    <div className="pb">
      {meteoJ&&<div style={{background:T.softBlue+"14",borderRadius:16,padding:"10px 14px",marginBottom:14,fontSize:13,color:"#2A5BA0",fontWeight:500,display:"flex",alignItems:"center",gap:8}}><FmIcon name="cloud" size={16} stroke="#2A5BA0"/>{meteoJ.rain>10?`Lluvia abundante prevista ${meteoJ.day} (${meteoJ.rain}mm) — el riego puede ser innecesario`:`Lluvia prevista ${meteoJ.day} (${meteoJ.rain}mm) — considera posponer el riego`}</div>}
      {coordPJ.map(c=>{
        const tQ=perfil?.es_operario?SB_KEY:tok;
        const fechaFmt=c.fecha_checkin_siguiente?new Date(c.fecha_checkin_siguiente+"T12:00:00").toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"}):"—";
        const diasH=c.fecha_checkin_siguiente?Math.ceil((new Date(c.fecha_checkin_siguiente+"T12:00:00")-new Date())/(86400000)):0;
        const esPost=c.tipo?.includes("post");
        const confirmarJ=async(ds)=>{
          if(savingCoord)return;setSavingCoord(true);
          try{const tareas=esPost?TAREAS_JARDIN_POST:TAREAS_JARDIN_PRE;
          const jds=await sbGet("jardineros","?activo=eq.true&select=*",tQ).catch(()=>[]);const jd=jds[0]||null;
          const[srv]=await sbPost("jardin_servicios",{nombre:`${esPost?"Jardín post":"Jardín pre"} — ${ds}`,fecha_inicio:ds,fecha_fin:ds,jardinero_id:jd?.id||null,jardinero_nombre:jd?.nombre||"",estado:"activo",creado_por:perfil.nombre,modalidad_pago:jd?.modalidad||"precio_fijo_servicio"},tQ).catch(()=>[{}]);
          if(srv?.id){for(const t of tareas)await sbPost("jardin_servicio_tareas",{servicio_id:srv.id,txt:t.txt,done:false,añadida_por_jardinero:false},tQ).catch(()=>{});}
          await sbPatch("coordinacion_servicios",`id=eq.${c.id}`,{estado:"confirmado",fecha_programada:ds,jardin_servicio_id:srv?.id||null,respondido_por:perfil.nombre},tQ);
          const adms=await sbGet("usuarios","?rol=eq.admin&select=id",tQ).catch(()=>[]);
          for(const a of adms)await sbPost("notificaciones",{para:a.id,txt:`🌿 ${perfil.nombre} realizará jardín el ${new Date(ds+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"long"})}`},tQ).catch(()=>{});
          setCoordPJ(prev=>prev.filter(x=>x.id!==c.id));await loadCoordYServicios();}catch(_){}setSavingCoord(false);
        };
        if(c.estado==="preguntando_si_lista") return <div key={c.id} style={{padding:"0 20px 10px"}}><div style={{background:T.olive,borderRadius:20,padding:16,color:T.ink}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}><div style={{width:8,height:8,borderRadius:999,background:T.ink}}/><span style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>Acción requerida</span></div>
          <div style={{fontSize:18,fontWeight:700,letterSpacing:-.4,lineHeight:1.2}}>¿Está el jardín listo?</div>
          <div style={{fontSize:12,color:"rgba(20,25,5,.75)",marginTop:4}}>Reserva el {fechaFmt} — en {diasH} día{diasH!==1?"s":""}</div>
          <div style={{display:"flex",gap:8,marginTop:12}}>
            <button disabled={savingCoord} onClick={async()=>{setSavingCoord(true);try{await sbPatch("coordinacion_servicios",`id=eq.${c.id}`,{estado:"listo_confirmado",respondido_por:perfil.nombre},tQ);const adms=await sbGet("usuarios","?rol=eq.admin&select=id",tQ).catch(()=>[]);for(const a of adms)await sbPost("notificaciones",{para:a.id,txt:`✅ ${perfil.nombre} confirma: jardín listo para el ${fechaFmt}`},tQ).catch(()=>{});setCoordPJ(prev=>prev.filter(x=>x.id!==c.id));}catch(_){}setSavingCoord(false);}} style={{flex:1,padding:"12px 0",borderRadius:14,background:T.ink,color:"white",border:0,fontFamily:T.sans,fontSize:13,fontWeight:700,cursor:"pointer"}}>{savingCoord?"…":"✓ Listo"}</button>
            <button disabled={savingCoord} onClick={()=>{setCoordPJ(prev=>prev.map(x=>x.id===c.id?{...x,estado:"servicio_creado_pendiente_fecha"}:x));}} style={{flex:1,padding:"12px 0",borderRadius:14,background:"white",color:T.ink,border:0,fontFamily:T.sans,fontSize:13,fontWeight:700,cursor:"pointer"}}>✗ Falta preparar</button>
          </div>
        </div></div>;
        const dias=[];const ini=new Date(c.ventana_inicio||new Date().toISOString());const fin=new Date(c.ventana_fin||new Date(Date.now()+3*86400000).toISOString());const hoy2=new Date();let dd=ini>hoy2?ini:hoy2;while(dd<=fin&&dias.length<7){dias.push(new Date(dd));dd=new Date(dd.getTime()+86400000);}
        return <div key={c.id} style={{padding:"0 20px 10px"}}><div style={{background:T.gold,borderRadius:20,padding:16,color:T.ink}}>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:6}}>Elige día</div>
          <div style={{fontSize:16,fontWeight:700,letterSpacing:-.3,lineHeight:1.25}}>Jardín antes de reserva</div>
          <div style={{fontSize:12,color:"rgba(30,25,5,.72)",marginTop:4}}>Reserva el {fechaFmt}</div>
          <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.min(dias.length,3)},1fr)`,gap:6,marginTop:12}}>
            {dias.slice(0,3).map((d,i)=><button key={d.toISOString()} disabled={savingCoord} onClick={()=>confirmarJ(d.toISOString().split("T")[0])} style={{padding:"10px 0",borderRadius:14,background:i===0?T.ink:"rgba(255,255,255,.6)",color:i===0?"white":T.ink,border:0,cursor:"pointer",fontFamily:T.sans}}>
              <div style={{fontSize:10,fontWeight:600,opacity:.7}}>{d.toLocaleDateString("es-ES",{weekday:"short"})}</div>
              <div style={{fontSize:20,fontWeight:700,letterSpacing:-.5,marginTop:2}}>{d.getDate()}</div>
              {i===0&&<div style={{fontSize:9,marginTop:2,opacity:.8}}>recomendado</div>}
            </button>)}
          </div>
        </div></div>;
      })}

      {/* SERVICIO ACTIVO */}
      {srvActivo&&<div style={{background:T.surface,border:`1px solid ${T.line}`,borderRadius:20,padding:16,marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><span style={{fontSize:13,fontWeight:700,color:T.ink}}>🌿 Servicio activo</span><OpsStatePill estado="en_curso"/></div>
        <div style={{fontSize:16,fontWeight:700,color:T.ink,letterSpacing:-.3,marginBottom:4}}>{srvActivo.nombre}</div>
        {(srvActivo.fecha_inicio||srvActivo.fecha_fin)&&<div style={{fontSize:11,color:T.ink3,marginBottom:4,display:"flex",alignItems:"center",gap:4}}><FmIcon name="calendar" size={11} stroke={T.ink3}/>{srvActivo.fecha_inicio?new Date(srvActivo.fecha_inicio+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"}):""}{srvActivo.fecha_fin?` → ${new Date(srvActivo.fecha_fin+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"})}`:""}</div>}
        <div style={{fontSize:12,color:T.ink3,marginBottom:6}}>Tareas: {srvTareas.filter(t=>t.done).length}/{srvTareas.length}{srvExtras.length>0?` + ${srvExtras.length} extra`:""}</div>
        <div style={{height:6,background:T.bg,borderRadius:999,overflow:"hidden",marginBottom:14}}><div style={{height:"100%",background:T.olive,width:`${srvTareas.length?(srvTareas.filter(t=>t.done).length/srvTareas.length)*100:0}%`}}/></div>

        {/* Cronómetro */}
        {jornadaId&&!jornadaFin&&<>
          <div style={{background:"linear-gradient(150deg,#1A1A1A 0%,#2A2722 100%)",borderRadius:16,padding:16,color:"white",marginBottom:12,position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:-20,right:-20,width:100,height:100,borderRadius:999,background:T.olive+"24"}}/>
            <div style={{position:"relative"}}>
              <div style={{fontSize:10,color:"rgba(255,255,255,.7)",letterSpacing:1,textTransform:"uppercase",fontWeight:700,marginBottom:4}}>{pausado?"⏸ En pausa":"⏱ Esta jornada"}</div>
              <div style={{fontSize:42,fontWeight:300,fontFamily:"monospace",letterSpacing:-2,lineHeight:1,fontVariantNumeric:"tabular-nums"}}>{fmtEl(tiempoJornada)}</div>
              {totalAcum>0&&<div style={{fontSize:11,color:"rgba(255,255,255,.6)",marginTop:6}}>Acumulado: <b style={{color:"white"}}>{fmtHM(totalAcum*60)}</b></div>}
            </div>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            <button onClick={togglePausa} disabled={saving2} style={{flex:1,padding:12,borderRadius:12,border:0,background:pausado?T.ink:T.bg,color:pausado?"white":T.ink,fontFamily:T.sans,fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>{pausado?"▶️ Reanudar":"⏸️ Pausar"}</button>
            <button onClick={()=>setShowFinJornada(true)} style={{flex:1,padding:12,borderRadius:12,border:0,background:T.olive,color:T.ink,fontFamily:T.sans,fontSize:13,fontWeight:700,cursor:"pointer"}}>Terminar jornada</button>
          </div>
        </>}
        {jornadaFin&&<div style={{background:T.olive+"14",borderRadius:12,padding:"10px 14px",marginBottom:12,fontSize:13,color:"#4A7A2E",textAlign:"center",fontWeight:600}}>✅ Jornada completada — {fmtHM(jornadaDurMin||0)}</div>}
        {!jornadaId&&!jornadaFin&&!showNuevaJornada&&<button onClick={iniciarJornada} disabled={saving2} style={{width:"100%",padding:"14px 0",borderRadius:999,border:0,background:T.ink,color:"white",fontFamily:T.sans,fontSize:15,fontWeight:700,cursor:"pointer",marginBottom:14}}>▶️ Iniciar jornada</button>}

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

      {/* Servicios de jardín activos (from coordinación) */}
      {srvJardinActivos.map(s=>{const tareas=s._tareas||[];const hechas=tareas.filter(t=>t.done).length;const tQ=perfil?.es_operario?SB_KEY:tok;
        return <div key={s.id} className="card" style={{marginBottom:14,border:"1px solid rgba(166,190,89,.3)",background:"rgba(166,190,89,.04)"}}>
          <div className="chdr"><span className="ctit">🌿 {s.nombre}</span><span className="badge" style={{background:"rgba(166,190,89,.1)",color:"#A6BE59"}}>{hechas}/{tareas.length}</span></div>
          {s.fecha_inicio&&<div style={{fontSize:11,color:"#8A8580",marginBottom:8}}>📅 {new Date(s.fecha_inicio+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"})}</div>}
          <div className="prog" style={{marginBottom:10,height:6}}><div className="pfill" style={{width:`${tareas.length?(hechas/tareas.length)*100:0}%`}}/></div>
          {tareas.map(t=><div key={t.id} className={`cli${t.done?" done":""}`} style={{marginBottom:4}}>
            <div className={`chk${t.done?" on":""}`} onClick={async()=>{try{await sbPatch("jardin_servicio_tareas",`id=eq.${t.id}`,{done:!t.done,completado_por:!t.done?perfil.nombre:null,completado_ts:!t.done?new Date().toISOString():null},tQ);await loadCoordYServicios();}catch(_){}}} style={{cursor:"pointer"}}/>
            <div style={{flex:1,minWidth:0}}>
              <div className={`tl${t.done?" done":""}`}>{t.txt}</div>
              {t.done&&<div className="tm">✓ {t.completado_por}</div>}
            </div>
          </div>)}
          {hechas===tareas.length&&tareas.length>0&&<button className="btn bp" style={{width:"100%",justifyContent:"center",marginTop:8,background:"#A6BE59"}} onClick={async()=>{try{await sbPatch("jardin_servicios",`id=eq.${s.id}`,{estado:"completado"},tQ);const adms=await sbGet("usuarios","?rol=eq.admin&select=id",tQ).catch(()=>[]);for(const a of adms)await sbPost("notificaciones",{para:a.id,txt:`✅ ${perfil.nombre} ha completado "${s.nombre}"`},tQ).catch(()=>{});await loadCoordYServicios();}catch(_){}}}>✅ Marcar como completado</button>}
        </div>;
      })}

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
      <p style={{fontSize:13,color:"#8A8580",marginBottom:20,lineHeight:1.5}}>"{srvActivo?.nombre}" está activo. ¿Empezar la jornada de hoy?</p>
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
      <p style={{fontSize:13,color:"#8A8580",marginBottom:16,lineHeight:1.5}}>"{srvActivo?.nombre}" — todas las tareas asignadas completadas.</p>
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
          <input type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={async e=>{const f=e.target.files[0];if(!f)return;try{const url=await uploadFotoSeguro(f);setExtraForm(v=>({...v,foto_url:url}));}catch(_){const r=new FileReader();r.onload=ev=>setExtraForm(v=>({...v,foto_url:ev.target.result}));r.readAsDataURL(f);}}}/>
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
function DashL({perfil,setPage,tok}){
  const [coordP,setCoordP]=useState([]);const [savingC,setSavingC]=useState(false);const [showDatePick,setShowDatePick]=useState(null);const [customDate,setCustomDate]=useState("");
  useEffect(()=>{if(tok){const t=perfil?.es_operario?SB_KEY:tok;sbGet("coordinacion_servicios","?estado=in.(preguntando_si_lista,servicio_creado_pendiente_fecha)&select=*",t).then(r=>setCoordP(r.filter(c=>!c.tipo?.includes("jardin")))).catch(()=>{});}},[]);
  const getDias=(ini,fin)=>{const ds=[];const i=new Date(ini);const f=new Date(fin);const h=new Date();let d=i>h?i:h;while(d<=f&&ds.length<7){ds.push(new Date(d));d=new Date(d.getTime()+86400000);}return ds;};
  const confirmarFecha=async(c,dia)=>{if(savingC)return;setSavingC(true);const ds=dia.toISOString().split("T")[0];
    try{await sbPatch("coordinacion_servicios",`id=eq.${c.id}`,{fecha_programada:ds,estado:"confirmado",respondido_por:perfil.nombre},tok);
    if(c.servicio_id)await sbPatch("servicios",`id=eq.${c.servicio_id}`,{fecha:ds},tok).catch(()=>{});
    const adms=await sbGet("usuarios","?rol=eq.admin&select=id",tok).catch(()=>[]);
    for(const a of adms)await sbPost("notificaciones",{para:a.id,txt:`✅ ${perfil.nombre} ha confirmado limpieza para el ${new Date(ds+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"long"})}`},tok).catch(()=>{});
    setCoordP(prev=>prev.filter(x=>x.id!==c.id));}catch(_){}setSavingC(false);};
  const pedirPermiso=async(c)=>{if(savingC)return;setSavingC(true);
    try{await sbPatch("coordinacion_servicios",`id=eq.${c.id}`,{estado:"pendiente_aprobacion_admin",fecha_programada:c.fecha_checkin_siguiente,hora_programada:"08:00",respondido_por:perfil.nombre},tok);
    const adms=await sbGet("usuarios","?rol=eq.admin&select=id",tok).catch(()=>[]);
    for(const a of adms)await sbPost("notificaciones",{para:a.id,txt:`🔑 ${perfil.nombre} solicita limpiar el día del checkin (${c.fecha_checkin_siguiente})`},tok).catch(()=>{});
    setCoordP(prev=>prev.filter(x=>x.id!==c.id));}catch(_){}setSavingC(false);};
  return <div style={{background:T.bg,fontFamily:T.sans,paddingBottom:80,minHeight:"100%"}}>
    {/* Greeting */}
    <div style={{padding:"54px 20px 16px"}}>
      <div style={{fontSize:12,color:T.ink3,fontWeight:500}}>{new Date().toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"}).replace(/^\w/,c=>c.toUpperCase())}</div>
      <div style={{fontSize:28,fontWeight:700,color:T.ink,letterSpacing:-.8,lineHeight:1.02,marginTop:2}}>Hola, {perfil.nombre.split(" ")[0]} 👋</div>
    </div>

    {/* Coordinaciones */}
    {coordP.map(c=>{
      const t=perfil?.es_operario?SB_KEY:tok;
      const fechaFmt=c.fecha_checkin_siguiente?new Date(c.fecha_checkin_siguiente+"T12:00:00").toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"}):"—";
      const diasH=c.fecha_checkin_siguiente?Math.ceil((new Date(c.fecha_checkin_siguiente+"T12:00:00")-new Date())/(86400000)):0;

      if(c.estado==="preguntando_si_lista")return<div key={c.id} style={{padding:"0 20px 10px"}}>
        <div style={{background:T.terracotta,borderRadius:20,padding:16,color:T.ink}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}><div style={{width:8,height:8,borderRadius:999,background:T.ink}}/><span style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>Acción requerida</span></div>
          <div style={{fontSize:18,fontWeight:700,letterSpacing:-.4,lineHeight:1.2}}>¿Está la casa lista?</div>
          <div style={{fontSize:12,color:"rgba(20,10,5,.7)",marginTop:4}}>Reserva el {fechaFmt} — en {diasH} día{diasH!==1?"s":""}</div>
          <div style={{display:"flex",gap:8,marginTop:12}}>
            <button disabled={savingC} onClick={async()=>{setSavingC(true);try{await sbPatch("coordinacion_servicios",`id=eq.${c.id}`,{estado:"casa_lista_confirmada",respondido_por:perfil.nombre},t);const adms=await sbGet("usuarios","?rol=eq.admin&select=id",t).catch(()=>[]);for(const a of adms)await sbPost("notificaciones",{para:a.id,txt:`✅ ${perfil.nombre} confirma: casa lista para el ${fechaFmt}`},t).catch(()=>{});setCoordP(prev=>prev.filter(x=>x.id!==c.id));}catch(_){}setSavingC(false);}} style={{flex:1,padding:"12px 0",borderRadius:14,background:T.ink,color:"white",border:0,fontFamily:T.sans,fontSize:13,fontWeight:700,cursor:"pointer"}}>{savingC?"…":"✓ Sí, está lista"}</button>
            <button disabled={savingC} onClick={async()=>{setSavingC(true);try{const[srv]=await sbPost("servicios",{nombre:`Limpieza pre-reserva — ${fechaFmt}`,fecha:new Date().toISOString().split("T")[0],creado_por:perfil.nombre},t);for(const zona of LIMP_ZONAS){const ts=[...(zona.tareas||[]),...(zona.subzonas?zona.subzonas.flatMap(s=>s.tareas):[])];for(const ta of ts)await sbPost("servicio_tareas",{servicio_id:srv.id,tarea_id:ta.id,zona:zona.nombre,es_extra:false,done:false},t).catch(()=>{});}await sbPatch("coordinacion_servicios",`id=eq.${c.id}`,{estado:"servicio_creado_pendiente_fecha",servicio_id:srv.id},t);setCoordP(prev=>prev.map(x=>x.id===c.id?{...x,estado:"servicio_creado_pendiente_fecha",servicio_id:srv.id}:x));}catch(_){}setSavingC(false);}} style={{flex:1,padding:"12px 0",borderRadius:14,background:"white",color:T.ink,border:0,fontFamily:T.sans,fontSize:13,fontWeight:700,cursor:"pointer"}}>✗ Falta limpiar</button>
          </div>
        </div>
      </div>;

      const dias=getDias(c.ventana_inicio||new Date().toISOString(),c.ventana_fin||new Date(Date.now()+3*86400000).toISOString());
      return<div key={c.id} style={{padding:"0 20px 10px"}}>
        <div style={{background:T.gold,borderRadius:20,padding:16,color:T.ink}}>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:6}}>Elige día</div>
          <div style={{fontSize:16,fontWeight:700,letterSpacing:-.3,lineHeight:1.25}}>Limpieza antes de reserva</div>
          <div style={{fontSize:12,color:"rgba(30,25,5,.72)",marginTop:4}}>Reserva el {fechaFmt}</div>
          <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.min(dias.length,3)},1fr)`,gap:6,marginTop:12}}>
            {dias.slice(0,3).map((d,i)=><button key={d.toISOString()} onClick={()=>confirmarFecha(c,d)} disabled={savingC} style={{padding:"10px 0",borderRadius:14,background:i===0?T.ink:"rgba(255,255,255,.6)",color:i===0?"white":T.ink,border:0,cursor:"pointer",fontFamily:T.sans}}>
              <div style={{fontSize:10,fontWeight:600,opacity:.7}}>{d.toLocaleDateString("es-ES",{weekday:"short"})}</div>
              <div style={{fontSize:20,fontWeight:700,letterSpacing:-.5,marginTop:2}}>{d.getDate()}</div>
              {i===0&&<div style={{fontSize:9,marginTop:2,opacity:.8}}>recomendado</div>}
            </button>)}
          </div>
          <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
            <button onClick={()=>{setShowDatePick(c);setCustomDate("");}} style={{background:"transparent",border:0,color:T.ink,fontFamily:T.sans,fontSize:12,fontWeight:600,cursor:"pointer",textDecoration:"underline",padding:4}}>📅 Otra fecha</button>
            {c.fecha_checkin_siguiente&&<button onClick={()=>pedirPermiso(c)} disabled={savingC} style={{background:"transparent",border:0,color:T.ink,fontFamily:T.sans,fontSize:12,fontWeight:600,cursor:"pointer",textDecoration:"underline",padding:4}}>🔑 Pedir permiso día checkin</button>}
          </div>
        </div>
      </div>;
    })}

    {/* Modal fecha custom */}
    {showDatePick&&<div className="ov" onClick={()=>setShowDatePick(null)}><div className="modal" style={{maxWidth:360}} onClick={e=>e.stopPropagation()}>
      <h3>📅 Elegir fecha</h3>
      <div className="fg"><label>Fecha</label><input type="date" className="fi" value={customDate} onChange={e=>setCustomDate(e.target.value)}/></div>
      <div className="mft"><button className="btn bg" onClick={()=>setShowDatePick(null)}>Cancelar</button><button className="btn bp" disabled={!customDate||savingC} onClick={()=>{confirmarFecha(showDatePick,new Date(customDate+"T12:00:00"));setShowDatePick(null);}}>{savingC?"…":"Confirmar"}</button></div>
    </div></div>}

    {/* Sin pendientes */}
    {coordP.length===0&&<div style={{padding:"0 20px 14px"}}>
      <div style={{background:T.surface,borderRadius:20,padding:20,border:`1px solid ${T.line}`,textAlign:"center"}}>
        <div style={{fontSize:32,marginBottom:8}}>✅</div>
        <div style={{fontSize:16,fontWeight:700,color:T.ink}}>Todo al día</div>
        <div style={{fontSize:13,color:T.ink3,marginTop:4}}>No tienes coordinaciones pendientes</div>
      </div>
    </div>}

    {/* Accesos rápidos */}
    <div style={{padding:"0 20px 14px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
      {[{icon:"broom",t:"Mi servicio",s:"Checklist limpieza",id:"limpieza"},{icon:"calendar",t:"Calendario",s:"Próximos eventos",id:"cal-limp"}].map(it=><button key={it.id} onClick={()=>setPage(it.id)} style={{background:T.surface,border:`1px solid ${T.line}`,borderRadius:16,padding:16,cursor:"pointer",textAlign:"left",fontFamily:T.sans}}>
        <div style={{width:36,height:36,borderRadius:10,background:T.lavender+"30",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:8}}><FmIcon name={it.icon} size={18} stroke={T.ink}/></div>
        <div style={{fontSize:14,fontWeight:700,color:T.ink}}>{it.t}</div>
        <div style={{fontSize:11,color:T.ink3,marginTop:3}}>{it.s}</div>
      </button>)}
    </div>
  </div>;
}
function DashC({perfil,reservas,setPage}){
  const pend=reservas.filter(r=>r.estado==="visita"||r.estado==="pendiente_contrato").length;
  return <>
    <div style={{padding:"28px 32px 16px"}}><div style={{fontSize:12,color:T.ink3,fontWeight:500}}>{new Date().toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"})}</div><div style={{fontSize:28,fontWeight:700,color:T.ink,letterSpacing:-.8,lineHeight:1.02,marginTop:2}}>Hola, {perfil.nombre.split(" ")[0]} 👋</div></div>
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
    }catch(_){}
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
    }catch(_){}
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
    <div style={{padding:"28px 32px 16px"}}><div style={{fontSize:12,color:T.ink3,fontWeight:500}}>{TEMPORADA_LBL[temp]} · {comp}/{tot} tareas</div><div style={{fontSize:28,fontWeight:700,color:T.ink,letterSpacing:-.8,lineHeight:1.02,marginTop:2}}>{isA?"Checklist jardín":"Mi checklist"}</div></div>
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
  const delPunt=async id=>{try{await sbDelete("jardin_puntual",`id=eq.${id}`,tok);await load_();}catch(_){}};
  const setFrOv=async(tareaId,v)=>{try{await sbUpsert("jardin_frecuencias",{tarea_id:tareaId,frecuencia:parseInt(v),updated_at:new Date().toISOString()},tok);setEditFr(null);await load_();}catch(_){}};

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
    try{await sbPatch("jardin_servicios",`id=eq.${id}`,{estado:"completado"},tok);await load_();}catch(_){}
  };
  const cancelarServicio=async id=>{
    try{await sbPatch("jardin_servicios",`id=eq.${id}`,{estado:"cancelado"},tok);await load_();}catch(_){}
  };

  if(load)return <div className="loading"><div className="spin"/><span>Cargando…</span></div>;

  const srvsActivos=srvs.filter(s=>s.estado==="activo");
  const srvsHist=srvs.filter(s=>s.estado!=="activo");

  return <>
    <div style={{padding:"28px 32px 16px"}}><div style={{fontSize:12,color:T.ink3,fontWeight:500}}>Servicios · Planificación</div><div style={{fontSize:28,fontWeight:700,color:T.ink,letterSpacing:-.8,lineHeight:1.02,marginTop:2}}>Jardinería</div></div>
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
          <button onClick={()=>{setSrvForm(srvVacio);setSrvTareas([]);setShowSrv(true);}} style={{width:"100%",padding:"12px 0",borderRadius:999,border:0,background:T.ink,color:"white",fontFamily:T.sans,fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><FmIcon name="plus" size={14} stroke="white"/>Crear servicio a medida</button>
        </div>
        {srvsActivos.length===0&&srvsHist.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:T.ink3,fontSize:13}}>Sin servicios creados</div>}
        {srvsActivos.map(s=>{const tareas=s.jardin_servicio_tareas||[];const hechas=tareas.filter(t=>t.done).length;
          const fi=new Date(s.fecha_inicio+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"});
          const ff=new Date(s.fecha_fin+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"});
          const abierto=selSrv===s.id;const m=getOpsMeta(s.estado||"activo");
          return <div key={s.id} style={{background:T.surface,border:`1px solid ${abierto?T.ink:T.line}`,borderRadius:16,padding:14,marginBottom:10,boxShadow:abierto?"0 4px 12px rgba(40,30,20,.06)":"none"}}>
            <div onClick={()=>setSelSrv(abierto?null:s.id)} style={{cursor:"pointer",display:"flex",gap:10}}>
              <div style={{width:4,borderRadius:999,background:m.color,flexShrink:0,alignSelf:"stretch"}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}><OpsStatePill estado={s.estado||"activo"}/><span style={{fontSize:11,color:T.ink3,fontWeight:600}}>{hechas}/{tareas.length} tareas</span></div>
                <div style={{fontSize:14,fontWeight:700,color:T.ink,letterSpacing:-.2}}>{s.nombre}</div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginTop:4,fontSize:11,color:T.ink3}}><FmIcon name="calendar" size={11} stroke={T.ink3}/>{fi} – {ff}<span style={{color:T.ink4}}>·</span><OpsAvatar name={s.jardinero_nombre||"?"} size={16}/>{s.jardinero_nombre}</div>
              </div>
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
          <div style={{fontSize:11,color:T.ink3,textTransform:"uppercase",letterSpacing:1,fontWeight:700,marginTop:20,marginBottom:10}}>Historial</div>
          {srvsHist.map(s=>{const tareas=s.jardin_servicio_tareas||[];const hechas=tareas.filter(t=>t.done).length;
            const fi=new Date(s.fecha_inicio+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"});
            const ff=new Date(s.fecha_fin+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"});
            return <div key={s.id} style={{background:T.surface,border:`1px solid ${T.line}`,borderRadius:16,padding:12,marginBottom:8,opacity:.7,display:"flex",gap:10}}>
              <div style={{width:4,borderRadius:999,background:s.estado==="completado"?T.olive:T.danger,flexShrink:0,alignSelf:"stretch"}}/>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}><OpsStatePill estado={s.estado||"completado"}/></div>
                <div style={{fontSize:13,fontWeight:700,color:T.ink}}>{s.nombre}</div>
                <div style={{fontSize:11,color:T.ink3,marginTop:3}}>{fi} – {ff} · {s.jardinero_nombre} · {hechas}/{tareas.length}</div>
              </div>
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
      }catch(_){}
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
    <div style={{padding:"28px 32px 16px"}}><div style={{fontSize:12,color:T.ink3,fontWeight:500}}>{items.length} anotaciones registradas</div><div style={{fontSize:28,fontWeight:700,color:T.ink,letterSpacing:-.8,lineHeight:1.02,marginTop:2}}>Incidencias</div></div>
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
  const [finalStep,setFinalStep]=useState("check"); // "check" | "consumo" | "hora"
  const [consumoItems,setConsumoItems]=useState([]);
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

  const prepararConsumo=async()=>{
    try{
      const arts=await sbGet("almacen_articulos",`?activo=eq.true&stock_casa=gt.0&categoria=in.(limpieza,reposicion)&select=*&order=nombre.asc`,tok).catch(()=>[]);
      setConsumoItems(arts.map(a=>({...a,usado:0})));
    }catch(_){setConsumoItems([]);}
    setFinalStep("consumo");
  };
  const registrarConsumo=async()=>{
    const usados=consumoItems.filter(i=>i.usado>0);
    if(usados.length>0){
      const hoy=new Date().toISOString().split("T")[0];
      for(const i of usados){
        await sbPatch("almacen_articulos",`id=eq.${i.id}`,{stock_casa:Math.max(0,(parseFloat(i.stock_casa)||0)-i.usado)},tok).catch(()=>{});
        await sbPost("almacen_movimientos",{articulo_id:i.id,tipo:"salida",cantidad:i.usado,ubicacion_origen:"casa",concepto:`Consumo servicio limpieza - ${hoy}`,creado_por:perfil.nombre},tok).catch(()=>{});
      }
    }
    await prepararPasoHora();
  };

  const guardarFinal=async(modo)=>{
    if(finalSaving)return;
    if(modo==="ok"){
      await prepararConsumo();
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

  const selLimpiadora=(id)=>{
    const l=limpiadoras.find(x=>String(x.id)===String(id));
    setNewS(prev=>({...prev,limpiadora_id:id,modalidad_pago:l?.modalidad||"por_horas",tarifa_hora:l?.modalidad==="por_horas"?String(l?.tarifa_hora||""):""}));
  };

  // tabLimp MUST be before any conditional returns (React hooks rule)
  const [tabLimp,setTabLimp]=useState("todos");

  if(load)return <div className="loading"><div className="spin"/><span>Cargando…</span></div>;
  if(!isA&&servicios.length===0)return <><div style={{padding:"28px 32px 16px"}}><div style={{fontSize:28,fontWeight:700,color:T.ink}}>Mi servicio</div></div><div className="pb"><div className="empty"><span className="ico">🧹</span><p>Sin servicios asignados todavía</p></div></div></>;

  const srv=servicios.find(s=>s.id===actId);
  const fijas=tareas.filter(t=>!t.es_extra);
  const extras=tareas.filter(t=>t.es_extra);
  const comp=fijas.filter(t=>t.done).length;
  const tMap={};fijas.forEach(t=>{if(t.tarea_id)tMap[t.tarea_id]=t;});
  const allZonaIds=LIMP_ZONAS.flatMap(z=>getZonaTareas(z).map(t=>t.id));
  const useZonas=fijas.some(t=>allZonaIds.includes(t.tarea_id));
  const tot=tareas.length;
  const todoHecho=tot>0&&comp===tot;
  const yaVerif=srv?.verificado;

  const srvFilt=tabLimp==="todos"?servicios:tabLimp==="pendientes"?servicios.filter(s=>["pendiente","pendiente_fecha"].includes(s.estado||"")||(!s.estado&&!s.verificado)):tabLimp==="activos"?servicios.filter(s=>["en_curso","programado","activo"].includes(s.estado||"")):servicios.filter(s=>["completado","finalizado"].includes(s.estado||"")||s.verificado);
  const costeLimp=(servicios.reduce((t,s)=>t+(parseFloat(s.coste_calculado)||0),0)).toLocaleString("es-ES")+"€";

  return <div style={{paddingBottom:100}}>
    {/* Header */}
    <div style={{padding:"54px 20px 16px",display:"flex",alignItems:"flex-end",justifyContent:"space-between"}}>
      <div><div style={{fontSize:12,color:T.ink3,fontWeight:500}}>Servicios</div><div style={{fontSize:30,fontWeight:700,color:T.ink,letterSpacing:-1,lineHeight:1.02}}>{isA?"Limpieza":"Mi servicio"}</div></div>
      {isA&&<button onClick={()=>setShowNew(true)} style={{width:38,height:38,borderRadius:999,background:T.ink,border:0,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><FmIcon name="plus" size={18} stroke="white"/></button>}
    </div>

    {/* KPIs */}
    {isA&&<div style={{padding:"0 20px 14px",display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
      <OpsMiniKpi value={servicios.length} label="Total" color={T.ink}/>
      <OpsMiniKpi value={servicios.filter(s=>!["finalizado","completado"].includes(s.estado||"")&&!s.verificado).length} label="Abiertos" color={T.olive}/>
      <OpsMiniKpi value={costeLimp} label="Coste período" color={T.terracotta}/>
    </div>}

    {/* Tabs */}
    {isA&&<div style={{padding:"0 20px 14px"}}><div style={{display:"flex",background:T.surface,borderRadius:999,padding:4,border:`1px solid ${T.line}`,gap:2}}>
      {[{k:"todos",l:"Todos",c:servicios.length},{k:"pendientes",l:"Pendientes",c:servicios.filter(s=>["pendiente","pendiente_fecha"].includes(s.estado||"")||(!s.estado&&!s.verificado)).length},{k:"activos",l:"Activos",c:servicios.filter(s=>["en_curso","programado","activo"].includes(s.estado||"")).length},{k:"hechos",l:"Hechos",c:servicios.filter(s=>["completado","finalizado"].includes(s.estado||"")||s.verificado).length}].map(t=><button key={t.k} onClick={()=>setTabLimp(t.k)} style={{flex:1,padding:"9px 6px",borderRadius:999,border:0,background:tabLimp===t.k?T.ink:"transparent",color:tabLimp===t.k?"#fff":T.ink2,fontFamily:T.sans,fontSize:11,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>{t.l}<span style={{fontSize:9,padding:"1px 5px",borderRadius:999,background:tabLimp===t.k?"rgba(255,255,255,.2)":T.bg,color:tabLimp===t.k?"#fff":T.ink3}}>{t.c}</span></button>)}
    </div></div>}

    {/* Lista con OpsServiceCard */}
    <div style={{padding:"0 20px"}}>
      {srvFilt.map(s=><OpsServiceCard key={s.id} s={{...s,titulo:s.nombre,fecha:s.fecha}} kind="cleaning" onClick={()=>setActId(s.id)}/>)}
      {srvFilt.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:T.ink3,fontSize:13}}>Sin servicios en esta categoría</div>}
    </div>

    {/* DETALLE SERVICIO — pantalla completa */}
    {srv&&(
      <div style={{position:"fixed",inset:0,background:T.bg,zIndex:30,overflow:"auto",paddingBottom:40,fontFamily:T.sans}}>

        {/* Header */}
        <div style={{padding:"54px 20px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <button onClick={()=>setActId(null)} style={{width:36,height:36,borderRadius:999,background:T.surface,border:"1px solid "+T.line,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
            <FmIcon name="chevL" size={16} stroke={T.ink}/>
          </button>
          <div style={{fontSize:11,color:T.ink3,letterSpacing:1,textTransform:"uppercase",fontWeight:600}}>
            {String(srv.id).slice(-6)}
          </div>
          <div style={{display:"flex",gap:6}}>
            {isA&&<button onClick={()=>setShowEx(true)} style={{height:32,padding:"0 12px",borderRadius:999,background:T.ink,color:"#fff",border:0,fontFamily:T.sans,fontSize:11,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}><FmIcon name="plus" size={12} stroke="#fff"/>Extra</button>}
            {isA&&<button onClick={async()=>{if(!window.confirm(`¿Eliminar "${srv.nombre}"?`))return;await sbDelete("servicio_tareas",`servicio_id=eq.${srv.id}`,tok);await sbDelete("servicios",`id=eq.${srv.id}`,tok);setActId(null);setTareas([]);await loadSrvs();}} style={{width:32,height:32,borderRadius:999,background:"#FEF2F2",border:"1px solid #FECACA",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><FmIcon name="x" size={14} stroke="#D9443A"/></button>}
          </div>
        </div>

        {/* Título + estado + vínculo */}
        <div style={{padding:"0 20px 14px"}}>
          {(()=>{const m=getOpsMeta(srv.estado||(srv.verificado?"completado":"en_curso"));return(
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8,flexWrap:"wrap"}}>
              <span style={{display:"inline-flex",alignItems:"center",gap:4,height:22,padding:"0 9px",borderRadius:999,background:m.bg,color:m.ink,fontSize:10.5,fontWeight:700}}>
                <span style={{width:5,height:5,borderRadius:999,background:m.color}}/>{m.label}
              </span>
              {srv.limpiadora_nombre&&<div style={{display:"inline-flex",alignItems:"center",gap:4,height:22,padding:"0 9px",borderRadius:999,background:T.lavender+"22",color:"#4A3A8A",fontSize:10.5,fontWeight:700}}>
                <OpsAvatar name={srv.limpiadora_nombre} size={14}/>{srv.limpiadora_nombre}
              </div>}
            </div>
          );})()}
          <div style={{fontSize:28,fontWeight:700,color:T.ink,letterSpacing:-.8,lineHeight:1.05}}>{srv.nombre}</div>
          <div style={{fontSize:11,color:T.ink3,marginTop:4,display:"flex",alignItems:"center",gap:4}}>
            <FmIcon name="calendar" size={11} stroke={T.ink3}/>{new Date(srv.fecha).toLocaleDateString("es-ES",{day:"numeric",month:"long"})} · {comp}/{tot} tareas
          </div>
          {srv.reserva_nombre&&(
            <div style={{marginTop:8,padding:"10px 12px",background:T.surface,border:"1px solid "+T.line,borderRadius:14,display:"flex",alignItems:"center",gap:10}}>
              <FmIcon name="calendar" size={14} stroke={T.terracotta}/>
              <div style={{flex:1,fontSize:12,color:T.ink}}>Vinculado a <b>{srv.reserva_nombre}</b></div>
              <FmIcon name="chevR" size={14} stroke={T.ink3}/>
            </div>
          )}
        </div>

        {/* Asignación */}
        <div style={{padding:"0 20px 14px"}}>
          <div style={{fontSize:11,color:T.ink3,letterSpacing:1,textTransform:"uppercase",fontWeight:700,marginBottom:8}}>Asignación</div>
          <div style={{background:T.surface,borderRadius:16,padding:14,border:"1px solid "+T.line}}>
            <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:12}}>
              <OpsAvatar name={srv.limpiadora_nombre||"?"} size={38}/>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:T.ink}}>{srv.limpiadora_nombre||"Sin asignar"}</div>
                <div style={{fontSize:11,color:T.ink3}}>Limpiadora · {srv.modalidad_pago||"horas"} · {srv.tarifa_hora||0}€/h</div>
              </div>
            </div>
            <div style={{height:1,background:T.line,margin:"0 0 12px"}}/>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:10,color:T.ink3,textTransform:"uppercase",letterSpacing:.5,fontWeight:600}}>Fecha programada</div>
                <div style={{fontSize:14,fontWeight:700,color:T.ink,marginTop:3}}>{srv.fecha?new Date(srv.fecha).toLocaleDateString("es-ES",{weekday:"short",day:"numeric",month:"long"}):"Sin confirmar"}</div>
              </div>
              <FmIcon name="calendar" size={16} stroke={T.ink3}/>
            </div>
          </div>
        </div>

        {/* Coste — bloque terracotta */}
        <div style={{padding:"0 20px 14px"}}>
          <div style={{fontSize:11,color:T.ink3,letterSpacing:1,textTransform:"uppercase",fontWeight:700,marginBottom:8}}>Coste</div>
          <div style={{background:T.terracotta,borderRadius:20,padding:18,color:T.ink}}>
            <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:10}}>
              <div>
                <div style={{fontSize:10,color:"rgba(30,20,10,0.65)",letterSpacing:1,textTransform:"uppercase",fontWeight:700}}>Total calculado</div>
                <div style={{fontSize:44,fontWeight:700,letterSpacing:-1.5,lineHeight:1,marginTop:6}}>
                  {parseFloat(srv.coste_calculado||0)>0?parseFloat(srv.coste_calculado).toLocaleString("es-ES")+"€":"—"}
                </div>
              </div>
              <div style={{textAlign:"right",fontSize:11,color:"rgba(30,20,10,0.75)",lineHeight:1.6}}>
                {srv.modalidad_pago==="horas"
                  ?<><div><b>{srv.horas_trabajadas||0}h</b> × {srv.tarifa_hora||0}€</div><div style={{opacity:.7}}>modalidad por horas</div></>
                  :<div>Precio fijo</div>
                }
              </div>
            </div>
          </div>
        </div>

        {/* Progreso zonas */}
        {(()=>{
          const zComputed=useZonas?LIMP_ZONAS.filter(z=>{const cr=tMap[z.id+"_cerrada"];return !!cr?.done;}).length:0;
          const totalZonas=useZonas?LIMP_ZONAS.length:0;
          const pct=tot?Math.round(comp/tot*100):0;
          return <div style={{padding:"0 20px 14px"}}>
            <div style={{fontSize:11,color:T.ink3,letterSpacing:1,textTransform:"uppercase",fontWeight:700,marginBottom:8}}>
              Progreso · {useZonas?`${zComputed}/${totalZonas} zonas · `:""}{comp}/{tot} tareas
            </div>
            <div style={{background:T.surface,borderRadius:16,padding:14,border:"1px solid "+T.line}}>
              {useZonas&&<div style={{display:"flex",gap:3,marginBottom:12,flexWrap:"wrap"}}>
                {LIMP_ZONAS.map((z,i)=>{
                  const done=!!tMap[z.id+"_cerrada"]?.done;
                  const zt2=getZonaTareas(z);
                  const partial=zt2.some(t2=>tMap[t2.id]?.done)&&!done;
                  return(
                    <div key={i} style={{width:20,height:20,borderRadius:5,background:done?T.olive:partial?T.gold+"44":T.bg,border:"1px solid "+(done?T.olive:partial?T.gold:T.line),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      {done&&<FmIcon name="check" size={11} stroke="white" sw={2.5}/>}
                      {partial&&<div style={{width:6,height:6,borderRadius:999,background:T.gold}}/>}
                    </div>
                  );
                })}
              </div>}
              <div style={{height:5,background:T.bg,borderRadius:999,overflow:"hidden",marginBottom:8}}>
                <div style={{width:(pct)+"%",height:"100%",background:pct===100?T.olive:pct>40?T.terracotta:"#F35757"}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:12,color:T.ink3}}>
                <span>{pct===100?"Todas las tareas completadas":srv.hora_inicio?"Servicio en curso":"El servicio aún no ha comenzado"}</span>
                <span style={{fontWeight:700,color:pct===100?T.olive:T.ink}}>{pct}%</span>
              </div>
            </div>
          </div>;
        })()}

        {/* Banner verificado */}
        {yaVerif&&<div style={{padding:"0 20px 14px"}}><div style={{background:srv.verificado_ok?T.olive+"14":T.gold+"14",border:`1px solid ${srv.verificado_ok?T.olive+"44":T.gold+"44"}`,borderRadius:16,padding:"12px 16px",display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:28,height:28,borderRadius:999,background:srv.verificado_ok?T.olive:T.gold,display:"flex",alignItems:"center",justifyContent:"center"}}><FmIcon name={srv.verificado_ok?"check":"warn"} size={14} stroke="white" sw={2.5}/></div>
          <div><div style={{fontSize:13,fontWeight:700,color:srv.verificado_ok?"#4A7A2E":"#8A6B0F"}}>{srv.verificado_ok?"Servicio verificado":"Cerrado con incidencias"}</div>{srv.verificado_nota&&<div style={{fontSize:11,color:T.ink3,marginTop:2}}>{srv.verificado_nota}</div>}</div>
        </div></div>}

        {/* Zonas y tareas */}
        <div style={{padding:"0 20px 14px"}}>
          <div style={{fontSize:11,color:T.ink3,letterSpacing:1,textTransform:"uppercase",fontWeight:700,marginBottom:8}}>Zonas y tareas</div>

          {/* Hora inicio — limpiadora */}
          {isL&&!yaVerif&&<>
            {!srv.hora_inicio?(
              <button className="btn bp" style={{width:"100%",justifyContent:"center",padding:"14px",fontSize:15,marginBottom:14}} onClick={iniciarServicio} disabled={saving}>▶️ Iniciar servicio</button>
            ):(
              <div style={{background:"rgba(16,185,129,.08)",border:"1px solid rgba(16,185,129,.2)",borderRadius:14,padding:"10px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:18}}>⏱️</span>
                <div style={{fontSize:13,color:T.olive,fontWeight:500}}>En curso desde las <strong>{srv.hora_inicio?.slice(0,5)}</strong></div>
              </div>
            )}
          </>}

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
            return <div key={zona.id} style={{marginBottom:8,borderRadius:16,overflow:"hidden",border:`1px solid ${zonaCerrada?T.olive+"44":abierta?T.terracotta+"33":T.line}`,background:zonaCerrada?T.olive+"08":T.surface}}>
              <div onClick={()=>setZonasAbiertas(prev=>({...prev,[zona.id]:!prev[zona.id]}))} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",cursor:"pointer"}}>
                <div style={{width:32,height:32,borderRadius:10,background:zonaCerrada?T.olive:estadoColor+"22",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {zonaCerrada?<FmIcon name="check" size={16} stroke="white" sw={2.5}/>:<span style={{fontSize:16}}>{zona.emoji}</span>}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:700,color:T.ink,letterSpacing:-.2}}>{zona.nombre}</div>
                  <div style={{fontSize:11,color:T.ink3,marginTop:1}}>{zonaDone}/{zonaTotal} tareas</div>
                </div>
                {!zonaCerrada&&zonaDone>0&&<div style={{width:40,height:4,borderRadius:999,background:T.bg,overflow:"hidden"}}><div style={{width:(zonaDone/zonaTotal*100)+"%",height:"100%",background:estadoColor}}/></div>}
                <FmIcon name={abierta?"chevD":"chevR"} size={14} stroke={T.ink3}/>
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
                        try{const url=await uploadFotoSeguro(f);await sbPost("servicio_tareas",{servicio_id:actId,tarea_id:zona.id+"_cerrada",zona:zona.nombre,done:true,completado_por:perfil.nombre,completado_ts:new Date().toISOString(),foto_url:url,es_extra:false},tok);await loadTareas(actId);}catch(_){}
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
            <div style={{height:1,background:T.line,margin:"14px 0"}}/>
            <div style={{fontSize:11,color:T.terracotta,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:9}}>Extras</div>
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
        </div>

        {/* Botones acción */}
        {isA&&<div style={{padding:"0 20px 14px",display:"flex",gap:8}}>
          <button onClick={()=>setShowEx(true)} style={{flex:1,padding:"13px 0",borderRadius:999,border:"1px solid "+T.line,background:T.surface,color:T.ink,fontFamily:T.sans,fontWeight:600,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            <FmIcon name="plus" size={14} stroke={T.ink}/>Añadir extra
          </button>
        </div>}

      </div>
    )}

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
        <div style={{background:T.bg,borderRadius:"24px 24px 0 0",padding:"24px 20px 36px",width:"100%",maxWidth:540,maxHeight:"92vh",overflowY:"auto"}}>
          <div style={{width:40,height:4,borderRadius:999,background:T.line,margin:"0 auto 14px"}}/>

          {!finalMode&&<>
            <div style={{textAlign:"center",marginBottom:20}}>
              <div style={{fontSize:30,fontWeight:700,color:T.ink,letterSpacing:-.8,lineHeight:1.05}}>Cierre del servicio</div>
              <div style={{fontSize:13,color:T.ink3,marginTop:6}}>Todas las tareas completadas. ¿Cómo quieres cerrar?</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
              <button onClick={()=>setFinalMode("ok")} style={{width:"100%",padding:16,borderRadius:16,background:T.ink,color:"white",border:0,fontFamily:T.sans,fontWeight:700,fontSize:15,cursor:"pointer"}}>✅ Todo correcto — casa lista</button>
              <button onClick={()=>setFinalMode("incidencia")} style={{width:"100%",padding:16,borderRadius:16,background:T.surface,color:T.ink,border:`1px solid ${T.line}`,fontFamily:T.sans,fontWeight:700,fontSize:15,cursor:"pointer"}}>⚠️ Cerrar con incidencias</button>
            </div>
          </>}

          {finalMode==="ok"&&finalStep==="check"&&<>
            <div style={{fontSize:11,color:T.ink3,letterSpacing:1,textTransform:"uppercase",fontWeight:700,marginBottom:4}}>Cierre final</div>
            <div style={{fontSize:24,fontWeight:700,color:T.ink,letterSpacing:-.6,marginBottom:4}}>Check · {LIMP_CF.length} puntos</div>
            <div style={{fontSize:13,color:T.ink3,marginBottom:14}}>{Object.values(finalCheck).filter(Boolean).length}/{LIMP_CF.length} verificados</div>
            <div style={{background:T.surface,borderRadius:16,border:`1px solid ${T.line}`,overflow:"hidden"}}>
              {LIMP_CF.map((item,i)=>{const ok=!!finalCheck[item.id];return(
                <button key={item.id} onClick={()=>setFinalCheck(prev=>({...prev,[item.id]:!prev[item.id]}))} style={{width:"100%",background:"transparent",border:0,cursor:"pointer",display:"flex",alignItems:"center",gap:12,padding:"14px 14px",textAlign:"left",borderBottom:i<LIMP_CF.length-1?`1px solid ${T.line}`:"none",fontFamily:T.sans}}>
                  <div style={{width:26,height:26,borderRadius:999,background:ok?T.olive:"transparent",border:`2px solid ${ok?T.olive:T.line}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{ok&&<FmIcon name="check" size={14} stroke="white" sw={3}/>}</div>
                  <div style={{flex:1}}><div style={{fontSize:10,color:T.ink3,fontWeight:600}}>{String(i+1).padStart(2,"0")}</div><div style={{fontSize:13,color:ok?T.ink3:T.ink,fontWeight:ok?400:600,textDecoration:ok?"line-through":"none",marginTop:1}}>{item.txt}</div></div>
                </button>
              );})}
            </div>
            <div style={{display:"flex",gap:8,marginTop:16}}>
              <button onClick={()=>setFinalMode(null)} style={{flex:1,padding:12,borderRadius:999,border:`1px solid ${T.line}`,background:T.surface,color:T.ink,fontFamily:T.sans,fontWeight:600,fontSize:13,cursor:"pointer"}}>← Volver</button>
              <button onClick={()=>guardarFinal("ok")} disabled={finalSaving} style={{flex:2,padding:12,borderRadius:999,border:0,background:Object.values(finalCheck).filter(Boolean).length===LIMP_CF.length?T.ink:T.ink+"55",color:"white",fontFamily:T.sans,fontWeight:700,fontSize:13,cursor:Object.values(finalCheck).filter(Boolean).length===LIMP_CF.length?"pointer":"not-allowed"}}>{finalSaving?"Guardando…":"Cerrar servicio →"}</button>
            </div>
          </>}
          {finalMode==="ok"&&finalStep==="consumo"&&<>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,color:T.ink3,letterSpacing:1,textTransform:"uppercase",fontWeight:700,marginBottom:4}}>Paso final</div>
              <div style={{fontSize:24,fontWeight:700,color:T.ink,letterSpacing:-.6}}>Productos consumidos</div>
              <div style={{fontSize:13,color:T.ink3,marginTop:4}}>Ajusta cantidades para actualizar el almacén</div>
            </div>
            {consumoItems.length===0?<div style={{color:T.ink3,fontSize:13,textAlign:"center",padding:"16px 0"}}>No hay artículos con stock en casa</div>
            :consumoItems.map((it,idx)=>{const colors=[T.olive,T.softBlue,T.lavender,"#F2995E",T.gold,T.terracotta];const color=colors[idx%colors.length];return<div key={it.id} style={{background:T.surface,borderRadius:16,padding:14,border:`1px solid ${T.line}`,marginBottom:8}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:34,height:34,borderRadius:8,background:color,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}><FmIcon name="box" size={14} stroke={T.ink}/></div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:T.ink,letterSpacing:-.1}}>{it.nombre}</div>
                  <div style={{fontSize:11,color:T.ink3}}>Stock: {parseFloat(it.stock_casa)||0} {it.unidad||""}</div>
                </div>
                <input type="number" min="0" step={it.es_liquido?"0.25":"1"} value={it.usado||""} onChange={e=>setConsumoItems(prev=>prev.map((p,i)=>i===idx?{...p,usado:parseFloat(e.target.value)||0}:p))} placeholder="0" style={{width:70,textAlign:"center",fontSize:18,fontWeight:700,padding:"8px",borderRadius:10,border:`1px solid ${T.line}`,background:T.surface,fontFamily:T.sans,outline:"none"}}/>
              </div>
            </div>;})}
            <div style={{display:"flex",gap:8,marginTop:16}}>
              <button className="btn bg" style={{flex:1,justifyContent:"center"}} onClick={()=>prepararPasoHora()}>Saltar</button>
              <button className="btn bp" style={{flex:2,justifyContent:"center",padding:"12px",fontSize:15}} onClick={registrarConsumo} disabled={finalSaving}>{finalSaving?"Registrando…":"📦 Registrar y continuar"}</button>
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
  </div>;
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
  useEffect(()=>{(async()=>{try{
    const[uNorm,uOps]=await Promise.all([
      sbGet("usuarios","?rol=neq.admin&select=*",tok),
      isA?sbGet("operarios","?activo=eq.true&select=*",tok).catch(()=>[]):Promise.resolve([])
    ]);
    const opsF=uOps.map(op=>({id:op.id,nombre:op.nombre,rol:op.rol,avatar:op.avatar||op.nombre.slice(0,2).toUpperCase(),es_operario:true}));
    setUsuarios([...uNorm,...opsF]);loadUnread();
  }catch(_){}setLoad(false);})();},[]);
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
              📷<input type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={async e=>{const f=e.target.files[0];if(f){try{const url=await uploadFotoSeguro(f);setFotoMsg(url);}catch(_){const r=new FileReader();r.onload=ev=>setFotoMsg(ev.target.result);r.readAsDataURL(f);}}}}/>
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
              📷<input type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={async e=>{const f=e.target.files[0];if(f){try{const url=await uploadFotoSeguro(f);setFotoMsg(url);}catch(_){const r=new FileReader();r.onload=ev=>setFotoMsg(ev.target.result);r.readAsDataURL(f);}}}}/>
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
  const [reservas, airbnbs] = await Promise.all([
    sbGet("reservas", `?fecha=eq.${fecha}&select=nombre,tipo,estado`, tok),
    sbGet("reservas_airbnb", `?fecha_entrada=lte.${fecha}&fecha_salida=gte.${fecha}&select=huesped,fecha_entrada,fecha_salida`, tok),
  ]);
  const conflictos=[
    ...reservas.filter(r=>["visita","pendiente_contrato","contrato_firmado","reserva_pagada","precio_total"].includes(r.estado)).map(r=>({tipo:"evento",nombre:r.nombre,detalle:`Evento: ${r.tipo||""}`,color:"#6366f1"})),
    ...airbnbs.map(a=>({tipo:"airbnb",nombre:"Alojamiento turístico",detalle:`Airbnb: ${a.huesped}`,color:"#A6BE59"})),
  ];
  // Check blocked days from events with house
  const diaAntes=new Date(new Date(fecha+"T12:00:00").getTime()+86400000).toISOString().split("T")[0];
  const diaDespues=new Date(new Date(fecha+"T12:00:00").getTime()-86400000).toISOString().split("T")[0];
  const evAdj=await sbGet("reservas",`?incluye_casa=eq.true&estado=neq.cancelada&fecha=in.(${diaAntes},${diaDespues})&select=nombre,fecha,bloqueo_dia_anterior,bloqueo_dia_posterior,dia_anterior_desbloqueado,dia_posterior_desbloqueado`,tok).catch(()=>[]);
  for(const r of evAdj){
    const esDiaAntes=r.fecha===diaAntes; // evento es mañana → hoy es día anterior
    const esDiaDespues=r.fecha===diaDespues; // evento fue ayer → hoy es día posterior
    if(esDiaAntes&&r.bloqueo_dia_anterior&&!r.dia_anterior_desbloqueado)conflictos.push({tipo:"bloqueo_evento",nombre:`Bloqueado: día previo a "${r.nombre}"`,detalle:"Día anterior al evento con casa",color:"#6366f1"});
    if(esDiaDespues&&r.bloqueo_dia_posterior&&!r.dia_posterior_desbloqueado)conflictos.push({tipo:"bloqueo_evento",nombre:`Bloqueado: día posterior a "${r.nombre}"`,detalle:"Día posterior al evento con casa",color:"#6366f1"});
  }
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
  const{refresh}=useContext(BadgeCtx);
  useEffect(()=>{marcarVistoTipo("notificacion",String(perfil?.id),tok);setTimeout(refresh,500);},[]);
  const [notifs,setNotifs]=useState([]);const [usuarios,setUsuarios]=useState([]);
  const [dest,setDest]=useState("");const [txt,setTxt]=useState("");const [load,setLoad]=useState(true);const [saving,setSaving]=useState(false);
  useEffect(()=>{(async()=>{try{
    const n=isA?await sbGet("notificaciones","?select=*&order=created_at.desc",tok):await sbGet("notificaciones",`?para=eq.${perfil.id}&order=created_at.desc`,tok);
    setNotifs(n);
    if(isA){const[u,o]=await Promise.all([sbGet("usuarios","?rol=neq.admin&select=*",tok),sbGet("operarios","?activo=eq.true&select=*",tok).catch(()=>[])]);const opsF=o.map(op=>({id:op.id,nombre:op.nombre,rol:op.rol,avatar:op.avatar||op.nombre.slice(0,2).toUpperCase(),es_operario:true}));setUsuarios([...u,...opsF]);}
  }catch(_){}setLoad(false);})();},[]);
  const enviar=async()=>{if(!txt.trim()||!dest||saving)return;setSaving(true);const targets=dest==="todos"?usuarios:usuarios.filter(u=>String(u.id)===dest);for(const u of targets){await sbPost("notificaciones",{para:u.id,txt},tok);sendPush("🌾 Finca El Molino",txt,`notif-${u.id}`);}setTxt("");setDest("");setSaving(false);};
  const leer=async id=>{try{await sbPatch("notificaciones",`id=eq.${id}`,{leida:true},tok);setNotifs(prev=>prev.map(n=>n.id===id?{...n,leida:true}:n));}catch(_){}};
  if(load)return <div className="loading"><div className="spin"/><span>Cargando…</span></div>;
  const RL={jardinero:"Jardinero",limpieza:"Limpieza",comercial:"Comercial"};
  return <>
    <div style={{padding:"28px 32px 16px"}}><div style={{fontSize:12,color:T.ink3,fontWeight:500}}>{isA?"Envía avisos al equipo":`${notifs.filter(n=>!n.leida).length} sin leer`}</div><div style={{fontSize:28,fontWeight:700,color:T.ink,letterSpacing:-.8,lineHeight:1.02,marginTop:2}}>Notificaciones</div></div>
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
    <div style={{padding:"54px 20px 16px"}}><div style={{fontSize:12,color:T.ink3,fontWeight:500}}>Accesos y roles</div><div style={{fontSize:30,fontWeight:700,color:T.ink,letterSpacing:-1,lineHeight:1.02}}>Usuarios</div></div>
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
      const srvsDel=await sbGet("jardin_servicios",`?jardinero_id=eq.${j.id}&select=id`,tok).catch(()=>[]);
      const srvIds=srvsDel.map(s=>s.id);
      let jornadas=[];
      if(srvIds.length>0){
        try{jornadas=await sbGet("jornadas_jardineria",`?servicio_id=in.(${srvIds.join(",")})&select=*`,tok);}catch(_){}
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
    <div style={{padding:"28px 32px 16px"}}><div style={{fontSize:12,color:T.ink3,fontWeight:500}}>Gestión de jardineros y condiciones</div><div style={{fontSize:28,fontWeight:700,color:T.ink,letterSpacing:-.8,lineHeight:1.02,marginTop:2}}>Jardineros</div></div>
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
    <div style={{padding:"28px 32px 16px"}}><div style={{fontSize:12,color:T.ink3,fontWeight:500}}>Gestión de limpiadoras y condiciones</div><div style={{fontSize:28,fontWeight:700,color:T.ink,letterSpacing:-.8,lineHeight:1.02,marginTop:2}}>Limpiadoras</div></div>
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

// ─── LAVANDERÍA ─────────────────────────────────────────────────────────────
function Lavanderia({perfil,tok,rol}){
  const isA=rol==="admin";
  const hoyStr=new Date().toISOString().split("T")[0];
  const [envios,setEnvios]=useState([]);const [articulos,setArticulos]=useState([]);
  const [load,setLoad]=useState(true);const [saving,setSaving]=useState(false);
  const [showEnvio,setShowEnvio]=useState(false);const [showRecogida,setShowRecogida]=useState(null);
  const [items,setItems]=useState([]);const [notas,setNotas]=useState("");const [envErr,setEnvErr]=useState("");
  const [recFecha,setRecFecha]=useState(hoyStr);const [recCoste,setRecCoste]=useState("");const [recFoto,setRecFoto]=useState(null);
  const [checkItems,setCheckItems]=useState([]);
  const [showDiscrepancias,setShowDiscrepancias]=useState(null);const [fuentes,setFuentes]=useState({});

  const load_=async()=>{
    try{
      const[e,a]=await Promise.all([
        sbGet("lavanderia","?select=*&order=fecha_envio.desc",tok),
        sbGet("almacen_articulos","?tiene_lavanderia=eq.true&activo=eq.true&select=*&order=nombre.asc",tok).catch(()=>[]),
      ]);
      setEnvios(e);setArticulos(a);
    }catch(_){}setLoad(false);
  };
  useEffect(()=>{load_();},[]);

  const verificarEnvioLav=(filled)=>{
    const disc=[];
    for(const i of filled){
      const art=articulos.find(a=>a.id===i.id);
      const sC=parseFloat(art?.stock_casa||0),sA=parseFloat(art?.stock_almacen||0);
      if(sC<i.cantidad)disc.push({...i,articulo_id:i.id,stock_casa:sC,stock_almacen:sA,diferencia:i.cantidad-sC});
    }
    return disc;
  };
  const enviar=async()=>{
    const filled=items.filter(i=>i.cantidad>0);
    if(filled.length===0||saving)return;setEnvErr("");
    const disc=verificarEnvioLav(filled);
    if(disc.length>0){setFuentes(disc.reduce((o,d)=>({...o,[d.articulo_id]:"casa"}),{}));setShowDiscrepancias(disc);return;}
    await ejecutarEnvio(filled,{});
  };
  const ejecutarEnvio=async(filledOrig,fuentesMap)=>{
    const filled=filledOrig||items.filter(i=>i.cantidad>0);
    if(filled.length===0)return;setSaving(true);
    try{
      await sbPost("lavanderia",{fecha_envio:hoyStr,items:filled.map(i=>({articulo_id:i.id||i.articulo_id,nombre:i.nombre,cantidad:i.cantidad})),estado:"en_lavanderia",creado_por:perfil.nombre,notas:notas||null},tok);
      for(const i of filled){
        const aid=i.id||i.articulo_id;const art=articulos.find(a=>a.id===aid);
        const fuente=fuentesMap[aid]||"casa";
        const campo=fuente==="casa"?"stock_casa":"stock_almacen";
        const stockOrigen=parseFloat(art?.[campo]||0);
        const stockNuevo=Math.max(0,stockOrigen-i.cantidad);
        await sbPatch("almacen_articulos",`id=eq.${aid}`,{[campo]:stockNuevo,stock_lavanderia:(parseFloat(art?.stock_lavanderia||0))+i.cantidad},tok).catch(()=>{});
        await sbPost("almacen_movimientos",{articulo_id:aid,tipo:"lavanderia_envio",cantidad:i.cantidad,ubicacion_origen:fuente,ubicacion_destino:"lavanderia",concepto:`Envío lavandería — ${hoyStr}`,creado_por:perfil.nombre},tok).catch(()=>{});
      }
      setShowEnvio(false);setShowDiscrepancias(null);setItems([]);setNotas("");setFuentes({});await load_();
    }catch(_){}setSaving(false);
  };

  const abrirRecogida=(lav)=>{setCheckItems((lav.items||[]).map(i=>({...i,cantidad_recibida:i.cantidad,nota:""})));setRecFecha(hoyStr);setRecCoste("");setRecFoto(null);setShowRecogida(lav);};
  const recoger=async()=>{
    if(!showRecogida||saving)return;setSaving(true);
    const coste=parseFloat(recCoste)||0;
    const incidencias=checkItems.filter(i=>i.cantidad_recibida<i.cantidad).map(i=>({articulo_id:i.articulo_id,nombre:i.nombre,enviadas:i.cantidad,recibidas:i.cantidad_recibida,faltan:i.cantidad-i.cantidad_recibida,nota:i.nota}));
    try{
      await sbPatch("lavanderia",`id=eq.${showRecogida.id}`,{estado:"recogido",fecha_recogida:recFecha,coste,factura_url:recFoto||null,checklist_recogida:checkItems,incidencias_recogida:incidencias,checklist_completado:true},tok);
      for(const i of checkItems){if(i.cantidad_recibida>0){const art=articulos.find(a=>a.id===i.articulo_id);
        await sbPatch("almacen_articulos",`id=eq.${i.articulo_id}`,{stock_lavanderia:Math.max(0,(parseFloat(art?.stock_lavanderia)||0)-i.cantidad_recibida),stock_almacen:(parseFloat(art?.stock_almacen)||0)+i.cantidad_recibida},tok).catch(()=>{});
        await sbPost("almacen_movimientos",{articulo_id:i.articulo_id,tipo:"lavanderia_retorno",cantidad:i.cantidad_recibida,ubicacion_origen:"lavanderia",ubicacion_destino:"almacen",concepto:`Recogida lavandería — ${recFecha}`,creado_por:perfil.nombre},tok).catch(()=>{});}}
      if(coste>0)await sbPost("gastos",{fecha:hoyStr,categoria:"Otros",concepto:`Lavandería — ${showRecogida.fecha_envio}`,importe:coste,origen:"auto_lavanderia"},tok).catch(()=>{});
      if(incidencias.length>0){
        const msgInc=`⚠️ Incidencia lavandería ${new Date().toLocaleDateString("es-ES")}: `+incidencias.map(i=>`${i.nombre} — enviadas ${i.enviadas}, recibidas ${i.recibidas} (faltan ${i.faltan}${i.nota?": "+i.nota:""})`).join(" | ");
        const adms=await sbGet("usuarios","?rol=eq.admin&select=id",tok).catch(()=>[]);
        for(const a of adms)await sbPost("notificaciones",{para:a.id,txt:msgInc},tok).catch(()=>{});
        sendPush("⚠️ Incidencia lavandería",msgInc,"lavanderia-incidencia");
      }
      setShowRecogida(null);await load_();
    }catch(_){}setSaving(false);
  };

  const enLav=envios.filter(e=>e.estado==="en_lavanderia");
  const historial=envios.filter(e=>e.estado==="recogido");

  if(load)return <div className="loading"><div className="spin"/><span>Cargando…</span></div>;
  return <>
    <div style={{padding:"28px 32px 16px"}}><div style={{fontSize:12,color:T.ink3,fontWeight:500}}>{enLav.length} envíos pendientes</div><div style={{fontSize:28,fontWeight:700,color:T.ink,letterSpacing:-.8,lineHeight:1.02,marginTop:2}}>Lavandería</div></div>
    <div className="pb">
      <button className="btn bp" style={{marginBottom:16}} onClick={()=>{setItems(articulos.map(a=>({...a,cantidad:0})));setNotas("");setShowEnvio(true);}}>➕ Enviar a lavandería</button>

      {enLav.length===0?<div className="empty"><span className="ico">🧺</span><p>Sin envíos pendientes</p></div>
      :enLav.map(e=><div key={e.id} className="card" style={{marginBottom:10,borderLeft:"3px solid #D4A017"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
          <div><div style={{fontSize:14,fontWeight:600,color:"#1A1A1A"}}>Envío {new Date(e.fecha_envio+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"})}</div>
            <div style={{fontSize:12,color:"#8A8580",marginTop:3}}>{(e.items||[]).map(i=>`${i.nombre} ×${i.cantidad}`).join(", ")}</div>
            {e.notas&&<div style={{fontSize:11,color:"#8A8580",marginTop:2}}>{e.notas}</div>}
            <div style={{fontSize:11,color:"#BFBAB4",marginTop:3}}>Por {e.creado_por}</div>
          </div>
          <button className="btn bp sm" onClick={()=>abrirRecogida(e)}>✅ Recogido</button>
        </div>
      </div>)}

      {historial.length>0&&<>
        <div style={{fontSize:11,color:"#8A8580",textTransform:"uppercase",letterSpacing:1,fontWeight:700,marginTop:24,marginBottom:10}}>Historial</div>
        {historial.slice(0,10).map(e=>{const inc=e.incidencias_recogida||[];return<div key={e.id} className="card" style={{marginBottom:8,opacity:inc.length>0?1:.7,borderLeft:inc.length>0?"3px solid #D4A017":"none"}}>
          <div style={{fontSize:13,fontWeight:600,color:"#1A1A1A"}}>✅ {new Date(e.fecha_envio+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"})} → {e.fecha_recogida?new Date(e.fecha_recogida+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"}):"—"}</div>
          <div style={{fontSize:12,color:"#8A8580"}}>{(e.items||[]).map(i=>`${i.nombre} ×${i.cantidad}`).join(", ")}{e.coste?` · ${parseFloat(e.coste).toLocaleString("es-ES")}€`:""}</div>
          {inc.length>0&&<div style={{marginTop:6,padding:"6px 10px",background:"#FEF3CD",borderRadius:8,fontSize:12}}>
            <div style={{fontWeight:600,color:"#856404",marginBottom:4}}>⚠️ Incidencias:</div>
            {inc.map((ic,j)=><div key={j} style={{color:"#856404"}}>• {ic.nombre}: falta {ic.faltan}{ic.nota?` (${ic.nota})`:""}</div>)}
          </div>}
        </div>})}
      </>}
    </div>

    {showEnvio&&<div className="ov" onClick={()=>setShowEnvio(false)}><div className="modal" style={{maxHeight:"90vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
      <h3>🧺 Enviar a lavandería</h3>
      {items.map((it,idx)=><div key={it.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid rgba(0,0,0,.04)"}}>
        <div style={{flex:1,fontSize:13,color:"#1A1A1A"}}>{it.nombre}</div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <button className="btn bg sm" onClick={()=>setItems(prev=>prev.map((p,i)=>i===idx?{...p,cantidad:Math.max(0,p.cantidad-1)}:p))}>−</button>
          <span style={{fontSize:16,fontWeight:700,minWidth:24,textAlign:"center"}}>{it.cantidad}</span>
          <button className="btn bg sm" onClick={()=>setItems(prev=>prev.map((p,i)=>i===idx?{...p,cantidad:p.cantidad+1}:p))}>+</button>
        </div>
      </div>)}
      <div className="fg" style={{marginTop:12}}><label>Notas</label><textarea className="fi" rows={2} value={notas} onChange={e=>setNotas(e.target.value)} placeholder="Notas opcionales…"/></div>
      <div className="mft"><button className="btn bg" onClick={()=>setShowEnvio(false)}>Cancelar</button><button className="btn bp" onClick={enviar} disabled={saving||items.every(i=>i.cantidad===0)}>{saving?"Enviando…":"🧺 Confirmar envío"}</button></div>
    </div></div>}

    {showRecogida&&<div className="ov" onClick={()=>setShowRecogida(null)}><div className="modal" style={{maxHeight:"92vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
      <h3>✅ Checklist de recogida</h3>
      <div style={{fontSize:12,color:"#8A8580",marginBottom:14}}>Verifica que todo ha vuelto de la lavandería</div>
      {checkItems.map((it,i)=><div key={i} style={{background:"#F5F3F0",borderRadius:10,padding:"10px 12px",marginBottom:8,borderLeft:`3px solid ${it.cantidad_recibida>=it.cantidad?"#A6BE59":"#D4A017"}`}}>
        <div style={{fontWeight:600,fontSize:13,marginBottom:6}}>{it.nombre}</div>
        <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{fontSize:12,color:"#8A8580"}}>Enviadas: {it.cantidad}</span>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:12}}>Recibidas:</span>
            <input type="number" min="0" max={it.cantidad} className="fi" value={it.cantidad_recibida} onChange={e=>setCheckItems(prev=>prev.map((x,j)=>j===i?{...x,cantidad_recibida:Math.min(it.cantidad,Math.max(0,parseFloat(e.target.value)||0))}:x))} style={{width:60,textAlign:"center",fontWeight:700,padding:"6px"}}/>
            <span>{it.cantidad_recibida>=it.cantidad?"✅":"⚠️"}</span>
          </div>
        </div>
        {it.cantidad_recibida<it.cantidad&&<input className="fi" style={{marginTop:8,fontSize:12}} placeholder="Nota sobre la diferencia..." value={it.nota||""} onChange={e=>setCheckItems(prev=>prev.map((x,j)=>j===i?{...x,nota:e.target.value}:x))}/>}
      </div>)}
      <hr className="div"/>
      <div className="fg"><label>Fecha recogida</label><input type="date" className="fi" value={recFecha} onChange={e=>setRecFecha(e.target.value)}/></div>
      <div className="fg"><label>Coste factura (€)</label><input type="number" inputMode="decimal" className="fi" value={recCoste} onChange={e=>setRecCoste(e.target.value)} placeholder="0"/></div>
      <div className="fg"><label>Foto factura</label>
        <label className="pbtn">{recFoto?"📷 Cambiar":"📷 Foto"}<input type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={async e=>{const f=e.target.files[0];if(!f)return;try{const url=await uploadFotoSeguro(f);setRecFoto(url);}catch(_){const r=new FileReader();r.onload=ev=>setRecFoto(ev.target.result);r.readAsDataURL(f);}}}/></label>
        {recFoto&&<img src={recFoto} alt="" className="pprev"/>}
      </div>
      <div className="mft"><button className="btn bg" onClick={()=>setShowRecogida(null)}>Cancelar</button><button className="btn bp" onClick={recoger} disabled={saving}>{saving?"Guardando…":"✅ Confirmar recogida"}</button></div>
    </div></div>}

    {showDiscrepancias&&<div className="ov" onClick={()=>setShowDiscrepancias(null)}><div className="modal" style={{maxHeight:"90vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
      <h3 style={{color:"#D4A017"}}>⚠️ Discrepancias en el envío</h3>
      <div style={{fontSize:13,color:"#8A8580",marginBottom:14}}>Hay artículos que superan el stock en casa:</div>
      {showDiscrepancias.map(d=>{const f=fuentes[d.articulo_id]||"casa";return<div key={d.articulo_id} style={{background:"#FEF3CD",borderRadius:10,padding:"12px 14px",marginBottom:10}}>
        <div style={{fontWeight:600,fontSize:14,color:"#1A1A1A",marginBottom:6}}>{d.nombre}</div>
        <div style={{display:"flex",gap:16,fontSize:13,color:"#856404",marginBottom:8,flexWrap:"wrap"}}>
          <span>Envías: <strong>{d.cantidad}</strong></span>
          <span>En casa: <strong>{d.stock_casa}</strong></span>
          <span>Diferencia: <strong style={{color:"#D4A017"}}>+{d.diferencia}</strong></span>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button className={f==="casa"?"btn bp sm":"btn bg sm"} onClick={()=>setFuentes(p=>({...p,[d.articulo_id]:"casa"}))}>🏠 Casa</button>
          <button className={f==="almacen"?"btn bp sm":"btn bg sm"} onClick={()=>setFuentes(p=>({...p,[d.articulo_id]:"almacen"}))} disabled={d.stock_almacen<d.diferencia}>📦 Almacén{d.stock_almacen>0?` (${d.stock_almacen})`:""}</button>
        </div>
      </div>})}
      <div style={{fontSize:12,color:"#8A8580",background:"#F5F3F0",borderRadius:8,padding:"10px 12px",marginTop:6}}>💡 Pulsa "Almacén" si el artículo viene del almacén, no de la casa. O revisa el conteo y vuelve a intentarlo.</div>
      <div className="mft">
        <button className="btn bg" onClick={()=>setShowDiscrepancias(null)}>← Revisar conteo</button>
        <button className="btn bp" onClick={()=>ejecutarEnvio(items.filter(i=>i.cantidad>0),fuentes)} disabled={saving}>{saving?"Enviando…":"Enviar igualmente →"}</button>
      </div>
    </div></div>}
  </>;
}

// ─── ALMACÉN ────────────────────────────────────────────────────────────────
function verificarStock(art,ubi,cant){const s=ubi==="casa"?parseFloat(art.stock_casa||0):ubi==="almacen"?parseFloat(art.stock_almacen||0):parseFloat(art.stock_lavanderia||0);if(s<cant)return{ok:false,msg:`Stock insuficiente: hay ${s} ${art.unidad||"uds"} en ${ubi}, necesitas ${cant}`};return{ok:true};}

const ALMACEN_CATS=[
  {id:"todos",lbl:"Todos"},
  {id:"limpieza",lbl:"🧴 Limpieza"},
  {id:"reposicion",lbl:"🛁 Reposición"},
  {id:"ropa_cama",lbl:"🛏️ Ropa cama"},
  {id:"toallas",lbl:"🚿 Toallas"},
  {id:"textiles",lbl:"🛋️ Textiles"},
];

function AlmacenPage({perfil,tok,rol}){
  const isA=rol==="admin";
  const [articulos,setArticulos]=useState([]);const [movimientos,setMovimientos]=useState([]);
  const [load,setLoad]=useState(true);const [saving,setSaving]=useState(false);
  const [catFiltro,setCatFiltro]=useState("todos");
  const [showNew,setShowNew]=useState(false);const [showMov,setShowMov]=useState(null);const [showHist,setShowHist]=useState(false);
  const [showRecuento,setShowRecuento]=useState(false);const [recuentoItems,setRecuentoItems]=useState([]);const [recSaving,setRecSaving]=useState(false);
  const [busqueda,setBusqueda]=useState("");const [showEdit,setShowEdit]=useState(null);const [editForm,setEditForm]=useState({});
  const newVacio={nombre:"",categoria:"limpieza",unidad:"unidad",es_liquido:false,tiene_lavanderia:false,stock_minimo:"1",codigo_barras:"",stock_casa:"0",stock_almacen:"0",etiquetas:""};
  const [newForm,setNewForm]=useState(newVacio);
  const [movForm,setMovForm]=useState({tipo:"entrada",cantidad:"1",ubicacion:"casa",concepto:""});
  const [stockErr,setStockErr]=useState("");

  const load_=async()=>{
    try{
      const[a,m]=await Promise.all([
        sbGet("almacen_articulos","?activo=eq.true&select=*&order=nombre.asc",tok),
        sbGet("almacen_movimientos","?select=*&order=created_at.desc&limit=20",tok).catch(()=>[]),
      ]);
      setArticulos(a);setMovimientos(m);
    }catch(_){}setLoad(false);
  };
  useEffect(()=>{load_();},[]);

  const crearArticulo=async()=>{
    if(!newForm.nombre||saving)return;setSaving(true);
    try{
      const[art]=await sbPost("almacen_articulos",{nombre:newForm.nombre,categoria:newForm.categoria,unidad:newForm.unidad,es_liquido:newForm.es_liquido,tiene_lavanderia:newForm.tiene_lavanderia,stock_minimo:parseInt(newForm.stock_minimo)||1,codigo_barras:newForm.codigo_barras||null,stock_casa:parseFloat(newForm.stock_casa)||0,stock_almacen:parseFloat(newForm.stock_almacen)||0,stock_lavanderia:0,activo:true,etiquetas:newForm.etiquetas||""},tok);
      if((parseFloat(newForm.stock_casa)||0)>0)await sbPost("almacen_movimientos",{articulo_id:art.id,tipo:"entrada",cantidad:parseFloat(newForm.stock_casa),ubicacion_destino:"casa",concepto:"Stock inicial",creado_por:perfil.nombre},tok).catch(()=>{});
      if((parseFloat(newForm.stock_almacen)||0)>0)await sbPost("almacen_movimientos",{articulo_id:art.id,tipo:"entrada",cantidad:parseFloat(newForm.stock_almacen),ubicacion_destino:"almacen",concepto:"Stock inicial",creado_por:perfil.nombre},tok).catch(()=>{});
      setShowNew(false);setNewForm(newVacio);await load_();
    }catch(_){}setSaving(false);
  };

  const ejecutarMov=async()=>{
    if(!showMov||saving)return;setStockErr("");
    const art=showMov;const cant=parseFloat(movForm.cantidad)||0;
    if(cant<=0)return;
    // Verify stock before movement
    if(movForm.tipo==="salida"){const v=verificarStock(art,"casa",cant);if(!v.ok){setStockErr(v.msg);return;}}
    if(movForm.tipo==="traslado_a_casa"){const v=verificarStock(art,"almacen",cant);if(!v.ok){setStockErr(v.msg);return;}}
    if(movForm.tipo==="traslado_a_almacen"){const v=verificarStock(art,"casa",cant);if(!v.ok){setStockErr(v.msg);return;}}
    setSaving(true);
    try{
      if(movForm.tipo==="entrada"){
        const field=movForm.ubicacion==="casa"?"stock_casa":"stock_almacen";
        await sbPatch("almacen_articulos",`id=eq.${art.id}`,{[field]:(parseFloat(art[field])||0)+cant},tok);
        await sbPost("almacen_movimientos",{articulo_id:art.id,tipo:"entrada",cantidad:cant,ubicacion_destino:movForm.ubicacion,concepto:movForm.concepto||"Entrada de stock",creado_por:perfil.nombre},tok).catch(()=>{});
      }else if(movForm.tipo==="salida"){
        await sbPatch("almacen_articulos",`id=eq.${art.id}`,{stock_casa:Math.max(0,(parseFloat(art.stock_casa)||0)-cant)},tok);
        await sbPost("almacen_movimientos",{articulo_id:art.id,tipo:"salida",cantidad:cant,ubicacion_origen:"casa",concepto:movForm.concepto||"Uso/salida",creado_por:perfil.nombre},tok).catch(()=>{});
      }else if(movForm.tipo==="traslado_a_casa"){
        await sbPatch("almacen_articulos",`id=eq.${art.id}`,{stock_almacen:Math.max(0,(parseFloat(art.stock_almacen)||0)-cant),stock_casa:(parseFloat(art.stock_casa)||0)+cant},tok);
        await sbPost("almacen_movimientos",{articulo_id:art.id,tipo:"traslado",cantidad:cant,ubicacion_origen:"almacen",ubicacion_destino:"casa",concepto:movForm.concepto||"Almacén → Casa",creado_por:perfil.nombre},tok).catch(()=>{});
      }else if(movForm.tipo==="traslado_a_almacen"){
        await sbPatch("almacen_articulos",`id=eq.${art.id}`,{stock_casa:Math.max(0,(parseFloat(art.stock_casa)||0)-cant),stock_almacen:(parseFloat(art.stock_almacen)||0)+cant},tok);
        await sbPost("almacen_movimientos",{articulo_id:art.id,tipo:"traslado",cantidad:cant,ubicacion_origen:"casa",ubicacion_destino:"almacen",concepto:movForm.concepto||"Casa → Almacén",creado_por:perfil.nombre},tok).catch(()=>{});
      }
      setShowMov(null);await load_();
    }catch(_){}setSaving(false);
  };

  const eliminarArticulo=async(a)=>{
    if(!window.confirm(`¿Eliminar "${a.nombre}"? Esta acción no se puede deshacer.`))return;
    try{
      const movs=await sbGet("almacen_movimientos",`?articulo_id=eq.${a.id}&select=id&limit=1`,tok).catch(()=>[]);
      if(movs.length>0)await sbPatch("almacen_articulos",`id=eq.${a.id}`,{activo:false},tok);
      else await sbDelete("almacen_articulos",`id=eq.${a.id}`,tok);
      await load_();
    }catch(_){}
  };
  const guardarEdit=async()=>{
    if(!showEdit||saving)return;setSaving(true);
    try{await sbPatch("almacen_articulos",`id=eq.${showEdit.id}`,{nombre:editForm.nombre,categoria:editForm.categoria,unidad:editForm.unidad,es_liquido:editForm.es_liquido,stock_minimo:parseInt(editForm.stock_minimo)||1,tiene_lavanderia:editForm.tiene_lavanderia,etiquetas:editForm.etiquetas||""},tok);setShowEdit(null);await load_();}catch(_){}setSaving(false);
  };
  const abrirEdit=(a)=>{setEditForm({nombre:a.nombre,categoria:a.categoria,unidad:a.unidad||"unidad",es_liquido:!!a.es_liquido,stock_minimo:String(a.stock_minimo||1),tiene_lavanderia:!!a.tiene_lavanderia,etiquetas:a.etiquetas||""});setShowEdit(a);};
  const abrirRecuento=()=>{setRecuentoItems(articulos.map(a=>({...a,real:""})));setShowRecuento(true);};
  const aplicarRecuento=async()=>{
    if(recSaving)return;setRecSaving(true);
    const hoy=new Date().toISOString().split("T")[0];let n=0;
    try{
      for(const it of recuentoItems){
        if(it.real===""||it.real===null)continue;
        const real=parseFloat(it.real)||0;
        const sistema=(parseFloat(it.stock_casa)||0)+(parseFloat(it.stock_almacen)||0);
        const diff=real-sistema;
        if(diff===0)continue;
        const newAlm=Math.max(0,(parseFloat(it.stock_almacen)||0)+diff);
        await sbPatch("almacen_articulos",`id=eq.${it.id}`,{stock_almacen:newAlm},tok).catch(()=>{});
        await sbPost("almacen_movimientos",{articulo_id:it.id,tipo:"ajuste_inventario",cantidad:diff,concepto:`Recuento manual - ${hoy}`,creado_por:perfil.nombre},tok).catch(()=>{});
        n++;
      }
    }catch(_){}
    setRecSaving(false);setShowRecuento(false);await load_();
    if(n>0&&typeof setToast==="function"){}// toast handled below
  };

  const bajos=articulos.filter(a=>(parseFloat(a.stock_casa)||0)+(parseFloat(a.stock_almacen)||0)<=(parseFloat(a.stock_minimo)||0));
  const filtered=(catFiltro==="todos"?articulos:articulos.filter(a=>a.categoria===catFiltro)).filter(a=>!busqueda||a.nombre.toLowerCase().includes(busqueda.toLowerCase())||(a.etiquetas||"").toLowerCase().includes(busqueda.toLowerCase()));

  if(load)return <div className="loading"><div className="spin"/><span>Cargando…</span></div>;
  return <>
    <div style={{padding:"28px 32px 16px"}}><div style={{fontSize:12,color:T.ink3,fontWeight:500}}>{articulos.length} artículos · {bajos.length} con stock bajo</div><div style={{fontSize:28,fontWeight:700,color:T.ink,letterSpacing:-.8,lineHeight:1.02,marginTop:2}}>Almacén</div></div>
    <div className="pb">
      {bajos.length>0&&<div style={{background:"#FEE8E8",borderRadius:14,padding:"12px 16px",marginBottom:16,fontSize:13,color:"#F35757",fontWeight:600}}>⚠️ {bajos.length} artículo{bajos.length>1?"s":""} con stock bajo: {bajos.slice(0,5).map(a=>a.nombre).join(", ")}</div>}

      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        {isA&&<button className="btn bp" onClick={()=>{setNewForm(newVacio);setShowNew(true);}}>➕ Nuevo artículo</button>}
        <button className="btn bg" onClick={abrirRecuento}>📦 Recuento</button>
      </div>
      <input className="fi" value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Buscar por nombre o etiqueta..." style={{marginBottom:14}}/>

      <div style={{display:"flex",gap:4,overflowX:"auto",marginBottom:16,scrollbarWidth:"none"}}>
        {ALMACEN_CATS.map(c=><button key={c.id} className={`btn sm${catFiltro===c.id?" bp":" bg"}`} onClick={()=>setCatFiltro(c.id)} style={{flexShrink:0}}>{c.lbl}</button>)}
      </div>

      {filtered.length===0?<div className="empty"><span className="ico">📦</span><p>Sin artículos en esta categoría</p></div>
      :filtered.map(a=>{
        const sC=parseFloat(a.stock_casa)||0;const sA=parseFloat(a.stock_almacen)||0;const sL=parseFloat(a.stock_lavanderia)||0;const sMin=parseFloat(a.stock_minimo)||0;
        const total=sC+sA;const estado=total<=sMin?"🔴":total<=sMin*2?"🟡":"🟢";
        return <div key={a.id} className="card" style={{marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:8}}>
            <div style={{fontSize:14,fontWeight:600,color:"#1A1A1A"}}>{a.nombre}</div>
            <span style={{fontSize:12,fontWeight:700,color:estado==="🔴"?"#F35757":estado==="🟡"?"#D4A017":"#A6BE59"}}>{estado} {estado==="🔴"?"BAJO":estado==="🟡"?"JUSTO":"OK"}</span>
          </div>
          <div style={{display:"flex",gap:12,fontSize:12,color:"#8A8580",marginBottom:10}}>
            <span>🏠 Casa: <strong style={{color:"#1A1A1A"}}>{sC} {a.unidad||""}</strong></span>
            <span>📦 Almacén: <strong style={{color:"#1A1A1A"}}>{sA}</strong></span>
            {a.tiene_lavanderia&&<span>🧺 Lavand: <strong style={{color:"#1A1A1A"}}>{sL}</strong></span>}
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            <button className="btn bg sm" onClick={()=>{setMovForm({tipo:"entrada",cantidad:"1",ubicacion:"casa",concepto:""});setShowMov(a);}}>+ Entrada</button>
            <button className="btn bg sm" onClick={()=>{setMovForm({tipo:"salida",cantidad:"1",ubicacion:"casa",concepto:""});setShowMov(a);}}>− Uso</button>
            {sA>0&&<button className="btn bg sm" onClick={()=>{setMovForm({tipo:"traslado_a_casa",cantidad:"1",ubicacion:"",concepto:""});setShowMov(a);}}>📦→🏠</button>}
            {sC>0&&<button className="btn bg sm" onClick={()=>{setMovForm({tipo:"traslado_a_almacen",cantidad:"1",ubicacion:"",concepto:""});setShowMov(a);}}>🏠→📦</button>}
            {isA&&<button className="btn bg sm" onClick={()=>abrirEdit(a)}>✏️</button>}
            {isA&&<button className="btn br sm" onClick={()=>eliminarArticulo(a)}>🗑</button>}
          </div>
        </div>;
      })}

      {/* Historial */}
      <div style={{marginTop:20}}>
        <button onClick={()=>setShowHist(!showHist)} style={{background:"none",border:"none",cursor:"pointer",color:"#8A8580",fontSize:13,fontFamily:"'Inter Tight',sans-serif",fontWeight:600,display:"flex",alignItems:"center",gap:6,padding:0}}>
          <span>📋 Historial de movimientos</span><span style={{transition:"transform .2s",transform:showHist?"rotate(90deg)":"none",fontSize:16}}>›</span>
        </button>
        {showHist&&<div style={{marginTop:10}}>
          {movimientos.length===0?<div style={{color:"#BFBAB4",fontSize:13}}>Sin movimientos</div>
          :movimientos.map(m=>{const artN=articulos.find(a=>a.id===m.articulo_id)?.nombre||"—";return <div key={m.id} style={{display:"flex",gap:8,padding:"6px 0",borderBottom:"1px solid rgba(0,0,0,.04)",fontSize:12}}>
            <span style={{color:"#8A8580"}}>{fmtDT(m.created_at)}</span>
            <span style={{fontWeight:600}}>{artN}</span>
            <span className="badge" style={{background:m.tipo==="entrada"?"rgba(166,190,89,.1)":m.tipo==="salida"?"rgba(243,87,87,.1)":"rgba(127,178,255,.1)",color:m.tipo==="entrada"?"#A6BE59":m.tipo==="salida"?"#F35757":"#7FB2FF",fontSize:10}}>{m.tipo}</span>
            <span>{m.cantidad} {m.ubicacion_origen?`${m.ubicacion_origen}→${m.ubicacion_destino}`:m.ubicacion_destino||""}</span>
          </div>;})}
        </div>}
      </div>
    </div>

    {/* Modal nuevo artículo */}
    {showNew&&<div className="ov" onClick={()=>setShowNew(false)}><div className="modal" style={{maxHeight:"90vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
      <h3>➕ Nuevo artículo</h3>
      <div className="fg"><label>Nombre *</label><input className="fi" value={newForm.nombre} onChange={e=>setNewForm(v=>({...v,nombre:e.target.value}))} placeholder="Ej: Lejía"/></div>
      <div className="g2">
        <div className="fg"><label>Categoría</label><select className="fi" value={newForm.categoria} onChange={e=>setNewForm(v=>({...v,categoria:e.target.value}))}>{ALMACEN_CATS.filter(c=>c.id!=="todos").map(c=><option key={c.id} value={c.id}>{c.lbl}</option>)}</select></div>
        <div className="fg"><label>Unidad</label><input className="fi" value={newForm.unidad} onChange={e=>setNewForm(v=>({...v,unidad:e.target.value}))} placeholder="bote, paquete, unidad"/></div>
      </div>
      <div style={{display:"flex",gap:16,marginBottom:14}}>
        <div onClick={()=>setNewForm(v=>({...v,es_liquido:!v.es_liquido}))} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13}}>
          <div style={{width:22,height:22,borderRadius:6,border:`2px solid ${newForm.es_liquido?"#EC683E":"#BFBAB4"}`,background:newForm.es_liquido?"#EC683E":"transparent",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:12,fontWeight:700}}>{newForm.es_liquido?"✓":""}</div>
          Es líquido
        </div>
        <div onClick={()=>setNewForm(v=>({...v,tiene_lavanderia:!v.tiene_lavanderia}))} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13}}>
          <div style={{width:22,height:22,borderRadius:6,border:`2px solid ${newForm.tiene_lavanderia?"#EC683E":"#BFBAB4"}`,background:newForm.tiene_lavanderia?"#EC683E":"transparent",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:12,fontWeight:700}}>{newForm.tiene_lavanderia?"✓":""}</div>
          Va a lavandería
        </div>
      </div>
      <div className="g2">
        <div className="fg"><label>Stock mínimo</label><input type="number" className="fi" value={newForm.stock_minimo} onChange={e=>setNewForm(v=>({...v,stock_minimo:e.target.value}))}/></div>
        <div className="fg"><label>Código barras</label><input className="fi" value={newForm.codigo_barras} onChange={e=>setNewForm(v=>({...v,codigo_barras:e.target.value}))} placeholder="Opcional"/></div>
      </div>
      <div className="g2">
        <div className="fg"><label>Stock inicial casa</label><input type="number" className="fi" value={newForm.stock_casa} onChange={e=>setNewForm(v=>({...v,stock_casa:e.target.value}))}/></div>
        <div className="fg"><label>Stock inicial almacén</label><input type="number" className="fi" value={newForm.stock_almacen} onChange={e=>setNewForm(v=>({...v,stock_almacen:e.target.value}))}/></div>
      </div>
      <div className="fg"><label>Etiquetas (para búsqueda)</label><input className="fi" value={newForm.etiquetas||""} onChange={e=>setNewForm(v=>({...v,etiquetas:e.target.value}))} placeholder="#kh7 #desengrasante"/><div style={{fontSize:11,color:"#8A8580",marginTop:3}}>💡 No visibles, solo para buscar</div></div>
      <div className="mft"><button className="btn bg" onClick={()=>setShowNew(false)}>Cancelar</button><button className="btn bp" onClick={crearArticulo} disabled={saving||!newForm.nombre}>{saving?"Creando…":"➕ Crear"}</button></div>
    </div></div>}

    {/* Modal editar artículo */}
    {showEdit&&<div className="ov" onClick={()=>setShowEdit(null)}><div className="modal" style={{maxHeight:"90vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
      <h3>✏️ Editar artículo</h3>
      <div className="fg"><label>Nombre</label><input className="fi" value={editForm.nombre} onChange={e=>setEditForm(v=>({...v,nombre:e.target.value}))}/></div>
      <div className="g2">
        <div className="fg"><label>Categoría</label><select className="fi" value={editForm.categoria} onChange={e=>setEditForm(v=>({...v,categoria:e.target.value}))}>{ALMACEN_CATS.filter(c=>c.id!=="todos").map(c=><option key={c.id} value={c.id}>{c.lbl}</option>)}</select></div>
        <div className="fg"><label>Unidad</label><input className="fi" value={editForm.unidad} onChange={e=>setEditForm(v=>({...v,unidad:e.target.value}))}/></div>
      </div>
      <div className="fg"><label>Stock mínimo</label><input type="number" className="fi" value={editForm.stock_minimo} onChange={e=>setEditForm(v=>({...v,stock_minimo:e.target.value}))}/></div>
      <div style={{display:"flex",gap:16,marginBottom:14}}>
        <div onClick={()=>setEditForm(v=>({...v,es_liquido:!v.es_liquido}))} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13}}>
          <div style={{width:22,height:22,borderRadius:6,border:`2px solid ${editForm.es_liquido?"#EC683E":"#BFBAB4"}`,background:editForm.es_liquido?"#EC683E":"transparent",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:12,fontWeight:700}}>{editForm.es_liquido?"✓":""}</div>
          Es líquido
        </div>
        <div onClick={()=>setEditForm(v=>({...v,tiene_lavanderia:!v.tiene_lavanderia}))} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13}}>
          <div style={{width:22,height:22,borderRadius:6,border:`2px solid ${editForm.tiene_lavanderia?"#EC683E":"#BFBAB4"}`,background:editForm.tiene_lavanderia?"#EC683E":"transparent",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:12,fontWeight:700}}>{editForm.tiene_lavanderia?"✓":""}</div>
          Va a lavandería
        </div>
      </div>
      <div className="fg"><label>Etiquetas</label><input className="fi" value={editForm.etiquetas||""} onChange={e=>setEditForm(v=>({...v,etiquetas:e.target.value}))} placeholder="#kh7 #desengrasante"/></div>
      <div className="mft"><button className="btn bg" onClick={()=>setShowEdit(null)}>Cancelar</button><button className="btn bp" onClick={guardarEdit} disabled={saving}>{saving?"Guardando…":"✅ Guardar"}</button></div>
    </div></div>}

    {/* Modal movimiento */}
    {showMov&&<div className="ov" onClick={()=>setShowMov(null)}><div className="modal" style={{maxWidth:400}} onClick={e=>e.stopPropagation()}>
      <h3>{movForm.tipo==="entrada"?"+ Entrada de stock":movForm.tipo==="salida"?"− Registrar uso":movForm.tipo==="traslado_a_casa"?"📦 → 🏠 Traslado":"🏠 → 📦 Traslado"}</h3>
      <div style={{background:"#F5F3F0",borderRadius:12,padding:"12px 14px",marginBottom:14}}>
        <div style={{fontSize:14,fontWeight:600}}>{showMov.nombre}</div>
        <div style={{fontSize:12,color:"#8A8580",marginTop:3}}>Casa: {parseFloat(showMov.stock_casa)||0} · Almacén: {parseFloat(showMov.stock_almacen)||0}</div>
      </div>
      {movForm.tipo==="entrada"&&<div className="fg"><label>Ubicación destino</label><select className="fi" value={movForm.ubicacion} onChange={e=>setMovForm(v=>({...v,ubicacion:e.target.value}))}><option value="casa">🏠 Casa</option><option value="almacen">📦 Almacén</option></select></div>}
      <div className="fg"><label>Cantidad</label>
        <input type="number" inputMode="decimal" min="0" step={showMov.es_liquido?"0.25":"1"} className="fi" value={movForm.cantidad} onChange={e=>setMovForm(v=>({...v,cantidad:e.target.value}))} style={{width:120,textAlign:"center",fontSize:20,fontWeight:700}}/>
        {showMov.es_liquido&&<div style={{fontSize:11,color:"#8A8580",marginTop:4}}>💡 Usa 0.25, 0.5, 0.75 para cantidades parciales de bote</div>}
      </div>
      <div className="fg"><label>Concepto (opcional)</label><input className="fi" value={movForm.concepto} onChange={e=>setMovForm(v=>({...v,concepto:e.target.value}))} placeholder="Ej: Compra semanal"/></div>
      {stockErr&&<div className="alert" style={{marginBottom:12}}>{stockErr}</div>}
      <div className="mft"><button className="btn bg" onClick={()=>{setShowMov(null);setStockErr("");}}>Cancelar</button><button className="btn bp" onClick={ejecutarMov} disabled={saving}>{saving?"Guardando…":"✅ Confirmar"}</button></div>
    </div></div>}

    {/* Modal Recuento */}
    {showRecuento&&<div className="ov" onClick={()=>setShowRecuento(false)}>
      <div className="modal" style={{maxWidth:540,maxHeight:"92vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <h3>📦 Recuento de stock</h3>
        <div style={{fontSize:12,color:"#8A8580",marginBottom:16}}>Actualiza solo los artículos que hayas contado. Deja en blanco los que no has revisado.</div>
        {ALMACEN_CATS.filter(c=>c.id!=="todos").map(cat=>{
          const catItems=recuentoItems.filter(a=>a.categoria===cat.id);
          if(catItems.length===0)return null;
          return <div key={cat.id} style={{marginBottom:16}}>
            <div style={{fontSize:12,fontWeight:700,color:"#EC683E",textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>{cat.lbl}</div>
            {catItems.map((it,idx)=>{
              const globalIdx=recuentoItems.findIndex(r=>r.id===it.id);
              const sistema=(parseFloat(it.stock_casa)||0)+(parseFloat(it.stock_almacen)||0);
              return <div key={it.id} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 0",borderBottom:"1px solid rgba(0,0,0,.04)"}}>
                <div style={{flex:1,fontSize:13,color:"#1A1A1A"}}>{it.nombre}</div>
                <div style={{fontSize:11,color:"#8A8580",minWidth:60,textAlign:"right"}}>Sist: {sistema}</div>
                <input type="number" min="0" step={it.es_liquido?"0.25":"1"} value={recuentoItems[globalIdx]?.real??""} onChange={e=>setRecuentoItems(prev=>prev.map((p,i)=>i===globalIdx?{...p,real:e.target.value}:p))} placeholder="—" style={{width:70,textAlign:"center",fontSize:16,fontWeight:700,padding:"6px",borderRadius:10,border:"1.5px solid transparent",background:"#F5F3F0",fontFamily:"'Inter Tight',sans-serif",outline:"none"}}/>
              </div>;
            })}
          </div>;
        })}
        <div className="mft">
          <button className="btn bg" onClick={()=>setShowRecuento(false)}>Cancelar</button>
          <button className="btn bp" onClick={aplicarRecuento} disabled={recSaving}>{recSaving?"Aplicando…":"📦 Aplicar recuento"}</button>
        </div>
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

  const fmtE=v=>(Math.round(parseFloat(v)||0)).toLocaleString("es-ES")+"€";
  const catColors={Personal:T.lavender,personal:T.lavender,"Comisión gestor":T.terracotta,comision:T.terracotta,Suministros:T.softBlue,suministros:T.softBlue,Consumibles:T.olive,consumibles:T.olive,Mantenimiento:T.gold,mantenimiento:T.gold,Marketing:"#F2995E",marketing:"#F2995E",Otros:T.ink3,otros:T.ink3};
  const catAgrup=[...new Set(gastos.map(g=>g.categoria).filter(Boolean))].map(k=>({key:k,label:k,total:gastos.filter(g=>g.categoria===k).reduce((s,g)=>s+(parseFloat(g.importe)||0),0)})).filter(c=>c.total>0).sort((a,b)=>b.total-a.total);

  return <>
    {/* Header */}
    <div style={{padding:"54px 20px 16px",display:"flex",alignItems:"flex-end",justifyContent:"space-between"}}>
      <div><div style={{fontSize:12,color:T.ink3,fontWeight:500}}>Control financiero</div><div style={{fontSize:30,fontWeight:700,color:T.ink,letterSpacing:-1,lineHeight:1.02}}>Gastos</div></div>
      <button onClick={()=>{setForm(formVacio);setShowForm(true);}} style={{width:38,height:38,borderRadius:999,background:T.ink,border:0,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><FmIcon name="plus" size={18} stroke="white"/></button>
    </div>

    {/* KPI total */}
    <div style={{padding:"0 20px 14px"}}>
      <div style={{background:"linear-gradient(135deg,#1A1A1A 0%,#2a2520 100%)",borderRadius:20,padding:18,color:"white"}}>
        <div style={{fontSize:10,color:T.gold,letterSpacing:1,textTransform:"uppercase",fontWeight:700,marginBottom:4}}>Total período</div>
        <div style={{fontSize:38,fontWeight:700,letterSpacing:-1.2,lineHeight:1}}>{fmtE(total)}</div>
        <div style={{fontSize:12,color:"rgba(255,255,255,.55)",marginTop:6}}>{filtrados.length} gastos · {gastos.filter(g=>GASTO_AUTO.includes(g.origen)).length} automáticos</div>
      </div>
    </div>

    {/* Filtro período */}
    <div style={{padding:"0 20px 14px"}}><div style={{display:"flex",background:T.surface,borderRadius:999,padding:4,border:`1px solid ${T.line}`,gap:2}}>
      {periodos.map(p=><button key={p.lbl} onClick={()=>{setDesde(p.d);setHasta(p.h);}} style={{flex:1,padding:"9px 6px",borderRadius:999,border:0,background:desde===p.d&&hasta===p.h?T.ink:"transparent",color:desde===p.d&&hasta===p.h?"#fff":T.ink2,fontFamily:T.sans,fontSize:12,fontWeight:700,cursor:"pointer"}}>{p.lbl}</button>)}
    </div></div>

    {/* Desglose categoría */}
    {catAgrup.length>0&&<div style={{padding:"0 20px 14px"}}>
      <div style={{fontSize:11,color:T.ink3,letterSpacing:1,textTransform:"uppercase",fontWeight:700,marginBottom:10}}>Por categoría</div>
      <div style={{background:T.surface,borderRadius:16,border:`1px solid ${T.line}`,overflow:"hidden"}}>
        {catAgrup.map((cat,i)=>{const color=catColors[cat.key]||T.ink3;const pct=total>0?Math.round(cat.total/total*100):0;
          return<div key={cat.key} onClick={()=>setCatFiltro(catFiltro===cat.key?"todas":cat.key)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderBottom:i<catAgrup.length-1?`1px solid ${T.line}`:"none",cursor:"pointer",background:catFiltro===cat.key?color+"0a":"transparent"}}>
            <div style={{width:10,height:10,borderRadius:3,background:color,flexShrink:0}}/>
            <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:T.ink,textTransform:"capitalize"}}>{cat.label}</div><div style={{height:4,background:T.bg,borderRadius:999,overflow:"hidden",marginTop:5}}><div style={{width:pct+"%",height:"100%",background:color}}/></div></div>
            <div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:13,fontWeight:700,color:T.ink}}>{fmtE(cat.total)}</div><div style={{fontSize:10,color:T.ink3,marginTop:2}}>{pct}%</div></div>
          </div>;})}
      </div>
    </div>}

    {/* Filtros pills */}
    <div style={{padding:"0 20px 10px",display:"flex",gap:6,overflowX:"auto"}}>
      {["todas",...cats].map(f=>{const on=catFiltro===f;return<button key={f} onClick={()=>setCatFiltro(f)} style={{flexShrink:0,height:28,padding:"0 12px",borderRadius:999,border:`1px solid ${on?T.ink:T.line}`,background:on?T.ink:T.surface,color:on?"white":T.ink2,fontFamily:T.sans,fontSize:11,fontWeight:700,cursor:"pointer",textTransform:"capitalize"}}>{f==="todas"?"Todas":f}</button>;})}
    </div>

    {/* Lista */}
    <div style={{padding:"0 20px"}}>
      {load?<div className="loading"><div className="spin"/><span>Cargando…</span></div>
      :filtrados.length===0?<div style={{textAlign:"center",padding:"40px 0",color:T.ink3,fontSize:13}}>Sin gastos en este período</div>
      :filtrados.map(g=>{const esAuto=GASTO_AUTO.includes(g.origen);const olbl=origenLbl(g.origen);const color=catColors[g.categoria]||T.ink3;
        return<div key={g.id} style={{background:T.surface,borderRadius:16,padding:14,border:`1px solid ${T.line}`,marginBottom:8,display:"flex",gap:12,alignItems:"center"}}>
          <div style={{width:4,borderRadius:999,background:color,alignSelf:"stretch",flexShrink:0}}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3,flexWrap:"wrap"}}>
              <span style={{display:"inline-flex",height:18,padding:"0 7px",borderRadius:999,background:color+"22",color:color,fontSize:9.5,fontWeight:700,textTransform:"capitalize"}}>{g.categoria||"—"}</span>
              {olbl&&<span style={{display:"inline-flex",height:18,padding:"0 7px",borderRadius:999,background:T.ink3+"22",color:T.ink3,fontSize:9.5,fontWeight:700}}>{olbl}</span>}
              {g.recurrente&&<span style={{display:"inline-flex",height:18,padding:"0 7px",borderRadius:999,background:T.softBlue+"22",color:"#2A5BA0",fontSize:9.5,fontWeight:700}}>Recurrente</span>}
            </div>
            <div style={{fontSize:14,fontWeight:700,color:T.ink,letterSpacing:-.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{g.concepto}</div>
            <div style={{fontSize:11,color:T.ink3,marginTop:3,display:"flex",alignItems:"center",gap:4}}><FmIcon name="calendar" size={10} stroke={T.ink3}/>{new Date(g.fecha+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"})}</div>
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            <div style={{fontSize:16,fontWeight:700,color:T.ink,letterSpacing:-.3}}>{fmtE(g.importe)}</div>
            {!esAuto&&<button onClick={()=>eliminar(g)} style={{marginTop:4,width:28,height:28,borderRadius:999,background:"#FEF2F2",border:"1px solid #FECACA",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><FmIcon name="x" size={12} stroke="#D9443A"/></button>}
          </div>
        </div>;})}
    </div>

    {/* MODAL NUEVO GASTO */}
    {showForm&&<div className="ov" onClick={()=>setShowForm(false)}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <h3 style={{fontSize:22,fontWeight:700,color:T.ink,letterSpacing:-.6}}>Nuevo gasto</h3>
        <div className="g2">
          <div className="fg"><label>Fecha *</label><input type="date" className="fi" value={form.fecha} onChange={e=>setForm(v=>({...v,fecha:e.target.value}))}/></div>
          <div className="fg"><label>Categoría</label><select className="fi" value={form.categoria} onChange={e=>setForm(v=>({...v,categoria:e.target.value}))}>{GASTO_CATS.map(c=><option key={c}>{c}</option>)}</select></div>
        </div>
        <div className="fg"><label>Concepto *</label><input className="fi" value={form.concepto} onChange={e=>setForm(v=>({...v,concepto:e.target.value}))} placeholder="Ej: Compra de cloro para piscina"/></div>
        <div className="fg"><label>Importe (€) *</label><input type="number" inputMode="decimal" className="fi" value={form.importe} onChange={e=>setForm(v=>({...v,importe:e.target.value}))} placeholder="0"/></div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
          <div onClick={()=>setForm(v=>({...v,recurrente:!v.recurrente}))} style={{width:22,height:22,borderRadius:6,flexShrink:0,border:`2px solid ${form.recurrente?T.olive:T.line}`,background:form.recurrente?T.olive:"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>{form.recurrente&&<FmIcon name="check" size={12} stroke="white" sw={2.5}/>}</div>
          <span style={{fontSize:13,color:T.ink}}>¿Es recurrente?</span>
          {form.recurrente&&<select className="fi" value={form.frecuencia} onChange={e=>setForm(v=>({...v,frecuencia:e.target.value}))} style={{width:"auto",flex:"none",padding:"6px 30px 6px 10px"}}><option value="mensual">Mensual</option><option value="anual">Anual</option></select>}
        </div>
        <div className="fg"><label>Notas (opcional)</label><textarea className="fi" rows={2} value={form.notas} onChange={e=>setForm(v=>({...v,notas:e.target.value}))} placeholder="Detalles…"/></div>
        <div className="mft">
          <button className="btn bg" onClick={()=>setShowForm(false)}>Cancelar</button>
          <button className="btn bp" onClick={crear} disabled={saving||!form.concepto||!form.importe}>{saving?"Guardando…":"Guardar gasto"}</button>
        </div>
      </div>
    </div>}
  </>;
}

// ─── ANÁLISIS ───────────────────────────────────────────────────────────────
function Analisis({tok,rol}){
  const hoy=new Date();const hoyStr=hoy.toISOString().split("T")[0];const año=hoy.getFullYear();const mesIdx=hoy.getMonth();
  const [tab,setTab]=useState("proyeccion");
  const [load,setLoad]=useState(true);
  const [reservas,setReservas]=useState([]);const [airbnbs,setAirbnbs]=useState([]);const [gastos,setGastos]=useState([]);const [visitas,setVisitas]=useState([]);const [f2025,setF2025]=useState(0);

  useEffect(()=>{(async()=>{
    try{
      const[r,a,g,v,cfg]=await Promise.all([
        sbGet("reservas",`?fecha=gte.${año}-01-01&fecha=lte.${año}-12-31&select=*`,tok),
        sbGet("reservas_airbnb",`?fecha_entrada=gte.${año}-01-01&fecha_entrada=lte.${año}-12-31&select=*`,tok),
        sbGet("gastos",`?fecha=gte.${año}-01-01&fecha=lte.${año}-12-31&select=*`,tok).catch(()=>[]),
        sbGet("visitas",`?select=*`,tok).catch(()=>[]),
        sbGet("configuracion","?select=*",tok).catch(()=>[]),
      ]);
      setReservas(r);setAirbnbs(a);setGastos(g);setVisitas(v);
      const c={};cfg.forEach(x=>c[x.clave]=x.valor);setF2025(parseFloat(c.facturacion_2025)||0);
    }catch(_){}setLoad(false);
  })();},[]);

  if(rol!=="admin")return null;

  const fmt=v=>`${Math.round(v).toLocaleString("es-ES")}€`;
  const cw=typeof window!=="undefined"?Math.min(window.innerWidth-64,560):400;
  const prc=v=>parseFloat(v)||0;
  const precioR=r=>prc(r.precio_total)||prc(r.precio);
  const ACTIVOS=["visita","pendiente_contrato","contrato_firmado","reserva_pagada","precio_total"];

  // Monthly helpers
  const mFact=i=>{const m=String(i+1).padStart(2,"0");return reservas.filter(r=>r.fecha?.slice(5,7)===m).reduce((s,r)=>s+precioR(r),0)+airbnbs.filter(a=>a.fecha_entrada?.slice(5,7)===m).reduce((s,a)=>s+prc(a.precio),0);};
  const mGast=i=>{const m=String(i+1).padStart(2,"0");return gastos.filter(g=>g.fecha?.slice(5,7)===m).reduce((s,g)=>s+prc(g.importe),0);};
  const mCob=i=>{const m=String(i+1).padStart(2,"0");let c=0;reservas.filter(r=>r.fecha?.slice(5,7)===m).forEach(r=>{const s=prc(r.seña_importe);if(r.seña_cobrada)c+=s;if(r.saldo_cobrado)c+=(precioR(r)-s);});c+=airbnbs.filter(a=>(a.cobrado||a.fecha_entrada<hoyStr)&&a.fecha_entrada?.slice(5,7)===m).reduce((s,a)=>s+prc(a.precio),0);return c;};

  if(load)return <div className="loading"><div className="spin"/><span>Cargando análisis…</span></div>;

  const factTotal=reservas.reduce((s,r)=>s+precioR(r),0)+airbnbs.reduce((s,a)=>s+prc(a.precio),0);
  const gastTotal=gastos.reduce((s,g)=>s+prc(g.importe),0);
  const mesesT=mesIdx+1;const mediaG=mesesT>0?gastTotal/mesesT:0;
  const gastProy=gastTotal+mediaG*(11-mesIdx);
  const benProy=factTotal-gastProy;
  const cobTotal=reservas.reduce((s,r)=>{let c=0;if(r.seña_cobrada)c+=prc(r.seña_importe);if(r.saldo_cobrado)c+=(precioR(r)-prc(r.seña_importe));return s+c;},0)+airbnbs.filter(a=>a.cobrado||a.fecha_entrada<hoyStr).reduce((s,a)=>s+prc(a.precio),0);
  const pendTotal=factTotal-cobTotal;

  const tabStyle=(id)=>({padding:"9px 16px",borderRadius:10,cursor:"pointer",fontSize:12,fontWeight:600,border:"none",background:tab===id?"#FFFFFF":"none",color:tab===id?"#1A1A1A":"#8A8580",boxShadow:tab===id?"0 2px 8px rgba(0,0,0,.06)":"none",fontFamily:"'Inter Tight',sans-serif",whiteSpace:"nowrap"});
  const kpiBox=(lbl,val,col)=><div style={{background:"#fff",borderRadius:14,padding:"14px 16px",boxShadow:"0 1px 6px rgba(0,0,0,.04)"}}><div style={{fontSize:10,color:"#8A8580",textTransform:"uppercase",fontWeight:700,letterSpacing:.5}}>{lbl}</div><div style={{fontSize:22,fontWeight:800,color:col||"#1A1A1A",marginTop:4}}>{val}</div></div>;
  const rowS={display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid rgba(0,0,0,.04)",gap:8,fontSize:13};

  return <>
    {/* Header */}
    <div style={{padding:"54px 20px 16px"}}><div style={{fontSize:12,color:T.ink3,fontWeight:500}}>Inteligencia financiera</div><div style={{fontSize:30,fontWeight:700,color:T.ink,letterSpacing:-1,lineHeight:1.02}}>Análisis</div></div>

    {/* KPIs rápidos */}
    <div style={{padding:"0 20px 18px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      {[{label:"Facturación",value:fmt(factTotal),color:T.olive},{label:"Cobrado",value:fmt(cobTotal),color:T.softBlue},{label:"Gastos",value:fmt(gastTotal),color:T.lavender},{label:"Beneficio",value:fmt(benProy),mood:benProy>0?"up":"down",color:T.terracotta}].map((k,i)=><div key={i} style={{background:T.surface,borderRadius:20,padding:14,border:`1px solid ${T.line}`}}><div style={{width:28,height:3,background:k.color,borderRadius:2,marginBottom:10}}/><div style={{fontSize:10,color:T.ink3,fontWeight:600,letterSpacing:.3,textTransform:"uppercase",marginBottom:4}}>{k.label}</div><div style={{fontSize:22,fontWeight:700,color:T.ink,letterSpacing:-.6,lineHeight:1}}>{k.value}</div></div>)}
    </div>

    <div className="pb" style={{paddingTop:0}}>
      <div style={{display:"flex",background:T.surface,borderRadius:999,padding:4,border:`1px solid ${T.line}`,gap:2,marginBottom:20,overflowX:"auto",scrollbarWidth:"none"}}>
        {[{id:"proyeccion",lbl:"Proyección"},{id:"cobros",lbl:"Cobros"},{id:"crecimiento",lbl:"Crecimiento"},{id:"gastos_tab",lbl:"Gastos"},{id:"eventos",lbl:"Eventos"},{id:"airbnb_tab",lbl:"Airbnb"}].map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{flex:"0 0 auto",padding:"9px 14px",borderRadius:999,border:0,background:tab===t.id?T.ink:"transparent",color:tab===t.id?"#fff":T.ink2,fontFamily:T.sans,fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>{t.lbl}</button>)}
      </div>

      {/* TAB PROYECCIÓN */}
      {tab==="proyeccion"&&<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10,marginBottom:20}}>
          {kpiBox("Facturación proy.",fmt(factTotal),"#EC683E")}
          {kpiBox("Gastos proy.",fmt(gastProy),"#F35757")}
          {kpiBox("Beneficio proy.",fmt(benProy),benProy>=0?"#A6BE59":"#F35757")}
          {kpiBox("Margen proy.",factTotal>0?Math.round(benProy/factTotal*100)+"%":"—",benProy>=0?"#A6BE59":"#F35757")}
        </div>
        <div className="card" style={{marginBottom:16,overflow:"hidden"}}>
          <div className="ctit" style={{marginBottom:12}}>Evolución mensual</div>
          <ComposedChart width={cw} height={220} data={MESES_CORTO.map((n,i)=>({name:n,Real:i<=mesIdx?Math.round(mFact(i)):0,Futuro:i>mesIdx?Math.round(mFact(i)):0,Beneficio:Math.round(mCob(i)-mGast(i))}))}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.06)"/>
            <XAxis dataKey="name" tick={{fontSize:10,fill:"#8A8580"}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fontSize:10,fill:"#8A8580"}} axisLine={false} tickLine={false} tickFormatter={fmtK}/>
            <Tooltip {...ChartTooltipStyle} formatter={(v,n)=>[`${v.toLocaleString("es-ES")}€`,n]}/>
            <Bar dataKey="Real" fill="#EC683E" radius={[3,3,0,0]} stackId="f"/>
            <Bar dataKey="Futuro" fill="rgba(236,104,62,.3)" radius={[3,3,0,0]} stackId="f"/>
            <Line type="monotone" dataKey="Beneficio" stroke="#AFA3FF" strokeWidth={2} dot={{r:2,fill:"#AFA3FF"}}/>
          </ComposedChart>
        </div>
        <div className="card">
          <div className="ctit" style={{marginBottom:10}}>Próximos cobros esperados</div>
          {reservas.filter(r=>ACTIVOS.includes(r.estado)&&r.fecha>=hoyStr).sort((a,b)=>a.fecha.localeCompare(b.fecha)).slice(0,8).map(r=><div key={r.id} style={rowS}><span style={{flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.nombre}</span><span style={{color:"#8A8580"}}>{new Date(r.fecha+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"})}</span><strong style={{color:"#EC683E"}}>{fmt(precioR(r))}</strong></div>)}
          {airbnbs.filter(a=>a.fecha_entrada>=hoyStr).sort((a,b)=>a.fecha_entrada.localeCompare(b.fecha_entrada)).slice(0,5).map(a=><div key={a.id} style={rowS}><span style={{flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>🏠 {a.huesped}</span><span style={{color:"#8A8580"}}>{new Date(a.fecha_entrada+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"})}</span><strong style={{color:"#A6BE59"}}>{fmt(prc(a.precio))}</strong></div>)}
        </div>
      </>}

      {/* TAB COBROS */}
      {tab==="cobros"&&<>
        <div className="card" style={{marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,fontSize:13}}><span>Cobrado</span><strong style={{color:"#A6BE59"}}>{fmt(cobTotal)}</strong></div>
          <div style={{height:10,background:"#F0EDE8",borderRadius:10,overflow:"hidden",marginBottom:12}}><div style={{height:"100%",borderRadius:10,background:"#A6BE59",width:`${factTotal>0?cobTotal/factTotal*100:0}%`}}/></div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span>Pendiente</span><strong style={{color:"#D4A017"}}>{fmt(pendTotal)}</strong></div>
        </div>
        <div className="card" style={{marginBottom:16,overflow:"hidden"}}>
          <BarChart width={cw} height={180} data={MESES_CORTO.map((n,i)=>({name:n,Cobrado:Math.round(mCob(i)),Pendiente:Math.round(mFact(i)-mCob(i))}))}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.06)"/>
            <XAxis dataKey="name" tick={{fontSize:10,fill:"#8A8580"}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fontSize:10,fill:"#8A8580"}} axisLine={false} tickLine={false} tickFormatter={fmtK}/>
            <Tooltip {...ChartTooltipStyle} formatter={(v,n)=>[`${v.toLocaleString("es-ES")}€`,n]}/>
            <Bar dataKey="Cobrado" fill="#A6BE59" radius={[3,3,0,0]} stackId="c"/>
            <Bar dataKey="Pendiente" fill="#ECD227" radius={[3,3,0,0]} stackId="c"/>
          </BarChart>
        </div>
        {["rojo","amarillo","verde"].map(nivel=>{const dias=nivel==="rojo"?30:nivel==="amarillo"?90:9999;const diasMin=nivel==="rojo"?0:nivel==="amarillo"?30:90;
          const items=reservas.filter(r=>{if(r.estado_pago==="pagado_completo"||["cancelada","finalizada"].includes(r.estado))return false;const d=Math.round((new Date(r.fecha)-hoy)/(86400000));return d>=diasMin&&d<dias;}).sort((a,b)=>a.fecha.localeCompare(b.fecha));
          if(items.length===0)return null;const emoji=nivel==="rojo"?"🔴":nivel==="amarillo"?"🟡":"🟢";const col=nivel==="rojo"?"#F35757":nivel==="amarillo"?"#D4A017":"#A6BE59";
          return <div key={nivel} className="card" style={{marginBottom:10}}>
            <div style={{fontSize:12,fontWeight:700,color:col,marginBottom:8}}>{emoji} {nivel==="rojo"?"Menos de 30 días":nivel==="amarillo"?"30-90 días":"Más de 90 días"}</div>
            {items.map(r=>{const pend=precioR(r)-(r.seña_cobrada?prc(r.seña_importe):0);return <div key={r.id} style={rowS}><span style={{flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.nombre}</span><span style={{fontSize:11,color:"#8A8580"}}>{!r.seña_cobrada?"Seña":"Saldo"}</span><strong style={{color:col}}>{fmt(pend)}</strong></div>;})}
          </div>;
        })}
      </>}

      {/* TAB CRECIMIENTO */}
      {tab==="crecimiento"&&<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10,marginBottom:20}}>
          {kpiBox("Facturación YoY",f2025>0?`${factTotal>f2025?"+":""}${Math.round((factTotal/f2025-1)*100)}%`:"—",factTotal>=f2025?"#A6BE59":"#F35757")}
          {kpiBox("Reservas "+año,String(reservas.length),"#EC683E")}
          {kpiBox("Precio medio",reservas.length>0?fmt(reservas.reduce((s,r)=>s+precioR(r),0)/reservas.length):"—","#7FB2FF")}
        </div>
        {f2025>0&&<div className="card" style={{marginBottom:16,overflow:"hidden"}}>
          <div className="ctit" style={{marginBottom:12}}>Comparativa {año-1} vs {año}</div>
          <LineChart width={cw} height={200} data={MESES_CORTO.map((n,i)=>({name:n,[año-1]:Math.round(f2025/12),[año]:Math.round(mFact(i))}))}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.06)"/>
            <XAxis dataKey="name" tick={{fontSize:10,fill:"#8A8580"}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fontSize:10,fill:"#8A8580"}} axisLine={false} tickLine={false} tickFormatter={fmtK}/>
            <Tooltip {...ChartTooltipStyle} formatter={(v,n)=>[`${v.toLocaleString("es-ES")}€`,n]}/>
            <Line type="monotone" dataKey={año-1} stroke="#BFBAB4" strokeWidth={2} strokeDasharray="6 3" dot={{r:2}}/>
            <Line type="monotone" dataKey={año} stroke="#EC683E" strokeWidth={2} dot={{r:3,fill:"#EC683E"}}/>
          </LineChart>
        </div>}
        <div className="card">
          <div className="ctit" style={{marginBottom:10}}>Por mes</div>
          <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr style={{borderBottom:"2px solid rgba(0,0,0,.06)"}}>{["Mes",año-1,año,"Dif."].map(h=><th key={h} style={{padding:"6px 8px",textAlign:"right",color:"#8A8580",fontWeight:700}}>{h}</th>)}</tr></thead>
            <tbody>{MESES_CORTO.map((n,i)=>{const p=Math.round(f2025/12);const c=Math.round(mFact(i));const d=c-p;return <tr key={n} style={{borderBottom:"1px solid rgba(0,0,0,.03)"}}><td style={{padding:"6px 8px",fontWeight:600}}>{n}</td><td style={{padding:"6px 8px",textAlign:"right",color:"#8A8580"}}>{fmt(p)}</td><td style={{padding:"6px 8px",textAlign:"right"}}>{fmt(c)}</td><td style={{padding:"6px 8px",textAlign:"right",color:d>=0?"#A6BE59":"#F35757"}}>{d>=0?"+":""}{fmt(d)}</td></tr>;})}</tbody>
          </table></div>
        </div>
      </>}

      {/* TAB GASTOS */}
      {tab==="gastos_tab"&&<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:10,marginBottom:20}}>
          {kpiBox("Total YTD",fmt(gastTotal),"#F35757")}
          {kpiBox("Media/mes",fmt(mediaG),"#F35757")}
          {kpiBox("Proy. anual",fmt(gastProy),"#F35757")}
          {kpiBox("% s/facturación",factTotal>0?Math.round(gastTotal/factTotal*100)+"%":"—",gastTotal/factTotal>.5?"#F35757":"#A6BE59")}
        </div>
        <div className="card" style={{marginBottom:16}}>
          <div className="ctit" style={{marginBottom:10}}>Por categoría</div>
          {(()=>{const cats={};gastos.forEach(g=>{const c=g.categoria||"Otros";cats[c]=(cats[c]||0)+prc(g.importe);});return Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([c,v])=><div key={c} style={{marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span>{c}</span><strong>{fmt(v)} <span style={{color:"#8A8580",fontWeight:400}}>({Math.round(v/(gastTotal||1)*100)}%)</span></strong></div>
            <div style={{height:8,background:"#F0EDE8",borderRadius:4,marginTop:4}}><div style={{height:"100%",borderRadius:4,background:"#F35757",width:`${v/(gastTotal||1)*100}%`,transition:"width .3s"}}/></div>
          </div>);})()}
        </div>
        <div className="card" style={{marginBottom:16,overflow:"hidden"}}>
          <BarChart width={cw} height={160} data={MESES_CORTO.map((n,i)=>({name:n,Gastos:Math.round(mGast(i))}))}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.06)"/>
            <XAxis dataKey="name" tick={{fontSize:10,fill:"#8A8580"}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fontSize:10,fill:"#8A8580"}} axisLine={false} tickLine={false} tickFormatter={fmtK}/>
            <Tooltip {...ChartTooltipStyle} formatter={(v)=>[`${v.toLocaleString("es-ES")}€`]}/>
            <Bar dataKey="Gastos" fill="#F35757" radius={[3,3,0,0]}/>
          </BarChart>
        </div>
        <div className="card">
          <div className="ctit" style={{marginBottom:10}}>Últimos gastos</div>
          {[...gastos].sort((a,b)=>(b.fecha||"").localeCompare(a.fecha||"")).slice(0,10).map(g=><div key={g.id} style={rowS}><span style={{fontSize:11,color:"#8A8580"}}>{new Date(g.fecha+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"})}</span><span className="badge" style={{background:"#F0EDE8",color:"#8A8580",fontSize:10}}>{g.categoria||"—"}</span><span style={{flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{g.concepto}</span><strong style={{color:"#F35757"}}>{fmt(prc(g.importe))}</strong></div>)}
        </div>
      </>}

      {/* TAB EVENTOS */}
      {tab==="eventos"&&<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10,marginBottom:20}}>
          {kpiBox("Total reservas",String(reservas.length),"#EC683E")}
          {kpiBox("Precio medio",reservas.length>0?fmt(reservas.reduce((s,r)=>s+precioR(r),0)/reservas.length):"—","#7FB2FF")}
          {(()=>{const vr=visitas.filter(v=>v.estado==="realizada"||v.estado==="convertida").length;const vc=visitas.filter(v=>v.estado==="convertida").length;return kpiBox("Conversión",vr>0?Math.round(vc/vr*100)+"%":"—","#AFA3FF");})()}
        </div>
        <div className="card" style={{marginBottom:16}}>
          <div className="ctit" style={{marginBottom:10}}>Por tipo de evento</div>
          <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr style={{borderBottom:"2px solid rgba(0,0,0,.06)"}}>{["Tipo","N","Precio medio","Total","%"].map(h=><th key={h} style={{padding:"6px 8px",textAlign:"right",color:"#8A8580",fontWeight:700}}>{h}</th>)}</tr></thead>
            <tbody>{(()=>{const tipos={};reservas.forEach(r=>{const t=r.tipo||"Otro";if(!tipos[t])tipos[t]={n:0,total:0};tipos[t].n++;tipos[t].total+=precioR(r);});return Object.entries(tipos).sort((a,b)=>b[1].total-a[1].total).map(([t,d])=><tr key={t} style={{borderBottom:"1px solid rgba(0,0,0,.03)"}}><td style={{padding:"6px 8px",fontWeight:600}}>{t}</td><td style={{padding:"6px 8px",textAlign:"right"}}>{d.n}</td><td style={{padding:"6px 8px",textAlign:"right"}}>{fmt(d.total/d.n)}</td><td style={{padding:"6px 8px",textAlign:"right",fontWeight:700}}>{fmt(d.total)}</td><td style={{padding:"6px 8px",textAlign:"right",color:"#8A8580"}}>{Math.round(d.total/(factTotal||1)*100)}%</td></tr>);})()}</tbody>
          </table></div>
        </div>
        <div className="card" style={{marginBottom:16,overflow:"hidden"}}>
          {(()=>{const tipos={};reservas.forEach(r=>{const t=r.tipo||"Otro";if(!tipos[t])tipos[t]={n:0,total:0};tipos[t].n++;tipos[t].total+=precioR(r);});const bd=Object.entries(tipos).map(([t,d])=>({name:t,Cantidad:d.n,Media:Math.round(d.total/d.n)}));
          return <BarChart width={cw} height={160} data={bd}>
            <XAxis dataKey="name" tick={{fontSize:10,fill:"#8A8580"}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fontSize:10,fill:"#8A8580"}} axisLine={false} tickLine={false}/>
            <Tooltip {...ChartTooltipStyle}/>
            <Bar dataKey="Cantidad" fill="#EC683E" radius={[3,3,0,0]}/>
            <Bar dataKey="Media" fill="#AFA3FF" radius={[3,3,0,0]}/>
          </BarChart>;})()}
        </div>
        <div className="card">
          <div className="ctit" style={{marginBottom:10}}>Embudo de conversión</div>
          {(()=>{const vTot=visitas.length;const vReal=visitas.filter(v=>["realizada","convertida"].includes(v.estado)).length;const vConv=visitas.filter(v=>v.estado==="convertida").length;const rFirm=reservas.filter(r=>["contrato_firmado","reserva_pagada","precio_total","finalizada"].includes(r.estado)).length;const rPag=reservas.filter(r=>r.estado_pago==="pagado_completo").length;
          const steps=[{lbl:"Visitas programadas",n:vTot},{lbl:"Visitas realizadas",n:vReal},{lbl:"Reservas generadas",n:vConv},{lbl:"Contratos firmados",n:rFirm},{lbl:"Pagos completados",n:rPag}];const mx=Math.max(...steps.map(s=>s.n),1);
          return steps.map(s=><div key={s.lbl} style={{marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}><span>{s.lbl}</span><strong>{s.n}</strong></div>
            <div style={{height:8,background:"#F0EDE8",borderRadius:4}}><div style={{height:"100%",borderRadius:4,background:"#EC683E",width:`${s.n/mx*100}%`}}/></div>
          </div>);})()}
        </div>
        {/* Meses más demandados */}
        <div className="card" style={{marginTop:16}}>
          <div className="ctit" style={{marginBottom:10}}>📅 Meses más demandados</div>
          {(()=>{
            const meses={};visitas.forEach(v=>{const m=v.mes_evento_previsto||( v.fecha_evento_prevista?new Date(v.fecha_evento_prevista+"T12:00:00").getMonth()+1:null);if(m)meses[m]=(meses[m]||0)+1;});
            const entries=Object.entries(meses).map(([m,n])=>({mes:parseInt(m),n})).sort((a,b)=>b.n-a.n);
            const mx=entries.length>0?entries[0].n:1;const totalV=entries.reduce((s,e)=>s+e.n,0)||1;
            const chartD=MESES_CORTO.map((lbl,i)=>({name:lbl,Visitas:meses[i+1]||0}));
            const cw2=typeof window!=="undefined"?Math.min(window.innerWidth-64,560):400;
            return entries.length===0?<div style={{color:"#8A8580",fontSize:13}}>Sin datos de fechas previstas de evento</div>:<>
              <div style={{overflow:"hidden",marginBottom:12}}><BarChart width={cw2} height={160} data={chartD}><XAxis dataKey="name" tick={{fontSize:10,fill:"#8A8580"}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:10,fill:"#8A8580"}} axisLine={false} tickLine={false} allowDecimals={false}/><Tooltip {...ChartTooltipStyle}/><Bar dataKey="Visitas" fill="#EC683E" radius={[3,3,0,0]}/></BarChart></div>
              {entries.map((e,i)=><div key={e.mes} style={{marginBottom:6}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span>{i+1}. {MESES[e.mes-1]}</span><strong>{e.n} visita{e.n>1?"s":""} ({Math.round(e.n/totalV*100)}%)</strong></div>
                <div style={{height:6,background:"#F0EDE8",borderRadius:3,marginTop:3}}><div style={{height:"100%",borderRadius:3,background:"#EC683E",width:`${e.n/mx*100}%`}}/></div>
              </div>)}
              <div style={{fontSize:11,color:"#8A8580",marginTop:10,lineHeight:1.5}}>💡 Incluye visitas realizadas y no convertidas — refleja la demanda real del mercado.</div>
            </>;
          })()}
        </div>
      </>}

      {/* TAB AIRBNB */}
      {tab==="airbnb_tab"&&<>
        {(()=>{const totalN=airbnbs.reduce((s,a)=>{const n=Math.round((new Date(a.fecha_salida)-new Date(a.fecha_entrada))/(86400000));return s+Math.max(n,0);},0);const totalIng=airbnbs.reduce((s,a)=>s+prc(a.precio),0);const diasAño=365;const ocu=Math.round(totalN/diasAño*100);
        return <>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:10,marginBottom:20}}>
            {kpiBox("Reservas",String(airbnbs.length),"#A6BE59")}
            {kpiBox("Total noches",String(totalN),"#7FB2FF")}
            {kpiBox("Ingresos",fmt(totalIng),"#EC683E")}
            {kpiBox("€/noche",totalN>0?fmt(totalIng/totalN):"—","#AFA3FF")}
            {kpiBox("Ocupación",ocu+"%","#ECD227")}
          </div>
          <div className="card" style={{marginBottom:16}}>
            <div className="ctit" style={{marginBottom:10}}>Por mes</div>
            <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr style={{borderBottom:"2px solid rgba(0,0,0,.06)"}}>{["Mes","Res.","Noches","Ingresos","Ocu."].map(h=><th key={h} style={{padding:"6px 8px",textAlign:"right",color:"#8A8580",fontWeight:700}}>{h}</th>)}</tr></thead>
              <tbody>{MESES_CORTO.map((n,i)=>{const m=String(i+1).padStart(2,"0");const ma=airbnbs.filter(a=>a.fecha_entrada?.slice(5,7)===m);const mn=ma.reduce((s,a)=>s+Math.max(Math.round((new Date(a.fecha_salida)-new Date(a.fecha_entrada))/86400000),0),0);const mi=ma.reduce((s,a)=>s+prc(a.precio),0);const diasM=new Date(año,i+1,0).getDate();
                return <tr key={n} style={{borderBottom:"1px solid rgba(0,0,0,.03)"}}><td style={{padding:"6px 8px",fontWeight:600}}>{n}</td><td style={{textAlign:"right",padding:"6px 8px"}}>{ma.length}</td><td style={{textAlign:"right",padding:"6px 8px"}}>{mn}</td><td style={{textAlign:"right",padding:"6px 8px"}}>{fmt(mi)}</td><td style={{textAlign:"right",padding:"6px 8px",color:mn/diasM>.5?"#A6BE59":"#8A8580"}}>{Math.round(mn/diasM*100)}%</td></tr>;})}</tbody>
            </table></div>
          </div>
          <div className="card" style={{overflow:"hidden"}}>
            <BarChart width={cw} height={180} data={MESES_CORTO.map((n,i)=>{const m=String(i+1).padStart(2,"0");const mn=airbnbs.filter(a=>a.fecha_entrada?.slice(5,7)===m).reduce((s,a)=>s+Math.max(Math.round((new Date(a.fecha_salida)-new Date(a.fecha_entrada))/86400000),0),0);const diasM=new Date(año,i+1,0).getDate();return{name:n,Ocupación:Math.round(mn/diasM*100),Ingresos:Math.round(airbnbs.filter(a=>a.fecha_entrada?.slice(5,7)===m).reduce((s,a)=>s+prc(a.precio),0))/100};})}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.06)"/>
              <XAxis dataKey="name" tick={{fontSize:10,fill:"#8A8580"}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:10,fill:"#8A8580"}} axisLine={false} tickLine={false}/>
              <Tooltip {...ChartTooltipStyle}/>
              <Bar dataKey="Ocupación" fill="#A6BE59" radius={[3,3,0,0]} name="Ocupación %"/>
            </BarChart>
          </div>
        </>;})()}
      </>}
    </div>
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

  if(rol!=="admin")return null;

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
    <div style={{padding:"54px 20px 16px"}}><div style={{fontSize:12,color:T.ink3,fontWeight:500}}>Sistema</div><div style={{fontSize:30,fontWeight:700,color:T.ink,letterSpacing:-1,lineHeight:1.02}}>Ajustes</div></div>
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
  // Dates blocked by events with house
  const fechasBloq=new Set();
  reservas.forEach(r=>{if(r.incluye_casa&&r.estado!=="cancelada"){
    if(r.bloqueo_dia_anterior&&!r.dia_anterior_desbloqueado){const d=new Date(new Date(r.fecha+"T12:00:00").getTime()-86400000).toISOString().split("T")[0];fechasBloq.add(d);}
    if(r.bloqueo_dia_posterior&&!r.dia_posterior_desbloqueado){const d=new Date(new Date(r.fecha+"T12:00:00").getTime()+86400000).toISOString().split("T")[0];fechasBloq.add(d);}
  }});

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

  // Helpers calendar helpers (reuse buildRvCalMap logic inline)
  const calMap=buildRvCalMap(reservas,airbnbs,año,mes);
  const mesesPills=[-1,0,1,2].map(o=>{const m2=(mes+o+12)%12;return{m:m2,lbl:["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"][m2],offset:o};});

  return <>
    {/* BUSCADOR disponibilidad */}
    {(isA||isC)&&<div style={{background:T.surface,border:`1px solid ${T.line}`,borderRadius:16,padding:"14px 16px",marginBottom:16}}>
      <div style={{fontSize:11,color:T.ink3,textTransform:"uppercase",letterSpacing:1,fontWeight:700,marginBottom:10}}>Consultar disponibilidad</div>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        <input type="date" className="fi" value={busqueda} onChange={e=>{setBusqueda(e.target.value);setResultadoBusqueda(null);}} style={{flex:1,minWidth:140}}/>
        <button onClick={buscar} disabled={!busqueda} style={{padding:"12px 16px",borderRadius:12,background:T.ink,color:"#fff",border:0,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:T.sans,flexShrink:0}}>Buscar</button>
        {resultadoBusqueda&&<button onClick={limpiarBusqueda} style={{padding:"11px 14px",borderRadius:12,background:T.surface,color:T.ink2,border:`1px solid ${T.line}`,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:T.sans,flexShrink:0}}>✕</button>}
      </div>
      {resultadoBusqueda&&<div style={{marginTop:12,padding:"12px 14px",borderRadius:12,background:resultadoBusqueda.libre?"rgba(166,190,89,.08)":"rgba(232,85,85,.08)",border:`1px solid ${resultadoBusqueda.libre?T.olive:T.coral}40`}}>
        <div style={{fontSize:14,fontWeight:700,color:resultadoBusqueda.libre?T.olive:T.coral,marginBottom:(resultadoBusqueda.reservas.length+resultadoBusqueda.airbnbs.length)>0?8:0}}>{resultadoBusqueda.libre?"✅ Disponible — sin reservas":"❌ No disponible"}</div>
        {isC&&!resultadoBusqueda.libre&&resultadoBusqueda.airbnbs.length>0&&resultadoBusqueda.reservas.length===0&&<div style={{fontSize:13,color:T.coral}}>Fecha bloqueada</div>}
        {isA&&resultadoBusqueda.reservas.map(r=>{const est=ESTADOS.find(e=>e.id===r.estado);return<div key={r.id} style={{display:"flex",justifyContent:"space-between",gap:8,marginTop:6,paddingTop:6,borderTop:`1px solid ${T.line}`}}><div><div style={{fontSize:13,fontWeight:600,color:T.ink}}>{r.nombre}</div>{r.tipo&&<div style={{fontSize:11,color:T.ink3}}>{r.tipo}</div>}</div>{est&&<RvStatusPill r={r}/>}</div>;})}
        {isA&&resultadoBusqueda.airbnbs.map(a=><div key={a.id} style={{display:"flex",justifyContent:"space-between",gap:8,marginTop:6,paddingTop:6,borderTop:`1px solid ${T.line}`}}><div><div style={{fontSize:13,fontWeight:600,color:T.ink}}>🏠 {a.huesped}</div><div style={{fontSize:11,color:T.ink3}}>{fmtRango(a)}</div></div><span style={{fontSize:10,padding:"2px 8px",borderRadius:999,background:T.softBlue+"30",color:T.softBlue,fontWeight:700}}>Airbnb</span></div>)}
        {isC&&resultadoBusqueda.reservas.map(r=>{const est=ESTADOS.find(e=>e.id===r.estado);return<div key={r.id} style={{display:"flex",justifyContent:"space-between",gap:8,marginTop:6,paddingTop:6,borderTop:`1px solid ${T.line}`}}><div style={{fontSize:13,fontWeight:600,color:T.ink}}>{r.nombre}</div>{est&&<RvStatusPill r={r}/>}</div>;})}
      </div>}
    </div>}

    {/* Nav meses pills */}
    <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:8,marginBottom:14}}>
      <button onClick={pm} style={{width:36,height:36,borderRadius:999,background:T.surface,border:`1px solid ${T.line}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:18,color:T.ink2}}>‹</button>
      <div style={{display:"flex",gap:3,background:T.surface,borderRadius:999,padding:3,border:`1px solid ${T.line}`}}>
        {mesesPills.map(({m:m2,lbl,offset})=>(
          <span key={offset} onClick={()=>{if(offset<0)pm();else if(offset>0)nm();}} style={{padding:"6px 12px",borderRadius:999,fontSize:11.5,fontWeight:700,background:offset===0?T.ink:"transparent",color:offset===0?"#fff":T.ink3,cursor:offset!==0?"pointer":"default",textTransform:"capitalize",fontFamily:T.sans}}>{lbl}</span>
        ))}
      </div>
      <button onClick={nm} style={{width:36,height:36,borderRadius:999,background:T.surface,border:`1px solid ${T.line}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:18,color:T.ink2}}>›</button>
    </div>

    {/* Leyenda */}
    <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap",fontSize:10,color:T.ink3,fontWeight:600}}>
      {[{c:T.terracotta,l:"Evento + casa"},{c:T.gold,l:"Evento finca"},{c:T.softBlue,l:"Airbnb"},{c:T.terracotta+"60",l:"Bloqueo auto"}].map(({c,l})=>(
        <span key={l} style={{display:"inline-flex",alignItems:"center",gap:5}}><span style={{width:10,height:10,borderRadius:3,background:c,display:"inline-block"}}/>{l}</span>
      ))}
    </div>

    {/* Grid calendario */}
    <div style={{background:T.surface,border:`1px solid ${T.line}`,borderRadius:18,padding:10,marginBottom:16}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:6}}>
        {["L","M","X","J","V","S","D"].map((d,i)=><div key={i} style={{textAlign:"center",fontSize:10,fontWeight:700,color:T.ink3,letterSpacing:.5,padding:"4px 0"}}>{d}</div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
        {Array(ofs).fill(null).map((_,i)=><div key={"e"+i}/>)}
        {Array(dim).fill(null).map((_,i)=>{
          const d=i+1;const fecha=ds(d);
          const rsv=grReservas(d);const airD=grAirbnb(d);
          const isT=d===today.getDate()&&mes===today.getMonth()&&año===today.getFullYear();
          const isBusq=resultadoBusqueda&&fecha===resultadoBusqueda.fecha;
          const hasRsv=rsv.length>0;const hasAir=airD.length>0;
          const esBloq=fechasBloq.has(fecha);const isSel=sel===d;
          let cellBg="transparent",cellBorder="none";
          if(isSel||isT){cellBg=T.ink;cellBorder="none";}
          else if(hasRsv){const ev=rsv[0];const ec=ev.incluye_casa?T.terracotta:T.gold;cellBg=ec+"28";cellBorder=`1px solid ${ec}55`;}
          else if(hasAir){cellBg=T.softBlue+"28";cellBorder=`1px solid ${T.softBlue}55`;}
          else if(esBloq){cellBg=T.terracotta+"20";cellBorder=`1px dashed ${T.terracotta}45`;}
          if(isBusq){cellBg="rgba(236,104,62,.15)";cellBorder="2px solid #EC683E";}
          const txtColor=(isSel||isT)?"#fff":hasRsv?(rsv[0].incluye_casa?T.terracotta:T.gold):hasAir?T.softBlue:T.ink2;
          return<div key={d} onClick={()=>setSel(isSel?null:d)} style={{aspectRatio:"1/1.1",borderRadius:10,padding:4,background:cellBg,border:cellBorder,display:"flex",flexDirection:"column",justifyContent:"space-between",overflow:"hidden",cursor:"pointer"}}>
            <div style={{fontSize:12,fontWeight:(isSel||isT)?700:600,color:txtColor,textAlign:"right"}}>{d}</div>
            {hasRsv&&!isSel&&!isT&&<div style={{fontSize:7.5,fontWeight:700,color:T.ink,lineHeight:1.05,overflow:"hidden"}}>{rsv[0].nombre?.split("·")[0]?.trim().slice(0,14)}</div>}
            {hasAir&&!hasRsv&&!isSel&&!isT&&<div style={{width:6,height:6,borderRadius:999,background:T.softBlue,alignSelf:"flex-end"}}/>}
            {esBloq&&!hasRsv&&!hasAir&&!isSel&&<div style={{fontSize:7,alignSelf:"flex-end",opacity:.7}}>🔒</div>}
          </div>;
        })}
      </div>
    </div>

    {/* Detalle día seleccionado */}
    {sel&&<div style={{marginBottom:16}}>
      <div style={{fontSize:10.5,color:T.ink3,letterSpacing:.6,fontWeight:700,textTransform:"uppercase",marginBottom:10}}>{sel} de {MESES[mes]} {año}</div>
      {grReservas(sel).length===0&&grAirbnb(sel).length===0&&!fechasBloq.has(ds(sel))&&(
        <div style={{background:T.surface,border:`1px solid ${T.line}`,borderRadius:14,padding:16,display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,borderRadius:999,background:T.olive+"30",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>✅</div>
          <div style={{fontSize:14,fontWeight:600,color:T.ink3}}>Día libre — Sin reservas</div>
        </div>
      )}
      {fechasBloq.has(ds(sel))&&grReservas(sel).length===0&&grAirbnb(sel).length===0&&<div style={{background:T.terracotta+"15",border:`1px solid ${T.terracotta}40`,borderRadius:14,padding:12,display:"flex",gap:10,alignItems:"center",marginBottom:8}}><span style={{fontSize:18}}>🔒</span><div style={{fontSize:13,fontWeight:600,color:T.ink}}>Día bloqueado automáticamente por reserva con casa</div></div>}
      {grReservas(sel).map(r=>{const color=r.incluye_casa?T.terracotta:T.gold;return<div key={r.id} style={{background:color,borderRadius:18,padding:14,marginBottom:8,color:T.ink}}>
        <div style={{fontSize:10.5,fontWeight:700,letterSpacing:.6,textTransform:"uppercase",opacity:.7}}>{r.tipo||"Evento"} · {r.incluye_casa?"Finca + Casa":"Solo finca"}</div>
        <div style={{fontSize:17,fontWeight:700,letterSpacing:-.4,marginTop:4}}>{r.nombre}</div>
        {r.invitados&&<div style={{fontSize:12,marginTop:4,opacity:.8}}>{r.invitados} invitados</div>}
        {isA&&getPrecioReserva(r)>0&&<div style={{fontSize:14,fontWeight:700,marginTop:8}}>{(Math.round(getPrecioReserva(r))).toLocaleString("es-ES")}€</div>}
      </div>;})}
      {grAirbnb(sel).map(a=>(isC
        ?<div key={a.id} style={{background:T.coral+"15",border:`1px solid ${T.coral}`,borderRadius:14,padding:12,color:T.danger,fontWeight:700,fontSize:13}}>🔴 Fecha no disponible</div>
        :<div key={a.id} style={{background:T.softBlue+"20",border:`1px solid ${T.softBlue}55`,borderRadius:18,padding:14,marginBottom:8}}>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:.5,textTransform:"uppercase",color:T.softBlue,marginBottom:4}}>Airbnb</div>
          <div style={{fontSize:15,fontWeight:700,color:T.ink}}>{(isA||isL)?a.huesped:"Alojamiento turístico"}</div>
          <div style={{fontSize:11,color:T.ink3,marginTop:3}}>{fmtRango(a)}{a.personas?` · ${a.personas} personas`:""}</div>
          {isA&&a.precio&&<div style={{fontSize:13,fontWeight:700,color:T.ink,marginTop:6}}>{parseFloat(a.precio).toLocaleString("es-ES")}€</div>}
        </div>
      ))}
    </div>}

    {/* Próximos eventos del mes - admin/comercial */}
    {(isA||isC)&&!sel&&rsvMes.length>0&&<div style={{marginTop:4}}>
      <div style={{fontSize:10.5,color:T.ink3,letterSpacing:.6,fontWeight:700,textTransform:"uppercase",marginBottom:10}}>Eventos este mes</div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {rsvMes.slice(0,5).map(e=>{
          const color=e.incluye_casa?T.terracotta:T.gold;
          const f=new Date(e.fecha+"T12:00:00");
          const dayN=f.toLocaleDateString("es-ES",{weekday:"short"}).slice(0,3).toUpperCase();
          return<div key={e.id} onClick={()=>setSel(f.getDate())} style={{background:T.surface,border:`1px solid ${T.line}`,borderRadius:14,padding:12,display:"flex",alignItems:"center",gap:12,cursor:"pointer"}}>
            <div style={{width:42,textAlign:"center",paddingRight:10,borderRight:`1px solid ${T.line}`}}>
              <div style={{fontSize:9,color:T.ink3,fontWeight:700,letterSpacing:.5}}>{dayN}</div>
              <div style={{fontSize:20,fontWeight:700,color,lineHeight:1,fontFamily:T.sans}}>{f.getDate()}</div>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:700,color:T.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.nombre}</div>
              <div style={{fontSize:11,color:T.ink3}}>{e.invitados?`${e.invitados} pax · `:""}Finca{e.incluye_casa?" + Casa":""}</div>
            </div>
            <FmIcon name="chevR" size={15} stroke={T.ink3}/>
          </div>;
        })}
      </div>
    </div>}

    {/* Airbnb del mes */}
    {(isA||isL)&&!sel&&airbnbMes.length>0&&<div style={{marginTop:16}}>
      <div style={{fontSize:10.5,color:T.ink3,letterSpacing:.6,fontWeight:700,textTransform:"uppercase",marginBottom:10}}>Airbnb este mes</div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {airbnbMes.slice(0,4).map(a=><div key={a.id} style={{background:T.surface,border:`1px solid ${T.line}`,borderRadius:14,padding:12,display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:36,height:36,borderRadius:10,background:T.softBlue+"30",display:"flex",alignItems:"center",justifyContent:"center"}}><FmIcon name="home" size={16} stroke={T.softBlue}/></div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:700,color:T.ink}}>{(isA||isL)?a.huesped:"Alojamiento turístico"}</div>
            <div style={{fontSize:11,color:T.ink3}}>{fmtRango(a)}{a.personas?` · ${a.personas} personas`:""}</div>
          </div>
        </div>)}
      </div>
    </div>}

    {/* Lista mes para jardinero */}
    {isJ&&!sel&&<div style={{marginTop:14}}>
      {rsvMes.length===0&&airbnbMes.length===0
        ?<div style={{background:T.surface,border:`1px solid ${T.line}`,borderRadius:14,padding:20,textAlign:"center",color:T.ink3}}>Sin eventos este mes</div>
        :<div style={{display:"flex",flexDirection:"column",gap:8}}>
          {rsvMes.map(r=><div key={r.id} style={{background:T.surface,border:`1px solid ${T.line}`,borderRadius:14,padding:12}}>
            <div style={{fontSize:13,fontWeight:700,color:T.ink}}>{r.nombre}</div>
            <div style={{fontSize:11,color:T.ink3,marginTop:3}}>📅 {new Date(r.fecha).toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"})}</div>
          </div>)}
          {airbnbMes.map(a=><div key={a.id} style={{background:T.surface,border:`1px solid ${T.line}`,borderRadius:14,padding:12}}>
            <div style={{fontSize:13,fontWeight:700,color:T.ink}}>🏠 Alojamiento turístico</div>
            <div style={{fontSize:11,color:T.ink3,marginTop:3}}>📅 {fmtRango(a)}{a.personas?` · ${a.personas} personas`:""}</div>
          </div>)}
        </div>}
    </div>}
  </>;
}

function Calendario({tok,rol}){
  return <>
    <div style={{padding:"54px 20px 16px",display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
      <div><div style={{fontSize:12,color:T.ink3,fontWeight:500}}>Vista mensual</div><div style={{fontSize:28,fontWeight:700,color:T.ink,letterSpacing:-1,lineHeight:1.02}}>Calendario</div></div>
    </div>
    <div className="pb" style={{maxWidth:900}}><CalBase tok={tok} rol={rol}/></div>
  </>;
}
function CalLimpieza({tok,perfil}){
  const [srv,setSrv]=useState(null);
  const [tareas,setTareas]=useState([]);
  const [coordP,setCoordP]=useState([]);
  const [savingC,setSavingC]=useState(false);
  const [saving,setSaving]=useState(false);
  const [zonasOpen,setZonasOpen]=useState({0:true});
  const [load,setLoad]=useState(true);
  const [showDatePick,setShowDatePick]=useState(null);
  const [customDate,setCustomDate]=useState("");
  const t=perfil?.es_operario?SB_KEY:tok;
  useEffect(()=>{
    Promise.all([
      sbGet("servicios","?select=*&order=fecha.desc&limit=1",t),
      sbGet("coordinacion_servicios","?estado=in.(preguntando_si_lista,servicio_creado_pendiente_fecha)&select=*",t),
    ]).then(([srvs,coords])=>{
      setCoordP(coords.filter(c=>!c.tipo?.includes("jardin")));
      if(srvs.length>0){setSrv(srvs[0]);sbGet("servicio_tareas",`?servicio_id=eq.${srvs[0].id}&select=*`,t).then(setTareas).catch(()=>{});}
      setLoad(false);
    }).catch(()=>setLoad(false));
  },[]);
  const toggleT=async(tareaId)=>{
    if(saving)return;setSaving(true);
    const cur=tareas.find(x=>x.id===tareaId);const nuevoDone=!cur?.done;
    await sbPatch("servicio_tareas",`id=eq.${tareaId}`,{done:nuevoDone,completado_por:nuevoDone?(perfil?.nombre||"Staff"):null,completado_ts:nuevoDone?new Date().toISOString():null},tok).catch(()=>{});
    setTareas(prev=>prev.map(x=>x.id===tareaId?{...x,done:nuevoDone}:x));setSaving(false);
  };
  const tMap={};tareas.forEach(x=>{if(x.tarea_id)tMap[x.tarea_id]=x;});
  const allT=LIMP_ZONAS.flatMap(z=>[...(z.tareas||[]),...(z.subzonas?.flatMap(s=>s.tareas)||[])]);
  const totalT=allT.length;const doneT=allT.filter(x=>tMap[x.id]?.done).length;
  const pct=totalT>0?Math.round(doneT/totalT*100):0;const deg=Math.round(doneT/Math.max(totalT,1)*360);
  const confirmarFecha=async(c,dia)=>{
    if(savingC)return;setSavingC(true);const ds=dia.toISOString().split("T")[0];
    try{await sbPatch("coordinacion_servicios",`id=eq.${c.id}`,{fecha_programada:ds,estado:"confirmado",respondido_por:perfil?.nombre||"Staff"},tok);
      if(c.servicio_id)await sbPatch("servicios",`id=eq.${c.servicio_id}`,{fecha:ds},tok).catch(()=>{});
      setCoordP(prev=>prev.filter(x=>x.id!==c.id));}catch(_){}setSavingC(false);
  };
  const getDias=(ini,fin)=>{const ds=[];const f=new Date(fin);let d=new Date(Math.max(new Date(ini),Date.now()));while(d<=f&&ds.length<5){ds.push(new Date(d));d=new Date(d.getTime()+86400000);}return ds;};
  if(load)return <div className="loading"><div className="spin"/></div>;
  return(
    <div style={{paddingBottom:80}}>
      <div style={{padding:"54px 20px 14px"}}>
        <div style={{fontSize:11,color:T.ink3,letterSpacing:.6,fontWeight:600,textTransform:"uppercase"}}>Servicio activo</div>
        <div style={{fontFamily:T.sans,fontSize:28,fontWeight:700,color:T.ink,letterSpacing:-1,lineHeight:1.05}}>Limpieza</div>
        {srv&&<div style={{fontSize:12,color:T.ink3,marginTop:3}}>{srv.nombre} · {new Date(srv.fecha+"T12:00:00").toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"short"})}</div>}
      </div>
      <div style={{padding:"0 16px"}}>
        {coordP.map(c=>{
          const fechaFmt=c.fecha_checkin_siguiente?new Date(c.fecha_checkin_siguiente+"T12:00:00").toLocaleDateString("es-ES",{weekday:"short",day:"numeric",month:"long"}):"—";
          if(c.estado==="preguntando_si_lista")return(
            <div key={c.id} style={{background:"#FEF8E4",border:`1px solid ${T.gold}55`,borderRadius:16,padding:14,marginBottom:12,display:"flex",gap:10,alignItems:"flex-start"}}>
              <div style={{width:28,height:28,borderRadius:999,background:T.gold+"44",color:"#8A6B0F",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><FmIcon name="warn" size={14} stroke="#8A6B0F"/></div>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:700,color:"#6B5108"}}>Acción requerida</div>
                <div style={{fontSize:11,color:"#8A6B0F",marginTop:2}}>{fechaFmt} — ¿está la casa lista?</div>
                <div style={{display:"flex",gap:6,marginTop:8}}>
                  <button disabled={savingC} onClick={async()=>{setSavingC(true);try{await sbPatch("coordinacion_servicios",`id=eq.${c.id}`,{estado:"casa_lista_confirmada",respondido_por:perfil?.nombre||"Staff"},tok);const adms=await sbGet("usuarios","?rol=eq.admin&select=id",tok).catch(()=>[]);for(const a of adms)await sbPost("notificaciones",{para:a.id,txt:`✅ ${perfil?.nombre||"Staff"} confirma: casa lista para ${fechaFmt}`},tok).catch(()=>{});setCoordP(prev=>prev.filter(x=>x.id!==c.id));}catch(_){}setSavingC(false);}} style={{padding:"7px 12px",borderRadius:8,border:`1px solid ${T.gold}88`,background:T.gold,color:T.ink,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:T.sans}}>✅ Lista</button>
                  <button disabled={savingC} onClick={async()=>{setSavingC(true);try{await sbPatch("coordinacion_servicios",`id=eq.${c.id}`,{estado:"servicio_creado_pendiente_fecha"},tok);setCoordP(prev=>prev.map(x=>x.id===c.id?{...x,estado:"servicio_creado_pendiente_fecha"}:x));}catch(_){}setSavingC(false);}} style={{padding:"7px 12px",borderRadius:8,border:`1px solid ${T.gold}88`,background:T.surface,color:"#8A6B0F",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:T.sans}}>Necesita limpieza</button>
                </div>
              </div>
            </div>
          );
          const dias=getDias(c.ventana_inicio||new Date().toISOString(),c.ventana_fin||new Date(Date.now()+3*86400000).toISOString());
          return(
            <div key={c.id} style={{background:"#FEF8E4",border:`1px solid ${T.gold}55`,borderRadius:16,padding:14,marginBottom:12,display:"flex",gap:10,alignItems:"flex-start"}}>
              <div style={{width:28,height:28,borderRadius:999,background:T.gold+"44",color:"#8A6B0F",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><FmIcon name="warn" size={14} stroke="#8A6B0F"/></div>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:700,color:"#6B5108"}}>Elegir día de limpieza</div>
                <div style={{fontSize:11,color:"#8A6B0F",marginTop:2}}>Confirma fecha en la ventana disponible</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
                  {dias.map(d=><button key={d.toISOString()} disabled={savingC} onClick={()=>confirmarFecha(c,d)} style={{padding:"6px 10px",borderRadius:8,border:`1px solid ${T.gold}88`,background:T.surface,color:"#8A6B0F",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:T.sans}}>{d.toLocaleDateString("es-ES",{weekday:"short",day:"numeric"})}</button>)}
                  <button onClick={()=>{setShowDatePick(c);setCustomDate("");}} style={{padding:"6px 10px",borderRadius:8,border:`1px solid ${T.gold}88`,background:T.surface,color:"#8A6B0F",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:T.sans}}>Otra fecha</button>
                </div>
              </div>
            </div>
          );
        })}
        {srv?(
          <div style={{background:T.olive+"18",border:`1px solid ${T.olive}44`,borderRadius:20,padding:16,marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:10,color:"#5A8A3E",letterSpacing:.8,textTransform:"uppercase",fontWeight:700}}>En curso{srv.hora_inicio?` · desde ${srv.hora_inicio}`:""}</div>
              <div style={{fontFamily:T.sans,fontSize:17,color:T.ink,fontWeight:700,marginTop:2}}>{srv.nombre}</div>
              <div style={{fontSize:11,color:T.ink3,marginTop:2}}>{LIMP_ZONAS.length} zonas · {totalT} tareas</div>
            </div>
            <div style={{width:54,height:54,borderRadius:999,background:`conic-gradient(${T.olive} ${deg}deg,${T.line} 0)`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <div style={{width:44,height:44,borderRadius:999,background:T.surface,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.sans,fontSize:13,fontWeight:700,color:T.ink}}>{pct}%</div>
            </div>
          </div>
        ):(
          <div style={{background:T.surface,border:`1px solid ${T.line}`,borderRadius:20,padding:16,marginBottom:14,textAlign:"center",color:T.ink3,fontSize:13}}>Sin servicio activo</div>
        )}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {LIMP_ZONAS.map((z,zi)=>{
            const zonaTareas=[...(z.tareas||[]),...(z.subzonas?.flatMap(s=>s.tareas)||[])];
            const donePorZona=zonaTareas.filter(x=>tMap[x.id]?.done).length;
            const totalPorZona=zonaTareas.length;
            const zDone=totalPorZona>0&&donePorZona===totalPorZona;
            const enProg=donePorZona>0&&!zDone;
            const open=!!zonasOpen[zi];
            return(
              <div key={z.id} style={{background:T.surface,border:`1px solid ${T.line}`,borderRadius:16,overflow:"hidden"}}>
                <button onClick={()=>setZonasOpen(prev=>({...prev,[zi]:!prev[zi]}))} style={{width:"100%",padding:"13px 14px",background:"transparent",border:0,cursor:"pointer",display:"flex",alignItems:"center",gap:12,fontFamily:T.sans,textAlign:"left"}}>
                  <div style={{width:28,height:28,borderRadius:8,background:zDone?T.olive:enProg?T.gold+"44":T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>
                    {zDone?<FmIcon name="check" size={13} stroke="white"/>:<span>{z.emoji}</span>}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:T.ink}}>{z.nombre}</div>
                    {totalPorZona>0&&<div style={{fontSize:10.5,color:T.ink3,marginTop:1}}>{donePorZona}/{totalPorZona} tareas{enProg&&<span style={{color:T.gold}}> · en progreso</span>}</div>}
                    {totalPorZona===0&&<div style={{fontSize:10.5,color:T.ink4,marginTop:1}}>Sin tareas registradas</div>}
                  </div>
                  <FmIcon name={open?"chevU":"chevD"} size={15} stroke={T.ink3}/>
                </button>
                {open&&zonaTareas.length>0&&(
                  <div style={{padding:"0 14px 14px",borderTop:`1px solid ${T.line}`}}>
                    <div style={{display:"flex",flexDirection:"column",marginTop:4}}>
                      {zonaTareas.map((ta,ti)=>{
                        const dbRow=tMap[ta.id];const done=!!dbRow?.done;
                        return(
                          <button key={ta.id} onClick={()=>dbRow&&toggleT(dbRow.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",background:"transparent",border:0,cursor:dbRow?"pointer":"default",fontFamily:T.sans,textAlign:"left",borderBottom:ti<zonaTareas.length-1?`1px solid ${T.line}`:"none"}}>
                            <div style={{width:20,height:20,borderRadius:6,background:done?T.olive:"transparent",border:`1.5px solid ${done?T.olive:T.ink4}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{done&&<FmIcon name="check" size={11} stroke="white"/>}</div>
                            <span style={{flex:1,fontSize:12.5,color:done?T.ink3:T.ink,textDecoration:done?"line-through":"none",fontWeight:done?400:500}}>{ta.txt}</span>
                          </button>
                        );
                      })}
                    </div>
                    {z.foto_requerida&&<button style={{marginTop:8,padding:"8px 12px",borderRadius:8,background:T.bg,border:`1px dashed ${T.ink4}`,color:T.ink2,fontFamily:T.sans,fontSize:11,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}><FmIcon name="camera" size={13} stroke={T.ink2}/> Subir foto de zona</button>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {showDatePick&&<div className="ov" onClick={()=>setShowDatePick(null)}><div className="modal" style={{maxWidth:360}} onClick={e=>e.stopPropagation()}>
        <h3>📅 Elegir fecha</h3>
        <div className="fg"><label>Fecha</label><input type="date" className="fi" value={customDate} onChange={e=>setCustomDate(e.target.value)}/></div>
        <div className="mft"><button className="btn bg" onClick={()=>setShowDatePick(null)}>Cancelar</button><button className="btn bp" disabled={!customDate||savingC} onClick={()=>{confirmarFecha(showDatePick,new Date(customDate+"T12:00:00"));setShowDatePick(null);}}>{savingC?"…":"Confirmar"}</button></div>
      </div></div>}
    </div>
  );
}
function CalJardin({tok,perfil}){
  const [srvActivo,setSrvActivo]=useState(null);
  const [srvTareas,setSrvTareas]=useState([]);
  const [coordP,setCoordP]=useState([]);
  const [jornadaId,setJornadaId]=useState(null);
  const [jornadaFin,setJornadaFin]=useState(false);
  const [tiempoSec,setTiempoSec]=useState(0);
  const [pausado,setPausado]=useState(false);
  const [pausasArr,setPausasArr]=useState([]);
  const [savingT,setSavingT]=useState(false);
  const [savingC,setSavingC]=useState(false);
  const [savingJ,setSavingJ]=useState(false);
  const [load,setLoad]=useState(true);
  const hoyStr=new Date().toISOString().split("T")[0];
  const jId=perfil?.es_operario?perfil.referencia_id:perfil?.id;
  const t=perfil?.es_operario?SB_KEY:tok;
  const loadData=async()=>{
    try{
      const[coords,srvs]=await Promise.all([
        sbGet("coordinacion_servicios","?estado=in.(preguntando_si_lista,servicio_creado_pendiente_fecha)&select=*",t),
        sbGet("jardin_servicios",`?jardinero_id=eq.${jId}&estado=eq.activo&select=*`,t).catch(()=>[]),
      ]);
      setCoordP(coords.filter(c=>c.tipo?.includes("jardin")));
      if(srvs.length>0){
        const s=srvs[0];setSrvActivo(s);
        const tareas=await sbGet("jardin_servicio_tareas",`?servicio_id=eq.${s.id}&select=*&order=created_at.asc`,t).catch(()=>[]);
        setSrvTareas(tareas.filter(x=>!x.añadida_por_jardinero));
        let jorns=[];
        try{jorns=await sbGet("jornadas_jardineria",`?servicio_id=eq.${s.id}&hora_inicio=gte.${hoyStr}T00:00:00&hora_inicio=lte.${hoyStr}T23:59:59&select=*`,t);}catch(_){}
        if(jorns.length>0){
          const j=jorns[0];setJornadaId(j.id);setPausasArr(j.pausas||[]);
          if(j.hora_fin){setJornadaFin(true);}else{
            const ts=new Date(j.hora_inicio).getTime();
            if(ts>0)localStorage.setItem(`fm_jornada_inicio_${s.id}`,ts.toString());
            const pArr=j.pausas||[];const lastP=pArr[pArr.length-1];setPausado(!!lastP&&!lastP.fin);
          }
        }
      }
    }catch(_){}setLoad(false);
  };
  useEffect(()=>{if(tok)loadData();},[]);
  // Cronómetro con timestamps localStorage
  useEffect(()=>{
    const sId=srvActivo?.id;if(!sId||jornadaFin)return;
    const inicio=parseInt(localStorage.getItem(`fm_jornada_inicio_${sId}`)||"0");if(!inicio)return;
    const calcPausas=()=>{let ms=0;for(const p of pausasArr){if(p.inicio&&p.fin)ms+=(p.fin-p.inicio);else if(p.inicio&&!p.fin)ms+=(Date.now()-p.inicio);}return ms;};
    const calc=()=>Math.max(0,Math.floor((Date.now()-inicio-calcPausas())/1000));
    setTiempoSec(calc());const iv=setInterval(()=>setTiempoSec(calc()),1000);return()=>clearInterval(iv);
  },[srvActivo?.id,jornadaFin,pausado,pausasArr]);
  const fmtEl=s=>{const h=Math.floor(s/3600);const m=Math.floor((s%3600)/60);const ss=s%60;return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(ss).padStart(2,"0")}`;};
  const toggleTarea=async(tareaId)=>{
    if(savingT)return;setSavingT(true);
    const cur=srvTareas.find(x=>x.id===tareaId);const nuevoDone=!cur?.done;
    await sbPatch("jardin_servicio_tareas",`id=eq.${tareaId}`,{done:nuevoDone,completado_por:nuevoDone?(perfil?.nombre||"Staff"):null,completado_ts:nuevoDone?new Date().toISOString():null},tok).catch(()=>{});
    setSrvTareas(prev=>prev.map(x=>x.id===tareaId?{...x,done:nuevoDone}:x));setSavingT(false);
  };
  const togglePausa=async()=>{
    if(!jornadaId||savingJ)return;setSavingJ(true);
    const nowTs=Date.now();const newPausas=[...pausasArr];
    if(!pausado){newPausas.push({inicio:nowTs});setPausado(true);}
    else{const last=newPausas[newPausas.length-1];if(last&&!last.fin)last.fin=nowTs;setPausado(false);}
    await sbPatch("jornadas_jardineria",`id=eq.${jornadaId}`,{pausas:newPausas},tok).catch(()=>{});
    setPausasArr(newPausas);setSavingJ(false);
  };
  const iniciarJornada=async()=>{
    if(!srvActivo||savingJ)return;setSavingJ(true);
    const ahora=new Date();const tsInicio=ahora.getTime();
    try{const[j]=await sbPost("jornadas_jardineria",{servicio_id:srvActivo.id,fecha:hoyStr,hora_inicio:ahora.toISOString(),pausas:[]},tok);
      setJornadaId(j.id);setJornadaFin(false);setPausasArr([]);setPausado(false);
      localStorage.setItem(`fm_jornada_inicio_${srvActivo.id}`,tsInicio.toString());
      localStorage.setItem(`fm_jornada_id_${srvActivo.id}`,String(j.id));
    }catch(_){}setSavingJ(false);
  };
  const finalizarJornada=async()=>{
    if(!jornadaId||savingJ)return;setSavingJ(true);
    const ahora=new Date();const inicio=parseInt(localStorage.getItem(`fm_jornada_inicio_${srvActivo?.id}`)||"0");
    const durMin=inicio?Math.round((ahora.getTime()-inicio)/60000):0;
    try{await sbPatch("jornadas_jardineria",`id=eq.${jornadaId}`,{hora_fin:ahora.toISOString(),duracion_minutos:durMin},tok);setJornadaFin(true);}catch(_){}setSavingJ(false);
  };
  const confirmarCoord=async(c,dia)=>{
    if(savingC)return;setSavingC(true);const ds=dia.toISOString().split("T")[0];
    try{await sbPatch("coordinacion_servicios",`id=eq.${c.id}`,{fecha_programada:ds,estado:"confirmado",respondido_por:perfil?.nombre||"Staff"},tok);
      setCoordP(prev=>prev.filter(x=>x.id!==c.id));}catch(_){}setSavingC(false);
  };
  const doneT=srvTareas.filter(x=>x.done).length;const totalT=srvTareas.length;
  if(load)return <div className="loading"><div className="spin"/></div>;
  return(
    <div style={{paddingBottom:80}}>
      <div style={{padding:"54px 20px 14px"}}>
        <div style={{fontSize:11,color:T.ink3,letterSpacing:.6,fontWeight:600,textTransform:"uppercase"}}>Dashboard</div>
        <div style={{fontFamily:T.sans,fontSize:28,fontWeight:700,color:T.ink,letterSpacing:-1,lineHeight:1.05}}>Jardinería</div>
        {perfil&&<div style={{fontSize:12,color:T.ink3,marginTop:3}}>Servicio activo · {perfil.nombre.split(" ")[0]}</div>}
      </div>
      <div style={{padding:"0 16px"}}>
        {coordP.map(c=>{
          const ventanaIni=c.ventana_inicio||new Date().toISOString();const ventanaFin=c.ventana_fin||new Date(Date.now()+3*86400000).toISOString();
          const dias=[];let d=new Date(Math.max(new Date(ventanaIni),Date.now()));const f=new Date(ventanaFin);
          while(d<=f&&dias.length<3){dias.push(new Date(d));d=new Date(d.getTime()+86400000);}
          return(
            <div key={c.id} style={{background:"#FEF8E4",border:`1px solid ${T.gold}55`,borderRadius:16,padding:14,marginBottom:12,display:"flex",gap:10,alignItems:"flex-start"}}>
              <div style={{width:28,height:28,borderRadius:999,background:T.gold+"44",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><FmIcon name="warn" size={14} stroke="#8A6B0F"/></div>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:700,color:"#6B5108"}}>Coordinación pendiente</div>
                <div style={{fontSize:11,color:"#8A6B0F",marginTop:2}}>{c.nombre_reserva||"Confirmar fecha de servicio de jardín"}</div>
                <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
                  {dias.map((d,i)=><button key={d.toISOString()} disabled={savingC} onClick={()=>confirmarCoord(c,d)} style={{padding:"6px 10px",borderRadius:8,border:`1px solid ${T.gold}88`,background:i===0?T.gold:T.surface,color:i===0?T.ink:"#8A6B0F",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:T.sans}}>{d.toLocaleDateString("es-ES",{weekday:"short",day:"numeric"})}</button>)}
                </div>
              </div>
            </div>
          );
        })}
        {srvActivo?(
          <div style={{background:`linear-gradient(150deg,${T.olive} 0%,#8DA44A 100%)`,borderRadius:20,padding:20,color:"white",position:"relative",overflow:"hidden",marginBottom:14}}>
            <div style={{position:"absolute",top:-30,right:-30,width:140,height:140,borderRadius:999,background:"rgba(255,255,255,.12)"}}/>
            <div style={{position:"absolute",bottom:-50,left:-30,width:180,height:180,borderRadius:999,background:"rgba(255,255,255,.08)"}}/>
            <div style={{position:"relative",display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div>
                <div style={{fontSize:10,color:"rgba(255,255,255,.75)",letterSpacing:.8,textTransform:"uppercase",fontWeight:600}}>{jornadaFin?"Jornada finalizada":"Cronómetro activo"}</div>
                <div style={{fontFamily:T.sans,fontSize:15,fontWeight:700,marginTop:2}}>{srvActivo.nombre}</div>
              </div>
              {!jornadaFin&&<div style={{width:10,height:10,borderRadius:999,background:pausado?"rgba(255,255,255,.4)":"#FF5555",boxShadow:pausado?"none":"0 0 10px #FF5555",animation:pausado?"none":"pulse 1.5s infinite"}}/>}
            </div>
            <div style={{position:"relative",fontFamily:"'SF Mono',Menlo,monospace",fontSize:50,fontWeight:300,letterSpacing:-2,marginTop:6,lineHeight:1,fontVariantNumeric:"tabular-nums"}}>
              {jornadaFin?"—:—:—":fmtEl(tiempoSec)}
            </div>
            {!jornadaFin&&jornadaId&&(
              <div style={{position:"relative",display:"flex",gap:8,marginTop:14}}>
                <button onClick={togglePausa} disabled={savingJ} style={{flex:1,padding:12,borderRadius:12,border:0,background:"rgba(255,255,255,.22)",color:"white",fontFamily:T.sans,fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                  <FmIcon name={pausado?"play":"pause"} size={15} stroke="white"/>{pausado?"Reanudar":"Pausar"}
                </button>
                <button onClick={finalizarJornada} disabled={savingJ} style={{flex:1,padding:12,borderRadius:12,border:0,background:T.ink,color:"white",fontFamily:T.sans,fontSize:13,fontWeight:700,cursor:"pointer"}}>{savingJ?"…":"Finalizar"}</button>
              </div>
            )}
            {!jornadaFin&&!jornadaId&&(
              <button onClick={iniciarJornada} disabled={savingJ} style={{position:"relative",marginTop:14,width:"100%",padding:14,borderRadius:12,border:0,background:"rgba(255,255,255,.22)",color:"white",fontFamily:T.sans,fontSize:14,fontWeight:700,cursor:"pointer"}}>{savingJ?"Iniciando…":"▶ Iniciar jornada"}</button>
            )}
          </div>
        ):(
          <div style={{background:T.surface,border:`1px solid ${T.line}`,borderRadius:20,padding:20,marginBottom:14,textAlign:"center",color:T.ink3,fontSize:13}}>Sin servicio de jardinería activo</div>
        )}
        {srvTareas.length>0&&(
          <>
            <div style={{fontSize:10.5,color:T.ink3,letterSpacing:.6,fontWeight:700,textTransform:"uppercase",marginBottom:8}}>Tareas · {doneT}/{totalT} hechas</div>
            <div style={{background:T.surface,border:`1px solid ${T.line}`,borderRadius:16,padding:4,marginBottom:14}}>
              {srvTareas.map((ta,i)=>(
                <button key={ta.id} onClick={()=>toggleTarea(ta.id)} style={{width:"100%",padding:"10px 12px",background:"transparent",border:0,cursor:"pointer",display:"flex",alignItems:"center",gap:10,fontFamily:T.sans,textAlign:"left",borderBottom:i<srvTareas.length-1?`1px solid ${T.line}`:"none"}}>
                  <div style={{width:20,height:20,borderRadius:6,background:ta.done?T.olive:"transparent",border:`1.5px solid ${ta.done?T.olive:T.ink4}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{ta.done&&<FmIcon name="check" size={11} stroke="white"/>}</div>
                  <span style={{flex:1,fontSize:13,color:ta.done?T.ink3:T.ink,textDecoration:ta.done?"line-through":"none",fontWeight:ta.done?400:500}}>{ta.txt}</span>
                  {!ta.done&&<FmIcon name="clock" size={14} stroke={T.ink3}/>}
                </button>
              ))}
            </div>
          </>
        )}
        <div style={{fontSize:10.5,color:T.ink3,letterSpacing:.6,fontWeight:700,textTransform:"uppercase",marginBottom:8}}>Calendario</div>
        <CalBase tok={tok} rol="jardinero"/>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}`}</style>
    </div>
  );
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

// ─── TAREAS COMERCIALES ──────────────────────────────────────────────────────
function AsignarUsuario({tok,value,onChange}){
  const[usuarios,setUsuarios]=useState([]);
  useEffect(()=>{sbGet("usuarios","?rol=in.(admin,comercial)&select=id,nombre,rol",tok).then(setUsuarios).catch(()=>{});},[]);
  return <select className="fi" value={value||""} onChange={e=>{const u=usuarios.find(x=>x.id===e.target.value);onChange(e.target.value,u?.nombre||"");}}><option value="">Sin asignar</option>{usuarios.map(u=><option key={u.id} value={u.id}>{u.nombre} ({u.rol})</option>)}</select>;
}
const TAREA_TIPOS={llamada:"📞",whatsapp:"💬",email:"📧",seguimiento:"📋",cobro:"💰",contrato:"📄",otro:"🔧"};
function TareasComerciales({entidad_tipo,entidad_id,entidad_nombre,tok,perfil,rol}){
  const isA=rol==="admin";const isC=rol==="comercial";
  const[tareas,setTareas]=useState([]);const[showForm,setShowForm]=useState(false);const[saving,setSaving]=useState(false);
  const[form,setForm]=useState({tipo:"llamada",titulo:"",descripcion:"",fecha_limite:"",asignado_a:perfil?.id,asignado_nombre:perfil?.nombre});
  const hoy=new Date().toISOString().split("T")[0];
  const cargar=async()=>{
    const tokenQ=perfil?.es_operario?SB_KEY:tok;
    const q=`?entidad_tipo=eq.${entidad_tipo}&entidad_id=eq.${entidad_id}&order=created_at.desc&select=*`;
    const t=await sbGet("tareas_comerciales",q,tokenQ).catch(()=>[]);
    setTareas(t);
  };
  useEffect(()=>{cargar();},[entidad_id]);
  const crear=async()=>{
    if(!form.titulo||saving)return;
    setSaving(true);
    const tokenQ=perfil?.es_operario?SB_KEY:tok;
    try{
      const body={tipo:form.tipo||"otro",titulo:form.titulo,descripcion:form.descripcion||"",entidad_tipo,entidad_id:String(entidad_id),entidad_nombre:entidad_nombre||"",estado:"pendiente",fecha_limite:form.fecha_limite||null,asignado_a:form.asignado_a||perfil?.id||"",asignado_nombre:form.asignado_nombre||perfil?.nombre||"",creado_por:perfil?.nombre||"Admin"};
      await sbPost("tareas_comerciales",body,tokenQ);
      await addHistorial(entidad_tipo,entidad_id,`Tarea creada: "${form.titulo}"`,perfil?.nombre||"Admin",tokenQ).catch(()=>{});
      setForm({tipo:"llamada",titulo:"",descripcion:"",fecha_limite:"",asignado_a:perfil?.id,asignado_nombre:perfil?.nombre});setShowForm(false);await cargar();
    }catch(_){}
    setSaving(false);
  };
  const marcarHecha=async(t)=>{
    const tokenQ=perfil?.es_operario?SB_KEY:tok;
    try{
      await sbPatch("tareas_comerciales",`id=eq.${t.id}`,{estado:"hecha",completada_por:perfil?.nombre||"Admin",completada_ts:new Date().toISOString()},tokenQ);
      // Buscar contacto vinculado directamente
      let contactoId=null;
      try{
        let rows=[];
        if(entidad_tipo==="visita")rows=await sbGet("visitas",`?id=eq.${entidad_id}&select=contacto_id`,tokenQ);
        else if(entidad_tipo==="reserva")rows=await sbGet("reservas",`?id=eq.${entidad_id}&select=contacto_id`,tokenQ);
        else if(entidad_tipo==="airbnb")rows=await sbGet("reservas_airbnb",`?id=eq.${entidad_id}&select=contacto_id`,tokenQ);
        contactoId=rows?.[0]?.contacto_id||null;
      }catch(_){}
      if(contactoId){
        const TICONS={llamada:"📞",whatsapp:"💬",email:"📧",seguimiento:"📋",cobro:"💰",contrato:"📄"};
        const ti=["llamada","whatsapp","email"].includes(t.tipo)?t.tipo:"nota";
        const resumen=`${TICONS[t.tipo]||"🔧"} ${t.titulo}${t.descripcion?" — "+t.descripcion:""}`;
        await sbPost("contacto_interacciones",{contacto_id:contactoId,tipo:ti,direccion:"salida",fecha:new Date().toISOString(),resumen,resultado:"positivo",creado_por:perfil?.nombre||"Admin"},tokenQ).catch(()=>{});
        await sbPatch("contactos",`id=eq.${contactoId}`,{updated_at:new Date().toISOString()},tokenQ).catch(()=>{});
      }
      await addHistorial(entidad_tipo,entidad_id,`Tarea completada: "${t.titulo}"`,perfil?.nombre||"Admin",tokenQ).catch(()=>{});
      await cargar();
    }catch(_){}
  };
  const eliminar=async(id)=>{try{await sbDelete("tareas_comerciales",`id=eq.${id}`,tok);await cargar();}catch(_){}};
  const pend=tareas.filter(t=>!t.estado||t.estado==="pendiente"||t.estado==="Pendiente");
  const hechas=tareas.filter(t=>t.estado==="hecha"||t.estado==="Hecha"||t.estado==="completada");
  const urgencia=(t)=>{if(!t.fecha_limite)return"normal";if(t.fecha_limite<hoy)return"vencida";if(t.fecha_limite===hoy)return"hoy";const d=Math.ceil((new Date(t.fecha_limite+"T12:00:00")-new Date())/(86400000));return d<=3?"proxima":"normal";};
  const colUrg={vencida:"#F35757",hoy:"#D4A017",proxima:"#D4A017",normal:"#A6BE59"};
  return <div style={{background:T.surface,borderRadius:20,border:`1px solid ${T.line}`,overflow:"hidden",fontFamily:T.sans,marginTop:16}}>
    {/* Header */}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",borderBottom:`1px solid ${T.line}`}}>
      <div style={{fontSize:13,fontWeight:700,color:T.ink}}>Tareas <span style={{fontSize:10,color:T.ink3,fontWeight:600}}>{pend.length} pendiente{pend.length!==1?"s":""}</span></div>
      <button onClick={()=>setShowForm(!showForm)} style={{height:28,padding:"0 12px",borderRadius:999,background:T.ink,color:"#fff",border:0,fontFamily:T.sans,fontSize:11,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}><FmIcon name="plus" size={11} stroke="#fff"/>Tarea</button>
    </div>
    {/* Form */}
    {showForm&&<div style={{padding:14,borderBottom:`1px solid ${T.line}`,background:T.bg}}>
      <div className="g2">
        <div className="fg"><label>Tipo</label><select className="fi" value={form.tipo} onChange={e=>setForm(v=>({...v,tipo:e.target.value}))}>{Object.entries(TAREA_TIPOS).map(([k,v])=><option key={k} value={k}>{v} {k}</option>)}</select></div>
        <div className="fg"><label>Fecha límite</label><input type="date" className="fi" value={form.fecha_limite} onChange={e=>setForm(v=>({...v,fecha_limite:e.target.value}))}/></div>
      </div>
      <div className="fg"><label>Título *</label><input className="fi" value={form.titulo} onChange={e=>setForm(v=>({...v,titulo:e.target.value}))} placeholder="Ej: Llamar para confirmar seña"/></div>
      <div className="fg"><label>Notas</label><textarea className="fi" rows={2} value={form.descripcion} onChange={e=>setForm(v=>({...v,descripcion:e.target.value}))} placeholder="Instrucciones…"/></div>
      {isA&&<div className="fg"><label>Asignar a</label><AsignarUsuario tok={tok} value={form.asignado_a} onChange={(id,n)=>setForm(v=>({...v,asignado_a:id,asignado_nombre:n}))}/></div>}
      <div style={{display:"flex",gap:8}}><button onClick={()=>setShowForm(false)} style={{flex:1,padding:"10px 0",borderRadius:999,border:`1px solid ${T.line}`,background:T.surface,color:T.ink,fontFamily:T.sans,fontWeight:600,fontSize:12,cursor:"pointer"}}>Cancelar</button><button onClick={crear} disabled={saving||!form.titulo} style={{flex:2,padding:"10px 0",borderRadius:999,border:0,background:saving||!form.titulo?T.ink+"55":T.ink,color:"#fff",fontFamily:T.sans,fontWeight:700,fontSize:12,cursor:saving||!form.titulo?"not-allowed":"pointer"}}>{saving?"…":"Crear tarea"}</button></div>
    </div>}
    {/* Lista pendientes */}
    {pend.map(t=>{const u=urgencia(t);const col=colUrg[u];return<div key={t.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderBottom:`1px solid ${T.line}`}}>
      <button onClick={()=>marcarHecha(t)} style={{width:22,height:22,borderRadius:999,border:`2px solid ${col}`,background:"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:13,fontWeight:600,color:T.ink}}>{TAREA_TIPOS[t.tipo]||"📋"} {t.titulo}</div>
        {t.descripcion&&<div style={{fontSize:11,color:T.ink3,marginTop:2}}>{t.descripcion}</div>}
        <div style={{display:"flex",gap:8,marginTop:3,flexWrap:"wrap",fontSize:10,color:T.ink3}}>
          {t.fecha_limite&&<span style={{color:col,fontWeight:600}}>{u==="vencida"?"Vencida":u==="hoy"?"Hoy":new Date(t.fecha_limite+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"})}</span>}
          {t.asignado_nombre&&<span>{t.asignado_nombre}</span>}
        </div>
      </div>
      {isA&&<button onClick={()=>eliminar(t.id)} style={{width:28,height:28,borderRadius:999,background:"#FEF2F2",border:"1px solid #FECACA",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}><FmIcon name="x" size={11} stroke="#D9443A"/></button>}
    </div>;})}
    {pend.length===0&&!showForm&&<div style={{padding:"20px 14px",textAlign:"center",color:T.ink3,fontSize:12}}>Sin tareas pendientes</div>}
    {/* Completadas */}
    {hechas.length>0&&<details><summary style={{fontSize:12,color:T.ink3,cursor:"pointer",padding:"10px 14px",borderTop:`1px solid ${T.line}`}}>✅ {hechas.length} completada{hechas.length!==1?"s":""}</summary>
      {hechas.map(t=><div key={t.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderTop:`1px solid ${T.line}`}}>
        <div style={{width:22,height:22,borderRadius:999,background:T.olive,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><FmIcon name="check" size={12} stroke="white" sw={2.5}/></div>
        <div style={{flex:1,fontSize:12,color:T.ink3,textDecoration:"line-through"}}>{TAREA_TIPOS[t.tipo]||""} {t.titulo}</div>
        <div style={{fontSize:10,color:T.ink4}}>{t.completada_por}</div>
      </div>)}
    </details>}
  </div>;
}

// ─── RESERVAS ────────────────────────────────────────────────────────────────
function Reservas({tok,rol,perfil,navTarget,setNavTarget,setPage}){
  const isA=rol==="admin";
  const{refresh}=useContext(BadgeCtx);
  useEffect(()=>{marcarVistoTipo("reserva",String(perfil?.id),tok);setTimeout(refresh,500);},[]);
  const ACTIVOS=["visita","pendiente_contrato","contrato_firmado","reserva_pagada","precio_total"];
  const [reservas,setReservas]=useState([]);
  const [filtro,setFiltro]=useState("activas");
  const [sel,setSel]=useState(null);
  const [load,setLoad]=useState(true);
  const [tabR,setTabR]=useState("activas");
  const [airbnbs,setAirbnbs]=useState([]);const [selAb,setSelAb]=useState(null);
  const [contactoVinc,setContactoVinc]=useState(null);
  useEffect(()=>{if(navTarget&&navTarget.id){if(navTarget.fecha_entrada){setSelAb(navTarget);setTabR("airbnb");}else setSel(navTarget);setNavTarget?.(null);}},[navTarget]);
  const [showSeña,setShowSeña]=useState(false);
  const [showRent,setShowRent]=useState(false);const [rentData,setRentData]=useState(null);const [loadRent,setLoadRent]=useState(false);
  const [señaImporte,setSeñaImporte]=useState("");
  const [showPagoTotal,setShowPagoTotal]=useState(false);
  const [cobroSaving,setCobroSaving]=useState(false);
  const [editPrecios,setEditPrecios]=useState(false);const [formPrecios,setFormPrecios]=useState({precio_finca:"",precio_casa:"",incluye_casa:false});
  const [showTipoRes,setShowTipoRes]=useState(false);
  const [showFormAb,setShowFormAb]=useState(false);const [savingAb,setSavingAb]=useState(false);
  const hoyR=new Date().toISOString().split("T")[0];
  const abFormVacio={huesped:"",fecha_entrada:hoyR,fecha_salida:hoyR,personas:"",precio:"",notas:""};
  const [formAb,setFormAb]=useState(abFormVacio);
  const crearAirbnb=async()=>{
    if(!formAb.huesped||!formAb.fecha_entrada||!formAb.fecha_salida||savingAb)return;
    if(formAb.fecha_salida<formAb.fecha_entrada){alert("La fecha de salida no puede ser anterior a la de entrada");return;}
    setSavingAb(true);
    try{
      const[abNew]=await sbPost("reservas_airbnb",{...formAb,personas:parseInt(formAb.personas)||null,precio:parseFloat(formAb.precio)||null,creado_por:perfil.nombre},tok);
      if(abNew)await crearContactoDesdeAirbnb({...formAb,...abNew},tok,perfil).catch(()=>{});
      const en7=new Date();en7.setDate(en7.getDate()+7);
      if(formAb.fecha_entrada&&formAb.fecha_entrada<=en7.toISOString().split("T")[0])notificarRoles(["admin","limpieza","jardinero"],"🏠 Nueva reserva Airbnb",`${formAb.huesped} llega el ${new Date(formAb.fecha_entrada+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"long"})}`,"airbnb-nueva",tok);
      const diasH=Math.ceil((new Date(formAb.fecha_entrada+"T12:00:00")-new Date())/(864e5));
      if(diasH<=3)await ejecutarCoordInmediata(null,formAb.fecha_entrada,"airbnb",true,tok);
      await verificarConflictosNuevaReserva(formAb.fecha_entrada,tok);
      setShowFormAb(false);setFormAb(abFormVacio);await load_();
    }catch(_){}setSavingAb(false);
  };
  const fmtE=v=>(Math.round(parseFloat(v)||0)).toLocaleString("es-ES")+"€";

  const load_=async()=>{
    const[r,ab]=await Promise.all([
      sbGet("reservas","?select=*&order=fecha.asc",tok),
      sbGet("reservas_airbnb","?select=*&order=fecha_entrada.desc",tok).catch(()=>[]),
    ]);
    const hoy=new Date().toISOString().split("T")[0];
    const ACTIVOS_=["visita","pendiente_contrato","contrato_firmado","reserva_pagada","precio_total"];
    const pasadas=r.filter(x=>x.fecha<hoy&&ACTIVOS_.includes(x.estado));
    for(const p of pasadas){await sbPatch("reservas",`id=eq.${p.id}`,{estado:"finalizada"},tok).catch(()=>{});p.estado="finalizada";}
    setReservas(r);setAirbnbs(ab);setLoad(false);
  };
  useEffect(()=>{load_();},[]);
  const abrirReserva=async(r)=>{setSel(r);if(r.contacto_id){const[c]=await sbGet("contactos",`?id=eq.${r.contacto_id}&select=*`,tok).catch(()=>[]);setContactoVinc(c||null);}else setContactoVinc(null);};

  const cambiarE=async(id,e)=>{
    try{
      await sbPatch("reservas",`id=eq.${id}`,{estado:e,updated_at:new Date().toISOString()},tok);
      const est=ESTADOS.find(s=>s.id===e);
      await addHistorial("reserva",id,`Estado cambiado a: ${est?.lbl||e}`,perfil?.nombre||"Admin",tok);
      const r=reservas.find(x=>x.id===id);
      if(r)notificarRoles(["admin","comercial"],`📋 Reserva actualizada`,`${r.nombre}: ${est?.lbl||e}`,"reserva-estado",tok);
      // Cascading cancel if cancelled
      if(e==="cancelada"){
        const coords=await sbGet("coordinacion_servicios",`?reserva_id=eq.${id}&select=*`,tok).catch(()=>[]);
        for(const c of coords){
          if(c.servicio_id){await sbDelete("servicio_tareas",`servicio_id=eq.${c.servicio_id}`,tok).catch(()=>{});await sbDelete("servicios",`id=eq.${c.servicio_id}`,tok).catch(()=>{});}
          if(c.jardin_servicio_id)await sbPatch("jardin_servicios",`id=eq.${c.jardin_servicio_id}`,{estado:"cancelado"},tok).catch(()=>{});
          await sbDelete("coordinacion_servicios",`id=eq.${c.id}`,tok).catch(()=>{});
        }
        if(r){const ops=await sbGet("operarios","?activo=eq.true&select=id",tok).catch(()=>[]);
          const adms=await sbGet("usuarios","?rol=eq.admin&select=id",tok).catch(()=>[]);
          const msg=`❌ Reserva "${r.nombre}" cancelada. Servicios asociados cancelados.`;
          for(const u of[...ops,...adms])await sbPost("notificaciones",{para:u.id,txt:msg},tok).catch(()=>{});
          sendPush("❌ Reserva cancelada",msg,"cancelacion");}
      }
      setReservas(prev=>prev.map(r=>r.id===id?{...r,estado:e}:r));
      setSel(p=>p?.id===id?{...p,estado:e}:p);
      if(r?.contacto_id){const resultado=e==="cancelada"?"negativo":"neutro";autoInteraccion(r.contacto_id,"nota",`${e==="cancelada"?"❌ Reserva cancelada":"Estado de reserva actualizado"}: ${est?.lbl||e} — ${r.nombre}`,resultado,tok,perfil?.nombre);}
    }catch(_){}
  };

  const del=async id=>{
    try{await sbDelete("reservas",`id=eq.${id}`,tok);setReservas(prev=>prev.filter(r=>r.id!==id));setSel(null);}catch(_){}
  };

  const registrarSeña=async()=>{
    if(!sel||cobroSaving||!señaImporte)return;
    setCobroSaving(true);
    try{
      const imp=parseFloat(señaImporte)||0;
      const hoyStr=new Date().toISOString().split("T")[0];
      await sbPatch("reservas",`id=eq.${sel.id}`,{seña_importe:imp,seña_cobrada:true,seña_fecha:hoyStr,estado_pago:"seña_cobrada"},tok);
      await addHistorial("reserva",sel.id,`Seña cobrada: ${imp.toLocaleString("es-ES")}€`,perfil?.nombre||"Admin",tok);
      autoInteraccion(sel.contacto_id,"nota",`💰 Seña cobrada: ${imp.toLocaleString("es-ES")}€ — Reserva: ${sel.nombre}`,"positivo",tok,perfil?.nombre);
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
      autoInteraccion(sel.contacto_id,"nota",`✅ Pago completo recibido: ${precioTotal.toLocaleString("es-ES")}€ — Reserva: ${sel.nombre}`,"positivo",tok,perfil?.nombre);
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

  const[isDesktopR,setIsDesktopR]=useState(typeof window!=="undefined"&&window.innerWidth>=768);
  useEffect(()=>{const fn=()=>setIsDesktopR(window.innerWidth>=768);window.addEventListener("resize",fn);return()=>window.removeEventListener("resize",fn);},[]);

  if(load)return <div className="loading"><div className="spin"/><span>Cargando…</span></div>;

  if(isDesktopR)return<ReservasDesktopLayout reservas={reservas} airbnbs={airbnbs} setPage={setPage} page="reservas" perfil={perfil} tok={tok} abrirReserva={abrirReserva} selAb={selAb} setSelAb={setSelAb} sel={sel} setSel={setSel} contactoVinc={contactoVinc} setShowTipoRes={setShowTipoRes} setEditPrecios={setEditPrecios} setShowSeña={setShowSeña}/>;

  const activas=reservas.filter(r=>ACTIVOS.includes(r.estado));
  const finalizadas=reservas.filter(r=>r.estado==="finalizada");
  const canceladas=reservas.filter(r=>r.estado==="cancelada");
  const lista=tabR==="activas"?activas:tabR==="finalizadas"?finalizadas:tabR==="canceladas"?canceladas:reservas;

  return <div style={{paddingBottom:100}}>
    {/* Header */}
    <div style={{padding:"54px 20px 16px",display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:10}}>
      <div><div style={{fontSize:12,color:T.ink3,fontWeight:500}}>Eventos & Airbnb · {new Date().getFullYear()}</div><div style={{fontSize:30,fontWeight:700,color:T.ink,letterSpacing:-1,lineHeight:1.02}}>Reservas</div></div>
      <div style={{display:"flex",gap:6}}>
        <button onClick={()=>setPage?.("calendario")} style={{width:40,height:40,borderRadius:999,background:T.surface,border:`1px solid ${T.line}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><FmIcon name="calendar" size={17} stroke={T.ink}/></button>
        {isA&&<button onClick={()=>setShowTipoRes(true)} style={{width:40,height:40,borderRadius:999,background:T.ink,border:0,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><FmIcon name="plus" size={17} stroke="#fff" sw={2.4}/></button>}
      </div>
    </div>
    {/* KPI strip */}
    <div style={{padding:"0 20px 18px",display:"grid",gridTemplateColumns:"1.1fr 1fr 1fr",gap:8}}>
      <RvKpiBlock bg={T.olive} title={activas.length+airbnbs.length} sub="Reservas activas"/>
      <RvKpiBlock bg={T.gold} title={`${reservas.filter(r=>!["cancelada","finalizada","visita"].includes(r.estado)).length}/${activas.length}`} sub="Confirmadas"/>
      <RvKpiBlock bg={T.terracotta} title={fmtE([...reservas,...airbnbs].reduce((s,r)=>s+getPrecioReserva(r),0))} sub="Facturación"/>
    </div>
    {/* Tabs */}
    <div style={{padding:"0 20px 14px"}}><div style={{display:"flex",background:T.surface,borderRadius:999,padding:4,border:`1px solid ${T.line}`,gap:2}}>
      {[{k:"activas",l:"Eventos",c:activas.length},{k:"airbnb",l:"Airbnb",c:airbnbs.length},{k:"finalizadas",l:"Final.",c:finalizadas.length},{k:"canceladas",l:"Cancel.",c:canceladas.length}].map(t=><button key={t.k} onClick={()=>{setTabR(t.k);setSel(null);setSelAb(null);}} style={{flex:1,whiteSpace:"nowrap",padding:"9px 8px",borderRadius:999,border:0,background:tabR===t.k?T.ink:"transparent",color:tabR===t.k?"#fff":T.ink2,fontFamily:T.sans,fontSize:11,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>{t.l}<span style={{fontSize:9.5,padding:"1px 5px",borderRadius:999,background:tabR===t.k?"rgba(255,255,255,.22)":T.bg,color:tabR===t.k?"#fff":T.ink3}}>{t.c}</span></button>)}
    </div></div>
    {/* Lista */}
    <div style={{padding:"0 20px"}}>
      {tabR==="activas"&&(lista.length===0?<div style={{textAlign:"center",padding:"40px 0",color:T.ink3}}>Sin reservas activas</div>:lista.map(r=><RvEventRow key={r.id} r={r} onOpen={()=>abrirReserva(r)}/>))}
      {tabR==="airbnb"&&(airbnbs.length===0?<div style={{textAlign:"center",padding:"40px 0",color:T.ink3}}>Sin reservas Airbnb</div>:airbnbs.map(a=><RvBnbRow key={a.id} r={a} onOpen={()=>setSelAb(a)}/>))}
      {tabR==="finalizadas"&&finalizadas.map(r=><RvEventRow key={r.id} r={r} faded onOpen={()=>abrirReserva(r)}/>)}
      {tabR==="canceladas"&&canceladas.map(r=><RvEventRow key={r.id} r={r} cancel onOpen={()=>abrirReserva(r)}/>)}
    </div>
    {/* Overlays de detalle */}
    {sel&&tabR!=="airbnb"&&<RvEventDetail reserva={sel} tok={tok} perfil={perfil} rol={rol} isA={isA} onClose={()=>setSel(null)} onChanged={r=>{setReservas(prev=>prev.map(x=>x.id===r.id?r:x));setSel(r);}}/>}
    {selAb&&<RvBnbDetail reserva={selAb} tok={tok} perfil={perfil} onClose={()=>setSelAb(null)} onChanged={a=>{setAirbnbs(prev=>prev.map(x=>x.id===a.id?a:x));setSelAb(a);}}/>}
    {/* MODAL SEÑA */}
    {showSeña&&sel&&<div style={{position:"fixed",inset:0,background:"rgba(20,15,10,.6)",zIndex:999,display:"flex",alignItems:"flex-end",fontFamily:T.sans}}>
      <div style={{width:"100%",background:T.bg,borderTopLeftRadius:24,borderTopRightRadius:24,maxHeight:"88vh",overflow:"auto",paddingBottom:34}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:"14px 20px 0",display:"flex",justifyContent:"center"}}><div style={{width:44,height:4,borderRadius:999,background:T.line}}/></div>
        <div style={{padding:"14px 20px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${T.line}`}}>
          <div><div style={{fontSize:12,color:T.ink3,fontWeight:500,marginBottom:2}}>{sel.nombre}</div><div style={{fontSize:22,fontWeight:700,color:T.ink,letterSpacing:-.6}}>Registrar cobro</div></div>
          <button onClick={()=>setShowSeña(false)} style={{width:32,height:32,borderRadius:999,background:T.surface,border:`1px solid ${T.line}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><FmIcon name="x" size={15} stroke={T.ink}/></button>
        </div>
        <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:14}}>
          {/* Resumen */}
          <div style={{background:"linear-gradient(135deg,#1A1A1A,#2a2520)",borderRadius:18,padding:16,color:"#fff"}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,.6)",letterSpacing:1,textTransform:"uppercase",fontWeight:700,marginBottom:4}}>Pendiente de cobro</div>
            <div style={{fontSize:34,fontWeight:700,letterSpacing:-1,lineHeight:1}}>{fmtE(Math.max(0,getPrecioReserva(sel)-(parseFloat(sel.seña_cobrada?sel.seña_importe||0:0))))}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.5)",marginTop:6}}>Total {fmtE(getPrecioReserva(sel))} · Cobrado {fmtE(parseFloat(sel.seña_cobrada?sel.seña_importe||0:0))}</div>
          </div>
          {/* Importe */}
          <div>
            <div style={{fontSize:11,color:T.ink3,fontWeight:700,letterSpacing:.5,textTransform:"uppercase",marginBottom:8}}>Importe a cobrar</div>
            <div style={{display:"flex",alignItems:"center",gap:12,background:T.surface,border:`1px solid ${T.line}`,borderRadius:16,padding:"14px 16px"}}>
              <input type="number" inputMode="decimal" value={señaImporte} onChange={e=>setSeñaImporte(e.target.value)} placeholder="0" autoFocus style={{flex:1,background:"transparent",border:0,outline:"none",fontFamily:T.sans,fontSize:26,fontWeight:700,color:T.ink,letterSpacing:-.6,width:"100%"}}/>
              <span style={{fontSize:20,fontWeight:700,color:T.ink3}}>€</span>
            </div>
            <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
              {[{l:"Señal 20%",v:Math.round(getPrecioReserva(sel)*.2)},{l:"50%",v:Math.round(getPrecioReserva(sel)*.5)},{l:"Saldo total",v:Math.max(0,getPrecioReserva(sel)-(parseFloat(sel.seña_cobrada?sel.seña_importe||0:0)))}].map((q,i)=><button key={i} onClick={()=>setSeñaImporte(String(q.v))} style={{padding:"7px 12px",borderRadius:999,border:`1px solid ${T.line}`,background:T.surface,color:T.ink2,fontFamily:T.sans,fontSize:11,fontWeight:700,cursor:"pointer"}}>{q.l} · {fmtE(q.v)}</button>)}
            </div>
          </div>
          {/* Botones */}
          <div style={{display:"flex",gap:8,paddingTop:4}}>
            <button onClick={()=>setShowSeña(false)} style={{flex:1,padding:"14px 0",borderRadius:999,border:`1px solid ${T.line}`,background:T.surface,color:T.ink,fontFamily:T.sans,fontWeight:600,fontSize:14,cursor:"pointer"}}>Cancelar</button>
            <button onClick={registrarSeña} disabled={cobroSaving||!señaImporte} style={{flex:2,padding:"14px 0",borderRadius:999,border:0,background:cobroSaving||!señaImporte?T.ink+"55":T.ink,color:"#fff",fontFamily:T.sans,fontWeight:700,fontSize:14,cursor:cobroSaving||!señaImporte?"not-allowed":"pointer"}}>{cobroSaving?"Guardando…":"Confirmar cobro"}</button>
          </div>
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
    {/* MODAL RENTABILIDAD */}
    {showRent&&<div className="ov" onClick={()=>{setShowRent(false);setRentData(null);}}><div className="modal" style={{maxWidth:460}} onClick={e=>e.stopPropagation()}>
      <h3>💰 Rentabilidad — {sel?.nombre}</h3>
      {loadRent?<div className="loading"><div className="spin"/></div>
      :rentData?<>
        <div style={{fontSize:11,color:"#8A8580",marginBottom:12}}>📅 {sel?.fecha?new Date(sel.fecha+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"long",year:"numeric"}):"—"}</div>
        <div style={{background:"#F5F3F0",borderRadius:12,padding:14,marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:700,color:"#8A8580",textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>Ingresos</div>
          {rentData.precioFinca>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"4px 0"}}><span>Finca</span><strong>{Math.round(rentData.precioFinca).toLocaleString("es-ES")}€</strong></div>}
          {rentData.precioCasa>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"4px 0"}}><span>Casa</span><strong>{Math.round(rentData.precioCasa).toLocaleString("es-ES")}€</strong></div>}
          <div style={{display:"flex",justifyContent:"space-between",fontSize:14,fontWeight:700,padding:"6px 0",borderTop:"1px solid rgba(0,0,0,.06)",marginTop:4}}><span>TOTAL</span><strong style={{color:"#EC683E"}}>{Math.round(rentData.precioTotal).toLocaleString("es-ES")}€</strong></div>
        </div>
        <div style={{background:"#F5F3F0",borderRadius:12,padding:14,marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:700,color:"#8A8580",textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>Costes directos</div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"4px 0"}}><span>🧹 Limpieza ({rentData.nLimp})</span><strong>{Math.round(rentData.costeLimpieza).toLocaleString("es-ES")}€</strong></div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"4px 0"}}><span>🌿 Jardinería ({rentData.nJard})</span><strong>{Math.round(rentData.costeJardin).toLocaleString("es-ES")}€</strong></div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"4px 0"}}><span>🧺 Lavandería</span><strong>{Math.round(rentData.costeLavanderia).toLocaleString("es-ES")}€</strong></div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"4px 0"}}><span>🤝 Comisión {rentData.comisionPct}%</span><strong>{Math.round(rentData.comision).toLocaleString("es-ES")}€</strong></div>
          {rentData.otrosGastos>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"4px 0"}}><span>📋 Otros</span><strong>{Math.round(rentData.otrosGastos).toLocaleString("es-ES")}€</strong></div>}
          <div style={{display:"flex",justifyContent:"space-between",fontSize:14,fontWeight:700,padding:"6px 0",borderTop:"1px solid rgba(0,0,0,.06)",marginTop:4}}><span>TOTAL COSTES</span><strong style={{color:"#F35757"}}>{Math.round(rentData.totalCostes).toLocaleString("es-ES")}€</strong></div>
        </div>
        <div style={{background:rentData.beneficio>=0?"rgba(166,190,89,.08)":"rgba(243,87,87,.08)",borderRadius:12,padding:14,textAlign:"center"}}>
          <div style={{fontSize:22,fontWeight:800,color:rentData.beneficio>=0?"#A6BE59":"#F35757"}}>{Math.round(rentData.beneficio).toLocaleString("es-ES")}€</div>
          <div style={{fontSize:12,color:"#8A8580",marginTop:4}}>Beneficio neto · Margen {rentData.margen}%</div>
        </div>
        <div className="mft"><button className="btn bg" style={{width:"100%",justifyContent:"center"}} onClick={()=>{setShowRent(false);setRentData(null);}}>Cerrar</button></div>
      </>:<div style={{color:"#8A8580",fontSize:13,textAlign:"center",padding:20}}>No se pudieron cargar los datos</div>}
    </div></div>}

    {/* MODAL TIPO RESERVA */}
    {showTipoRes&&<div className="ov" onClick={()=>setShowTipoRes(false)}><div className="modal" style={{maxWidth:400}} onClick={e=>e.stopPropagation()}>
      <div style={{fontSize:16,fontWeight:700,color:T.ink,marginBottom:6}}>Nueva reserva</div>
      <div style={{fontSize:13,color:T.ink3,marginBottom:20}}>¿Qué tipo de reserva quieres crear?</div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <button onClick={()=>{setShowTipoRes(false);setPage?.("nueva-res");}} style={{width:"100%",padding:16,borderRadius:16,background:T.ink,color:"white",border:0,fontFamily:T.sans,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:40,height:40,borderRadius:10,background:"rgba(255,255,255,.15)",display:"flex",alignItems:"center",justifyContent:"center"}}><FmIcon name="calendar" size={20} stroke="white"/></div>
          <div style={{textAlign:"left"}}><div style={{fontSize:15,fontWeight:700}}>Evento</div><div style={{fontSize:11,opacity:.7,marginTop:1}}>Bodas, comuniones, cumpleaños...</div></div>
        </button>
        <button onClick={()=>{setShowTipoRes(false);setFormAb(abFormVacio);setShowFormAb(true);}} style={{width:"100%",padding:16,borderRadius:16,background:"#D9443A",color:"white",border:0,fontFamily:T.sans,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:40,height:40,borderRadius:10,background:"rgba(255,255,255,.15)",display:"flex",alignItems:"center",justifyContent:"center"}}><FmIcon name="home" size={20} stroke="white"/></div>
          <div style={{textAlign:"left"}}><div style={{fontSize:15,fontWeight:700}}>Airbnb</div><div style={{fontSize:11,opacity:.7,marginTop:1}}>Alojamiento de huéspedes</div></div>
        </button>
      </div>
      <button onClick={()=>setShowTipoRes(false)} style={{width:"100%",marginTop:12,padding:14,borderRadius:16,background:T.bg,border:0,color:T.ink3,fontFamily:T.sans,fontWeight:600,fontSize:13,cursor:"pointer"}}>Cancelar</button>
    </div></div>}

    {/* MODAL EDITAR PRECIOS */}
    {editPrecios&&sel&&<div className="ov" onClick={()=>setEditPrecios(false)}><div className="modal" style={{maxWidth:400}} onClick={e=>e.stopPropagation()}>
      <h3>Editar precios</h3>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <button onClick={()=>setFormPrecios(v=>({...v,incluye_casa:false}))} style={{flex:1,padding:"10px 0",borderRadius:12,border:`1px solid ${formPrecios.incluye_casa?T.line:T.ink}`,background:formPrecios.incluye_casa?T.surface:T.ink,color:formPrecios.incluye_casa?T.ink2:"white",fontFamily:T.sans,fontWeight:600,fontSize:13,cursor:"pointer"}}>Solo finca</button>
        <button onClick={()=>setFormPrecios(v=>({...v,incluye_casa:true}))} style={{flex:1,padding:"10px 0",borderRadius:12,border:`1px solid ${formPrecios.incluye_casa?T.ink:T.line}`,background:formPrecios.incluye_casa?T.ink:T.surface,color:formPrecios.incluye_casa?"white":T.ink2,fontFamily:T.sans,fontWeight:600,fontSize:13,cursor:"pointer"}}>Finca + Casa</button>
      </div>
      <div className="fg"><label>Precio finca (€)</label><input type="number" inputMode="decimal" className="fi" value={formPrecios.precio_finca} onChange={e=>setFormPrecios(v=>({...v,precio_finca:e.target.value}))}/></div>
      {formPrecios.incluye_casa&&<div className="fg"><label>Precio casa (€)</label><input type="number" inputMode="decimal" className="fi" value={formPrecios.precio_casa} onChange={e=>setFormPrecios(v=>({...v,precio_casa:e.target.value}))}/></div>}
      <div style={{display:"flex",justifyContent:"space-between",padding:"10px 14px",background:T.bg,borderRadius:12,marginBottom:20}}><span style={{fontSize:13,color:T.ink3}}>Total</span><span style={{fontSize:16,fontWeight:700,color:T.ink}}>{((parseFloat(formPrecios.precio_finca)||0)+(formPrecios.incluye_casa?parseFloat(formPrecios.precio_casa)||0:0)).toLocaleString("es-ES")}€</span></div>
      <div className="mft"><button className="btn bg" onClick={()=>setEditPrecios(false)}>Cancelar</button><button className="btn bp" onClick={async()=>{const total=(parseFloat(formPrecios.precio_finca)||0)+(formPrecios.incluye_casa?parseFloat(formPrecios.precio_casa)||0:0);await sbPatch("reservas",`id=eq.${sel.id}`,{precio_finca:parseFloat(formPrecios.precio_finca)||0,precio_casa:formPrecios.incluye_casa?parseFloat(formPrecios.precio_casa)||0:0,precio_total:total,precio:total,incluye_casa:formPrecios.incluye_casa},tok);setSel(prev=>({...prev,precio_finca:parseFloat(formPrecios.precio_finca)||0,precio_casa:formPrecios.incluye_casa?parseFloat(formPrecios.precio_casa)||0:0,precio_total:total,precio:total,incluye_casa:formPrecios.incluye_casa}));setEditPrecios(false);await load_();}}>Guardar precios</button></div>
    </div></div>}

    {/* MODAL NUEVA AIRBNB */}
    {showFormAb&&<div className="ov" onClick={()=>setShowFormAb(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <h3>🏠 Nueva reserva Airbnb</h3>
      <div className="fg"><label>Nombre del huésped *</label><input className="fi" value={formAb.huesped} onChange={e=>setFormAb(v=>({...v,huesped:e.target.value}))} placeholder="Nombre completo"/></div>
      <div className="g2">
        <div className="fg"><label>Fecha entrada *</label><input type="date" className="fi" value={formAb.fecha_entrada} onChange={e=>setFormAb(v=>({...v,fecha_entrada:e.target.value}))}/></div>
        <div className="fg"><label>Fecha salida *</label><input type="date" className="fi" value={formAb.fecha_salida} onChange={e=>setFormAb(v=>({...v,fecha_salida:e.target.value}))}/></div>
      </div>
      <div className="g2">
        <div className="fg"><label>Personas</label><input type="number" inputMode="numeric" className="fi" value={formAb.personas} onChange={e=>setFormAb(v=>({...v,personas:e.target.value}))} placeholder="2"/></div>
        <div className="fg"><label>Precio (€)</label><input type="number" inputMode="decimal" className="fi" value={formAb.precio} onChange={e=>setFormAb(v=>({...v,precio:e.target.value}))} placeholder="150"/></div>
      </div>
      <div className="fg"><label>Notas</label><textarea className="fi" rows={2} value={formAb.notas} onChange={e=>setFormAb(v=>({...v,notas:e.target.value}))} placeholder="Observaciones…"/></div>
      <div className="mft"><button className="btn bg" onClick={()=>setShowFormAb(false)}>Cancelar</button><button className="btn bp" onClick={crearAirbnb} disabled={savingAb||!formAb.huesped}>{savingAb?"Creando…":"🏠 Crear reserva"}</button></div>
    </div></div>}
  </div>;
}

// ─── COORDINACIÓN ───────────────────────────────────────────────────────────
async function obtenerProximaReserva(fecha,tok){
  const[re,ra]=await Promise.all([sbGet("reservas",`?fecha=gt.${fecha}&estado=neq.cancelada&incluye_casa=eq.true&select=fecha&order=fecha.asc&limit=1`,tok).catch(()=>[]),sbGet("reservas_airbnb",`?fecha_entrada=gt.${fecha}&select=fecha_entrada&order=fecha_entrada.asc&limit=1`,tok).catch(()=>[])]);
  const pe=re[0]?.fecha;const pa=ra[0]?.fecha_entrada;
  if(!pe&&!pa)return null;if(!pe)return pa;if(!pa)return pe;return pe<pa?pe:pa;
}
const TAREAS_JARDIN_PRE=[{txt:"Limpiar piscina (superficie + fondo)"},{txt:"Comprobar motor y luces de piscina"},{txt:"Limpiar hamacas de piscina"},{txt:"Limpiar zonas exteriores completas"},{txt:"Soplar y retirar hojas"},{txt:"Regar y revisar césped"},{txt:"Limpiar barbacoa"},{txt:"Ordenar utensilios barbacoa"},{txt:"Limpiar porches"},{txt:"Retirar basura exterior"},{txt:"Revisión visual general"}];
const TAREAS_JARDIN_POST_EXTRA=[{txt:"Retirar colillas del suelo"},{txt:"Limpiar ceniceros"},{txt:"Retirar vasos, bolsas y basura de invitados"},{txt:"Inspección visual de desperfectos"},{txt:"Comprobar invernadero"},{txt:"Revisión estado instalaciones"}];
const TAREAS_JARDIN_POST=[...TAREAS_JARDIN_PRE,...TAREAS_JARDIN_POST_EXTRA];

// No creates coordination at reservation time — motor handles everything
async function procesarCoordReserva(){}

async function ejecutarCoordInmediata(reservaId,fecha,tipoReserva,incluyeCasa,tok){
  try{
    const ventanaFin=new Date(new Date(fecha+"T15:00:00").getTime()-86400000).toISOString();
    const fechaFmt=new Date(fecha+"T12:00:00").toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"});
    const diasH=Math.ceil((new Date(fecha+"T12:00:00")-new Date())/(86400000));
    // Limpieza pre (airbnb or evento_casa)
    if(incluyeCasa||tipoReserva==="airbnb"){
      await sbPost("coordinacion_servicios",{tipo:"limpieza_pre",reserva_id:String(reservaId||""),tipo_reserva:tipoReserva,fecha_checkin_siguiente:fecha,ventana_inicio:new Date().toISOString(),ventana_fin:ventanaFin,estado:"preguntando_si_lista",notificacion_1_enviada:true},tok).catch(()=>{});
      const ops=await sbGet("operarios","?rol=eq.limpieza&activo=eq.true&select=id",SB_KEY).catch(()=>[]);
      for(const op of ops)await sbPost("notificaciones",{para:op.id,txt:`🏠 Reserva en ${diasH} día${diasH!==1?"s":""} (${fechaFmt}) — ¿Está la casa lista?`},tok).catch(()=>{});
      sendPush("🏠 Finca El Molino","Reserva próxima — ¿Está la casa lista?","coord-imm-limp");
    }
    // Jardín pre (always)
    await sbPost("coordinacion_servicios",{tipo:"jardin_pre",reserva_id:String(reservaId||""),tipo_reserva:tipoReserva,fecha_checkin_siguiente:fecha,ventana_inicio:new Date().toISOString(),ventana_fin:ventanaFin,estado:"preguntando_si_lista",notificacion_1_enviada:true},tok).catch(()=>{});
    const opsJ=await sbGet("operarios","?rol=eq.jardinero&activo=eq.true&select=id",SB_KEY).catch(()=>[]);
    for(const op of opsJ)await sbPost("notificaciones",{para:op.id,txt:`🌿 Reserva en ${diasH} día${diasH!==1?"s":""} (${fechaFmt}) — ¿Está el jardín listo?`},tok).catch(()=>{});
    sendPush("🌿 Finca El Molino","Reserva próxima — ¿Está el jardín listo?","coord-imm-jard");
  }catch(_){}
}

async function verificarConflictosNuevaReserva(fechaEntrada,tok){
  try{
    const fechaDiaAntes=new Date(new Date(fechaEntrada+"T12:00:00").getTime()-86400000).toISOString().split("T")[0];
    const coords=await sbGet("coordinacion_servicios",`?estado=eq.confirmado&fecha_programada=gte.${fechaDiaAntes}&fecha_programada=lte.${fechaEntrada}&select=*`,tok).catch(()=>[]);
    for(const c of coords){
      if(c.servicio_id)await sbPatch("servicios",`id=eq.${c.servicio_id}`,{estado:"cancelado"},tok).catch(()=>{});
      if(c.jardin_servicio_id)await sbPatch("jardin_servicios",`id=eq.${c.jardin_servicio_id}`,{estado:"cancelado"},tok).catch(()=>{});
      await sbPatch("coordinacion_servicios",`id=eq.${c.id}`,{estado:"servicio_creado_pendiente_fecha",fecha_programada:null},tok).catch(()=>{});
      const esL=c.tipo?.includes("limpieza");
      const ops=await sbGet("operarios",`?rol=eq.${esL?"limpieza":"jardinero"}&activo=eq.true&select=id`,SB_KEY).catch(()=>[]);
      for(const op of ops)await sbPost("notificaciones",{para:op.id,txt:`⚠️ Nueva reserva — el día que tenías programado ya no está disponible. Elige nuevo día.`},tok).catch(()=>{});
    }
  }catch(_){}
}

async function ejecutarMotorCoordinacion(tok){
  const fk=`fm_motor_coord_${new Date().toISOString().split("T")[0]}_${new Date().getHours()}`;
  if(localStorage.getItem(fk))return;localStorage.setItem(fk,"1");
  const hoy=new Date().toISOString().split("T")[0];
  const en3d=new Date(Date.now()+3*86400000).toISOString().split("T")[0];
  const manana=new Date(Date.now()+86400000).toISOString().split("T")[0];
  try{
    // ═══ OPERATIVA CHECKING (pre-llegada, 3 días antes) ═══
    const ab3=await sbGet("reservas_airbnb",`?fecha_entrada=eq.${en3d}&select=*`,tok).catch(()=>[]);
    const evCasa3=await sbGet("reservas",`?fecha=eq.${en3d}&incluye_casa=eq.true&estado=neq.cancelada&select=*`,tok).catch(()=>[]);
    const evFinca3=await sbGet("reservas",`?fecha=eq.${en3d}&incluye_casa=eq.false&estado=neq.cancelada&select=*`,tok).catch(()=>[]);
    // Limpieza pre — airbnb + eventos con casa
    for(const r of[...ab3.map(a=>({id:a.id,fecha:a.fecha_entrada,nombre:a.huesped,tipo:"airbnb"})),...evCasa3.map(e=>({id:e.id,fecha:e.fecha,nombre:e.nombre,tipo:"evento_casa"}))]){
      const ex=await sbGet("coordinacion_servicios",`?reserva_id=eq.${r.id}&tipo=eq.limpieza_pre&select=id`,tok).catch(()=>[]);
      if(ex.length>0)continue;
      const ventanaFin=new Date(new Date(r.fecha+"T15:00:00").getTime()-86400000).toISOString();
      await sbPost("coordinacion_servicios",{tipo:"limpieza_pre",reserva_id:String(r.id),tipo_reserva:r.tipo,fecha_checkin_siguiente:r.fecha,ventana_inicio:new Date().toISOString(),ventana_fin:ventanaFin,estado:"preguntando_si_lista",notificacion_1_enviada:true},tok).catch(()=>{});
      const fechaFmt=new Date(r.fecha+"T12:00:00").toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"});
      const ops=await sbGet("operarios","?rol=eq.limpieza&activo=eq.true&select=id",SB_KEY).catch(()=>[]);
      for(const op of ops)await sbPost("notificaciones",{para:op.id,txt:`🏠 Reserva en 3 días (${fechaFmt}) — ¿Está la casa lista?`},tok).catch(()=>{});
      sendPush("🏠 Finca El Molino","Reserva en 3 días — ¿Está la casa lista?","checking-limp");
    }
    // Jardín pre — ALL types (airbnb + eventos casa + eventos finca)
    for(const r of[...ab3.map(a=>({id:a.id,fecha:a.fecha_entrada,nombre:a.huesped,tipo:"airbnb"})),...evCasa3.map(e=>({id:e.id,fecha:e.fecha,nombre:e.nombre,tipo:"evento_casa"})),...evFinca3.map(e=>({id:e.id,fecha:e.fecha,nombre:e.nombre,tipo:"evento_finca"}))]){
      const ex=await sbGet("coordinacion_servicios",`?reserva_id=eq.${r.id}&tipo=eq.jardin_pre&select=id`,tok).catch(()=>[]);
      if(ex.length>0)continue;
      const ventanaFin=new Date(new Date(r.fecha+"T15:00:00").getTime()-86400000).toISOString();
      await sbPost("coordinacion_servicios",{tipo:"jardin_pre",reserva_id:String(r.id),tipo_reserva:r.tipo,fecha_checkin_siguiente:r.fecha,ventana_inicio:new Date().toISOString(),ventana_fin:ventanaFin,estado:"preguntando_si_lista",notificacion_1_enviada:true},tok).catch(()=>{});
      const fechaFmt=new Date(r.fecha+"T12:00:00").toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"});
      const ops=await sbGet("operarios","?rol=eq.jardinero&activo=eq.true&select=id",SB_KEY).catch(()=>[]);
      for(const op of ops)await sbPost("notificaciones",{para:op.id,txt:`🌿 Reserva en 3 días (${fechaFmt}) — ¿Está el jardín listo?`},tok).catch(()=>{});
      sendPush("🌿 Finca El Molino","Reserva en 3 días — ¿Está el jardín listo?","checking-jard");
    }

    // ═══ OPERATIVA CHECKOUT (post-salida, día del checkout) ═══
    const abHoy=await sbGet("reservas_airbnb",`?fecha_salida=eq.${hoy}&select=*`,tok).catch(()=>[]);
    const evHoy=await sbGet("reservas",`?fecha=eq.${hoy}&estado=neq.cancelada&select=*`,tok).catch(()=>[]);
    // Limpieza post — airbnb + eventos con casa
    for(const r of[...abHoy.map(a=>({id:a.id,fecha:a.fecha_salida,nombre:a.huesped,tipo:"airbnb"})),...evHoy.filter(e=>e.incluye_casa).map(e=>({id:e.id,fecha:e.fecha,nombre:e.nombre,tipo:"evento_casa"}))]){
      const ex=await sbGet("coordinacion_servicios",`?reserva_id=eq.${r.id}&tipo=eq.limpieza_post&select=id`,tok).catch(()=>[]);
      if(ex.length>0)continue;
      const prox=await obtenerProximaReserva(r.fecha,tok);
      const ventanaPreferida=new Date(new Date(r.fecha+"T13:00:00").getTime()+3*86400000).toISOString();
      const ventanaAbs=prox?new Date(new Date(prox+"T15:00:00").getTime()-86400000).toISOString():new Date(Date.now()+14*86400000).toISOString();
      // Create service automatically
      await crearLimpiezaAuto(`Limpieza post-${r.tipo==="airbnb"?"Airbnb":"evento"} — ${r.nombre}`,hoy,tok,"checkout",r.id);
      const[cL]=await sbPost("coordinacion_servicios",{tipo:"limpieza_post",reserva_id:String(r.id),tipo_reserva:r.tipo,fecha_checkout:r.fecha,fecha_checkin_siguiente:prox,ventana_inicio:new Date(r.fecha+"T13:00:00").toISOString(),ventana_fin:ventanaPreferida,ventana_absoluta:ventanaAbs,estado:"servicio_creado_pendiente_fecha"},tok).catch(()=>[{}]);
      const ops=await sbGet("operarios","?rol=eq.limpieza&activo=eq.true&select=id",SB_KEY).catch(()=>[]);
      for(const op of ops)await sbPost("notificaciones",{para:op.id,txt:`🧹 Checkout hoy — ¿Qué día harás la limpieza?`},tok).catch(()=>{});
      sendPush("🧹 Checkout hoy","Elige día para la limpieza","checkout-limp");
    }
    // Jardín post — airbnb + ALL events
    for(const r of[...abHoy.map(a=>({id:a.id,fecha:a.fecha_salida,nombre:a.huesped,tipo:"airbnb"})),...evHoy.map(e=>({id:e.id,fecha:e.fecha,nombre:e.nombre,tipo:e.incluye_casa?"evento_casa":"evento_finca"}))]){
      const ex=await sbGet("coordinacion_servicios",`?reserva_id=eq.${r.id}&tipo=eq.jardin_post&select=id`,tok).catch(()=>[]);
      if(ex.length>0)continue;
      const prox=await obtenerProximaReserva(r.fecha,tok);
      const ventanaPreferida=new Date(new Date(r.fecha+"T13:00:00").getTime()+3*86400000).toISOString();
      const ventanaAbs=prox?new Date(new Date(prox+"T15:00:00").getTime()-86400000).toISOString():new Date(Date.now()+14*86400000).toISOString();
      const esEv=r.tipo.includes("evento");const tJ=esEv?TAREAS_JARDIN_POST:TAREAS_JARDIN_PRE;
      const jds=await sbGet("jardineros","?activo=eq.true&select=*",tok).catch(()=>[]);const jd=jds[0]||null;
      const[srv]=await sbPost("jardin_servicios",{nombre:`Jardín post — ${r.nombre}`,fecha_inicio:hoy,fecha_fin:prox||hoy,jardinero_id:jd?.id||null,jardinero_nombre:jd?.nombre||"",estado:"activo",creado_por:"Sistema automático",reserva_vinculada_id:String(r.id)},tok).catch(()=>[{}]);
      if(srv?.id){for(const t of tJ)await sbPost("jardin_servicio_tareas",{servicio_id:srv.id,txt:t.txt,done:false},tok).catch(()=>{});}
      await sbPost("coordinacion_servicios",{tipo:"jardin_post",reserva_id:String(r.id),tipo_reserva:r.tipo,fecha_checkout:r.fecha,fecha_checkin_siguiente:prox,ventana_inicio:new Date(r.fecha+"T13:00:00").toISOString(),ventana_fin:ventanaPreferida,ventana_absoluta:ventanaAbs,jardin_servicio_id:srv?.id||null,estado:"servicio_creado_pendiente_fecha"},tok).catch(()=>{});
      const ops=await sbGet("operarios","?rol=eq.jardinero&activo=eq.true&select=id",SB_KEY).catch(()=>[]);
      for(const op of ops)await sbPost("notificaciones",{para:op.id,txt:`🌿 Checkout hoy — ¿Qué día harás el jardín?`},tok).catch(()=>{});
      sendPush("🌿 Checkout hoy","Elige día para el jardín","checkout-jard");
    }

    // ═══ URGENTE — mañana y sin confirmar ═══
    const urg=await sbGet("coordinacion_servicios",`?estado=in.(preguntando_si_lista,servicio_creado_pendiente_fecha)&fecha_checkin_siguiente=lte.${manana}&notificacion_urgente_enviada=is.null&select=*`,tok).catch(()=>[]);
    for(const c of urg){
      const esJ=c.tipo?.includes("jardin");const rol=esJ?"jardinero":"limpieza";
      const ops=await sbGet("operarios",`?rol=eq.${rol}&activo=eq.true&select=id`,SB_KEY).catch(()=>[]);
      for(const op of ops)await sbPost("notificaciones",{para:op.id,txt:`🚨 URGENTE: Reserva MAÑANA — ${esJ?"jardín":"limpieza"} no confirmad${esJ?"o":"a"}.`},tok).catch(()=>{});
      const adms=await sbGet("usuarios","?rol=eq.admin&select=id",tok).catch(()=>[]);
      for(const a of adms)await sbPost("notificaciones",{para:a.id,txt:`⚠️ Reserva mañana — ${esJ?"jardín":"limpieza"} sin confirmar`},tok).catch(()=>{});
      await sbPatch("coordinacion_servicios",`id=eq.${c.id}`,{notificacion_urgente_enviada:true},tok).catch(()=>{});
    }
  }catch(_){}
}

// ─── AUTO LIMPIEZA ──────────────────────────────────────────────────────────
async function crearLimpiezaAuto(nombre,fecha,tok,origen,reservaVinculadaId){
  try{
    const limps=await sbGet("limpiadoras","?activa=eq.true&select=*",tok).catch(()=>[]);
    const limp=limps[0]||null;
    const srvData={nombre,fecha,creado_por:"Sistema automático",limpiadora_id:limp?.id||null,limpiadora_nombre:limp?.nombre||null};
    if(reservaVinculadaId)srvData.reserva_vinculada_id=String(reservaVinculadaId);
    const[srv]=await sbPost("servicios",srvData,tok);
    for(const zona of LIMP_ZONAS){const ts=[...(zona.tareas||[]),...(zona.subzonas?zona.subzonas.flatMap(s=>s.tareas):[])];for(const t of ts)await sbPost("servicio_tareas",{servicio_id:srv.id,tarea_id:t.id,zona:zona.nombre,es_extra:false,done:false},tok).catch(()=>{});}
    const admIds=await getUserIdsPorRol("admin",tok);
    const msg=`🧹 Limpieza programada: ${nombre}`;
    for(const id of admIds)await sbPost("notificaciones",{para:id,txt:msg},tok).catch(()=>{});
    if(limp?.operario_id)await sbPost("notificaciones",{para:limp.operario_id,txt:msg},tok).catch(()=>{});
    sendPush("🧹 Limpieza programada",msg,"auto-limpieza");
  }catch(_){}
}
async function crearLimpiezaPostEvento(reserva,tok){
  const f=new Date(reserva.fecha+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"long"});
  await crearLimpiezaAuto(`Limpieza post-evento — ${reserva.nombre} — ${f}`,reserva.fecha,tok,"evento");
}
async function crearLimpiezaPostAirbnb(airbnb,tok){
  const f=new Date(airbnb.fecha_salida+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"long"});
  await crearLimpiezaAuto(`Limpieza post-Airbnb — ${airbnb.huesped} — ${f}`,airbnb.fecha_salida,tok,"airbnb");
}

function NuevaReserva({perfil,tok,setPage,rol}){
  const [form,setForm]=useState({nombre:"",fecha:"",tipo:"Boda",precio_finca:"",precio_casa:"",incluye_casa:false,contacto:"",obs:"",estado:"visita"});
  const [ok,setOk]=useState(false);const [saving,setSaving]=useState(false);
  const tipos=["Boda","Cumpleaños","Comunión","Bautizo","Aniversario","Empresa","Otro"];
  const [bloqueadoR,setBloqueadoR]=useState(null);
  const [sugJardin,setSugJardin]=useState(null);
  const precioTotal=(parseFloat(form.precio_finca)||0)+(form.incluye_casa?parseFloat(form.precio_casa)||0:0);

  const submit=async()=>{
    if(!form.nombre||!form.fecha||saving)return;setSaving(true);
    try{
      const disp=await checkDisponibilidad(form.fecha,tok);
      if(!disp.libre){setSaving(false);setBloqueadoR(disp.conflictos);return;}
      const [res]=await sbPost("reservas",{nombre:form.nombre,fecha:form.fecha,tipo:form.tipo,incluye_casa:form.incluye_casa,precio_finca:parseFloat(form.precio_finca)||0,precio_casa:form.incluye_casa?parseFloat(form.precio_casa)||0:0,precio_total:precioTotal,precio:precioTotal,contacto:form.contacto,obs:form.obs,estado:form.estado,creado_por:perfil.id,bloqueo_dia_anterior:form.incluye_casa||false,bloqueo_dia_posterior:form.incluye_casa||false},tok);
      await addHistorial("reserva",res.id,`Reserva creada por ${perfil.nombre}`,perfil.nombre,tok);
      if(rol!=="admin"){const admIds=await getUserIdsPorRol("admin",tok);registrarItemNuevo("reserva",res.id,admIds,tok);}
      const en7=new Date();en7.setDate(en7.getDate()+7);
      if(form.fecha&&form.fecha<=en7.toISOString().split("T")[0])notificarRoles(["admin","comercial","limpieza","jardinero"],"🎉 Nuevo evento",`${form.nombre} el ${new Date(form.fecha+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"long"})}`,"evento-nuevo",tok);
      // Coordinación inmediata si ≤3 días
      const diasHastaEv=Math.ceil((new Date(form.fecha+"T12:00:00")-new Date())/(86400000));
      if(diasHastaEv<=3)await ejecutarCoordInmediata(res.id,form.fecha,form.incluye_casa?"evento_casa":"evento_finca",form.incluye_casa,tok);
      await verificarConflictosNuevaReserva(form.fecha,tok);
      // AUTO 5 — sugerir jardinería si >14 días
      const diasHasta=Math.ceil((new Date(form.fecha)-new Date())/(86400000));
      if(diasHasta>14)setSugJardin({nombre:form.nombre,fecha:form.fecha,fechaSug:new Date(new Date(form.fecha).getTime()-2*86400000).toISOString().split("T")[0]});
      setOk(true);setTimeout(()=>{if(!sugJardin){setOk(false);setPage("reservas");}},2000);
      setForm({nombre:"",fecha:"",tipo:"Boda",precio_finca:"",precio_casa:"",incluye_casa:false,contacto:"",obs:"",estado:"visita"});
    }catch(_){}setSaving(false);
  };
  return <>
    <div style={{padding:"28px 32px 16px"}}><div style={{fontSize:12,color:T.ink3,fontWeight:500}}>Crear evento</div><div style={{fontSize:28,fontWeight:700,color:T.ink,letterSpacing:-.8,lineHeight:1.02,marginTop:2}}>Nueva reserva</div></div>
    <div className="pb"><div style={{maxWidth:600}}>
      {ok&&<div style={{background:"rgba(16,185,129,.1)",border:"1px solid rgba(16,185,129,.3)",borderRadius:10,padding:"12px 15px",marginBottom:16,color:"#A6BE59",fontSize:13}}>✅ Reserva creada. Redirigiendo…</div>}
      <div className="card">
        <div className="fg"><label>Nombre del cliente *</label><input className="fi" value={form.nombre} onChange={e=>setForm(v=>({...v,nombre:e.target.value}))} placeholder="Ej: María y Carlos García"/></div>
        <div className="g2"><div className="fg"><label>Fecha *</label><input type="date" className="fi" value={form.fecha} onChange={e=>setForm(v=>({...v,fecha:e.target.value}))}/></div><div className="fg"><label>Tipo</label><select className="fi" value={form.tipo} onChange={e=>setForm(v=>({...v,tipo:e.target.value}))}>{tipos.map(t=><option key={t}>{t}</option>)}</select></div></div>
        <div style={{display:"flex",gap:8,marginBottom:14}}>
          <button className={`btn sm${!form.incluye_casa?" bp":" bg"}`} onClick={()=>setForm(v=>({...v,incluye_casa:false}))}>Solo finca</button>
          <button className={`btn sm${form.incluye_casa?" bp":" bg"}`} onClick={()=>setForm(v=>({...v,incluye_casa:true}))}>Finca + Casa</button>
        </div>
        <div className="g2">
          <div className="fg"><label>Precio finca (€)</label><input type="number" inputMode="numeric" className="fi" value={form.precio_finca} onChange={e=>setForm(v=>({...v,precio_finca:e.target.value}))} placeholder="0"/></div>
          {form.incluye_casa&&<div className="fg"><label>Precio casa (€)</label><input type="number" inputMode="numeric" className="fi" value={form.precio_casa} onChange={e=>setForm(v=>({...v,precio_casa:e.target.value}))} placeholder="0"/></div>}
        </div>
        {precioTotal>0&&<div style={{fontSize:14,fontWeight:700,color:"#EC683E",marginBottom:14}}>Total: {precioTotal.toLocaleString("es-ES")}€</div>}
        <div className="g2"><div className="fg"><label>Contacto</label><input className="fi" type="tel" inputMode="tel" value={form.contacto} onChange={e=>setForm(v=>({...v,contacto:e.target.value}))} placeholder="600 000 000"/></div></div>
        <div className="fg"><label>Estado inicial</label><select className="fi" value={form.estado} onChange={e=>setForm(v=>({...v,estado:e.target.value}))}>{ESTADOS.map(e=><option key={e.id} value={e.id}>{e.lbl}</option>)}</select></div>
        <div className="fg"><label>Observaciones</label><textarea className="fi" rows={3} value={form.obs} onChange={e=>setForm(v=>({...v,obs:e.target.value}))} placeholder="Notas, menú, decoración…"/></div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><button className="btn bg" onClick={()=>setPage("reservas")}>Cancelar</button><button className="btn bp" onClick={submit} disabled={saving}>✓ Crear reserva</button></div>
      </div>
    </div></div>
    {bloqueadoR&&<ModalOcupado fecha={form.fecha} conflictos={bloqueadoR} tipoAccion="reserva" perfil={perfil} tok={tok} onCerrar={()=>setBloqueadoR(null)} onForzar={()=>setBloqueadoR(null)}/>}
    {sugJardin&&<div style={{position:"fixed",bottom:80,left:"50%",transform:"translateX(-50%)",background:"#FFFFFF",borderRadius:14,padding:"14px 20px",boxShadow:"0 8px 32px rgba(0,0,0,.12)",zIndex:9999,maxWidth:"90vw",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
      <span style={{fontSize:13,color:"#1A1A1A"}}>🌿 ¿Programar jardinería 2 días antes del evento?</span>
      <button className="btn bp sm" onClick={()=>{setSugJardin(null);setPage("jadmin");}}>Sí, programar</button>
      <button className="btn bg sm" onClick={()=>{setSugJardin(null);setPage("reservas");}}>No</button>
    </div>}
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

// ─── CONTACTOS ──────────────────────────────────────────────────────────────
async function crearContactoDesdeAirbnb(airbnb,tok,perfil){
  try{
    const existente=await sbGet("contactos",`?nombre=eq.${encodeURIComponent(airbnb.huesped)}&tipo_evento=eq.airbnb&select=id`,tok).catch(()=>[]);
    let cid;
    if(existente.length>0){cid=existente[0].id;}
    else{const[c]=await sbPost("contactos",{nombre:airbnb.huesped,telefono:airbnb.telefono||null,email:airbnb.email||null,origen:"airbnb",tipo_evento:"airbnb",estado:"cliente",notas:`Primera reserva: ${airbnb.fecha_entrada} → ${airbnb.fecha_salida}`,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),asignado_a:perfil?.id,asignado_nombre:perfil?.nombre},tok).catch(()=>[{}]);cid=c?.id;}
    if(cid&&airbnb.id)await sbPatch("reservas_airbnb",`id=eq.${airbnb.id}`,{contacto_id:cid},tok).catch(()=>{});
    return cid;
  }catch(_){return null;}
}
async function sincronizarContacto(contactoId,cambios,tok){
  const u={};if(cambios.nombre)u.nombre=cambios.nombre;if(cambios.telefono)u.telefono=cambios.telefono;
  if(Object.keys(u).length>0){
    await sbPatch("visitas",`contacto_id=eq.${contactoId}`,u,tok).catch(()=>{});
    if(cambios.nombre){
      await sbPatch("reservas",`contacto_id=eq.${contactoId}`,{nombre:cambios.nombre},tok).catch(()=>{});
      await sbPatch("reservas_airbnb",`contacto_id=eq.${contactoId}`,{huesped:cambios.nombre},tok).catch(()=>{});
    }
  }
}
async function autoInteraccion(contactoId,tipo,resumen,resultado,tok,creador){
  if(!contactoId||!tok)return;
  try{
    await sbPost("contacto_interacciones",{contacto_id:contactoId,tipo:tipo||"nota",direccion:"salida",fecha:new Date().toISOString(),resumen,resultado:resultado||"neutro",creado_por:creador||"Sistema"},tok);
    await sbPatch("contactos",`id=eq.${contactoId}`,{updated_at:new Date().toISOString()},tok);
  }catch(_){}
}
async function getContactoDeEntidad(entidad_tipo,entidad_id,tok){
  if(!entidad_tipo||!entidad_id)return null;
  const tbl=entidad_tipo==="visita"?"visitas":entidad_tipo==="reserva"?"reservas":entidad_tipo==="airbnb"?"reservas_airbnb":null;
  if(!tbl)return null;
  const r=await sbGet(tbl,`?id=eq.${entidad_id}&select=contacto_id`,tok).catch(()=>[]);
  return r[0]?.contacto_id||null;
}
const ICONOS_INTERACCION={llamada:"📞",whatsapp:"💬",email:"📧",visita_finca:"🏠",reunion:"🤝",nota:"📝"};
const ESTADO_CONTACTO={lead:{lbl:"Lead",col:"#7FB2FF",ico:"🔵"},visitante:{lbl:"Visitante",col:"#D4A017",ico:"🟡"},cliente:{lbl:"Cliente",col:"#A6BE59",ico:"🟢"},recurrente:{lbl:"Recurrente",col:"#EC683E",ico:"⭐"},perdido:{lbl:"Perdido",col:"#6b7280",ico:"⚫"}};

const CSC={lead:{c:T.ink3,bg:T.ink4+"33"},visitante:{c:"#9B8324",bg:T.gold+"33"},cliente:{c:"#5A8A3E",bg:T.olive+"33"},recurrente:{c:T.terracotta,bg:T.terracotta+"22"},perdido:{c:T.ink,bg:"#E4E0D5"}};
function Contactos({perfil,tok,rol,setPage}){
  const isA=rol==="admin",isC=rol==="comercial";
  const hoy=new Date().toISOString().split("T")[0];
  const[contactos,setContactos]=useState([]);const[load,setLoad]=useState(true);const[saving,setSaving]=useState(false);
  const[filtro,setFiltro]=useState("todos");const[busqueda,setBusqueda]=useState("");
  const[sel,setSel]=useState(null);const[tabDet,setTabDet]=useState("resumen");
  const[showForm,setShowForm]=useState(false);const[editando,setEditando]=useState(false);
  const[interacciones,setInteracciones]=useState([]);const[visitasC,setVisitasC]=useState([]);const[reservasC,setReservasC]=useState([]);const[airbnbsC,setAirbnbsC]=useState([]);const[tareasP,setTareasP]=useState([]);
  const[showInter,setShowInter]=useState(false);
  const[showVisita,setShowVisita]=useState(false);
  const[showEstado,setShowEstado]=useState(false);
  const[showMenuC,setShowMenuC]=useState(false);

  const formVacio={nombre:"",telefono:"",email:"",origen:"directo",tipo_evento:"boda",estado:"lead",fecha_evento_prevista:"",mes_evento_previsto:"",anio_evento_previsto:"",presupuesto_estimado:"",notas:"",asignado_a:perfil?.id,asignado_nombre:perfil?.nombre};
  const[form,setForm]=useState(formVacio);
  const formInterVacio={tipo:"llamada",direccion:"salida",fecha:hoy,resumen:"",resultado:"neutro"};
  const[formInter,setFormInter]=useState(formInterVacio);
  const formVisVacio={nombre:"",fecha:hoy,hora:"10:00",tipo_evento:"Boda",invitados:"",telefono:"",email:"",nota:"",fecha_evento_prevista:"",contacto_id:""};
  const[formVis,setFormVis]=useState(formVisVacio);

  const cargar=async()=>{
    try{const c=await sbGet("contactos","?select=*&order=updated_at.desc",tok);setContactos(c);}catch(_){}setLoad(false);
  };
  useEffect(()=>{cargar();},[]);

  const cargarDetalle=async(c)=>{
    setSel(c);setTabDet("resumen");
    const[inter,vis,res,abs]=await Promise.all([
      sbGet("contacto_interacciones",`?contacto_id=eq.${c.id}&select=*&order=fecha.desc&limit=50`,tok).catch(()=>[]),
      sbGet("visitas",`?contacto_id=eq.${c.id}&select=*&order=fecha.desc`,tok).catch(()=>[]),
      sbGet("reservas",`?contacto_id=eq.${c.id}&select=*&order=fecha.desc`,tok).catch(()=>[]),
      sbGet("reservas_airbnb",`?contacto_id=eq.${c.id}&select=*&order=fecha_entrada.desc`,tok).catch(()=>[]),
    ]);
    setInteracciones(inter);setVisitasC(vis);setReservasC(res);setAirbnbsC(abs);
    // Cargar tareas pendientes vinculadas a visitas/reservas de este contacto
    const entIds=[...vis.map(v=>v.id),...res.map(r=>r.id)].filter(Boolean);
    if(entIds.length>0){const tp=await sbGet("tareas_comerciales",`?entidad_id=in.(${entIds.join(",")})&estado=eq.pendiente&select=*`,tok).catch(()=>[]);setTareasP(tp);}else{setTareasP([]);}
  };

  const guardar=async()=>{
    if(!form.nombre||saving)return;setSaving(true);
    try{
      const fep=form.fecha_evento_prevista||null;
      const mep=fep?new Date(fep+"T12:00:00").getMonth()+1:(form.mes_evento_previsto?parseInt(form.mes_evento_previsto):null);
      const aep=fep?new Date(fep+"T12:00:00").getFullYear():(form.anio_evento_previsto?parseInt(form.anio_evento_previsto):null);
      const body={...form,fecha_evento_prevista:fep,mes_evento_previsto:mep,anio_evento_previsto:aep,presupuesto_estimado:parseFloat(form.presupuesto_estimado)||null,updated_at:new Date().toISOString()};
      if(editando&&sel){
        await sbPatch("contactos",`id=eq.${sel.id}`,body,tok);
        await sincronizarContacto(sel.id,{nombre:form.nombre,telefono:form.telefono},tok);
        await cargarDetalle({...sel,...body});
      }else{
        body.created_at=new Date().toISOString();
        const[c]=await sbPost("contactos",body,tok);
        if(c)await cargarDetalle(c);
      }
      setShowForm(false);setEditando(false);await cargar();
    }catch(_){}setSaving(false);
  };

  const cambiarEstado=async(contacto,nuevoEstado)=>{
    const update={estado:nuevoEstado,updated_at:new Date().toISOString()};
    if(nuevoEstado==="perdido"){const motivo=window.prompt("¿Motivo por el que se perdió el contacto?");if(motivo)update.motivo_perdido=motivo;else if(motivo===null)return;}
    await sbPatch("contactos",`id=eq.${contacto.id}`,update,tok);
    await sbPost("contacto_interacciones",{contacto_id:contacto.id,tipo:"nota",fecha:new Date().toISOString(),resumen:`Estado cambiado a: ${nuevoEstado}${update.motivo_perdido?" — "+update.motivo_perdido:""}`,resultado:"neutro",creado_por:perfil.nombre},tok).catch(()=>{});
    setShowEstado(false);await cargar();if(sel)await cargarDetalle({...contacto,...update});
  };

  const registrarInteraccion=async()=>{
    if(!sel||!formInter.resumen||saving)return;setSaving(true);
    try{
      await sbPost("contacto_interacciones",{contacto_id:sel.id,tipo:formInter.tipo,direccion:formInter.direccion,fecha:formInter.fecha+"T"+new Date().toTimeString().slice(0,5)+":00",resumen:formInter.resumen,resultado:formInter.resultado,creado_por:perfil.nombre},tok);
      await sbPatch("contactos",`id=eq.${sel.id}`,{updated_at:new Date().toISOString()},tok);
      setShowInter(false);setFormInter(formInterVacio);await cargarDetalle(sel);await cargar();
    }catch(_){}setSaving(false);
  };

  const programarVisita=async()=>{
    if(!sel||!formVis.fecha||!formVis.hora||saving)return;setSaving(true);
    try{
      const fep=formVis.fecha_evento_prevista||null;
      const mep=fep?new Date(fep+"T12:00:00").getMonth()+1:null;
      const aep=fep?new Date(fep+"T12:00:00").getFullYear():null;
      const[v]=await sbPost("visitas",{nombre:formVis.nombre,fecha:formVis.fecha,hora:formVis.hora,tipo_evento:formVis.tipo_evento,invitados:parseInt(formVis.invitados)||null,telefono:formVis.telefono,email:formVis.email,nota:formVis.nota,fecha_evento_prevista:fep,mes_evento_previsto:mep,anio_evento_previsto:aep,estado:"pendiente",creado_por:perfil.nombre,contacto_id:sel.id},tok);
      if(sel.estado==="lead")await sbPatch("contactos",`id=eq.${sel.id}`,{estado:"visitante",updated_at:new Date().toISOString()},tok);
      await sbPost("contacto_interacciones",{contacto_id:sel.id,tipo:"visita_finca",fecha:formVis.fecha+"T"+(formVis.hora||"10:00")+":00",resumen:`Visita programada para el ${formVis.fecha}`,resultado:"neutro",creado_por:perfil.nombre},tok).catch(()=>{});
      setShowVisita(false);await cargarDetalle({...sel,estado:sel.estado==="lead"?"visitante":sel.estado});await cargar();
    }catch(_){}setSaving(false);
  };

  const abrirEditar=()=>{setForm({nombre:sel.nombre,telefono:sel.telefono||"",email:sel.email||"",origen:sel.origen||"directo",tipo_evento:sel.tipo_evento||"boda",estado:sel.estado||"lead",fecha_evento_prevista:sel.fecha_evento_prevista||"",mes_evento_previsto:sel.mes_evento_previsto?""+sel.mes_evento_previsto:"",anio_evento_previsto:sel.anio_evento_previsto?""+sel.anio_evento_previsto:"",presupuesto_estimado:sel.presupuesto_estimado?""+sel.presupuesto_estimado:"",notas:sel.notas||"",asignado_a:sel.asignado_a||perfil?.id,asignado_nombre:sel.asignado_nombre||perfil?.nombre});setEditando(true);setShowForm(true);};

  const abrirVisitaDesdeContacto=()=>{setFormVis({nombre:sel.nombre,fecha:hoy,hora:"10:00",tipo_evento:sel.tipo_evento==="boda"?"Boda":sel.tipo_evento==="comunion"?"Comunión":sel.tipo_evento==="empresa"?"Empresa":sel.tipo_evento||"Boda",invitados:"",telefono:sel.telefono||"",email:sel.email||"",nota:sel.notas||"",fecha_evento_prevista:sel.fecha_evento_prevista||"",contacto_id:sel.id});setShowVisita(true);};

  const tiempoDesde=(fecha)=>{if(!fecha)return"—";const d=Math.floor((Date.now()-new Date(fecha).getTime())/86400000);return d===0?"hoy":d===1?"ayer":`hace ${d} días`;};

  const filtrados=contactos.filter(c=>{
    if(filtro!=="todos"&&c.estado!==filtro)return false;
    if(busqueda){const q=busqueda.toLowerCase();return(c.nombre||"").toLowerCase().includes(q)||(c.telefono||"").includes(q)||(c.email||"").toLowerCase().includes(q);}
    return true;
  });

  if(load)return <div className="loading"><div className="spin"/><span>Cargando…</span></div>;
  const fmtEur=v=>(Math.round(parseFloat(v)||0)).toLocaleString("es-ES")+"€";

  // ─── DETALLE ──
  if(sel&&!showForm&&!showInter&&!showVisita)return <div style={{position:"relative",background:T.bg,minHeight:"100%",overflow:"auto",paddingBottom:24}}>
    {/* Hero */}
    <div style={{background:`linear-gradient(145deg, ${T.olive} 0%, #8DA44A 100%)`,paddingTop:54,paddingBottom:20,paddingLeft:20,paddingRight:20}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
        <button onClick={()=>setSel(null)} style={{width:36,height:36,borderRadius:999,background:"rgba(255,255,255,.18)",border:0,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><FmIcon name="chevL" size={16} stroke="white"/></button>
        <div style={{display:"flex",gap:8}}>
          <button onClick={abrirEditar} style={{width:36,height:36,borderRadius:999,background:"rgba(255,255,255,.18)",border:0,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><FmIcon name="edit" size={15} stroke="white"/></button>
          <button onClick={()=>setShowMenuC(true)} style={{width:36,height:36,borderRadius:999,background:"rgba(255,255,255,.18)",border:0,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><FmIcon name="more" size={15} stroke="white"/></button>
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <div style={{width:54,height:54,borderRadius:999,background:"rgba(255,255,255,.25)",color:"white",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:700}}>{sel.nombre?.split(" ").map(p=>p[0]).slice(0,2).join("").toUpperCase()||"??"}</div>
        <div>
          <div style={{fontSize:10,color:"rgba(255,255,255,.7)",letterSpacing:1,textTransform:"uppercase",fontWeight:500}}>{sel.estado?.charAt(0).toUpperCase()+sel.estado?.slice(1)||"Lead"}{sel.created_at?` · desde ${new Date(sel.created_at).toLocaleDateString("es-ES",{month:"short",year:"numeric"})}`:""}</div>
          <div style={{fontSize:24,color:"white",letterSpacing:-.6,lineHeight:1.1,fontWeight:700,marginTop:2}}>{sel.nombre}</div>
          {sel.tipo_evento&&sel.fecha_evento_prevista&&<div style={{fontSize:12,color:"rgba(255,255,255,.8)",marginTop:2}}>{sel.tipo_evento} · {new Date(sel.fecha_evento_prevista+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"long",year:"numeric"})}</div>}
        </div>
      </div>
      <div style={{display:"flex",gap:8,marginTop:16}}>
        {[{icon:"phone",label:"Llamar",action:()=>sel.telefono&&window.open("tel:"+sel.telefono)},{icon:"mail",label:"Email",action:()=>sel.email&&window.open("mailto:"+sel.email)}].map((b,i)=><button key={i} onClick={b.action} style={{flex:1,padding:"10px 0",borderRadius:16,background:"rgba(255,255,255,.18)",border:0,color:"white",display:"flex",flexDirection:"column",alignItems:"center",gap:4,cursor:"pointer",fontFamily:T.sans}}><FmIcon name={b.icon} size={16} stroke="white"/><span style={{fontSize:11,fontWeight:600}}>{b.label}</span></button>)}
      </div>
    </div>
    {/* Tabs */}
    <div style={{display:"flex",background:T.surface,borderBottom:`1px solid ${T.line}`,position:"sticky",top:0,zIndex:5}}>
      {["Resumen","Interacciones","Visitas","Reservas"].map(t=>{const on=tabDet===t.toLowerCase();return<button key={t} onClick={()=>setTabDet(t.toLowerCase())} style={{flex:1,padding:"13px 0",border:0,background:"transparent",fontFamily:T.sans,fontSize:12,fontWeight:on?600:500,color:on?T.ink:T.ink3,cursor:"pointer",position:"relative"}}>{t}{on&&<span style={{position:"absolute",bottom:0,left:"25%",right:"25%",height:2,background:T.terracotta,borderRadius:2}}/>}</button>;})}
    </div>
    {/* Tab content */}
    <div style={{padding:16}}>
      {tabDet==="resumen"&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div style={{background:T.surface,borderRadius:16,padding:14,border:`1px solid ${T.line}`}}>
          <div style={{fontSize:10,color:T.ink3,letterSpacing:1,textTransform:"uppercase",fontWeight:600,marginBottom:10}}>Datos</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {[{label:"Teléfono",value:sel.telefono,icon:"phone"},{label:"Email",value:sel.email,icon:"mail"},{label:"Origen",value:sel.origen,icon:"search"},{label:"Asignado a",value:sel.asignado_nombre,icon:"users"}].filter(f=>f.value).map((f,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:30,height:30,borderRadius:8,background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><FmIcon name={f.icon} size={14} stroke={T.ink2}/></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:10,color:T.ink3,letterSpacing:.3,textTransform:"uppercase"}}>{f.label}</div><div style={{fontSize:13,color:T.ink,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.value}</div></div></div>)}
          </div>
        </div>
        {(sel.tipo_evento||sel.presupuesto_estimado)&&<div style={{background:T.surface,borderRadius:16,padding:14,border:`1px solid ${T.line}`}}>
          <div style={{fontSize:10,color:T.ink3,letterSpacing:1,textTransform:"uppercase",fontWeight:600,marginBottom:10}}>Evento</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {sel.tipo_evento&&<div><div style={{fontSize:10,color:T.ink3,textTransform:"uppercase",fontWeight:500}}>Tipo</div><div style={{fontSize:18,color:T.ink,fontWeight:700,lineHeight:1.2,marginTop:2}}>{sel.tipo_evento}</div></div>}
            {sel.fecha_evento_prevista&&<div><div style={{fontSize:10,color:T.ink3,textTransform:"uppercase",fontWeight:500}}>Fecha</div><div style={{fontSize:18,color:T.terracotta,fontWeight:700,lineHeight:1.2,marginTop:2}}>{new Date(sel.fecha_evento_prevista+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short",year:"numeric"})}</div></div>}
            {sel.presupuesto_estimado&&<div><div style={{fontSize:10,color:T.ink3,textTransform:"uppercase",fontWeight:500}}>Presupuesto</div><div style={{fontSize:18,color:T.olive,fontWeight:700,lineHeight:1.2,marginTop:2}}>{fmtEur(sel.presupuesto_estimado)}</div></div>}
          </div>
        </div>}
        {tareasP[0]&&<div style={{background:"#FEF8F3",borderRadius:16,padding:14,border:`1px solid ${T.terracotta}33`}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}><FmIcon name="warn" size={14} stroke={T.terracotta}/><span style={{fontSize:11,fontWeight:600,color:T.terracotta,letterSpacing:.2,textTransform:"uppercase"}}>Próxima acción</span></div>
          <div style={{fontSize:13,color:T.ink,fontWeight:500}}>{tareasP[0].titulo}</div>
          {tareasP[0].fecha_limite&&<div style={{fontSize:11,color:T.ink2,marginTop:4}}>Vence: {new Date(tareasP[0].fecha_limite+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"long"})}</div>}
        </div>}
        {sel.notas&&<div style={{background:T.surface,borderRadius:16,padding:14,border:`1px solid ${T.line}`,fontSize:13,color:T.ink}}>{sel.notas}</div>}
      </div>}

      {tabDet==="interacciones"&&<div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <span style={{fontSize:11,color:T.ink3,letterSpacing:1,textTransform:"uppercase",fontWeight:600}}>Historial · {interacciones.length}</span>
          <button onClick={()=>{setFormInter(formInterVacio);setShowInter(true);}} style={{background:T.ink,color:"white",border:0,padding:"6px 10px",borderRadius:999,fontSize:11,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:4,fontFamily:T.sans}}><FmIcon name="plus" size={12} stroke="white"/> Registrar</button>
        </div>
        <div style={{position:"relative",paddingLeft:30}}>
          <div style={{position:"absolute",left:15,top:14,bottom:14,width:1.5,background:T.line,borderRadius:1}}/>
          {interacciones.map(it=>{const tipoCol={llamada:T.softBlue,whatsapp:T.olive,email:T.lavender,visita_finca:T.gold,reunion:T.terracotta,nota:T.ink3};const tipoIco={llamada:"phone",whatsapp:"phone",email:"mail",visita_finca:"home",reunion:"users",nota:"edit"};const color=tipoCol[it.tipo]||T.ink3;const icon=tipoIco[it.tipo]||"edit";const resCol={positivo:T.olive,negativo:T.danger,sin_respuesta:T.gold,neutro:T.ink3};
            return<div key={it.id} style={{position:"relative",marginBottom:12}}>
              <div style={{position:"absolute",left:-30,top:4,width:30,height:30,borderRadius:999,background:color+"22",color,display:"flex",alignItems:"center",justifyContent:"center",border:`3px solid ${T.bg}`}}><FmIcon name={icon} size={13} stroke={color} sw={2}/></div>
              <div style={{background:T.surface,borderRadius:12,padding:11,border:`1px solid ${T.line}`}}>
                <div style={{display:"flex",justifyContent:"space-between",gap:8,marginBottom:3}}><span style={{fontSize:12,fontWeight:600,color:T.ink,letterSpacing:-.1}}>{it.tipo?.charAt(0).toUpperCase()+it.tipo?.slice(1).replace("_"," ")}</span><span style={{fontSize:10,color:T.ink3,whiteSpace:"nowrap"}}>{it.fecha?new Date(it.fecha).toLocaleDateString("es-ES",{day:"numeric",month:"short"}):""}</span></div>
                {it.resumen&&<div style={{fontSize:11,color:T.ink2,marginBottom:6}}>{it.resumen}</div>}
                {it.resultado&&<span style={{display:"inline-flex",alignItems:"center",gap:4,height:20,padding:"0 8px",borderRadius:999,background:(resCol[it.resultado]||T.ink3)+"22",color:resCol[it.resultado]||T.ink3,fontSize:10,fontWeight:600}}>{it.resultado}</span>}
              </div>
            </div>;})}
          {interacciones.length===0&&<div style={{color:T.ink3,fontSize:13,textAlign:"center",padding:"20px 0"}}>Sin interacciones</div>}
        </div>
      </div>}

      {tabDet==="visitas"&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
        <button onClick={abrirVisitaDesdeContacto} style={{width:"100%",padding:"12px 0",borderRadius:999,border:`1px solid ${T.line}`,background:T.surface,color:T.ink,fontFamily:T.sans,fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}><FmIcon name="plus" size={14} stroke={T.ink}/> Programar visita</button>
        {visitasC.map(v=><div key={v.id} style={{background:T.surface,borderRadius:16,padding:14,border:`1px solid ${T.line}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
            <div><div style={{fontSize:10,color:T.ink3,letterSpacing:1,textTransform:"uppercase",fontWeight:600}}>{new Date(v.fecha+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"})} · {v.hora||"—"}</div><div style={{fontSize:17,color:T.ink,marginTop:2,fontWeight:700}}>{v.nombre||"Visita"}</div></div>
            <span style={{display:"inline-flex",alignItems:"center",height:22,padding:"0 9px",borderRadius:999,background:v.estado==="realizada"?T.olive+"33":T.gold+"33",color:v.estado==="realizada"?"#5A8A3E":"#9B8324",fontSize:11,fontWeight:600}}>{v.estado?.charAt(0).toUpperCase()+v.estado?.slice(1)||"Pendiente"}</span>
          </div>
          {v.nota&&<div style={{fontSize:11,color:T.ink3,marginTop:6,padding:"8px 10px",background:T.bg,borderRadius:8}}>{v.nota}</div>}
        </div>)}
        {visitasC.length===0&&<div style={{color:T.ink3,fontSize:13,textAlign:"center",padding:"20px 0"}}>Sin visitas</div>}
      </div>}

      {tabDet==="reservas"&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
        {[...reservasC,...airbnbsC].map(r=><div key={r.id} style={{background:T.surface,borderRadius:16,padding:14,border:`1px solid ${T.line}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div><div style={{fontSize:10,color:T.ink3,letterSpacing:1,textTransform:"uppercase",fontWeight:600}}>{r.fecha_entrada?"Airbnb":"Evento"} · {new Date((r.fecha||r.fecha_entrada)+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short",year:"numeric"})}</div><div style={{fontSize:17,color:T.ink,marginTop:2,fontWeight:700}}>{r.nombre||r.huesped}</div></div>
            <span style={{display:"inline-flex",alignItems:"center",gap:4,height:22,padding:"0 9px",borderRadius:999,background:r.estado_pago==="pagado_completo"?T.olive+"33":T.gold+"33",color:r.estado_pago==="pagado_completo"?"#5A8A3E":"#9B8324",fontSize:11,fontWeight:600}}>{r.estado_pago==="pagado_completo"?"Pagado":r.seña_cobrada?"Seña OK":"Pendiente"}</span>
          </div>
          <div style={{height:1,background:T.line,margin:"12px -14px"}}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div><div style={{fontSize:10,color:T.ink3,textTransform:"uppercase",fontWeight:500}}>Total</div><div style={{fontSize:18,color:T.ink,fontWeight:700,marginTop:2}}>{fmtEur(getPrecioReserva(r))}</div></div>
            <div><div style={{fontSize:10,color:T.ink3,textTransform:"uppercase",fontWeight:500}}>Pendiente</div><div style={{fontSize:18,color:T.terracotta,fontWeight:700,marginTop:2}}>{fmtEur(Math.max(0,getPrecioReserva(r)-(parseFloat(r.seña_cobrada?r.seña_importe||0:0))))}</div></div>
          </div>
        </div>)}
        {reservasC.length===0&&airbnbsC.length===0&&<div style={{color:T.ink3,fontSize:13,textAlign:"center",padding:"20px 0"}}>Sin reservas</div>}
      </div>}

      <div style={{marginTop:20}}><TareasComerciales entidad_tipo="visita" entidad_id={sel.id} entidad_nombre={sel.nombre} tok={tok} perfil={perfil} rol={rol}/></div>
    </div>
    {/* MODAL CAMBIAR ESTADO */}
    {showEstado&&<div className="ov" onClick={()=>setShowEstado(false)}><div className="modal" style={{maxWidth:360}} onClick={e=>e.stopPropagation()}>
      <h3>Cambiar estado</h3>
      {Object.entries(ESTADO_CONTACTO).map(([k,v])=><button key={k} className="btn bg" style={{width:"100%",justifyContent:"flex-start",marginBottom:6,borderColor:sel.estado===k?v.col:undefined,color:sel.estado===k?v.col:undefined}} onClick={()=>cambiarEstado(sel,k)}>{v.ico} {v.lbl}{sel.estado===k?" ✓":""}</button>)}
    </div></div>}
    {showMenuC&&sel&&<div className="ov" onClick={()=>setShowMenuC(false)}><div className="modal" style={{maxWidth:380}} onClick={e=>e.stopPropagation()}>
      <div style={{fontSize:14,fontWeight:600,color:T.ink,marginBottom:16}}>{sel.nombre}</div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        <button onClick={()=>{setShowMenuC(false);setShowEstado(true);}} style={{width:"100%",padding:14,borderRadius:14,background:T.bg,border:0,color:T.ink,fontFamily:T.sans,fontWeight:600,fontSize:14,cursor:"pointer",textAlign:"left"}}>🏷 Cambiar estado</button>
        <button onClick={()=>{setShowMenuC(false);abrirEditar();}} style={{width:"100%",padding:14,borderRadius:14,background:T.bg,border:0,color:T.ink,fontFamily:T.sans,fontWeight:600,fontSize:14,cursor:"pointer",textAlign:"left"}}>✏️ Editar contacto</button>
        <button onClick={async()=>{if(!window.confirm(`¿Eliminar "${sel.nombre}"? No se puede deshacer.`))return;await sbDelete("contactos",`id=eq.${sel.id}`,tok);setSel(null);setShowMenuC(false);await cargar();}} style={{width:"100%",padding:14,borderRadius:14,background:"#FEF2F2",border:"1px solid #FECACA",color:"#D9443A",fontFamily:T.sans,fontWeight:600,fontSize:14,cursor:"pointer",textAlign:"left"}}>🗑️ Eliminar contacto</button>
      </div>
      <button onClick={()=>setShowMenuC(false)} style={{width:"100%",marginTop:10,padding:14,borderRadius:14,background:T.bg,border:0,color:T.ink3,fontFamily:T.sans,fontWeight:600,cursor:"pointer"}}>Cancelar</button>
    </div></div>}
  </div>;

  // ─── LISTA ──
  const conteo=estado=>contactos.filter(c=>c.estado===estado).length;
  return <div style={{background:T.bg,minHeight:"100%",paddingBottom:80}}>
    {/* Header */}
    <div style={{padding:"54px 20px 16px",display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:10}}>
      <div style={{flex:1}}><div style={{fontSize:12,color:T.ink3,fontWeight:500,marginBottom:2}}>CRM · Clientes y leads</div><div style={{fontSize:30,fontWeight:700,color:T.ink,letterSpacing:-1,lineHeight:1.02}}>Contactos</div></div>
      <button onClick={()=>{setForm(formVacio);setEditando(false);setShowForm(true);}} style={{width:40,height:40,borderRadius:999,background:T.terracotta,color:"white",border:0,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",boxShadow:"0 6px 14px rgba(236,104,62,.3)",flexShrink:0}}><FmIcon name="plus" size={18} stroke="white"/></button>
    </div>
    {/* Buscador */}
    <div style={{padding:"0 20px 12px"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,background:T.surface,border:`1px solid ${T.line}`,borderRadius:16,padding:"11px 14px"}}>
        <FmIcon name="search" size={16} stroke={T.ink3}/>
        <input value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Buscar por nombre, teléfono o email" style={{flex:1,border:0,outline:"none",background:"transparent",fontFamily:T.sans,fontSize:13,color:T.ink}}/>
        {busqueda&&<button onClick={()=>setBusqueda("")} style={{background:"transparent",border:0,cursor:"pointer",display:"flex"}}><FmIcon name="x" size={14} stroke={T.ink3}/></button>}
      </div>
    </div>
    {/* Filtros */}
    <div style={{padding:"0 20px 14px",display:"flex",gap:6,overflowX:"auto"}}>
      {["todos","lead","visitante","cliente","recurrente","perdido"].map(f=>{const on=filtro===f;const cfg=CSC[f];const cnt=f==="todos"?contactos.length:conteo(f);
        return<button key={f} onClick={()=>setFiltro(f)} style={{flexShrink:0,height:30,padding:"0 12px",borderRadius:999,border:`1px solid ${on?T.ink:T.line}`,background:on?T.ink:T.surface,color:on?"white":T.ink2,fontFamily:T.sans,fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6,textTransform:"capitalize"}}>{cfg&&<span style={{width:6,height:6,borderRadius:999,background:on?"rgba(255,255,255,.5)":cfg.c}}/>}{f==="todos"?"Todos":f} <span style={{fontSize:10,color:on?"rgba(255,255,255,.5)":T.ink3}}>{cnt}</span></button>;})}
    </div>
    {/* Lista */}
    <div style={{padding:"0 20px",display:"flex",flexDirection:"column",gap:8}}>
      {filtrados.map(c=>{const s=CSC[c.estado]||CSC.lead;const ini=c.nombre?.split(" ").map(p=>p[0]).slice(0,2).join("").toUpperCase()||"??";
        return<div key={c.id} onClick={()=>cargarDetalle(c)} style={{background:T.surface,borderRadius:16,padding:14,border:`1px solid ${T.line}`,cursor:"pointer"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:42,height:42,borderRadius:999,background:s.bg,color:s.c,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,flexShrink:0}}>{ini}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8}}>
                <span style={{fontSize:14,fontWeight:600,color:T.ink,letterSpacing:-.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.nombre}</span>
                <span style={{display:"inline-flex",alignItems:"center",gap:4,height:22,padding:"0 9px",borderRadius:999,background:s.bg,color:s.c,fontSize:11,fontWeight:600,whiteSpace:"nowrap",flexShrink:0}}><span style={{width:5,height:5,borderRadius:999,background:s.c}}/>{c.estado?.charAt(0).toUpperCase()+c.estado?.slice(1)||"Lead"}</span>
              </div>
              <div style={{fontSize:11.5,color:T.ink3,marginTop:4,display:"flex",alignItems:"center",gap:6,overflow:"hidden"}}>
                <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.tipo_evento||"—"}</span>
                {c.fecha_evento_prevista&&<><span style={{color:T.ink4}}>·</span><span style={{color:T.ink2,fontWeight:500,whiteSpace:"nowrap"}}>{new Date(c.fecha_evento_prevista+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"})}</span></>}
                {c.origen&&<><span style={{color:T.ink4}}>·</span><span style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.origen}</span></>}
              </div>
            </div>
          </div>
        </div>;})}
      {filtrados.length===0&&<div style={{textAlign:"center",padding:"40px 20px",color:T.ink3,fontSize:13}}>{busqueda?`Sin resultados para "${busqueda}"`:"Sin contactos en esta categoría"}</div>}
    </div>

    {/* MODAL NUEVO/EDITAR CONTACTO */}
    {showForm&&<div className="ov" onClick={()=>{setShowForm(false);setEditando(false);}}><div className="modal" style={{maxHeight:"92vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
      <h3>{editando?"✏️ Editar contacto":"👥 Nuevo contacto"}</h3>
      <div className="fg"><label>Nombre *</label><input className="fi" value={form.nombre} onChange={e=>setForm(v=>({...v,nombre:e.target.value}))} placeholder="Nombre del contacto"/></div>
      <div className="g2">
        <div className="fg"><label>Teléfono</label><input className="fi" type="tel" value={form.telefono} onChange={e=>setForm(v=>({...v,telefono:e.target.value}))} placeholder="600 000 000"/></div>
        <div className="fg"><label>Email</label><input className="fi" type="email" value={form.email} onChange={e=>setForm(v=>({...v,email:e.target.value}))} placeholder="correo@email.com"/></div>
      </div>
      <div className="g2">
        <div className="fg"><label>Origen</label><select className="fi" value={form.origen} onChange={e=>setForm(v=>({...v,origen:e.target.value}))}>
          {["directo","bodas.net","instagram","google","referido","airbnb","otro"].map(o=><option key={o} value={o}>{o}</option>)}
        </select></div>
        <div className="fg"><label>Tipo de evento</label><select className="fi" value={form.tipo_evento} onChange={e=>setForm(v=>({...v,tipo_evento:e.target.value}))}>
          {["boda","comunion","empresa","airbnb","otro"].map(t=><option key={t} value={t}>{t}</option>)}
        </select></div>
      </div>
      <div className="fg"><label>Fecha prevista del evento</label><input type="date" className="fi" value={form.fecha_evento_prevista} onChange={e=>setForm(v=>({...v,fecha_evento_prevista:e.target.value}))}/></div>
      {!form.fecha_evento_prevista&&<div className="g2">
        <div className="fg"><label>Mes previsto</label><select className="fi" value={form.mes_evento_previsto} onChange={e=>setForm(v=>({...v,mes_evento_previsto:e.target.value}))}>
          <option value="">—</option>{[1,2,3,4,5,6,7,8,9,10,11,12].map(m=><option key={m} value={m}>{new Date(2000,m-1).toLocaleDateString("es-ES",{month:"long"})}</option>)}
        </select></div>
        <div className="fg"><label>Año previsto</label><select className="fi" value={form.anio_evento_previsto} onChange={e=>setForm(v=>({...v,anio_evento_previsto:e.target.value}))}>
          <option value="">—</option>{[2025,2026,2027,2028,2029,2030].map(a=><option key={a} value={a}>{a}</option>)}
        </select></div>
      </div>}
      <div className="fg"><label>Presupuesto estimado (€)</label><input type="number" inputMode="decimal" className="fi" value={form.presupuesto_estimado} onChange={e=>setForm(v=>({...v,presupuesto_estimado:e.target.value}))} placeholder="Ej: 8000"/></div>
      <div className="fg"><label>Notas</label><textarea className="fi" rows={3} value={form.notas} onChange={e=>setForm(v=>({...v,notas:e.target.value}))} placeholder="Observaciones…"/></div>
      <div className="mft"><button className="btn bg" onClick={()=>{setShowForm(false);setEditando(false);}}>Cancelar</button><button className="btn bp" onClick={guardar} disabled={saving}>{saving?"Guardando…":"✓ Guardar"}</button></div>
    </div></div>}

    {/* MODAL REGISTRAR INTERACCIÓN */}
    {showInter&&sel&&<div className="ov" onClick={()=>setShowInter(false)}><div className="modal" style={{maxWidth:440}} onClick={e=>e.stopPropagation()}>
      <h3>📝 Registrar interacción</h3>
      <div style={{fontSize:13,color:"#8A8580",marginBottom:14}}>Con: <strong style={{color:"#1A1A1A"}}>{sel.nombre}</strong></div>
      <div className="g2">
        <div className="fg"><label>Tipo</label><select className="fi" value={formInter.tipo} onChange={e=>setFormInter(v=>({...v,tipo:e.target.value}))}>
          {Object.entries(ICONOS_INTERACCION).map(([k,ico])=><option key={k} value={k}>{ico} {k}</option>)}
        </select></div>
        <div className="fg"><label>Dirección</label><select className="fi" value={formInter.direccion} onChange={e=>setFormInter(v=>({...v,direccion:e.target.value}))}>
          <option value="salida">➡ Salida</option><option value="entrada">⬅ Entrada</option>
        </select></div>
      </div>
      <div className="g2">
        <div className="fg"><label>Fecha</label><input type="date" className="fi" value={formInter.fecha} onChange={e=>setFormInter(v=>({...v,fecha:e.target.value}))}/></div>
        <div className="fg"><label>Resultado</label><select className="fi" value={formInter.resultado} onChange={e=>setFormInter(v=>({...v,resultado:e.target.value}))}>
          <option value="positivo">✅ Positivo</option><option value="neutro">➖ Neutro</option><option value="negativo">❌ Negativo</option><option value="sin_respuesta">📵 Sin respuesta</option>
        </select></div>
      </div>
      <div className="fg"><label>Resumen *</label><textarea className="fi" rows={3} value={formInter.resumen} onChange={e=>setFormInter(v=>({...v,resumen:e.target.value}))} placeholder="¿Qué se habló o acordó?"/></div>
      <div className="mft"><button className="btn bg" onClick={()=>setShowInter(false)}>Cancelar</button><button className="btn bp" onClick={registrarInteraccion} disabled={saving||!formInter.resumen}>{saving?"Guardando…":"✓ Guardar"}</button></div>
    </div></div>}

    {/* MODAL PROGRAMAR VISITA */}
    {showVisita&&sel&&<div className="ov" onClick={()=>setShowVisita(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <h3>📅 Programar visita</h3>
      <div style={{fontSize:13,color:"#8A8580",marginBottom:14}}>Para: <strong style={{color:"#1A1A1A"}}>{sel.nombre}</strong></div>
      <div className="g2">
        <div className="fg"><label>Fecha *</label><input type="date" className="fi" value={formVis.fecha} onChange={e=>setFormVis(v=>({...v,fecha:e.target.value}))}/></div>
        <div className="fg"><label>Hora *</label><input type="time" className="fi" value={formVis.hora} onChange={e=>setFormVis(v=>({...v,hora:e.target.value}))}/></div>
      </div>
      <div className="g2">
        <div className="fg"><label>Tipo evento</label><input className="fi" value={formVis.tipo_evento} onChange={e=>setFormVis(v=>({...v,tipo_evento:e.target.value}))}/></div>
        <div className="fg"><label>Invitados</label><input type="number" className="fi" value={formVis.invitados} onChange={e=>setFormVis(v=>({...v,invitados:e.target.value}))}/></div>
      </div>
      <div className="fg"><label>Nota</label><textarea className="fi" rows={2} value={formVis.nota} onChange={e=>setFormVis(v=>({...v,nota:e.target.value}))} placeholder="Notas…"/></div>
      <div className="mft"><button className="btn bg" onClick={()=>setShowVisita(false)}>Cancelar</button><button className="btn bp" onClick={programarVisita} disabled={saving}>{saving?"Guardando…":"📅 Programar"}</button></div>
    </div></div>}
  </div>;
}

function Visitas({perfil,tok,rol,setPage,navTarget,setNavTarget}){
  const isA=rol==="admin", isC=rol==="comercial";
  const puedeEditar=isA||isC;
  const{refresh}=useContext(BadgeCtx);
  useEffect(()=>{marcarVistoTipo("visita",String(perfil?.id),tok);setTimeout(refresh,500);},[]);
  const hoy=new Date().toISOString().split("T")[0];

  const [visitas,setVisitas]=useState([]);
  const [reservasMap,setReservasMap]=useState({});
  const [load,setLoad]=useState(true);
  const [tab,setTab]=useState("proximas");
  const [filtroTipo,setFiltroTipo]=useState("todas");
  const [showForm,setShowForm]=useState(false);
  const [sel,setSel]=useState(null);
  useEffect(()=>{if(navTarget&&navTarget.id){setSel(navTarget);setNavTarget?.(null);}},[navTarget]);
  const [showConvertir,setShowConvertir]=useState(false);
  const [showNoPresentado,setShowNoPresentado]=useState(false);
  const [showRevertir,setShowRevertir]=useState(false);
  const [notaCancelacion,setNotaCancelacion]=useState("");
  const [saving,setSaving]=useState(false);
  const [showVincular,setShowVincular]=useState(false);const [contactosList,setContactosList]=useState([]);const [showCrearContacto,setShowCrearContacto]=useState(false);
  const [formContacto,setFormContacto]=useState({nombre:"",telefono:"",email:"",origen:"directo",tipo_evento:"boda",notas:""});

  const formVacio={nombre:"",fecha:hoy,hora:"10:00",tipo_evento:"Boda",invitados:"",telefono:"",email:"",nota:"",fecha_evento_prevista:""};
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
      const fep=form.fecha_evento_prevista||null;
      const mep=fep?new Date(fep+"T12:00:00").getMonth()+1:null;
      const aep=fep?new Date(fep+"T12:00:00").getFullYear():null;
      const [v]=await sbPost("visitas",{...form,invitados:parseInt(form.invitados)||null,estado:"pendiente",creado_por:perfil.nombre,fecha_evento_prevista:fep,mes_evento_previsto:mep,anio_evento_previsto:aep},tok);
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
    try{
      await sbPatch("visitas",`id=eq.${sel.id}`,{estado:"realizada"},tok);
      await addHistorial("visita",sel.id,"Visita realizada en la finca",perfil.nombre,tok);
      if(sel.es_coordinacion&&sel.reserva_id)await addHistorial("reserva",sel.reserva_id,`Visita de coordinación realizada: ${sel.motivo_visita||sel.tipo_evento||"Coordinación"}`,perfil.nombre,tok);
      autoInteraccion(sel.contacto_id,"visita_finca",`Visita realizada el ${new Date(sel.fecha+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"long"})}`,"positivo",tok,perfil.nombre);
      setSel(prev=>({...prev,estado:"realizada"}));await load_();
    }catch(_){}
  };

  const marcarNoPresentado=async(accion)=>{
    if(!sel||saving)return;
    setSaving(true);
    try{
      await sbPatch("visitas",`id=eq.${sel.id}`,{estado:"no_presentado"},tok);
      await addHistorial("visita",sel.id,"El cliente no se presentó a la visita",perfil.nombre,tok);
      autoInteraccion(sel.contacto_id,"visita_finca","Visita cancelada: el cliente no se presentó","negativo",tok,perfil.nombre);
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

  const abrirVincular=async()=>{
    const cs=await sbGet("contactos","?select=id,nombre,tipo_evento,estado&order=nombre.asc",tok).catch(()=>[]);
    setContactosList(cs);setShowVincular(true);
  };
  const vincularContacto=async(contactoId)=>{
    if(!sel||!contactoId)return;
    await sbPatch("visitas",`id=eq.${sel.id}`,{contacto_id:contactoId},tok);
    await sbPatch("contactos",`id=eq.${contactoId}`,{estado:"visitante",updated_at:new Date().toISOString()},tok).catch(()=>{});
    await sbPost("contacto_interacciones",{contacto_id:contactoId,tipo:"visita_finca",direccion:"salida",fecha:new Date().toISOString(),resumen:`Visita vinculada: ${sel.nombre} — ${new Date(sel.fecha+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"long"})}`,resultado:"neutro",creado_por:perfil.nombre},tok).catch(()=>{});
    setSel(prev=>({...prev,contacto_id:contactoId}));setShowVincular(false);await load_();
  };
  const abrirCrearContacto=()=>{
    setFormContacto({nombre:sel?.nombre||"",telefono:sel?.telefono||"",email:sel?.email||"",origen:"directo",tipo_evento:sel?.tipo_evento==="Boda"?"boda":sel?.tipo_evento==="Comunión"?"comunion":sel?.tipo_evento==="Empresa"?"empresa":"boda",notas:sel?.nota||""});
    setShowCrearContacto(true);
  };
  const crearYvincular=async()=>{
    if(!formContacto.nombre||!sel||saving)return;setSaving(true);
    try{
      const[c]=await sbPost("contactos",{nombre:formContacto.nombre,telefono:formContacto.telefono||null,email:formContacto.email||null,origen:formContacto.origen,tipo_evento:formContacto.tipo_evento,estado:"visitante",notas:formContacto.notas||null,asignado_a:perfil?.id,asignado_nombre:perfil?.nombre,created_at:new Date().toISOString(),updated_at:new Date().toISOString()},tok);
      if(c?.id){
        await sbPatch("visitas",`id=eq.${sel.id}`,{contacto_id:c.id},tok);
        await sbPost("contacto_interacciones",{contacto_id:c.id,tipo:"visita_finca",direccion:"salida",fecha:new Date().toISOString(),resumen:`Contacto creado y visita vinculada: ${sel.nombre} — ${new Date(sel.fecha+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"long"})}`,resultado:"positivo",creado_por:perfil.nombre},tok).catch(()=>{});
        setSel(prev=>({...prev,contacto_id:c.id}));
      }
      setShowCrearContacto(false);await load_();
    }catch(_){}setSaving(false);
  };

  const abrirConvertir=()=>{
    setFormRes({fecha_evento:sel.fecha_evento_prevista||"",precio_finca:"",precio_casa:"",incluye_casa:false,contacto:sel.telefono||"",obs:sel.nota||"",estado:"visita"});
    setShowConvertir(true);
  };

  const convertirEnReserva=async()=>{
    if(!sel||saving||!formRes.fecha_evento)return;
    setSaving(true);
    try{
      const pF=parseFloat(formRes.precio_finca)||0;const pC=formRes.incluye_casa?parseFloat(formRes.precio_casa)||0:0;const pT=pF+pC;
      const [res]=await sbPost("reservas",{nombre:sel.nombre,fecha:formRes.fecha_evento,tipo:sel.tipo_evento||"Boda",incluye_casa:formRes.incluye_casa,precio_finca:pF,precio_casa:pC,precio_total:pT,precio:pT,contacto:formRes.contacto||"",obs:formRes.obs||"",estado:formRes.estado||"visita",creado_por:perfil.id,contacto_id:sel.contacto_id||null,bloqueo_dia_anterior:formRes.incluye_casa,bloqueo_dia_posterior:formRes.incluye_casa},tok);
      await sbPatch("visitas",`id=eq.${sel.id}`,{estado:"convertida",reserva_id:res.id},tok);
      if(sel.contacto_id){
        await sbPatch("contactos",`id=eq.${sel.contacto_id}`,{estado:"cliente",updated_at:new Date().toISOString()},tok).catch(()=>{});
        autoInteraccion(sel.contacto_id,"nota",`✅ Visita convertida en reserva: ${sel.nombre} — ${new Date(formRes.fecha_evento+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"long",year:"numeric"})} — ${parseFloat(formRes.precio)||0}€`,"positivo",tok,perfil.nombre);
      }
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
      autoInteraccion(sel.contacto_id,"nota",`❌ Reserva cancelada: ${sel.nombre} — ${notaCancelacion}`,"negativo",tok,perfil.nombre);
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
                {v.contacto_id&&<span className="badge" style={{background:"rgba(236,104,62,.1)",color:"#EC683E",cursor:"pointer"}} onClick={e=>{e.stopPropagation();setPage("contactos");}}>👤 Ficha</span>}
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
        <div className="fg">
          <label>Fecha prevista del evento (opcional)</label>
          <input type="date" className="fi" value={form.fecha_evento_prevista} onChange={e=>setForm(v=>({...v,fecha_evento_prevista:e.target.value}))}/>
          <div style={{fontSize:11,color:"#8A8580",marginTop:4}}>💡 Si no hay fecha fija, déjalo en blanco</div>
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
      <div className="modal" style={{maxWidth:560,maxHeight:"92vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
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
            {l:"FECHA EVENTO",v:sel.fecha_evento_prevista?new Date(sel.fecha_evento_prevista+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"long",year:"numeric"}):null},
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

        {isA&&!sel.contacto_id&&<div style={{marginTop:16,padding:"12px 14px",background:"rgba(212,160,23,.06)",border:"1px solid rgba(212,160,23,.2)",borderRadius:10}}>
          <div style={{fontSize:13,fontWeight:600,color:"#D4A017",marginBottom:6}}>⚠️ Sin contacto vinculado</div>
          <div style={{fontSize:12,color:"#8A8580",marginBottom:10}}>Esta visita no está vinculada a ningún contacto</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <button className="btn bg sm" onClick={abrirVincular}>👤 Vincular a contacto existente</button>
            <button className="btn bp sm" onClick={abrirCrearContacto}>➕ Crear nuevo contacto</button>
          </div>
        </div>}
        {sel.contacto_id&&<div style={{marginTop:12,cursor:"pointer",color:"#EC683E",fontSize:13,fontWeight:600}} onClick={()=>setPage("contactos")}>👤 Ver ficha del cliente →</div>}
        <TareasComerciales entidad_tipo="visita" entidad_id={sel.id} entidad_nombre={sel.nombre} tok={tok} perfil={perfil} rol={rol}/>
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
          {sel.fecha_evento_prevista&&formRes.fecha_evento===sel.fecha_evento_prevista&&<div style={{fontSize:12,color:"#A6BE59",marginTop:5}}>✅ Fecha pre-rellenada desde la visita — puedes cambiarla si es necesario</div>}
        </div>
        <div style={{display:"flex",gap:8,marginBottom:14}}>
          <button onClick={()=>setFormRes(v=>({...v,incluye_casa:false}))} style={{flex:1,padding:"10px 0",borderRadius:12,border:`1px solid ${formRes.incluye_casa?T.line:T.ink}`,background:formRes.incluye_casa?T.surface:T.ink,color:formRes.incluye_casa?T.ink2:"white",fontFamily:T.sans,fontWeight:600,fontSize:13,cursor:"pointer"}}>Solo finca</button>
          <button onClick={()=>setFormRes(v=>({...v,incluye_casa:true}))} style={{flex:1,padding:"10px 0",borderRadius:12,border:`1px solid ${formRes.incluye_casa?T.ink:T.line}`,background:formRes.incluye_casa?T.ink:T.surface,color:formRes.incluye_casa?"white":T.ink2,fontFamily:T.sans,fontWeight:600,fontSize:13,cursor:"pointer"}}>Finca + Casa</button>
        </div>
        <div className="g2">
          <div className="fg"><label>Precio finca (€)</label><input type="number" inputMode="numeric" className="fi" value={formRes.precio_finca} onChange={e=>setFormRes(v=>({...v,precio_finca:e.target.value}))} placeholder="0"/></div>
          {formRes.incluye_casa&&<div className="fg"><label>Precio casa (€)</label><input type="number" inputMode="numeric" className="fi" value={formRes.precio_casa} onChange={e=>setFormRes(v=>({...v,precio_casa:e.target.value}))} placeholder="0"/></div>}
        </div>
        {((parseFloat(formRes.precio_finca)||0)+(formRes.incluye_casa?parseFloat(formRes.precio_casa)||0:0))>0&&<div style={{display:"flex",justifyContent:"space-between",padding:"10px 14px",background:T.bg,borderRadius:12,marginBottom:14}}><span style={{fontSize:13,color:T.ink3,fontWeight:500}}>Total</span><span style={{fontSize:16,fontWeight:700,color:T.ink}}>{((parseFloat(formRes.precio_finca)||0)+(formRes.incluye_casa?parseFloat(formRes.precio_casa)||0:0)).toLocaleString("es-ES")}€</span></div>}
        <div className="fg"><label>Contacto</label><input className="fi" type="tel" value={formRes.contacto} onChange={e=>setFormRes(v=>({...v,contacto:e.target.value}))} placeholder="600 000 000"/></div>
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

    {/* MODAL VINCULAR CONTACTO */}
    {showVincular&&sel&&<div className="ov" onClick={()=>setShowVincular(false)}><div className="modal" style={{maxHeight:"80vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
      <h3>👤 Vincular a contacto existente</h3>
      <div style={{fontSize:13,color:"#8A8580",marginBottom:14}}>Selecciona el contacto para vincular a la visita de <strong style={{color:"#1A1A1A"}}>{sel.nombre}</strong></div>
      {contactosList.length===0?<div className="empty"><span className="ico">👥</span><p>No hay contactos disponibles</p></div>
      :contactosList.map(c=>{const ec=ESTADO_CONTACTO[c.estado]||ESTADO_CONTACTO.lead;return <div key={c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"#F5F3F0",borderRadius:8,marginBottom:6,cursor:"pointer",borderLeft:`3px solid ${ec.col}`}} onClick={()=>vincularContacto(c.id)}>
        <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:"#1A1A1A"}}>{c.nombre}</div><div style={{fontSize:11,color:"#8A8580"}}>{ec.ico} {ec.lbl} · {c.tipo_evento||"—"}</div></div>
        <span style={{color:"#EC683E",fontSize:13}}>Vincular →</span>
      </div>;})}
      <div className="mft"><button className="btn bg" onClick={()=>setShowVincular(false)}>Cancelar</button></div>
    </div></div>}

    {/* MODAL CREAR CONTACTO DESDE VISITA */}
    {showCrearContacto&&sel&&<div className="ov" onClick={()=>setShowCrearContacto(false)}><div className="modal" style={{maxHeight:"90vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
      <h3>➕ Crear contacto desde visita</h3>
      <div className="fg"><label>Nombre *</label><input className="fi" value={formContacto.nombre} onChange={e=>setFormContacto(v=>({...v,nombre:e.target.value}))} placeholder="Nombre"/></div>
      <div className="g2">
        <div className="fg"><label>Teléfono</label><input className="fi" type="tel" value={formContacto.telefono} onChange={e=>setFormContacto(v=>({...v,telefono:e.target.value}))}/></div>
        <div className="fg"><label>Email</label><input className="fi" type="email" value={formContacto.email} onChange={e=>setFormContacto(v=>({...v,email:e.target.value}))}/></div>
      </div>
      <div className="g2">
        <div className="fg"><label>Origen</label><select className="fi" value={formContacto.origen} onChange={e=>setFormContacto(v=>({...v,origen:e.target.value}))}>
          {["directo","bodas.net","instagram","google","referido","otro"].map(o=><option key={o} value={o}>{o}</option>)}
        </select></div>
        <div className="fg"><label>Tipo evento</label><select className="fi" value={formContacto.tipo_evento} onChange={e=>setFormContacto(v=>({...v,tipo_evento:e.target.value}))}>
          {["boda","comunion","empresa","otro"].map(t=><option key={t} value={t}>{t}</option>)}
        </select></div>
      </div>
      <div className="fg"><label>Notas</label><textarea className="fi" rows={2} value={formContacto.notas} onChange={e=>setFormContacto(v=>({...v,notas:e.target.value}))}/></div>
      <div className="mft"><button className="btn bg" onClick={()=>setShowCrearContacto(false)}>Cancelar</button><button className="btn bp" onClick={crearYvincular} disabled={saving||!formContacto.nombre}>{saving?"Creando…":"✓ Crear y vincular"}</button></div>
    </div></div>}
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
function ReservasAirbnb({perfil,tok,rol,navTarget,setNavTarget}){
  const isA=rol==="admin";
  const [airbnbs,setAirbnbs]=useState([]);
  const [load,setLoad]=useState(true);
  const [showForm,setShowForm]=useState(false);
  const [sel,setSel]=useState(null);
  useEffect(()=>{if(navTarget&&navTarget.id){setSel(navTarget);setNavTarget?.(null);}},[navTarget]);
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
      const[abNew]=await sbPost("reservas_airbnb",{
        ...form,
        personas:parseInt(form.personas)||null,
        precio:parseFloat(form.precio)||null,
        creado_por:perfil.nombre,
      },tok);
      if(abNew)await crearContactoDesdeAirbnb({...form,...abNew},tok,perfil).catch(()=>{});
      // Notificar si llegada próximos 7 días
      const en7=new Date();en7.setDate(en7.getDate()+7);
      if(form.fecha_entrada&&form.fecha_entrada<=en7.toISOString().split("T")[0])notificarRoles(["admin","limpieza","jardinero"],`🏠 Nueva reserva Airbnb`,`${form.huesped} llega el ${new Date(form.fecha_entrada+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"long"})}`,"airbnb-nueva",tok);
      // Coordinación inmediata si ≤3 días
      const diasHastaAb=Math.ceil((new Date(form.fecha_entrada+"T12:00:00")-new Date())/(86400000));
      if(diasHastaAb<=3)await ejecutarCoordInmediata(null,form.fecha_entrada,"airbnb",true,tok);
      await verificarConflictosNuevaReserva(form.fecha_entrada,tok);
      setShowForm(false);setForm(formVacio);await load_();
    }catch(_){}
    setSaving(false);
  };

  const eliminar=async id=>{
    if(!window.confirm("¿Eliminar esta reserva Airbnb?"))return;
    try{
      const ab=airbnbs.find(a=>a.id===id);
      // 1. Cancel coordinaciones (try both string id formats)
      const coords=await sbGet("coordinacion_servicios",`?reserva_id=eq.${id}&select=*`,tok).catch(()=>[]);
      for(const c of coords){
        if(c.servicio_id){await sbDelete("servicio_tareas",`servicio_id=eq.${c.servicio_id}`,tok).catch(()=>{});await sbDelete("servicios",`id=eq.${c.servicio_id}`,tok).catch(()=>{});}
        if(c.jardin_servicio_id)await sbPatch("jardin_servicios",`id=eq.${c.jardin_servicio_id}`,{estado:"cancelado"},tok).catch(()=>{});
        await sbDelete("coordinacion_servicios",`id=eq.${c.id}`,tok).catch(()=>{});
      }
      // 2. Also find auto-created services by date
      if(ab){const srvF=await sbGet("servicios",`?fecha=eq.${ab.fecha_salida}&select=id`,tok).catch(()=>[]);
        for(const s of srvF){await sbDelete("servicio_tareas",`servicio_id=eq.${s.id}`,tok).catch(()=>{});await sbDelete("servicios",`id=eq.${s.id}`,tok).catch(()=>{});}}
      // 3. Notify
      if(ab){const msg=`❌ Reserva Airbnb cancelada — ${ab.huesped} (${ab.fecha_entrada} → ${ab.fecha_salida}). Servicios cancelados.`;
        const ops=await sbGet("operarios","?activo=eq.true&select=id",tok).catch(()=>[]);
        const adms=await sbGet("usuarios","?rol=eq.admin&select=id",tok).catch(()=>[]);
        for(const u of[...ops,...adms])await sbPost("notificaciones",{para:u.id,txt:msg},tok).catch(()=>{});
        sendPush("❌ Reserva cancelada",msg,"cancelacion");}
      // 4. Delete reservation
      await sbDelete("reservas_airbnb",`id=eq.${id}`,tok);await load_();setSel(null);
    }catch(_){}
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

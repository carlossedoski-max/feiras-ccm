import { z } from 'zod';
import { normalizeCode, dimensionsStatus, generatePlanCode, isCompleteEquipment, parseDimensions, plausibleMm } from './model';
const BASE = 'https://ccmdobrasil.com.br/CCM/site';
const productSchema=z.object({codigo:z.union([z.string(),z.number()]),nome:z.string(),categoria:z.string().nullish(),nomeMarca:z.string().nullish(),descricao:z.string().nullish(),especificacoes:z.array(z.object({rotulo:z.string(),valores:z.array(z.unknown())})).default([]),fotos:z.array(z.object({url:z.string().nullish()})).default([]),apoioImpressos:z.array(z.object({titulo:z.string().nullish(),urlDownload:z.string().nullish()})).nullish()}).passthrough();
export type OfficialRow = ReturnType<typeof parseOfficialProduct>;
/** Converts an official product payload into a catalog row. Only labelled product dimensions are used; packaging dimensions are kept apart. */
export function parseOfficialProduct(raw:unknown, expectedCode:string, subcategories:string[]=[]){
 const p=productSchema.parse(raw);if(normalizeCode(String(p.codigo))!==normalizeCode(expectedCode))throw new Error('O produto recebido não corresponde ao código consultado.');
 const specs=Object.fromEntries(p.especificacoes.map(s=>[s.rotulo,s.valores]));
 const value=(label:string)=>String(specs[label]?.[0]??'');
 let dims:ReturnType<typeof parseDimensions>=null,source='',packaging='';
 for(const s of p.especificacoes){const label=s.rotulo.toLowerCase(),text=String(s.valores[0]??'');
  if(!label.includes('dimens'))continue;
  if(label.includes('embalag')){packaging=text;continue;}
  const parsed=parseDimensions(text);if(parsed&&!dims){dims=parsed;source=`Cadastro oficial CCM — campo “${s.rotulo}”`;}}
 if(dims&&!(plausibleMm(dims.length_mm)&&plausibleMm(dims.width_mm)&&plausibleMm(dims.height_mm))){source+=' (verificar coerência)';}
 const number=(s:string)=>{const match=s.match(/\d+(?:[.,]\d+)?/);return match?Number(match[0].replace(',','.')):null;};
 const photo=p.fotos.find(f=>f.url?.startsWith('https://ccmdobrasil.com.br/'))?.url??null;
 const model=value('Modelo'),code=value('Código')||String(p.codigo),normalized=normalizeCode(String(p.codigo));
 const subs=subcategories.length?subcategories:[p.categoria??''];
 return {ccm_code:code,normalized_code:normalized,name:p.nome,model,brand:p.nomeMarca||(p.nome.includes('KAWASHIMA')?'Kawashima':value('Marca')),category:value('Tipo')||p.categoria||'',subcategory:subs.filter(Boolean).join(', '),
  length_mm:dims?.length_mm??null,width_mm:dims?.width_mm??null,height_mm:dims?.height_mm??null,net_weight:number(value('Peso líquido')),gross_weight:number(value('Peso bruto')),photo_url:photo,
  specifications:JSON.parse(JSON.stringify({...specs,Descrição:p.descricao??''})) as Record<string,unknown>,dimension_status:dimensionsStatus({length_mm:dims?.length_mm??null,width_mm:dims?.width_mm??null,height_mm:dims?.height_mm??null}),
  dimension_source:source,packaging_dimensions:packaging,plan_code:generatePlanCode(model,code),official_url:`https://ccmdobrasil.com.br/produto/${normalized}`,situation:'Ativo',sync_error:'',
  is_equipment:isCompleteEquipment(subs,value('Tipo'),p.nome),manuals:(p.apoioImpressos??[]).map(m=>m.urlDownload).filter((u):u is string=>!!u&&u.startsWith('https://ccmdobrasil.com.br/'))};
}
async function fetchJson(url:string,init?:RequestInit){
 const response=await fetch(url,{...init,signal:AbortSignal.timeout(45000),redirect:'error',headers:{Accept:'application/json','Content-Type':'application/json'}});
 if(response.status===404)return null;
 if(!response.ok)throw new Error(`Site oficial respondeu ${response.status}.`);
 const text=await response.text();if(text.length>3_000_000)throw new Error('Resposta do site oficial excedeu o limite.');
 return JSON.parse(text) as unknown;
}
/** Looks for labelled assembled-product dimensions in an official PDF manual (never packaging). */
export async function dimensionsFromManual(url:string){
 const response=await fetch(url,{signal:AbortSignal.timeout(30000),redirect:'error'});if(!response.ok)return null;
 const buffer=await response.arrayBuffer();if(buffer.byteLength>25_000_000)return null;
 const {extractText,getDocumentProxy}=await import('unpdf');
 const pdf=await getDocumentProxy(new Uint8Array(buffer));const {text}=await extractText(pdf,{mergePages:true});
 const flat=String(text).replace(/\s+/g,' ');
 const re=/dimens[õo]es[^.:]{0,60}?[:\s]\s*(\d+(?:[.,]\d+)?\s*(?:mm|cm|m)?\s*[x×X]\s*\d+(?:[.,]\d+)?\s*(?:mm|cm|m)?\s*[x×X]\s*\d+(?:[.,]\d+)?\s*(?:mm|cm|m)\b)/gi;
 for(const m of flat.matchAll(re)){const context=flat.slice(Math.max(0,(m.index??0)-40),(m.index??0)+m[0].length).toLowerCase();if(context.includes('embalag')||context.includes('caixa'))continue;const d=parseDimensions(m[1]??'');if(d&&plausibleMm(d.length_mm)&&plausibleMm(d.width_mm)&&plausibleMm(d.height_mm))return d;}
 return null;
}
export interface ProductAdapter { lookup(code:string,subcategories?:string[]):Promise<OfficialRow|null>; listActive():Promise<{code:string;name:string;subcategories:string[]}[]> }
export const ccmAdapter:ProductAdapter={
 async lookup(code,subcategories=[]){
  const json=await fetchJson(`${BASE}/getProduto?id=${encodeURIComponent(code)}`) as {nome?:string}|null;if(!json||!json.nome)return null;
  const row=parseOfficialProduct(json,code,subcategories);
  if(row.is_equipment&&row.length_mm===null){for(const url of row.manuals.slice(0,2)){try{const d=await dimensionsFromManual(url);if(d){Object.assign(row,d,{dimension_status:'Completas',dimension_source:`Manual oficial CCM (${url.split('/').pop()})`});break;}}catch{/* manual unreadable: keep pending */}}}
  return row;
 },
 async listActive(){
  const cats=await fetchJson(`${BASE}/getCategorias`) as {subcategorias?:{nome:string}[]}|null;const subs=cats?.subcategorias??[];
  const found=new Map<string,{code:string;name:string;subcategories:string[]}>();
  for(let i=0;i<subs.length;i+=8){await Promise.all(subs.slice(i,i+8).map(async s=>{
   const r=await fetchJson(`${BASE}/searchProdutos?descontinuados=false`,{method:'POST',body:JSON.stringify([{tipoPesquisa:'Subcategoria',valor:s.nome}])}) as {resultado?:{codigo:string;nome:string}[]}|null;
   for(const p of r?.resultado??[]){const c=normalizeCode(String(p.codigo));if(!c)continue;const e=found.get(c)??{code:c,name:p.nome,subcategories:[]};e.subcategories.push(s.nome.trim());found.set(c,e);}
  }));}
  if(subs.length<10||found.size<50)throw new Error('O catálogo oficial retornou poucos produtos; sincronização interrompida para evitar desativações indevidas.');
  return [...found.values()];
 }};

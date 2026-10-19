import { z } from 'zod';
import { normalizeCode, dimensionsStatus } from './model';
const productSchema=z.object({codigo:z.union([z.string(),z.number()]),nome:z.string(),categoria:z.string().nullish(),descricao:z.string().nullish(),especificacoes:z.array(z.object({rotulo:z.string(),valores:z.array(z.unknown())})).default([]),fotos:z.array(z.object({url:z.string().nullish()})).default([])}).passthrough();
export function parseOfficialProduct(raw:unknown, expectedCode:string){
 const p=productSchema.parse(raw);if(normalizeCode(String(p.codigo))!==normalizeCode(expectedCode))throw new Error('O produto recebido não corresponde ao código consultado.');
 const specs=Object.fromEntries(p.especificacoes.map(s=>[s.rotulo,s.valores]));
 const value=(label:string)=>String(specs[label]?.[0]??'');
 const dim=value('Dimensões').match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)\b/i);
 const factor=dim?.[4]==='cm'?10:dim?.[4]==='m'?1000:1;
 const number=(s:string)=>{const match=s.match(/\d+(?:[.,]\d+)?/);return match?Number(match[0].replace(',','.')):null;};
 const length_mm=dim?Number(dim[1]?.replace(',','.'))*factor:null,width_mm=dim?Number(dim[2]?.replace(',','.'))*factor:null,height_mm=dim?Number(dim[3]?.replace(',','.'))*factor:null;
 const photo=p.fotos.find(f=>f.url?.startsWith('https://ccmdobrasil.com.br/'))?.url;
 return {name:p.nome,model:value('Modelo'),brand:p.nome.includes('KAWASHIMA')?'Kawashima':value('Marca'),category:p.categoria??value('Categoria'),length_mm,width_mm,height_mm,net_weight:number(value('Peso líquido')),gross_weight:number(value('Peso bruto')),photo_url:photo??null,specifications:JSON.parse(JSON.stringify({...specs,Descrição:p.descricao??''})),dimension_status:dimensionsStatus({length_mm,width_mm,height_mm}),source:'Site oficial CCM do Brasil',official_url:`https://ccmdobrasil.com.br/produto/${expectedCode}`,last_checked_at:new Date().toISOString(),situation:'Ativo'};
}
export interface ProductAdapter { lookup(code:string):Promise<ReturnType<typeof parseOfficialProduct>|null> }
export const ccmAdapter:ProductAdapter={async lookup(code){
 const response=await fetch(`https://ccmdobrasil.com.br/CCM/site/getProduto?id=${encodeURIComponent(code)}`,{signal:AbortSignal.timeout(20000),redirect:'error',headers:{Accept:'application/json'}});
 if(response.status===404)return null;
 if(!response.ok)throw new Error('O site oficial está indisponível. Revise os dados manualmente ou tente novamente.');
 const text=await response.text();if(text.length>3_000_000)throw new Error('Resposta do site oficial excedeu o limite.');
 const json=JSON.parse(text);if(!json||!json.nome)return null;return parseOfficialProduct(json,code);
}};

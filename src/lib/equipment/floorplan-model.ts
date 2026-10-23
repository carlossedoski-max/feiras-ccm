import { MaxRectsPacker } from 'maxrects-packer';
import type { Equipment, Item, Plan } from './model';
export type Rect={x:number;y:number;width:number;depth:number};
export type Config={width:number;depth:number;standWidth:number;standDepth:number;gap:number;circulationPercent:number;entrance:number;reserved:Rect[]};
export type Position={x:number;y:number;rotation:number;area:'internal'|'external'};
export type Layout={version:1;config:Config;positions:Record<string,Position>};
export type Unit={key:string;item:Item;equipment?:Equipment;width:number;depth:number;area:'internal'|'external';needsReview:boolean};
export function defaultLayout(plan:Plan):Layout{return {version:1,config:{width:plan.terrain_width,depth:plan.terrain_depth,standWidth:plan.stand_width,standDepth:plan.stand_depth,gap:0.5,circulationPercent:plan.circulation_percent,entrance:plan.terrain_width/2,reserved:[]},positions:{}};}
export function readLayout(plan:Plan):Layout{const value=plan.floorplan as unknown as Layout|null;return value?.version===1&&value.config&&value.positions?value:defaultLayout(plan);}
export function unitsFor(items:Item[],catalog:Equipment[]):Unit[]{return items.filter(i=>i.included&&!i.deleted_at&&i.location!=='Fora do cálculo de área').flatMap(item=>{const equipment=catalog.find(e=>e.id===item.equipment_id);return Array.from({length:item.quantity},(_,n)=>({key:`${item.id}:${n}`,item,equipment,width:(equipment?.length_mm??0)/1000,depth:(equipment?.width_mm??0)/1000,area:item.location==='Área externa'?'external' as const:'internal' as const,needsReview:item.display_mode!=='No chão'||!['Área externa','Dentro do estande'].includes(item.location)}));});}
export function unitRect(unit:Unit,p:Position):Rect{const rotated=p.rotation%180!==0;return {x:p.x,y:p.y,width:rotated?unit.depth:unit.width,depth:rotated?unit.width:unit.depth};}
export const overlaps=(a:Rect,b:Rect)=>a.x<b.x+b.width-1e-6&&a.x+a.width>b.x+1e-6&&a.y<b.y+b.depth-1e-6&&a.y+a.depth>b.y+1e-6;
export const inside=(a:Rect,b:Rect)=>a.x>=b.x-1e-6&&a.y>=b.y-1e-6&&a.x+a.width<=b.x+b.width+1e-6&&a.y+a.depth<=b.y+b.depth+1e-6;
export function validateLayout(layout:Layout,units:Unit[]){
 const c=layout.config,terrain={x:0,y:0,width:c.width,depth:c.depth},stand={x:0,y:0,width:c.standWidth,depth:c.standDepth};
 const issues:Record<string,string[]>={},statuses:Record<string,'valid'|'conflict'|'review'|'unplaced'>={};
 let equipmentArea=0,placed=0,missing=0,conflicts=0,review=0;
 const rects=units.filter(u=>u.width>0&&u.depth>0&&layout.positions[u.key]).map(u=>({unit:u,rect:unitRect(u,layout.positions[u.key])}));
 for(const u of units){const p=layout.positions[u.key],messages:string[]=[];let conflict=false;
  if(u.width<=0||u.depth<=0){missing++;messages.push('Sem comprimento ou largura');statuses[u.key]='review';issues[u.key]=messages;continue;}
  equipmentArea+=u.width*u.depth;
  if(!p){statuses[u.key]='unplaced';issues[u.key]=['Ainda não posicionado'];continue;}
  placed++;const r=unitRect(u,p);
  if(!inside(r,terrain)){messages.push('Fora do terreno');conflict=true;}
  if(p.area!==u.area||(u.area==='internal'?!inside(r,stand):overlaps(r,stand))){messages.push('Área de exposição incorreta');conflict=true;}
  if(c.reserved.some(a=>overlaps(r,a))){messages.push('Ocupa corredor ou área reservada');conflict=true;}
  for(const other of rects){if(other.unit.key===u.key)continue;if(overlaps(r,other.rect)){if(!messages.includes('Sobreposição'))messages.push('Sobreposição');conflict=true;}else if(c.gap>0&&overlaps({x:r.x-c.gap/2,y:r.y-c.gap/2,width:r.width+c.gap,depth:r.depth+c.gap},{x:other.rect.x-c.gap/2,y:other.rect.y-c.gap/2,width:other.rect.width+c.gap,depth:other.rect.depth+c.gap})){if(!messages.includes('Circulação reduzida'))messages.push('Circulação reduzida');}}
  if(u.needsReview)messages.push('Conferir forma de exposição');
  if(conflict){conflicts++;statuses[u.key]='conflict';}else if(messages.length){review++;statuses[u.key]='review';}else statuses[u.key]='valid';issues[u.key]=messages;
 }
 const total=c.width*c.depth,standArea=c.standWidth*c.standDepth,reserved=c.reserved.reduce((a,r)=>a+r.width*r.depth,0),circulation=equipmentArea*c.circulationPercent/100,occupied=equipmentArea+reserved+circulation,percent=total>0?occupied/total*100:0;
 const unplaced=units.length-placed-missing;
 const configValid=c.width>0&&c.depth>0&&c.standWidth>=0&&c.standDepth>=0&&c.standWidth<=c.width&&c.standDepth<=c.depth&&c.reserved.every(r=>inside(r,terrain)&&r.width>0&&r.depth>0);
 const result=conflicts||percent>100?'NÃO CABE NO ESPAÇO':!configValid||missing||unplaced||review||percent>80?'CABE COM ATENÇÃO':'CABE NO ESPAÇO';
 return {issues,statuses,total,standArea,equipmentArea,reserved,circulation,occupied,free:total-occupied,percent,quantity:units.length,placed,unplaced,missing,conflicts,result,configValid};
}
export function autoArrange(layout:Layout,units:Unit[]):Layout{
 const c=layout.config,positions:Record<string,Position>={};
 const areas=[{area:'internal',x:0,y:0,width:c.standWidth,depth:c.standDepth},{area:'external',x:0,y:c.standDepth,width:c.width,depth:c.depth-c.standDepth},{area:'external',x:c.standWidth,y:0,width:c.width-c.standWidth,depth:c.standDepth}];
 for(const a of areas){if(a.width<=0||a.depth<=0)continue;
  const packer=new MaxRectsPacker(a.width*1000,a.depth*1000,c.gap*1000,{smart:false,pot:false,square:false,allowRotation:true});
  const candidates=units.filter(u=>u.area===a.area&&u.width>0&&u.depth>0&&!positions[u.key]);
  packer.addArray(candidates.map(u=>({width:u.width*1000,height:u.depth*1000,data:u.key})));
  for(const packed of packer.bins[0]?.rects??[]){const u=candidates.find(u=>u.key===packed.data);if(!u)continue;const p={x:a.x+(packed.x??0)/1000,y:a.y+(packed.y??0)/1000,rotation:packed.rot?90:0,area:u.area};const rect=unitRect(u,p);if(c.reserved.some(r=>overlaps(rect,r)))continue;positions[u.key]=p;}
 }
 return {...layout,positions};
}
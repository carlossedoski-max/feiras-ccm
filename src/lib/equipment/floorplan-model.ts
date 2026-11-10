import { MaxRectsPacker } from 'maxrects-packer';
import type { Equipment, Item, Plan } from './model';
export type Rect={x:number;y:number;width:number;depth:number};
export type ZoneKind='reserved'|'forbidden'|'corridor'|'wall'|'access';
export type Zone=Rect&{kind?:ZoneKind;label?:string};
export const ZONE_LABELS:Record<ZoneKind,string>={reserved:'Reserva',forbidden:'Área proibida',corridor:'Corredor',wall:'Parede',access:'Acesso'};
/** Image point in natural pixels. */
export type PxPoint={x:number;y:number};
export type Calibration={a:PxPoint;b:PxPoint;meters:number};
/** Real project plan used as background. Position/scale in metres; crop in natural image pixels. */
export type Background={path:string;name:string;pxW:number;pxH:number;x:number;y:number;mPerPx:number;rotation:number;crop:{left:number;top:number;right:number;bottom:number};opacity:number;locked:boolean;visible:boolean;calH?:Calibration;calV?:Calibration};
export type ViewSettings={grid:number;snap:boolean;guides:boolean};
export const DEFAULT_VIEW:ViewSettings={grid:1,snap:false,guides:true};
export type Config={width:number;depth:number;standWidth:number;standDepth:number;gap:number;circulationPercent:number;entrance:number;reserved:Zone[];showNumbers?:boolean};
export type Position={x:number;y:number;rotation:number;area:'internal'|'external';lengthMm?:number;widthMm?:number;label?:string};
export type Layout={version:1;config:Config;positions:Record<string,Position>;background?:Background;view?:ViewSettings};
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
  for(const a of c.reserved){if(a.kind==='access'||!overlaps(r,a))continue;const m=a.kind==='forbidden'?'Ocupa área proibida':a.kind==='wall'?'Atravessa parede':'Ocupa corredor ou área reservada';if(!messages.includes(m))messages.push(m);conflict=true;}
  for(const other of rects){if(other.unit.key===u.key)continue;if(overlaps(r,other.rect)){if(!messages.includes('Sobreposição'))messages.push('Sobreposição');conflict=true;}else if(c.gap>0&&overlaps({x:r.x-c.gap/2,y:r.y-c.gap/2,width:r.width+c.gap,depth:r.depth+c.gap},{x:other.rect.x-c.gap/2,y:other.rect.y-c.gap/2,width:other.rect.width+c.gap,depth:other.rect.depth+c.gap})){if(!messages.includes('Circulação reduzida'))messages.push('Circulação reduzida');}}
  if(u.needsReview)messages.push('Conferir forma de exposição');
  if(conflict){conflicts++;statuses[u.key]='conflict';}else if(messages.length){review++;statuses[u.key]='review';}else statuses[u.key]='valid';issues[u.key]=messages;
 }
 const total=c.width*c.depth,standArea=c.standWidth*c.standDepth,reserved=c.reserved.filter(r=>r.kind!=='access'&&r.kind!=='wall').reduce((a,r)=>a+r.width*r.depth,0),circulation=equipmentArea*c.circulationPercent/100,occupied=equipmentArea+reserved+circulation,percent=total>0?occupied/total*100:0;
 const unplaced=units.length-placed-missing;
 const configValid=Object.entries(c).filter(([key])=>key!=='reserved'&&key!=='showNumbers').every(([,v])=>typeof v==='number'&&Number.isFinite(v))&&c.width>0&&c.depth>0&&c.standWidth>=0&&c.standDepth>=0&&c.standWidth<=c.width&&c.standDepth<=c.depth&&c.gap>=0&&c.circulationPercent>=0&&c.entrance>=0&&c.entrance<=c.width&&c.reserved.every((r,i)=>inside(r,terrain)&&r.width>0&&r.depth>0&&((r.kind??'reserved')!=='reserved'||!c.reserved.slice(i+1).some(other=>(other.kind??'reserved')==='reserved'&&overlaps(r,other))));
 const result=conflicts||percent>100?'NÃO CABE NO ESPAÇO':!configValid||missing||unplaced||review||percent>80?'CABE COM ATENÇÃO':'CABE NO ESPAÇO';
 return {issues,statuses,total,standArea,equipmentArea,reserved,circulation,occupied,free:total-occupied,percent,quantity:units.length,placed,unplaced,missing,conflicts,result,configValid};
}
export function autoArrange(layout:Layout,units:Unit[]):Layout{
 const c=layout.config,positions:Record<string,Position>={};
 let areas=[{area:'internal',x:0,y:0,width:c.standWidth,depth:c.standDepth},{area:'external',x:0,y:c.standDepth,width:c.width,depth:c.depth-c.standDepth},{area:'external',x:c.standWidth,y:0,width:c.width-c.standWidth,depth:c.standDepth}];
 for(const obstacle of c.reserved.filter(o=>o.kind!=='access')){areas=areas.flatMap(a=>{if(!overlaps(a,obstacle))return [a];const left=Math.max(a.x,obstacle.x),right=Math.min(a.x+a.width,obstacle.x+obstacle.width),top=Math.max(a.y,obstacle.y),bottom=Math.min(a.y+a.depth,obstacle.y+obstacle.depth);return [{...a,depth:top-a.y},{...a,y:bottom,depth:a.y+a.depth-bottom},{...a,y:top,width:left-a.x,depth:bottom-top},{...a,x:right,y:top,width:a.x+a.width-right,depth:bottom-top}].filter(r=>r.width>0&&r.depth>0);});}
 for(const a of areas){if(a.width<=0||a.depth<=0)continue;
  const packer=new MaxRectsPacker(a.width*1000,a.depth*1000,c.gap*1000,{smart:false,pot:false,square:false,allowRotation:true});
  const candidates=units.filter(u=>u.area===a.area&&u.width>0&&u.depth>0&&!positions[u.key]);
  packer.addArray(candidates.map(u=>({width:u.width*1000,height:u.depth*1000,data:u.key})));
  for(const packed of packer.bins[0]?.rects??[]){const u=candidates.find(u=>u.key===packed.data);if(!u)continue;const p={x:a.x+(packed.x??0)/1000,y:a.y+(packed.y??0)/1000,rotation:packed.rot?90:0,area:u.area};const rect=unitRect(u,p);if(!inside(rect,a)||c.reserved.some(r=>r.kind!=='access'&&overlaps(rect,r))||units.some(other=>{const old=positions[other.key];if(!old)return false;const r=unitRect(other,old);return overlaps({x:rect.x-c.gap/2,y:rect.y-c.gap/2,width:rect.width+c.gap,depth:rect.depth+c.gap},{x:r.x-c.gap/2,y:r.y-c.gap/2,width:r.width+c.gap,depth:r.depth+c.gap});}))continue;positions[u.key]=p;}
 }
 return {...layout,positions};
}
/** Label drawn on a unit: catalog plan code (or product code), with optional per-unit numbering when the item has several units. */
export function unitLabel(u:Unit,showNumbers=true){const base=u.equipment?.plan_code||u.equipment?.ccm_code||'';return showNumbers&&u.item.quantity>1?`${base} – ${Number(u.key.split(':')[1])+1}`:base;}

/** Metres per image pixel from two clicked points and their real distance. */
export function calibrationScale(cal:Calibration){const d=Math.hypot(cal.b.x-cal.a.x,cal.b.y-cal.a.y);return d>0&&cal.meters>0?cal.meters/d:0;}
/** Compares horizontal and vertical calibrations; more than 2% difference suggests a distorted image. */
export function calibrationCheck(bg:Background){const h=bg.calH?calibrationScale(bg.calH):0,v=bg.calV?calibrationScale(bg.calV):0;const diff=h>0&&v>0?Math.abs(h-v)/Math.max(h,v)*100:0;return {h,v,diff,distorted:diff>2};}
export function newBackground(path:string,name:string,pxW:number,pxH:number,terrainWidth:number):Background{return {path,name,pxW,pxH,x:0,y:0,mPerPx:Math.max(terrainWidth,1)/pxW,rotation:0,crop:{left:0,top:0,right:0,bottom:0},opacity:0.6,locked:false,visible:true};}
export const snapTo=(v:number,grid:number)=>grid>0?Math.round(v/grid)*grid:v;
/** Free distance from a rectangle to its nearest neighbour (or terrain edge) in each direction, in metres. */
export function gapsAround(r:Rect,others:Rect[],terrain:Rect){
 const crossY=(o:Rect)=>o.y<r.y+r.depth-1e-6&&o.y+o.depth>r.y+1e-6,crossX=(o:Rect)=>o.x<r.x+r.width-1e-6&&o.x+o.width>r.x+1e-6;
 const pick=(vals:{d:number;other:boolean}[],edge:number)=>{const ok=vals.filter(v=>v.d>=-1e-6);const best=ok.reduce((m,v)=>v.d<m.d?v:m,{d:edge,other:false});return {distance:Math.max(0,best.d),toEquipment:best.other};};
 return {left:pick(others.filter(crossY).filter(o=>o.x+o.width<=r.x+1e-6).map(o=>({d:r.x-(o.x+o.width),other:true})),r.x-terrain.x),
  right:pick(others.filter(crossY).filter(o=>o.x>=r.x+r.width-1e-6).map(o=>({d:o.x-(r.x+r.width),other:true})),terrain.x+terrain.width-(r.x+r.width)),
  top:pick(others.filter(crossX).filter(o=>o.y+o.depth<=r.y+1e-6).map(o=>({d:r.y-(o.y+o.depth),other:true})),r.y-terrain.y),
  bottom:pick(others.filter(crossX).filter(o=>o.y>=r.y+r.depth-1e-6).map(o=>({d:o.y-(r.y+r.depth),other:true})),terrain.y+terrain.depth-(r.y+r.depth))};
}
/** Edge/centre coordinates of the moving rectangle that line up with another rectangle (alignment guides). */
export function alignmentGuides(r:Rect,others:Rect[],tol=0.02){const xs=[r.x,r.x+r.width/2,r.x+r.width],ys=[r.y,r.y+r.depth/2,r.y+r.depth];const vx=new Set<number>(),hy=new Set<number>();for(const o of others){for(const x of [o.x,o.x+o.width/2,o.x+o.width])for(const m of xs)if(Math.abs(x-m)<=tol)vx.add(m);for(const y of [o.y,o.y+o.depth/2,o.y+o.depth])for(const m of ys)if(Math.abs(y-m)<=tol)hy.add(m);}return {vertical:[...vx],horizontal:[...hy]};}

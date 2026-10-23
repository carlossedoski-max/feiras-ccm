import type { Layout, Unit } from './floorplan-model';
import { validateLayout } from './floorplan-model';
import type { FairSummary, Plan } from './model';
export async function floorplanImage(svg:SVGSVGElement,layout:Layout,units:Unit[],fair:FairSummary,plan:Plan){
 const clone=svg.cloneNode(true) as SVGSVGElement;clone.querySelector('g')?.removeAttribute('transform');
 const originals=svg.querySelectorAll('*'),copies=clone.querySelectorAll('*');
 originals.forEach((el,i)=>{const target=copies[i];if(!target)return;const style=getComputedStyle(el);for(const key of ['fill','stroke','stroke-width','font-family','font-size','font-weight'])target.style.setProperty(key,style.getPropertyValue(key));});
 clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.setAttribute('width','1400');clone.setAttribute('height','1000');
 const blob=new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml'}),url=URL.createObjectURL(blob),image=new Image();
 try{await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('Não foi possível exportar a planta'));image.src=url;});
 const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=1400;const ctx=canvas.getContext('2d');if(!ctx)throw Error('Exportação indisponível');
 const root=getComputedStyle(document.documentElement);ctx.fillStyle=root.getPropertyValue('--card').trim();ctx.fillRect(0,0,1600,1400);ctx.fillStyle=root.getPropertyValue('--foreground').trim();ctx.font='bold 28px sans-serif';ctx.fillText(`${fair.name} · ${plan.edition_year} — Planta 2D`,40,45);ctx.drawImage(image,100,70,1400,1000);
 const s=validateLayout(layout,units),c=layout.config;ctx.font='20px sans-serif';const lines=[`Terreno: ${c.width} × ${c.depth} m · Estande: ${c.standWidth} × ${c.standDepth} m`,`${s.result} · Ocupação: ${s.percent.toFixed(1)}% · Área livre: ${s.free.toFixed(2)} m²`,`Equipamentos: ${s.quantity} · Não posicionados: ${s.unplaced} · Conflitos: ${s.conflicts} · Sem dimensões: ${s.missing}`,`Circulação: ${c.circulationPercent}% / ${s.circulation.toFixed(2)} m² · Margem: ${c.gap} m`,`Verde: correto · Vermelho: conflito · Amarelo: conferir · Cinza: não posicionado`,`Atualização: ${new Date(plan.floorplan_updated_at??plan.updated_at).toLocaleString('pt-BR')}`];lines.forEach((line,i)=>ctx.fillText(line,40,1100+i*35));return canvas.toDataURL('image/png');
 }finally{URL.revokeObjectURL(url);}
}
export async function exportFloorplan(svg:SVGSVGElement,layout:Layout,units:Unit[],fair:FairSummary,plan:Plan,format:'png'|'pdf'|'print'){
 const image=await floorplanImage(svg,layout,units,fair,plan);
 if(format==='png'){const a=document.createElement('a');a.href=image;a.download=`planta-${plan.edition_year}.png`;a.click();return;}
 const {jsPDF}=await import('jspdf');const doc=new jsPDF({orientation:'landscape'});doc.addImage(image,'PNG',10,8,277,242);
 if(format==='print'){doc.autoPrint();const url=doc.output('bloburl');window.open(url,'_blank','noopener');}else doc.save(`planta-${plan.edition_year}.pdf`);
}
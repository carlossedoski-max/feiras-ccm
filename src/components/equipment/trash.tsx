import { useState } from 'react';
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { equipmentQuery, equipmentTrashQuery, managePlan } from '@/lib/equipment/data';
import { areaFmt, type Plan } from '@/lib/equipment/model';
import { PlanDeletionDialog } from './plan-deletion';
export function EquipmentTrash(){
 const {data}=useSuspenseQuery(equipmentTrashQuery),{data:active}=useSuspenseQuery(equipmentQuery),qc=useQueryClient();
 const [busy,setBusy]=useState(false),[purging,setPurging]=useState<Plan|null>(null);
 const quantity=(id:string)=>data.items.filter(i=>i.plan_id===id).reduce((sum,i)=>sum+i.quantity,0);
 const name=(p:Plan)=>active.fairs.find(f=>f.id===p.fair_id)?.name??'Feira';
 async function run(p:Plan,action:'restore'|'purge'){setBusy(true);try{await managePlan(p.id,action,action==='purge'?'EXCLUIR':'');await qc.invalidateQueries({queryKey:['equipment']});setPurging(null);toast.success(action==='restore'?'Planejamento restaurado.':'Planejamento excluído definitivamente.');}catch(e){toast.error(e instanceof Error?e.message:'Não foi possível concluir.');}finally{setBusy(false);}}
 return <div className="space-y-4"><h2 className="text-lg font-semibold">Lixeira de planejamentos</h2>{data.plans.map(p=><div key={p.id} className="flex flex-wrap items-center justify-between gap-4 rounded-md border p-4"><div className="min-w-0 text-sm"><h3 className="font-semibold">{name(p)} · {p.edition_year}</h3><p className="mt-1 text-muted-foreground">{quantity(p.id)} equipamentos · {areaFmt(p.total_area)} m²</p><p className="mt-1 break-all text-xs text-muted-foreground">Excluído em {new Date(p.deleted_at??'').toLocaleString('pt-BR')} · Responsável: {p.deleted_by_name??(p.deleted_by?'Usuário registrado':'Não informado')}</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={()=>{void run(p,'restore');}}><RotateCcw className="h-4 w-4"/>Restaurar</Button><Button variant="destructive" aria-label={`Excluir definitivamente ${name(p)} ${p.edition_year}`} title="Excluir definitivamente" size="icon" disabled={busy} onClick={()=>setPurging(p)}><Trash2 className="h-4 w-4"/></Button></div></div>)}{!data.plans.length&&<p className="border-y py-12 text-center text-sm text-muted-foreground">Nenhum planejamento na Lixeira.</p>}{purging&&<PlanDeletionDialog plan={purging} fairName={name(purging)} quantity={quantity(purging.id)} purge busy={busy} onClose={()=>setPurging(null)} onConfirm={()=>run(purging,'purge')}/>}</div>;
}
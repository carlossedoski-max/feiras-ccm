import { useState } from 'react';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { areaFmt, canConfirmDeletion, type Plan } from '@/lib/equipment/model';

export function PlanDeletionDialog({plan,fairName,quantity,purge=false,busy,onClose,onConfirm}:{plan:Plan;fairName:string;quantity:number;purge?:boolean;busy:boolean;onClose:()=>void;onConfirm:()=>Promise<void>}){
 const [confirmation,setConfirmation]=useState('');
 return <Dialog open onOpenChange={v=>{if(!v&&!busy)onClose();}}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{purge?'Excluir planejamento definitivamente':'Excluir planejamento'}</DialogTitle><DialogDescription>{purge?'Esta ação é irreversível.':'O planejamento será enviado à Lixeira e poderá ser restaurado.'}</DialogDescription></DialogHeader><dl className="grid grid-cols-2 gap-3 text-sm"><dt>Feira</dt><dd className="break-words font-medium">{fairName}</dd><dt>Ano</dt><dd>{plan.edition_year}</dd><dt>Equipamentos</dt><dd>{quantity}</dd><dt>Área planejada</dt><dd>{areaFmt(plan.total_area)} m²</dd></dl><p className="text-sm text-destructive">Esta ação removerá todo o planejamento e sua lista de equipamentos. O catálogo central de produtos não será afetado.</p><label className="space-y-2 text-sm"><span>Digite EXCLUIR para confirmar</span><Input aria-label="Digite EXCLUIR" autoComplete="off" value={confirmation} onChange={e=>setConfirmation(e.target.value)} disabled={busy}/></label><div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button><Button className="h-auto min-h-10 whitespace-normal" variant="destructive" disabled={busy||!canConfirmDeletion(confirmation)} onClick={()=>{void onConfirm();}}>{busy?'Excluindo…':purge?'Excluir planejamento definitivamente':'Enviar planejamento à Lixeira'}</Button></div></DialogContent></Dialog>;
}
export function PlanActions({busy,onDelete}:{busy:boolean;onDelete:()=>void}){
 return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="Ações do planejamento" title="Ações do planejamento" disabled={busy}><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem className="text-destructive" onSelect={onDelete}><Trash2 className="h-4 w-4"/>Excluir planejamento</DropdownMenuItem></DropdownMenuContent></DropdownMenu>;
}
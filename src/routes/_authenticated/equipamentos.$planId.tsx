import { createFileRoute } from '@tanstack/react-router';
import { equipmentQuery } from '@/lib/equipment/data';
import { equipmentHead } from '@/lib/equipment/meta';
import { EquipmentWorkspace } from '@/components/equipment/workspace';
export const Route=createFileRoute('/_authenticated/equipamentos/$planId')({loader:({context})=>context.queryClient.ensureQueryData(equipmentQuery),head:()=>equipmentHead('Planejamento da feira','Lista de equipamentos, reservas de área, importação e comparação entre edições.'),component:EquipmentDetail});
function EquipmentDetail(){const {planId}=Route.useParams();return <EquipmentWorkspace planId={planId}/>;}

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const MAP: Record<string, string> = {
  // Fair
  "Em análise": "bg-muted text-foreground",
  "Aguardando aprovação": "bg-warning/15 text-warning-foreground border-warning/40",
  "Confirmada": "bg-info/15 text-info border-info/40",
  "Em preparação": "bg-accent text-accent-foreground border-primary/30",
  "Em andamento": "bg-primary/15 text-primary border-primary/40",
  "Finalizada": "bg-success/15 text-success border-success/40",
  "Cancelada": "bg-destructive/15 text-destructive border-destructive/40",
  "Arquivada": "bg-secondary/15 text-secondary-foreground border-secondary/30",
  // Generic
  "Pendente": "bg-warning/15 text-warning-foreground border-warning/40",
  "Em andamento ": "bg-info/15 text-info border-info/40",
  "Concluído": "bg-success/15 text-success border-success/40",
  "Atrasado": "bg-destructive/15 text-destructive border-destructive/40",
  "Não se aplica": "bg-muted text-muted-foreground",
  // Payment
  "Aguardando orçamento": "bg-muted text-muted-foreground",
  "Aguardando aprovação ": "bg-warning/15 text-warning-foreground",
  "Aguardando pagamento": "bg-warning/15 text-warning-foreground border-warning/40",
  "Pago": "bg-success/15 text-success border-success/40",
  // Documents
  "Recebido": "bg-info/15 text-info border-info/40",
  "Enviado para assinatura": "bg-warning/15 text-warning-foreground border-warning/40",
  "Assinado": "bg-success/15 text-success border-success/40",
  "Arquivado": "bg-muted text-muted-foreground",
  // Credentials
  "Solicitada": "bg-warning/15 text-warning-foreground border-warning/40",
  "Aprovada": "bg-info/15 text-info border-info/40",
  "Enviada ao participante": "bg-success/15 text-success border-success/40",
  // Logistic
  "A definir": "bg-muted text-muted-foreground",
  "Separar": "bg-warning/15 text-warning-foreground border-warning/40",
  "Separado": "bg-info/15 text-info border-info/40",
  "Enviado": "bg-info/15 text-info border-info/40",
  "Recebido no evento": "bg-primary/15 text-primary border-primary/40",
  "Retornou": "bg-success/15 text-success border-success/40",
  "Pendente retorno": "bg-destructive/15 text-destructive border-destructive/40",
  "Em produção": "bg-info/15 text-info border-info/40",
};

export function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const cls = MAP[status] ?? "bg-muted text-foreground";
  return <Badge variant="outline" className={cn("border font-medium whitespace-nowrap transition-colors duration-200", cls)}>{status}</Badge>;
}

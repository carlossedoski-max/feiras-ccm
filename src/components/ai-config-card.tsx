import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAiStatus } from "@/lib/ai-config.functions";

export function AiConfigCard() {
  const { data } = useQuery({ queryKey: ["ai-status"], queryFn: () => getAiStatus() });
  const openai = data?.openai ?? false;
  const lovable = data?.lovable ?? false;

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-2 p-4 text-sm">
        {openai ? <ShieldCheck className="h-4 w-4 text-success" /> : <ShieldAlert className="h-4 w-4 text-warning" />}
        <span className="font-medium">Configuração de IA</span>
        <Badge variant={openai ? "default" : "outline"}>OpenAI API: {openai ? "configurada" : "não configurada"}</Badge>
        <Badge variant={lovable ? "default" : "outline"}>IA da plataforma: {lovable ? "disponível" : "indisponível"}</Badge>
        <span className="text-xs text-muted-foreground">
          A chave fica somente no servidor. Sem IA disponível, a ferramenta continua funcionando por template.
        </span>
      </CardContent>
    </Card>
  );
}

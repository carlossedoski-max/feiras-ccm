import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plug, ShieldCheck, ShieldAlert } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAiStatus, testGeminiConnection } from "@/lib/ai-config.functions";

export const Route = createFileRoute("/_authenticated/configuracoes-ia")({
  head: () => ({
    meta: [
      { title: "Configurações de IA — CCM Feira Control" },
      { name: "description", content: "Status da integração de IA usada na análise do manual do expositor e nos projetos por imagem da CCM do Brasil." },
      { property: "og:title", content: "Configurações de IA — CCM Feira Control" },
      { property: "og:description", content: "Verifique a conexão de IA usada pelo CCM Feira Control." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AiSettings,
});

function AiSettings() {
  const { data } = useQuery({ queryKey: ["ai-status"], queryFn: () => getAiStatus() });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; provider: string; model: string; ms: number } | null>(null);

  const gemini = data?.geminiConfigured ?? false;
  const lovable = data?.lovableConfigured ?? false;

  async function test() {
    setBusy(true);
    try {
      setResult(await testGeminiConnection());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Configurações de IA</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Diagnóstico técnico da IA usada no Manual do Expositor e nos Projetos por Imagem. A chave fica somente no servidor.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-3 p-5 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            {gemini ? <ShieldCheck className="h-4 w-4 text-success" /> : <ShieldAlert className="h-4 w-4 text-warning" />}
            <Badge variant={gemini ? "default" : "outline"}>Gemini API: {gemini ? "configurada" : "não configurada"}</Badge>
            {gemini && <Badge variant="outline">Modelo: {data?.geminiModel}</Badge>}
            <Badge variant={lovable ? "default" : "outline"}>IA da plataforma: {lovable ? "disponível" : "indisponível"}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Quando a Gemini API não responde, a ferramenta usa automaticamente a IA da plataforma.
          </p>
          <Button onClick={() => void test()} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />} Testar conexão
          </Button>
          {result && (
            <p className={result.ok ? "text-success" : "text-destructive"}>
              {result.message} {result.ok ? `(${result.provider} · ${result.model} · ${result.ms}ms)` : ""}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

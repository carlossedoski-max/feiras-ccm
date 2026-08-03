import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogIn, UserPlus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — CCM Feira Control" },
      { name: "description", content: "Acesse a área de fornecedores da ferramenta de gestão de feiras da CCM do Brasil." },
      { property: "og:title", content: "Entrar — CCM Feira Control" },
      { property: "og:description", content: "Acesse a área de fornecedores da ferramenta de gestão de feiras da CCM do Brasil." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/auxilio", replace: true });
    });
  }, [navigate]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      toast.error(error.message.includes("Invalid login") ? "E-mail ou senha incorretos." : error.message);
      return;
    }
    toast.success("Bem-vindo!");
    navigate({ to: "/auxilio", replace: true });
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) { toast.error("A senha precisa ter ao menos 6 caracteres."); return; }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: window.location.origin + "/auxilio" },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message.includes("already registered") ? "Este e-mail já está cadastrado." : error.message);
      return;
    }
    if (data.session) { navigate({ to: "/auxilio", replace: true }); return; }
    setSent(true);
    toast.success("Cadastro criado! Confirme o e-mail para entrar.");
  }

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center py-8">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold">Área de Fornecedores</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Entre com sua conta para acessar o cadastro de fornecedores da equipe.
        </p>
      </div>

      {sent ? (
        <Card>
          <CardHeader>
            <CardTitle>Confirme seu e-mail</CardTitle>
            <CardDescription>
              Enviamos um link de confirmação para <strong>{email}</strong>. Depois de confirmar, volte aqui e entre com sua senha.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" onClick={() => setSent(false)}>Voltar</Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="login">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Entrar</TabsTrigger>
            <TabsTrigger value="signup">Criar conta</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <Card>
              <CardContent className="pt-6">
                <form onSubmit={signIn} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="login-email">E-mail</Label>
                    <Input id="login-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@ccmdobrasil.com.br" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="login-password">Senha</Label>
                    <Input id="login-password" type="password" required value={password} onChange={e => setPassword(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />} Entrar
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="signup">
            <Card>
              <CardContent className="pt-6">
                <form onSubmit={signUp} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="su-email">E-mail</Label>
                    <Input id="su-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@ccmdobrasil.com.br" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-password">Senha</Label>
                    <Input id="su-password" type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo de 6 caracteres" />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Criar conta
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

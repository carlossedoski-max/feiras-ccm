import { supabase } from "@/integrations/supabase/client";

export const SUPPLIER_SERVICE_TYPES = [
  "Montadora de estande", "Limpeza", "Segurança", "Transporte", "Gráfica", "Brindes",
  "Comunicação visual", "Locação de móveis", "Energia elétrica", "Internet",
  "Fotografia/vídeo", "Hospedagem", "Alimentação", "Organização do evento", "Outro",
] as const;

export const HOW_WE_MET = [
  "Indicação", "Entrou em contato conosco", "Encontrado em feira", "Pesquisa na internet",
  "Já contratado anteriormente", "Organização do evento", "Outro",
] as const;

export const SUPPLIER_STATUSES = [
  "Novo contato", "Em análise", "Orçamento solicitado", "Orçamento recebido",
  "Aprovado para cotação", "Contratado", "Não aprovado", "Arquivado",
] as const;

export const APPROVED_OPTIONS = ["Sim", "Não", "Avaliar futuramente"] as const;

export const CONTACT_CHANNELS = ["WhatsApp", "E-mail", "Ligação", "Reunião", "Presencial", "Outro"] as const;

export const UF_LIST = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR",
  "PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
] as const;

export interface Supplier {
  id: string;
  name: string;
  contact_name: string | null;
  whatsapp: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  service_type: string;
  related_event: string | null;
  how_we_met: string | null;
  status: string;
  approved: string;
  favorite: boolean;
  notes: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  attachment_uploaded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupplierContact {
  id: string;
  supplier_id: string;
  contact_date: string;
  channel: string;
  description: string | null;
  next_action: string | null;
  responsible: string | null;
  created_at: string;
}

export type SupplierInput = Omit<Supplier, "id" | "created_at" | "updated_at">;

export const BUCKET = "supplier-files";
export const ACCEPTED_FILE_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export function emptySupplier(): SupplierInput {
  return {
    name: "", contact_name: "", whatsapp: "", phone: "", email: "", city: "", state: "",
    service_type: "Montadora de estande", related_event: "", how_we_met: "Indicação",
    status: "Novo contato", approved: "Avaliar futuramente", favorite: false, notes: "",
    attachment_path: null, attachment_name: null, attachment_type: null, attachment_uploaded_at: null,
  };
}

// ---- Queries ----
export async function fetchSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Supplier[];
}

export async function fetchAllContacts(): Promise<SupplierContact[]> {
  const { data, error } = await supabase
    .from("supplier_contacts")
    .select("*")
    .order("contact_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as SupplierContact[];
}

export async function saveSupplier(input: SupplierInput, id?: string): Promise<Supplier> {
  if (id) {
    const { data, error } = await supabase
      .from("suppliers")
      .update(input as never)
      .eq("id", id).select().single();
    if (error) throw error;
    return data as unknown as Supplier;
  }
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("suppliers")
    .insert({ ...input, created_by: userData.user?.id ?? null } as never)
    .select().single();
  if (error) throw error;
  return data as unknown as Supplier;
}

export async function patchSupplier(id: string, patch: Partial<SupplierInput>) {
  const { error } = await supabase.from("suppliers").update(patch as never).eq("id", id);
  if (error) throw error;
}

export async function deleteSupplier(s: Supplier) {
  if (s.attachment_path) {
    await supabase.storage.from(BUCKET).remove([s.attachment_path]);
  }
  const { error } = await supabase.from("suppliers").delete().eq("id", s.id);
  if (error) throw error;
}

export async function addContactLog(input: Omit<SupplierContact, "id" | "created_at">) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("supplier_contacts")
    .insert({ ...input, created_by: userData.user?.id ?? null } as never);
  if (error) throw error;
}
  if (error) throw error;
}

export async function deleteContactLog(id: string) {
  const { error } = await supabase.from("supplier_contacts").delete().eq("id", id);
  if (error) throw error;
}

// ---- Storage ----
export async function uploadAttachment(file: File): Promise<{ path: string; name: string; type: string }> {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
  if (error) throw error;
  return { path, name: file.name, type: file.type };
}

export async function removeAttachment(path: string) {
  await supabase.storage.from(BUCKET).remove([path]);
}

export async function signedUrl(path: string, download = false): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600, { download });
  if (error) throw error;
  return data.signedUrl;
}

// ---- Message templates ----
export type MessageTemplateKey = "orcamento" | "retorno" | "agradecimento" | "arquivamento";

export const MESSAGE_TEMPLATES: { key: MessageTemplateKey; label: string; build: (s: Supplier) => string }[] = [
  {
    key: "orcamento",
    label: "Solicitação de orçamento",
    build: (s) =>
      `Olá${s.contact_name ? `, ${s.contact_name}` : ""}! Aqui é do time de Marketing da CCM do Brasil.\n\n` +
      `Estamos organizando nossa participação em feiras e gostaríamos de solicitar um orçamento de ${s.service_type.toLowerCase()}` +
      `${s.related_event ? ` para o evento ${s.related_event}` : ""}.\n\n` +
      `Poderia nos enviar uma proposta com valores, prazos e condições de pagamento?\n\nFicamos no aguardo. Obrigado!`,
  },
  {
    key: "retorno",
    label: "Retorno — aguardando proposta",
    build: (s) =>
      `Olá${s.contact_name ? `, ${s.contact_name}` : ""}! Tudo bem?\n\n` +
      `Passando para saber se conseguiu avançar com a proposta de ${s.service_type.toLowerCase()}` +
      `${s.related_event ? ` para o evento ${s.related_event}` : ""} que solicitamos.\n\n` +
      `Estamos finalizando nosso planejamento e precisamos do valor para seguir. Obrigado!`,
  },
  {
    key: "agradecimento",
    label: "Agradecimento pelo atendimento",
    build: (s) =>
      `Olá${s.contact_name ? `, ${s.contact_name}` : ""}!\n\n` +
      `Obrigado pelo atendimento e pelo envio da proposta de ${s.service_type.toLowerCase()}.\n\n` +
      `Recebemos as informações e vamos avaliar internamente. Retornamos em breve com uma posição.\n\nAbraço, time de Marketing — CCM do Brasil.`,
  },
  {
    key: "arquivamento",
    label: "Retorno negativo / arquivamento",
    build: (s) =>
      `Olá${s.contact_name ? `, ${s.contact_name}` : ""}!\n\n` +
      `Agradecemos muito a proposta de ${s.service_type.toLowerCase()}. Neste momento seguiremos com outra opção, ` +
      `mas mantivemos seu contato em nosso cadastro para futuras cotações.\n\nObrigado pela atenção!`,
  },
];

export function whatsappLink(number: string, text?: string) {
  const digits = number.replace(/\D/g, "");
  const full = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${full}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

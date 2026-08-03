# Aba Auxílio — Cadastro Rápido de Fornecedores

Nova aba no menu principal, com banco de dados e login. As feiras continuam salvas no navegador (sem mudanças).

## 1. Login (necessário para o banco)

- Ativar o Lovable Cloud (banco + armazenamento de arquivos).
- Nova página `/auth` com cadastro e entrada por e-mail e senha.
- A aba Auxílio só abre para usuário logado; o resto da ferramenta continua como está.
- Todos os usuários logados da equipe enxergam e editam os mesmos fornecedores (base compartilhada do marketing).
- Botão de sair no cabeçalho quando logado.

## 2. Nova aba "Auxílio" no menu principal

Ao lado de Dashboard e Feiras. Mesma identidade visual (vermelho CCM / grafite / branco).

### Cards de resumo (topo)
Total cadastrados, Novos contatos, Orçamentos solicitados, Orçamentos recebidos, Aprovados, Contratados, Arquivados. Clicáveis para filtrar a tabela.

### Seção "Cadastro Rápido de Fornecedores"
Texto explicativo + botão destacado **+ Novo fornecedor** (abre formulário em diálogo).

Campos: nome do fornecedor, nome do contato, WhatsApp, telefone, e-mail, cidade, estado (UF), tipo de serviço, evento relacionado, como conhecemos, status, fornecedor aprovado para futuras cotações (Sim / Não / Avaliar futuramente), favorito, observações, anexo.

Listas exatamente como especificadas:
- Tipo de serviço: Montadora de estande, Limpeza, Segurança, Transporte, Gráfica, Brindes, Comunicação visual, Locação de móveis, Energia elétrica, Internet, Fotografia/vídeo, Hospedagem, Alimentação, Organização do evento, Outro.
- Como conhecemos: Indicação, Entrou em contato conosco, Encontrado em feira, Pesquisa na internet, Já contratado anteriormente, Organização do evento, Outro.
- Status: Novo contato, Em análise, Orçamento solicitado, Orçamento recebido, Aprovado para cotação, Contratado, Não aprovado, Arquivado.

### Anexo (cartão, flyer ou apresentação)
- Upload opcional de JPG, JPEG, PNG, WEBP ou PDF, salvo no armazenamento do projeto (fica acessível de qualquer computador).
- Guarda nome do arquivo, caminho, tipo e data do upload.
- No cadastro: miniatura para imagens, link para PDF, opções de substituir e remover.
- Na tabela: coluna **Anexo** com ícone, botões Visualizar e Baixar, ou "Sem anexo".

### Tabela de fornecedores
Colunas: Nome, Contato, WhatsApp, E-mail, Cidade/UF, Tipo de serviço, Status, Evento relacionado, Anexo, Último contato, Observações.

Linhas de fornecedores aprovados ficam destacadas; favoritos com ícone de estrela.

Ações por linha: editar, excluir (com confirmação), alterar status direto na tabela, adicionar observação, marcar favorito, marcar como aprovado, copiar WhatsApp, copiar e-mail.

### Filtros e busca
Filtros: tipo de serviço, estado, status, evento relacionado, aprovado, favorito. Busca por nome do fornecedor, contato, cidade e tipo de serviço. Exportar CSV, como nas outras telas.

### Histórico de contato
Dentro de cada fornecedor, registrar: data, meio de contato (WhatsApp, E-mail, Ligação, Reunião, Presencial, Outro), descrição, próxima ação e responsável. O registro mais recente alimenta a coluna "Último contato".

### Botão "Gerar mensagem para fornecedor"
Abre modelos prontos e copiáveis, já preenchidos com o tipo de serviço do fornecedor: solicitação de orçamento, retorno aguardando proposta, agradecimento e arquivamento.

## 3. Vínculo com as feiras

Na aba Fornecedores de cada feira, botão "Importar do Auxílio": lista os fornecedores cadastrados e copia o escolhido para a feira (nome, serviço, contato, WhatsApp, e-mail). O cadastro central continua intacto e reaproveitável em feiras futuras.

## 4. Etapa seguinte (não incluída agora)

"Extrair dados da imagem" do cartão/flyer com IA, preenchendo o formulário como sugestão para revisão. Fica para depois que o upload simples estiver validado, conforme sua recomendação.

## Detalhes técnicos

- Lovable Cloud: tabelas `suppliers` e `supplier_contacts` com RLS liberada para usuários autenticados; bucket privado `supplier-files` com URLs assinadas para visualizar/baixar.
- Rota `/auxilio` sob o layout autenticado; rota pública `/auth`.
- Leitura/escrita via server functions com autenticação, sem alterar o store local das feiras.
- Reuso dos componentes atuais (Card, Table, Dialog, Select, StatusBadge) e dos tokens de cor existentes; nenhuma mudança visual nas telas atuais.

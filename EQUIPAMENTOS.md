# Planejamento de Equipamentos — entrega

## Uso e testes
1. Entre no sistema e abra **Equipamentos → Novo planejamento**, selecionando feira e ano. O botão **Planejar equipamentos** da ficha também abre esse fluxo.
2. Em **Áreas e reservas**, informe as áreas em m². A circulação começa sugerida em 25%.
3. Em **Importar lista da edição anterior**, envie `.xlsx` ou `.xls` com CÓD/COD/CÓDIGO, Quantidade, Produto, Observação e Status. Confira as linhas inválidas e duplicadas na prévia, escolha se deseja somar quantidades e confirme. Cancelar antes da confirmação não salva itens.
4. Pesquise um produto e use **Atualizar especificações**. O código original é preservado; a consulta usa apenas números. A consulta oficial de 60-00330 foi validada.
5. Produtos não encontrados podem ser revisados pelo ícone de lápis ou pelo catálogo. Informe comprimento, largura e altura em milímetros e salve. Para formas de exposição diferentes de chão, informe área manual por unidade na lista.
6. Altere a quantidade e saia do campo para salvar; a ocupação é recalculada. Marque lançamentos e ajuste prioridade, local e forma de exposição. Pendências impedem concluir que cabe.
7. Para copiar uma edição anterior, crie a edição atual com lista vazia, selecione **Usar lista da edição anterior** e confirme. A comparação mostra mantidos, retirados, adicionados e quantidades alteradas. O histórico anterior permanece inalterado.
8. Use **Excel** ou **PDF** para exportar resumo e equipamentos.

## Verificações realizadas
- 17 testes de cálculo, códigos, importação, duplicidades e comparação passaram.
- Importação com centenas de linhas, consulta oficial, edição manual e exportações verificadas em sessão autenticada.
- Cópia entre edições e leitura da comparação verificadas; alteração da quantidade e marcação de lançamento persistiram.
- Tela conferida em computador e celular, sem transbordamento horizontal da página; tabelas possuem rolagem própria.
- Dados fictícios usados nos testes foram retirados. Nenhuma publicação automática foi realizada.

## Planta 2D
Abra a subaba **Planta 2D** no planejamento. As medidas do terreno e estande são carregadas do planejamento; os ajustes da planta ficam salvos separadamente. O estande fica no canto superior esquerdo e a entrada na borda inferior.
- Arraste uma unidade da lista ou use **Colocar na planta**. Cada unidade tem posição própria. No celular, coloque pela lista e mova o bloco por toque.
- Selecione para ajustar X/Y, girar 90° ou remover somente da planta. **Excluir do planejamento** usa a confirmação existente.
- Configure a margem entre itens, circulação e reservas retangulares. **Organizar automaticamente** tenta encaixar os blocos nas áreas indicadas; itens sem encaixe ficam não posicionados, sem exclusão da lista.
- **Salvar planta** preserva configurações e posições. Salve antes de trocar de aba ou sair. A cópia de edição anterior oferece a opção de copiar também a planta.
- Exporte PDF, PNG ou imprima. O PDF completo inclui a planta salva. Limpar remove posições; excluir desenho remove a configuração salva, sem afetar equipamentos ou planejamento.
- Os resultados usam retângulos, rotações, limites, sobreposição, localização, reservas e circulação. Formas de exposição não no chão exigem conferência. A organização automática é uma tentativa de encaixe, não uma garantia de circulação acessível ou aprovação técnica.
- 37 testes passaram; salvamento/reabertura, cópia, arraste manual, toque, zoom, confirmações, PNG, PDF e relatório completo foram verificados com sessão autenticada. Dados temporários removidos; não publicado.

## Acesso
O acesso mantém o padrão atual compartilhado entre usuários autenticados, seguindo a proteção da feira vinculada.

## Tabelas adicionadas
- `equipment_catalog`: catálogo reutilizável.
- `fair_equipment_plans`: planejamento por feira e ano.
- `fair_equipment_items`: itens e escolhas de exposição.
- `equipment_import_batches`: registro de importações.

## Arquivos criados
- `src/lib/equipment/{model,data,export,meta}.ts`
- `src/lib/equipment/model.test.ts`
- `src/lib/equipment/ccm-adapter.server.ts`
- `src/lib/equipment.functions.ts`
- `src/components/equipment/{forms,import-dialog,item-table,workspace}.tsx`
- `src/routes/_authenticated/equipamentos.tsx`
- `src/routes/_authenticated/equipamentos_.$planId.tsx`
- `drizzle/migrations/0000_equipment_planning.sql`
- `drizzle/migrations/0001_equipment_parent_access_and_copy_integrity.sql`
- `roadmap.md`, `EQUIPAMENTOS.md`

## Arquivos alterados
- `src/routes/__root.tsx`: acesso pelo menu e adaptação ao tratamento de erros.
- `src/routes/_authenticated/fairs.$fairId.tsx`: botão na ficha e identificação da página.
- `src/routes/_authenticated/{index,fairs.index}.tsx`: identificação das páginas.
- `src/styles.css`: barra de ocupação com cores coerentes com o status.
- `src/integrations/supabase/types.ts`: atualização automática de tipos.
- `src/routeTree.gen.ts`: atualização automática das rotas.
- `package.json`, `bun.lock`: bibliotecas de importação, exportação e manutenção de segurança.
- `tsconfig.json`: separação dos testes do programa de tipos da aplicação.
- `AGENTS.md`: decisões estruturais do módulo.
## Catálogo oficial CCM e siglas
- “Sincronizar catálogo CCM” lê todas as subcategorias oficiais, ignora peças/acessórios (subcategoria e campo “Tipo”), atualiza por código sem duplicar e desativa (sem apagar) produtos que saíram do site.
- Dimensões vêm do campo oficial “Dimensões” (C × L × A, mm); embalagem nunca é usada. Sem medida oficial, tenta o manual PDF oficial. Fonte registrada por produto.
- Medidas e siglas editadas manualmente não são sobrescritas. “Dimensões por planilha” atualiza medidas em lote pelo código.
- Status: Pronto para planta 2D, Dimensão incompleta, Dimensão da embalagem — não utilizar, Aguardando validação, Erro na importação. Só itens prontos podem ser colocados na planta.
- Sigla na planta: gerada do modelo (ex.: BCJ 261-L → BCJ 261), editável; numeração opcional por unidade.

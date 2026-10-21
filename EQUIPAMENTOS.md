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

## Limite desta entrega
A planta 2D foi adiada, conforme alternativa autorizada no pedido. Posição e rotação estão preparadas para essa etapa. O módulo calcula áreas; não comprova encaixe físico nem ausência de sobreposições.
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
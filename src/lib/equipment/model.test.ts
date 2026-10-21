/// <reference types="bun" />
import { describe, test, expect } from 'bun:test';
import { calculatePlan, itemArea, normalizeCode, parseImportRows, mergeImportRows, compareEditions, removalSuggestions, type Equipment, type Item, type Plan } from './model';
import { parseOfficialProduct } from './ccm-adapter.server';
const equipment={id:'e',ccm_code:'60-00330',name:'Enxada',length_mm:1000,width_mm:2000,height_mm:1000} as Equipment;
const item={id:'i',equipment_id:'e',included:true,quantity:2,location:'Área externa',display_mode:'No chão',manual_area:null,priority:'Opcional',is_launch:false} as Item;
const plan={total_area:100,stand_area:50,internal_reserved:0,external_reserved:0,circulation_percent:25} as Plan;
describe('Regras de equipamentos',()=>{
 test('preserva o código original e consulta apenas números',()=>{const rows=parseImportRows([['CÓD','Quantidade','PRODUTO','Observação'],[' 60-00330 ',2,' Enxada ','sem estoque']]);expect(rows[0]?.code).toBe('60-00330');expect(normalizeCode('60-00330')).toBe('6000330');expect(normalizeCode('00-001')).toBe('00001');expect(rows[0]?.notes).toBe('sem estoque');});
 test('área em mm e quantidade',()=>{expect(itemArea(item,equipment)).toBe(4);});
 test('circulação padrão de 25%',()=>{const s=calculatePlan(plan,[item],[equipment]);expect(s.circulation).toBe(1);expect(s.occupied).toBe(5);});
 test('dimensões faltantes impedem conclusão',()=>{expect(calculatePlan(plan,[item],[{...equipment,width_mm:null}]).status).toBe('Cálculo incompleto');});
 test('até 80% cabe com folga',()=>{expect(calculatePlan({...plan,stand_area:0},[{...item,quantity:32}],[equipment]).status).toBe('Cabe com folga');});
 test('acima de 80% até 100% é próximo do limite',()=>{expect(calculatePlan({...plan,stand_area:0},[{...item,quantity:40}],[equipment]).status).toBe('Próximo do limite');});
 test('acima de 100% ultrapassa',()=>{expect(calculatePlan({...plan,stand_area:0},[{...item,quantity:41}],[equipment]).status).toBe('Espaço ultrapassado');});
 test('limite de área interna não é mascarado por saldo externo',()=>{expect(calculatePlan({...plan,stand_area:1},[{...item,location:'Dentro do estande'}],[equipment]).status).toBe('Espaço ultrapassado');});
 test('área manual de exposição é por unidade',()=>{expect(itemArea({...item,display_mode:'Em painel',manual_area:0.5},equipment)).toBe(1);});
 test('sem área manual não conta silenciosamente como zero',()=>{expect(itemArea({...item,display_mode:'Em painel'},equipment)).toBeNull();});
 test('itens excluídos do cálculo não ocupam área',()=>{expect(itemArea({...item,location:'Fora do cálculo de área'},undefined)).toBe(0);});
 test('somar duplicados mantém observações e não muta prévia',()=>{const rows=parseImportRows([['COD','Quantidade','Observação'],['60-00330',2,'sem estoque'],['6000330',3,'revisar']]);expect(mergeImportRows(rows)[0]?.quantity).toBe(5);expect(rows[0]?.quantity).toBe(2);expect(mergeImportRows(rows)[0]?.notes).toContain('sem estoque');});
 test('quantidade inválida é rejeitada na prévia',()=>{expect(parseImportRows([['COD','Quantidade'],['60-00330',0]])[0]?.error).toBeDefined();});
 test('comparação não altera histórico',()=>{const prev=[{...item,quantity:1}];expect(compareEditions([item],prev,[equipment])[0]?.change).toBe('Quantidade alterada');expect(prev[0]?.quantity).toBe(1);});
 test('sugestões só opcionais ou complementares',()=>{expect(removalSuggestions([item,{...item,id:'required',priority:'Obrigatório'}],[equipment]).map(s=>s.item.id)).toEqual(['i']);});
 test('exemplo de 100m², 50m² e 42m² deixa 8m² antes da circulação',()=>{const s=calculatePlan({...plan,circulation_percent:0},[{...item,quantity:21}],[equipment]);expect(s.externalBalance).toBe(8);});
 test('interpreta dimensões oficiais 1370 x 600 x 1400 mm',()=>{const p=parseOfficialProduct({codigo:'6000330',nome:'ENXADA ROTATIVA EPS 120 - KAWASHIMA',especificacoes:[{rotulo:'Dimensões',valores:['1370 x 600 x 1400 mm']},{rotulo:'Peso bruto',valores:['223,5 kg']}]},'6000330');expect([p.length_mm,p.width_mm,p.height_mm]).toEqual([1370,600,1400]);expect(p.gross_weight).toBe(223.5);});
});

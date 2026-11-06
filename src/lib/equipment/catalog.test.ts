import { describe, expect, test } from 'bun:test';
import { generatePlanCode, parseDimensions, isCompleteEquipment, planStatus } from './model';
import { fitLabel } from '../../components/equipment/floorplan-scene';
const base={height_mm:null,dimension_source:'Cadastro oficial',packaging_dimensions:'',sync_error:'',model:'BCJ 261-L',plan_code:'BCJ 261',normalized_code:'1'};
describe('catálogo CCM',()=>{
 test('sigla a partir do modelo',()=>{expect(generatePlanCode('BCJ 261-L','1')).toBe('BCJ 261');expect(generatePlanCode('GGH 8500','1')).toBe('GGH 8500');expect(generatePlanCode('','60-00330')).toBe('60-00330');});
 test('dimensões C × L × A em mm',()=>{expect(parseDimensions('1870 x 650 x 440 mm')).toEqual({length_mm:1870,width_mm:650,height_mm:440});expect(parseDimensions('187 x 65 x 44 cm')).toEqual({length_mm:1870,width_mm:650,height_mm:440});expect(parseDimensions('Pendente')).toBeNull();});
 test('exclui acessórios pela subcategoria e tipo',()=>{expect(isCompleteEquipment(['Acessórios'],'','ROÇADEIRA')).toBe(false);expect(isCompleteEquipment(['Roçadeiras'],'Cordão de partida','X')).toBe(false);expect(isCompleteEquipment(['Tratores Agrícolas'],'Trator','TRATOR TRD 254')).toBe(true);});
 test('pronto para planta somente com C e L e fonte',()=>{expect(planStatus({...base,length_mm:1870,width_mm:650})).toBe('Pronto para planta 2D');expect(planStatus({...base,length_mm:null,width_mm:null})).toBe('Dimensão incompleta');expect(planStatus({...base,length_mm:null,width_mm:null,packaging_dimensions:'1 x 2 x 3 mm'})).toBe('Dimensão da embalagem — não utilizar');expect(planStatus({...base,length_mm:1870,width_mm:650,dimension_source:''})).toBe('Aguardando validação');});
 test('sigla cabe ou recebe reticências',()=>{expect(fitLabel('BCJ 43',100,40).text).toBe('BCJ 43');expect(fitLabel('GGH 8500 – 12',30,30).text.endsWith('…')).toBe(true);});
});

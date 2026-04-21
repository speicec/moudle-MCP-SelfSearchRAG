/**
 * Relation Dictionary - 关系词典
 */

import type { ContraindicationRelation, DrugInteractionRelation } from '../types.js';

/**
 * 二甲双胍相关禁忌/慎用关系
 */
export const METFORMIN_CONTRAINDICATIONS: ContraindicationRelation[] = [
  {
    id: 'contra_metformin_egfr_30',
    drug: 'drug_metformin',
    condition: '肾功能重度下降',
    threshold: {
      indicator: 'indicator_egfr',
      operator: '<',
      value: 30,
    },
    severity: 'absolute',
    source: 'ada',
    year: 2024,
    description: 'eGFR<30 mL/min/1.73m²时禁用二甲双胍',
  },
  {
    id: 'contra_metformin_egfr_45',
    drug: 'drug_metformin',
    condition: '肾功能中度下降',
    threshold: {
      indicator: 'indicator_egfr',
      operator: '<',
      value: 45,
    },
    severity: 'relative',
    source: 'ada',
    year: 2024,
    description: 'eGFR 30-45 mL/min/1.73m²时慎用二甲双胍，需减量并密切监测肾功能',
  },
  {
    id: 'contra_metformin_lactic_acidosis',
    drug: 'drug_metformin',
    condition: '乳酸酸中毒风险',
    threshold: undefined,
    severity: 'absolute',
    source: 'ada',
    year: 2024,
    description: '存在乳酸酸中毒风险时禁用二甲双胍，如肝功能衰竭、酒精滥用、休克',
  },
];

/**
 * SGLT2抑制剂相关禁忌/慎用关系
 */
export const SGLT2_CONTRAINDICATIONS: ContraindicationRelation[] = [
  {
    id: 'contra_empagliflozin_egfr_20',
    drug: 'drug_empagliflozin',
    condition: '肾功能重度下降',
    threshold: {
      indicator: 'indicator_egfr',
      operator: '<',
      value: 20,
    },
    severity: 'absolute',
    source: 'ada',
    year: 2024,
    description: '恩格列净在eGFR<20 mL/min/1.73m²时禁用，20-45可使用但降糖效果减弱',
  },
  {
    id: 'contra_dapagliflozin_egfr_25',
    drug: 'drug_dapagliflozin',
    condition: '肾功能重度下降',
    threshold: {
      indicator: 'indicator_egfr',
      operator: '<',
      value: 25,
    },
    severity: 'absolute',
    source: 'ada',
    year: 2024,
    description: '达格列净在eGFR<25 mL/min/1.73m²时禁用',
  },
  {
    id: 'contra_canagliflozin_egfr_30',
    drug: 'drug_canagliflozin',
    condition: '肾功能重度下降',
    threshold: {
      indicator: 'indicator_egfr',
      operator: '<',
      value: 30,
    },
    severity: 'absolute',
    source: 'ada',
    year: 2024,
    description: '卡格列净在eGFR<30 mL/min/1.73m²时禁用',
  },
];

/**
 * 磺脲类药物相关禁忌/慎用关系
 */
export const SU_CONTRAINDICATIONS: ContraindicationRelation[] = [
  {
    id: 'contra_glibenclamide_egfr_60',
    drug: 'drug_glibenclamide',
    condition: '肾功能下降',
    threshold: {
      indicator: 'indicator_egfr',
      operator: '<',
      value: 60,
    },
    severity: 'absolute',
    source: 'ada',
    year: 2024,
    description: '格列本脲在肾功能下降时禁用，低血糖风险极高且不易恢复',
  },
  {
    id: 'contra_glimepiride_egfr_30',
    drug: 'drug_glimepiride',
    condition: '肾功能重度下降',
    threshold: {
      indicator: 'indicator_egfr',
      operator: '<',
      value: 30,
    },
    severity: 'relative',
    source: 'ada',
    year: 2024,
    description: '格列美脲在eGFR<30时慎用，需减量',
  },
];

/**
 * ACEI/ARB相关禁忌/慎用关系
 */
export const ACEI_ARB_CONTRAINDICATIONS: ContraindicationRelation[] = [
  {
    id: 'contra_acei_arb_bilateral_renal_stenosis',
    drug: 'drug_acei_drugs',
    condition: '双侧肾动脉狭窄',
    threshold: undefined,
    severity: 'absolute',
    source: 'esc',
    year: 2023,
    description: '双侧肾动脉狭窄时禁用ACEI/ARB，可能导致急性肾功能衰竭',
  },
  {
    id: 'contra_acei_arb_pregnancy',
    drug: 'drug_acei_drugs',
    condition: '妊娠',
    threshold: undefined,
    severity: 'absolute',
    source: 'kdigo',
    year: 2022,
    description: '妊娠期禁用ACEI/ARB，可能导致胎儿畸形',
  },
  {
    id: 'contra_acei_arb_potassium',
    drug: 'drug_acei_drugs',
    condition: '高钾血症',
    threshold: {
      indicator: 'indicator_potassium',
      operator: '>',
      value: 5.0,
    },
    severity: 'relative',
    source: 'kdigo',
    year: 2022,
    description: 'ACEI/ARB可能升高血钾，血钾>5.0 mmol/L时慎用',
  },
];

/**
 * β阻滞剂相关禁忌/慎用关系
 */
export const BETA_BLOCKER_CONTRAINDICATIONS: ContraindicationRelation[] = [
  {
    id: 'contra_beta_blocker_asthma',
    drug: 'drug_metoprolol',
    condition: '哮喘',
    threshold: undefined,
    severity: 'absolute',
    source: 'esc',
    year: 2023,
    description: '哮喘患者禁用非选择性β阻滞剂，选择性β阻滞剂慎用',
  },
  {
    id: 'contra_beta_blocker_av_block',
    drug: 'drug_metoprolol',
    condition: '房室传导阻滞',
    threshold: undefined,
    severity: 'absolute',
    source: 'esc',
    year: 2023,
    description: '二度及以上房室传导阻滞禁用β阻滞剂',
  },
];

/**
 * DPP-4抑制剂相关禁忌/慎用关系
 */
export const DPP4_CONTRAINDICATIONS: ContraindicationRelation[] = [
  {
    id: 'contra_sitagliptin_egfr_30',
    drug: 'drug_sitagliptin',
    condition: '肾功能重度下降',
    threshold: {
      indicator: 'indicator_egfr',
      operator: '<',
      value: 30,
    },
    severity: 'relative',
    source: 'ada',
    year: 2024,
    description: '西格列汀在eGFR<30时需减量使用',
  },
];

/**
 * TZD相关禁忌/慎用关系
 */
export const TZD_CONTRAINDICATIONS: ContraindicationRelation[] = [
  {
    id: 'contra_pioglitazone_heart_failure',
    drug: 'drug_pioglitazone',
    condition: '心力衰竭',
    threshold: undefined,
    severity: 'relative',
    source: 'ada',
    year: 2024,
    description: '吡格列酮可能导致液体潴留，心衰患者慎用',
  },
  {
    id: 'contra_pioglitazone_fracture',
    drug: 'drug_pioglitazone',
    condition: '骨质疏松',
    threshold: undefined,
    severity: 'relative',
    source: 'ada',
    year: 2024,
    description: '吡格列酮增加骨折风险，骨质疏松患者慎用',
  },
];

/**
 * 甲状腺药物相关禁忌/慎用关系
 */
export const THYROID_CONTRAINDICATIONS: ContraindicationRelation[] = [
  {
    id: 'contra_methimazole_pregnancy',
    drug: 'drug_methimazole',
    condition: '妊娠早期',
    threshold: undefined,
    severity: 'relative',
    source: 'ata',
    year: 2023,
    description: '甲巯咪唑妊娠早期慎用，可能导致胎儿畸形，严重甲亢时PTU首选',
  },
  {
    id: 'contra_ptu_liver',
    drug: 'drug_propylthiouracil',
    condition: '肝功能异常',
    threshold: undefined,
    severity: 'relative',
    source: 'ata',
    year: 2023,
    description: '丙硫氧嘧啶可能导致严重肝损伤，需定期监测肝功能',
  },
];

/**
 * 药物相互作用
 */
export const DRUG_INTERACTIONS: DrugInteractionRelation[] = [
  {
    id: 'interaction_metformin_cimetidine',
    drug1: 'drug_metformin',
    drug2: 'drug_cimetidine',
    type: 'moderate',
    description: '西咪替丁可能增加二甲双胍血药浓度',
    recommendation: '监测二甲双胍相关不良反应',
    source: 'ada',
    year: 2024,
  },
  {
    id: 'interaction_metformin_diuretics',
    drug1: 'drug_metformin',
    drug2: 'drug_furosemide',
    type: 'moderate',
    description: '利尿剂可能影响肾功能，间接增加二甲双胍风险',
    recommendation: '监测肾功能',
    source: 'ada',
    year: 2024,
  },
  {
    id: 'interaction_su_fluconazole',
    drug1: 'drug_glimepiride',
    drug2: 'drug_fluconazole',
    type: 'major',
    description: '氟康唑抑制磺脲类代谢，增加低血糖风险',
    recommendation: '减少磺脲类剂量或选择替代抗真菌药',
    source: 'ada',
    year: 2024,
  },
  {
    id: 'interaction_warfarin_acei',
    drug1: 'drug_warfarin',
    drug2: 'drug_enalapril',
    type: 'moderate',
    description: 'ACEI可能增强华法林抗凝效果',
    recommendation: '监测INR',
    source: 'esc',
    year: 2023,
  },
  {
    id: 'interaction_acei_nsaid',
    drug1: 'drug_acei_drugs',
    drug2: 'drug_ibuprofen',
    type: 'moderate',
    description: 'NSAIDs可能降低ACEI降压效果并增加肾功能损害风险',
    recommendation: '避免长期合用NSAIDs，监测肾功能',
    source: 'kdigo',
    year: 2022,
  },
  {
    id: 'interaction_levothyroxine_cholestyramine',
    drug1: 'drug_levothyroxine',
    drug2: 'drug_cholestyramine_thyroid',
    type: 'major',
    description: '考来烯胺阻断左甲状腺素吸收',
    recommendation: '两药间隔至少4小时服用',
    source: 'ata',
    year: 2023,
  },
  {
    id: 'interaction_levothyroxine_ppi',
    drug1: 'drug_levothyroxine',
    drug2: 'drug_omeprazole',
    type: 'moderate',
    description: '质子泵抑制剂可能影响左甲状腺素吸收',
    recommendation: '监测TSH，必要时调整剂量',
    source: 'ata',
    year: 2023,
  },
];

/**
 * 全部禁忌/慎用关系
 */
export const ALL_CONTRAINDICATIONS: ContraindicationRelation[] = [
  ...METFORMIN_CONTRAINDICATIONS,
  ...SGLT2_CONTRAINDICATIONS,
  ...SU_CONTRAINDICATIONS,
  ...ACEI_ARB_CONTRAINDICATIONS,
  ...BETA_BLOCKER_CONTRAINDICATIONS,
  ...DPP4_CONTRAINDICATIONS,
  ...TZD_CONTRAINDICATIONS,
  ...THYROID_CONTRAINDICATIONS,
];

/**
 * 根据药物ID获取相关禁忌关系
 */
export function getContraindicationsByDrug(drugId: string): ContraindicationRelation[] {
  return ALL_CONTRAINDICATIONS.filter(c => c.drug === drugId);
}

/**
 * 根据药物ID获取相关相互作用
 */
export function getInteractionsByDrug(drugId: string): DrugInteractionRelation[] {
  return DRUG_INTERACTIONS.filter(i => i.drug1 === drugId || i.drug2 === drugId);
}
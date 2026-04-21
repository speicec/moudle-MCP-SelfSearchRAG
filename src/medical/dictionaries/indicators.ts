/**
 * Indicator Dictionary - 指标词典
 */

import type { IndicatorEntity } from '../types.js';

/**
 * 血糖类指标
 */
export const GLUCOSE_INDICATORS: IndicatorEntity[] = [
  {
    id: 'indicator_fasting_glucose',
    canonicalName: '空腹血糖',
    aliases: ['FPG', 'Fasting Plasma Glucose', '空腹血糖', '空腹', '空腹葡萄糖', 'FBG', 'Fasting Blood Glucose'],
    unit: 'mmol/L',
    normalRange: {
      min: 3.9,
      max: 5.6,
      description: '正常空腹血糖3.9-5.6 mmol/L，糖尿病前期5.6-6.9，糖尿病≥7.0',
    },
    clinicalThresholds: {
      normal: [3.9, 5.6],
      caution: [5.6, 6.9],
      critical: [7.0],
    },
    relatedDrugs: ['drug_metformin', 'drug_insulin_long', 'drug_glimepiride'],
    relatedDiseases: ['disease_diabetes_type2', 'disease_prediabetes'],
  },
  {
    id: 'indicator_hba1c',
    canonicalName: '糖化血红蛋白',
    aliases: ['HbA1c', 'A1C', '糖化', 'GHb', 'Hemoglobin A1c', 'HbA1c%', '糖化血红', 'A1c'],
    unit: '%',
    normalRange: {
      max: 5.7,
      description: '正常<5.7%，糖尿病前期5.7-6.4%，糖尿病诊断≥6.5%',
    },
    clinicalThresholds: {
      normal: [5.7],
      caution: [6.5],
      critical: [7.0, 8.0],
    },
    relatedDrugs: ['drug_metformin', 'drug_glp1_drugs', 'drug_sglt2_drugs'],
    relatedDiseases: ['disease_diabetes_type2', 'disease_prediabetes'],
  },
  {
    id: 'indicator_postprandial_glucose',
    canonicalName: '餐后血糖',
    aliases: ['PPG', 'Postprandial Glucose', '餐后', '餐后2小时血糖', '2hPG', 'OGTT血糖', '2小时血糖'],
    unit: 'mmol/L',
    normalRange: {
      max: 7.8,
      description: '正常餐后2小时<7.8 mmol/L，糖尿病前期7.8-11.0，糖尿病≥11.1',
    },
    clinicalThresholds: {
      normal: [7.8],
      caution: [11.0],
      critical: [11.1],
    },
    relatedDrugs: ['drug_acarbose', 'drug_insulin_rapid'],
    relatedDiseases: ['disease_diabetes_type2', 'disease_prediabetes'],
  },
  {
    id: 'indicator_ogtt',
    canonicalName: '口服葡萄糖耐量试验',
    aliases: ['OGTT', 'Oral Glucose Tolerance Test', '糖耐量', '糖耐', '糖耐量试验', 'OGTT 2h'],
    unit: 'mmol/L',
    normalRange: {
      max: 7.8,
      description: 'OGTT 2小时血糖正常<7.8，糖尿病≥11.1 mmol/L',
    },
    clinicalThresholds: {
      normal: [7.8],
      caution: [11.0],
      critical: [11.1],
    },
    relatedDiseases: ['disease_diabetes_gdm', 'disease_prediabetes'],
  },
];

/**
 * 肾功能指标
 */
export const KIDNEY_INDICATORS: IndicatorEntity[] = [
  {
    id: 'indicator_egfr',
    canonicalName: '肾小球滤过率',
    aliases: ['eGFR', 'EGFR', 'GFR', '肾滤过率', '估算肾小球滤过率', '肾小球滤过', 'Estimated GFR', '肌酐清除率', 'CrCl'],
    unit: 'mL/min/1.73m²',
    normalRange: {
      min: 60,
      description: '正常≥90，轻度下降60-89，中度30-59，重度15-29，终末期<15',
    },
    clinicalThresholds: {
      normal: [90],
      caution: [45, 60],
      critical: [30, 15],
    },
    relatedDrugs: ['drug_metformin', 'drug_sglt2_drugs', 'drug_glibenclamide'],
    relatedDiseases: ['disease_ckd', 'disease_diabetic_nephropathy'],
  },
  {
    id: 'indicator_creatinine',
    canonicalName: '血肌酐',
    aliases: ['Cr', 'Creatinine', '肌酐', 'Serum Creatinine', '血肌酐', 'SCr', '肌酐水平'],
    unit: 'μmol/L',
    normalRange: {
      min: 44,
      max: 133,
      description: '男性53-106 μmol/L，女性44-97 μmol/L',
    },
    clinicalThresholds: {
      normal: [106],
      caution: [133],
      critical: [177, 442],
    },
    relatedDrugs: ['drug_metformin'],
    relatedDiseases: ['disease_ckd', 'disease_diabetic_nephropathy'],
  },
  {
    id: 'indicator_albuminuria',
    canonicalName: '尿白蛋白',
    aliases: ['尿白蛋白', 'Albuminuria', '微量白蛋白尿', 'UACR', '尿白蛋白肌酐比', '尿蛋白', 'MAU', '微量白蛋白', '尿微量白蛋白'],
    unit: 'mg/g',
    normalRange: {
      max: 30,
      description: '正常<30 mg/g，微量白蛋白尿30-299，大量白蛋白尿≥300',
    },
    clinicalThresholds: {
      normal: [30],
      caution: [30, 299],
      critical: [300],
    },
    relatedDrugs: ['drug_acei_drugs', 'drug_arb_drugs'],
    relatedDiseases: ['disease_diabetic_nephropathy', 'disease_ckd'],
  },
  {
    id: 'indicator_bun',
    canonicalName: '血尿素氮',
    aliases: ['BUN', 'Urea', '尿素氮', 'Blood Urea Nitrogen', '尿素', '血尿素'],
    unit: 'mmol/L',
    normalRange: {
      min: 2.9,
      max: 8.2,
      description: '正常2.9-8.2 mmol/L',
    },
    clinicalThresholds: {
      normal: [8.2],
      caution: [21.4],
      critical: [28.6],
    },
    relatedDiseases: ['disease_ckd'],
  },
];

/**
 * 血压指标
 */
export const BP_INDICATORS: IndicatorEntity[] = [
  {
    id: 'indicator_sbp',
    canonicalName: '收缩压',
    aliases: ['SBP', 'Systolic BP', '收缩压', '高压', 'Systolic Blood Pressure', '上压'],
    unit: 'mmHg',
    normalRange: {
      max: 120,
      description: '正常<120 mmHg，高血压前期120-139，高血压≥140',
    },
    clinicalThresholds: {
      normal: [120],
      caution: [140],
      critical: [180],
    },
    relatedDrugs: ['drug_acei_drugs', 'drug_arb_drugs', 'drug_ccb_drugs'],
    relatedDiseases: ['disease_hypertension_primary'],
  },
  {
    id: 'indicator_dbp',
    canonicalName: '舒张压',
    aliases: ['DBP', 'Diastolic BP', '舒张压', '低压', 'Diastolic Blood Pressure', '下压'],
    unit: 'mmHg',
    normalRange: {
      max: 80,
      description: '正常<80 mmHg，高血压前期80-89，高血压≥90',
    },
    clinicalThresholds: {
      normal: [80],
      caution: [90],
      critical: [120],
    },
    relatedDrugs: ['drug_acei_drugs', 'drug_arb_drugs', 'drug_ccb_drugs'],
    relatedDiseases: ['disease_hypertension_primary'],
  },
  {
    id: 'indicator_bp',
    canonicalName: '血压',
    aliases: ['BP', 'Blood Pressure', '血压值', '收缩舒张压'],
    unit: 'mmHg',
    normalRange: {
      description: '正常血压<120/80 mmHg',
    },
    clinicalThresholds: {
      normal: [120, 80],
      caution: [140, 90],
      critical: [180, 120],
    },
    relatedDrugs: ['drug_acei_drugs', 'drug_arb_drugs', 'drug_ccb_drugs', 'drug_beta_blocker_drugs'],
    relatedDiseases: ['disease_hypertension_primary'],
  },
];

/**
 * 血脂指标
 */
export const LIPID_INDICATORS: IndicatorEntity[] = [
  {
    id: 'indicator_ldl_c',
    canonicalName: '低密度脂蛋白胆固醇',
    aliases: ['LDL-C', 'LDL', '低密度', '坏胆固醇', 'LDL cholesterol', '低密度脂蛋白'],
    unit: 'mmol/L',
    normalRange: {
      max: 2.6,
      description: '理想<2.6 mmol/L，高危<1.8，极高危<1.4',
    },
    clinicalThresholds: {
      normal: [2.6],
      caution: [1.8],
      critical: [1.4],
    },
    relatedDiseases: ['disease_diabetes_type2', 'disease_hypertension_primary'],
  },
  {
    id: 'indicator_hdl_c',
    canonicalName: '高密度脂蛋白胆固醇',
    aliases: ['HDL-C', 'HDL', '高密度', '好胆固醇', 'HDL cholesterol', '高密度脂蛋白'],
    unit: 'mmol/L',
    normalRange: {
      min: 1.0,
      description: '男性≥1.0 mmol/L，女性≥1.3',
    },
    clinicalThresholds: {
      normal: [1.0],
      caution: [0.9],
      critical: [0.8],
    },
    relatedDiseases: ['disease_diabetes_type2'],
  },
  {
    id: 'indicator_tg',
    canonicalName: '甘油三酯',
    aliases: ['TG', 'Triglycerides', '甘油三酯', '三酯'],
    unit: 'mmol/L',
    normalRange: {
      max: 1.7,
      description: '正常<1.7 mmol/L，边缘升高1.7-2.3，升高≥2.3',
    },
    clinicalThresholds: {
      normal: [1.7],
      caution: [2.3],
      critical: [5.6],
    },
    relatedDrugs: ['drug_pioglitazone'],
    relatedDiseases: ['disease_diabetes_type2'],
  },
  {
    id: 'indicator_total_cholesterol',
    canonicalName: '总胆固醇',
    aliases: ['TC', 'Total Cholesterol', '总胆固醇', '胆固醇', 'CHO'],
    unit: 'mmol/L',
    normalRange: {
      max: 5.2,
      description: '理想<5.2 mmol/L',
    },
    clinicalThresholds: {
      normal: [5.2],
      caution: [6.2],
      critical: [7.0],
    },
    relatedDiseases: ['disease_diabetes_type2'],
  },
];

/**
 * 甲状腺指标
 */
export const THYROID_INDICATORS: IndicatorEntity[] = [
  {
    id: 'indicator_tsh',
    canonicalName: '促甲状腺激素',
    aliases: ['TSH', 'Thyroid Stimulating Hormone', '促甲状腺', '甲状腺刺激激素', '甲促素'],
    unit: 'mIU/L',
    normalRange: {
      min: 0.27,
      max: 4.2,
      description: '正常0.27-4.2 mIU/L (不同实验室略有差异)',
    },
    clinicalThresholds: {
      normal: [0.27, 4.2],
      caution: [0.1, 10],
      critical: [0.01, 20],
    },
    relatedDrugs: ['drug_levothyroxine', 'drug_methimazole', 'drug_propylthiouracil'],
    relatedDiseases: ['disease_hypothyroidism', 'disease_hyperthyroidism', 'disease_subclinical_hypothyroidism'],
  },
  {
    id: 'indicator_ft3',
    canonicalName: '游离三碘甲状腺原氨酸',
    aliases: ['FT3', 'Free T3', '游离T3', '游离三碘', '三碘甲状腺原氨酸', 'fT3'],
    unit: 'pmol/L',
    normalRange: {
      min: 3.1,
      max: 6.8,
      description: '正常3.1-6.8 pmol/L',
    },
    clinicalThresholds: {
      normal: [3.1, 6.8],
      caution: [2.5, 8],
      critical: [2.0, 15],
    },
    relatedDrugs: ['drug_methimazole', 'drug_propylthiouracil'],
    relatedDiseases: ['disease_hyperthyroidism'],
  },
  {
    id: 'indicator_ft4',
    canonicalName: '游离甲状腺素',
    aliases: ['FT4', 'Free T4', '游离T4', '游离甲状腺素', 'fT4'],
    unit: 'pmol/L',
    normalRange: {
      min: 12,
      max: 22,
      description: '正常12-22 pmol/L',
    },
    clinicalThresholds: {
      normal: [12, 22],
      caution: [10, 25],
      critical: [8, 30],
    },
    relatedDrugs: ['drug_levothyroxine', 'drug_methimazole', 'drug_propylthiouracil'],
    relatedDiseases: ['disease_hypothyroidism', 'disease_hyperthyroidism'],
  },
  {
    id: 'indicator_tpo_ab',
    canonicalName: '甲状腺过氧化物酶抗体',
    aliases: ['TPOAb', 'TPO抗体', '甲状腺过氧化物酶抗体', '抗TPO', 'TPO-Ab'],
    unit: 'IU/mL',
    normalRange: {
      max: 35,
      description: '正常<35 IU/mL，升高提示自身免疫性甲状腺疾病',
    },
    clinicalThresholds: {
      normal: [35],
      caution: [100],
      critical: [500],
    },
    relatedDiseases: ['disease_hypothyroidism', 'disease_hyperthyroidism', 'disease_graves'],
  },
  {
    id: 'indicator_tg_ab',
    canonicalName: '甲状腺球蛋白抗体',
    aliases: ['TGAb', 'TG抗体', '甲状腺球蛋白抗体', '抗TG', 'Tg-Ab'],
    unit: 'IU/mL',
    normalRange: {
      max: 40,
      description: '正常<40 IU/mL',
    },
    clinicalThresholds: {
      normal: [40],
      caution: [100],
      critical: [500],
    },
    relatedDiseases: ['disease_hypothyroidism', 'disease_hyperthyroidism'],
  },
];

/**
 * 其他重要指标
 */
export const OTHER_INDICATORS: IndicatorEntity[] = [
  {
    id: 'indicator_potassium',
    canonicalName: '血钾',
    aliases: ['K+', 'Potassium', '钾', '钾离子', 'Serum Potassium'],
    unit: 'mmol/L',
    normalRange: {
      min: 3.5,
      max: 5.0,
      description: '正常3.5-5.0 mmol/L',
    },
    clinicalThresholds: {
      normal: [3.5, 5.0],
      caution: [3.0, 5.5],
      critical: [2.5, 6.0],
    },
    relatedDrugs: ['drug_acei_drugs', 'drug_arb_drugs', 'drug_spironolactone', 'drug_hydrochlorothiazide'],
    relatedDiseases: ['disease_ckd'],
  },
  {
    id: 'indicator_uric_acid',
    canonicalName: '血尿酸',
    aliases: ['UA', 'Uric Acid', '尿酸', '尿酸水平'],
    unit: 'μmol/L',
    normalRange: {
      min: 150,
      max: 420,
      description: '男性150-420 μmol/L，女性150-360',
    },
    clinicalThresholds: {
      normal: [420],
      caution: [480],
      critical: [540],
    },
    relatedDrugs: ['drug_losartan', 'drug_hydrochlorothiazide'],
  },
  {
    id: 'indicator_weight',
    canonicalName: '体重',
    aliases: ['Weight', '体重', 'BW', 'Body Weight', '体重kg'],
    unit: 'kg',
    normalRange: {
      description: '根据BMI计算理想体重',
    },
    clinicalThresholds: [],
    relatedDrugs: ['drug_glp1_drugs', 'drug_sglt2_drugs'],
    relatedDiseases: ['disease_diabetes_type2'],
  },
  {
    id: 'indicator_bmi',
    canonicalName: '体质指数',
    aliases: ['BMI', 'Body Mass Index', '体重指数', '体质量指数'],
    unit: 'kg/m²',
    normalRange: {
      min: 18.5,
      max: 24,
      description: '正常18.5-24，超重24-28，肥胖≥28',
    },
    clinicalThresholds: {
      normal: [18.5, 24],
      caution: [28],
      critical: [32],
    },
    relatedDrugs: ['drug_glp1_drugs'],
    relatedDiseases: ['disease_diabetes_type2'],
  },
  {
    id: 'indicator_heart_rate',
    canonicalName: '心率',
    aliases: ['HR', 'Heart Rate', '心率', '脉搏', 'Pulse', '心跳'],
    unit: '次/分',
    normalRange: {
      min: 60,
      max: 100,
      description: '正常60-100次/分',
    },
    clinicalThresholds: {
      normal: [60, 100],
      caution: [50, 120],
      critical: [40, 150],
    },
    relatedDrugs: ['drug_beta_blocker_drugs', 'drug_diltiazem', 'drug_verapamil'],
    relatedDiseases: ['disease_hyperthyroidism', 'disease_heart_failure'],
  },
];

/**
 * 全部指标词典
 */
export const ALL_INDICATORS: IndicatorEntity[] = [
  ...GLUCOSE_INDICATORS,
  ...KIDNEY_INDICATORS,
  ...BP_INDICATORS,
  ...LIPID_INDICATORS,
  ...THYROID_INDICATORS,
  ...OTHER_INDICATORS,
];

/**
 * 根据ID获取指标实体
 */
export function getIndicatorById(id: string): IndicatorEntity | undefined {
  return ALL_INDICATORS.find(i => i.id === id);
}

/**
 * 根据名称或别名获取指标实体
 */
export function getIndicatorByName(name: string): IndicatorEntity | undefined {
  return ALL_INDICATORS.find(i =>
    i.canonicalName === name ||
    i.aliases.includes(name) ||
    i.aliases.some(alias => alias.toLowerCase() === name.toLowerCase())
  );
}
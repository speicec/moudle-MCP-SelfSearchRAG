/**
 * Antihypertensive Drug Dictionary - 降压药词典
 */

import type { DrugEntity } from '../../types.js';

/**
 * ACEI类药物 (血管紧张素转换酶抑制剂)
 */
export const ACEI_DRUGS: DrugEntity[] = [
  {
    id: 'drug_captopril',
    canonicalName: '卡托普利',
    aliases: ['Captopril', '开博通', '卡托', 'ACEI', '血管紧张素转换酶抑制剂'],
    englishName: 'Captopril',
    atcCode: 'C09AA01',
    classification: {
      category: '降压药',
      subcategory: 'ACEI',
    },
    brands: ['开博通'],
    keywords: ['ACEI', '短效', '肾功能保护', '咳嗽', '一天三次', '糖尿病肾病首选'],
    relatedIndicators: ['indicator_bp', 'indicator_egfr', 'indicator_potassium'],
    relatedDiseases: ['disease_hypertension_primary', 'disease_diabetic_nephropathy', 'disease_ckd'],
  },
  {
    id: 'drug_benazepril',
    canonicalName: '贝那普利',
    aliases: ['Benazepril', '洛汀新', '贝那', 'ACEI', 'Lotensin'],
    englishName: 'Benazepril',
    atcCode: 'C09AA07',
    classification: {
      category: '降压药',
      subcategory: 'ACEI',
    },
    brands: ['洛汀新'],
    keywords: ['ACEI', '长效', '肾功能保护', '咳嗽', '一天一次', '糖尿病肾病'],
    relatedIndicators: ['indicator_bp', 'indicator_egfr', 'indicator_potassium'],
    relatedDiseases: ['disease_hypertension_primary', 'disease_diabetic_nephropathy', 'disease_ckd'],
  },
  {
    id: 'drug_enalapril',
    canonicalName: '依那普利',
    aliases: ['Enalapril', '悦宁定', '依那', 'ACEI', 'Renitec', 'Enalaprilat'],
    englishName: 'Enalapril',
    atcCode: 'C09AA02',
    classification: {
      category: '降压药',
      subcategory: 'ACEI',
    },
    brands: ['悦宁定', 'Renitec'],
    keywords: ['ACEI', '长效', '心衰', '咳嗽', '一天两次'],
    relatedIndicators: ['indicator_bp', 'indicator_egfr', 'indicator_potassium'],
    relatedDiseases: ['disease_hypertension_primary', 'disease_heart_failure'],
  },
  {
    id: 'drug_lisinopril',
    canonicalName: '赖诺普利',
    aliases: ['Lisinopril', '捷赐瑞', '赖诺', 'ACEI', 'Prinivil', 'Zestril'],
    englishName: 'Lisinopril',
    atcCode: 'C09AA03',
    classification: {
      category: '降压药',
      subcategory: 'ACEI',
    },
    brands: ['捷赐瑞', 'Prinivil', 'Zestril'],
    keywords: ['ACEI', '长效', '一天一次', '心衰', '咳嗽'],
    relatedIndicators: ['indicator_bp', 'indicator_egfr', 'indicator_potassium'],
    relatedDiseases: ['disease_hypertension_primary', 'disease_heart_failure'],
  },
  {
    id: 'drug_ramipril',
    canonicalName: '雷米普利',
    aliases: ['Ramipril', '瑞泰', '雷米', 'ACEI', 'Altace', 'Tritace'],
    englishName: 'Ramipril',
    atcCode: 'C09AA05',
    classification: {
      category: '降压药',
      subcategory: 'ACEI',
    },
    brands: ['瑞泰', 'Altace', 'Tritace'],
    keywords: ['ACEI', '长效', '心血管保护', '一天一次', '咳嗽'],
    relatedIndicators: ['indicator_bp', 'indicator_egfr', 'indicator_potassium'],
    relatedDiseases: ['disease_hypertension_primary', 'disease_heart_failure'],
  },
];

/**
 * ARB类药物 (血管紧张素II受体拮抗剂)
 */
export const ARB_DRUGS: DrugEntity[] = [
  {
    id: 'drug_valsartan',
    canonicalName: '缬沙坦',
    aliases: ['Valsartan', '代文', '缬沙', 'ARB', '血管紧张素受体拮抗剂', 'Diovan'],
    englishName: 'Valsartan',
    atcCode: 'C09CA02',
    classification: {
      category: '降压药',
      subcategory: 'ARB',
    },
    brands: ['代文', 'Diovan'],
    keywords: ['ARB', '长效', '心衰', '一天一次', '糖尿病肾病', '无咳嗽'],
    relatedIndicators: ['indicator_bp', 'indicator_egfr', 'indicator_potassium'],
    relatedDiseases: ['disease_hypertension_primary', 'disease_diabetic_nephropathy', 'disease_heart_failure'],
  },
  {
    id: 'drug_losartan',
    canonicalName: '氯沙坦',
    aliases: ['Losartan', '科素亚', '氯沙', 'ARB', 'Cozaar', '海捷亚'],
    englishName: 'Losartan',
    atcCode: 'C09CA01',
    classification: {
      category: '降压药',
      subcategory: 'ARB',
    },
    brands: ['科素亚', 'Cozaar', '海捷亚(氢氯噻嗪复方)'],
    keywords: ['ARB', '长效', '尿酸降低', '一天一次', '糖尿病肾病', '无咳嗽'],
    relatedIndicators: ['indicator_bp', 'indicator_egfr', 'indicator_potassium', 'indicator_uric_acid'],
    relatedDiseases: ['disease_hypertension_primary', 'disease_diabetic_nephropathy'],
  },
  {
    id: 'drug_irbesartan',
    canonicalName: '厄贝沙坦',
    aliases: ['Irbesartan', '安博维', '厄贝', 'ARB', 'Avapro', 'Apovel'],
    englishName: 'Irbesartan',
    atcCode: 'C09CA03',
    classification: {
      category: '降压药',
      subcategory: 'ARB',
    },
    brands: ['安博维', '安博诺(氢氯噻嗪复方)'],
    keywords: ['ARB', '长效', '糖尿病肾病', '一天一次', '无咳嗽'],
    relatedIndicators: ['indicator_bp', 'indicator_egfr', 'indicator_potassium'],
    relatedDiseases: ['disease_hypertension_primary', 'disease_diabetic_nephropathy', 'disease_ckd'],
  },
  {
    id: 'drug_olmesartan',
    canonicalName: '奥美沙坦',
    aliases: ['Olmesartan', '奥美沙', 'ARB', 'Benicar', '傲坦'],
    englishName: 'Olmesartan',
    atcCode: 'C09CA08',
    classification: {
      category: '降压药',
      subcategory: 'ARB',
    },
    brands: ['傲坦', 'Benicar'],
    keywords: ['ARB', '长效', '强效降压', '一天一次', '无咳嗽'],
    relatedIndicators: ['indicator_bp', 'indicator_egfr', 'indicator_potassium'],
    relatedDiseases: ['disease_hypertension_primary'],
  },
  {
    id: 'drug_telmisartan',
    canonicalName: '替米沙坦',
    aliases: ['Telmisartan', '美卡素', '替米', 'ARB', 'Micardis'],
    englishName: 'Telmisartan',
    atcCode: 'C09CA07',
    classification: {
      category: '降压药',
      subcategory: 'ARB',
    },
    brands: ['美卡素', 'Micardis'],
    keywords: ['ARB', '长效', '心血管保护', '一天一次', '无咳嗽', '代谢获益'],
    relatedIndicators: ['indicator_bp', 'indicator_egfr', 'indicator_potassium'],
    relatedDiseases: ['disease_hypertension_primary'],
  },
  {
    id: 'drug_candesartan',
    canonicalName: '坎地沙坦',
    aliases: ['Candesartan', '必洛斯', '坎地', 'ARB', 'Atacand', '坎地沙坦酯'],
    englishName: 'Candesartan',
    atcCode: 'C09CA06',
    classification: {
      category: '降压药',
      subcategory: 'ARB',
    },
    brands: ['必洛斯', 'Atacand'],
    keywords: ['ARB', '长效', '心衰', '一天一次', '无咳嗽'],
    relatedIndicators: ['indicator_bp', 'indicator_egfr', 'indicator_potassium'],
    relatedDiseases: ['disease_hypertension_primary', 'disease_heart_failure'],
  },
];

/**
 * CCB类药物 (钙通道阻滞剂)
 */
export const CCB_DRUGS: DrugEntity[] = [
  {
    id: 'drug_amlodipine',
    canonicalName: '氨氯地平',
    aliases: ['Amlodipine', '络活喜', '氨氯', 'CCB', '钙通道阻滞剂', 'Norvasc'],
    englishName: 'Amlodipine',
    atcCode: 'C08CA01',
    classification: {
      category: '降压药',
      subcategory: 'CCB',
    },
    brands: ['络活喜', 'Norvasc'],
    keywords: ['CCB', '长效', '一天一次', '水肿', '糖尿病可用', '无代谢影响'],
    relatedIndicators: ['indicator_bp', 'indicator_edema'],
    relatedDiseases: ['disease_hypertension_primary', 'disease_diabetes_type2'],
  },
  {
    id: 'drug_nifedipine',
    canonicalName: '硝苯地平',
    aliases: ['Nifedipine', '心痛定', '硝苯', 'CCB', '拜新同', 'Adalat', '硝苯地平控释片'],
    englishName: 'Nifedipine',
    atcCode: 'C08CA05',
    classification: {
      category: '降压药',
      subcategory: 'CCB',
    },
    brands: ['心痛定', '拜新同', 'Adalat'],
    keywords: ['CCB', '控释', '长效', '水肿', '反射性心率增快', '心绞痛'],
    relatedIndicators: ['indicator_bp', 'indicator_edema', 'indicator_heart_rate'],
    relatedDiseases: ['disease_hypertension_primary', 'disease_angina'],
  },
  {
    id: 'drug_diltiazem',
    canonicalName: '地尔硫䓬',
    aliases: ['Diltiazem', '合心爽', '地尔硫', 'CCB', 'Tiazac', 'Cardizem', '恬尔心'],
    englishName: 'Diltiazem',
    atcCode: 'C08DA01',
    classification: {
      category: '降压药',
      subcategory: 'CCB',
    },
    brands: ['合心爽', '恬尔心', 'Cardizem'],
    keywords: ['CCB', '心率控制', '心绞痛', '房颤', '房室传导阻滞慎用'],
    relatedIndicators: ['indicator_bp', 'indicator_heart_rate'],
    relatedDiseases: ['disease_hypertension_primary', 'disease_angina', 'disease_arrhythmia'],
  },
  {
    id: 'drug_verapamil',
    canonicalName: '维拉帕米',
    aliases: ['Verapamil', '异搏定', '维拉帕', 'CCB', 'Isoptin', 'Calan'],
    englishName: 'Verapamil',
    atcCode: 'C08DA02',
    classification: {
      category: '降压药',
      subcategory: 'CCB',
    },
    brands: ['异搏定', 'Isoptin'],
    keywords: ['CCB', '心率控制', '房颤', '心绞痛', '房室传导阻滞慎用', '便秘'],
    relatedIndicators: ['indicator_bp', 'indicator_heart_rate'],
    relatedDiseases: ['disease_hypertension_primary', 'disease_angina', 'disease_arrhythmia'],
  },
  {
    id: 'drug_lercanidipine',
    canonicalName: '乐卡地平',
    aliases: ['Lercanidipine', '乐卡', 'CCB', '再宁平', 'Zanedip'],
    englishName: 'Lercanidipine',
    atcCode: 'C08CA13',
    classification: {
      category: '降压药',
      subcategory: 'CCB',
    },
    brands: ['再宁平', 'Zanedip'],
    keywords: ['CCB', '长效', '水肿较少', '一天一次'],
    relatedIndicators: ['indicator_bp'],
    relatedDiseases: ['disease_hypertension_primary'],
  },
];

/**
 * β受体阻滞剂
 */
export const BETA_BLOCKER_DRUGS: DrugEntity[] = [
  {
    id: 'drug_metoprolol',
    canonicalName: '美托洛尔',
    aliases: ['Metoprolol', '倍他洛克', '美托', 'β阻滞剂', 'Lopressor', 'β受体阻滞剂', '琥珀酸美托洛尔'],
    englishName: 'Metoprolol',
    atcCode: 'C07AB02',
    classification: {
      category: '降压药',
      subcategory: 'β受体阻滞剂',
    },
    brands: ['倍他洛克', 'Lopressor', '琥珀酸美托洛尔缓释片'],
    keywords: ['β阻滞剂', '心率控制', '心衰', '心绞痛', '选择性', '一天一次或两次'],
    relatedIndicators: ['indicator_bp', 'indicator_heart_rate'],
    relatedDiseases: ['disease_hypertension_primary', 'disease_heart_failure', 'disease_angina'],
  },
  {
    id: 'drug_bisoprolol',
    canonicalName: '比索洛尔',
    aliases: ['Bisoprolol', '康忻', '比索', 'β阻滞剂', 'Zebeta', 'Concor', 'β受体阻滞剂'],
    englishName: 'Bisoprolol',
    atcCode: 'C07AB07',
    classification: {
      category: '降压药',
      subcategory: 'β受体阻滞剂',
    },
    brands: ['康忻', 'Concor', '博苏'],
    keywords: ['β阻滞剂', '高选择性', '心衰', '一天一次', '心率控制'],
    relatedIndicators: ['indicator_bp', 'indicator_heart_rate'],
    relatedDiseases: ['disease_hypertension_primary', 'disease_heart_failure'],
  },
  {
    id: 'drug_carvedilol',
    canonicalName: '卡维地洛',
    aliases: ['Carvedilol', '达利全', '卡维', 'β阻滞剂', 'Coreg', '金络', 'β受体阻滞剂', 'αβ阻滞剂'],
    englishName: 'Carvedilol',
    atcCode: 'C07AG02',
    classification: {
      category: '降压药',
      subcategory: 'αβ受体阻滞剂',
    },
    brands: ['达利全', '金络', 'Coreg'],
    keywords: ['αβ阻滞剂', '心衰首选', '一天两次', '扩张血管', '体位性低血压'],
    relatedIndicators: ['indicator_bp', 'indicator_heart_rate'],
    relatedDiseases: ['disease_hypertension_primary', 'disease_heart_failure'],
  },
  {
    id: 'drug propranolol',
    canonicalName: '普萘洛尔',
    aliases: ['Propranolol', '心得安', '普萘', 'β阻滞剂', 'Inderal', 'β受体阻滞剂'],
    englishName: 'Propranolol',
    atcCode: 'C07AA05',
    classification: {
      category: '降压药',
      subcategory: 'β受体阻滞剂',
    },
    brands: ['心得安', 'Inderal'],
    keywords: ['β阻滞剂', '非选择性', '甲亢', '焦虑', '预防偏头痛', '一天多次'],
    relatedIndicators: ['indicator_bp', 'indicator_heart_rate'],
    relatedDiseases: ['disease_hypertension_primary', 'disease_hyperthyroidism'],
  },
  {
    id: 'drug_atenolol',
    canonicalName: '阿替洛尔',
    aliases: ['Atenolol', '氨酰心安', '阿替', 'β阻滞剂', 'Tenormin', 'β受体阻滞剂'],
    englishName: 'Atenolol',
    atcCode: 'C07AB03',
    classification: {
      category: '降压药',
      subcategory: 'β受体阻滞剂',
    },
    brands: ['氨酰心安', 'Tenormin'],
    keywords: ['β阻滞剂', '选择性', '一天一次', '肾功能不全慎用'],
    relatedIndicators: ['indicator_bp', 'indicator_heart_rate', 'indicator_egfr'],
    relatedDiseases: ['disease_hypertension_primary'],
  },
];

/**
 * 利尿剂
 */
export const DIURETIC_DRUGS: DrugEntity[] = [
  {
    id: 'drug_hydrochlorothiazide',
    canonicalName: '氢氯噻嗪',
    aliases: ['Hydrochlorothiazide', 'HCTZ', '双克', '氢氯', '利尿剂', 'Thiazide', '噻嗪类利尿剂'],
    englishName: 'Hydrochlorothiazide',
    atcCode: 'C03AA03',
    classification: {
      category: '降压药',
      subcategory: '噻嗪类利尿剂',
    },
    brands: ['双克', '复方制剂中常见'],
    keywords: ['噻嗪利尿', '一线降压', '低钾', '血糖影响', '尿酸升高', '一天一次'],
    relatedIndicators: ['indicator_bp', 'indicator_potassium', 'indicator_uric_acid', 'indicator_glucose'],
    relatedDiseases: ['disease_hypertension_primary'],
  },
  {
    id: 'drug_indapamide',
    canonicalName: '吲达帕胺',
    aliases: ['Indapamide', '寿比山', '吲达', '利尿剂', '纳催离', 'Natrilix', '噻嗪类利尿剂'],
    englishName: 'Indapamide',
    atcCode: 'C03BA11',
    classification: {
      category: '降压药',
      subcategory: '噻嗪类利尿剂',
    },
    brands: ['寿比山', '纳催离', 'Natrilix'],
    keywords: ['噻嗪样利尿', '长效', '一天一次', '低钾', '血糖影响较小'],
    relatedIndicators: ['indicator_bp', 'indicator_potassium'],
    relatedDiseases: ['disease_hypertension_primary'],
  },
  {
    id: 'drug_furosemide',
    canonicalName: '呋塞米',
    aliases: ['Furosemide', '速尿', '呋塞', '利尿剂', 'Lasix', 'Loop diuretic', '袢利尿剂'],
    englishName: 'Furosemide',
    atcCode: 'C03CA01',
    classification: {
      category: '降压药',
      subcategory: '袢利尿剂',
    },
    brands: ['速尿', 'Lasix'],
    keywords: ['袢利尿剂', '强效', '心衰', '水肿', '肾功能不全可用', '低钾', '一天多次'],
    relatedIndicators: ['indicator_bp', 'indicator_potassium', 'indicator_edema', 'indicator_egfr'],
    relatedDiseases: ['disease_heart_failure', 'disease_ckd', 'disease_ckd_stage5'],
  },
  {
    id: 'drug_spironolactone',
    canonicalName: '螺内酯',
    aliases: ['Spironolactone', '安体舒通', '螺内', '利尿剂', 'Aldactone', '保钾利尿剂', '醛固酮拮抗剂'],
    englishName: 'Spironolactone',
    atcCode: 'C03DA01',
    classification: {
      category: '降压药',
      subcategory: '保钾利尿剂',
    },
    brands: ['安体舒通', 'Aldactone'],
    keywords: ['保钾利尿', '醛固酮拮抗', '心衰', '肝硬化', '一天多次', '高钾风险', '男性乳房发育'],
    relatedIndicators: ['indicator_bp', 'indicator_potassium'],
    relatedDiseases: ['disease_heart_failure', 'disease_hypertension_primary'],
  },
  {
    id: 'drug_eplerenone',
    canonicalName: '依普利酮',
    aliases: ['Eplerenone', '依普利', '利尿剂', 'Inspra', '保钾利尿剂', '醛固酮拮抗剂'],
    englishName: 'Eplerenone',
    atcCode: 'C03DA04',
    classification: {
      category: '降压药',
      subcategory: '保钾利尿剂',
    },
    brands: ['Inspra'],
    keywords: ['保钾利尿', '醛固酮拮抗', '心衰', '心肌梗死后', '一天一次或两次', '高钾风险', '无乳房发育'],
    relatedIndicators: ['indicator_bp', 'indicator_potassium'],
    relatedDiseases: ['disease_heart_failure'],
  },
];

/**
 * 全部降压药词典
 */
export const ALL_ANTIHYPERTENSIVE_DRUGS: DrugEntity[] = [
  ...ACEI_DRUGS,
  ...ARB_DRUGS,
  ...CCB_DRUGS,
  ...BETA_BLOCKER_DRUGS,
  ...DIURETIC_DRUGS,
];

/**
 * 根据ID获取降压药实体
 */
export function getAntihypertensiveById(id: string): DrugEntity | undefined {
  return ALL_ANTIHYPERTENSIVE_DRUGS.find(d => d.id === id);
}

/**
 * 根据名称或别名获取降压药实体
 */
export function getAntihypertensiveByName(name: string): DrugEntity | undefined {
  return ALL_ANTIHYPERTENSIVE_DRUGS.find(d =>
    d.canonicalName === name ||
    d.aliases.includes(name) ||
    d.aliases.some((alias: string) => alias.toLowerCase() === name.toLowerCase()) ||
    d.brands.includes(name)
  );
}
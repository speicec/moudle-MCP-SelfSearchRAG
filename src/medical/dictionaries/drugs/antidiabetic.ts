/**
 * Antidiabetic Drug Dictionary - 降糖药词典
 */

import type { DrugEntity } from '../../types.js';

/**
 * 二甲双胍类药物
 */
export const METFORMIN_DRUGS: DrugEntity[] = [
  {
    id: 'drug_metformin',
    canonicalName: '二甲双胍',
    aliases: ['Metformin', '甲福明', '降糖片', '格华止', '美迪康', 'Dimethylbiguanide', 'MF'],
    englishName: 'Metformin',
    atcCode: 'A10BA02',
    classification: {
      category: '降糖药',
      subcategory: '胰岛素增敏剂',
    },
    brands: ['格华止', '美迪康', '二甲双胍片', '泰白'],
    keywords: ['糖尿病一线', 'eGFR禁忌', '肾功能', '乳酸酸中毒', '二甲', '双胍'],
    relatedIndicators: ['indicator_egfr', 'indicator_hba1c', 'indicator_lactate'],
    relatedDiseases: ['disease_diabetes_type2'],
  },
];

/**
 * GLP-1受体激动剂
 */
export const GLP1_DRUGS: DrugEntity[] = [
  {
    id: 'drug_liraglutide',
    canonicalName: '利拉鲁肽',
    aliases: ['Liraglutide', 'Victoza', '诺和力', '利拉', 'GLP-1'],
    englishName: 'Liraglutide',
    atcCode: 'A10BJ02',
    classification: {
      category: '降糖药',
      subcategory: 'GLP-1受体激动剂',
    },
    brands: ['诺和力', 'Victoza'],
    keywords: ['减重', '心血管获益', '一天一次', '注射', '恶心', 'GLP-1'],
    relatedIndicators: ['indicator_hba1c', 'indicator_weight'],
    relatedDiseases: ['disease_diabetes_type2', 'disease_obesity'],
  },
  {
    id: 'drug_semaglutide',
    canonicalName: '司美格鲁肽',
    aliases: ['Semaglutide', 'Ozempic', '诺和泰', '司美', '司美格鲁', 'Wegovy'],
    englishName: 'Semaglutide',
    atcCode: 'A10BJ06',
    classification: {
      category: '降糖药',
      subcategory: 'GLP-1受体激动剂',
    },
    brands: ['诺和泰', 'Ozempic', 'Wegovy', 'Rybelsus'],
    keywords: ['强效降糖', '减重', '心血管', '一周一次', '口服制剂', 'GLP-1'],
    relatedIndicators: ['indicator_hba1c', 'indicator_weight', 'indicator_cardiovascular'],
    relatedDiseases: ['disease_diabetes_type2', 'disease_obesity'],
  },
  {
    id: 'drug_dulaglutide',
    canonicalName: '度拉糖肽',
    aliases: ['Dulaglutide', 'Trulicity', '度拉', '度易达'],
    englishName: 'Dulaglutide',
    atcCode: 'A10BJ04',
    classification: {
      category: '降糖药',
      subcategory: 'GLP-1受体激动剂',
    },
    brands: ['度易达', 'Trulicity'],
    keywords: ['一周一次', '心血管获益', '注射', 'GLP-1'],
    relatedIndicators: ['indicator_hba1c'],
    relatedDiseases: ['disease_diabetes_type2'],
  },
  {
    id: 'drug_exenatide',
    canonicalName: '艾塞那肽',
    aliases: ['Exenatide', 'Byetta', 'Bydureon', '艾塞', '百泌达'],
    englishName: 'Exenatide',
    atcCode: 'A10BJ01',
    classification: {
      category: '降糖药',
      subcategory: 'GLP-1受体激动剂',
    },
    brands: ['百泌达', 'Byetta', 'Bydureon'],
    keywords: ['GLP-1', '注射', '一周一次', '降糖'],
    relatedIndicators: ['indicator_hba1c'],
    relatedDiseases: ['disease_diabetes_type2'],
  },
];

/**
 * SGLT2抑制剂
 */
export const SGLT2_DRUGS: DrugEntity[] = [
  {
    id: 'drug_empagliflozin',
    canonicalName: '恩格列净',
    aliases: ['Empagliflozin', 'Jardiance', '欧唐静', '恩格', 'SGLT2'],
    englishName: 'Empagliflozin',
    atcCode: 'A10BK03',
    classification: {
      category: '降糖药',
      subcategory: 'SGLT2抑制剂',
    },
    brands: ['欧唐静', 'Jardiance'],
    keywords: ['心血管获益', '心衰', '肾脏保护', 'SGLT2', 'eGFR阈值', '泌尿感染'],
    relatedIndicators: ['indicator_egfr', 'indicator_hba1c', 'indicator_cardiovascular'],
    relatedDiseases: ['disease_diabetes_type2', 'disease_ckd', 'disease_heart_failure'],
  },
  {
    id: 'drug_dapagliflozin',
    canonicalName: '达格列净',
    aliases: ['Dapagliflozin', 'Forxiga', '安达唐', '达格', 'SGLT2'],
    englishName: 'Dapagliflozin',
    atcCode: 'A10BK01',
    classification: {
      category: '降糖药',
      subcategory: 'SGLT2抑制剂',
    },
    brands: ['安达唐', 'Forxiga', '安达释'],
    keywords: ['心衰', '肾脏保护', 'SGLT2', 'eGFR阈值', '泌尿感染'],
    relatedIndicators: ['indicator_egfr', 'indicator_hba1c'],
    relatedDiseases: ['disease_diabetes_type2', 'disease_ckd', 'disease_heart_failure'],
  },
  {
    id: 'drug_canagliflozin',
    canonicalName: '卡格列净',
    aliases: ['Canagliflozin', 'Invokana', '卡格', 'SGLT2'],
    englishName: 'Canagliflozin',
    atcCode: 'A10BK02',
    classification: {
      category: '降糖药',
      subcategory: 'SGLT2抑制剂',
    },
    brands: ['Invokana'],
    keywords: ['SGLT2', '心血管', '肾脏', '截肢风险', 'eGFR阈值'],
    relatedIndicators: ['indicator_egfr', 'indicator_hba1c'],
    relatedDiseases: ['disease_diabetes_type2', 'disease_ckd'],
  },
];

/**
 * DPP-4抑制剂
 */
export const DPP4_DRUGS: DrugEntity[] = [
  {
    id: 'drug_sitagliptin',
    canonicalName: '西格列汀',
    aliases: ['Sitagliptin', 'Januvia', '捷诺达', '西格', 'DPP4', 'DPP-4'],
    englishName: 'Sitagliptin',
    atcCode: 'A10BH01',
    classification: {
      category: '降糖药',
      subcategory: 'DPP-4抑制剂',
    },
    brands: ['捷诺达', 'Januvia'],
    keywords: ['DPP-4', '口服', '一天一次', '肾功能慎用', '胰腺炎'],
    relatedIndicators: ['indicator_egfr', 'indicator_hba1c'],
    relatedDiseases: ['disease_diabetes_type2'],
  },
  {
    id: 'drug_linagliptin',
    canonicalName: '利格列汀',
    aliases: ['Linagliptin', 'Trajenta', '欧唐宁', '利格', 'DPP4', 'DPP-4'],
    englishName: 'Linagliptin',
    atcCode: 'A10BH05',
    classification: {
      category: '降糖药',
      subcategory: 'DPP-4抑制剂',
    },
    brands: ['欧唐宁', 'Trajenta'],
    keywords: ['DPP-4', '肾功能不全可用', '口服', '一天一次', '无需调整剂量'],
    relatedIndicators: ['indicator_hba1c'],
    relatedDiseases: ['disease_diabetes_type2', 'disease_ckd'],
  },
  {
    id: 'drug_vildagliptin',
    canonicalName: '维格列汀',
    aliases: ['Vildagliptin', 'Galvus', '维格', '佳维达', 'DPP4', 'DPP-4'],
    englishName: 'Vildagliptin',
    atcCode: 'A10BH02',
    classification: {
      category: '降糖药',
      subcategory: 'DPP-4抑制剂',
    },
    brands: ['佳维达', 'Galvus'],
    keywords: ['DPP-4', '口服', '一天两次', '肝功能慎用'],
    relatedIndicators: ['indicator_hba1c', 'indicator_liver'],
    relatedDiseases: ['disease_diabetes_type2'],
  },
  {
    id: 'drug_axagliptin',
    canonicalName: '阿格列汀',
    aliases: ['Alogliptin', 'Nesina', '阿格', 'DPP4', 'DPP-4'],
    englishName: 'Alogliptin',
    atcCode: 'A10BH08',
    classification: {
      category: '降糖药',
      subcategory: 'DPP-4抑制剂',
    },
    brands: ['Nesina'],
    keywords: ['DPP-4', '口服', '一天一次', '心力衰竭慎用'],
    relatedIndicators: ['indicator_hba1c'],
    relatedDiseases: ['disease_diabetes_type2'],
  },
];

/**
 * 磺脲类药物
 */
export const SU_DRUGS: DrugEntity[] = [
  {
    id: 'drug_glimepiride',
    canonicalName: '格列美脲',
    aliases: ['Glimepiride', 'Amaryl', '亚莫利', '格列美', '磺脲'],
    englishName: 'Glimepiride',
    atcCode: 'A10BB12',
    classification: {
      category: '降糖药',
      subcategory: '磺脲类',
    },
    brands: ['亚莫利', 'Amaryl'],
    keywords: ['磺脲', '口服', '一天一次', '低血糖风险', '肾功能慎用', '促胰岛素分泌'],
    relatedIndicators: ['indicator_hba1c', 'indicator_egfr'],
    relatedDiseases: ['disease_diabetes_type2'],
  },
  {
    id: 'drug_gliclazide',
    canonicalName: '格列齐特',
    aliases: ['Gliclazide', 'Diamicron', '达美康', '格列齐', '磺脲'],
    englishName: 'Gliclazide',
    atcCode: 'A10BB09',
    classification: {
      category: '降糖药',
      subcategory: '磺脲类',
    },
    brands: ['达美康', 'Diamicron'],
    keywords: ['磺脲', '口服', '缓释制剂', '心血管安全', '低血糖风险'],
    relatedIndicators: ['indicator_hba1c'],
    relatedDiseases: ['disease_diabetes_type2'],
  },
  {
    id: 'drug_glibenclamide',
    canonicalName: '格列本脲',
    aliases: ['Glibenclamide', 'Glyburide', '优降糖', '格列本', '磺脲', '消渴丸'],
    englishName: 'Glibenclamide',
    atcCode: 'A10BB02',
    classification: {
      category: '降糖药',
      subcategory: '磺脲类',
    },
    brands: ['优降糖'],
    keywords: ['磺脲', '口服', '强效', '低血糖高风险', '老年人禁用', '肾功能不全禁用'],
    relatedIndicators: ['indicator_egfr', 'indicator_hba1c'],
    relatedDiseases: ['disease_diabetes_type2'],
  },
  {
    id: 'drug_glipizide',
    canonicalName: '格列吡嗪',
    aliases: ['Glipizide', 'Glucotrol', '格列吡', '磺脲', '美吡达'],
    englishName: 'Glipizide',
    atcCode: 'A10BB07',
    classification: {
      category: '降糖药',
      subcategory: '磺脲类',
    },
    brands: ['美吡达', 'Glucotrol'],
    keywords: ['磺脲', '口服', '短效', '低血糖风险'],
    relatedIndicators: ['indicator_hba1c'],
    relatedDiseases: ['disease_diabetes_type2'],
  },
];

/**
 * 胰岛素类药物
 */
export const INSULIN_DRUGS: DrugEntity[] = [
  {
    id: 'drug_insulin_rapid',
    canonicalName: '速效胰岛素',
    aliases: ['门冬胰岛素', 'Novolog', 'NovoRapid', '赖脯胰岛素', 'Humalog', '速效', 'Rapid-acting', '餐时胰岛素'],
    englishName: 'Rapid-acting Insulin',
    atcCode: 'A10AB',
    classification: {
      category: '降糖药',
      subcategory: '胰岛素',
    },
    brands: ['诺和锐', '优泌乐'],
    keywords: ['速效', '餐前注射', '5-15分钟起效', '胰岛素', '低血糖'],
    relatedIndicators: ['indicator_hba1c', 'indicator_fasting_glucose'],
    relatedDiseases: ['disease_diabetes_type1', 'disease_diabetes_type2'],
  },
  {
    id: 'drug_insulin_short',
    canonicalName: '短效胰岛素',
    aliases: ['常规胰岛素', 'Regular Insulin', '短效', '短效胰岛素', 'RI', '诺和灵R', '优泌林R'],
    englishName: 'Short-acting Insulin',
    atcCode: 'A10AA',
    classification: {
      category: '降糖药',
      subcategory: '胰岛素',
    },
    brands: ['诺和灵R', '优泌林R'],
    keywords: ['短效', '餐前30分钟', '30分钟起效', '胰岛素', '静脉注射'],
    relatedIndicators: ['indicator_hba1c', 'indicator_fasting_glucose'],
    relatedDiseases: ['disease_diabetes_type1', 'disease_diabetes_type2'],
  },
  {
    id: 'drug_insulin_intermediate',
    canonicalName: '中效胰岛素',
    aliases: ['NPH胰岛素', 'Neutral Protamine Hagedorn', '低精蛋白锌胰岛素', '诺和灵N', '优泌林N', '中效'],
    englishName: 'Intermediate-acting Insulin',
    atcCode: 'A10AC',
    classification: {
      category: '降糖药',
      subcategory: '胰岛素',
    },
    brands: ['诺和灵N', '优泌林N'],
    keywords: ['中效', '1-2小时起效', '12-18小时', '胰岛素', '基础胰岛素'],
    relatedIndicators: ['indicator_hba1c', 'indicator_fasting_glucose'],
    relatedDiseases: ['disease_diabetes_type1', 'disease_diabetes_type2'],
  },
  {
    id: 'drug_insulin_long',
    canonicalName: '长效胰岛素',
    aliases: ['甘精胰岛素', 'Lantus', '来得时', '地特胰岛素', 'Levemir', '德谷胰岛素', 'Tresiba', '长效', 'Long-acting', '基础胰岛素'],
    englishName: 'Long-acting Insulin',
    atcCode: 'A10AE',
    classification: {
      category: '降糖药',
      subcategory: '胰岛素',
    },
    brands: ['来得时', 'Lantus', '诺和平', 'Levemir', '诺和达', 'Tresiba'],
    keywords: ['长效', '无峰', '24小时', '基础胰岛素', '一天一次', '甘精', '地特', '德谷'],
    relatedIndicators: ['indicator_hba1c', 'indicator_fasting_glucose'],
    relatedDiseases: ['disease_diabetes_type1', 'disease_diabetes_type2'],
  },
  {
    id: 'drug_insulin_premixed',
    canonicalName: '预混胰岛素',
    aliases: ['诺和灵30R', '诺和灵50R', '优泌林70/30', '预混', '双时相胰岛素', '诺和锐30', '优泌乐25'],
    englishName: 'Premixed Insulin',
    atcCode: 'A10AD',
    classification: {
      category: '降糖药',
      subcategory: '胰岛素',
    },
    brands: ['诺和灵30R', '诺和灵50R', '诺和锐30', '优泌林70/30', '优泌乐25'],
    keywords: ['预混', '双时相', '早晚注射', '胰岛素', '固定比例'],
    relatedIndicators: ['indicator_hba1c', 'indicator_fasting_glucose'],
    relatedDiseases: ['disease_diabetes_type2'],
  },
];

/**
 * 其他降糖药
 */
export const OTHER_ANTIDIABETIC_DRUGS: DrugEntity[] = [
  {
    id: 'drug_acarbose',
    canonicalName: '阿卡波糖',
    aliases: ['Acarbose', '拜唐苹', '阿卡', 'α-糖苷酶抑制剂', 'alpha-glucosidase inhibitor'],
    englishName: 'Acarbose',
    atcCode: 'A10BF01',
    classification: {
      category: '降糖药',
      subcategory: 'α-糖苷酶抑制剂',
    },
    brands: ['拜唐苹', '卡博平'],
    keywords: ['α-糖苷酶', '餐后血糖', '肠道气体', '口服', '淀粉', '随餐服用'],
    relatedIndicators: ['indicator_postprandial_glucose', 'indicator_hba1c'],
    relatedDiseases: ['disease_diabetes_type2', 'disease_prediabetes'],
  },
  {
    id: 'drug_pioglitazone',
    canonicalName: '吡格列酮',
    aliases: ['Pioglitazone', 'Actos', '艾可拓', '吡格', 'TZD', '噻唑烷二酮'],
    englishName: 'Pioglitazone',
    atcCode: 'A10BG03',
    classification: {
      category: '降糖药',
      subcategory: '噻唑烷二酮类',
    },
    brands: ['艾可拓', 'Actos'],
    keywords: ['TZD', '胰岛素增敏', '水肿', '心衰慎用', '骨折风险', '体重增加'],
    relatedIndicators: ['indicator_hba1c'],
    relatedDiseases: ['disease_diabetes_type2', 'disease_heart_failure'],
  },
  {
    id: 'drug_rosiglitazone',
    canonicalName: '罗格列酮',
    aliases: ['Rosiglitazone', 'Avandia', '罗格', 'TZD', '噻唑烷二酮'],
    englishName: 'Rosiglitazone',
    atcCode: 'A10BG02',
    classification: {
      category: '降糖药',
      subcategory: '噻唑烷二酮类',
    },
    brands: ['文迪雅', 'Avandia'],
    keywords: ['TZD', '胰岛素增敏', '心血管风险', '限制使用', '水肿'],
    relatedIndicators: ['indicator_hba1c'],
    relatedDiseases: ['disease_diabetes_type2'],
  },
];

/**
 * 全部降糖药词典
 */
export const ALL_ANTIDIABETIC_DRUGS: DrugEntity[] = [
  ...METFORMIN_DRUGS,
  ...GLP1_DRUGS,
  ...SGLT2_DRUGS,
  ...DPP4_DRUGS,
  ...SU_DRUGS,
  ...INSULIN_DRUGS,
  ...OTHER_ANTIDIABETIC_DRUGS,
];

/**
 * 根据ID获取降糖药实体
 */
export function getAntidiabeticById(id: string): DrugEntity | undefined {
  return ALL_ANTIDIABETIC_DRUGS.find(d => d.id === id);
}

/**
 * 根据名称或别名获取降糖药实体
 */
export function getAntidiabeticByName(name: string): DrugEntity | undefined {
  return ALL_ANTIDIABETIC_DRUGS.find(d =>
    d.canonicalName === name ||
    d.aliases.includes(name) ||
    d.aliases.some((alias: string) => alias.toLowerCase() === name.toLowerCase()) ||
    d.brands.includes(name)
  );
}
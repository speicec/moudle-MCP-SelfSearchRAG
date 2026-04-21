/**
 * Thyroid Drug Dictionary - 甲状腺药物词典
 */

import type { DrugEntity } from '../../types.js';

/**
 * 甲状腺激素类药物
 */
export const THYROID_HORMONE_DRUGS: DrugEntity[] = [
  {
    id: 'drug_levothyroxine',
    canonicalName: '左甲状腺素',
    aliases: ['Levothyroxine', '优甲乐', '左甲', 'L-T4', 'LT4', 'Synthroid', 'Euthyrox', '甲状腺素', '甲减药'],
    englishName: 'Levothyroxine',
    atcCode: 'H03AA01',
    classification: {
      category: '甲状腺药物',
      subcategory: '甲状腺激素',
    },
    brands: ['优甲乐', 'Euthyrox', 'Synthroid', '雷替斯'],
    keywords: ['甲减治疗', '甲状腺激素替代', 'TSH监测', '空腹服用', '一天一次', '妊娠可用'],
    relatedIndicators: ['indicator_tsh', 'indicator_ft3', 'indicator_ft4'],
    relatedDiseases: ['disease_hypothyroidism', 'disease_subclinical_hypothyroidism'],
  },
  {
    id: 'drug_liothyronine',
    canonicalName: '碘赛罗宁',
    aliases: ['Liothyronine', 'L-T3', 'LT3', '三碘甲状腺原氨酸', 'T3', 'Cytomel', '甲状腺片'],
    englishName: 'Liothyronine',
    atcCode: 'H03AA02',
    classification: {
      category: '甲状腺药物',
      subcategory: '甲状腺激素',
    },
    brands: ['Cytomel', '甲状腺片(含T3/T4)'],
    keywords: ['T3', '速效', '粘液性水肿昏迷', '一天多次', '心血管慎用'],
    relatedIndicators: ['indicator_tsh', 'indicator_ft3', 'indicator_ft4'],
    relatedDiseases: ['disease_hypothyroidism'],
  },
  {
    id: 'drug_thyroid_tablet',
    canonicalName: '甲状腺片',
    aliases: ['干甲状腺片', '甲状腺粉', 'Thyroid extract', '复方甲状腺片'],
    englishName: 'Thyroid Tablet',
    atcCode: 'H03AA03',
    classification: {
      category: '甲状腺药物',
      subcategory: '甲状腺激素',
    },
    brands: ['甲状腺片'],
    keywords: ['动物甲状腺提取', 'T3/T4混合', '含量不稳定', '逐渐淘汰'],
    relatedIndicators: ['indicator_tsh', 'indicator_ft3', 'indicator_ft4'],
    relatedDiseases: ['disease_hypothyroidism'],
  },
];

/**
 * 抗甲状腺药物
 */
export const ANTITHYROID_DRUGS: DrugEntity[] = [
  {
    id: 'drug_methimazole',
    canonicalName: '甲巯咪唑',
    aliases: ['Methimazole', '他巴唑', '甲巯', 'MMI', 'Tapazole', '赛治', '甲亢药'],
    englishName: 'Methimazole',
    atcCode: 'H03BB02',
    classification: {
      category: '甲状腺药物',
      subcategory: '抗甲状腺药',
    },
    brands: ['他巴唑', '赛治', 'Tapazole'],
    keywords: ['甲亢治疗', '抑制甲状腺激素合成', '一天一次或多次', '粒细胞缺乏', '肝损伤', '妊娠慎用'],
    relatedIndicators: ['indicator_tsh', 'indicator_ft3', 'indicator_ft4', 'indicator_wbc', 'indicator_liver'],
    relatedDiseases: ['disease_hyperthyroidism', 'disease_graves'],
  },
  {
    id: 'drug_propylthiouracil',
    canonicalName: '丙硫氧嘧啶',
    aliases: ['Propylthiouracil', 'PTU', '丙硫', 'Propacil', '甲亢药', '丙基硫氧嘧啶'],
    englishName: 'Propylthiouracil',
    atcCode: 'H03BB03',
    classification: {
      category: '甲状腺药物',
      subcategory: '抗甲状腺药',
    },
    brands: ['丙硫氧嘧啶片', 'Propacil'],
    keywords: ['甲亢治疗', '妊娠首选(严重甲亢)', '一天多次', '肝损伤风险', '粒细胞缺乏', '阻断T4转T3'],
    relatedIndicators: ['indicator_tsh', 'indicator_ft3', 'indicator_ft4', 'indicator_wbc', 'indicator_liver'],
    relatedDiseases: ['disease_hyperthyroidism', 'disease_graves', 'disease_thyroid_crisis'],
  },
];

/**
 * 其他甲状腺相关药物
 */
export const OTHER_THYROID_DRUGS: DrugEntity[] = [
  {
    id: 'drug_beta_blocker_thyroid',
    canonicalName: '普萘洛尔(甲亢辅助)',
    aliases: ['Propranolol甲状腺', '心得安甲亢', 'β阻滞剂甲亢'],
    englishName: 'Propranolol',
    atcCode: 'C07AA05',
    classification: {
      category: '甲状腺药物',
      subcategory: '辅助用药',
    },
    brands: ['心得安'],
    keywords: ['甲亢症状控制', '心率', '震颤', '焦虑', '阻断T4转T3'],
    relatedIndicators: ['indicator_heart_rate', 'indicator_tsh', 'indicator_ft3', 'indicator_ft4'],
    relatedDiseases: ['disease_hyperthyroidism'],
  },
  {
    id: 'drug_iodine_solution',
    canonicalName: '复方碘溶液',
    aliases: ['Lugol溶液', '碘化钾', '复方碘', '碘剂', 'Lugols iodine', '饱和碘化钾'],
    englishName: 'Iodine Solution',
    atcCode: 'H03CA',
    classification: {
      category: '甲状腺药物',
      subcategory: '碘剂',
    },
    brands: ['复方碘溶液', 'Lugol溶液'],
    keywords: ['甲状腺术前准备', '甲状腺危象', '抑制甲状腺激素释放', '短期使用', 'Wolff-Chaikoff效应'],
    relatedIndicators: ['indicator_tsh', 'indicator_ft3', 'indicator_ft4'],
    relatedDiseases: ['disease_hyperthyroidism', 'disease_thyroid_crisis'],
  },
  {
    id: 'drug_radioactive_iodine',
    canonicalName: '放射性碘',
    aliases: ['碘131', 'I-131', 'Radioactive Iodine', 'RAI', '131I', '同位素碘', '碘放射治疗'],
    englishName: 'Radioactive Iodine',
    atcCode: 'H03CA',
    classification: {
      category: '甲状腺药物',
      subcategory: '放射性碘',
    },
    brands: ['碘131治疗'],
    keywords: ['甲亢根治治疗', 'Graves病', '甲状腺癌', '放射治疗', '永久甲减风险', '妊娠禁用'],
    relatedIndicators: ['indicator_tsh', 'indicator_ft3', 'indicator_ft4'],
    relatedDiseases: ['disease_hyperthyroidism', 'disease_thyroid_cancer'],
  },
  {
    id: 'drug_cholestyramine_thyroid',
    canonicalName: '考来烯胺(甲状腺辅助)',
    aliases: ['Cholestyramine', '消胆胺', '甲状腺激素阻断'],
    englishName: 'Cholestyramine',
    atcCode: 'C10AD01',
    classification: {
      category: '甲状腺药物',
      subcategory: '辅助用药',
    },
    brands: ['消胆胺', 'Questran'],
    keywords: ['阻断甲状腺激素肠肝循环', '甲状腺过量', '甲亢危象辅助', '与左甲状腺素间隔4小时'],
    relatedIndicators: ['indicator_tsh', 'indicator_ft3', 'indicator_ft4'],
    relatedDiseases: ['disease_hyperthyroidism', 'disease_thyroid_crisis'],
  },
];

/**
 * 全部甲状腺药物词典
 */
export const ALL_THYROID_DRUGS: DrugEntity[] = [
  ...THYROID_HORMONE_DRUGS,
  ...ANTITHYROID_DRUGS,
  ...OTHER_THYROID_DRUGS,
];

/**
 * 根据ID获取甲状腺药物实体
 */
export function getThyroidDrugById(id: string): DrugEntity | undefined {
  return ALL_THYROID_DRUGS.find(d => d.id === id);
}

/**
 * 根据名称或别名获取甲状腺药物实体
 */
export function getThyroidDrugByName(name: string): DrugEntity | undefined {
  return ALL_THYROID_DRUGS.find(d =>
    d.canonicalName === name ||
    d.aliases.includes(name) ||
    d.aliases.some((alias: string) => alias.toLowerCase() === name.toLowerCase()) ||
    d.brands.includes(name)
  );
}
/**
 * Disease Dictionary - 内分泌领域疾病词典
 */

import type { DiseaseEntity } from '../types.js';

/**
 * 糖尿病相关疾病
 */
export const DIABETES_DISEASES: DiseaseEntity[] = [
  {
    id: 'disease_diabetes_type1',
    canonicalName: '1型糖尿病',
    aliases: ['T1DM', '1型DM', 'IDDM', '胰岛素依赖型糖尿病', 'Type 1 Diabetes', '青少年糖尿病'],
    icdCode: 'E10.9',
    category: '内分泌代谢',
    keywords: ['胰岛素', '自身免疫', '青少年', '酮症酸中毒'],
  },
  {
    id: 'disease_diabetes_type2',
    canonicalName: '2型糖尿病',
    aliases: ['T2DM', '2型DM', 'NIDDM', '非胰岛素依赖型糖尿病', 'Type 2 Diabetes', '糖尿病', '成年发病型糖尿病'],
    icdCode: 'E11.9',
    category: '内分泌代谢',
    keywords: ['血糖', '胰岛素抵抗', 'HbA1c', '并发症', '生活方式', '肥胖'],
  },
  {
    id: 'disease_diabetes_gdm',
    canonicalName: '妊娠期糖尿病',
    aliases: ['GDM', '妊娠糖尿病', 'Gestational Diabetes', '孕期糖尿病'],
    icdCode: 'O24.4',
    category: '内分泌代谢',
    keywords: ['妊娠', '孕妇', '血糖', '产后', 'OGTT'],
  },
  {
    id: 'disease_prediabetes',
    canonicalName: '糖尿病前期',
    aliases: ['糖调节受损', 'IGT', 'IFG', 'Prediabetes', '血糖异常', '糖耐量异常'],
    icdCode: 'R73.0',
    category: '内分泌代谢',
    keywords: ['空腹血糖', '餐后血糖', 'HbA1c', '预防', '生活方式'],
  },
  {
    id: 'disease_diabetic_nephropathy',
    canonicalName: '糖尿病肾病',
    aliases: ['DN', '糖尿病肾脏病变', 'Diabetic Nephropathy', '糖肾'],
    icdCode: 'E11.2',
    category: '内分泌代谢',
    keywords: ['尿蛋白', 'eGFR', '肾功能', 'CKD', '微量白蛋白尿'],
  },
  {
    id: 'disease_diabetic_retinopathy',
    canonicalName: '糖尿病视网膜病变',
    aliases: ['DR', '糖网', 'Diabetic Retinopathy', '视网膜病变'],
    icdCode: 'E11.3',
    category: '内分泌代谢',
    keywords: ['眼底', '视力', '视网膜', '激光', '黄斑'],
  },
  {
    id: 'disease_diabetic_neuropathy',
    canonicalName: '糖尿病神经病变',
    aliases: ['糖尿病周围神经病变', 'DPN', 'Diabetic Neuropathy', '神经病变', '周围神经病变'],
    icdCode: 'E11.4',
    category: '内分泌代谢',
    keywords: ['麻木', '疼痛', '感觉异常', '足部', '神经'],
  },
  {
    id: 'disease_diabetic_foot',
    canonicalName: '糖尿病足',
    aliases: ['Diabetic Foot', '糖尿病足病', '足溃疡', 'DF'],
    icdCode: 'E11.5',
    category: '内分泌代谢',
    keywords: ['溃疡', '感染', '截肢', '足部护理', '血管'],
  },
];

/**
 * 高血压相关疾病
 */
export const HYPERTENSION_DISEASES: DiseaseEntity[] = [
  {
    id: 'disease_hypertension_primary',
    canonicalName: '原发性高血压',
    aliases: ['高血压', 'Hypertension', '高血压病', 'HTN', '血压高', '原发性血压升高'],
    icdCode: 'I10',
    category: '心血管',
    keywords: ['血压', '收缩压', '舒张压', '生活方式', '遗传'],
  },
  {
    id: 'disease_hypertension_secondary',
    canonicalName: '继发性高血压',
    aliases: ['Secondary Hypertension', '继发高血压', '症状性高血压'],
    icdCode: 'I15',
    category: '心血管',
    keywords: ['肾动脉狭窄', '醛固酮增多', '肾上腺', '甲亢', '睡眠呼吸暂停'],
  },
  {
    id: 'disease_hypertension_urgency',
    canonicalName: '高血压急症',
    aliases: ['Hypertensive Urgency', '高血压危象', '急进型高血压'],
    icdCode: 'I16.0',
    category: '心血管',
    keywords: ['血压急剧升高', '靶器官损害', '急诊', '危象'],
  },
  {
    id: 'disease_hypertensive_heart_disease',
    canonicalName: '高血压性心脏病',
    aliases: ['Hypertensive Heart Disease', '高心病', '心脏损害'],
    icdCode: 'I11',
    category: '心血管',
    keywords: ['左心室肥厚', '心衰', '心脏扩大', '心肌'],
  },
];

/**
 * 甲状腺相关疾病
 */
export const THYROID_DISEASES: DiseaseEntity[] = [
  {
    id: 'disease_hyperthyroidism',
    canonicalName: '甲状腺功能亢进症',
    aliases: ['甲亢', 'Hyperthyroidism', '甲状腺亢进', 'Graves病', '毒性弥漫性甲状腺肿'],
    icdCode: 'E05',
    category: '内分泌代谢',
    keywords: ['TSH', 'FT3', 'FT4', '心悸', '消瘦', '突眼', '甲状腺肿大'],
  },
  {
    id: 'disease_hypothyroidism',
    canonicalName: '甲状腺功能减退症',
    aliases: ['甲减', 'Hypothyroidism', '甲状腺减退', '粘液性水肿'],
    icdCode: 'E03',
    category: '内分泌代谢',
    keywords: ['TSH升高', 'FT4降低', '乏力', '水肿', '体重增加', '怕冷'],
  },
  {
    id: 'disease_thyroid_nodule',
    canonicalName: '甲状腺结节',
    aliases: ['Thyroid Nodule', '甲状腺肿物', '结节性甲状腺肿'],
    icdCode: 'E04.1',
    category: '内分泌代谢',
    keywords: ['结节', '超声', 'TI-RADS', '穿刺', '手术', '良性', '恶性'],
  },
  {
    id: 'disease_subclinical_hypothyroidism',
    canonicalName: '亚临床甲状腺功能减退',
    aliases: ['亚临床甲减', 'Subclinical Hypothyroidism', '轻度甲减'],
    icdCode: 'E03.9',
    category: '内分泌代谢',
    keywords: ['TSH升高', 'FT4正常', '无症状', '妊娠', '治疗指征'],
  },
  {
    id: 'disease_subclinical_hyperthyroidism',
    canonicalName: '亚临床甲状腺功能亢进',
    aliases: ['亚临床甲亢', 'Subclinical Hyperthyroidism', '轻度甲亢'],
    icdCode: 'E05.9',
    category: '内分泌代谢',
    keywords: ['TSH降低', 'FT3/FT4正常', '无症状', '骨质疏松', '心房颤动'],
  },
];

/**
 * 肾脏疾病
 */
export const KIDNEY_DISEASES: DiseaseEntity[] = [
  {
    id: 'disease_ckd',
    canonicalName: '慢性肾脏病',
    aliases: ['CKD', '慢性肾病', 'Chronic Kidney Disease', '肾功能不全', '肾衰'],
    icdCode: 'N18',
    category: '泌尿系统',
    keywords: ['eGFR', '蛋白尿', '分期', '透析', '移植', '肾功能'],
  },
  {
    id: 'disease_ckd_stage1',
    canonicalName: '慢性肾脏病1期',
    aliases: ['CKD 1期', 'CKD G1', '肾损害正常GFR'],
    icdCode: 'N18.1',
    category: '泌尿系统',
    keywords: ['eGFR≥90', '蛋白尿', '肾损害', '正常功能'],
  },
  {
    id: 'disease_ckd_stage2',
    canonicalName: '慢性肾脏病2期',
    aliases: ['CKD 2期', 'CKD G2', '轻度下降'],
    icdCode: 'N18.2',
    category: '泌尿系统',
    keywords: ['eGFR 60-89', '轻度', '肾损害'],
  },
  {
    id: 'disease_ckd_stage3',
    canonicalName: '慢性肾脏病3期',
    aliases: ['CKD 3期', 'CKD G3', '中度下降', 'CKD 3a', 'CKD 3b'],
    icdCode: 'N18.3',
    category: '泌尿系统',
    keywords: ['eGFR 30-59', '中度', '监测'],
  },
  {
    id: 'disease_ckd_stage4',
    canonicalName: '慢性肾脏病4期',
    aliases: ['CKD 4期', 'CKD G4', '重度下降'],
    icdCode: 'N18.4',
    category: '泌尿系统',
    keywords: ['eGFR 15-29', '重度', '准备透析'],
  },
  {
    id: 'disease_ckd_stage5',
    canonicalName: '慢性肾脏病5期',
    aliases: ['CKD 5期', 'CKD G5', '终末期肾病', 'ESRD', '尿毒症'],
    icdCode: 'N18.5',
    category: '泌尿系统',
    keywords: ['eGFR<15', '透析', '移植', '终末期'],
  },
];

/**
 * 全部疾病词典
 */
export const ALL_DISEASES: DiseaseEntity[] = [
  ...DIABETES_DISEASES,
  ...HYPERTENSION_DISEASES,
  ...THYROID_DISEASES,
  ...KIDNEY_DISEASES,
];

/**
 * 根据ID获取疾病实体
 */
export function getDiseaseById(id: string): DiseaseEntity | undefined {
  return ALL_DISEASES.find(d => d.id === id);
}

/**
 * 根据名称或别名获取疾病实体
 */
export function getDiseaseByName(name: string): DiseaseEntity | undefined {
  return ALL_DISEASES.find(d =>
    d.canonicalName === name ||
    d.aliases.includes(name) ||
    d.aliases.some(alias => alias.toLowerCase() === name.toLowerCase())
  );
}
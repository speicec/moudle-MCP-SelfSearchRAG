/**
 * Guideline Dictionary - 指南来源词典
 */

import type { GuidelineSource } from '../types.js';

/**
 * 糖尿病指南
 */
export const DIABETES_GUIDELINES: GuidelineSource[] = [
  {
    id: 'guideline_ada',
    name: 'ADA Standards of Care',
    fullName: 'American Diabetes Association Standards of Medical Care in Diabetes',
    shortName: 'ADA',
    organization: 'American Diabetes Association',
    country: 'US',
    domain: ['diabetes'],
    latestVersion: 2024,
    updateCycle: '每年更新',
  },
  {
    id: 'guideline_cds',
    name: '中国2型糖尿病防治指南',
    fullName: '中国2型糖尿病防治指南',
    shortName: 'CDS',
    organization: '中华医学会糖尿病学分会',
    country: 'CN',
    domain: ['diabetes'],
    latestVersion: 2020,
    updateCycle: '3-5年更新',
  },
  {
    id: 'guideline_esa',
    name: 'EASD-ADA Consensus',
    fullName: 'European Association for the Study of Diabetes-American Diabetes Association Consensus',
    shortName: 'EASD-ADA',
    organization: 'EASD/ADA',
    country: 'EU/US',
    domain: ['diabetes'],
    latestVersion: 2022,
    updateCycle: '按需更新',
  },
];

/**
 * 肾脏疾病指南
 */
export const KIDNEY_GUIDELINES: GuidelineSource[] = [
  {
    id: 'guideline_kdigo',
    name: 'KDIGO Guidelines',
    fullName: 'Kidney Disease: Improving Global Outcomes Guidelines',
    shortName: 'KDIGO',
    organization: 'KDIGO',
    country: 'International',
    domain: ['ckd', 'diabetes_nephropathy'],
    latestVersion: 2024,
    updateCycle: '按章节更新',
  },
  {
    id: 'guideline_kdoqi',
    name: 'KDOQI Guidelines',
    fullName: 'Kidney Disease Outcomes Quality Initiative Guidelines',
    shortName: 'KDOQI',
    organization: 'National Kidney Foundation',
    country: 'US',
    domain: ['ckd'],
    latestVersion: 2021,
    updateCycle: '按章节更新',
  },
];

/**
 * 高血压指南
 */
export const HYPERTENSION_GUIDELINES: GuidelineSource[] = [
  {
    id: 'guideline_esc',
    name: 'ESC/ESH Guidelines',
    fullName: 'European Society of Cardiology/European Society of Hypertension Guidelines for the Management of Arterial Hypertension',
    shortName: 'ESC/ESH',
    organization: 'ESC/ESH',
    country: 'EU',
    domain: ['hypertension'],
    latestVersion: 2023,
    updateCycle: '3-4年更新',
  },
  {
    id: 'guideline_acc',
    name: 'ACC/AHA Guidelines',
    fullName: 'American College of Cardiology/American Heart Association Guidelines for the Prevention, Detection, Evaluation, and Management of High Blood Pressure in Adults',
    shortName: 'ACC/AHA',
    organization: 'ACC/AHA',
    country: 'US',
    domain: ['hypertension'],
    latestVersion: 2017,
    updateCycle: '按需更新',
  },
  {
    id: 'guideline_csh',
    name: '中国高血压防治指南',
    fullName: '中国高血压防治指南',
    shortName: 'CSH',
    organization: '中国高血压联盟',
    country: 'CN',
    domain: ['hypertension'],
    latestVersion: 2018,
    updateCycle: '5年更新',
  },
];

/**
 * 甲状腺指南
 */
export const THYROID_GUIDELINES: GuidelineSource[] = [
  {
    id: 'guideline_ata',
    name: 'ATA Guidelines',
    fullName: 'American Thyroid Association Guidelines',
    shortName: 'ATA',
    organization: 'American Thyroid Association',
    country: 'US',
    domain: ['thyroid'],
    latestVersion: 2023,
    updateCycle: '按章节更新',
  },
  {
    id: 'guideline_eta',
    name: 'ETA Guidelines',
    fullName: 'European Thyroid Association Guidelines',
    shortName: 'ETA',
    organization: 'European Thyroid Association',
    country: 'EU',
    domain: ['thyroid'],
    latestVersion: 2021,
    updateCycle: '按需更新',
  },
  {
    id: 'guideline_cma',
    name: '中国甲状腺疾病诊治指南',
    fullName: '中国甲状腺疾病诊治指南',
    shortName: 'CMA',
    organization: '中华医学会内分泌学分会',
    country: 'CN',
    domain: ['thyroid'],
    latestVersion: 2019,
    updateCycle: '按需更新',
  },
];

/**
 * 血脂指南
 */
export const LIPID_GUIDELINES: GuidelineSource[] = [
  {
    id: 'guideline_esc_lipid',
    name: 'ESC/EAS Lipid Guidelines',
    fullName: 'European Society of Cardiology/European Atherosclerosis Society Guidelines for the Management of Dyslipidaemias',
    shortName: 'ESC/EAS',
    organization: 'ESC/EAS',
    country: 'EU',
    domain: ['lipid'],
    latestVersion: 2021,
    updateCycle: '4-5年更新',
  },
  {
    id: 'guideline_acc_lipid',
    name: 'ACC/AHA Cholesterol Guidelines',
    fullName: 'ACC/AHA Guideline on the Treatment of Blood Cholesterol to Reduce Atherosclerotic Cardiovascular Risk in Adults',
    shortName: 'ACC/AHA',
    organization: 'ACC/AHA',
    country: 'US',
    domain: ['lipid'],
    latestVersion: 2018,
    updateCycle: '按需更新',
  },
];

/**
 * 心血管指南
 */
export const CARDIOVASCULAR_GUIDELINES: GuidelineSource[] = [
  {
    id: 'guideline_esc_heart_failure',
    name: 'ESC Heart Failure Guidelines',
    fullName: 'ESC Guidelines for the diagnosis and treatment of acute and chronic heart failure',
    shortName: 'ESC-HF',
    organization: 'ESC',
    country: 'EU',
    domain: ['heart_failure'],
    latestVersion: 2021,
    updateCycle: '4-5年更新',
  },
  {
    id: 'guideline_acc_heart_failure',
    name: 'ACC/AHA HF Guidelines',
    fullName: 'ACC/AHA Guideline for the Management of Heart Failure',
    shortName: 'ACC/AHA-HF',
    organization: 'ACC/AHA',
    country: 'US',
    domain: ['heart_failure'],
    latestVersion: 2022,
    updateCycle: '按需更新',
  },
];

/**
 * 全部指南词典
 */
export const ALL_GUIDELINES: GuidelineSource[] = [
  ...DIABETES_GUIDELINES,
  ...KIDNEY_GUIDELINES,
  ...HYPERTENSION_GUIDELINES,
  ...THYROID_GUIDELINES,
  ...LIPID_GUIDELINES,
  ...CARDIOVASCULAR_GUIDELINES,
];

/**
 * 根据ID获取指南实体
 */
export function getGuidelineById(id: string): GuidelineSource | undefined {
  return ALL_GUIDELINES.find(g => g.id === id);
}

/**
 * 根据shortName获取指南实体
 */
export function getGuidelineByShortName(shortName: string): GuidelineSource | undefined {
  return ALL_GUIDELINES.find(g =>
    g.shortName === shortName ||
    g.shortName.toLowerCase() === shortName.toLowerCase()
  );
}

/**
 * 根据领域获取指南列表
 */
export function getGuidelinesByDomain(domain: string): GuidelineSource[] {
  return ALL_GUIDELINES.filter(g => g.domain.includes(domain));
}

/**
 * 检查指南时效性
 */
export function checkGuidelineTimeliness(guideline: GuidelineSource): {
  isCurrent: boolean;
  expirationWarning?: string;
} {
  const currentYear = new Date().getFullYear();
  const yearsSinceUpdate = currentYear - guideline.latestVersion;

  if (yearsSinceUpdate > 5) {
    return {
      isCurrent: false,
      expirationWarning: `该指南发布于${guideline.latestVersion}年，可能已过期，建议查阅最新版`,
    };
  }

  if (yearsSinceUpdate > 3) {
    return {
      isCurrent: true,
      expirationWarning: `该指南发布于${guideline.latestVersion}年，${guideline.updateCycle}，建议确认是否有更新版`,
    };
  }

  return { isCurrent: true };
}
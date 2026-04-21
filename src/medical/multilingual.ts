/**
 * Multilingual Support - 多语言支持
 *
 * 支持中文、英文及中英混合的医学查询
 */

import type { MedicalEntities, DiseaseMatch, DrugMatch, IndicatorMatch } from './types.js';

/**
 * 语言类型
 */
export type Language = 'zh' | 'en' | 'mixed';

/**
 * 语言检测结果
 */
export interface LanguageDetection {
  language: Language;
  chineseRatio: number;
  englishRatio: number;
  detectedTerms: {
    chinese: string[];
    english: string[];
  };
}

/**
 * 翻译映射（常见医学术语）
 */
const MEDICAL_TERM_TRANSLATIONS: Record<string, string> = {
  // 疾病
  'diabetes': '糖尿病',
  'type 2 diabetes': '2型糖尿病',
  'type 1 diabetes': '1型糖尿病',
  'hypertension': '高血压',
  'thyroid disease': '甲状腺疾病',
  'hypothyroidism': '甲状腺功能减退',
  'hyperthyroidism': '甲状腺功能亢进',
  'chronic kidney disease': '慢性肾脏病',
  'CKD': '慢性肾脏病',
  'nephropathy': '肾病',

  // 药物
  'metformin': '二甲双胍',
  'insulin': '胰岛素',
  'glipizide': '格列吡嗪',
  'glibenclamide': '格列本脲',
  'lisinopril': '赖诺普利',
  'amlodipine': '氨氯地平',
  'levothyroxine': '左甲状腺素',

  // 指标
  'eGFR': '肾小球滤过率',
  'glomerular filtration rate': '肾小球滤过率',
  'blood glucose': '血糖',
  'HbA1c': '糖化血红蛋白',
  'TSH': '促甲状腺激素',
  'blood pressure': '血压',

  // 关键词
  'contraindication': '禁忌',
  'precaution': '慎用',
  'interaction': '相互作用',
  'dosage': '剂量',
  'dosage adjustment': '剂量调整',
  'side effects': '副作用',
};

/**
 * 中文到英文的反向映射
 */
const ZH_TO_EN_TRANSLATIONS: Record<string, string> = {};
for (const [en, zh] of Object.entries(MEDICAL_TERM_TRANSLATIONS)) {
  ZH_TO_EN_TRANSLATIONS[zh] = en;
}

/**
 * 检测查询语言
 */
export function detectLanguage(query: string): LanguageDetection {
  // 统计中英字符比例
  const chineseChars = query.match(/[一-鿿]/g) ?? [];
  const englishWords = query.match(/[a-zA-Z]+/g) ?? [];

  const totalChars = query.length;
  const chineseRatio = chineseChars.length / totalChars;
  const englishRatio = englishWords.join('').length / totalChars;

  // 确定主要语言
  let language: Language;
  if (chineseRatio > 0.3 && englishRatio > 0.3) {
    language = 'mixed';
  } else if (chineseRatio > englishRatio) {
    language = 'zh';
  } else {
    language = 'en';
  }

  // 提取检测到的术语
  const detectedTerms = {
    chinese: chineseChars.length > 0 ? [query] : [],
    english: englishWords.filter(w => w.length > 2),
  };

  return {
    language,
    chineseRatio,
    englishRatio,
    detectedTerms,
  };
}

/**
 * 扩展查询词（添加翻译）
 */
export function expandQueryTerms(query: string): string[] {
  const expanded: string[] = [query];
  const lowerQuery = query.toLowerCase();

  // 添加英文术语的中文翻译
  for (const [en, zh] of Object.entries(MEDICAL_TERM_TRANSLATIONS)) {
    if (lowerQuery.includes(en.toLowerCase())) {
      expanded.push(zh);
    }
  }

  // 添加中文术语的英文翻译
  for (const [zh, en] of Object.entries(ZH_TO_EN_TRANSLATIONS)) {
    if (query.includes(zh)) {
      expanded.push(en);
    }
  }

  return [...new Set(expanded)];
}

/**
 * 翻译实体名称（用于扩展）
 */
export function translateEntityName(name: string): string | undefined {
  const lowerName = name.toLowerCase();

  // 英文 -> 中文
  if (MEDICAL_TERM_TRANSLATIONS[lowerName]) {
    return MEDICAL_TERM_TRANSLATIONS[lowerName];
  }

  // 中文 -> 英文
  if (ZH_TO_EN_TRANSLATIONS[name]) {
    return ZH_TO_EN_TRANSLATIONS[name];
  }

  return undefined;
}

/**
 * 扩展实体别名（多语言）
 */
export function expandEntityAliases(entities: MedicalEntities): {
  diseases: DiseaseMatch[];
  drugs: DrugMatch[];
  indicators: IndicatorMatch[];
} {
  // 扩展疾病别名
  const expandedDiseases = entities.diseases.map((d: DiseaseMatch) => {
    const translatedName = translateEntityName(d.canonicalName);
    const expandedAliases = translatedName
      ? [...d.aliases, translatedName]
      : d.aliases;
    return {
      ...d,
      aliases: [...new Set(expandedAliases)],
    };
  });

  // 扩展药物别名
  const expandedDrugs = entities.drugs.map((d: DrugMatch) => {
    const translatedName = translateEntityName(d.canonicalName);
    const expandedAliases = translatedName
      ? [...d.aliases, translatedName]
      : d.aliases;
    return {
      ...d,
      aliases: [...new Set(expandedAliases)],
    };
  });

  // 扩展指标别名
  const expandedIndicators = entities.indicators.map((i: IndicatorMatch) => {
    const translatedName = translateEntityName(i.canonicalName);
    // 指标没有 aliases 字段，保持原样
    return i;
  });

  return {
    diseases: expandedDiseases,
    drugs: expandedDrugs,
    indicators: expandedIndicators,
  };
}

/**
 * 构建多语言查询
 */
export function buildMultilingualQuery(query: string): {
  primaryQuery: string;
  expandedTerms: string[];
} {
  const detection = detectLanguage(query);
  const expandedTerms = expandQueryTerms(query);

  // 如果是英文查询，添加中文翻译到主查询
  let primaryQuery = query;
  if (detection.language === 'en') {
    const translations = expandedTerms.slice(1).join(' ');
    if (translations) {
      primaryQuery = `${query} ${translations}`;
    }
  }

  // 如果是中文查询，添加英文翻译到扩展词
  if (detection.language === 'zh') {
    expandedTerms.push(...expandQueryTerms(query).slice(1));
  }

  return {
    primaryQuery,
    expandedTerms: [...new Set(expandedTerms)],
  };
}

/**
 * 格式化回答语言
 */
export function formatAnswerLanguage(answer: {
  conclusion: { text: string };
  details: { points: Array<{ text: string }> };
  warnings: string[];
}, language: Language): {
  conclusion: { text: string };
  details: { points: Array<{ text: string }> };
  warnings: string[];
} {
  // 当前实现保持原语言输出
  // 未来可以添加自动翻译功能
  return answer;
}

/**
 * 多语言支持的提示词模板
 */
export const MULTILINGUAL_PROMPTS = {
  zh: {
    thinkHeader: '你是一个医学推理助手。请分析当前状态并决策下一步行动。',
    decideHeader: '请判断当前状态是否满足回答条件。',
    answerHeader: '你是一个医学助手，需要生成结构化的医学回答。',
    qualityHeader: '请检查以下回答的质量。',
    warningText: '本回答仅供参考，不构成医疗建议。请咨询专业医生后再做决定。',
  },
  en: {
    thinkHeader: 'You are a medical reasoning assistant. Analyze the current state and decide the next action.',
    decideHeader: 'Determine if the current state meets the criteria for answering.',
    answerHeader: 'You are a medical assistant. Generate a structured medical answer.',
    qualityHeader: 'Review the quality of the following answer.',
    warningText: 'This answer is for reference only and does not constitute medical advice. Consult a professional doctor before making decisions.',
  },
};
/**
 * Domain Expansion - 医学领域扩展配置
 *
 * 支持扩展 Agent 到心血管、肿瘤、神经等领域
 */

/**
 * 医学领域定义
 */
export interface MedicalDomain {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  keywords: string[];
  guidelineSources: string[];
  relatedDiseases: string[];
  relatedDrugs: string[];
  relatedIndicators: string[];
}

/**
 * 预定义医学领域
 */
export const MEDICAL_DOMAINS: MedicalDomain[] = [
  {
    id: 'endocrinology',
    name: '内分泌',
    nameEn: 'Endocrinology',
    description: '糖尿病、甲状腺、肾上腺等内分泌疾病',
    keywords: ['糖尿病', '甲状腺', '胰岛素', '降糖药', '血糖', 'HbA1c'],
    guidelineSources: ['ADA', 'KDIGO', 'ATA', 'CDS'],
    relatedDiseases: ['diabetes', 'thyroid', 'CKD'],
    relatedDrugs: ['antidiabetic', 'thyroid'],
    relatedIndicators: ['glucose', 'HbA1c', 'TSH', 'eGFR'],
  },
  {
    id: 'cardiovascular',
    name: '心血管',
    nameEn: 'Cardiovascular',
    description: '高血压、冠心病、心律失常等心血管疾病',
    keywords: ['高血压', '冠心病', '心衰', '心律失常', '血压', 'ACEI', 'ARB'],
    guidelineSources: ['ESC', 'ACC', 'AHA', 'ESC/ESH'],
    relatedDiseases: ['hypertension', 'CHD', 'AF', 'HF'],
    relatedDrugs: ['antihypertensive', 'anticoagulant', 'antiplatelet'],
    relatedIndicators: ['BP', 'HR', 'LDL', 'BNP'],
  },
  {
    id: 'oncology',
    name: '肿瘤',
    nameEn: 'Oncology',
    description: '各类肿瘤的诊断和治疗',
    keywords: ['肿瘤', '癌症', '化疗', '放疗', '靶向治疗', '免疫治疗'],
    guidelineSources: ['NCCN', 'ESMO', 'ASCO', 'CSCO'],
    relatedDiseases: ['lung_cancer', 'breast_cancer', 'GI_cancer'],
    relatedDrugs: ['chemotherapy', 'targeted', 'immunotherapy'],
    relatedIndicators: ['CEA', 'AFP', 'PSA', 'CA125'],
  },
  {
    id: 'neurology',
    name: '神经',
    nameEn: 'Neurology',
    description: '脑血管病、癫痫、帕金森等神经系统疾病',
    keywords: ['脑血管', '卒中', '癫痫', '帕金森', '头痛', '认知障碍'],
    guidelineSources: ['AAN', 'EAN', 'ASA', 'ESO'],
    relatedDiseases: ['stroke', 'epilepsy', 'PD', 'AD'],
    relatedDrugs: ['antiepileptic', 'antiparkinson', 'anticoagulant'],
    relatedIndicators: ['MRI', 'EEG', 'CSF', 'MMSE'],
  },
  {
    id: 'respiratory',
    name: '呼吸',
    nameEn: 'Respiratory',
    description: '哮喘、慢阻肺、肺炎等呼吸系统疾病',
    keywords: ['哮喘', '慢阻肺', 'COPD', '肺炎', '呼吸衰竭'],
    guidelineSources: ['GINA', 'GOLD', 'ATS', 'ERS'],
    relatedDiseases: ['asthma', 'COPD', 'pneumonia'],
    relatedDrugs: ['bronchodilator', 'corticosteroid', 'antibiotic'],
    relatedIndicators: ['FEV1', 'PEF', 'SpO2', 'PaO2'],
  },
  {
    id: 'gastroenterology',
    name: '消化',
    nameEn: 'Gastroenterology',
    description: '胃炎、肝病、肠病等消化系统疾病',
    keywords: ['胃炎', '肝硬化', '肝炎', '胃溃疡', '结肠炎'],
    guidelineSources: ['AGA', 'EASL', 'AASLD', 'BSG'],
    relatedDiseases: ['gastritis', 'hepatitis', 'IBD', 'GERD'],
    relatedDrugs: ['PPI', 'antiviral', 'immunosuppressant'],
    relatedIndicators: ['ALT', 'AST', 'bilirubin', 'endoscopy'],
  },
];

/**
 * 领域配置
 */
export interface DomainConfig {
  activeDomains: string[];
  defaultDomain: string;
  enableCrossDomain: boolean;
  domainPriority: string[];
}

/**
 * 默认领域配置
 */
export const DEFAULT_DOMAIN_CONFIG: DomainConfig = {
  activeDomains: ['endocrinology'],
  defaultDomain: 'endocrinology',
  enableCrossDomain: false,
  domainPriority: ['endocrinology', 'cardiovascular', 'oncology', 'neurology'],
};

/**
 * 领域管理器
 */
export class DomainManager {
  private config: DomainConfig;
  private domains: Map<string, MedicalDomain> = new Map();

  constructor(config: Partial<DomainConfig> = {}) {
    this.config = {
      ...DEFAULT_DOMAIN_CONFIG,
      ...config,
    };

    // 注册所有预定义领域
    for (const domain of MEDICAL_DOMAINS) {
      this.domains.set(domain.id, domain);
    }
  }

  /**
   * 获取领域
   */
  getDomain(domainId: string): MedicalDomain | undefined {
    return this.domains.get(domainId);
  }

  /**
   * 获取所有活跃领域
   */
  getActiveDomains(): MedicalDomain[] {
    return this.config.activeDomains
      .map(id => this.domains.get(id))
      .filter(d => d !== undefined);
  }

  /**
   * 添加领域
   */
  addDomain(domain: MedicalDomain): void {
    this.domains.set(domain.id, domain);
    if (!this.config.activeDomains.includes(domain.id)) {
      this.config.activeDomains.push(domain.id);
    }
  }

  /**
   * 激活领域
   */
  activateDomain(domainId: string): void {
    if (this.domains.has(domainId) && !this.config.activeDomains.includes(domainId)) {
      this.config.activeDomains.push(domainId);
    }
  }

  /**
   * 禁用领域
   */
  deactivateDomain(domainId: string): void {
    this.config.activeDomains = this.config.activeDomains.filter(id => id !== domainId);
  }

  /**
   * 检测查询所属领域
   */
  detectDomain(query: string): MedicalDomain | undefined {
    const lowerQuery = query.toLowerCase();

    // 遍历所有活跃领域
    for (const domain of this.getActiveDomains()) {
      // 检查关键词匹配
      const matchedKeywords = domain.keywords.filter(kw =>
        lowerQuery.includes(kw.toLowerCase())
      );

      if (matchedKeywords.length >= 2) {
        return domain;
      }
    }

    // 返回默认领域
    return this.domains.get(this.config.defaultDomain);
  }

  /**
   * 获取领域的指南来源
   */
  getGuidelineSources(domainId: string): string[] {
    const domain = this.domains.get(domainId);
    return domain?.guidelineSources ?? [];
  }

  /**
   * 获取领域的关键词
   */
  getDomainKeywords(domainId: string): string[] {
    const domain = this.domains.get(domainId);
    return domain?.keywords ?? [];
  }

  /**
   * 检查跨领域支持
   */
  isCrossDomainEnabled(): boolean {
    return this.config.enableCrossDomain;
  }

  /**
   * 获取领域优先级
   */
  getDomainPriority(): string[] {
    return this.config.domainPriority;
  }

  /**
   * 获取配置
   */
  getConfig(): DomainConfig {
    return this.config;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<DomainConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}

/**
 * 创建领域管理器
 */
export function createDomainManager(config?: Partial<DomainConfig>): DomainManager {
  return new DomainManager(config);
}

/**
 * 全局领域管理器
 */
let globalDomainManager: DomainManager | null = null;

/**
 * 获取全局领域管理器
 */
export function getGlobalDomainManager(): DomainManager {
  if (!globalDomainManager) {
    globalDomainManager = createDomainManager();
  }
  return globalDomainManager;
}

/**
 * 设置全局领域管理器
 */
export function setGlobalDomainManager(manager: DomainManager): void {
  globalDomainManager = manager;
}
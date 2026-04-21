---
change: medical-agent-endocrinology
created: 2026-04-21
---

# Tasks

## Phase 1: 基础结构与类型 (P0)

- [x] 1.1 创建 `src/medical/` 目录结构
  - index.ts, types.ts, config.ts

- [x] 1.2 定义医学实体类型
  - DiseaseEntity, DrugEntity, IndicatorEntity
  - RelationEntity, ContraindicationRelation

- [x] 1.3 定义医学配置
  - MedicalAgentConfig
  - 默认配置项

## Phase 2: 词典数据 (P0)

- [x] 2.1 创建疾病词典 `dictionaries/diseases.ts`
  - 糖尿病（T1DM, T2DM, GDM, 糖尿病前期）
  - 高血压（原发性, 继发性）
  - 甲状腺疾病（甲亢, 甲减, 结节）
  - 肾脏疾病（糖尿病肾病, CKD）

- [x] 2.2 创建降糖药词典 `dictionaries/drugs/antidiabetic.ts`
  - 二甲双胍 ( aliases, thresholds )
  - GLP-1激动剂 (利拉鲁肽, 司美格鲁肽, 度拉糖肽)
  - SGLT2抑制剂 (恩格列净, 达格列净)
  - DPP4抑制剂 (西格列汀, 利格列汀)
  - 磺脲类 (格列美脲, 格列齐特)
  - 胰岛素 (速效, 长效, 预混)

- [x] 2.3 创建降压药词典 `dictionaries/drugs/antihypertensive.ts`
  - ACEI (卡托普利, 贝那普利)
  - ARB (缬沙坦, 氯沙坦, 厄贝沙坦)
  - CCB (氨氯地平, 硝苯地平)
  - β阻滞剂 (美托洛尔, 比索洛尔)
  - 利尿剂 (氢氯噻嗪, 吲达帕胺)

- [x] 2.4 创建甲状腺药词典 `dictionaries/drugs/thyroid.ts`
  - 左甲状腺素
  - 抗甲状腺药 (甲巯咪唑, 丙硫氧嘧啶)

- [x] 2.5 创建指标词典 `dictionaries/indicators.ts`
  - 血糖类 (空腹血糖, HbA1c, 餐后血糖)
  - 肾功能 (eGFR, 肌酐, 尿白蛋白)
  - 血压 (收缩压, 舒张压)
  - 血脂 (LDL-C, HDL-C, TG)
  - 甲状腺 (TSH, FT3, FT4)

- [x] 2.6 创建关系词典 `dictionaries/relations.ts`
  - 二甲双胍 × eGFR 禁忌/慎用
  - SGLT2抑制剂 × eGFR阈值
  - ACEI/ARB × 双侧肾动脉狭窄禁忌
  -磺脲类 × 肾功能慎用
  - GLP-1 × 心血管获益

- [x] 2.7 创建指南来源词典 `dictionaries/guidelines.ts`
  - ADA, CDS, ESC, KDIGO
  - 版本年份映射

- [x] 2.8 创建别名映射表 `dictionaries/aliases.ts`
  - 中文名 → 标准ID
  - 英文名 → 标准ID
  - 品牌名 → 标准ID

## Phase 3: 实体识别器 (P1)

- [x] 3.1 实现词典匹配 `entity-recognizer.ts`
  - matchDictionaries(text, dictionary)
  - 多词典并行匹配

- [x] 3.2 实现别名展开
  - expandAliases(entity)
  - 生成完整别名列表

- [x] 3.3 实现实体标准化
  - normalizeEntities(entities)
  - 统一到canonicalName

- [x] 3.4 实现实体提取器
  - extractMedicalEntities(query)
  - 返回MedicalEntities结构

## Phase 4: 查询规划器 (P2)

- [x] 4.1 实现策略构建器 `query-planner.ts`
  - buildQueryStrategy(entities)
  - 生成primaryQuery + subQueries

- [x] 4.2 实现术语扩展
  - expandTerms(entityAliases)
  - 合入现有QueryExpander

- [x] 4.3 实现过滤条件构建
  - buildFilters(entities, userConfig)
  - 年份范围、指南来源

- [x] 4.4 实现优先级排序
  - prioritizeSources(entities)
  - 权威指南优先

## Phase 5: MCP Tool (P2)

- [x] 5.1 定义 medical_query 工具 `mcp-tool.ts`
  - inputSchema定义
  - 验证器

- [x] 5.2 实现工具处理器
  - processMedicalQuery(input)
  - 完整流程编排

- [x] 5.3 集成到现有 MCP handlers
  - 注册工具
  - 处理调用

## Phase 6: 证据评估器 (P3)

- [x] 6.1 实现文献分类器 `evidence-evaluator.ts`
  - classifyLiteratureType(result)
  - RCT/Meta/指南/观察研究

- [x] 6.2 实现GRADE映射
  - mapEvidenceGrade(literatureType)
  - A/B/C/D等级

- [x] 6.3 实现时效性检查
  - checkTimeliness(year, guideline)
  - 过期警告

## Phase 7: 回答生成器 (P3)

- [x] 7.1 定义医学回答模板 `answer-generator.ts`
  - 结论/详细说明/证据等级/来源/注意事项

- [x] 7.2 实现来源格式化
  - formatSourceCitation(result)
  - 文献名+年份+章节

- [x] 7.3 实现不确定性标注
  - annotateUncertainty(confidence)
  - 置信度+证据等级

- [x] 7.4 实现医嘱提醒
  - addMedicalWarning()
  - 强制添加"仅供参考，请遵医嘱"

- [x] 7.5 实现完整回答生成
  - generateMedicalAnswer(context, entities)
  - 结构化输出

## Phase 8: 测试与验证 (P4)

- [x] 8.1 编写词典测试
  - 别名匹配正确性
  - 关系映射正确性

- [x] 8.2 编写实体识别测试
  - 单实体识别
  - 多实体识别
  - 别名识别

- [x] 8.3 编写查询规划测试
  - 策略生成正确性
  - 术语扩展覆盖

- [x] 8.4 编写MCP工具测试
  - 工具调用流程
  - 输出格式验证

- [x] 8.5 端到端测试
  - 实际医学查询场景
  - 回答质量评估
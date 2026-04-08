/**
 * @spec query-layer.md#意图解析
 * @layer 3
 * @description 查询解析器实现
 */

import type { ParsedQuery, QueryIntent } from './interface';

export class QueryParser {
  // 停用词
  private stopwords = ['的', '是', '在', '有', '和', '了', '如何', '怎么', '什么', '请', '帮我'];

  async parse(rawQuery: string): Promise<ParsedQuery> {
    // 1. 意图识别
    const intent = this.detectIntent(rawQuery);
    const intentConfidence = this.calculateIntentConfidence(rawQuery, intent);

    // 2. 关键词提取
    const keywords = this.extractKeywords(rawQuery);

    // 3. 语义结构
    const semantic = this.extractSemantic(rawQuery);

    // 4. 复杂度评估
    const complexity = this.assessComplexity(rawQuery);

    // 5. 模态检测
    const modality = this.detectModality(rawQuery);

    // 6. 语言检测
    const language = this.detectLanguage(rawQuery);

    return {
      raw: rawQuery,
      intent,
      intentConfidence,
      keywords,
      semantic,
      complexity,
      modality,
      language
    };
  }

  private detectIntent(query: string): QueryIntent {
    const lowerQuery = query.toLowerCase();

    // 意图规则表
    const intentPatterns: [RegExp, QueryIntent][] = [
      [/什么是|定义|解释|概念/, 'definition'],
      [/如何实现|怎么做|步骤|方法/, 'how-to'],
      [/示例|例子|代码示例|demo/, 'example'],
      [/比较|区别|对比|vs/, 'comparison'],
      [/为什么报错|出错|错误|bug|调试/, 'debug'],
      [/优化|提升|改进|更快/, 'optimization'],
      [/所有|全部|关于|相关信息/, 'exploration'],
      [/是否正确|验证|检查|确认/, 'fact-check'],
      [/然后|接着|之后|首先.*其次/, 'multi-hop']
    ];

    for (const [pattern, intent] of intentPatterns) {
      if (pattern.test(query)) {
        return intent;
      }
    }

    return 'general';
  }

  private calculateIntentConfidence(query: string, intent: QueryIntent): number {
    // 简单置信度计算
    const intentKeywords: Record<QueryIntent, string[]> = {
      'definition': ['什么', '定义', '概念'],
      'how-to': ['如何', '怎么', '方法'],
      'example': ['示例', '例子', '代码'],
      'comparison': ['比较', '区别', '对比'],
      'debug': ['报错', '错误', 'bug'],
      'optimization': ['优化', '提升', '改进'],
      'exploration': ['所有', '全部', '关于'],
      'fact-check': ['是否', '正确', '验证'],
      'multi-hop': ['然后', '接着', '首先'],
      'general': []
    };

    const keywords = intentKeywords[intent] || [];
    const matches = keywords.filter(k => query.includes(k)).length;
    return Math.min(0.9, 0.5 + matches * 0.15);
  }

  private extractKeywords(query: string): ParsedQuery['keywords'] {
    // 移除停用词
    const cleaned = this.removeStopwords(query);

    // 简单分词
    const tokens = cleaned.split(/\s+|(?<=[\u4e00-\u9fa5])|(?=[\u4e00-\u9fa5])/)
      .filter(t => t.length > 1);

    // 核心词（前5个）
    const core = tokens.slice(0, 5);

    // 相关词（其他）
    const related = tokens.slice(5, 10);

    // 排除词（否定词后的内容）
    const excluded: string[] = [];
    const negationMatch = query.match(/不包含|不包括|排除\s+(\S+)/);
    if (negationMatch) {
      excluded.push(negationMatch[1]);
    }

    return { core, related, excluded };
  }

  private removeStopwords(text: string): string {
    let result = text;
    for (const stopword of this.stopwords) {
      result = result.replace(new RegExp(stopword, 'g'), ' ');
    }
    return result.trim();
  }

  private extractSemantic(query: string): ParsedQuery['semantic'] {
    // 简单语义提取
    const subjectMatch = query.match(/(?:关于|针对|对于)\s*([\u4e00-\u9fa5a-zA-Z]+)/);
    const actionMatch = query.match(/(?:如何|怎么|怎样)\s*([\u4e00-\u9fa5a-zA-Z]+)/);
    const objectMatch = query.match(/(?:实现|获取|查找|搜索)\s*([\u4e00-\u9fa5a-zA-Z]+)/);

    return {
      subject: subjectMatch?.[1],
      action: actionMatch?.[1],
      object: objectMatch?.[1],
      conditions: []
    };
  }

  private assessComplexity(query: string): ParsedQuery['complexity'] {
    const signals = {
      multipleEntities: this.countEntities(query) > 2,
      multipleConditions: this.countConditions(query) > 1,
      needsInference: /然后|接着|因此|所以/.test(query),
      longQuery: query.length > 50
    };

    const score = Object.values(signals).filter(Boolean).length * 2;
    const level = score <= 2 ? 'simple' : score <= 6 ? 'medium' : 'complex';
    const reasons = Object.keys(signals).filter(k => signals[k as keyof typeof signals]);

    return { level, score, reasons };
  }

  private countEntities(query: string): number {
    // 简单实体计数（英文单词和中文词组）
    const englishWords = query.match(/[a-zA-Z]{3,}/g) || [];
    const chineseWords = query.match(/[\u4e00-\u9fa5]{2,}/g) || [];
    return englishWords.length + chineseWords.length;
  }

  private countConditions(query: string): number {
    const conditionPatterns = /如果|当|条件|要求|并且|或者/g;
    return (query.match(conditionPatterns) || []).length;
  }

  private detectModality(query: string): 'text' | 'code' | 'mixed' {
    if (/代码|function|class|import|def/.test(query)) {
      return /代码/.test(query) ? 'mixed' : 'code';
    }
    return 'text';
  }

  private detectLanguage(query: string): string {
    const chineseRatio = (query.match(/[\u4e00-\u9fa5]/g) || []).length / query.length;
    return chineseRatio > 0.3 ? 'zh' : 'en';
  }
}

export const queryParser = new QueryParser();
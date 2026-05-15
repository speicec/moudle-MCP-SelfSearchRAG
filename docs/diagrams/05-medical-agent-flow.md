# 医疗 Agent 执行流程 (Medical Agent Execution Flow)

```plantuml
@startuml
skinparam backgroundColor #f0f4f8
skinparam defaultFontSize 10
skinparam activityBackgroundColor #dbeafe
skinparam activityBorderColor #3b82f6

title Medical Agent — 双模式执行流程 (ReAct + PlanAndExecute)

start

:用户输入医学查询\n(query, domain);

:实体识别\n(EntityRecognizer)\n提取疾病/药物/指标实体;

if (实体置信度 < 低置信度阈值?) then (是)
  :**直接检索模式**\n(Direct Retrieval)\n用原始查询直接检索;
  :安全检查\n(SafetyLayer);
  :生成答案\n(MedicalReasoner);
  stop
else (否)

endif

:复杂度评估\n(ComplexityJudge)\n判断是否需要规划模式;

if (需要规划模式?\n且 enablePlanning=true?) then (是 → Planning 模式)

  partition "Planning 模式 (PlanAndExecute)" {

    :**查询策略构建**\n(QueryPlanner)\n优化检索查询词;

    :**任务规划**\n(TaskPlanner)\n生成 DAG 任务图;

    :**模板匹配**\n(TemplateMatcher)\n匹配预定义医学模板;

    :**DAG 验证**\n(DAGValidator)\n校验+自动修正;

    if (DAG 验证通过?) then (是)
    else (否 → 自动修正)
      :自动修正 DAG\n(autoCorrectDAG);
      if (修正后仍有错误?) then (是)
        #pink:抛出异常\n→ 回退到 ReAct 模式;
        detach
      else (否)
      endif
    endif

    :**执行 DAG**\n(TaskExecutor)\n并行执行任务;
    note right
      任务类型:
      • retrieve — 检索文档
      • evaluate — 评估证据
      • expand_query — 扩展查询
      • generate_answer — 生成答案
    end note

    partition "重规划循环 (Replanning)" {
      repeat
        :评估重规划需求\n(ReplanningEngine);
        if (需要重规划?) then (是)
          :添加补充任务到 DAG;
          :重新执行;
        else (否)
          break
        endif
      repeat while (未达到最大轮次?)
    }

    :**生成答案**\n从执行状态收集检索结果\n→ MedicalReasoner 生成;
  }

else (否 → ReAct 模式)

  partition "ReAct 模式 (Think→Act→Observe→Decide)" {

    :**初始化状态**\n创建 AgentState;

    :**查询策略构建**\n(QueryPlanner);

    :**提取阈值条件**\n(ThresholdExtractor);

    :**安全预检查**\n(SafetyLayer)\n检查药物禁忌/相互作用;

    if (绝对禁忌?) then (是)
      #pink:**提前终止**\n(Early Termination)\n直接生成安全警告回答;
      stop
    else (否)
    endif

    repeat
      :**Think: 分析状态**\n(MedicalReasoner.reasonClinical)\n→ AgentDecision {action, confidence, reason};

      if (decision.action == 'stop'\n或置信度 >= 阈值?) then (是 → 满足)
        break
      else (否)
      endif

      :**Act: 执行动作**\n(executeAction);

      if (action.type == 'retrieve') then (检索)
        :调用 retrieval(query, topK, threshold);
        :更新 evidenceEvaluation;
      elseif (action.type == 'expand_query') then (扩展查询)
        :使用扩展词重新检索;
      elseif (action.type == 'evaluate') then (评估)
        :评估检索结果质量;
      elseif (action.type == 'generate_answer') then (生成)
        :生成临时回答;
      elseif (action.type == 'extract_entities') then (提取实体)
        :重新提取实体;
      endif

      :**Observe: 记录观察**\n更新 reasoningTrace;

      :**Decide: 规则化判断**\n(decideByRules);

      if (规则命中?) then (是)
        note right
          规则优先级:
          1. retrieval_count >= 3
          2. maxSimilarity > 0.7
          3. entityCoverage >= 0.8
          4. 绝对禁忌
        end note
        :markSatisfied = true;
        break
      else (否)
      endif

    repeat while (未达到最大迭代?\nmaxIterations=5)

    :**Generate Answer**\n(MedicalReasoner.generateMedicalAnswer);

    if (enableQualityCheck?) then (是)
      :质量检查\n(AnswerQuality);
    else (否)
    endif
  }

endif

:**构建结果**\nAgentResult {answer, entities, stats, reasoningTrace};

if (tracing 启用?) then (是)
  :持久化 Trace\n(TraceStorage → SQLite);
else (否)
endif

:推送可视化数据\n(VisualizationCallback);

stop

@enduml
```

## 执行模式对比

| 特性 | ReAct 模式 | Planning 模式 |
|------|-----------|--------------|
| **适用场景** | 简单/中等复杂度查询 | 高复杂度、多实体对比分析 |
| **决策方式** | Think→Act→Observe→Decide 循环 | DAG 任务图 → 并行执行 |
| **最大迭代** | maxIterations (默认5) | maxReplanRounds (默认2) |
| **实体覆盖** | 规则化判断 (4条规则) | DAG 完成后直接生成 |
| **并行能力** | 串行执行 | DAG 并行组 |
| **失败回退** | N/A | 自动回退到 ReAct 模式 |

## 关键决策点

### 模式选择 (chooseExecutionMode)
```
enablePlanning == false → ReAct
复杂度评估 needsPlanning == false → ReAct
复杂度评估 needsPlanning == true → Planning
```

### 早期终止条件
1. **绝对禁忌**：安全预检查发现 absolute 级别禁忌 → 跳过循环直接生成警告
2. **低置信度**：实体识别置信度 < lowConfidenceThreshold (默认0.3) → 跳过循环直接检索
3. **迭代耗尽**：达到 maxIterations → 强制生成答案

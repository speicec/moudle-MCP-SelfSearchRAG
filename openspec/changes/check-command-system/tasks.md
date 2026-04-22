## 1. Skill Directory Setup

- [x] 1.1 Create `.claude/skills/check/` directory
- [x] 1.2 Create `context/review/` directory for report persistence

## 2. Main Skill File

- [x] 2.1 Create `skill.md` with command routing logic
  - Implement `/check` → precheck routing
  - Implement `/check:review` → review routing
  - Implement `/check:design` → design check routing
  - Implement `/check:security` → security check routing
  - Implement `/check:concurrency` → concurrency check routing
  - Implement `/check:complexity` → complexity check routing
  - Implement `/check:error` → error check routing
  - Implement `/check:auxiliary` → auxiliary check routing
  - Implement `/check:code-reviewer` → code reviewer routing
  - Implement `/check --all` → combined execution routing
  - Implement `/check:dim1,dim2,...` → custom combination routing

- [x] 2.2 Implement YAML frontmatter for skill.md
  - Define `name: check`
  - Define `description` with trigger conditions

## 3. Precheck Agent

- [x] 3.1 Create `precheck-agent.md` prompt template
  - Define Git status scanning instructions
  - Define OpenSpec status scanning instructions
  - Define file change quick scan instructions
  - Define next step suggestions format
  - Define report output format

- [x] 3.2 Implement precheck report template
  - Git status section
  - OpenSpec status section
  - File changes section
  - Suggestions section

## 4. Six-Dimensional Review Agent

- [x] 4.1 Create `review-agent.md` prompt template
  - Define completeness dimension (0.25) instructions
  - Define consistency dimension (0.20) instructions
  - Define traceability dimension (0.15) instructions
  - Define quality dimension (0.20) instructions with vague word blacklist
  - Define template compliance dimension (0.10) instructions
  - Define context reference dimension (0.10) instructions

- [x] 4.2 Define vague word blacklist in review-agent.md
  - 尽量、大概、可能、通常、一般、适当、合理
  - 尽可能、原则上、基本、相对、某种程度上
  - 理想情况下、视情况而定、根据实际情况

- [x] 4.3 Implement weighted score calculation instructions
  - Define score formula: Σ(dimension_score × weight)
  - Define conclusion thresholds (≥85/70-84/50-69/<50)

- [x] 4.4 Implement review report template
  - Score summary table format
  - Conclusion section format
  - Critical issues list format
  - Suggestions format

## 5. Design Check Agent

- [x] 5.1 Create `design-agent.md` prompt template
  - Define interface contract verification instructions
  - Define data structure verification instructions
  - Define component relationship verification instructions
  - Define state/flow verification instructions

- [x] 5.2 Implement design deviation report template
  - Deviation location format (file:line)
  - Design expectation format
  - Actual implementation format
  - Severity level format

## 6. Security Check Agent

- [x] 6.1 Create `security-agent.md` prompt template
  - Define input validation check instructions
  - Define SQL injection check instructions
  - Define XSS/injection check instructions
  - Define sensitive information leakage check instructions
  - Define permission validation check instructions
  - Define encryption/hashing check instructions

- [x] 6.2 Implement OWASP category references
  - Map security issues to OWASP Top 10 categories

- [x] 6.3 Implement security report template
  - Severity classification (Critical/High/Medium/Low)
  - OWASP category reference
  - Remediation priority format

## 7. Concurrency Check Agent

- [x] 7.1 Create `concurrency-agent.md` prompt template
  - Define race condition check instructions
  - Define deadlock risk check instructions
  - Define resource leak check instructions
  - Define channel usage check instructions
  - Define concurrency pattern validation instructions

- [x] 7.2 Implement concurrency report template
  - Risk level classification (High/Medium/Low)
  - Pattern description format
  - Fix suggestion format

## 8. Complexity Check Agent

- [x] 8.1 Create `complexity-agent.md` prompt template
  - Define cyclomatic complexity check instructions (threshold: 10)
  - Define cognitive complexity check instructions (threshold: 15)
  - Define function length check instructions (threshold: 50)
  - Define nesting depth check instructions (threshold: 4)
  - Define branch count check instructions (threshold: 10)
  - Define parameter count check instructions (threshold: 4)

- [x] 8.2 Implement complexity statistics aggregation instructions
  - Average complexity calculation
  - Distribution report format

- [x] 8.3 Implement complexity report template
  - Overall statistics section
  - Function-level details for exceeding functions
  - Refactoring suggestions format

## 9. Error Handling Check Agent

- [x] 9.1 Create `error-agent.md` prompt template
  - Define error ignore check instructions
  - Define error wrapping check instructions
  - Define panic/throw usage check instructions
  - Define recover/catch pairing check instructions
  - Define error propagation check instructions
  - Define error handling pattern check instructions

- [x] 9.2 Implement error report template
  - Risk classification (High/Medium/Low)
  - Pattern description format
  - Fix suggestion format

## 10. Auxiliary Check Agent

- [x] 10.1 Create `auxiliary-agent.md` prompt template
  - Define code standards check instructions
  - Define performance check instructions
  - Define maintainability check instructions
  - Define test coverage check instructions
  - Define documentation completeness check instructions

- [x] 10.2 Implement auxiliary report template
  - Standards violations section
  - Performance issues section
  - Maintainability issues section
  - Test coverage assessment section
  - Documentation gaps section

## 11. Code Reviewer Agent

- [x] 11.1 Create `code-reviewer-agent.md` prompt template
  - Define overall architecture review instructions
  - Define code quality synthesis instructions
  - Define contract consistency validation instructions
  - Define priority classification instructions (Critical/Important/Minor)
  - Define action recommendations instructions

- [x] 11.2 Implement code reviewer report template
  - Strengths section
  - Issues section with Critical/Important/Minor subsections
  - Assessment section with merge decision
  - Next step suggestions format

## 12. Report Persistence Implementation

- [x] 12.1 Implement report file naming logic
  - Format: `YYYY-MM-DD-HHmm-<command>-<target>.md`
  - Timestamp generation
  - Command name mapping
  - Target name extraction

- [x] 12.2 Implement report directory management
  - `context/review/` directory creation
  - Directory existence verification

- [x] 12.3 Implement combined execution report format
  - 7 dimension sections integration
  - Overall summary section
  - Cross-dimension patterns highlighting

## 13. Integration and Testing

- [ ] 13.1 Test `/check` precheck command
  - Verify Git status scanning
  - Verify OpenSpec status scanning
  - Verify report persistence

- [ ] 13.2 Test `/check:review` six-dimensional review
  - Verify all 6 dimensions execute
  - Verify weighted score calculation
  - Verify conclusion determination
  - Verify report persistence

- [ ] 13.3 Test `/check --all` combined execution
  - Verify all 7 code check dimensions execute
  - Verify combined report generation
  - Verify report persistence

- [ ] 13.4 Test `/check:dim1,dim2` custom combination
  - Verify specified dimensions execute
  - Verify combined report for selected dimensions
  - Verify report persistence

- [ ] 13.5 Test individual dimension commands
  - Test `/check:design`
  - Test `/check:security`
  - Test `/check:concurrency`
  - Test `/check:complexity`
  - Test `/check:error`
  - Test `/check:auxiliary`
  - Test `/check:code-reviewer`

## 14. Documentation

- [x] 14.1 Add skill usage documentation
  - Document command syntax
  - Document recommended execution order
  - Document report interpretation

- [x] 14.2 Add integration guide
  - Document workflow integration points
  - Document must-execute rules
  - Document optional check timing
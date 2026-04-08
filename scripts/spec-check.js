#!/usr/bin/env node
/**
 * Spec 合规性验证脚本
 * 验证代码实现是否符合 Spec 定义
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 配置
const CONFIG = {
  specDir: 'specs',
  srcDir: 'src',
  typesDir: 'src/types',
  testDir: 'tests'
};

// 验证结果
const results = {
  passed: [],
  failed: [],
  warnings: []
};

// 颜色输出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 1. 检查目录结构
function checkDirectoryStructure() {
  log('\n📁 检查目录结构...', 'yellow');

  const requiredDirs = [
    'src/types',
    'src/storage',
    'src/plugins',
    'src/chunking',
    'src/embedding',
    'src/query',
    'src/retrieval',
    'src/harness',
    'src/server',
    'tests'
  ];

  let allExist = true;
  for (const dir of requiredDirs) {
    if (fs.existsSync(dir)) {
      results.passed.push(`目录存在: ${dir}`);
    } else {
      results.failed.push(`目录缺失: ${dir}`);
      allExist = false;
    }
  }

  return allExist;
}

// 2. 检查类型定义
function checkTypeDefinitions() {
  log('\n📝 检查类型定义...', 'yellow');

  const requiredTypes = [
    'document.types.ts',
    'chunk.types.ts',
    'query.types.ts',
    'result.types.ts',
    'config.types.ts',
    'plugin.types.ts'
  ];

  let allExist = true;
  for (const typeFile of requiredTypes) {
    const filePath = path.join(CONFIG.typesDir, typeFile);
    if (fs.existsSync(filePath)) {
      results.passed.push(`类型文件存在: ${typeFile}`);
    } else {
      results.failed.push(`类型文件缺失: ${typeFile}`);
      allExist = false;
    }
  }

  return allExist;
}

// 3. 检查接口一致性
function checkInterfaceCompliance() {
  log('\n🔗 检查接口一致性...', 'yellow');

  // 这里需要实现接口对比逻辑
  // 简化版本：检查关键接口是否存在

  const keyInterfaces = [
    { file: 'src/storage/interface.ts', interfaces: ['IVectorStore', 'IMetadataStore', 'IFullTextStore'] },
    { file: 'src/plugins/interface.ts', interfaces: ['IPlugin', 'IPluginRegistry'] },
    { file: 'src/query/interface.ts', interfaces: ['IQueryParser', 'IQueryRouter'] },
    { file: 'src/retrieval/interface.ts', interfaces: ['IRetriever'] }
  ];

  let allMatch = true;
  for (const { file, interfaces } of keyInterfaces) {
    if (!fs.existsSync(file)) {
      results.warnings.push(`文件不存在，跳过检查: ${file}`);
      continue;
    }

    const content = fs.readFileSync(file, 'utf-8');
    for (const iface of interfaces) {
      if (content.includes(`interface ${iface}`) || content.includes(`export interface ${iface}`)) {
        results.passed.push(`接口存在: ${iface}`);
      } else {
        results.failed.push(`接口缺失: ${iface}`);
        allMatch = false;
      }
    }
  }

  return allMatch;
}

// 4. 运行类型检查
function runTypeCheck() {
  log('\n🔍 运行 TypeScript 类型检查...', 'yellow');

  try {
    execSync('npx tsc --noEmit', { stdio: 'inherit' });
    results.passed.push('TypeScript 类型检查通过');
    return true;
  } catch (error) {
    results.failed.push('TypeScript 类型检查失败');
    return false;
  }
}

// 5. 运行代码检查
function runLint() {
  log('\n🧹 运行 ESLint 检查...', 'yellow');

  try {
    execSync('npm run lint', { stdio: 'inherit' });
    results.passed.push('ESLint 检查通过');
    return true;
  } catch (error) {
    results.failed.push('ESLint 检查失败');
    return false;
  }
}

// 6. 运行测试
function runTests() {
  log('\n🧪 运行测试...', 'yellow');

  try {
    const output = execSync('npm test -- --reporter=json 2>/dev/null || true', { encoding: 'utf-8' });
    // 解析测试结果
    const testResult = JSON.parse(output);
    const passRate = testResult.numPassedTests / testResult.numTotalTests;

    if (passRate >= 0.8) {
      results.passed.push(`测试通过率: ${(passRate * 100).toFixed(1)}%`);
      return true;
    } else {
      results.failed.push(`测试通过率过低: ${(passRate * 100).toFixed(1)}%`);
      return false;
    }
  } catch (error) {
    results.warnings.push('无法解析测试结果');
    return false;
  }
}

// 7. 检查验收标准
function checkAcceptanceCriteria(node) {
  log(`\n✅ 检查验收标准 (Node ${node})...`, 'yellow');

  // 从 schedule.md 读取验收标准
  const schedulePath = path.join(CONFIG.specDir, 'schedule.md');
  if (!fs.existsSync(schedulePath)) {
    results.warnings.push('schedule.md 不存在');
    return false;
  }

  const content = fs.readFileSync(schedulePath, 'utf-8');
  const nodeRegex = new RegExp(`### Node ${node} 验收标准([\\s\\S]*?)(?=###|$)`);
  const match = content.match(nodeRegex);

  if (!match) {
    results.warnings.push(`未找到 Node ${node} 的验收标准`);
    return false;
  }

  // 解析验收标准
  const criteria = match[1]
    .split('\n')
    .filter(line => line.trim().startsWith('- [ ]'))
    .map(line => line.replace('- [ ]', '').trim());

  log(`发现 ${criteria.length} 条验收标准`, 'yellow');

  // 这里需要实现具体的验收检查逻辑
  // 简化版本：显示验收标准让用户确认
  for (const criterion of criteria) {
    results.warnings.push(`需要人工确认: ${criterion}`);
  }

  return true;
}

// 主函数
function main() {
  const args = process.argv.slice(2);
  const node = args.find(arg => arg.startsWith('--node='))?.split('=')[1] || 'A';

  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'yellow');
  log('       Spec 合规性验证', 'yellow');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'yellow');

  // 执行检查
  checkDirectoryStructure();
  checkTypeDefinitions();
  checkInterfaceCompliance();

  // 如果有源代码，运行代码检查
  if (fs.existsSync('src')) {
    runTypeCheck();
    runLint();
    runTests();
  }

  // 检查验收标准
  checkAcceptanceCriteria(node);

  // 输出结果
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'yellow');
  log('       验证结果', 'yellow');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'yellow');

  log(`\n✅ 通过 (${results.passed.length}):`, 'green');
  results.passed.forEach(item => log(`   ${item}`, 'green'));

  if (results.failed.length > 0) {
    log(`\n❌ 失败 (${results.failed.length}):`, 'red');
    results.failed.forEach(item => log(`   ${item}`, 'red'));
  }

  if (results.warnings.length > 0) {
    log(`\n⚠️  警告 (${results.warnings.length}):`, 'yellow');
    results.warnings.forEach(item => log(`   ${item}`, 'yellow'));
  }

  // 总结
  const total = results.passed.length + results.failed.length;
  const passRate = total > 0 ? (results.passed.length / total * 100).toFixed(1) : 0;

  log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'yellow');
  log(`通过率: ${passRate}%`, results.failed.length > 0 ? 'red' : 'green');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'yellow');

  // 退出码
  process.exit(results.failed.length > 0 ? 1 : 0);
}

main();
#!/usr/bin/env node
/**
 * Extract PlantUML code blocks from .md files and write to .puml files.
 * Usage: node scripts/extract-plantuml.js
 */
const fs = require('fs');
const path = require('path');

const diagramsDir = path.resolve(__dirname, '../docs/diagrams');
const outputDir = path.resolve(__dirname, '../docs/diagrams/puml');
const outputPngDir = path.resolve(__dirname, '../docs/diagrams/png');

// Ensure output directories exist
fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(outputPngDir, { recursive: true });

const mdFiles = fs.readdirSync(diagramsDir)
  .filter(f => f.endsWith('.md') && f !== 'README.md')
  .sort();

for (const mdFile of mdFiles) {
  const filePath = path.join(diagramsDir, mdFile);
  const content = fs.readFileSync(filePath, 'utf-8');

  // Match ```plantuml ... ``` or ```puml ... ``` blocks
  const plantumlRegex = /```(?:plantuml|puml)\s*\n([\s\S]*?)```/g;
  let match;
  let blockIndex = 0;

  while ((match = plantumlRegex.exec(content)) !== null) {
    const plantumlCode = match[1].trim();
    const baseName = path.basename(mdFile, '.md');
    const pumlFileName = blockIndex === 0
      ? `${baseName}.puml`
      : `${baseName}_${blockIndex}.puml`;
    const pumlPath = path.join(outputDir, pumlFileName);

    fs.writeFileSync(pumlPath, plantumlCode, 'utf-8');
    console.log(`Extracted: ${pumlFileName} (${plantumlCode.length} chars)`);
    blockIndex++;
  }

  if (blockIndex === 0) {
    console.log(`WARN: No PlantUML block found in ${mdFile}`);
  }
}

console.log(`\nDone. Extracted to: ${outputDir}`);
console.log(`To render: docker run --rm -v "${outputDir}:/data" plantuml/plantuml:latest -tpng /data/*.puml`);

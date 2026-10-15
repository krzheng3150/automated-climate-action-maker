import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const scriptsDir = path.dirname(__filename);
const projectRoot = path.resolve(scriptsDir, '..');

console.log('[Privacy Page] Compiling PRIVACY_POLICY.md to standalone HTML for GitHub Pages...');

const privacyMdPath = path.join(projectRoot, 'PRIVACY_POLICY.md');
if (!existsSync(privacyMdPath)) {
  console.error('[FAIL] PRIVACY_POLICY.md not found at:', privacyMdPath);
  process.exit(1);
}

const markdown = readFileSync(privacyMdPath, 'utf8');

function markdownToHtml(md) {
  const lines = md.split('\n');
  let html = '';
  let inList = false;
  let inOrderedList = false;
  let inTable = false;
  let tableHeaderProcessed = false;

  function closeBlocks() {
    if (inList) {
      html += '</ul>\n';
      inList = false;
    }
    if (inOrderedList) {
      html += '</ol>\n';
      inOrderedList = false;
    }
    if (inTable) {
      html += '</tbody></table></div>\n';
      inTable = false;
      tableHeaderProcessed = false;
    }
  }

  function inlineFormat(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Table row
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());

      // Check if delimiter row
      if (cells.every((c) => /^:?-+:?$/.test(c))) {
        continue;
      }

      if (!inTable) {
        closeBlocks();
        html += '<div class="table-wrapper"><table>\n';
        inTable = true;
        tableHeaderProcessed = false;
      }

      if (!tableHeaderProcessed) {
        html += '<thead><tr>' + cells.map((c) => `<th>${inlineFormat(c)}</th>`).join('') + '</tr></thead>\n<tbody>\n';
        tableHeaderProcessed = true;
      } else {
        html += '<tr>' + cells.map((c) => `<td>${inlineFormat(c)}</td>`).join('') + '</tr>\n';
      }
      continue;
    }

    if (inTable && !trimmed.startsWith('|')) {
      closeBlocks();
    }

    // Blank line
    if (!trimmed) {
      closeBlocks();
      continue;
    }

    // Horizontal rule
    if (/^---$|^___$/.test(trimmed)) {
      closeBlocks();
      html += '<hr />\n';
      continue;
    }

    // Headings
    if (trimmed.startsWith('### ')) {
      closeBlocks();
      html += `<h3>${inlineFormat(trimmed.slice(4))}</h3>\n`;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      closeBlocks();
      html += `<h2>${inlineFormat(trimmed.slice(3))}</h2>\n`;
      continue;
    }
    if (trimmed.startsWith('# ')) {
      closeBlocks();
      html += `<h1>${inlineFormat(trimmed.slice(2))}</h1>\n`;
      continue;
    }

    // Unordered lists
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (inOrderedList) closeBlocks();
      if (!inList) {
        html += '<ul>\n';
        inList = true;
      }
      html += `<li>${inlineFormat(trimmed.slice(2))}</li>\n`;
      continue;
    }

    // Ordered lists
    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      if (inList) closeBlocks();
      if (!inOrderedList) {
        html += '<ol>\n';
        inOrderedList = true;
      }
      html += `<li>${inlineFormat(olMatch[2])}</li>\n`;
      continue;
    }

    // Standard paragraph
    closeBlocks();
    html += `<p>${inlineFormat(trimmed)}</p>\n`;
  }

  closeBlocks();
  return html;
}

const bodyContent = markdownToHtml(markdown);

const htmlDocument = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="Privacy Policy for Automated Climate Action Maker (ACAM) - 100% On-Device, Zero-Telemetry Browser Extension" />
  <title>Privacy Policy | Automated Climate Action Maker (ACAM)</title>
  <style>
    :root {
      --bg: #f9fafb;
      --card-bg: #ffffff;
      --text: #111827;
      --text-muted: #4b5563;
      --primary: #059669;
      --primary-light: #ecfdf5;
      --border: #e5e7eb;
      --code-bg: #f3f4f6;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0f172a;
        --card-bg: #1e293b;
        --text: #f8fafc;
        --text-muted: #94a3b8;
        --primary: #10b981;
        --primary-light: #064e3b;
        --border: #334155;
        --code-bg: #0f172a;
      }
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.65;
      background-color: var(--bg);
      color: var(--text);
      padding: 2rem 1rem;
    }
    .container {
      max-width: 820px;
      margin: 0 auto;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 2.5rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .header-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--primary-light);
      color: var(--primary);
      font-size: 0.85rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 4px 12px;
      border-radius: 999px;
      margin-bottom: 1rem;
    }
    h1 {
      font-size: 2rem;
      font-weight: 800;
      line-height: 1.25;
      color: var(--text);
      margin-bottom: 0.75rem;
    }
    h2 {
      font-size: 1.35rem;
      font-weight: 700;
      margin-top: 2rem;
      margin-bottom: 0.75rem;
      border-bottom: 2px solid var(--primary-light);
      padding-bottom: 0.3rem;
      color: var(--text);
    }
    h3 {
      font-size: 1.1rem;
      font-weight: 600;
      margin-top: 1.25rem;
      margin-bottom: 0.5rem;
      color: var(--text);
    }
    p {
      margin-bottom: 1rem;
      color: var(--text-muted);
    }
    ul, ol {
      margin-left: 1.5rem;
      margin-bottom: 1.25rem;
      color: var(--text-muted);
    }
    li {
      margin-bottom: 0.4rem;
    }
    hr {
      border: none;
      border-top: 1px solid var(--border);
      margin: 2rem 0;
    }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.9em;
      background: var(--code-bg);
      padding: 2px 6px;
      border-radius: 4px;
      color: var(--primary);
    }
    a {
      color: var(--primary);
      text-decoration: underline;
    }
    .table-wrapper {
      overflow-x: auto;
      margin: 1.5rem 0;
      border: 1px solid var(--border);
      border-radius: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.95rem;
    }
    th {
      background: var(--code-bg);
      font-weight: 700;
      padding: 10px 14px;
      border-bottom: 1px solid var(--border);
    }
    td {
      padding: 10px 14px;
      border-bottom: 1px solid var(--border);
      color: var(--text-muted);
    }
    tr:last-child td {
      border-bottom: none;
    }
    .footer {
      margin-top: 2.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
      font-size: 0.85rem;
      color: var(--text-muted);
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header-badge">🛡️ Official Policy</div>
    ${bodyContent}
    <div class="footer">
      Automated Climate Action Maker (ACAM) • Verified 100% On-Device & Zero Telemetry
    </div>
  </div>
</body>
</html>
`;

// Emit to docs/index.html (standard for GitHub Pages serving from /docs)
const docsDir = path.join(projectRoot, 'docs');
if (!existsSync(docsDir)) {
  mkdirSync(docsDir, { recursive: true });
}
const docsIndexPath = path.join(docsDir, 'index.html');
writeFileSync(docsIndexPath, htmlDocument, 'utf8');
console.log(`[PASS] Compiled to GitHub Pages root: ${docsIndexPath}`);

// Also emit to dist/privacy.html if dist exists
const distDir = path.join(projectRoot, 'dist');
if (existsSync(distDir)) {
  const distPrivacyPath = path.join(distDir, 'privacy.html');
  writeFileSync(distPrivacyPath, htmlDocument, 'utf8');
  console.log(`[PASS] Compiled to dist bundle: ${distPrivacyPath}`);
}

console.log('[SUCCESS] Programmatic privacy policy compilation complete.');

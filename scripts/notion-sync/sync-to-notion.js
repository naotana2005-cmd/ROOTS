/**
 * ROOTS → Notion 同期スクリプト v3
 *
 * 機能:
 * 1. ROOTSダッシュボード（ランディングページ）を作成
 * 2. フォルダ構造をNotionにミラー（子ページ一覧付き）
 * 3. Markdownをリッチ変換（トグル・コールアウト・目次）
 * 4. 日報データベースで日次変更を記録
 * 5. config.jsonにIDを自動保存
 */

const { Client } = require("@notionhq/client");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const CONFIG_PATH = path.resolve(__dirname, "config.json");
let config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));

const notion = new Client({ auth: process.env.NOTION_API_TOKEN });
const ROOT_DIR = path.resolve(__dirname, "../..");

// --- ユーティリティ ---

function saveConfig() {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function runGit(cmd) {
  return execSync(cmd, { cwd: ROOT_DIR, encoding: "utf-8" }).trim();
}

function detectArea(filePath) {
  const areas = ["web", "docs", "marketing", "brand", "biz"];
  for (const area of areas) {
    if (filePath.startsWith(area + "/")) return area;
  }
  return "other";
}

function shouldInclude(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!config.includeExtensions.includes(ext)) return false;
  for (const pattern of config.exclude) {
    if (pattern.startsWith("**/")) {
      const name = pattern.slice(3);
      if (filePath.endsWith(name) || filePath.includes("/" + name)) return false;
    } else if (pattern.endsWith("/**")) {
      const dir = pattern.slice(0, -3);
      if (filePath.startsWith(dir + "/") || filePath === dir) return false;
    } else {
      if (filePath === pattern) return false;
    }
  }
  return true;
}

function truncateText(text, maxLen = 1900) {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "\n... (省略)";
}

// --- 対象ファイル一覧の取得 ---

function getTargetFiles() {
  const files = [];
  function walk(dir, relative) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const relPath = relative ? relative + "/" + entry.name : entry.name;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (["node_modules", ".git", ".claude", "scripts"].includes(entry.name)) continue;
        walk(fullPath, relPath);
      } else if (entry.isFile() && shouldInclude(relPath)) {
        files.push(relPath);
      }
    }
  }
  walk(ROOT_DIR, "");
  return files;
}

// --- Notionブロックビルダー ---

const B = {
  heading1(text, color = "default") {
    return { object: "block", type: "heading_1", heading_1: { rich_text: [{ type: "text", text: { content: text } }], color } };
  },
  heading2(text, color = "default") {
    return { object: "block", type: "heading_2", heading_2: { rich_text: [{ type: "text", text: { content: text } }], color } };
  },
  heading3(text, color = "default") {
    return { object: "block", type: "heading_3", heading_3: { rich_text: [{ type: "text", text: { content: text } }], color } };
  },
  paragraph(text, color = "default") {
    if (!text || !text.trim()) return null;
    return { object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: text } }], color } };
  },
  emptyParagraph() {
    return { object: "block", type: "paragraph", paragraph: { rich_text: [] } };
  },
  bullet(text) {
    return { object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: [{ type: "text", text: { content: text } }] } };
  },
  numbered(text) {
    return { object: "block", type: "numbered_list_item", numbered_list_item: { rich_text: [{ type: "text", text: { content: text } }] } };
  },
  callout(text, emoji = "💡", color = "gray_background") {
    return { object: "block", type: "callout", callout: { rich_text: [{ type: "text", text: { content: text } }], icon: { emoji }, color } };
  },
  toggle(text, children = [], color = "default") {
    return { object: "block", type: "toggle", toggle: { rich_text: [{ type: "text", text: { content: text } }], color, children } };
  },
  quote(text) {
    return { object: "block", type: "quote", quote: { rich_text: [{ type: "text", text: { content: text } }] } };
  },
  divider() {
    return { object: "block", type: "divider", divider: {} };
  },
  toc() {
    return { object: "block", type: "table_of_contents", table_of_contents: { color: "default" } };
  },
  code(text, lang = "plain text") {
    return { object: "block", type: "code", code: { rich_text: [{ type: "text", text: { content: truncateText(text) } }], language: lang } };
  },
  richParagraph(richText, color = "default") {
    return { object: "block", type: "paragraph", paragraph: { rich_text: richText, color } };
  },
  boldText(text) {
    return { type: "text", text: { content: text }, annotations: { bold: true } };
  },
  normalText(text) {
    return { type: "text", text: { content: text } };
  },
};

// --- Markdown → リッチNotionブロック変換 ---

function parseMarkdownLines(lines) {
  const blocks = [];
  let codeBlock = null;
  let tableRows = [];

  function flushTable() {
    if (tableRows.length > 0) {
      blocks.push(B.code(tableRows.join("\n")));
      tableRows = [];
    }
  }

  for (const line of lines) {
    // コードブロック
    if (line.startsWith("```")) {
      flushTable();
      if (codeBlock) {
        blocks.push(B.code(codeBlock.content, codeBlock.lang));
        codeBlock = null;
      } else {
        codeBlock = { lang: line.slice(3).trim() || "plain text", content: "" };
      }
      continue;
    }
    if (codeBlock) {
      codeBlock.content += (codeBlock.content ? "\n" : "") + line;
      continue;
    }

    // テーブル
    if (line.match(/^\|.*\|$/)) {
      tableRows.push(line);
      continue;
    } else if (tableRows.length > 0) {
      flushTable();
    }

    // 見出し（h3以下のみ。h1, h2はトグルセクションで処理済み）
    if (line.startsWith("#### ")) {
      blocks.push(B.heading3(line.slice(5)));
    } else if (line.startsWith("##### ")) {
      blocks.push(B.heading3("▸ " + line.slice(6)));
    }
    // 箇条書き
    else if (line.match(/^[-*] \*\*/)) {
      // **太字**で始まる箇条書き → そのまま
      blocks.push(B.bullet(line.replace(/^[-*] /, "")));
    }
    else if (line.match(/^[-*] /)) {
      blocks.push(B.bullet(line.replace(/^[-*] /, "")));
    }
    // 番号付きリスト
    else if (line.match(/^\d+\. /)) {
      blocks.push(B.numbered(line.replace(/^\d+\. /, "")));
    }
    // 区切り線
    else if (line.match(/^---+$/)) {
      blocks.push(B.divider());
    }
    // **太字で始まる行** → コールアウト化
    else if (line.match(/^\*\*[^*]+\*\*[:：]/)) {
      const text = line.replace(/\*\*/g, "");
      blocks.push(B.callout(text, "📌", "blue_background"));
    }
    else if (line.match(/^\*\*核心\*\*/i) || line.match(/^\*\*結論\*\*/i) || line.match(/^\*\*推奨\*\*/i)) {
      const text = line.replace(/\*\*/g, "");
      blocks.push(B.callout(text, "⭐", "yellow_background"));
    }
    // 通常テキスト
    else if (line.trim()) {
      blocks.push(B.paragraph(line));
    }
  }

  flushTable();
  return blocks;
}

function markdownToBlocks(content, filePath) {
  const lines = content.split("\n");
  const allBlocks = [];
  const isLong = lines.length > 80;

  // ファイル情報コールアウト
  const lineCount = lines.length;
  allBlocks.push(B.callout(`📂 ${filePath}　|　${lineCount}行`, "📝", "gray_background"));

  // 長いファイルには目次
  if (isLong) {
    allBlocks.push(B.toc());
    allBlocks.push(B.divider());
  }

  // セクション分割（## 見出しでトグルにまとめる）
  const sections = [];
  let currentSection = null;

  for (const line of lines) {
    if (line.startsWith("# ") && !line.startsWith("## ")) {
      // h1 → タイトルとして表示（トグルにしない）
      if (currentSection) sections.push(currentSection);
      currentSection = null;
      sections.push({ type: "h1", text: line.slice(2), lines: [] });
    } else if (line.startsWith("## ")) {
      if (currentSection) sections.push(currentSection);
      currentSection = { type: "h2", text: line.slice(3), lines: [] };
    } else if (line.startsWith("### ") && currentSection) {
      currentSection.lines.push(line);
    } else {
      if (currentSection) {
        currentSection.lines.push(line);
      } else {
        // セクション外のコンテンツ
        if (!sections.length || sections[sections.length - 1].type !== "loose") {
          sections.push({ type: "loose", text: "", lines: [] });
        }
        sections[sections.length - 1].lines.push(line);
      }
    }
  }
  if (currentSection) sections.push(currentSection);

  // ブロック生成
  for (const section of sections) {
    if (section.type === "h1") {
      allBlocks.push(B.heading1(section.text));
      if (section.lines.length > 0) {
        allBlocks.push(...parseMarkdownLines(section.lines));
      }
    } else if (section.type === "h2") {
      // ## セクションをトグルにまとめる（中身がある場合のみ）
      const contentLines = section.lines.filter((l) => l.trim());
      if (contentLines.length > 0 && isLong) {
        const children = parseMarkdownLines(section.lines).filter(Boolean).slice(0, 98);
        if (children.length > 0) {
          allBlocks.push(B.toggle("📖 " + section.text, children));
        } else {
          allBlocks.push(B.heading2(section.text));
        }
      } else {
        allBlocks.push(B.heading2(section.text));
        allBlocks.push(...parseMarkdownLines(section.lines).filter(Boolean));
      }
    } else if (section.type === "loose") {
      allBlocks.push(...parseMarkdownLines(section.lines).filter(Boolean));
    }
  }

  return allBlocks;
}

// HTML・JSONの変換（既存と同様だがスタイル改善）
function htmlToBlocks(content, filePath) {
  const headings = [];
  const headingRegex = /<h[1-3][^>]*>(.*?)<\/h[1-3]>/gi;
  let match;
  while ((match = headingRegex.exec(content)) !== null) {
    headings.push(match[1].replace(/<[^>]*>/g, "").trim());
  }
  const lineCount = content.split("\n").length;

  const blocks = [
    B.callout(`${filePath}　|　HTML ${lineCount}行`, "🌐", "blue_background"),
    B.heading2("ページ構成"),
  ];

  for (const h of headings.slice(0, 30)) {
    blocks.push(B.bullet(h));
  }

  blocks.push(B.divider());
  blocks.push(B.paragraph(`総行数: ${lineCount}行`));
  return blocks;
}

function jsonToBlocks(content, filePath) {
  let parsed;
  try { parsed = JSON.parse(content); } catch { return [B.callout("JSONパースエラー", "❌")]; }
  const formatted = JSON.stringify(parsed, null, 2);
  return [
    B.callout(`${filePath}　|　JSON`, "⚙️", "gray_background"),
    B.code(truncateText(formatted), "json"),
  ];
}

function fileToBlocks(filePath) {
  const fullPath = path.resolve(ROOT_DIR, filePath);
  if (!fs.existsSync(fullPath)) return null;
  const content = fs.readFileSync(fullPath, "utf-8");
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return htmlToBlocks(content, filePath);
  if (ext === ".json") return jsonToBlocks(content, filePath);
  return markdownToBlocks(content, filePath);
}

// --- ダッシュボードページ作成 ---

function buildDashboardBlocks() {
  const areaDescriptions = {
    docs: { emoji: "📚", name: "docs", desc: "事業計画書、投票設計、ステータス設計" },
    brand: { emoji: "🎨", name: "brand", desc: "トーンガイド、ロゴ仕様、デザイン素材" },
    biz: { emoji: "💼", name: "biz", desc: "OEM候補、パッケージ戦略、EC戦略、法的メモ" },
    marketing: { emoji: "📣", name: "marketing", desc: "Instagram戦略、投稿カレンダー、テンプレート" },
    web: { emoji: "🌐", name: "web", desc: "HPサイト、投票ページ、カードジェネレーター" },
  };

  const blocks = [];

  // ヒーローセクション
  blocks.push(B.callout(
    "ROOTS — 親愛なる故郷へ\n\n都道府県民が副原料を投票で選び、OEM醸造されたビールをECで販売する参加型クラフトビール事業",
    "🍺",
    "blue_background"
  ));

  blocks.push(B.emptyParagraph());

  // フェーズ表示
  blocks.push(B.callout(
    "現在のフェーズ: Phase 1（MVP期）\n目標: 最初の1県で「このモデルが成立する」ことを数字で証明する",
    "🚀",
    "yellow_background"
  ));

  blocks.push(B.emptyParagraph());
  blocks.push(B.divider());
  blocks.push(B.emptyParagraph());

  // エリア一覧
  blocks.push(B.heading1("📂 プロジェクト構成"));
  blocks.push(B.emptyParagraph());

  for (const [area, info] of Object.entries(areaDescriptions)) {
    const fileCount = Object.keys(config.filePages).filter((f) => f.startsWith(area + "/")).length;
    blocks.push(B.callout(
      `${info.name}/\n${info.desc}\n📄 ${fileCount}ファイル`,
      info.emoji,
      "default"
    ));
  }

  blocks.push(B.emptyParagraph());
  blocks.push(B.divider());
  blocks.push(B.emptyParagraph());

  // ビジョン・ゴール
  blocks.push(B.heading1("🎯 ビジョンとゴール"));
  blocks.push(B.emptyParagraph());

  blocks.push(B.quote("ルーツが誇りになるように。"));
  blocks.push(B.emptyParagraph());

  blocks.push(B.toggle("📊 Phase 1 KPI（完売目標: 500本 / 100セット / 100人）", [
    B.bullet("Instagram フォロワー: 1,000人"),
    B.bullet("カード生成数: 2,000枚"),
    B.bullet("投票者数: 500人"),
    B.bullet("購入者数: 100人 ★最重要"),
    B.bullet("投票→購入転換率: 20%"),
    B.bullet("売上: ¥498,000"),
  ]));

  blocks.push(B.emptyParagraph());

  blocks.push(B.toggle("🗺️ Phase全体マップ", [
    B.callout("Phase 1: 証明する（1県で黒字化）← 今ここ", "1️⃣", "blue_background"),
    B.callout("Phase 2: 仕組みを回す（シリーズ制 × 投票 × 複数チャネル）", "2️⃣", "default"),
    B.callout("Phase 3: ビールを超える（プラットフォーム化 × コミュニティ）", "3️⃣", "default"),
    B.callout("Phase 4: 日本一になる（全国制覇 × 海外 × IPO/M&A）", "4️⃣", "default"),
  ]));

  blocks.push(B.emptyParagraph());
  blocks.push(B.divider());
  blocks.push(B.emptyParagraph());

  // 技術スタック
  blocks.push(B.heading1("🛠️ 技術スタック"));
  blocks.push(B.emptyParagraph());
  blocks.push(B.toggle("開発ツール一覧", [
    B.bullet("Claude Code — 開発・事業推進の中心"),
    B.bullet("Supabase — 投票データ管理"),
    B.bullet("D3.js — 日本地図インタラクション"),
    B.bullet("Claude API — 投票後のAI返答機能"),
    B.bullet("Notion — タスク管理、進捗、KPIダッシュボード"),
  ]));

  blocks.push(B.emptyParagraph());
  blocks.push(B.divider());
  blocks.push(B.emptyParagraph());

  // デザインルール
  blocks.push(B.heading1("🎨 デザインルール"));
  blocks.push(B.emptyParagraph());

  blocks.push(B.toggle("カラーパレット", [
    B.callout("背景（黒） #090909 — 全媒体共通。白背景は禁止", "⬛", "default"),
    B.callout("ブルー #50A0F0 — メインアクセント、見出し、リンク", "🔵", "blue_background"),
    B.callout("オレンジ #F0A032 — CTA、ボタン、強調テキスト", "🟠", "orange_background"),
    B.paragraph("テキスト（明）: #e0e0e0　|　テキスト（暗）: #333333"),
  ]));

  blocks.push(B.toggle("フォント", [
    B.bullet("英語見出し・ロゴ: Bebas Neue"),
    B.bullet("日本語本文・和の品格: Shippori Mincho"),
    B.bullet("コード・数値: Space Mono"),
  ]));

  blocks.push(B.emptyParagraph());

  // フッター
  blocks.push(B.divider());
  blocks.push(B.richParagraph([
    B.normalText("最終同期: "),
    B.boldText(new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })),
  ], "gray"));

  return blocks;
}

// --- フォルダページのコンテンツ作成 ---

function buildFolderPageBlocks(folderPath) {
  const areaInfo = {
    docs: { emoji: "📚", desc: "全社確定ドキュメント（事業計画書、投票設計、ステータス設計）" },
    brand: { emoji: "🎨", desc: "ブランド（トーンガイド、ロゴ仕様、デザイン素材）" },
    biz: { emoji: "💼", desc: "ビジネス（免許・OEM・EC）" },
    marketing: { emoji: "📣", desc: "マーケティング（SNS・ローンチ）" },
    web: { emoji: "🌐", desc: "Web開発（HP・投票システム）" },
  };

  const info = areaInfo[folderPath] || { emoji: "📁", desc: folderPath };
  const blocks = [];

  // ヘッダー
  blocks.push(B.callout(info.desc, info.emoji, "blue_background"));
  blocks.push(B.emptyParagraph());

  // 子ファイル一覧
  const childFiles = Object.keys(config.filePages).filter((f) => {
    const dir = f.split("/").slice(0, -1).join("/");
    return dir === folderPath || f.startsWith(folderPath + "/");
  });

  if (childFiles.length > 0) {
    blocks.push(B.heading2("📄 ファイル一覧"));
    for (const f of childFiles.sort()) {
      const name = f.split("/").pop();
      const ext = path.extname(name);
      const icon = ext === ".md" ? "📝" : ext === ".html" ? "🌐" : "⚙️";
      blocks.push(B.bullet(`${icon} ${name}`));
    }
  }

  // 子フォルダ一覧
  const childFolders = Object.keys(config.folderPages).filter((f) => {
    const parent = f.split("/").slice(0, -1).join("/");
    return parent === folderPath;
  });

  if (childFolders.length > 0) {
    blocks.push(B.emptyParagraph());
    blocks.push(B.heading2("📁 サブフォルダ"));
    for (const f of childFolders.sort()) {
      const name = f.split("/").pop();
      blocks.push(B.bullet(`📁 ${name}/`));
    }
  }

  return blocks;
}

// --- Notionページ操作 ---

async function createPage(parentId, title, emoji) {
  const page = await notion.pages.create({
    parent: { page_id: parentId },
    icon: emoji ? { emoji } : undefined,
    properties: { title: { title: [{ text: { content: title } }] } },
  });
  await sleep(350);
  return page.id;
}

async function clearPageContent(pageId, preserveChildren = false) {
  try {
    const { results } = await notion.blocks.children.list({ block_id: pageId });
    for (const block of results) {
      // 子ページとDBはダッシュボード更新時に消さない
      if (preserveChildren && (block.type === "child_page" || block.type === "child_database")) {
        continue;
      }
      await notion.blocks.delete({ block_id: block.id });
      await sleep(200);
    }
  } catch (e) {
    console.warn(`  ⚠️ クリア失敗: ${e.message}`);
  }
}

async function updatePageContent(pageId, blocks, preserveChildren = false) {
  await clearPageContent(pageId, preserveChildren);
  const validBlocks = blocks.filter(Boolean);
  for (let i = 0; i < validBlocks.length; i += 100) {
    const chunk = validBlocks.slice(i, i + 100);
    await notion.blocks.children.append({ block_id: pageId, children: chunk });
    if (i + 100 < validBlocks.length) await sleep(350);
  }
}

// --- 日報DB ---

async function createDailyReportDb(parentId) {
  const db = await notion.databases.create({
    parent: { page_id: parentId },
    title: [{ text: { content: "📋 日報" } }],
    icon: { emoji: "📋" },
    properties: {
      "日付": { title: {} },
      "サマリー": { rich_text: {} },
      "エリア": {
        multi_select: {
          options: [
            { name: "docs", color: "blue" },
            { name: "brand", color: "purple" },
            { name: "biz", color: "green" },
            { name: "marketing", color: "orange" },
            { name: "web", color: "red" },
            { name: "other", color: "gray" },
          ],
        },
      },
      "ファイル数": { number: {} },
      "コミット数": { number: {} },
    },
  });
  await sleep(350);
  return db.id;
}

async function createOrUpdateDailyReport(commits, changedFiles) {
  if (!config.dailyReportDbId) return;
  const today = new Date().toISOString().split("T")[0];
  const areas = new Set();
  for (const f of changedFiles) areas.add(detectArea(f));
  const summary = commits.map((c) => c.message).join(" / ");
  const truncSummary = summary.length > 1900 ? summary.slice(0, 1900) + "..." : summary;

  let existingEntry = null;
  try {
    const response = await notion.databases.query({
      database_id: config.dailyReportDbId,
      filter: { property: "日付", title: { equals: today } },
    });
    if (response.results.length > 0) existingEntry = response.results[0];
  } catch {}

  const properties = {
    "日付": { title: [{ text: { content: today } }] },
    "サマリー": { rich_text: [{ text: { content: truncSummary } }] },
    "エリア": { multi_select: [...areas].map((a) => ({ name: a })) },
    "ファイル数": { number: changedFiles.length },
    "コミット数": { number: commits.length },
  };

  let pageId;
  if (existingEntry) {
    await notion.pages.update({ page_id: existingEntry.id, properties });
    pageId = existingEntry.id;
  } else {
    const page = await notion.pages.create({ parent: { database_id: config.dailyReportDbId }, properties });
    pageId = page.id;
  }

  // 本文をリッチに
  const bodyBlocks = [
    B.callout(`${today} の更新　|　${commits.length}コミット　|　${changedFiles.length}ファイル`, "📋", "blue_background"),
    B.emptyParagraph(),
    B.heading2("コミット一覧"),
  ];
  for (const commit of commits) {
    bodyBlocks.push(B.bullet(`${commit.hash.slice(0, 7)} — ${commit.message}`));
  }
  if (changedFiles.length > 0) {
    bodyBlocks.push(B.emptyParagraph());
    bodyBlocks.push(B.heading2("変更ファイル"));
    for (const f of changedFiles.slice(0, 50)) {
      const icon = f.endsWith(".md") ? "📝" : f.endsWith(".html") ? "🌐" : "⚙️";
      bodyBlocks.push(B.bullet(`${icon} ${f}`));
    }
  }

  try {
    await clearPageContent(pageId);
    await notion.blocks.children.append({ block_id: pageId, children: bodyBlocks.filter(Boolean).slice(0, 100) });
  } catch (e) {
    console.warn(`  ⚠️ 日報本文更新失敗: ${e.message}`);
  }
  await sleep(350);
  console.log(`📋 日報${existingEntry ? "更新" : "作成"}: ${today}`);
}

// --- フォルダ構造作成 ---

async function ensureFolderStructure(files) {
  const folders = new Set();
  for (const filePath of files) {
    const parts = filePath.split("/");
    for (let i = 1; i < parts.length; i++) {
      folders.add(parts.slice(0, i).join("/"));
    }
  }
  const sortedFolders = [...folders].sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b));
  const folderEmojis = { docs: "📚", brand: "🎨", biz: "💼", marketing: "📣", web: "🌐" };

  for (const folder of sortedFolders) {
    if (config.folderPages[folder]) continue;
    const parts = folder.split("/");
    const name = parts[parts.length - 1];
    const parentFolder = parts.slice(0, -1).join("/");
    const parentId = parentFolder ? config.folderPages[parentFolder] : config.rootPageId;
    if (!parentId) continue;

    console.log(`  📁 ${folder}`);
    const pageId = await createPage(parentId, name, folderEmojis[name] || "📁");
    config.folderPages[folder] = pageId;
    saveConfig();
  }
}

async function ensureFilePages(files) {
  for (const filePath of files) {
    if (config.filePages[filePath]) continue;
    const parts = filePath.split("/");
    const fileName = parts[parts.length - 1].replace(/\.[^.]+$/, "");
    const folder = parts.slice(0, -1).join("/");
    const parentId = folder ? config.folderPages[folder] : config.rootPageId;
    if (!parentId) continue;

    console.log(`  📄 ${filePath}`);
    const pageId = await createPage(parentId, fileName, "📝");
    config.filePages[filePath] = pageId;
    saveConfig();
  }
}

// --- メイン ---

async function main() {
  console.log("🔄 ROOTS → Notion 同期を開始...\n");

  if (!process.env.NOTION_API_TOKEN) { console.error("❌ NOTION_API_TOKEN 未設定"); process.exit(1); }
  if (!config.rootPageId) { console.error("❌ rootPageId 未設定"); process.exit(1); }

  const targetFiles = getTargetFiles();
  console.log(`📂 同期対象: ${targetFiles.length}ファイル`);

  const isFirstRun = !config.dailyReportDbId;
  const forceFullSync = process.argv.includes("--full");
  const dashboardOnly = process.argv.includes("--dashboard");

  // 日報DB
  if (isFirstRun) {
    console.log("\n🏗️ 初回セットアップ...");
    config.dailyReportDbId = await createDailyReportDb(config.rootPageId);
    saveConfig();
    console.log("  ✅ 日報DB作成完了");
  }

  // フォルダ・ファイルページ
  console.log("\n📁 構造確認...");
  await ensureFolderStructure(targetFiles);
  await ensureFilePages(targetFiles);

  // ダッシュボード更新（子ページ・DBを保持したままコンテンツだけ更新）
  console.log("\n🎨 ダッシュボード更新...");
  const dashboardBlocks = buildDashboardBlocks();
  await updatePageContent(config.rootPageId, dashboardBlocks, true);
  console.log("  ✅ ダッシュボード完了");

  if (dashboardOnly) {
    console.log("\n✅ ダッシュボード更新完了");
    return;
  }

  // フォルダページ更新（トップレベルのみ）
  console.log("\n📁 フォルダページ更新...");
  for (const folder of ["docs", "brand", "biz", "marketing", "web"]) {
    const pageId = config.folderPages[folder];
    if (!pageId) continue;
    const blocks = buildFolderPageBlocks(folder);
    try {
      await updatePageContent(pageId, blocks, true);
      console.log(`  ✅ ${folder}/`);
    } catch (e) {
      console.warn(`  ⚠️ ${folder}/: ${e.message}`);
    }
  }

  // ファイル同期
  if (isFirstRun || forceFullSync) {
    console.log("\n📝 全ファイル同期...");
    let synced = 0;
    for (const filePath of targetFiles) {
      const pageId = config.filePages[filePath];
      if (!pageId) continue;
      const blocks = fileToBlocks(filePath);
      if (!blocks || blocks.length === 0) continue;
      try {
        await updatePageContent(pageId, blocks);
        synced++;
        console.log(`  ✅ ${filePath}`);
      } catch (e) {
        console.error(`  ⚠️ ${filePath}: ${e.message}`);
      }
    }
    console.log(`\n✅ 同期完了: ${synced}/${targetFiles.length}ファイル`);
  } else {
    console.log("\n🔍 直近24時間の変更を検出...");
    let commits = [];
    try {
      const log = runGit('git log --since="24 hours ago" --format="%H|%s|%ai" --no-merges');
      if (!log) { console.log("  ✅ 変更なし"); return; }
      commits = log.split("\n").map((line) => {
        const [hash, message, date] = line.split("|");
        return { hash, message, date: date ? date.split(" ")[0] : "" };
      });
    } catch { console.log("  ✅ 変更なし"); return; }

    console.log(`  📋 ${commits.length}コミット検出`);
    const changedFiles = new Set();
    for (const commit of commits) {
      try {
        const diff = runGit(`git diff-tree --no-commit-id --name-only -r ${commit.hash}`);
        if (!diff) continue;
        for (const f of diff.split("\n")) { if (shouldInclude(f)) changedFiles.add(f); }
      } catch { continue; }
    }

    const changedArray = [...changedFiles];
    await ensureFolderStructure(changedArray);
    await ensureFilePages(changedArray);

    let updated = 0;
    for (const filePath of changedArray) {
      const pageId = config.filePages[filePath];
      if (!pageId) continue;
      const blocks = fileToBlocks(filePath);
      if (!blocks || blocks.length === 0) continue;
      try {
        await updatePageContent(pageId, blocks);
        updated++;
        console.log(`  ✅ ${filePath}`);
      } catch (e) { console.error(`  ⚠️ ${filePath}: ${e.message}`); }
    }

    await createOrUpdateDailyReport(commits, changedArray);
    console.log(`\n✅ 同期完了: ${commits.length}コミット, ${updated}ページ更新`);
  }
}

main().catch((e) => { console.error("❌ 同期エラー:", e); process.exit(1); });

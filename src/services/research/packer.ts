/**
 * ResearchPacker — creates the "perfect context" directory for Codex (or any AI).
 *
 * Structure (the secret sauce):
 *   <researchDir>/<date>-<slug>/
 *     MISSION.md          — user goal + strict output instructions for the analyst
 *     METADATA.json
 *     SOURCES/
 *       my-group-1.md
 *       another-group.md
 *     RUN_CODEX.sh (helper)
 *
 * Always produces clickable t.me deep links.
 */

import { join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { format } from 'date-fns';
import { getConfig } from '../config.js';

export interface PackOptions {
  query: string;
  groups: string[];
  since?: string;
  simulatedHits?: Array<{ group: string; text: string; msgId: number; date: string }>;
}

export interface CreatedPack {
  path: string;
  missionPath: string;
  runScript: string;
}

export function createResearchPack(opts: PackOptions): CreatedPack {
  const config = getConfig();
  const date = format(new Date(), 'yyyy-MM-dd');
  const slug = opts.query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40)
    .replace(/-$/, '');

  const packName = `${date}-${slug || 'research'}-${Math.random().toString(36).slice(2, 7)}`;
  const packPath = join(config.getResearchDir(), packName);

  mkdirSync(packPath, { recursive: true, mode: 0o700 });
  mkdirSync(join(packPath, 'SOURCES'), { recursive: true, mode: 0o700 });

  const mission = `# MISSION — tg-codex Research Pack

**Date**: ${new Date().toISOString()}
**Query / Goal**: ${opts.query}
**Groups**: ${opts.groups.join(', ')}
**Since**: ${opts.since || 'recent'}

## Instructions for Codex (or any AI analyst)

Bạn là một senior analyst cực kỳ tỉ mỉ, khách quan, có kinh nghiệm phân tích group chat Telegram (deal, tech, career, cộng đồng).

Nhiệm vụ:
1. Đọc toàn bộ file trong SOURCES/ .
2. Tìm tất cả thông tin liên quan đến goal của user.
3. Trích dẫn nguyên văn các đoạn quan trọng + **giữ nguyên link t.me** để user click về nguồn.
4. Cấu trúc output rõ ràng:

## Tóm tắt ngắn (2-3 câu)

## Key Findings (bullet, ưu tiên actionable + rủi ro)

## Trích dẫn quan trọng (với link)

## Người / Deadline / Số tiền / Cam kết nổi bật

## Câu hỏi còn bỏ ngỏ / Rủi ro cần kiểm tra thêm

## Gợi ý hành động tiếp theo (nếu có)

Luôn trả lời bằng tiếng Việt trừ khi user yêu cầu khác. Giữ trung thực — nếu không có info thì nói rõ "không tìm thấy trong dữ liệu cung cấp".

Bắt đầu.
`;

  writeFileSync(join(packPath, 'MISSION.md'), mission, { mode: 0o600 });

  // Simulated or real sources
  const hits = opts.simulatedHits || [
    {
      group: opts.groups[0] || 'example-group',
      text: `[MOCK] User A: deal với công ty X đang tiến triển tốt, deadline 15/7, cần confirm budget trước thứ 6. Link gốc: (sẽ có thật sau khi fetch)`,
      msgId: 123456,
      date: new Date().toISOString(),
    },
  ];

  for (const h of hits) {
    const safeName = h.group.replace(/[^a-z0-9-]/gi, '_');
    const content = `## ${h.group} — ${h.date}

**Message ID**: ${h.msgId}
**Link**: https://t.me/c/XXXX/${h.msgId}   (thay XXXX bằng chat id thật)

${h.text}

---
`;
    writeFileSync(join(packPath, 'SOURCES', `${safeName}.md`), content, { mode: 0o600 });
  }

  const meta = {
    createdAt: new Date().toISOString(),
    query: opts.query,
    groups: opts.groups,
    since: opts.since,
    hitCount: hits.length,
    tool: 'tg-codex',
  };
  writeFileSync(join(packPath, 'METADATA.json'), JSON.stringify(meta, null, 2), { mode: 0o600 });

  const runScript = `#!/bin/bash
# Helper to run Codex on this pack
set -e
echo "=== tg-codex research pack ==="
echo "cd to this dir and run your AI:"
echo ""
echo "  codex"
echo ""
echo "Or non-interactive attempt:"
echo "  codex \"Read MISSION.md and all files under SOURCES/. Produce the report following the exact format in MISSION.\""
echo ""
echo "Pack: $(pwd)"
`;

  const runPath = join(packPath, 'RUN_CODEX.sh');
  writeFileSync(runPath, runScript, { mode: 0o700 });

  return {
    path: packPath,
    missionPath: join(packPath, 'MISSION.md'),
    runScript: runPath,
  };
}

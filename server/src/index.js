import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, importData } from './db.js';
import { createApp } from './app.js';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const envFile = path.join(serverDir, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const port = Number(process.env.PORT) || 3000;
const dataDir = path.join(serverDir, '..', 'data');

const db = openDb(path.join(serverDir, 'date.db'));
const counts = importData(db, dataDir);
console.log(`[数据] 从 ${dataDir} 导入：点子卡 ${counts.ideas} 张，小任务 ${counts.tasks} 条`);
if (!process.env.DEEPSEEK_API_KEY) console.log('[AI] 没有设置 DEEPSEEK_API_KEY，行程会使用兜底规则生成');

createApp({ db }).listen(port, () => {
  console.log(`[服务] 已启动：http://localhost:${port}`);
});

# 2026-10-30 维护检查

保持现有网站地址、数据管线和源码目录。README 新增在线维护入口并采用锁文件安装；补充 EditorConfig。修正开发说明中两处过时信息：OpenQASM Markdown 实际已被页面引用，`astro build` 也不等同完整 TypeScript 类型检查。Python 语法检查改为 Windows 同样可用的 `compileall` 命令。

## 复验结果

| 命令 | 结果 |
| --- | --- |
| `pnpm install --frozen-lockfile` | 退出 0，pnpm 11.24.0，278 包 |
| `python scripts/build_data.py` | 退出 0；2511 总记录，2338 非前置页，9 个 manifest 资源 |
| `python scripts/test_research_data.py` | 退出 0，5 测试通过 |
| `python scripts/validate_agent_data.py` | 退出 0，2511 记录、9 资源、schema 1.0.0 |
| `node scripts/test-site-worker.mjs` | 退出 0，发现、6 个工具、筛选/分页/重定向/非法输入检查通过 |
| `pnpm build` | 退出 0，35 个静态页面 |
| `python scripts/validate_agent_data.py --site-dir dist` | 退出 0，33 CS4Q 条目、49 期刊、27 会议 |

检查使用仓库已有数据快照，未发起周更抓取，也未逐篇复核文献结论。没有执行独立完整 TypeScript 类型检查或浏览器交互/主题视觉验收；不把静态构建成功写成这些验证已通过。

## 目录职责

- `data_src/`：可版本控制的数据源与策展输入；修改数据从这里开始。
- `scripts/`：构建、验证、增量抓取与 Sites 辅助脚本。
- `src/`：Astro 页面、组件、TS 浏览交互和样式。
- `public/data/`、`dist/`：忽略的生成物，不能作为数据编辑入口。
- `docs/`：数据来源、Agent 访问及维护记录。
- `.github/workflows/`：现有部署与周更配置，本轮保持不变。

[原站点](https://xiaoshecode.github.io/paper4qi/) · [在线维护文档](https://xiaoshecode.github.io/xiaoshecode/repos/paper4qi/)

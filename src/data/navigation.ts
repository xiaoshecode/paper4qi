export const navigation = [
  { id: 'home', zh: '首页', en: 'Home', path: '' },
  { id: 'workspace', zh: '研究工作台', en: 'Workspace', path: 'workspace/' },
  { id: 'papers', zh: '论文库', en: 'Paper library', children: [
    { path: 'qce/', zh: 'QCE 会议论文', en: 'QCE conference papers' },
    { path: 'tqe/', zh: 'TQE 期刊论文', en: 'TQE journal papers' },
    { path: 'venues/', zh: '期刊与会议索引', en: 'Journal & conference index' },
    { path: 'stats/', zh: '研究方向统计', en: 'Research statistics' },
  ] },
  { id: 'guides', zh: '专题导读', en: 'Research guides', children: [
    { path: 'research/', zh: '研究地图', en: 'Research map' },
    { path: 'cs4q/', zh: 'CS4Q 导读', en: 'CS4Q guide' },
    { path: 'openqasm/', zh: 'OpenQASM 专题', en: 'OpenQASM guide' },
  ] },
  { id: 'resources', zh: '数据与帮助', en: 'Data & help', children: [
    { path: 'agents/', zh: 'Agent 数据接口', en: 'Agent data access' },
    { path: 'about/', zh: '数据来源与说明', en: 'Sources & methodology' },
  ] },
];

export function matchesDestination(active: string, base: string, path: string) {
  const root = base.replace(/\/+$/, '');
  const current = active.replace(/\/+$/, '');
  const target = `${root}/${path}`.replace(/\/+$/, '');
  return path ? current === target || current.startsWith(`${target}/`) : current === root;
}

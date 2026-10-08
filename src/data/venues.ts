// 期刊与会议投稿指南数据
// 结构化自 量子计算期刊会议名录_投稿指南.md（2026-10-08 联网核验版）
// 口径：IF = 2025 JCR；分区 = 中科院 2025 年 3 月升级版；CCF = 第七版（2026-03-31 发布）
// 期刊官网链接取自 tmp_letpub/letpub_results.json 的「期刊官方网站」字段

export type VenueField = 'quantum' | 'arch' | 'eda' | 'cir' | 'se' | 'net' | 'top';

export interface Journal {
  id: string;              // 'prxq' / 'tqe' / 'iscas' 期刊小写
  name: string;            // 英文全称 'PRX Quantum'
  org: string;             // 'APS' / 'Springer Nature' / 'IEEE' / 'ACM' / 'IOP' / 'Wiley' / 'AIP' / '社区OA'
  field: VenueField;
  tier?: 'T1' | 'T2' | 'T3' | 'T4'; // 仅量子专业期刊标注声誉梯队（APS 系不标）
  ccf?: 'A' | 'B' | 'C' | 'none';   // CCF 2026 第七版；'none'=明确不在目录；undefined=不适用
  if?: number;             // 2025 JCR
  ifNote?: string;         // 口径备注，如 'IF 序列末端 6.1'
  cas: string;             // 中科院 2025 升级版，如 '物理 1区 Top'；无则 '—'
  oa: string;              // '全OA' / '混合' / '—'
  apc?: string;            // '$3,450' / '£2,790/$4,090/€3,390'
  review?: string;         // '~13周' / '首轮53天'
  note: string;            // 中文备注（浓缩 MD 备注列）
  noteEn: string;          // 英文备注
  link?: string;           // 期刊官网（取 letpub「期刊官方网站」）
}

export interface ConfVenue {
  id: string;
  name: string;
  field: VenueField;
  ccf?: 'A' | 'B' | 'C' | 'none';
  rate?: string;           // 接收率约值 '~45–50%'
  note: string;
  noteEn: string;
  link?: string;
}

export interface ConfDeadline {
  confId: string;                        // 对应 ConfVenue.id
  edition: string;                       // 'ISCAS 2027'
  year: number;
  confDate?: string;                     // '2027-05-23~26'
  location?: string;                     // 中文地点，如 '法国 波尔多'
  locationEn?: string;                   // English location, e.g. 'Bordeaux, France'
  deadlines: { phase: string; phaseEn: string; date: string; note?: string }[]; // 摘要/全文/通知/终稿，ISO 日期
  link?: string;                         // CFP 页链接
  status?: 'open' | 'closed';            // 截稿状态快照（核验日 2026-10-08，页面静态不随时间推移）
  note?: string;
  noteEn?: string;
}

export const FIELD_ZH: Record<VenueField, string> = {
  quantum: '量子专业', arch: '体系结构', eda: 'EDA', cir: '电路与测控',
  se: '软件工程', net: '网络', top: '综合顶刊',
};
export const FIELD_EN: Record<VenueField, string> = {
  quantum: 'Quantum', arch: 'Architecture', eda: 'EDA', cir: 'Circuits & Instrumentation',
  se: 'Software Engineering', net: 'Networking', top: 'General Science',
};

export const JOURNALS: Journal[] = [
  // ---------- 量子专业期刊 · 第一梯队（T1） ----------
  {
    id: 'prxq', name: 'PRX Quantum', org: 'APS', field: 'quantum', tier: 'T1',
    if: 11.0, cas: '物理 1区 Top', oa: '全OA', apc: '$3,450', review: '~13周',
    note: '量子信息专业顶刊，覆盖物理 + CS + 工程；2025 JCR IF 由初版估值 ~9.3 修正为 11.0，APC 由初版 $6,000 修正为 $3,450。',
    noteEn: 'A flagship quantum-information journal spanning physics, CS and engineering; the 2025 JCR IF was revised from an earlier estimate of ~9.3 to 11.0, and the APC from an early $6,000 to $3,450.',
    link: 'https://journals.aps.org/prxquantum/',
  },
  {
    id: 'npjqi', name: 'npj Quantum Information', org: 'Springer Nature', field: 'quantum', tier: 'T1',
    if: 8.3, cas: '物理 1区 Top', oa: '全OA', apc: '£2,790/$4,090/€3,390', review: '~29周',
    note: 'Nature 系期刊，审稿偏慢（约 29 周）。',
    noteEn: 'A Nature-family journal with a slow review process (~29 weeks).',
    link: 'https://www.nature.com/npjqi/',
  },

  // ---------- 量子专业期刊 · 第二梯队（T2） ----------
  {
    id: 'qst', name: 'Quantum Science and Technology', org: 'IOP', field: 'quantum', tier: 'T2',
    if: 5.0, ifNote: 'IOP 官网口径 4.9（2024 JCR）', cas: '物理 1区 Top', oa: '混合',
    review: '首轮决定 53 天（外审后）',
    note: '测控/器件/工程友好；混合刊可选订阅模式免 APC；IOP 官网 IF 4.9 属 2024 JCR 口径差异。',
    noteEn: 'Friendly to instrumentation, devices and engineering; as a hybrid journal it offers a subscription route with no APC. The 4.9 IF on the IOP site is a 2024-JCR figure.',
    link: 'https://iopscience.iop.org/journal/2058-9565',
  },
  {
    id: 'epjqt', name: 'EPJ Quantum Technology', org: 'Springer Nature', field: 'quantum', tier: 'T2',
    if: 5.6, cas: '物理 2区', oa: '全OA', apc: '£1,590/$1,990/€1,790', review: '首轮 58–71 天',
    note: '偏技术应用，审稿较快（LetPub 口径：全部稿件平均 58 天、经审稿稿件 71 天）。',
    noteEn: 'Technology-application oriented, with a fast review (LetPub: 58 days averaged over all manuscripts, 71 days for reviewed ones).',
    link: 'https://link.springer.com/journal/40507',
  },
  {
    id: 'quantum', name: 'Quantum', org: '社区OA', field: 'quantum', tier: 'T2',
    if: 5.4, cas: '物理 2区 Top', oa: '全OA', apc: '€450', review: '~16周',
    note: '学术社区自办刊，APC 最低；理论/CS 声誉高。',
    noteEn: 'Run by the research community itself with the lowest APC; strong reputation in theory/CS.',
    link: 'http://quantum-journal.org/',
  },

  // ---------- 量子专业期刊 · 第三梯队（T3） ----------
  {
    id: 'tqe', name: 'IEEE Transactions on Quantum Engineering', org: 'IEEE', field: 'quantum', tier: 'T3',
    if: 4.6, cas: '物理 2区（小类：量子科技 3区 / 计算机:理论方法 2区）', oa: '全OA', apc: '$1,995', review: '~13周',
    note: '工程导向，IEEE 体系，ESCI 收录；未被 2025 中科院分区表收录（表中分区为参考值），单位认可度请自行确认。',
    noteEn: 'Engineering-oriented, within the IEEE family and indexed in ESCI; not covered by the 2025 CAS partition list (the partition shown is a reference value), so confirm how your institution counts it.',
    link: 'https://ieeexplore.ieee.org/xpl/RecentIssue.jsp?punumber=8924785',
  },
  {
    id: 'jstqe', name: 'IEEE Journal of Selected Topics in Quantum Electronics', org: 'IEEE', field: 'quantum', tier: 'T3',
    if: 5.1, cas: '工程 2区', oa: '混合', review: '~2个月',
    note: '器件/光量子方向，审稿快。',
    noteEn: 'Devices and photonic quantum topics, with a fast review.',
    link: 'https://ieeexplore.ieee.org/xpl/RecentIssue.jsp?punumber=2944',
  },
  {
    id: 'aqt', name: 'Advanced Quantum Technologies', org: 'Wiley', field: 'quantum', tier: 'T3',
    if: 4.3, cas: '物理 3区', oa: '混合',
    note: '硬件/器件/应用方向友好。',
    noteEn: 'Friendly to hardware, device and application work.',
  },
  {
    id: 'qmi', name: 'Quantum Machine Intelligence', org: 'Springer Nature', field: 'quantum', tier: 'T3',
    if: 4.4, cas: '物理 2区', oa: '—',
    note: '量子 + AI 交叉方向。',
    noteEn: 'For work at the intersection of quantum computing and AI.',
  },

  // ---------- 量子专业期刊 · 第四梯队（T4） ----------
  {
    id: 'avsqs', name: 'AVS Quantum Science', org: 'AIP', field: 'quantum', tier: 'T4',
    if: 3.0, cas: '物理 3区', oa: '混合',
    note: '器件与实验技术方向。',
    noteEn: 'Devices and experimental techniques.',
  },
  {
    id: 'qip', name: 'Quantum Information Processing', org: 'Springer Nature', field: 'quantum', tier: 'T4',
    if: 2.2, cas: '物理 3区', oa: '混合', review: '4–8周',
    note: '门槛较低，偏理论与算法。',
    noteEn: 'A lower bar, leaning toward theory and algorithms.',
    link: 'https://www.springer.com/11128',
  },
  {
    id: 'ijqi', name: 'International Journal of Quantum Information', org: 'World Scientific', field: 'quantum', tier: 'T4',
    if: 0.8, cas: '物理 4区', oa: '混合',
    note: '慎投：IF 0.8，网友报告平均审稿长达 24 个月。',
    noteEn: 'Approach with caution: IF 0.8 and user reports of a 24-month average review.',
    link: 'http://www.worldscinet.com/ijqi/ijqi.shtml',
  },

  // ---------- 相关 APS / 应用物理期刊（不标梯队） ----------
  {
    id: 'prapplied', name: 'Physical Review Applied', org: 'APS', field: 'quantum',
    if: 4.4, cas: '物理 2区', oa: '—',
    note: '器件/测控实验方向友好。',
    noteEn: 'Friendly to device and instrumentation experiments.',
    link: 'https://journals.aps.org/prapplied/',
  },
  {
    id: 'prresearch', name: 'Physical Review Research', org: 'APS', field: 'quantum',
    if: 4.2, cas: '物理 2区 Top', oa: '全OA',
    note: 'PR 系全 OA 刊。',
    noteEn: 'A fully open-access journal in the Physical Review family.',
    link: 'https://journals.aps.org/prresearch/',
  },
  {
    id: 'apl', name: 'Applied Physics Letters', org: 'AIP', field: 'quantum',
    if: 3.6, cas: '物理 3区', oa: '—',
    note: '快报型期刊。',
    noteEn: 'A letters-style journal for rapid publication.',
    link: 'http://apl.aip.org/',
  },
  {
    id: 'pra', name: 'Physical Review A', org: 'APS', field: 'quantum',
    if: 2.9, cas: '物理 2区', oa: '—',
    note: '量子信息研究的传统阵地。',
    noteEn: 'A long-standing home for quantum-information research.',
    link: 'http://pra.aps.org/',
  },

  // ---------- 计算机体系结构 ----------
  {
    id: 'tc', name: 'IEEE Transactions on Computers', org: 'IEEE', field: 'arch', ccf: 'A',
    if: 3.8, cas: '计算机 3区', oa: '—',
    note: '量子架构/量子映射类论文常见。',
    noteEn: 'A common venue for quantum-architecture and qubit-mapping papers.',
    link: 'http://ieeexplore.ieee.org/xpl/RecentIssue.jsp?punumber=12',
  },
  {
    id: 'tpds', name: 'IEEE Transactions on Parallel and Distributed Systems', org: 'IEEE', field: 'arch', ccf: 'A',
    if: 6.0, cas: '计算机 2区', oa: '—',
    note: 'IF 上升明显（初版估值 ~3.5 → 6.0）。',
    noteEn: 'A marked IF rise (from an early estimate of ~3.5 to 6.0).',
    link: 'http://ieeexplore.ieee.org/xpl/RecentIssue.jsp?punumber=71',
  },
  {
    id: 'taco', name: 'ACM Transactions on Architecture and Code Optimization', org: 'ACM', field: 'arch', ccf: 'A',
    if: 1.8, cas: '计算机 4区', oa: '—',
    note: '分区与 CCF 等级反差大，属纯学术声誉刊。',
    noteEn: 'Its CAS partition contrasts sharply with its CCF rank; reputation rests purely on academic standing.',
    link: 'http://dl.acm.org/citation.cfm?id=J924',
  },
  {
    id: 'cal', name: 'IEEE Computer Architecture Letters', org: 'IEEE', field: 'arch', ccf: 'none',
    if: 1.4, cas: '计算机 4区', oa: '—', review: '快',
    note: '6 页架构 idea 快报；2026 明确不在 CCF 目录（初版误标 B，已修正）。',
    noteEn: 'A 6-page rapid letter for architecture ideas; explicitly outside the CCF list in 2026 (an early draft mislabelled it B).',
    link: 'https://ieeexplore.ieee.org/xpl/RecentIssue.jsp?punumber=10208',
  },
  {
    id: 'iemicro', name: 'IEEE Micro', org: 'IEEE', field: 'arch', ccf: 'none',
    if: 3.0, cas: '计算机 3区', oa: '—',
    note: '杂志性质；不在 CCF 目录（初版误标，已修正）。',
    noteEn: 'A magazine rather than a journal; not in the CCF list (an early draft mislabelled it).',
    link: 'http://ieeexplore.ieee.org/xpl/RecentIssue.jsp?punumber=40',
  },
  {
    id: 'designtest', name: 'IEEE Design & Test', org: 'IEEE', field: 'arch', ccf: 'none',
    if: 1.9, cas: '计算机 4区', oa: '—',
    note: '专题友好；不在 CCF 目录（初版误标，已修正）。',
    noteEn: 'Friendly to special-issue proposals; not in the CCF list (an early draft mislabelled it).',
    link: 'https://www.ieee.org/membership-catalog/productdetail/showProductDetailPage.html?product=PER311-EPC',
  },

  // ---------- EDA / 设计自动化 ----------
  {
    id: 'tcad', name: 'IEEE Transactions on Computer-Aided Design of Integrated Circuits and Systems', org: 'IEEE', field: 'eda', ccf: 'A',
    if: 2.9, cas: '计算机 3区', oa: '—',
    note: 'EDA/量子编译方向的权威期刊（第 6 节 EDA 表中即指本刊）。',
    noteEn: 'The authoritative journal for EDA and quantum compilation (the journal referenced in the EDA section).',
    link: 'http://ieeexplore.ieee.org/xpl/RecentIssue.jsp?punumber=43',
  },
  {
    id: 'todaes', name: 'ACM Transactions on Design Automation of Electronic Systems', org: 'ACM', field: 'eda', ccf: 'B',
    cas: '—', oa: '—',
    note: 'EDA 期刊，CCF-B；本次核验未取得 IF 与分区数据。',
    noteEn: 'An EDA journal ranked CCF-B; no IF or partition data was obtained in this verification round.',
  },

  // ---------- 软件工程 / 编程语言 ----------
  {
    id: 'tse', name: 'IEEE Transactions on Software Engineering', org: 'IEEE', field: 'se', ccf: 'A',
    if: 5.6, cas: '计算机 2区 Top', oa: '—',
    note: '软件工程旗舰期刊。',
    noteEn: 'A flagship software-engineering journal.',
    link: 'http://ieeexplore.ieee.org/xpl/RecentIssue.jsp?punumber=32',
  },
  {
    id: 'tosem', name: 'ACM Transactions on Software Engineering and Methodology', org: 'ACM', field: 'se', ccf: 'A',
    if: 6.2, cas: '计算机 2区', oa: '—',
    note: '软件工程与方法学顶刊。',
    noteEn: 'A top journal for software engineering and methodology.',
    link: 'http://tosem.acm.org/',
  },
  {
    id: 'acmtqc', name: 'ACM Transactions on Quantum Computing', org: 'ACM', field: 'se', tier: 'T2', ccf: 'C',
    if: 6.8, ifNote: 'IF 序列末端 6.1；年发文量约 30 篇为 IF 序列观测值（LetPub 无发文量字段）',
    cas: '物理 1区 Top（小类 CS Theory 1区）', oa: '混合',
    note: 'CCF-C（2026 新入选）——量子计算首次有期刊进入 CCF 目录，也是量子算法/软件论文的 CCF 认证归宿；CS 口味，年发文量少（约 30 篇/年，观测值），IF 波动大。',
    noteEn: 'CCF-C (newly added in 2026) — the first quantum-computing journal admitted to the CCF list and the CCF-certified home for quantum algorithms/software; CS-oriented with publishes little (~30 papers a year, an observed estimate), so the IF swings.',
  },

  // ---------- 电路与测控硬件 ----------
  {
    id: 'jssc', name: 'IEEE Journal of Solid-State Circuits', org: 'IEEE', field: 'cir',
    if: 5.6, cas: '工程 2区 Top', oa: '—',
    note: 'ISSCC 期刊版，量子控制芯片首选。',
    noteEn: 'The journal counterpart of ISSCC; a first choice for quantum control chips.',
    link: 'http://ieeexplore.ieee.org/xpl/RecentIssue.jsp?punumber=4',
  },
  {
    id: 'tim', name: 'IEEE Transactions on Instrumentation and Measurement', org: 'IEEE', field: 'cir',
    if: 5.9, cas: '工程 2区 Top', oa: '混合（可自选是否 OA）',
    note: '仪器与测量方向，测控系统友好。',
    noteEn: 'Instrumentation and measurement; friendly to control and measurement systems.',
    link: 'https://ieeexplore.ieee.org/xpl/RecentIssue.jsp?punumber=19',
  },
  {
    id: 'tcas1', name: 'IEEE Transactions on Circuits and Systems I: Regular Papers', org: 'IEEE', field: 'cir',
    if: 5.2, cas: '工程 2区 Top', oa: '—',
    note: '系统级测控方向。',
    noteEn: 'Suited to system-level control and measurement work.',
    link: 'http://ieeexplore.ieee.org/xpl/RecentIssue.jsp?punumber=8919',
  },
  {
    id: 'tcas2', name: 'IEEE Transactions on Circuits and Systems II: Express Briefs', org: 'IEEE', field: 'cir',
    if: 4.9, cas: '工程 2区 Top', oa: '—',
    note: '5 页快速发表。',
    noteEn: 'Five-page rapid publication.',
    link: 'http://ieeexplore.ieee.org/xpl/RecentIssue.jsp?punumber=8920',
  },
  {
    id: 'tmtt', name: 'IEEE Transactions on Microwave Theory and Techniques', org: 'IEEE', field: 'cir',
    if: 4.5, cas: '工程 2区 Top', oa: '—',
    note: '微波链路/组件顶刊。',
    noteEn: 'A leading journal for microwave links and components.',
    link: 'http://ieeexplore.ieee.org/xpl/RecentIssue.jsp?punumber=22',
  },
  {
    id: 'jetcas', name: 'IEEE Journal on Emerging and Selected Topics in Circuits and Systems', org: 'IEEE', field: 'cir',
    if: 3.8, cas: '工程 3区', oa: '—',
    note: '2026 降区（初版 4.3/工程 2区 → 3.8/工程 3区）；常有量子硬件专刊。',
    noteEn: 'Dropped a tier in 2026 (from 4.3 / Engineering tier 2 to 3.8 / Engineering tier 3); frequently runs quantum-hardware special issues.',
    link: 'http://jetcas.polito.it/',
  },
  {
    id: 'mwtl', name: 'IEEE Microwave and Wireless Technology Letters', org: 'IEEE', field: 'cir',
    if: 3.4, cas: '工程 3区', oa: '—',
    note: '微波快报。',
    noteEn: 'A rapid microwave letters journal.',
    link: 'https://ieeexplore.ieee.org/xpl/RecentIssue.jsp?punumber=9944983',
  },
  {
    id: 'sust', name: 'Superconductor Science and Technology', org: 'IOP', field: 'cir',
    if: 4.2, cas: '物理 2区', oa: '—',
    note: '超导量子器件方向。',
    noteEn: 'For superconducting quantum devices.',
    link: 'http://iopscience.iop.org/journal/0953-2048',
  },
  {
    id: 'cryo', name: 'Cryogenics', org: 'Elsevier', field: 'cir',
    if: 2.1, cas: '工程 3区', oa: '—',
    note: '低温工程方向。',
    noteEn: 'For cryogenic engineering.',
    link: 'http://www.journals.elsevier.com/cryogenics/',
  },
  {
    id: 'rsi', name: 'Review of Scientific Instruments', org: 'AIP', field: 'cir',
    if: 1.7, cas: '工程 4区', oa: '—',
    note: '2026 大跌（初版 3.0/工程 3区 → 1.7/工程 4区），仪器方法学方向慎投。',
    noteEn: 'A steep 2026 fall (from 3.0 / Engineering tier 3 to 1.7 / Engineering tier 4); be cautious for instrumentation-methodology work.',
    link: 'http://rsi.aip.org/',
  },
  {
    id: 'tas', name: 'IEEE Transactions on Applied Superconductivity', org: 'IEEE', field: 'cir',
    if: 1.8, cas: '物理 3区', oa: '—',
    note: '应用超导方向。',
    noteEn: 'For applied superconductivity.',
    link: 'http://ieeexplore.ieee.org/xpl/RecentIssue.jsp?punumber=77',
  },

  // ---------- 计算机网络 ----------
  {
    id: 'jsac', name: 'IEEE Journal on Selected Areas in Communications', org: 'IEEE', field: 'net', ccf: 'A',
    if: 17.2, cas: '计算机 1区 Top', oa: '—',
    note: '出过量子通信专刊。',
    noteEn: 'Has run special issues on quantum communication.',
    link: 'http://ieeexplore.ieee.org/xpl/RecentIssue.jsp?punumber=49',
  },
  {
    id: 'ton', name: 'IEEE/ACM Transactions on Networking (IEEE TON)', org: 'IEEE', field: 'net', ccf: 'A',
    cas: '—', oa: '—',
    note: '2025 年起更名为 IEEE TON；LetPub 新卷暂无 IF（显示 0），需以官网为准。',
    noteEn: 'Renamed IEEE TON from 2025; LetPub has no IF for the new volume (shows 0), so check the publisher site.',
  },
  {
    id: 'tnsm', name: 'IEEE Transactions on Network and Service Management', org: 'IEEE', field: 'net', ccf: 'C',
    if: 5.4, cas: '计算机 2区', oa: '—',
    note: 'CCF-C（2022/2026 两版一致）；初版指南误标 B，此处修正。',
    noteEn: 'CCF-C (same in the 2022 and 2026 editions); an early draft mislabelled it B, corrected here.',
    link: 'http://www.comsoc.org/tnsm',
  },

  // ---------- 综合顶刊 ----------
  {
    id: 'nature', name: 'Nature', org: 'Springer Nature', field: 'top',
    if: 48.5, cas: '综合 1区 Top', oa: '—',
    note: '2025 JCR IF 48.5（初版 ~50 校正）。',
    noteEn: '2025 JCR IF of 48.5 (corrected from an early ~50).',
    link: 'https://www.nature.com/',
  },
  {
    id: 'science', name: 'Science', org: 'AAAS', field: 'top',
    if: 45.8, cas: '综合 1区 Top', oa: '—',
    note: '综合类顶刊。',
    noteEn: 'A top multidisciplinary journal.',
    link: 'http://www.sciencemag.org/',
  },
  {
    id: 'natelec', name: 'Nature Electronics', org: 'Springer Nature', field: 'top',
    if: 40.9, cas: '工程 1区 Top', oa: '—',
    note: '芯片级量子成果首选（2025 JCR 大涨）。',
    noteEn: 'The first choice for chip-level quantum results (a large 2025 JCR gain).',
    link: 'https://www.nature.com/natelectron/',
  },
  {
    id: 'natrevphys', name: 'Nature Reviews Physics', org: 'Springer Nature', field: 'top',
    if: 39.5, cas: '物理 1区 Top', oa: '—',
    note: '综述型期刊。',
    noteEn: 'A review journal.',
    link: 'https://www.nature.com/natrevphys',
  },
  {
    id: 'natmeth', name: 'Nature Methods', org: 'Springer Nature', field: 'top',
    if: 32.1, cas: '生物 1区 Top', oa: '—',
    note: '方法学方向。',
    noteEn: 'For methodological advances.',
    link: 'https://www.nature.com/nmeth',
  },
  {
    id: 'natphys', name: 'Nature Physics', org: 'Springer Nature', field: 'top',
    if: 18.4, cas: '物理 1区 Top', oa: '—',
    note: '物理类顶刊。',
    noteEn: 'A leading physics journal.',
    link: 'https://www.nature.com/nphys',
  },
  {
    id: 'natcomm', name: 'Nature Communications', org: 'Springer Nature', field: 'top',
    if: 15.7, cas: '综合 1区 Top', oa: '全OA',
    note: '全 OA，接收面广。',
    noteEn: 'Fully open access with broad scope.',
    link: 'https://www.nature.com/ncomms/',
  },
  {
    id: 'sciadv', name: 'Science Advances', org: 'AAAS', field: 'top',
    if: 12.5, cas: '综合 1区 Top', oa: '全OA',
    note: '全 OA 综合刊。',
    noteEn: 'A fully open-access multidisciplinary journal.',
    link: 'https://advances.sciencemag.org/',
  },
];

export const CONFS: ConfVenue[] = [
  // ---------- 量子计算会议 ----------
  {
    id: 'qce', name: 'IEEE Quantum Week (QCE)', field: 'quantum', ccf: 'none', rate: '~40–45%',
    note: '量子工程/系统旗舰会议，工程类首选；EI 检索 proceedings；本站已收录其 2020–2026 全目录。',
    noteEn: 'The flagship quantum engineering/systems conference and the first choice for engineering work; proceedings are EI-indexed; this site already indexes its full 2020–2026 program.',
  },
  {
    id: 'qcrypt', name: 'QCrypt', field: 'quantum', ccf: 'none', rate: '~30%',
    note: '量子密码专业顶会，理论 + 实验并重。',
    noteEn: 'The leading conference on quantum cryptography, covering both theory and experiment.',
  },
  {
    id: 'tqc', name: 'TQC (Theory of Quantum Computing)', field: 'quantum', ccf: 'none', rate: '~30%',
    note: 'LIPIcs 出版的理论会议，偏理论 CS。',
    noteEn: 'A LIPIcs-published theory conference, CS-theory oriented.',
  },
  {
    id: 'qipconf', name: 'QIP (Quantum Information Processing)', field: 'quantum', ccf: 'none',
    note: '邀请制 workshop，声誉极高，摘要制。',
    noteEn: 'An invitation-based workshop with an outstanding reputation; abstract-only submissions.',
  },
  {
    id: 'apsmm', name: 'APS March Meeting', field: 'quantum', ccf: 'none', rate: '高',
    note: '物理学界最大集会，摘要制展示。',
    noteEn: 'The largest gathering in physics; presentation via submitted abstracts.',
  },

  // ---------- 计算机体系结构「四大」 ----------
  {
    id: 'isca', name: 'ISCA', field: 'arch', ccf: 'A', rate: '~20–22%',
    note: 'ISCA 2025 程序页含 135 个论文条目（官网计数）。',
    noteEn: 'The ISCA 2025 program listed 135 paper entries (counted from the official site).',
  },
  {
    id: 'micro', name: 'MICRO', field: 'arch', ccf: 'A', rate: '~23–25%',
    note: 'MICRO 58 (2025) 程序页含 123 个论文条目。',
    noteEn: 'The MICRO 58 (2025) program listed 123 paper entries.',
  },
  {
    id: 'hpca', name: 'HPCA', field: 'arch', ccf: 'A', rate: '~20–24%',
    note: '2025 官网未能提取精确条目数。',
    noteEn: 'An exact entry count could not be extracted from the 2025 official site.',
  },
  {
    id: 'asplos', name: 'ASPLOS', field: 'arch', ccf: 'A', rate: '~20%',
    note: 'ASPLOS 2025 程序页含 185 个论文条目（多轮投稿累积）。',
    noteEn: 'The ASPLOS 2025 program listed 185 paper entries (accumulated across multiple submission rounds).',
  },

  // ---------- EDA / 设计自动化 ----------
  {
    id: 'dac', name: 'DAC', field: 'eda', ccf: 'A',
    note: '量子 EDA（mapping、综合）是近年热点专题。',
    noteEn: 'Quantum EDA (mapping, synthesis) has been a hot topic in recent years.',
  },
  {
    id: 'iccad', name: 'ICCAD', field: 'eda', ccf: 'B',
    note: 'EDA 领域主力会议之一。',
    noteEn: 'One of the main EDA conferences.',
  },
  {
    id: 'date', name: 'DATE', field: 'eda', ccf: 'B',
    note: '欧洲旗舰 EDA 会议。',
    noteEn: 'The European flagship EDA conference.',
  },
  {
    id: 'aspdac', name: 'ASP-DAC', field: 'eda', ccf: 'C',
    note: '亚太地区 EDA 会议。',
    noteEn: 'The Asia-Pacific EDA conference.',
  },
  {
    id: 'fmcad', name: 'FMCAD', field: 'eda', ccf: 'B',
    note: '2026 年从 C 升 B；量子形式化验证方向受益。',
    noteEn: 'Promoted from C to B in 2026; a gain for quantum formal verification.',
  },

  // ---------- 电路与测控硬件 ----------
  {
    id: 'isscc', name: 'ISSCC', field: 'cir', ccf: 'none', rate: '~25–30%',
    note: '芯片设计最高声誉会议；已设 cryo-CMOS 量子控制专题。',
    noteEn: 'The most prestigious chip-design conference; it already hosts cryo-CMOS quantum control sessions.',
  },
  {
    id: 'iscas', name: 'ISCAS', field: 'cir', ccf: 'B', rate: '~45–50%',
    note: '★ 2026 年从 C 升 B，CCF 体系内认可度提高；ISCAS 2027 目标会议。',
    noteEn: '★ Promoted from C to B in 2026, raising its standing within CCF; the target venue for ISCAS 2027.',
  },
  {
    id: 'rfic', name: 'RFIC', field: 'cir', ccf: 'none', rate: '~30%',
    note: '射频 IC 会议，微波测控链路相关。',
    noteEn: 'The RF IC conference, relevant to microwave control links.',
  },
  {
    id: 'cicc', name: 'CICC', field: 'cir', ccf: 'none', rate: '~40–50%',
    note: '定制集成电路会议（与 ESSCIRC 同列的约值）。',
    noteEn: 'The custom integrated circuits conference (same approximate rate as ESSCIRC).',
  },
  {
    id: 'esscirc', name: 'ESSCIRC / ESSERC', field: 'cir', ccf: 'none', rate: '~40–50%',
    note: '欧洲固态电路会议；2024 届起与 ESSDERC 合并为统一的 ESSERC（电路/器件分轨）。',
    noteEn: 'The European solid-state circuits conference; merged with ESSDERC into the unified ESSERC from 2024, with dedicated circuits and device tracks.',
  },

  // ---------- 软件工程 / 编程语言 ----------
  {
    id: 'pldi', name: 'PLDI', field: 'se', ccf: 'A',
    note: '量子编译器/IR 方向的常见归属。',
    noteEn: 'A common home for quantum compiler and IR work.',
  },
  {
    id: 'oopsla', name: 'OOPSLA', field: 'se', ccf: 'A',
    note: '量子编译器/IR 方向的常见归属。',
    noteEn: 'A common home for quantum compiler and IR work.',
  },
  {
    id: 'ase', name: 'ASE', field: 'se', ccf: 'A',
    note: '量子程序测试/调试论文常见。',
    noteEn: 'Frequently hosts quantum program testing and debugging papers.',
  },
  {
    id: 'icse', name: 'ICSE', field: 'se', ccf: 'A',
    note: '软件工程综合旗舰会议。',
    noteEn: 'The flagship general software-engineering conference.',
  },
  {
    id: 'fse', name: 'FSE', field: 'se', ccf: 'A',
    note: '2026 年从 B 升 A。',
    noteEn: 'Promoted from B to A in 2026.',
  },

  // ---------- 计算机网络 ----------
  {
    id: 'infocom', name: 'INFOCOM', field: 'net', ccf: 'A',
    note: '量子网络协议论文常见。',
    noteEn: 'Frequently hosts quantum network protocol papers.',
  },
  {
    id: 'sigcomm', name: 'SIGCOMM', field: 'net', ccf: 'A',
    note: '量子互联网架构级工作。',
    noteEn: 'For architecture-level quantum internet work.',
  },
  {
    id: 'qunet', name: 'QuNet (SIGCOMM Workshop)', field: 'net', ccf: 'none',
    note: 'SIGCOMM 下固定的量子网络方向 workshop（2026 年起持续举办）。',
    noteEn: 'A recurring quantum-networking workshop co-located with SIGCOMM (running since 2026).',
  },
];

// 会议 CFP 截止日期：2026-10-08 联网核验（数据源：投稿时间线.html，名录调研 agent 产出；
// ISCAS 2027 为同日从官网 https://2027.ieee-iscas.org/call-for-papers 补充核验）。
// status 为核验日快照；推断值（官网未公布、按上届周期推算）在 note 中注明。
export const CONF_DEADLINES: ConfDeadline[] = [
  // ---------- 量子计算 ----------
  {
    confId: 'qce', edition: 'QCE 2027 (8th)', year: 2027,
    confDate: '2027-10-10~15', location: '美国 罗利', locationEn: 'Raleigh, NC, USA',
    deadlines: [
      { phase: '摘要', phaseEn: 'Abstract', date: '2027-04-19' },
      { phase: '全文', phaseEn: 'Full paper', date: '2027-04-26' },
      { phase: '录用通知', phaseEn: 'Notification', date: '2027-07-05' },
    ],
    status: 'open', link: 'https://qce.quantum.ieee.org/',
    note: 'IEEE CS 已官宣罗利 2027-10-10~15；CFP 未发布，截稿按 QCE 2026 周期（摘要/全文 4 月下旬、通知 7 月上旬）推断。',
    noteEn: 'IEEE CS has officially announced Raleigh, Oct 10–15, 2027; the CFP is not out yet, so deadlines are projected from the QCE 2026 cycle (abstract and full paper in late April, notification in early July).',
  },
  {
    confId: 'qcrypt', edition: 'QCrypt 2027', year: 2027,
    confDate: '2027-08-23~27', location: '奥地利 维也纳', locationEn: 'Vienna, Austria',
    deadlines: [
      { phase: '摘要（Talk）', phaseEn: 'Extended abstract', date: '2027-03-12' },
      { phase: '录用通知', phaseEn: 'Notification', date: '2027-05-14' },
    ],
    status: 'open', link: 'https://qcrypt.net/',
    note: '官网已官宣维也纳 2027-08-23~27；CFP 未发布，截稿按 QCrypt 2026 周期（摘要 3 月中、通知 5 月中）推断；扩展摘要制（≤3 页），无正式论文集。',
    noteEn: 'The official site has announced Vienna, Aug 23–27, 2027; the CFP is not out yet, so deadlines are projected from the QCrypt 2026 cycle (abstract mid-March, notification mid-May); submissions are extended abstracts (up to 3 pages) with no formal proceedings.',
  },
  // ---------- 电路与测控 ----------
  {
    confId: 'iscas', edition: 'ISCAS 2027', year: 2027,
    confDate: '2027-06-06~09', location: '法国 波尔多', locationEn: 'Bordeaux, France',
    deadlines: [
      { phase: '全文', phaseEn: 'Full paper', date: '2026-10-13' },
      { phase: '录用通知', phaseEn: 'Notification', date: '2027-01-11' },
      { phase: '终稿', phaseEn: 'Camera-ready', date: '2027-02-27' },
    ],
    status: 'open', link: 'https://2027.ieee-iscas.org/call-for-papers',
    note: 'CCF 2026 升 B 类后的首届；Special Session 论文投稿延长至 2026-10-22。',
    noteEn: 'First edition after ISCAS was promoted to CCF-B (2026); special-session papers are due 2026-10-22.',
  },
  {
    confId: 'isscc', edition: 'ISSCC 2027', year: 2027,
    confDate: '2027-02-14', location: '美国 旧金山', locationEn: 'San Francisco, CA, USA',
    deadlines: [
      { phase: '全文', phaseEn: 'Full paper', date: '2026-09-16' },
      { phase: '录用通知', phaseEn: 'Notification', date: '2026-11-18' },
    ],
    status: 'closed', link: 'https://www.isscc.org/',
    note: 'Late-News 通道 intent 截止 2026-10-07（已过）。',
    noteEn: 'The Late-News intent deadline was 2026-10-07 (passed).',
  },
  {
    confId: 'esscirc', edition: 'ESSERC 2027 (53rd)', year: 2027,
    confDate: '2027-09-06~09', location: '芬兰 赫尔辛基', locationEn: 'Helsinki, Finland',
    deadlines: [
      { phase: '全文', phaseEn: 'Full paper', date: '2027-04-02' },
    ],
    status: 'open', link: 'https://www.esserc2027.org/info',
    note: 'ESSCIRC 与 ESSDERC 合并后的 ESSERC 统一会；官网目前仅公布全文截止 04-02。',
    noteEn: 'The unified ESSERC after the ESSCIRC–ESSDERC merger; the official site currently lists only the full-paper deadline, Apr 2.',
  },
  // ---------- EDA ----------
  {
    confId: 'dac', edition: 'DAC 2027 (64th)', year: 2027,
    confDate: '2027-07-11', location: '美国 圣何塞', locationEn: 'San Jose, CA, USA',
    deadlines: [
      { phase: '摘要', phaseEn: 'Abstract', date: '2026-11-11' },
      { phase: '全文', phaseEn: 'Full paper', date: '2026-11-18' },
      { phase: '录用通知', phaseEn: 'Notification', date: '2027-03-08' },
    ],
    status: 'open', link: 'https://dac.com/2027/authors/call-for-contributions',
    note: 'Research 轨两阶段投稿：摘要 11-11 / 全文 11-18（17:00 PST）。',
    noteEn: 'Two-phase research track: abstract Nov 11, full paper Nov 18 (5 p.m. PST).',
  },
  {
    confId: 'date', edition: 'DATE 2027 Late-Breaking (LBR)', year: 2027,
    confDate: '2027-03-22', location: '德国 德累斯顿', locationEn: 'Dresden, Germany',
    deadlines: [
      { phase: '全文（LBR 轨）', phaseEn: 'Full paper (LBR)', date: '2026-11-29' },
      { phase: '录用通知', phaseEn: 'Notification', date: '2027-01-13' },
    ],
    status: 'open', link: 'https://www.date-conference.com/call-for-papers',
    note: '常规轨已截止，LBR 轨仍开放；设 Quantum Computing 专题日。',
    noteEn: 'The regular track is closed but the LBR track is still open; features a Quantum Computing theme day.',
  },
  {
    confId: 'date', edition: 'DATE 2027 (main)', year: 2027,
    confDate: '2027-03-22', location: '德国 德累斯顿', locationEn: 'Dresden, Germany',
    deadlines: [
      { phase: '全文', phaseEn: 'Full paper', date: '2026-09-20' },
      { phase: '录用通知', phaseEn: 'Notification', date: '2026-11-23' },
    ],
    status: 'closed', link: 'https://www.date-conference.com/call-for-papers',
    note: '常规轨已截止；设 Quantum Computing 专题日。',
    noteEn: 'Regular track closed; features a Quantum Computing theme day.',
  },
  {
    confId: 'iccad', edition: 'ICCAD 2027 (projected)', year: 2027,
    confDate: '2027-11-08', location: '待定', locationEn: 'TBD',
    deadlines: [
      { phase: '摘要', phaseEn: 'Abstract', date: '2027-04-07' },
      { phase: '全文', phaseEn: 'Full paper', date: '2027-04-14' },
      { phase: '录用通知', phaseEn: 'Notification', date: '2027-07-11' },
    ],
    status: 'open',
    note: '官网未上线；按 ICCAD 2026 周期（04-07/04-14）推断。',
    noteEn: 'Official site not yet live; projected from the ICCAD 2026 cycle (Apr 7 / Apr 14).',
  },
  {
    confId: 'iccad', edition: 'ICCAD 2026', year: 2026,
    confDate: '2026-11-05', location: '待定', locationEn: 'TBD',
    deadlines: [
      { phase: '摘要', phaseEn: 'Abstract', date: '2026-04-07' },
      { phase: '全文', phaseEn: 'Full paper', date: '2026-04-14' },
      { phase: '录用通知', phaseEn: 'Notification', date: '2026-07-11' },
    ],
    status: 'closed', link: 'https://iccad.com/2026',
  },
  // ---------- 体系结构 ----------
  {
    confId: 'isca', edition: 'ISCA 2027 (projected)', year: 2027,
    confDate: '2027-06-27', location: '待定', locationEn: 'TBD',
    deadlines: [
      { phase: '摘要', phaseEn: 'Abstract', date: '2026-11-10' },
      { phase: '全文', phaseEn: 'Full paper', date: '2026-11-17' },
      { phase: '录用通知', phaseEn: 'Notification', date: '2027-03-27' },
    ],
    status: 'open', link: 'https://www.iscaconf.org/',
    note: '官方站点尚未上线；按 ISCA 2026 周期（11-10/11-17）推断。',
    noteEn: 'Official site not yet live; projected from the ISCA 2026 cycle (Nov 10 / Nov 17).',
  },
  {
    confId: 'pldi', edition: 'PLDI 2027', year: 2027,
    confDate: '2027-06-05', location: '美国 亚特兰大', locationEn: 'Atlanta, GA, USA',
    deadlines: [
      { phase: '全文', phaseEn: 'Full paper', date: '2026-11-12' },
      { phase: '录用通知', phaseEn: 'Notification', date: '2027-03-04' },
    ],
    status: 'open', link: 'https://conf.researchr.org/dates/pldi-2027',
    note: '无摘要截止 · 单轮 · FCRC 同办（与 ISCA 同期）。',
    noteEn: 'No abstract deadline; single round; co-located with FCRC (alongside ISCA).',
  },
  {
    confId: 'hpca', edition: 'HPCA 2027', year: 2027,
    confDate: '2027-03-20', location: '美国 盐湖城', locationEn: 'Salt Lake City, UT, USA',
    deadlines: [
      { phase: '摘要', phaseEn: 'Abstract', date: '2026-07-24' },
      { phase: '全文', phaseEn: 'Full paper', date: '2026-07-31' },
      { phase: '录用通知', phaseEn: 'Notification', date: '2026-11-06' },
    ],
    status: 'closed', link: 'https://conf.researchr.org/home/hpca-2027',
    note: '与 CGO/PPoPP/CC 2027 联办；下轮 HPCA 2028 截稿约 2027-07 底。',
    noteEn: 'Co-located with CGO/PPoPP/CC 2027; the next HPCA 2028 deadline is around late July 2027.',
  },
  {
    confId: 'asplos', edition: 'ASPLOS 2027 (Sept round)', year: 2027,
    confDate: '2027-04-11', location: '希腊 克里特岛', locationEn: 'Crete, Greece',
    deadlines: [
      { phase: '全文', phaseEn: 'Full paper', date: '2026-09-09' },
      { phase: '录用通知', phaseEn: 'Notification', date: '2026-12-21' },
    ],
    status: 'closed', link: 'https://asplos-conference.org/asplos2027/cfp',
    note: '两轮制：4 月轮与 9 月轮均已截止；无摘要截止。',
    noteEn: 'Two-round cycle: both the April and September rounds are closed; no abstract deadline.',
  },
  {
    confId: 'micro', edition: 'MICRO 2026 (58th)', year: 2026,
    confDate: '2026-10-26', location: '希腊 雅典', locationEn: 'Athens, Greece',
    deadlines: [
      { phase: '摘要', phaseEn: 'Abstract', date: '2026-03-31' },
      { phase: '全文', phaseEn: 'Full paper', date: '2026-04-07' },
      { phase: '录用通知', phaseEn: 'Notification', date: '2026-07-28' },
    ],
    status: 'closed', link: 'https://microarch.org/micro59/',
  },
  {
    confId: 'asplos', edition: 'ASPLOS 2026 (summer round)', year: 2026,
    confDate: '2026-10-04', location: '—', locationEn: '—',
    deadlines: [
      { phase: '摘要', phaseEn: 'Abstract', date: '2025-08-13' },
      { phase: '全文', phaseEn: 'Full paper', date: '2025-08-20' },
      { phase: '录用通知', phaseEn: 'Notification', date: '2025-11-24' },
    ],
    status: 'closed', link: 'https://asplos-conference.org/',
  },
  // ---------- 软件工程 ----------
  {
    confId: 'icse', edition: 'ICSE 2027 (satellites)', year: 2027,
    confDate: '2027-04-25', location: '爱尔兰 都柏林', locationEn: 'Dublin, Ireland',
    deadlines: [
      { phase: '全文', phaseEn: 'Full paper', date: '2026-10-23' },
      { phase: '录用通知', phaseEn: 'Notification', date: '2026-12-15' },
    ],
    status: 'open', link: 'https://conf.researchr.org/dates/icse-2027',
    note: 'NIER/SEIP/SEIS/Tool Demo/SEAMS/CHASE 等 8 个卫星轨道。',
    noteEn: 'Eight satellite tracks incl. NIER, SEIP, SEIS, Tool Demo, SEAMS and CHASE.',
  },
  {
    confId: 'fse', edition: 'FSE 2027', year: 2027,
    confDate: '2027-07-12', location: '中国 深圳', locationEn: 'Shenzhen, China',
    deadlines: [
      { phase: '全文', phaseEn: 'Full paper', date: '2026-10-02' },
      { phase: '录用通知', phaseEn: 'Notification', date: '2027-01-22' },
    ],
    status: 'closed', link: 'https://conf.researchr.org/dates/fse-2027',
    note: '无摘要截止 · 无第二轮。',
    noteEn: 'No abstract deadline and no second round.',
  },
  {
    confId: 'icse', edition: 'ICSE 2027 (main track)', year: 2027,
    confDate: '2027-04-28', location: '爱尔兰 都柏林', locationEn: 'Dublin, Ireland',
    deadlines: [
      { phase: '摘要', phaseEn: 'Abstract', date: '2026-06-23' },
      { phase: '全文', phaseEn: 'Full paper', date: '2026-06-30' },
      { phase: '录用通知', phaseEn: 'Notification', date: '2026-10-20' },
    ],
    status: 'closed', link: 'https://conf.researchr.org/dates/icse-2027',
    note: '2027 届起改单轮制。',
    noteEn: 'Moves to a single-round cycle from 2027.',
  },
  {
    confId: 'ase', edition: 'ASE 2027 (projected)', year: 2027,
    confDate: '2027-10-11', location: '待定', locationEn: 'TBD',
    deadlines: [
      { phase: '全文', phaseEn: 'Full paper', date: '2027-03-26' },
      { phase: '录用通知', phaseEn: 'Notification', date: '2027-06-18' },
    ],
    status: 'open',
    note: '按 ASE 2026 周期推断。',
    noteEn: 'Projected from the ASE 2026 cycle.',
  },
  {
    confId: 'ase', edition: 'ASE 2026', year: 2026,
    confDate: '2026-10-12', location: '德国 慕尼黑', locationEn: 'Munich, Germany',
    deadlines: [
      { phase: '全文', phaseEn: 'Full paper', date: '2026-03-26' },
      { phase: '录用通知', phaseEn: 'Notification', date: '2026-06-18' },
    ],
    status: 'closed', link: 'https://conf.researchr.org/dates/ase-2026',
  },
  // ---------- 网络 ----------
  {
    confId: 'sigcomm', edition: 'SIGCOMM 2027', year: 2027,
    confDate: '2027-08-08', location: '泰国 曼谷', locationEn: 'Bangkok, Thailand',
    deadlines: [
      { phase: '全文', phaseEn: 'Full paper', date: '2027-02-06' },
      { phase: '录用通知', phaseEn: 'Notification', date: '2027-05-11' },
    ],
    status: 'open', link: 'https://conferences.sigcomm.org/sigcomm/2027/cfp/',
    note: '会议日期官方确认；截稿按 2026 届单轮制推断（摘要约 1 月底）。',
    noteEn: 'Conference dates officially confirmed; the deadline is projected from the 2026 single-round cycle (abstract around late January).',
  },
  {
    confId: 'qunet', edition: 'QuNet 2027 @ SIGCOMM', year: 2027,
    confDate: '2027-08-17', location: '泰国 曼谷', locationEn: 'Bangkok, Thailand',
    deadlines: [
      { phase: '全文', phaseEn: 'Full paper', date: '2027-05-28' },
      { phase: '录用通知', phaseEn: 'Notification', date: '2027-06-20' },
    ],
    status: 'open', link: 'https://conferences.sigcomm.org/sigcomm/2027/cfp/',
    note: '量子网络方向固定 workshop；按 QuNet 2026 周期推断。',
    noteEn: 'A recurring quantum-networking workshop; projected from the QuNet 2026 cycle.',
  },
  {
    confId: 'infocom', edition: 'INFOCOM 2027', year: 2027,
    confDate: '2027-05-24', location: '美国 檀香山', locationEn: 'Honolulu, HI, USA',
    deadlines: [
      { phase: '摘要', phaseEn: 'Abstract', date: '2026-07-24' },
      { phase: '全文', phaseEn: 'Full paper', date: '2026-07-31' },
      { phase: '录用通知', phaseEn: 'Notification', date: '2026-12-08' },
    ],
    status: 'closed', link: 'https://www.ieee-infocom.org/',
  },
];

// CCF 2026 第七版目录变化（MD 第 1 节）——up: true 升 / false 降 / null 修正或新入选
export const CCF_CHANGES: { name: string; old: string; new: string; up: boolean | null; note: string; noteEn: string }[] = [
  {
    name: 'ISCAS', old: 'C（2022）', new: 'B（2026）', up: true,
    note: '体系结构/并行与分布/存储类升 B；ISCAS 2027 目标会议含金量上升，CCF 体系内认可度提高。',
    noteEn: 'Promoted to B under architecture/parallel-and-distributed/storage; the ISCAS 2027 target venue rises in standing within CCF.',
  },
  {
    name: 'ACM TQC', old: '不在目录', new: 'C 类期刊（计算机科学理论）', up: null,
    note: '量子计算首次有期刊进入 CCF 目录。',
    noteEn: 'The first quantum-computing journal admitted to the CCF list.',
  },
  {
    name: 'HPDC', old: 'B', new: 'A', up: true,
    note: '高性能并行与分布式计算会议升 A。',
    noteEn: 'The high-performance parallel and distributed computing conference moves up to A.',
  },
  {
    name: 'FMCAD', old: 'C', new: 'B', up: true,
    note: '量子形式化验证方向受益。',
    noteEn: 'A gain for quantum formal verification.',
  },
  {
    name: 'FSE', old: 'B', new: 'A', up: true,
    note: '软件工程会议升 A。',
    noteEn: 'The software-engineering conference moves up to A.',
  },
  {
    name: 'IJCAI', old: 'A', new: 'B', up: false,
    note: '人工智能会议降 B。',
    noteEn: 'The AI conference drops to B.',
  },
  {
    name: 'Bioinformatics', old: 'B', new: 'A', up: true,
    note: '期刊升 A。',
    noteEn: 'The journal moves up to A.',
  },
  {
    name: 'TMM', old: 'B', new: 'A', up: true,
    note: 'IEEE Transactions on Multimedia 升 A。',
    noteEn: 'IEEE Transactions on Multimedia moves up to A.',
  },
  {
    name: 'TNSM', old: 'C（两版一致）', new: 'C', up: null,
    note: '初版指南误标 B，此处修正为 C。',
    noteEn: 'An early draft mislabelled it B; corrected to C here.',
  },
  {
    name: 'IEEE CAL', old: 'B（初版误标）', new: '不在目录', up: null,
    note: '明确不在 CCF 目录，修正初版错误。',
    noteEn: 'Explicitly outside the CCF list; an early draft error corrected.',
  },
  {
    name: 'IEEE Micro', old: 'B（初版误标）', new: '不在目录', up: null,
    note: '明确不在 CCF 目录，修正初版错误。',
    noteEn: 'Explicitly outside the CCF list; an early draft error corrected.',
  },
  {
    name: 'IEEE Design & Test', old: 'B（初版误标）', new: '不在目录', up: null,
    note: '明确不在 CCF 目录，修正初版错误。',
    noteEn: 'Explicitly outside the CCF list; an early draft error corrected.',
  },
];

// 按论文类型选投稿目标（MD 第 2 节）
export const TYPE_TARGETS: { type: string; typeEn: string; first: string; second: string }[] = [
  {
    type: '量子测控硬件（低温 CMOS、微波链路、读出电路）', typeEn: 'Quantum control hardware (cryo-CMOS, microwave links, readout circuits)',
    first: 'JSSC / T-MTT / TCAS-I / JETCAS', second: 'TQE、QST、TIM、ISCAS（已升 CCF-B）',
  },
  {
    type: '量子计算机体系结构（控制栈、qubit mapping、架构）', typeEn: 'Quantum computer architecture (control stack, qubit mapping, architecture)',
    first: 'ISCA / MICRO / HPCA / ASPLOS', second: 'TC、TCAD、TQE、ACM TQC（CCF-C，IF 高）',
  },
  {
    type: '量子 EDA（布局布线、编译、综合）', typeEn: 'Quantum EDA (placement & routing, compilation, synthesis)',
    first: 'DAC / TCAD', second: 'ICCAD、DATE、TODAES（CCF-B 期刊）',
  },
  {
    type: '量子软件 / 编译 / 验证', typeEn: 'Quantum software, compilation and verification',
    first: 'PLDI / OOPSLA / ASE / ICSE / FSE', second: 'ACM TQC、TQE、TSE、TOSEM',
  },
  {
    type: '量子网络 / 量子互联网', typeEn: 'Quantum networking / quantum internet',
    first: 'INFOCOM / SIGCOMM', second: 'JSAC、ToN（IEEE TON）、npj QI',
  },
  {
    type: '量子物理 / 器件高影响力', typeEn: 'High-impact quantum physics / devices',
    first: 'Nature 系 / PRX', second: 'PRX Quantum、npj QI',
  },
  {
    type: '量子信息理论与应用（均衡型）', typeEn: 'Quantum information theory and applications (balanced)',
    first: 'PRX Quantum / QST / npj QI', second: 'TQE、Quantum、EPJ QT、PR Applied',
  },
  {
    type: '综述', typeEn: 'Review articles',
    first: 'Nature Reviews Physics（IF 39.5）', second: 'TQE、QST、IEEE COMST',
  },
];

// 声誉梯队总表（MD 第 11 节）
export const TIERS: { title: string; titleEn: string; lines: string[] }[] = [
  {
    title: '量子专业期刊', titleEn: 'Quantum-specialist journals',
    lines: [
      'T0（里程碑）: Nature, Science, Nature Electronics（芯片级）',
      'T1（顶级）  : PRX Quantum (IF 11.0), npj QI (8.3)',
      'T2（主力）  : ACM TQC (6.8, CCF-C), QST (5.0), EPJ QT (5.6), Quantum (5.4)',
      'T3（专业）  : IEEE TQE (4.6), JSTQE (5.1), AQT (4.3), QMI (4.4)',
      'T4（细分）  : AVS QS (3.0), QIP (2.2), IJQI (0.8)',
    ],
  },
  {
    title: 'CS 会议（量子架构 / EDA / 软工 / 网络可投，CCF 2026）',
    titleEn: 'CS conferences (quantum architecture / EDA / software / networking, CCF 2026)',
    lines: [
      'A 类: ISCA, MICRO, HPCA, ASPLOS, DAC, SC, PPoPP, FAST, ATC, EuroSys, HPDC(↑),',
      '      ASE, ICSE, FSE(↑), PLDI, OOPSLA, INFOCOM, SIGCOMM',
      'B 类: ICCAD, DATE, ISCAS(↑⭐), FMCAD(↑), CGO, FPGA, PACT, ICPP, IPDPS',
      'C 类: ASP-DAC, VEE, NAS 等',
    ],
  },
  {
    title: '电路 / 测控（不在 CCF，按领域声誉）', titleEn: 'Circuits / instrumentation (outside CCF; ranked by field reputation)',
    lines: [
      'T1: ISSCC, JSSC',
      'T2: T-MTT, TCAS-I, TIM, JETCAS, RFIC, CICC',
      'T3: TCAS-II, MWTL, ISCAS(CCF-B⭐), ESSCIRC',
      'T4: RSI(已降至4区), Cryogenics, TAS',
    ],
  },
];

// 投稿策略（MD 第 12 节，措辞去个人化）
export const STRATEGY: { title: string; titleEn: string; body: string; bodyEn: string }[] = [
  {
    title: 'ISCAS 2027 短文（4 页）', titleEn: 'ISCAS 2027 short paper (4 pages)',
    body: '会议已升 CCF-B，性价比提高；适合量子测控方向作为阶段性成果首发。',
    bodyEn: 'The conference is now CCF-B, improving the return; a good first outing for interim results in quantum control and instrumentation.',
  },
  {
    title: '测控芯片 / 系统完整工作', titleEn: 'Complete control-chip / control-system results',
    body: '冲高：ISSCC → JSSC 扩展（注意 IEEE 会议 → 期刊扩展查重要求 ≥30% 新内容）；稳投：TCAS-I / TIM / T-MTT（均工程 2区 Top，IF 4.5–5.9）；量子圈可见度：TQE（审稿 ~13 周、APC $1,995、工程导向，但为 ESCI、未被 2025 中科院分区表收录，如单位要求分区请先确认口径）或 QST（物理 1区 Top，IOP 官网口径首轮 53 天）。',
    bodyEn: 'Reach high: ISSCC, then a JSSC extension (note IEEE conference-to-journal extensions require ≥30% new content). Steady: TCAS-I / TIM / T-MTT (all Engineering tier-2 Top, IF 4.5–5.9). Visibility in the quantum community: TQE (~13-week review, $1,995 APC, engineering-oriented — but ESCI and not covered by the 2025 CAS partition list, so confirm the rules if your institution requires a partition) or QST (Physics tier-1 Top, 53-day first decision per the IOP site).',
  },
  {
    title: '测控 + 架构交叉（低温控制器架构、控制栈）', titleEn: 'Control + architecture crossover (cryo-controller architecture, control stack)',
    body: '先投 ISCA / MICRO / HPCA / ASPLOS，再以 TC / TCAD 稳投。',
    bodyEn: 'Target ISCA / MICRO / HPCA / ASPLOS first, then fall back to TC / TCAD.',
  },
  {
    title: 'APC 预算敏感时', titleEn: 'When the APC budget is tight',
    body: 'Quantum（€450）< TQE（$1,995）< EPJ QT（~$1,990）< PRXQ（$3,450）< npj QI（$4,090）；QST / AQT 为混合刊，可走订阅模式零 APC。',
    bodyEn: 'Quantum (€450) < TQE ($1,995) < EPJ QT (~$1,990) < PRXQ ($3,450) < npj QI ($4,090); QST and AQT are hybrid, so the subscription route means zero APC.',
  },
  {
    title: '规避', titleEn: 'Avoid',
    body: 'IJQI（IF 0.8、网友报告审稿长达 24 个月）；RSI 已跌至工程 4区（除非方法学严格对口）。',
    bodyEn: 'IJQI (IF 0.8 and user-reported reviews of up to 24 months); RSI has fallen to Engineering tier 4 (unless the work is a strict methodological fit).',
  },
];

export const VENUE_COUNTS = {
  journals: JOURNALS.length,
  confs: CONFS.length,
};

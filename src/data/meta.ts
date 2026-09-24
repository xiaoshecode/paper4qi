// 站点共享元数据：分类、来源、导航
export interface Category {
  key: string;
  zh: string;
  en: string;
  blurb: string;
}

export const CATEGORIES: Category[] = [
  { key: 'QEC', zh: '量子纠错与容错计算', en: 'Error Correction & Fault Tolerance', blurb: '表面码、LDPC、玻色码、解码器、容错架构' },
  { key: 'ALG', zh: '量子算法与应用', en: 'Algorithms & Applications', blurb: 'VQE/QAOA、量子模拟、优化、化学、金融' },
  { key: 'ARCH', zh: '体系结构、编译与基准测试', en: 'Architecture, Compilation & Benchmarking', blurb: '编译器、调度、模拟器、基准协议、验证' },
  { key: 'COMM', zh: '量子通信与网络', en: 'Communication & Networks', blurb: 'QKD、量子互联网、中继、纠缠分发' },
  { key: 'QML', zh: '量子机器学习', en: 'Quantum Machine Learning', blurb: '量子神经网络、核方法、生成模型' },
  { key: 'SUP', zh: '超导量子硬件', en: 'Superconducting Hardware', blurb: 'transmon、fluxonium、约瑟夫森结、腔' },
  { key: 'PLAT', zh: '自旋/离子阱/中性原子等平台', en: 'Spin / Trapped-Ion / Neutral-Atom Platforms', blurb: '量子点、离子阱、里德伯、NV 色心' },
  { key: 'PHOT', zh: '量子光子学与光学器件', en: 'Photonics & Optical Devices', blurb: '单光子源/探测器、集成光子学、连续变量' },
  { key: 'SENS', zh: '量子传感与计量', en: 'Sensing & Metrology', blurb: '磁力计、原子钟、量子增强测量' },
  { key: 'CRYO', zh: '低温电子学与量子测控', en: 'Cryogenic Electronics & Control', blurb: 'cryo-CMOS、SFQ、测控链路、读出' },
  { key: 'MAT', zh: '量子材料与器件工艺', en: 'Materials & Fabrication', blurb: '薄膜、损耗、工艺、3D 集成封装' },
  { key: 'REV', zh: '综述与路线图', en: 'Reviews & Roadmaps', blurb: '综述、教程、路线图、展望' },
  { key: 'OTHER', zh: '其他', en: 'Other', blurb: '教育科普及未归上述类别者' },
];

export const CAT_ZH: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.zh]));

export const SOURCES = {
  qce: {
    id: 'qce',
    name: 'IEEE QCE',
    full: 'IEEE International Conference on Quantum Computing and Engineering',
    zh: 'IEEE 量子计算与工程国际会议（IEEE Quantum Week）',
    years: '2020–2026',
    home: 'https://qce.quantum.ieee.org/',
  },
  tqe: {
    id: 'tqe',
    name: 'IEEE TQE',
    full: 'IEEE Transactions on Quantum Engineering',
    zh: 'IEEE 量子工程汇刊',
    years: '2020–2026（Vol. 1–7）',
    home: 'https://tqe.ieee.org/',
  },
} as const;

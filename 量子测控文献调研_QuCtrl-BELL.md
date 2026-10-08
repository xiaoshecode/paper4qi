# 量子测控与 QuCtrl-BELL 主题文献调研报告

> **调研日期**：2026-09-29
> **调研主题**：量子测控（量子计算测控系统、低温电子学、量子计算机体系结构）+ **QuCtrl-BELL**（编译器驱动的亚微秒反馈控制栈，面向可扩展囚禁离子量子实验）同主题文献
> **覆盖范围**：以《提示词_量子期刊会议调研.md》所列 venue 名录（A–H 八大类）为清单，逐一检索各期刊/会议上的相关文献，**不重不漏**；本地已有 TQE（465 条）与 QCE（1674 条）全目录，逐条筛选；其余 venue 通过联网检索（Google Scholar / DBLP / arXiv / 出版社官网）核实。
> **数据可信度约定**：arXiv/DOI 链接可直接核实的条目为**已核实**；仅有第三方检索结果、卷期页码未逐项核对的标注 ⚠；明确检索但未找到相关文献的 venue 列出查询词备查。
> **配套文件**：本报告的阅读版为同目录 `量子测控文献调研_QuCtrl-BELL.html`（侧栏目录 + 全文搜索 + 宽表横向滚动），由 `tools/build_report_html.mjs` 自动生成；修改本文后重跑该脚本即可同步，**请只编辑本 `.md` 文件**。

## 阅读指南

| 章节 | 内容 | 组织方式 |
|---|---|---|
| §0 | QuCtrl-BELL 本体核实（arXiv:2605.22433） | 单篇论文的技术要素 |
| §1 | 本地 TQE / QCE 全目录筛选结果 | 逐条筛选，覆盖率最高（TQE 465 条、QCE 1674 条） |
| §2–§7 | 其余 venue 按**学科类别**分组（体系结构 / 电路 / 量子期刊 / EDA / 软工 / 网络与仪器） | 与提示词的 A–H 分类对应，便于按投稿方向查阅 |
| §8 | 结论：按 QuCtrl-BELL 的四个技术层重新归位的文献地图 + 覆盖度边界 | 跨类别的横向索引 |

> **关于重复**：§2–§7 按 venue 类别组织，而少数 venue 天然横跨多类（如 **IEEE TCAD** 同时属"体系结构"与"EDA"、**RSI/TIM/TAS** 同时属"电路"与"仪器"）。因此 TCAD 条目在 §2.5 与 §5.6、仪器类期刊在 §3.4 与 §7.4 各出现一次，视角不同（前者是期刊视角、后者是检索来源视角），**内容互补而非冗余**；若只关心某一 venue，直接查其"主章节"即可。§8.3 列出了每个 venue 类别的检索方式与置信度。

---

## 0. QuCtrl-BELL 论文本体核实

| 项目 | 内容 |
|---|---|
| 标题 | QuCtrl-BELL: A Compiler-Driven Sub-Microsecond Feedback Control Stack for Scalable Trapped-Ion Quantum Experiments |
| 作者 | Junpeng She, Ruoyu Yan, Zhizhen Qin, Zhanyu Li, Zhongtao Shen, Zichao Zhou, Binxiang Qi, **Luming Duan（段路明，通讯）** |
| arXiv | [arXiv:2605.22433](https://arxiv.org/abs/2605.22433)，2026-05-21 提交（v1），quant-ph（主）/ cs.PL / eess.SY |
| 发表状态 | 截至检索日为预印本，Comments 仅注 "7 pages, 6 figures"，**未标注任何会议/期刊接收**（是否已投 QCE/ASPLOS/TQE 等待核实） |

**技术要点**（据 arXiv 摘要与评述页）：
- **核心思想**：编译器驱动的离子阱控制软件栈，把**控制流（循环/分支/同步）与硬件状态数据解耦**。
- **前端**：Python 嵌入式 DSL（channel/sequence/variable 三层抽象，含 `loop`、`if_else`、`while`、`barrier`、`wait/resume`、`read_ttl`）。
- **中端**：六阶段转译流水线——节点树 → 控制流图(CFG) → SSA → 活跃性分析 → 图着色寄存器分配 → 后端汇编 + step-table 编码。
- **后端**：确定性分布式板级程序 + 紧凑 step-table（DDS 频率/幅度/相位、TTL 掩码按索引引用）；序列内存占用相比静态展开降低 **20×–1000×**；编译开销 <4 ms。
- **关键指标**：**反馈延迟 <700 ns（实测 ≈690 ns，无主机介入）**；跨板同步 <100 ns（step-table 对齐 + TCM 星型广播）；`read_ttl` 编译为固定四阶段协议（Barrier→TTL Read→TCM Broadcast→Branch Resolve）。
- **平台**：自研 QuCtrl-BELL 硬件（RISC-V + PXIe，9 槽 JYTEK 机箱，DDS/AWG + TTL/TDC 板 + Trigger Clock Manager），单机箱 24 路 RF / 32 路数字 IO，每板本地 RISC-V 核、250 MHz / 4 ns 步进。
- **对比对象**：ARTIQ/Sinara、QubiC、QICK、TITAN——作者主张 Bell 是唯一同时具备"完整静态编译流水线 + 严格控制/数据分离 + <700 ns 反馈"的离子阱控制栈；自承局限是每次反馈事件固定 ~700 ns 开销，可能成为多轮 QEC 瓶颈。

**由 QuCtrl-BELL 界定的文献主题簇**（本报告的检索口径）：
1. 编译器驱动/脉冲级量子控制（DSL、ISA、脉冲 IR、控制流编译）
2. 亚微秒/低延迟实时反馈与前馈（mid-circuit measurement、动态电路、条件操作）
3. 囚禁离子控制系统与 QCCD 架构（ARTIQ/Sinara、电极 DAC、shuttling 控制与编译）
4. 量子纠错实时译码硬件（FPGA/ASIC decoder、译码-反馈延迟）
5. FPGA/RFSoC 室温控制器（QubiC、QICK、Presto 等开源平台）
6. 低温控制电子学（cryo-CMOS、SFQ/RSFQ）
7. 读出与状态判别（IQ 判别、ML 分类器）
8. 控制栈系统软件与运行时、自动校准

---

## 1. 本地全目录筛选结果（已核实，100% 覆盖）

### 1.1 IEEE TQE（2020–2026，全目录 465 条中筛出测控相关 43 条）

> 来源：本地 `TQE_papers.md`（Crossref+OpenAlex+S2/arXiv 三源合并，含全部卷期）。按相关性排序摘录；★ 为与 QuCtrl-BELL 主题最直接相关。

**控制系统与反馈（核心）**

| 年份 | 论文 | DOI | 关联 |
|---|---|---|---|
| 2021 | ★ QubiC: An Open-Source FPGA-Based Control and Measurement System for Superconducting Quantum Information Processors | [10.1109/TQE.2021.3116540](https://doi.org/10.1109/tqe.2021.3116540) | LBNL 开源 FPGA 控制与测量系统，QubiC 系列首篇 |
| 2023 | ★ Design and Analysis of Digital Communication Within an SoC-Based Control System for Trapped-Ion Quantum Computing | [10.1109/TQE.2023.3238670](https://doi.org/10.1109/tqe.2023.3238670) | **离子阱 SoC 控制系统片内数字通信设计**——与 Bell 的板间 TCM 广播直接可比 |
| 2024 | ★ FASQuiC: Flexible Architecture for Scalable Spin Qubit Control | [10.1109/TQE.2024.3409811](https://doi.org/10.1109/tqe.2024.3409811) | 可扩展自旋比特控制架构 |
| 2022 | Timing Constraints Imposed by Classical Digital Control Systems on Photonic Implementations of MBQC | [10.1109/TQE.2022.3175587](https://doi.org/10.1109/tqe.2022.3175587) | 经典数字控制系统的时序约束分析（MBQC 场景） |
| 2023 | Enabling Efficient Real-Time Calibration on Cloud Quantum Machines | [10.1109/TQE.2023.3276970](https://doi.org/10.1109/tqe.2023.3276970) | 云量子机实时校准 |
| 2025 | Fast State Stabilization Using Deep Reinforcement Learning for Measurement-Based Quantum Feedback Control | [10.1109/TQE.2025.3606123](https://doi.org/10.1109/tqe.2025.3606123) | 测量反馈控制的 RL 加速态稳定 |
| 2025 | End-to-End Workflow for Machine-Learning-Based Qubit Readout With QICK and hls4ml | [10.1109/TQE.2025.3604712](https://doi.org/10.1109/tqe.2025.3604712) | QICK+hls4ml 的 ML 读出工作流 |
| 2026 | A Survey of Microwave-Implemented Superconducting Qubit Control and Readout Circuits | [10.1109/TQE.2026.3659400](https://doi.org/10.1109/tqe.2026.3659400) | **超导比特微波测控电路综述**——测控电路方向的文献入口 |

**离子阱/QCCD/搬运编译**

| 年份 | 论文 | DOI | 关联 |
|---|---|---|---|
| 2024 | ★ Advanced Shuttle Strategies for Parallel QCCD Architectures | [10.1109/TQE.2024.3408757](https://doi.org/10.1109/tqe.2024.3408757) | 并行 QCCD 架构搬运策略 |
| 2025 | ★ Quantum Circuit Compilation for Trapped-Ion Processors With the Drive-Through Architecture | [10.1109/TQE.2025.3548423](https://doi.org/10.1109/tqe.2025.3548423) | Drive-Through 离子阱架构编译 |
| 2026 | ★ Hardware-Aware and Resource-Efficient Circuit Packing and Scheduling on Trapped-Ion Quantum Computers | [10.1109/TQE.2025.3632540](https://doi.org/10.1109/tqe.2025.3632540) | 离子阱硬件感知打包调度编译 |
| 2022 | High-Stability Cryogenic System for Quantum Computing With Compact Packaged Ion Traps | [10.1109/TQE.2021.3125926](https://doi.org/10.1109/tqe.2021.3125926) | 紧凑型封装离子阱低温系统 |
| 2022 | Stable Turnkey Laser System for a Yb/Ba Trapped-Ion Quantum Computer | [10.1109/TQE.2022.3195428](https://doi.org/10.1109/tqe.2022.3195428) | 离子阱激光系统工程化 |
| 2025 | Realization and Calibration of Continuously Parameterized Two-Qubit Gates on a Trapped-Ion Quantum Processor | [10.1109/TQE.2025.3600216](https://doi.org/10.1109/tqe.2025.3600216) | 离子阱连续参数双比特门校准 |
| 2026 | Multiplexed Bilayered Realization of Fault-Tolerant Quantum Computation Over Optically Networked Trapped-Ion Modules | [10.1109/TQE.2025.3649617](https://doi.org/10.1109/tqe.2025.3649617) | 光联网离子阱模块容错架构 |
| 2025 | Generating Shuttling Procedures for Constrained Silicon Quantum Dot Array | [10.1109/TQE.2025.3542462](https://doi.org/10.1109/tqe.2025.3542462) | 硅量子点阵列搬运程序生成（与 QCCD 同类问题） |
| 2026 | ZAP: Zoned Architecture and Performant Compiler for Field-Programmable Atom Array | [10.1109/TQE.2026.3696707](https://doi.org/10.1109/tqe.2026.3696707) | 中性原子阵列分区架构与编译器（对照平台） |

**低温电子学与 SFQ**

| 年份 | 论文 | DOI | 关联 |
|---|---|---|---|
| 2021 | Cryogenic Floating-Gate CMOS Circuits for Quantum Control | [10.1109/TQE.2021.3067996](https://doi.org/10.1109/tqe.2021.3067996) | 低温浮栅 CMOS 量子控制电路 |
| 2023 | Cryogenic Embedded System to Support Quantum Computing: From 5-nm FinFET to Full Processor | [10.1109/TQE.2023.3300833](https://doi.org/10.1109/tqe.2023.3300833) | 5nm FinFET 低温嵌入式系统全栈 |
| 2025 | Cryo-CMOS Bias-Voltage Generation and Demultiplexing at mK Temperatures for Large-Scale Arrays of Quantum Devices | [10.1109/TQE.2025.3580377](https://doi.org/10.1109/tqe.2025.3580377) | mK 温区 cryo-CMOS 偏置生成与解复用 |
| 2025 | Control of a Josephson Digital Phase Detector via an SFQ-Based Flux Bias Driver | [10.1109/TQE.2025.3583570](https://doi.org/10.1109/tqe.2025.3583570) | SFQ 磁通偏置驱动控制 |
| 2025 | RSFQ All-Digital Programmable Multitone Generator for Quantum Applications | [10.1109/TQE.2024.3520805](https://doi.org/10.1109/tqe.2024.3520805) | RSFQ 全数字可编程多音发生器 |
| 2025 | C3-VQA: Cryogenic Counter-Based Coprocessor for Variational Quantum Algorithms | [10.1109/TQE.2024.3521442](https://doi.org/10.1109/tqe.2024.3521442) | 低温计数协处理器 |

**读出/译码/ISA 与基准**

| 年份 | 论文 | DOI | 关联 |
|---|---|---|---|
| 2020 | Enhancing a Near-Term Quantum Accelerator's Instruction Set Architecture for Materials Science Applications | [10.1109/TQE.2020.2965810](https://doi.org/10.1109/tqe.2020.2965810) | 量子加速器 ISA 增强（控制指令集方向） |
| 2022 | Neural-Network Decoders for QEC Using Surface Codes: Hardware Cost-Performance Tradeoffs | [10.1109/TQE.2022.3174017](https://doi.org/10.1109/tqe.2022.3174017) | 神经网络译码器硬件代价-性能空间探索 |
| 2024 | FPGA-Based Distributed Union-Find Decoder for Surface Codes | [10.1109/TQE.2024.3467271](https://doi.org/10.1109/tqe.2024.3467271) | FPGA 分布式 Union-Find 译码器 |
| 2024 | Convolutional Neural Decoder for Surface Codes | [10.1109/TQE.2024.3419773](https://doi.org/10.1109/tqe.2024.3419773) | 卷积神经网络表面码译码器 |
| 2024 | Modeling and Experimental Validation of the Intrinsic SNR in Spin Qubit Gate-Based Readout and Its Impacts on Readout Electronics | [10.1109/TQE.2024.3385673](https://doi.org/10.1109/tqe.2024.3385673) | 自旋比特读出 SNR 对读出电子学的要求 |
| 2022 | Effects of Dynamical Decoupling and Pulse-Level Optimizations on IBM Quantum Computers | [10.1109/TQE.2022.3203153](https://doi.org/10.1109/tqe.2022.3203153) | 脉冲级优化效果实测 |
| 2026 | Erasure-Tolerance Scheme for the Surface Codes on Neutral Atom Quantum Computers | [10.1109/TQE.2025.3627918](https://doi.org/10.1109/tqe.2025.3627918) | 中性原子擦除容忍表面码（对照平台反馈） |
| 2026 | Dissipative Feedback and Hybrid Lyapunov–Reinforcement Learning Control for NV-Center Quantum Sensing | [10.1109/TQE.2026.3724318](https://doi.org/10.1109/tqe.2026.3724318) | NV 色心耗散反馈控制 |

（其余纯译码算法、纯基准测试类条目略；完整 43 条见本地提取中间文件。）

### 1.2 IEEE QCE（2020–2026，全目录 1674 条中筛出测控相关约 100 条）

> 来源：本地 `QCE_papers.md`（2020–2025 正式论文 + 2026 官方日程）。QCE 是与 QuCtrl-BELL 主题重合度最高的会议，单独按子主题归类。★ 为与 Bell 主题最直接相关。

#### (a) 控制系统与控制栈（QubiC/ARTIQ/SoC 等）

| 年份 | 论文 | 链接 | 关联 |
|---|---|---|---|
| 2022 | Modular software for real-time quantum control systems | [10.1109/QCE53715.2022.00077](https://doi.org/10.1109/qce53715.2022.00077) | 实时量子控制系统的模块化软件 |
| 2022 | Functional simulation of real-time quantum control software | [10.1109/QCE53715.2022.00076](https://doi.org/10.1109/qce53715.2022.00076) | 实时控制软件的功能仿真 |
| 2022 | Distributed Processor for FPGA-based Superconducting Qubit Control | [10.1109/QCE53715.2022.00109](https://doi.org/10.1109/qce53715.2022.00109) | FPGA 分布式控制处理器 |
| 2022 | Latest developments in the Sinara open hardware ecosystem | [10.1109/QCE53715.2022.00123](https://doi.org/10.1109/qce53715.2022.00123) | Sinara（ARTIQ 硬件底座）生态进展 |
| 2023 | ★ QubiC 2.0: A Flexible Advanced Full Stack Quantum Bit Control System | [10.1109/QCE57702.2023.10227](https://doi.org/10.1109/qce57702.2023.10227) | QubiC 2.0 全栈控制系统（支持 MCM 与前馈） |
| 2023 | ★ Sinara and ARTIQ: Open-Source Ion-Trapping Control System | [10.1109/QCE57702.2023.10249](https://doi.org/10.1109/qce57702.2023.10249) | **Bell 的头号对比对象：ARTIQ/Sinara 离子阱控制系统** |
| 2024 | ★ Updated QubiC: Improved Scalability, Performance, and QPU Support | [10.1109/QCE60285.2024.10430](https://doi.org/10.1109/qce60285.2024.10430) | QubiC 扩展性/性能更新 |
| 2024 | The Quantum Interface Controller: A Full-Stack, Modular, and Scalable System for Qubit Readout and Manipulation | [10.1109/QCE60285.2024.10358](https://doi.org/10.1109/qce60285.2024.10358) | 全栈模块化量子接口控制器 |
| 2024 | An FPGA-based Quantum Control System with a Runtime Configurable Signal Generator | [10.1109/QCE60285.2024.10412](https://doi.org/10.1109/qce60285.2024.10412) | 运行时可重构信号发生器 FPGA 控制系统 |
| 2024 | Scalable Room Temperature Control Electronics for Advanced High-Fidelity Qubit Control | [10.1109/QCE60285.2024.10320](https://doi.org/10.1109/qce60285.2024.10320) | 可扩展室温控制电子学 |
| 2024 | Preliminary Design Space Exploration for ASIC Implementation of Control Systems in FTQC | [10.1109/QCE60285.2024.10437](https://doi.org/10.1109/qce60285.2024.10437) | 容错量子计算机控制系统 ASIC 化设计空间 |
| 2024 | System-Agnostic Quantum Pulse Experiments Implemented with ARTIQ | [10.1109/QCE60285.2024.10422](https://doi.org/10.1109/qce60285.2024.10422) | 基于 ARTIQ 的系统无关脉冲实验 |
| 2021 | Open-source multi-channel Smart Arbitrary Waveform Generators (SAWG) for QIP | [10.1109/QCE52317.2021.00070](https://doi.org/10.1109/qce52317.2021.00070) | 开源多通道 AWG |
| 2021 | A low-noise and scalable FPGA-based analog signal generator for quantum gas experiments | [10.1109/QCE52317.2021.00073](https://doi.org/10.1109/qce52317.2021.00073) | 低噪声 FPGA 模拟信号发生器 |
| 2024 | Mixerless RFSoC Microwave Signal Generation for Superconducting Circuit Applications | [10.1109/QCE60285.2024.10407](https://doi.org/10.1109/qce60285.2024.10407) | 免混频器 RFSoC 微波直合成 |
| 2024 | Super Heterodyne Mixer Front-End Module for Qubit Readout and Manipulation | [10.1109/QCE60285.2024.10408](https://doi.org/10.1109/qce60285.2024.10408) | 超外差读出前端模块 |

#### (b) 离子阱控制与 QCCD/搬运编译（Bell 的直接对标群）

| 年份 | 论文 | 链接 | 关联 |
|---|---|---|---|
| 2022 | Benchmarking and Analysis of Noisy Intermediate-Scale Trapped Ion Quantum Computing Architectures | [10.1109/QCE53715.2022.00044](https://doi.org/10.1109/qce53715.2022.00044) | 离子阱架构基准分析 |
| 2022 | Fast Loading of a Trapped Ion Quantum Computer Using a 2D Magneto-Optical Trap | [10.1109/QCE53715.2022.00050](https://doi.org/10.1109/qce53715.2022.00050) | 离子快速装载 |
| 2022 | Optical Crosstalk Mitigation for Individual Addressing in a Cryogenic Ion Trap | [10.1109/QCE53715.2022.00129](https://doi.org/10.1109/qce53715.2022.00129) | 低温离子阱独立寻址光串扰抑制 |
| 2023 | ★ Control Infrastructure for Near-Term Long-Chain QCCD | [10.1109/QCE57702.2023.10280](https://doi.org/10.1109/qce57702.2023.10280) | 长链 QCCD 控制基础设施 |
| 2023 | QisDAX: An Open Source Bridge from Qiskit to Trapped-Ion Quantum Devices | [10.1109/QCE57702.2023.00097](https://doi.org/10.1109/qce57702.2023.00097) | Qiskit→离子阱设备开源桥（ARTIQ 路线） |
| 2024 | ★ A Microwave-Based QCCD Trapped-Ion Quantum Computer with Scalable Control System | [10.1109/QCE60285.2024.10360](https://doi.org/10.1109/qce60285.2024.10360) | **微波 QCCD + 可扩展控制系统**（IEEE1588 同步、sub-μs 电压切换） |
| 2024 | ★ Shuttling Compiler for a Trapped-Ion Quantum Computer Architecture with Junctions | [10.1109/QCE60285.2024.00126](https://doi.org/10.1109/qce60285.2024.00126) | 带结点的离子阱架构搬运编译器 |
| 2024 | ★ Using Compiler Frameworks for the Evaluation of Hardware Design Choices in Trapped-Ion Quantum Computers | [10.1109/QCE60285.2024.00129](https://doi.org/10.1109/qce60285.2024.00129) | 用编译器框架评估离子阱硬件设计取舍 |
| 2024 | Scaling and Assigning Resources on ION Trap QCCD Architectures | [10.1109/QCE60285.2024.00115](https://doi.org/10.1109/qce60285.2024.00115) | QCCD 资源伸缩与分配 |
| 2025 | Quantum Circuit Compilation for Small Scale Trapped Ion Quantum Computer | [10.1109/QCE65121.2025.10381](https://doi.org/10.1109/qce65121.2025.10381) | 小规模离子阱电路编译 |
| 2025 | ★ Orchestrating Multi-Zone Shuttling in Trapped-Ion Quantum Computers | [10.1109/QCE65121.2025.00119](https://doi.org/10.1109/qce65121.2025.00119) | 多区搬运编排 |
| 2025 | ★ Multiplexed Control at Scale for Electrode Arrays in Trapped-Ion Quantum Processors | [10.1109/QCE65121.2025.00150](https://doi.org/10.1109/qce65121.2025.00150) | **离子阱电极阵列规模化复用控制** |
| 2025 | ★ High Output SoC-Based Ion Shuttling Waveform Generator Using Cubic Splines | [10.1109/QCE65121.2025.00149](https://doi.org/10.1109/qce65121.2025.00149) | SoC 离子搬运波形发生器（三次样条） |
| 2025 | Moveless: Minimizing QEC Overhead on QCCDs via Versatile Execution and Low Excess Shuttling | [10.1109/QCE65121.2025.00075](https://doi.org/10.1109/qce65121.2025.00075) | 减少 QCCD 搬运的 QEC 开销 |
| 2025 | Scaling Up Trapped-Ion Quantum Processors with Integrated Photonics | [10.1109/QCE65121.2025.10387](https://doi.org/10.1109/qce65121.2025.10387) | 集成光子学扩展离子阱 |

#### (c) 实时反馈、mid-circuit measurement 与读出判别

| 年份 | 论文 | 链接 | 关联 |
|---|---|---|---|
| 2023 | Fast Quantum Gate Design with Deep Reinforcement Learning Using Real-Time Feedback on Readout Signals | [10.1109/QCE57702.2023.00146](https://doi.org/10.1109/qce57702.2023.00146) | 读出信号实时反馈的 RL 门设计 |
| 2023 | Feedback-Based Steering for Quantum State Preparation | [10.1109/QCE57702.2023.00148](https://doi.org/10.1109/qce57702.2023.00148) | 反馈式态制备 |
| 2023 | Improving SNR for Readout Signals Using Adaptive Filters on Reconfigurable Controls Hardware | [10.1109/QCE57702.2023.10303](https://doi.org/10.1109/qce57702.2023.10303) | 控制硬件上的自适应滤波提升读出 SNR |
| 2024 | ★ QubiCML: ML-Powered Real-Time Quantum State Discrimination Enabling Mid-Circuit Measurements | [10.1109/QCE60285.2024.10332](https://doi.org/10.1109/qce60285.2024.10332)（2025 复刊 [10428](https://doi.org/10.1109/qce65121.2025.10428)） | **ML 实时态判别使能 MCM（QubiC 团队）** |
| 2024 | Reducing Mid-Circuit Measurements via Probabilistic Circuits | [10.1109/QCE60285.2024.00114](https://doi.org/10.1109/qce60285.2024.00114) | 减少 MCM 需求的编译技术 |
| 2024 | Demonstrating the Potential of Adaptive LMS Filtering on FPGA-Based Qubit Control Platforms for Improved Qubit Readout | [10.1109/QCE60285.2024.00156](https://doi.org/10.1109/qce60285.2024.00156) | FPGA 控制平台 LMS 自适应滤波读出 |
| 2024 | Reducing the Error Rate of a Superconducting Logical Qubit using Analog Readout Information | [10.1109/QCE60285.2024.10316](https://doi.org/10.1109/qce60285.2024.10316) | 模拟读出信息降低逻辑比特错误 |
| 2025 | First Experience with Real-Time Control Using Simulated VQC-Based Quantum Policies | [10.1109/QCE65121.2025.10307](https://doi.org/10.1109/qce65121.2025.10307) | VQC 策略实时控制初体验 |
| 2025 | Robust Adaptive Quantum Feedback Under Practical Uncertainties | [10.1109/QCE65121.2025.10474](https://doi.org/10.1109/qce65121.2025.10474) | 实际不确定下的鲁棒自适应量子反馈 |
| 2025 | Real-Time DCZ Gate Control by Bayesian Optimization with Forgetting | [10.1109/QCE65121.2025.00151](https://doi.org/10.1109/qce65121.2025.00151) | 贝叶斯优化实时门控 |
| 2025 | Feedback Connections in Quantum Reservoir Computing with Mid-Circuit Measurements | [10.1109/QCE65121.2025.00182](https://doi.org/10.1109/qce65121.2025.00182) | MCM 反馈连接的量子储备池计算 |

#### (d) QEC 实时译码硬件

| 年份 | 论文 | 链接 | 关联 |
|---|---|---|---|
| 2023 | The Hitchhiker's Guide to FPGA-Accelerated Quantum Error Correction | [10.1109/QCE57702.2023.10271](https://doi.org/10.1109/qce57702.2023.10271) | FPGA 加速 QEC 指南 |
| 2023 | A Highly Efficient QEC Decoder Implemented on FPGA and ASIC | [10.1109/QCE57702.2023.10289](https://doi.org/10.1109/qce57702.2023.10289) | FPGA/ASIC 高效译码器 |
| 2023 | Scalable Quantum Error Correction for Surface Codes Using FPGA | [10.1109/QCE57702.2023.00106](https://doi.org/10.1109/qce57702.2023.00106) | 表面码 FPGA 可扩展译码 |
| 2023 | Fusion Blossom: Fast MWPM Decoders for QEC | [10.1109/QCE57702.2023.00107](https://doi.org/10.1109/qce57702.2023.00107) | 快速 MWPM 译码器（并行融合） |
| 2024 | Exploring Surface Code Decoding via Cryo-CMOS for Fault-Tolerant Quantum Computers | [10.1109/QCE60285.2024.10344](https://doi.org/10.1109/qce60285.2024.10344) | cryo-CMOS 表面码译码探索 |
| 2024 | Towards a Cryogenic CMOS-Memristor Neural Decoder for QEC | [10.1109/QCE60285.2024.00149](https://doi.org/10.1109/qce60285.2024.00149) | 低温 CMOS-忆阻神经译码器 |
| 2024 | Multi-FPGA System for Quantum Error Correction with Lattice Surgery | [10.1109/QCE60285.2024.10435](https://doi.org/10.1109/qce60285.2024.10435) | 晶格手术多 FPGA QEC 系统 |
| 2024 | Parallel Minimum-Weight Parity Factor Decoding for QEC | [10.1109/QCE60285.2024.10415](https://doi.org/10.1109/qce60285.2024.10415) | 并行 MWPF 译码 |
| 2025 | ★ A Real-Time Low-Latency Quantum Error Correction Stack: Deltaflow and Deltakit | [10.1109/QCE65121.2025.10454](https://doi.org/10.1109/qce65121.2025.10454) | **Riverlane 实时低延迟 QEC 栈**（与 Bell 的反馈栈定位最接近的产业系统） |
| 2025 | Quantifying the Gap Between FPGA and ASIC Implementations of a Surface Code Decoder | [10.1109/QCE65121.2025.10488](https://doi.org/10.1109/qce65121.2025.10488) | FPGA vs ASIC 译码器量化差距 |
| 2025 | A Scalable Real-Time Decoder for QEC Based on Hyperdimensional Computing | [10.1109/QCE65121.2025.00120](https://doi.org/10.1109/qce65121.2025.00120) | 超维计算实时译码器 |
| 2025 | Network-Integrated Decoding System for Real-Time QEC with Lattice Surgery | [10.1109/QCE65121.2025.00129](https://doi.org/10.1109/qce65121.2025.00129) | 网络集成实时译码系统 |
| 2025 | GridGenQ: Hardware Design Utility for Distributed Quantum Decoders | [10.1109/QCE65121.2025.10446](https://doi.org/10.1109/qce65121.2025.10446) | 分布式译码器硬件设计工具 |

#### (e) 低温电子学与 SFQ（QCE 上的电路向工作）

| 年份 | 论文 | 链接 | 关联 |
|---|---|---|---|
| 2022 | Fully-integrated data acquisition system operating at cryogenic temperature for semiconductor qubits | [10.1109/QCE53715.2022.00118](https://doi.org/10.1109/qce53715.2022.00118) | 半导体比特低温集成采集系统 |
| 2024 | A Power Reduction Scheme by Arithmetic Format Conversion for a DSP to Estimate Qubit States Under 4K Cryogenic Environment | [10.1109/QCE60285.2024.10394](https://doi.org/10.1109/qce60285.2024.10394) | 4K 环境比特态估计 DSP 降功耗 |
| 2024 | Cryogenic Characterization of a 5–6 GHz LC VCO for CMOS-Quantum Co-Integration | [10.1109/QCE60285.2024.10428](https://doi.org/10.1109/qce60285.2024.10428) | 低温 VCO 表征 |
| 2024 | From Master Equation to SPICE: A Platform to Model Cryo-CMOS Control for Qubits | [10.1109/QCE60285.2024.00093](https://doi.org/10.1109/qce60285.2024.00093) | cryo-CMOS 控制的 SPICE 建模平台 |
| 2024 | Low-Power Half-Flux-Quantum based Counter Circuits for Cryogenic Quantum Computers | [10.1109/QCE60285.2024.00120](https://doi.org/10.1109/qce60285.2024.00120) | 半磁通量子低功耗计数电路 |
| 2024 | Miniaturized Low-Pass Filter Using IPD Technology for Cryogenic Quantum Applications | [10.1109/QCE60285.2024.00148](https://doi.org/10.1109/qce60285.2024.00148) | 低温应用小型化低通滤波器 |
| 2025 | Partitioning Cryogenic Integrated Electronics for Scalable Spin Qubit Operation | [10.1109/QCE65121.2025.00121](https://doi.org/10.1109/qce65121.2025.00121) | 低温集成电子学功能划分 |
| 2025 | Cryo-CMOS Control Modeling for Fluxonium Qubits | [10.1109/QCE65121.2025.00154](https://doi.org/10.1109/qce65121.2025.00154) | fluxonium 的 cryo-CMOS 控制建模 |
| 2025 | Power Reduction of SFQ Readout Circuit for Superconducting Quantum Computers | [10.1109/QCE65121.2025.00108](https://doi.org/10.1109/qce65121.2025.00108) | SFQ 读出电路降功耗 |
| 2021 | Practical implications of SFQ-based two-qubit gates | [10.1109/QCE52317.2021.00061](https://doi.org/10.1109/qce52317.2021.00061) | SFQ 双比特门实际考量 |

#### (f) 校准、脉冲级 IR 与调试

| 年份 | 论文 | 链接 | 关联 |
|---|---|---|---|
| 2022 | Calibration-Aware Transpilation for Variational Quantum Optimization | [10.1109/QCE53715.2022.00040](https://doi.org/10.1109/qce53715.2022.00040) | 校准感知转译 |
| 2024 | On the Use of Calibration Data in Error-Aware Compilation Techniques for NISQ Devices | [10.1109/QCE60285.2024.00048](https://doi.org/10.1109/qce60285.2024.00048) | 误差感知编译中的校准数据 |
| 2024 | Few-Shot, Robust Calibration of Single Qubit Gates Using Bayesian Robust Phase Estimation | [10.1109/QCE60285.2024.00147](https://doi.org/10.1109/qce60285.2024.00147) | 少样本鲁棒门校准 |
| 2024 | CircInspect: Integrating Visual Circuit Analysis, Abstraction, and Real-Time Development in Quantum Debugging | [10.1109/QCE60285.2024.00119](https://doi.org/10.1109/qce60285.2024.00119) | 量子调试中的实时开发 |
| 2025 | ★ Towards a Pulse-Level Intermediate Representation for Diverse Quantum Control Systems | [10.1109/QCE65121.2025.00057](https://doi.org/10.1109/qce65121.2025.00057) | **面向多样控制系统的脉冲级 IR**（Bell 的 IR 层直接相关） |
| 2025 | Tailored Quantum Device Calibration with Statistical Model Checking | [10.1109/QCE65121.2025.00052](https://doi.org/10.1109/qce65121.2025.00052) | 统计模型检验定制校准 |
| 2024 | Towards Readout-Aware Layout Synthesis for Spin Qubit Systems with Double Quantum Dot Readouts | [10.1109/QCE60285.2024.10419](https://doi.org/10.1109/qce60285.2024.10419) | 读出感知布局综合 |
| 2023 | Toward Consistent High-Fidelity Quantum Learning on Unstable Devices via Efficient In-Situ Calibration | [10.1109/QCE57702.2023.00099](https://doi.org/10.1109/qce57702.2023.00099) | 原位校准保障设备稳定性 |

#### (g) QCE 2026 日程中的测控相关论文（QSYS/QTEM track，arXiv 已核实）

| Session | 论文 | 作者 | 链接 |
|---|---|---|---|
| QSYS·Accelerated QEC & Feedback | ★ A Scalable Open-Source QEC System with Sub-Microsecond Decoding-Feedback Latency | Junyi Liu, Yi Lee, Yilun Xu, Gang Huang, Xiaodi Wu | [arXiv:2603.16203](https://arxiv.org/abs/2603.16203) |
| QSYS·Accelerated QEC & Feedback | Low Latency GNN Accelerator for Quantum Error Correction | Alessio Cicero et al. | [arXiv:2603.22149](https://arxiv.org/abs/2603.22149) |
| QSYS·Accelerated QEC & Feedback | ADaPT: Adaptive-window Decoding for Practical fault-Tolerance | Tina Oberoi, Joshua Viszlai, Frederic T. Chong | [arXiv:2605.01149](https://arxiv.org/abs/2605.01149) |
| QSYS·Real-Time QEC Decoding | Dithered Belief Propagation for Real-Time Quantum Memory Decoding | Zhengyu Cai et al. (McGill) | 日程条目 |
| QSYS·Real-Time QEC Decoding | A Scalable FPGA Architecture for Real-Time Decoding of Quantum LDPC Codes Using GARI | Daniel Bascones et al. | [arXiv:2605.01035](https://arxiv.org/abs/2605.01035) |
| QSYS·Real-Time QEC Decoding | DART-Q: A Deadline-Driven Framework for Real-Time QLDPC Decoding | Ameya S. Bhave et al. | [arXiv:2605.09142](https://arxiv.org/abs/2605.09142) |
| QSYS·Quantum Control Architectures | ★ AtomFlow: An End-to-End FPGA-Based Control Architecture for Neutral Atom Quantum Computers | Xiaorang Guo et al. (TUM) | [arXiv:2607.11490](https://arxiv.org/abs/2607.11490) |
| QSYS·Quantum Control Architectures | ★ Vectorizing Quantum Control: A RISC-V Vector Extension Architecture for Scalable Qubit Systems | Xiaorang Guo et al. (TUM) | [arXiv:2607.07372](https://arxiv.org/abs/2607.07372) |
| QSYS·Quantum Control Architectures | ★ Multi-Stage Mamba-Based Architecture for Fast and Scalable Superconducting Qubit Readout | Luca Otting et al. (TUM) | [arXiv:2607.11668](https://arxiv.org/abs/2607.11668) |
| QSYS·Pulse-Level Control | ★ A Linearly Typed MLIR Dialect for Pulse-Level Quantum Control Scheduling | Anthony Santana, Alex McCaskey, Shane Caldwell, Krysta Svore (Microsoft/NVIDIA) | 日程条目 |
| QSYS·Pulse-Level Control | ★ HyPulse: A Pulse Synthesis Framework for Hybrid Qubit-Oscillator Gates on Trapped-Ion Platform | Masoud Hakimi Heris, Yuan Liu, Frank Mueller | [arXiv:2604.26804](https://arxiv.org/abs/2604.26804) |
| QSYS·Noise Learning & Calibration | EDIQT: Enabling Dynamism for In-Situ Quantum Calibration Technologies | Maxwell Poster, Jason Chadwick, Jonathan Baker | 日程条目 |
| QSYS·Noise Learning & Calibration | Runtime Calibration as State-Trajectory Feedback Control in Quantum-Classical Workflows | Xiaolong Deng | [arXiv:2605.11860](https://arxiv.org/abs/2605.11860) |
| QSYS·Noise Learning & Calibration | Quantum hardware noise learning via differentiable Kraus representation on tensor networks | Ryo Sakai, Yu Yamashiro | [arXiv:2604.20804](https://arxiv.org/abs/2604.20804) |
| QTEM·Ion Traps | ★ Low-cost Ultra-low Noise DAC System-on-Module for Scalable Ion-Trap Electrode Control | Mitchell Peaks, Mia Kaarls, Crystal Noel (Duke) | [arXiv:2605.01132](https://arxiv.org/abs/2605.01132) |
| QTEM·QEC & FT | Scalable FPGA-based Decoder for QEC with Syndrome Subgraph Algorithm | Jan-Erik R. Wichmann et al. (RIKEN) | 日程条目 |
| QTEM·QEC & FT | Design of a Quantum Error Correction Decoder Exploiting Temporal Parallelism | Leo Itoh et al. (U. Tokyo) | [arXiv:2607.27930](https://arxiv.org/abs/2607.27930) |
| QTEM·QEC & FT | On the Feasibility of Time-Multiplexed Control for Surface Code FT Computation | Konstantinos-Nikolaos Papadopoulos, Kaitlin N. Smith, Jakub Szefer | 日程条目 |
| QTEM·Control & RL | DART-Q: Deadline-Aware Real-Time Feed-Forward for Quantum Control | Charles Cao, Sergei Kalinin | 日程条目 |
| QTEM·Control & RL | Co-Design of Quantum Hardware and Control Using Reinforcement Learning | Qimao Yang, Hanbo Yang, Jing Guo | 日程条目 |
| QTEM·Quantum Memories | Sub-nanosecond control for spin-defect quantum memories with a low-cost, compact FPGA platform | Victor Marcenac et al. | [arXiv:2604.11743](https://arxiv.org/abs/2604.11743) |
| QTEM·Readout & Cryo | A Scalable and Cost-Efficient QuBit Readout Circuit with Code-Division Multiplexing in 22nm | Chenao Yuan et al. (Waterloo) | 日程条目 |
| QTEM·Architecture | Branch-Resolved Characterization of Feed-Forward Error in Dynamic Teleportation via Classical Choi Shadows | Mason Edwards, Prabhat Mishra | [arXiv:2604.28037](https://arxiv.org/abs/2604.28037) |
| QTEM·Devices | Scheduling Under Stochastic Control Drift in a Room-Temperature NV-Center Quantum Processor | Sakineh Ghaderi et al. | 日程条目 |

### 1.3 本地 CS4Q 导读已覆盖的核心文献（33 项，不重复解读）

> `CS4Q_量子测控文献导读.md` 已系统解读 17 篇论文 + 9 篇补充 + 7 项资料，本报告在后续 venue 分类中将其按发表 venue 归位（标注 [CS4Q-P##]），避免重复解读：QubiC 2.0 (arXiv→QCE 已列)、HRL 硅 QPU (Nature 2026)、SFQ 控制理论 (PR Applied 2014)、CUDA-Q Logical (arXiv 2026)、EDEM (arXiv 2026)、Atom QEC (arXiv 2026)、16ch cryo-CMOS ASIC (ISSCC 2026)、Helios 98q (Nature 2026)、OpenQASM 3 (ACM TQC 2022)、LCD 译码器 (Nat. Commun. 2025)、Ristè 反馈 (PRL 2012)、Bultink 泄漏 (Sci. Adv. 2020)、QUASAR/qV (ICRC 2020)、随机编译硬件化 (arXiv 2024)、参数化执行 (arXiv 2024)、ML 态判别 (arXiv→PRX Quantum)、DRAG (PRL 2009)、eQASM (HPCA 2019)、QICK (RSI 2022)、实时容错 QEC (PRX 2021)、Google 低于阈值 (Nature 2025)、Blais cQED (PRA 2004)、Shor 1995 (PRA)、Leonard SFQ 实验 (PR Applied 2019)、随机编译 (PRA 2016)、Deltaflow 2 (Riverlane 技术报告)、QHub 星形网络 (APS 摘要)、LabOneQ 自动化 (Zurich Instruments 博客)、RQL 双轨 (APS 摘要)、Guppy-FT (Quantinuum 文档)、Kirin (QuEra 文档)。

---

<!-- SECTION-2-PLACEHOLDER：以下内容将由联网检索结果填充 -->

## 2. 计算机体系结构 venue（ISCA / MICRO / HPCA / ASPLOS / TC / TCAD / CAL / TACO / IEEE Micro）

> 检索方法：Crossref REST API 逐 venue 遍历 + DOI 去重（2019–2026）。★ 为与 QuCtrl-BELL 最直接对标。**这是 Bell 类"编译器驱动反馈控制栈"论文的主战场**——2025–2026 年 ISCA/HPCA/ASPLOS 出现了一批直接竞争工作（ARTERY、CLINE、Cyclone、S-SYNC 等），投稿 ISCAS 2027 前必须全部对标。

### 2.1 ISCA

| 年份 | 论文 | 第一作者 | DOI | 关联 |
|---|---|---|---|---|
| 2019 | Statistical Assertions for Validating Patterns and Finding Bugs in Quantum Programs | Yipeng Huang | [10.1145/3307650.3322213](https://doi.org/10.1145/3307650.3322213) | 量子程序运行时断言 |
| 2019 | Full-Stack, Real-System Quantum Computer Studies | Prakash Murali | [10.1145/3307650.3322273](https://doi.org/10.1145/3307650.3322273) | 全栈真实系统研究（含控制/编译） |
| 2019 | Cryogenic Computer Architecture Modeling with Memory-Side Case Studies | Gyu-hyeon Lee | [10.1145/3307650.3322219](https://doi.org/10.1145/3307650.3322219) | 低温计算架构建模基础 |
| 2020 | ★ Architecting Noisy Intermediate-Scale Trapped Ion Quantum Computers | Prakash Murali | [10.1109/ISCA45697.2020.00051](https://doi.org/10.1109/ISCA45697.2020.00051) | **首个 50–100 比特 QCCD 架构研究——Bell 平台直接对标** |
| 2020 | ★ NISQ+: Boosting Quantum Computing Power by Approximating QEC | Adam Holmes | [10.1109/ISCA45697.2020.00053](https://doi.org/10.1109/ISCA45697.2020.00053) | SFQ 逻辑上的近似 QEC 译码 |
| 2020 | ★ AccQOC: Accelerating Quantum Optimal Control Based Pulse Generation | Jinglei Cheng | [10.1109/ISCA45697.2020.00052](https://doi.org/10.1109/ISCA45697.2020.00052) | 脉冲生成加速（编译-控制协同） |
| 2020 | CryoCore: A Fast and Dense Processor Architecture for Cryogenic Computing | Ilkwon Byun | [10.1109/ISCA45697.2020.00037](https://doi.org/10.1109/ISCA45697.2020.00037) | 低温处理器微架构 |
| 2021 | ★ Designing Calibration and Expressivity-Efficient Instruction Sets for Quantum Computing | Lingling Lao | [10.1109/ISCA52012.2021.00071](https://doi.org/10.1109/ISCA52012.2021.00071) | QISA 设计与校准效率 |
| 2021 | CryoGuard: A Near Refresh-Free Robust DRAM Design for Cryogenic Computing | Gyu-hyeon Lee | [10.1109/ISCA52012.2021.00056](https://doi.org/10.1109/ISCA52012.2021.00056) | 低温 DRAM |
| 2022 | ★ XQsim: Modeling Cross-Technology Control Processors for 10+K Qubit Quantum Computers | Ilkwon Byun | [10.1145/3470496.3527417](https://doi.org/10.1145/3470496.3527417) | **跨技术控制处理器建模（PDU/EDU/PSU）——核心对标** |
| 2023 | ★ Astrea: Accurate Quantum Error-Decoding via Practical MWPM | Suhas Vittal | [10.1145/3579371.3589037](https://doi.org/10.1145/3579371.3589037) | 首个实时（~1 μs）MWPM 译码器 |
| 2023 | ★ QIsim: Architecting 10+K Qubit QC Interfaces | Dongmoon Min | [10.1145/3579371.3589036](https://doi.org/10.1145/3579371.3589036) | 10K+ 比特量子-经典接口架构 |
| 2023 | ★ Scaling Qubit Readout with Hardware Efficient ML Architectures | Satvik Maurya | [10.1145/3579371.3589042](https://doi.org/10.1145/3579371.3589042) | 硬件高效 ML 读出判别 |
| 2023 | ★ Parallel Driving for Fast Quantum Computing Under Speed Limits | Evan McKinney | [10.1145/3579371.3589075](https://doi.org/10.1145/3579371.3589075) | 并行驱动/脉冲调度提速 |
| 2025 | ★ ARTERY: Fast Quantum Feedback Using Branch Prediction | Wuwei Tian | [10.1145/3695053.3731086](https://doi.org/10.1145/3695053.3731086) | **分支预测加速量子反馈——与 Bell 亚微秒反馈最直接对标** |
| 2025 | ★ Synchronization for Fault-Tolerant Quantum Computers | Satvik Maurya | [10.1145/3695053.3730991](https://doi.org/10.1145/3695053.3730991) | 容错量子计算跨模块同步 |
| 2025 | ★ S-SYNC: Shuttle and Swap Co-Optimization in QCCD | Chenghong Zhu | [10.1145/3695053.3731084](https://doi.org/10.1145/3695053.3731084) | QCCD 搬运/交换协同优化 |
| 2025 | ★ SWIPER: Minimizing FT Quantum Program Latency via Speculative Window Decoding | Joshua Viszlai | [10.1145/3695053.3731022](https://doi.org/10.1145/3695053.3731022) | 推测式窗口译码降延迟 |
| 2025 | ★ CaliQEC: In-situ Qubit Calibration for Surface Code QEC | Xiang Fang | [10.1145/3695053.3731042](https://doi.org/10.1145/3695053.3731042) | 表面码在线原位校准 |
| 2025 | ★ Hardware-aware Calibration Protocol for Quantum Computers | Yuchen Zhu | [10.1145/3695053.3731036](https://doi.org/10.1145/3695053.3731036) | 硬件感知自动校准协议 |
| 2025 | ★ Qtenon: Low-Latency Architecture Integration for Hybrid Quantum-Classical Computing | Chenning Tao | [10.1145/3695053.3731087](https://doi.org/10.1145/3695053.3731087) | 低延迟量子-经典集成架构 |
| 2026 | ★ Coset Ensemble Decoder for QEC with Algorithm-Hardware Co-Design | Shuang Liang | [10.1109/ISCA66397.2026.00070](https://doi.org/10.1109/ISCA66397.2026.00070) | FPGA QEC 译码器（时域复用） |
| 2026 | ★ Triage: An Adaptive Parallel Window Decoding Scheduler for Real-Time FTQC | Jiahan Chen | [10.1109/ISCA66397.2026.00069](https://doi.org/10.1109/ISCA66397.2026.00069) | 实时并行窗口译码调度 |
| 2026 | ★ A Streaming Architecture for Quantum Error Syndrome Compression at 4 Kelvin | Panagiotis Papanikolaou | [10.1109/ISCA66397.2026.00071](https://doi.org/10.1109/ISCA66397.2026.00071) | **4K 低温症候压缩流式架构（低温+反馈链路）** |
| 2026 | Unifying Qubit Routing Across Diverse Quantum ISAs | Zhaohui Yang | [10.1109/ISCA66397.2026.00162](https://doi.org/10.1109/ISCA66397.2026.00162) | 跨 QISA 路由统一 |

（另有编译/仿真类若干：SQUARE、2QAN、Geyser、Atomique、SAT Scalpel、Bosehedral、Tetris、QuTracer、QPlacer、SwitchQNet、Genesis、QR-Map、Kernpiler 等，DOI 详见存档。）

### 2.2 MICRO

| 年份 | 论文 | 第一作者 | DOI | 关联 |
|---|---|---|---|---|
| 2019 | Mitigating Measurement Errors by Exploiting State-Dependent Bias | Swamit S. Tannu | [10.1145/3352460.3358265](https://doi.org/10.1145/3352460.3358265) | 测量误差缓解（读出） |
| 2020 | ★ Optimized Quantum Compilation for Near-Term Algorithms with OpenPulse | Pranav Gokhale | [10.1109/MICRO50266.2020.00027](https://doi.org/10.1109/MICRO50266.2020.00027) | **脉冲级编译（编译器↔脉冲控制）** |
| 2020 | Virtualized Logical Qubits: A 2.5D Architecture | Casey Duckering | [10.1109/MICRO50266.2020.00026](https://doi.org/10.1109/MICRO50266.2020.00026) | 容错 2.5D 架构 |
| 2021 | ★ Exploiting Different Levels of Parallelism in the Quantum Control Microarchitecture for Superconducting Qubits | Yuanrui Zhang | [10.1145/3466752.3480116](https://doi.org/10.1145/3466752.3480116) | **量子控制微架构多级并行——核心** |
| 2022 | ★ COMPAQT: Compressed Waveform Memory Architecture for Scalable Qubit Control | Satvik Maurya | [10.1109/MICRO56248.2022.00076](https://doi.org/10.1109/MICRO56248.2022.00076) | **波形内存压缩（与 Bell 的 step-table 压缩同思路）——核心** |
| 2023 | ★ HetArch: Heterogeneous Microarchitectures for Superconducting Quantum Systems | Samuel Stein | [10.1145/3613424.3614300](https://doi.org/10.1145/3613424.3614300) | 异构控制微架构 |
| 2024 | ★ Flag-Proxy Networks: Architectural, Scheduling and Decoding for Quantum LDPC Codes | Suhas Vittal | [10.1109/MICRO61859.2024.00059](https://doi.org/10.1109/MICRO61859.2024.00059) | LDPC 架构/调度/译码协同 |
| 2024 | SuperCore: An Ultra-Fast Superconducting Processor for Cryogenic Applications | — | [10.1109/MICRO61859.2024.00112](https://doi.org/10.1109/MICRO61859.2024.00112) | 低温超导处理器 |
| 2025 | ★ Distributed-HISQ: A Distributed Quantum Control Architecture | Yilun Zhao | [10.1145/3725843.3756048](https://doi.org/10.1145/3725843.3756048) | **分布式量子控制架构——核心** |
| 2025 | ★ MUSS-TI: Multi-level Shuttle Scheduling for Large-Scale Entanglement Module Linked Trapped-Ion | Xian Wu | [10.1145/3725843.3756129](https://doi.org/10.1145/3725843.3756129) | **离子阱 EML-QCCD 搬运调度——核心对标** |
| 2025 | ★ Vegapunk: Accurate and Fast Decoding for Quantum LDPC Codes | Kaiwen Zhou | [10.1145/3725843.3756084](https://doi.org/10.1145/3725843.3756084) | 稀疏加速器 LDPC 实时译码 |
| 2025 | ★ LANCER: Low-Overhead, Accurate, Non-Destructive Calibration | Junpyo Kim | [10.1145/3725843.3756026](https://doi.org/10.1145/3725843.3756026) | 低开销非破坏校准 |
| 2025 | ★ YOUTIAO: Hybrid Multiplexing with Dynamic Qubit Grouping for Scalable Quantum Wiring | Wuwei Tian | [10.1145/3725843.3756061](https://doi.org/10.1145/3725843.3756061) | 可扩展量子布线复用 |

### 2.3 HPCA

| 年份 | 论文 | 第一作者 | DOI | 关联 |
|---|---|---|---|---|
| 2019 | ★ eQASM: An Executable Quantum Instruction Set Architecture | Xiang Fu | [10.1109/HPCA.2019.00040](https://doi.org/10.1109/HPCA.2019.00040) | **可执行 QISA，含快速条件执行+综合反馈控制——领域基石（CS4Q-S06）** |
| 2021 | ★ TILT: Higher Fidelity on a Trapped-Ion Linear-Tape Architecture | Xin-Chuan Wu | [10.1109/HPCA51647.2021.00023](https://doi.org/10.1109/HPCA51647.2021.00023) | 离子阱线性链架构（与 QCCD 对照） |
| 2022 | ★ DigiQ: A Scalable Digital Controller for Quantum Computers Using SFQ Logic | Mohammad Reza Jokar | [10.1109/HPCA53966.2022.00037](https://doi.org/10.1109/HPCA53966.2022.00037) | SFQ 数字控制器（>42K 比特预算）——核心 |
| 2022 | ★ QULATIS: QEC Methodology toward Lattice Surgery | Yosuke Ueno | [10.1109/HPCA53966.2022.00028](https://doi.org/10.1109/HPCA53966.2022.00028) | 在线译码电路 + SFQ/Cryo-CMOS 混合 FTQC |
| 2022 | ★ AFS: Accurate, Fast, and Scalable Error-Decoding | Poulami Das | [10.1109/HPCA53966.2022.00027](https://doi.org/10.1109/HPCA53966.2022.00027) | 实时 Union-Find 近似译码 |
| 2022 | ★ Detecting Qubit-coupling Faults in Ion-trap Quantum Computers | Andrii Maksymov | [10.1109/HPCA53966.2022.00036](https://doi.org/10.1109/HPCA53966.2022.00036) | 离子阱耦合故障检测 |
| 2023 | ★ Co-Designed Architectures for Modular Superconducting Quantum Computers | Evan McKinney | [10.1109/HPCA56546.2023.10071036](https://doi.org/10.1109/HPCA56546.2023.10071036) | 模块化超导架构协同设计 |
| 2023 | ★ PAQOC: Pulse Generation Framework with Program-aware Basis Gates | Yanhao Chen | DOI 待核实 | 脉冲级最优控制编译-控制协同 |
| 2025 | ★ LSQCA: Resource-Efficient Load/Store Architecture for Limited-Scale FTQC | Takumi Kobori | [10.1109/HPCA61900.2025.00033](https://doi.org/10.1109/HPCA61900.2025.00033) | 容错 load/store 执行模型 |
| 2025 | ★ BOSS: Blocking Algorithm for Optimizing Shuttling Scheduling in Ion Trap | Anbang Wu | [10.1109/HPCA61900.2025.00032](https://doi.org/10.1109/HPCA61900.2025.00032) | **离子阱搬运调度——核心对标** |
| 2026 | ★ CLINE: Improving Control Flow Compilation of Quantum Programs with Control Line Encoding | Anbang Wu | [10.1109/HPCA68181.2026.11408609](https://doi.org/10.1109/HPCA68181.2026.11408609) | **控制流编译+控制线编码——与 Bell 最直接对标** |
| 2026 | ★ Cyclone: Highly Parallel QCCD Architectural Codesigns for FT Quantum Memory | Sahil Khan | [10.1109/HPCA68181.2026.11408498](https://doi.org/10.1109/HPCA68181.2026.11408498) | **QCCD 架构协同（高并行搬运）——核心对标** |
| 2026 | ★ Pinball: A Cryogenic Predecoder for QEC Under Circuit-Level Noise | Alexander Knapen | [10.1109/HPCA68181.2026.11408464](https://doi.org/10.1109/HPCA68181.2026.11408464) | **低温预译码器——核心** |
| 2026 | ★ Toward Scalable Gate-Level Parallelism on Trapped-Ion Processors with Racetrack Electrodes | — | [10.1109/HPCA68181.2026.11408608](https://doi.org/10.1109/HPCA68181.2026.11408608) | **跑道电极离子阱门级并行——核心对标** |
| 2026 | DC-MBQC: A Distributed Compilation Framework for MBQC | Yecheng Xue | [10.1109/HPCA68181.2026.11408612](https://doi.org/10.1109/HPCA68181.2026.11408612) | MBQC 分布式编译（测量反馈） |

（HPCA 2020 经核实**无**量子相关论文；其余编译/仿真类 QuantumNAS、VAQEM、Q-GPU、SupermarQ、MIRAGE、QuCLEAR、HATT、TraceQ 等见存档。）

### 2.4 ASPLOS

| 年份 | 论文 | 第一作者 | DOI | 关联 |
|---|---|---|---|---|
| 2019 | Puddle: A Dynamic, Error-Correcting, Full-Stack Quantum Platform | Matthew P. Willsey | [10.1145/3297858.3304027](https://doi.org/10.1145/3297858.3304027) | 全栈量子平台（含控制/纠错） |
| 2020 | ★ CryoCache: Cache Architecture for Cryogenic Computing | Dongmoon Min | [10.1145/3373376.3378513](https://doi.org/10.1145/3373376.3378513) | 低温缓存架构 |
| 2020 | ★ Quantum Circuits for Dynamic Runtime Assertions | Ji Liu | [10.1145/3373376.3378488](https://doi.org/10.1145/3373376.3378488) | 动态运行时断言 |
| 2022 | ★ LILLIPUT: A Lightweight Low-Latency Lookup-Table Decoder | Poulami Das | [10.1145/3503222.3507707](https://doi.org/10.1145/3503222.3507707) | **查表式低延迟译码——核心** |
| 2022 | ★ CryoWire: Wire-Driven Microarchitecture Designs for Cryogenic Computing | Dongmoon Min | [10.1145/3503222.3507749](https://doi.org/10.1145/3503222.3507749) | 低温连线驱动微架构 |
| 2022 | ★ Suppressing ZZ Crosstalk through Pulse and Scheduling Co-Optimization | Lei Xie | [10.1145/3503222.3507761](https://doi.org/10.1145/3503222.3507761) | 脉冲-调度协同（脉冲级控制） |
| 2023 | ★ Better Than Worst-Case Decoding for QEC | Gokul Subramanian Ravi | [10.1145/3575693.3575733](https://doi.org/10.1145/3575693.3575733) | 超越最坏情况译码——核心 |
| 2023 | ★ CaQR: Compiler-Assisted Qubit Reuse through Dynamic Circuit | Fei Hua | [10.1145/3582016.3582030](https://doi.org/10.1145/3582016.3582030) | **动态电路比特复用编译——核心** |
| 2024 | ★ Promatch: Extending Real-Time QEC with Adaptive Predecoding | Narges Alavisamani | [10.1145/3620666.3651339](https://doi.org/10.1145/3620666.3651339) | 自适应预译码——核心 |
| 2024 | ★ A Fault-Tolerant Million Qubit-Scale Distributed Quantum Computer | Junpyo Kim | [10.1145/3620665.3640388](https://doi.org/10.1145/3620665.3640388) | 百万比特分布式容错架构 |
| 2024 | ★ QuFEM: Fast and Accurate Quantum Readout Calibration Using FEM | Siwei Tan | [10.1145/3620665.3640380](https://doi.org/10.1145/3620665.3640380) | 读出校准——核心 |
| 2024 | ★ One Gate Scheme to Rule Them All: A Reduced Instruction Set for Quantum Computing | Jianxin Chen | [10.1145/3620665.3640386](https://doi.org/10.1145/3620665.3640386) | 精简 QISA |
| 2025 | ★ Micro Blossom: Accelerated MWPM Decoding for QEC | Yue Wu | [10.1145/3676641.3716005](https://doi.org/10.1145/3676641.3716005) | **首个硬件加速精确 MWPM（d=13 平均 0.8 μs）——核心** |
| 2025 | ★ RESCQ: Realtime Scheduling for Continuous Angle QEC Architectures | Sayam Sethi | [10.1145/3676641.3716018](https://doi.org/10.1145/3676641.3716018) | 连续角 QEC 实时调度——核心 |
| 2026 | ★ Architecting Scalable Trapped Ion Quantum Computers Using Surface Codes | Scott Jones | [10.1145/3779212.3790128](https://doi.org/10.1145/3779212.3790128) | **表面码可扩展离子阱架构——核心对标** |
| 2026 | ★ iSwitch: QEC on Demand via In-Situ Encoding for Ion Trap Architectures | Keyi Yin | [10.1145/3779212.3790177](https://doi.org/10.1145/3779212.3790177) | **离子阱原位编码按需 QEC——核心对标** |
| 2026 | ★ Reconfigurable Quantum Instruction Set Computers (ReQISC) | Zhaohui Yang | [10.1145/3779212.3790208](https://doi.org/10.1145/3779212.3790208) | **可重构 QISA（SU(4) 任意双比特门）+编译器——核心** |
| 2026 | ★ PropHunt: Automated Optimization of Quantum Syndrome Measurement Circuits | Joshua Viszlai | [10.1145/3779212.3790205](https://doi.org/10.1145/3779212.3790205) | 症候测量电路自动优化 |

（另有映射/编译/误差缓解类：Tackling Qubit Mapping、Noise-Adaptive Mappings、CutQC、Orchestrated Trios、QUEST、HAMMER、Paulihedral、CAFQA、FrozenQubits、QISMET、VarSaw、HetEC、QECC-Synth、PowerMove 等，DOI 详见存档。）

### 2.5 体系结构期刊

| 期刊 | 论文 | 年份 | DOI | 关联 |
|---|---|---|---|---|
| ★ IEEE Micro | A Microarchitecture for a Superconducting Quantum Processor (QuMA) — Xiang Fu et al. | 2018 | [10.1109/MM.2018.032271060](https://doi.org/10.1109/MM.2018.032271060) | **量子控制微架构开山之作（Bell 体系结构源头之一）** |
| ★ IEEE Micro | Universal Graph-Based Scheduling for Quantum Systems — Leon Riesebos et al. | 2021 | [10.1109/MM.2021.3094968](https://doi.org/10.1109/MM.2021.3094968) | 量子系统图调度（控制/校准编排） |
| ★ IEEE Micro | Architecting a Full-Stack Superconducting FT Quantum Computer — Jangwoo Kim et al. | 2026 | [10.1109/MM.2026.3665565](https://doi.org/10.1109/MM.2026.3665565) | 全栈容错架构 |
| IEEE Micro | Retargetable Optimizing Compilers via a Multilevel IR (MLIR) — Thien Nguyen et al. | 2022 | [10.1109/MM.2022.3179654](https://doi.org/10.1109/MM.2022.3179654) | MLIR 多级 IR 量子编译器 |
| IEEE Micro | Special Issue on Quantum Computing（专刊导言，41(5)） | 2021 | [10.1109/MM.2021.3103248](https://doi.org/10.1109/MM.2021.3103248) | 2021 量子计算专刊 |
| ★ TCAD | SmartQCache: Fast and Precise Pulse Control With Near-Quantum Cache on FPGA — Liqiang Lu et al. | 2025 | [10.1109/TCAD.2024.3497839](https://doi.org/10.1109/TCAD.2024.3497839) | **FPGA 近量子缓存脉冲控制——核心** |
| ★ TCAD | Analytical Modeling of Inaccuracies in RF Controlling Circuits — Yao Tong et al. | 2024 | [10.1109/TCAD.2023.3311732](https://doi.org/10.1109/TCAD.2023.3311732) | RF 控制电路非理想建模 |
| ★ TCAD | A Predictive Readout Fidelity Model for Readout Circuit Design — Yao Tong et al. | 2025 | [10.1109/TCAD.2024.3483670](https://doi.org/10.1109/TCAD.2024.3483670) | 读出电路保真度预测 |
| ★ TCAD | NAPA: Intermediate-Level Variational Native-Pulse Ansatz — Zhiding Liang et al. | 2024 | [10.1109/TCAD.2024.3355277](https://doi.org/10.1109/TCAD.2024.3355277) | 原生脉冲级变分 |
| TCAD | Timing and Resource-Aware Mapping of Quantum Circuits — Lingling Lao et al. | 2022 | [10.1109/TCAD.2021.3057583](https://doi.org/10.1109/TCAD.2021.3057583) | 时序/资源感知映射 |
| ★ CAL | Inter-Temperature Bandwidth Reduction in Cryogenic QAOA Machines — Yosuke Ueno et al. | 2024 | [10.1109/LCA.2023.3322700](https://doi.org/10.1109/LCA.2023.3322700) | **温区间带宽削减（低温控制栈通信瓶颈）** |
| CAL | A Day in the Life of a Quantum Error — Salonik Resch et al. | 2021 | [10.1109/LCA.2020.3045628](https://doi.org/10.1109/LCA.2020.3045628) | 量子错误生命周期（纠错系统设计） |
| CAL | Cryogenic PIM: Challenges & Opportunities — Salonik Resch et al. | 2021 | [10.1109/LCA.2021.3077536](https://doi.org/10.1109/LCA.2021.3077536) | 低温存内计算 |
| ★ TACO | A System Architecture for Low Latency Multiprogramming Quantum Computing — Yilun Zhao et al. | 2026 | [10.1145/3845611](https://doi.org/10.1145/3845611) | **低延迟多程序系统架构（运行时/调度）** |
| TC | Dynamic Quantum Circuit Compilation — Kun Fang et al. | 2026 | [10.1109/TC.2025.3643826](https://doi.org/10.1109/TC.2025.3643826) | 动态（含中途测量）电路编译 |

> **未检索到**：IEEE TPDS（量子测控方向）；IEEE Design & Test（仅测试/EDA 综述边缘条目）；IEEE TC 无直接测控论文（仅仿真/低温缓存边缘）。CAL 上无 "A Quantum Control…" 类测控短文（以纠错/映射/断言为主）。

---

## 3. 电路与测控硬件 venue（ISSCC / RFIC / CICC / ESSCIRC / ISCAS / VLSI / IEDM / IMS / JSSC / TCAS / T-MTT / TIM / TAS / RSI 等）

> 检索方法：Google/WebSearch 综合 + IEEE Xplore 文献号。⚠ 为元数据未完全确定条目。此领域是量子测控电路（cryo-CMOS、SFQ、读出链路）的主阵地。

### 3.1 ISSCC（量子 session 逐年谱系）

| 年份 | 论文 | 团队 | 链接 | 关联 |
|---|---|---|---|---|
| 2020 | A Scalable Cryo-CMOS 2-to-20GHz Digitally Intensive Controller for 4×32 Frequency Multiplexed Spin Qubits/Transmons in 22nm FinFET（Horse Ridge I） | Intel-QuTech (van Dijk et al.) | 期刊版 [10.1109/JSSC.2020.3024678](https://doi.org/10.1109/JSSC.2020.3024678) | **首颗低温量子控制 SoC**，128 比特频分复用 |
| 2021 | A Fully Integrated Cryo-CMOS SoC for State Manipulation, Readout, and High-Speed Gate Pulsing of Spin Qubits（Horse Ridge II） | Intel (Park et al.) | [10.1109/JSSC.2021.3115988](https://doi.org/10.1109/JSSC.2021.3115988) | 集成 DDS 驱动+复用读出+22 路门压 DAC |
| 2022 | A cryo-CMOS low-power semi-autonomous qubit state controller in 14nm FinFET | IBM (Frank et al.) | 期刊版 JSSC 2022 | 半自主低温 transmon 态控制器 |
| 2022 | A Cryo-CMOS Controller IC with Fully Integrated Frequency Generators for Qubit Control | Kang et al. | — | 片内集成频率发生器 |
| 2023 | A 28-nm Bulk-CMOS IC for Full Control of a Superconducting QPU Unit-Cell | Intel (Yoo et al.) | [10.1109/JSSC.2023.3309317](https://doi.org/10.1109/JSSC.2023.3309317) | 单元胞全控制 <4 mW/比特 |
| 2023 | A Polar-Modulation-Based Cryogenic Qubit State Controller in 28nm Bulk CMOS | 清华 (Guo et al.) | [10.1109/JSSC.2023.3311639](https://doi.org/10.1109/JSSC.2023.3311639) | 极性调制 XY+电流舵 Z 控制 |
| 2023 | A Cryogenic Controller IC with DRAG Pulse Generation by Direct Synthesis without Memory | Kang et al. | — | 免存储器直接合成 DRAG 脉冲 |
| 2024 | A 22nm FD-SOI <1.2mW/Active-Qubit AWG-Free Cryo-CMOS Controller for Fluxonium Qubits | Le Gueuel, Bardin et al. | — | 免 AWG 亚毫瓦 fluxonium 控制器 |
| 2024 | A Cryo-CMOS Controller with Class-DE Driver for Color-Center QCs | TU Delft (Enthoven et al.) | [10.1109/JSSC.2024.3459392](https://doi.org/10.1109/JSSC.2024.3459392) | 金刚石色心专用控制器 |
| 2024 | A Cryo-CMOS Receiver with 15K Noise Temperature for Spin Qubit Readout | Prabowo et al. | — | 低温读出接收机 |
| 2024 | A Cryo-CMOS Quantum Computing Unit Interface Chipset in 28nm（相位检测读出+移相脉冲生成） | 清华 (Guo et al.) | — | 4.3 mW/比特，Nature Electronics 亮点 |
| 2025 | ★ 13.3 A Cryo-BiCMOS Controller for ⁹Be⁺-Trapped-Ion-Based Quantum Computers | TU Braunschweig/Hannover/Keio (Toth et al.) | [10.1109/ISSCC49661.2025.10904696](https://doi.org/10.1109/ISSCC49661.2025.10904696)；期刊版 JSSC 61(2):673–689 | **离子阱低温 BiCMOS 控制器（Jan Van Vessem Award）——与 Bell 平台最相关的芯片级工作** |
| 2025 | 13.5 An 18.5µW/qubit Cryo-CMOS Charge-Readout IC with QAM Multiplexing | CEA-Leti | IEEE Xplore 10904808 | QAM 复用自旋读出 |
| 2026 | ★ 22.2 A 16-Channel Low-Power Cryo-CMOS Flux Control Pulse Generator ASIC in 14nm FinFET | IBM (Kevin Tien et al.) | IEEE Xplore 11409194 | **16 通道磁通控制 ASIC（CS4Q-P07），<7 mW/通道** |
| 2026 | A Multi-Qubit Cryo-CMOS SoC with Polar/PDM Controllers for Diamond Color Centers | TU Delft/QuTech/Fujitsu | — | 首个色心电子+核自旋双控 SoC |

### 3.2 RFIC / CICC / ESSCIRC / VLSI / IEDM / IMS / MWSCAS

| venue | 论文 | 年份 | 关联 |
|---|---|---|---|
| RFIC 2024 | ★ A Fully Integrated Three-Channel Cryogenic Microwave SoC for Qubit State Control in ⁹Be⁺ Trapped-Ion QC at 4 K — Toth et al. | 2024 | **离子阱微波控制 SoC**（0.7–1.5 GHz，1.9 mW/比特；期刊版 JSSC 2026） |
| CICC 2022 | Cryogenic CMOS for Qubit Control and Readout — Pellerano et al. (Intel) | 2022 | Horse Ridge I/II 综述（CICC 最佳论文） |
| CICC 2023 | Sub-mW/qubit 5.2–7.2GHz 65nm Cryo-CMOS RX — Nagulu et al. | 2023 | 亚毫瓦低温 I/Q 接收机 |
| CICC 2023 | Cryogenic CMOS: design considerations for future QC systems — Joshi et al. (IBM) | 2023 | 低温 CMOS 设计考量 |
| CICC 2024 | A Cryogenic Double-IF SSB Controller in 130nm SiGe BiCMOS — Peng et al. | 2024 | 双中频单边带调制器 |
| CICC 2024 | A 7.4 µW/channel Cryo-CMOS IC for 70-Channel Frequency-Multiplexed µs-Readout — Schmidt et al. | 2024 | 70 通道复用微秒读出 |
| ESSCIRC 2022 | A cryogenic SRAM based AWG in 14 nm for spin qubit control — Prathapan et al. | 2022 | 低温 SRAM-AWG |
| ESSCIRC 2023 | A 7-10b Programmable Cryo-CMOS TI-SAR ADC for Multichannel Qubit Readout | 2023 | 多通道读出 ADC |
| ESSERC 2024 | ★ A low-power cryogenic analog electrode signal processing unit for shuttling operations in a trapped-ion QC — Meyer et al. | 2024 | **离子阱搬运低温电极信号处理单元**，[10.1109/ESSERC62670.2024.10719432](https://doi.org/10.1109/esserc62670.2024.10719432) |
| ESSERC 2024 | A 12.8 mW/channel cryogenic RF-AWG in 14nm FinFET for transmon control (IBM) | 2024 | IEEE Xplore 10719526 |
| ESSERC 2024 | A 40 GS/s 8b-DAC SST-TX in 7nm with 32kB SRAM RF-DDS AWG (IBM Zurich) | 2024 | 40 GS/s RF-DDS AWG |
| VLSI 2021 | A 5.5mW/Channel 2-to-7 GHz Cryogenic Pulse Modulator — Kang et al. | 2021 | 六通道低温脉冲调制器 |
| VLSI 2022 | ★ A 3V 15b 157μW Cryo-CMOS DAC for Multiplexed Spin-Qubit Biasing — Enthoven et al. | 2022 | 15 位低温 DAC（偏置控制） |
| VLSI 2024 | A Scalable mK Cryo-CMOS Demultiplexer Chip for Silicon Qubit Gates — Subramanian et al. | 2024 | mK 解复用（2 入 64 出） |
| VLSI 2026 | AI-Enhanced Cryo-CMOS Quantum Control-and-Readout Chip ⚠ (BAQIS/清华/上交) | 2026 | 28 nm，10.3 mW |
| IEDM 2019 | Challenges in Scaling-up the Control Interface of a Quantum Computer — D. J. Reilly | 2019 | **控制接口规模化挑战经典论述** |
| IEDM 2020 | CMOS Cryo-Electronics for Quantum Computing — Craninckx et al. (IMEC)；Cryo-CMOS Interfaces for Large-Scale QCs — Sebastiano et al. (TU Delft) | 2020 | 低温电子学双综述 |
| IMS 2022–2024 | 低温 LNA/开关/驱动模块系列（60GHz 放大器、mm-wave SPST、10.2K 噪声 LNA、4–10GHz 驱动模块、6mW SiGe 接收机 99% 读出保真度） | 2022–2024 | 读出链路低温微波组件谱系 |
| MWSCAS 2023 | A 1-1.7 GHz Cryogenic Fractional-N CP-PLL — 清华 | 2023 | 低温 PLL（相位相干分配） |

### 3.3 ISCAS（量子测控短文，ISCAS 2027 直接参照）

| 年份 | 论文 | 关联 |
|---|---|---|
| 2023 | Cryo-CMOS Mixed-Signal Circuits for Scalable Quantum Computing: Challenges and Future Steps — Kapoulea et al. | [10.1109/ISCAS46773.2023.10182164](https://doi.org/10.1109/ISCAS46773.2023.10182164)，低温混合信号综述 |
| 2024 | A Cryogenic Phase-Selection Superconducting Qubit Controller with Envelope-Tracking in 28nm — 清华 (Guo et al.) | XY 驱动功耗降 24% |
| 2024 | Tutorial T3: Qubit-Size Low-Power ICs for Monolithic Quantum Processors — Zito (AGH) | 60 GHz 放大器等比特尺寸 IC |
| 2025 | ★ A 1 GHz 27 mW low-power DDS for RF carrier signal generation in trapped-ion QC operating at 9.4K — Eugine et al. | **离子阱 RF 载波低温 DDS——与 Bell 平台直接相关** |
| 2025 | ★ On the Development of a Fully Integrated Shuttling Controller System on Chip for Trapped-Ion Quantum Computing — Meyer et al. | [10.1109/ISCAS56072.2025.11044118](https://doi.org/10.1109/iscas56072.2025.11044118)，**离子阱搬运控制器 SoC** |
| 2025 | ★ A 22-nm Surface Code Decoder Using Greedy Algorithm — Kadomoto et al. | [10.1109/ISCAS56072.2025.11044096](https://doi.org/10.1109/iscas56072.2025.11044096)，**ISCAS 上的表面码译码器 ASIC** |
| 2025 | Cryo-CMOS 0.432mW UHF Filter in 22nm FD-SOI — Kapoulea et al. | 量子控制信号完整性滤波 |
| 2025 | Benchmarking Cryogenic Circuits using 5 nm FinFETs — Kar et al. | 5nm 低温电路基准 |
| 2025 | S-PAM: Superconductor-Semiconductor Interface Circuit with PAM — Mustafa & Köse | SFQ-CMOS 高速接口 |

### 3.4 电路期刊（JSSC / TCAS / T-MTT / TIM / JETCAS / TAS）

**IEEE JSSC**（ISSCC 期刊扩展 + 独立工作）：
- Cryo-CMOS Circuits and Systems for Quantum Computing Applications — Patra et al. | 2018 | 53(1):309–321 | [10.1109/JSSC.2017.2737549](https://doi.org/10.1109/JSSC.2017.2737549) | **奠基综述**
- Design and characterization of a 28-nm cryogenic quantum controller <2 mW at 3 K — Bardin et al. | 2019 | 54(11) | [10.1109/JSSC.2019.2937234](https://doi.org/10.1109/JSSC.2019.2937234)
- A Scalable Cryo-CMOS Controller for Wideband Frequency-Multiplexed Control — van Dijk et al. | 2020 | 55(11) | [10.1109/JSSC.2020.3024678](https://doi.org/10.1109/JSSC.2020.3024678)
- Horse Ridge II SoC — Park et al. (Intel) | 2021 | 56(11) | [10.1109/JSSC.2021.3115988](https://doi.org/10.1109/JSSC.2021.3115988)
- A Cryo-CMOS Wideband Quadrature Receiver for Silicon Spin Qubits — Peng et al. | 2022 | 57(8) | [10.1109/JSSC.2022.3174605](https://doi.org/10.1109/JSSC.2022.3174605)
- A 1-GS/s 6–8-b Cryo-CMOS SAR ADC for Quantum Computing — Kiene et al. | 2023 | 58(7) | [10.1109/JSSC.2023.3237603](https://doi.org/10.1109/JSSC.2023.3237603) | 20 通道复用读出 0.5 mW/比特
- <4-mW/Qubit 28-nm Cryo-CMOS IC for Full Control of a QPU Unit Cell — Yoo et al. (Intel) | 2023 | 58(11) | [10.1109/JSSC.2023.3309317](https://doi.org/10.1109/JSSC.2023.3309317)
- Polar-Modulation Cryogenic Transmon Controller — 清华 Guo et al. | 2023 | 58(11) | [10.1109/JSSC.2023.3311639](https://doi.org/10.1109/JSSC.2023.3311639)
- Class-DE Driver Controller for Diamond Color Centers — Fakkel et al. | 2024 | 59(11) | [10.1109/JSSC.2024.3459392](https://doi.org/10.1109/JSSC.2024.3459392)
- ★ A Cryo-BiCMOS Controller for Trapped ⁹Be⁺ Ions — Toth et al. | 2026 | 61(2):673–689 | **离子阱低温控制器期刊版**
- ⚠ A 200-MS/s 12-b Cryo-CMOS CS DAC（IEEE Xplore 10757326）；⚠ 全集成反射读出 IC 含 FCNN 漂移补偿（IEEE Xplore 11577211）

**IEEE TCAS-I / TCAS-II**：
- ★ Designing a DDS-Based SoC for High-Fidelity Multi-Qubit Control — van Dijk et al. | TCAS-I 2020 | 67(12):5380–5393 | **DDS 多比特控制 SoC 方法学**
- A 40 nm Cryo-CMOS Homodyne-Demodulation Readout SoC — Minn et al. | TCAS-I 2025 | [10.1109/TCSI.2024.3518472](https://doi.org/10.1109/tcsi.2024.3518472)
- A Cryo-CMOS Mode-Reconfigurable RF-DAC Super-Heterodyne Transmitter — Yuan et al. | TCAS-I 2026 | [10.1109/TCSI.2026.3735365](https://doi.org/10.1109/tcsi.2026.3735365)
- A 65-nm Cryo-CMOS 4–7-GHz Noise-Canceling Receiver for Multi-Qubit Readout — Jeong et al. | TCAS-I 2026 | [10.1109/TCSI.2026.3732161](https://doi.org/10.1109/tcsi.2026.3732161)
- A Cryogenic CMOS Current Integrator and CDS Circuit for Spin Qubit Readout — Fuketa | TCAS-I 2023 | 70(12):5220–5228
- A Cryo-CMOS Oscillator With Automatic Common-Mode Resonance Calibration — Gong et al. | TCAS-I 2022 | [10.1109/TCSI.2022.3199997](https://doi.org/10.1109/tcsi.2022.3199997)
- Cryogenic CMOS for Quantum Processing: 5-nm FinFET SRAM at 10 K — Parihar et al. | TCAS-I 2023 | [10.1109/TCSI.2023.3278351](https://doi.org/10.1109/tcsi.2023.3278351)
- DC-Readout of Semiconductor Spin Qubits: Opportunities and Limits — Kiene et al. | TCAS-I 2025 | 72(10):5457–5470
- Cryogenic CMOS RF Circuits: A Promising Approach for Large-Scale QC — 清华 Guo et al. | TCAS-II 2024 | 综述快报
- A 43.4-dB Gain Double Noise-Canceling Cryogenic LNA — Chaubey et al. (清华) | TCAS-II 2025 | [10.1109/TCSII.2025.3543474](https://doi.org/10.1109/TCSII.2025.3543474)
- Metastability in SFQ Logic — Datta et al. | TCAS-I 2021 | [10.1109/TCSI.2021.3056682](https://doi.org/10.1109/tcsi.2021.3056682)；Compact RSFQ Register File — Zhang et al. | TCAS-I 2023 | [10.1109/TCSI.2023.3298768](https://doi.org/10.1109/tcsi.2023.3298768)

**IEEE T-MTT / TVLSI**：
- Design and Characterization of a 6-mW Cryogenic SiGe IC for Superconducting Qubit Readout — Kwende et al. | T-MTT 2025 | >98% 读出保真度，首个无独立低温 LNA 的硅读出链
- Pulsed HEMT LNA Operation for Qubit Readout — Zeng et al. (Chalmers) | T-MTT 2025 | 35 ns 恢复时间
- A Black-Box Quantum Model for Superconducting TWPAs — Haider | T-MTT 2024 | 72:2143–2157
- ★ Design and Analysis of Sub-Sampling PLL for Quantum Computing — Chou et al. | TVLSI 2023 | [10.1109/TVLSI.2023.3290262](https://doi.org/10.1109/tvlsi.2023.3290262) | 量子计算亚采样 PLL
- A Cryo-Tolerant >40-dB IRR Double Quadrature Receiver — Gao et al. | TVLSI 2026 | [10.1109/TVLSI.2025.3600894](https://doi.org/10.1109/tvlsi.2025.3600894)
- EDDQC: Enhanced Dynamical Distributing Quantum Compilation — Zhou et al. | TVLSI 2026 | [10.1109/TVLSI.2025.3600096](https://doi.org/10.1109/tvlsi.2025.3600096)

**IEEE TIM**：
- ★ An FPGA-Based Hardware Platform for the Control of Spin-Based Quantum Systems — Qin et al. | 2020 | 69:1127–1139 | [10.1109/TIM.2019.2910921](https://doi.org/10.1109/tim.2019.2910921) | 单板集成 AWG+脉冲+ADC+TDC
- ★ SQ-CARS: A Scalable Quantum Control and Readout System — Singhal et al. | 2023 | 72:1–15 | [10.1109/TIM.2023.3305656](https://doi.org/10.1109/TIM.2023.3305656) | ZCU111 平台低延迟反馈
- ★ Cryogenic Evaluation of a DAC for a Trapped-Ion Quantum Computer — Meyer et al. | 2025 | 74 | [10.1109/TIM.2025.3571087](https://doi.org/10.1109/tim.2025.3571087) | **离子阱低温 DAC 评测**
- Method for Efficient Large-Scale Cryogenic Characterization of CMOS — Eastoe et al. | 2024 | 74:1–10
- Real-Time In Situ Quantum Feedback Control of Electron Spin in Atomic Spin Gyroscopes — Pei et al. | 2024 | [10.1109/TIM.2023.3325515](https://doi.org/10.1109/tim.2023.3325515)

**IEEE JETCAS**：2022 年专刊 "Design and Automation for Quantum Computation and Quantum Technologies"；2024 年专刊 "Chip and Package-Scale Communication-Aware Architectures for … Quantum Computing Systems"（含低温互连/通信基础设施论文）。

**IEEE TAS（SFQ/RSFQ 控制谱系）**：
- Design and Fabrication of Low-Power SFQ Circuits Toward Qubit Control — Tanaka et al. | 2023 | [10.1109/TASC.2023.3251304](https://doi.org/10.1109/tasc.2023.3251304)
- Design of SFQ Qubit Control Circuit With Adjustable Patterns — Weng et al. | 2024 | [10.1109/TASC.2024.3354676](https://doi.org/10.1109/tasc.2024.3354676)
- Low-Power SFQ Standard Cell Library for Qubit Control — Tanaka et al. | 2025 | [10.1109/TASC.2024.3521892](https://doi.org/10.1109/tasc.2024.3521892)
- A Multi-Qubit SFQ Control Architecture Using Recycled Bias Current — Weng et al. | 2026 | [10.1109/TASC.2026.3653712](https://doi.org/10.1109/tasc.2026.3653712)
- Monolithic Integration of a Superconducting Qubit with an SFQ Control Circuit — Miyajima et al. | 2023 | [10.1109/TASC.2023.3241270](https://doi.org/10.1109/tasc.2023.3241270)
- ★ Interfacing Superconducting Qubits With Cryogenic Logic: Readout — Howington et al. | 2019 | [10.1109/TASC.2019.2908884](https://doi.org/10.1109/tasc.2019.2908884) | MIT Lincoln Lab 低温逻辑直连读出
- SFQ-to-CMOS 接口系列（CMOS-to-SFQ Interface 2024、Ternary Digital Output 2025、4JL Gate Pulses 4K–50K 2025、Reed-Muller ECC Encoder 2026）— Mustafa & Köse / Li / Krause et al.
- SFQ Multiplier Circuits for Synthesizing GHz Waveforms — Castellanos-Beltran et al. (NIST) | 2021 | [10.1109/TASC.2021.3057013](https://doi.org/10.1109/tasc.2021.3057013)
- Side-Channel Leakage in SFQ Circuits — Mustafa et al. | 2023 | [10.1109/TASC.2023.3277864](https://doi.org/10.1109/tasc.2023.3277864)

**Review of Scientific Instruments（控制系统整机谱系——Bell 的直接同类）**：
- ★ The QICK (Quantum Instrumentation Control Kit) — Stefanazzi et al. | 2022 | 93(4):044709 | [10.1063/5.0076249](https://doi.org/10.1063/5.0076249) | RFSoC 直合成 6 GHz（CS4Q-S07）
- ★ Presto: a digital microwave platform (RFSoC) — Tholén et al. | 2022 | [10.1063/5.0101398](https://doi.org/10.1063/5.0101398) | **184–254 ns 反馈延迟**——亚微秒反馈同类
- ★ FPGA-based electronic system for control and readout of superconducting quantum processors — Yang et al. | 2022 | 93(7):074701 | [10.1063/5.0085467](https://doi.org/10.1063/5.0085467) | **反馈延迟 125 ns、时钟抖动 ~5 ps**
- ★ Manarat: A scalable QICK-based control system supporting synchronized control of 10 flux-tunable qubits — Silva et al. | 2026 | [10.1063/5.0301360](https://doi.org/10.1063/5.0301360) | QICK 多板同步扩展
- ICARUS-Q: Integrated control and readout unit — Park et al. | 2022 | 93(10) | [10.1063/5.0081232](https://doi.org/10.1063/5.0081232)
- A quantum computing measurement and control system with an FPGA-based scheduling system — Liu et al. | 2024 | [10.1063/5.0225000](https://doi.org/10.1063/5.0225000) | FPGA 调度器+指令压缩
- A co-simulation of superconducting qubit and control electronics — Jin et al. | 2023 | [10.1063/5.0163725](https://doi.org/10.1063/5.0163725)
- High-density wiring solution for 500-qubit scale superconducting QPs — Tian et al. | 2025 | [10.1063/5.0287659](https://doi.org/10.1063/5.0287659)
- NQontrol: open-source platform for digital control-loops — Darsow-Fromm et al. | 2020 | [10.1063/1.5135873](https://doi.org/10.1063/1.5135873)；PyRPL — Neuhaus et al. | 2024 | [10.1063/5.0178481](https://doi.org/10.1063/5.0178481) | 量子光学 FPGA 反馈控制环
- Switching, amplifying, and chirping diode lasers with current pulses — Buser et al. | 2024 | [10.1063/5.0230870](https://doi.org/10.1063/5.0230870) | **离子阱激光高带宽调制**
- Automation in quantum logic experiments with cold molecular ions — Karl et al. | 2026 | [10.1063/5.0309976](https://doi.org/10.1063/5.0309976)
- Microwave output stabilization of a qubit controller — Kurimoto et al. | 2026 | [10.1063/5.0311173](https://doi.org/10.1063/5.0311173)

**低温物理/超导期刊**（Cryogenics / SUST / JLTP，节选）：
- ★ Low power SFQ qubit control circuit without high-frequency input — Weng et al. | SUST 2023 | [10.1088/1361-6668/ace660](https://doi.org/10.1088/1361-6668/ace660)
- ★ Amplitude-controllable microwave pulse generator using SFQ pulse pairs — Shen et al. | SUST 2023 | [10.1088/1361-6668/ace8c7](https://doi.org/10.1088/1361-6668/ace8c7)
- Sub-nanosecond operations on superconducting quantum register based on Ramsey patterns — Bastrakova et al. | SUST 2022 | [10.1088/1361-6668/ac5505](https://doi.org/10.1088/1361-6668/ac5505) | **亚纳秒 SFQ 操控**
- Feedback-enabled low-latency AQFP logic using a mixed clocking scheme — He et al. | SUST 2025 | [10.1088/1361-6668/ada201](https://doi.org/10.1088/1361-6668/ada201) | **低温低延迟反馈逻辑**
- Frequency synchronization of SFQ oscillators — Yamanashi et al. | SUST 2021 | [10.1088/1361-6668/ac1d96](https://doi.org/10.1088/1361-6668/ac1d96)
- Optimal cooling configurations for QIP at mK temperatures — Poole et al. | Cryogenics 2022 | [10.1016/j.cryogenics.2022.103538](https://doi.org/10.1016/j.cryogenics.2022.103538)
- Towards scalable cryogenic quantum dot biasing using memristor-based DC sources — Mouny et al. | Cryogenics 2024 | [10.1016/j.cryogenics.2024.103910](https://doi.org/10.1016/j.cryogenics.2024.103910)
- Room Temperature ASIC for Cryogenic TES/SQUID Control and Readout — Chen et al. | JLTP 2022 | [10.1007/s10909-022-02833-6](https://doi.org/10.1007/s10909-022-02833-6)

**清单外高相关补充**：
- ★ Cryogenic time-division-multiplexed voltage control for scalable trapped-ion quantum processors — Ohira et al. | 2026 | Applied Physics Letters | [10.1063/5.0344625](https://doi.org/10.1063/5.0344625) | **低温 TDM 电压控制，直接对标离子阱布线瓶颈**
- Cryogenic Multiplexing Control Chip for a Superconducting Quantum Processor — Huang et al. | 2022 | Phys. Rev. Applied | [10.1103/PhysRevApplied.18.064046](https://doi.org/10.1103/physrevapplied.18.064046)
- Chip-Integrated Voltage Sources for Control of Trapped Ions — Stuart et al. | 2019 | Phys. Rev. Applied 11, 024010 | 片上 16×12-bit DAC ±8 V（离子阱电极控制硬件起点）

> **未检索到**：ICECS、IEEE TBioCAS、IEEE MWTL（独立检索无果，相关低温 LNA 均落在 IMS/T-MTT）。Cryogenics/SUST/JLTP 未做穷举（检索预算限制），已列条目为确认命中。

---

## 4. 量子信息专业期刊（PRX Quantum / PRX / PRL / PRA / PRApplied / PRResearch / npj QI / Quantum / QST / AQT / EPJ QT / ACM TQC / AVS QS / QIP / IJQI）

> 检索方法：Crossref REST API（按 ISSN/container-title 精确过滤）+ OpenAlex 双源交叉核验（2019–2026）。全部条目含 DOI。★ 为与 Bell 主题最直接相关。

### 4.1 PRX Quantum（反馈/动态电路/离子阱控制主阵地）

| 论文 | 作者 | 年份 | 卷期 | DOI | 关联 |
|---|---|---|---|---|---|
| ★ Repetitive Readout and Real-Time Control of Nuclear Spin Qubits in ¹⁷¹Yb Atoms | Huie et al. | 2023 | 4, 030337 | [10.1103/PRXQuantum.4.030337](https://doi.org/10.1103/PRXQuantum.4.030337) | 非破坏重复读出+实时控制 |
| ★ Trapped-Ion Quantum Computer with Robust Entangling Gates and Quantum Coherent Feedback | Manovitz et al. | 2022 | 3, 010347 | [10.1103/PRXQuantum.3.010347](https://doi.org/10.1103/PRXQuantum.3.010347) | **离子阱相干反馈** |
| ★ High-Fidelity, Multiqubit Generalized Measurements with Dynamic Circuits | Ivashkov et al. | 2024 | 5, 030315 | [10.1103/PRXQuantum.5.030315](https://doi.org/10.1103/PRXQuantum.5.030315) | MCM+前馈实现 POVM |
| ★ Efficient Long-Range Entanglement Using Dynamic Circuits | Bäumer et al. | 2024 | 5, 030339 | [10.1103/PRXQuantum.5.030339](https://doi.org/10.1103/PRXQuantum.5.030339) | 动态电路长程纠缠 |
| ★ Quasiprobabilistic Readout Correction of Midcircuit Measurements for Adaptive Feedback | Hashim et al. | 2025 | 6, 010307 | [10.1103/PRXQuantum.6.010307](https://doi.org/10.1103/PRXQuantum.6.010307) | 随机编译校正 MCM 读出误差 |
| ★ Readout Error Mitigation for Mid-Circuit Measurements and Feedforward | Koh et al. | 2026 | 7, 010317 | [10.1103/cj89-4h5t](https://doi.org/10.1103/cj89-4h5t) | 零深度代价消除 MCM/前馈读出偏差 |
| ★ Single Flux Quantum-Based Digital Control of Superconducting Qubits in a Multichip Module | Liu et al. | 2023 | 4, 030310 | [10.1103/PRXQuantum.4.030310](https://doi.org/10.1103/PRXQuantum.4.030310) | SFQ 数字控制+低延迟反馈 |
| ★ Digital Control of a Superconducting Qubit Using a Josephson Pulse Generator at 3 K | Howe et al. | 2022 | 3, 010350 | [10.1103/PRXQuantum.3.010350](https://doi.org/10.1103/PRXQuantum.3.010350) | 3K 数字脉冲发生器 |
| ★ How to Wire a 1000-Qubit Trapped-Ion Quantum Computer | Malinowski et al. | 2023 | 4, 040313 | [10.1103/PRXQuantum.4.040313](https://doi.org/10.1103/PRXQuantum.4.040313) | **千比特离子阱控制布线——Bell 扩展性直接对标** |
| ★ Scalable, High-Fidelity All-Electronic Control of Trapped-Ion Qubits | Löschnauer et al. | 2025 | 6, 040313 | [10.1103/h4wk-v31j](https://doi.org/10.1103/h4wk-v31j) | **全电学离子控制** |
| ★ Fast Design and Scaling of Multiqubit Gates in Large-Scale Trapped-Ion QCs | Peleg et al. | 2026 | — | [10.1103/r78y-3q89](https://doi.org/10.1103/r78y-3q89) | 大规模离子阱多比特门 |
| ★ Efficient Qubit Calibration by Binary-Search Hamiltonian Tracking | Berritta et al. | 2025 | 6, 030335 | [10.1103/77qg-p68k](https://doi.org/10.1103/77qg-p68k) | FPGA 实时频率跟踪+前馈补偿 |
| ★ Scalable Surface-Code Decoders with Parallelization in Time | Tan et al. | 2023 | 4, 040344 | [10.1103/PRXQuantum.4.040344](https://doi.org/10.1103/PRXQuantum.4.040344) | 滑动窗口并行译码 |
| Circuit-Based Leakage-to-Erasure Conversion in a Neutral-Atom Processor | Chow et al. | 2024 | 5, 040343 | [10.1103/PRXQuantum.5.040343](https://doi.org/10.1103/PRXQuantum.5.040343) | MCM 泄漏→擦除转换 |
| Gradient-Ascent Pulse Engineering with Feedback | Porotti et al. | 2023 | 4, 030305 | [10.1103/PRXQuantum.4.030305](https://doi.org/10.1103/PRXQuantum.4.030305) | 测量条件化 GRAPE |
| Measurement-Free Fault-Tolerant QEC in Near-Term Devices | Heußen et al. | 2024 | 5, 010333 | [10.1103/PRXQuantum.5.010333](https://doi.org/10.1103/PRXQuantum.5.010333) | 无 MCM 容错（对照） |
| Fault-Tolerant Code-Switching Protocols | Butt et al. | 2024 | 5, 020345 | [10.1103/PRXQuantum.5.020345](https://doi.org/10.1103/PRXQuantum.5.020345) | 自适应 QEC 码切换 |
| Adaptive Estimation of Drifting Noise in QEC | Bhardwaj et al. | 2026 | 7, 033024 | [10.1103/z1hc-nqw5](https://doi.org/10.1103/z1hc-nqw5) | 在线噪声跟踪 |
| Experimental Bayesian Calibration of Trapped-Ion Entangling Operations | Gerster et al. | 2022 | 3, 020350 | [10.1103/PRXQuantum.3.020350](https://doi.org/10.1103/PRXQuantum.3.020350) | 离子阱贝叶斯校准 |
| High-Speed Calibration without Qubit Reset | Werninghaus et al. | 2021 | 2, 020324 | [10.1103/PRXQuantum.2.020324](https://doi.org/10.1103/PRXQuantum.2.020324) | 免复位高速校准 |
| From Pulses to Circuits and Back Again | Magann et al. | 2021 | 2, 010101 | [10.1103/PRXQuantum.2.010101](https://doi.org/10.1103/PRXQuantum.2.010101) | 脉冲-电路层桥接 |
| Continuous Quantum Gate Sets and Pulse-Class Meta-Optimization | Preti et al. | 2022 | 3, 040311 | [10.1103/PRXQuantum.3.040311](https://doi.org/10.1103/PRXQuantum.3.040311) | 脉冲级编译 |
| Measurement-Driven Navigation in Many-Body Hilbert Space | Herasymenko et al. | 2023 | 4, 020347 | [10.1103/PRXQuantum.4.020347](https://doi.org/10.1103/PRXQuantum.4.020347) | 实时决策反馈 |
| Engineering Dynamically Decoupled Quantum Simulations with Trapped Ions | Morong et al. | 2023 | 4, 010334 | [10.1103/PRXQuantum.4.010334](https://doi.org/10.1103/PRXQuantum.4.010334) | 离子阱脉冲序列 |
| Individually Addressed Quantum Gate Interactions Using DD | Smith et al. | 2024 | 5, 030321 | [10.1103/PRXQuantum.5.030321](https://doi.org/10.1103/PRXQuantum.5.030321) | 微波单独寻址 |
| Running a Six-Qubit Quantum Circuit on a Silicon Spin-Qubit Array | Fernández de Fuentes et al. | 2026 | — | [10.1103/f285-l2v5](https://doi.org/10.1103/f285-l2v5) | 硅自旋阵列 |
| Analog Information Decoding of Bosonic QLDPC Codes | Berent et al. | 2024 | 5, 020349 | [10.1103/PRXQuantum.5.020349](https://doi.org/10.1103/PRXQuantum.5.020349) | 模拟信息译码 |
| Error Correction of Transversal CNOT Gates | Sahay et al. | 2025 | 6, 020326 | [10.1103/PRXQuantum.6.020326](https://doi.org/10.1103/PRXQuantum.6.020326) | 低复杂度 MWPM |
| Snakes and Ladders: Adapting the Surface Code to Defects | Leroux et al. | 2025 | 6, 040302 | [10.1103/815q-xjrb](https://doi.org/10.1103/815q-xjrb) | 缺陷适配译码 |
| Learning Feedback Control Strategies for Quantum Metrology | Fallani et al. | 2022 | 3, 020310 | [10.1103/PRXQuantum.3.020310](https://doi.org/10.1103/PRXQuantum.3.020310) | 学习型反馈 |

### 4.2 PRX / PRL / PRA / PRApplied / PRResearch

**Physical Review X**：
- ★ Realization of Real-Time Fault-Tolerant QEC — Ryan-Anderson et al. (Quantinuum) | 2021 | PRX 11, 041058 | [10.1103/PhysRevX.11.041058](https://doi.org/10.1103/PhysRevX.11.041058) | **10 比特 QCCD 实时译码+前馈闭环（CS4Q-S08）**
- ★ Fault-Tolerant Parity Readout on a Shuttling-Based Trapped-Ion QC — Hilder et al. | 2022 | PRX 12, 011032 | [10.1103/PhysRevX.12.011032](https://doi.org/10.1103/PhysRevX.12.011032) | **搬运式离子阱容错宇称读出**
- ★ Qubit-Reuse Compilation with Mid-Circuit Measurement and Reset — DeCross et al. | 2023 | PRX 13, 041057 | [10.1103/PhysRevX.13.041057](https://doi.org/10.1103/PhysRevX.13.041057) | **MCM+复位比特复用编译**
- Recovering Quantum Coherence through Real-Time Feedback — Goldblatt et al. | 2024 | PRX 14, 041056 | [10.1103/PhysRevX.14.041056](https://doi.org/10.1103/PhysRevX.14.041056)
- Model-Free Quantum Control with Reinforcement Learning — Sivak et al. | 2022 | PRX 12, 011059 | [10.1103/PhysRevX.12.011059](https://doi.org/10.1103/PhysRevX.12.011059)

**PRL**：
- ★ Exploiting Dynamic Quantum Circuits in a Quantum Algorithm — Córcoles et al. (IBM) | 2021 | PRL 127, 100501 | [10.1103/PhysRevLett.127.100501](https://doi.org/10.1103/PhysRevLett.127.100501) | **IBM 动态电路首篇**
- ★ Quantum Instruction Set Design for Performance — Huang et al. | 2023 | PRL 130, 070601 | [10.1103/PhysRevLett.130.070601](https://doi.org/10.1103/PhysRevLett.130.070601) | **QISA 性能设计**
- Quantum Fourier Transform Using Dynamic Circuits — Bäumer et al. | 2024 | PRL 133, 150602 | [10.1103/PhysRevLett.133.150602](https://doi.org/10.1103/PhysRevLett.133.150602)
- Mid-Circuit Cavity Measurement in a Neutral Atom Array — Deist et al. | 2022 | PRL 129, 203602 | [10.1103/PhysRevLett.129.203602](https://doi.org/10.1103/PhysRevLett.129.203602)
- Pauli Noise Learning for Mid-Circuit Measurements — Hines et al. | 2025 | PRL 134, 020602 | [10.1103/PhysRevLett.134.020602](https://doi.org/10.1103/PhysRevLett.134.020602)
- No-Collapse Accurate Quantum Feedback Control via Conditional State Tomography — Borah et al. | 2023 | PRL 131, 210803 | [10.1103/PhysRevLett.131.210803](https://doi.org/10.1103/PhysRevLett.131.210803)
- （背景）Feedback control of a solid-state qubit — Ristè et al. | 2012 | PRL 109, 240502 | CS4Q-P12 已收录

**PRApplied / PRA（核心节选）**：
- ★ Constant-Depth Fan-Out with Real-Time Feedforward on a Superconducting QP — Song et al. | 2025 | PRApplied 24, 024068 | [10.1103/q418-pydy](https://doi.org/10.1103/q418-pydy) | **实时前馈扇出**
- ★ Real-Time Feedback Control of Charge Sensing for Quantum Dot Qubits — Nakajima et al. | 2021 | PRApplied 15, L031003 | [10.1103/PhysRevApplied.15.L031003](https://doi.org/10.1103/PhysRevApplied.15.L031003) | FPGA 实时反馈
- ★ Chip-Integrated Voltage Sources for Control of Trapped Ions — Stuart et al. | 2019 | PRApplied 11, 024010 | [10.1103/PhysRevApplied.11.024010](https://doi.org/10.1103/PhysRevApplied.11.024010) | **离子阱片上电压源**
- ★ Fast High-Fidelity Readout of a Single Trapped-Ion Qubit via ML — Ding et al. | 2019 | PRApplied 12, 014038 | [10.1103/PhysRevApplied.12.014038](https://doi.org/10.1103/PhysRevApplied.12.014038) | **FPGA ML 离子荧光判别（>99.5% @170 µs）**
- ★ Cryogenic Multiplexing Control Chip for a Superconducting Quantum Processor — Huang et al. | 2022 | PRApplied 18, 064046 | [10.1103/PhysRevApplied.18.064046](https://doi.org/10.1103/physrevapplied.18.064046) | 低温复用控制芯片
- Hardware-Efficient Qubit Control with SFQ Pulse Sequences — Li et al. | 2019 | PRApplied 12, 014044 | [10.1103/PhysRevApplied.12.014044](https://doi.org/10.1103/PhysRevApplied.12.014044)
- Direct Pulse-Level Compilation of Arbitrary Quantum Logic Gates on Superconducting Qutrits — Cho et al. | 2024 | PRApplied 22, 034066 | [10.1103/PhysRevApplied.22.034066](https://doi.org/10.1103/PhysRevApplied.22.034066)
- Local Predecoder to Reduce the Bandwidth and Latency of QEC — Smith et al. | 2023 | PRApplied 19, 034050 | [10.1103/PhysRevApplied.19.034050](https://doi.org/10.1103/PhysRevApplied.19.034050)
- Feedforward Suppression of Readout-Induced Faults in QEC — Shirizly et al. | 2025 | PRA 112, L050602 | [10.1103/ght4-yqmb](https://doi.org/10.1103/ght4-yqmb)
- Noninvasive Mid-Circuit Measurement and Reset on Atomic Qubits — Chen et al. | 2026 | PRA 113, 012606 | [10.1103/ct8k-jgsn](https://doi.org/10.1103/ct8k-jgsn)
- Reducing Circuit Depth Using Measurements and Feedforward — Yeo et al. | 2025 | PRApplied 23, 054066 | [10.1103/PhysRevApplied.23.054066](https://doi.org/10.1103/PhysRevApplied.23.054066)
- qopt: Experiment-Oriented Qubit Simulation and Optimal Control Package — Teske et al. | 2022 | PRApplied 17, 034036 | [10.1103/PhysRevApplied.17.034036](https://doi.org/10.1103/PhysRevApplied.17.034036)
- Closed-Loop Optimization for High-Fidelity CZ Gates — Glaser et al. | 2025 | PRApplied 24, 024048 | [10.1103/pckq-2csc](https://doi.org/10.1103/pckq-2csc)
- Optimized Bayesian System Identification in Quantum Devices — Stace et al. | 2024 | PRApplied 21, 014012 | [10.1103/PhysRevApplied.21.014012](https://doi.org/10.1103/PhysRevApplied.21.014012)
- Pulse-Level Scheduling of Quantum Circuits for Neutral-Atom Devices — Tsai et al. | 2022 | PRApplied 18, 064035 | [10.1103/PhysRevApplied.18.064035](https://doi.org/10.1103/PhysRevApplied.18.064035)
- FPGA-Accelerated Exposure-Aware CNN for Fluorescence-Based Qubit Readout — Su et al. | 2026 | PRApplied 25, 054004 | [10.1103/vjzm-f13w](https://doi.org/10.1103/vjzm-f13w)
- Real-Time Magnetic Field Noise Correction Using Trapped-Ion Monitor Qubits — DeBry et al. | 2026 | PRA 113, 062467 | [10.1103/47tm-kkcl](https://doi.org/10.1103/47tm-kkcl)
- （ML 读出判别系列：Chatterjee 2025、Kent 2026×2、Duan 2021、Phuttitarn 2024、Cosco 2023 等，DOI 见存档 `agent_quantum_journals.md`）

**PRResearch**：
- ★ Experimental Advances with the QICK for Superconducting Quantum Hardware — Ding et al. | 2024 | 6, 013305 | [10.1103/PhysRevResearch.6.013305](https://doi.org/10.1103/PhysRevResearch.6.013305) | **QICK 同行评审进展版**
- Reinforcement Learning for Ion Shuttling on Trapped-Ion QCs — Schier et al. | 2026 | 8, 033360 | [10.1103/b7ck-8wh4](https://doi.org/10.1103/b7ck-8wh4) | RL 离子搬运
- Bespoke Pulse Design for Robust Rapid Two-Qubit Gates with Trapped Ions — Vedaie et al. | 2023 | 5, 023098 | [10.1103/PhysRevResearch.5.023098](https://doi.org/10.1103/PhysRevResearch.5.023098)
- Calibration-Conditioned FiLM Decoders for Low-Latency QEC — Stein et al. | 2026 | 8, 033194 | [10.1103/ftdh-t3yg](https://doi.org/10.1103/ftdh-t3yg)
- Data-Driven Decoding of QEC Codes Using GNNs — Lange et al. | 2025 | 7, 023181 | [10.1103/PhysRevResearch.7.023181](https://doi.org/10.1103/PhysRevResearch.7.023181)

### 4.3 npj Quantum Information（核心节选）

- ★ Real-time processing of stabilizer measurements in a bit-flip code — Ristè et al. | 2020 | 6, 71 | [10.1038/s41534-020-00304-y](https://doi.org/10.1038/s41534-020-00304-y) | **FPGA 实时译码+条件脉冲，延迟 590 ns——与 Bell 的 690 ns 直接可比**
- ★ Entanglement stabilization using ancilla-based parity detection and real-time feedback — Andersen et al. | 2019 | 5, 69 | [10.1038/s41534-019-0185-4](https://doi.org/10.1038/s41534-019-0185-4)
- ★ Microwave-multiplexed qubit controller using adiabatic superconductor logic — Takeuchi et al. | 2024 | 10, 53 | [10.1038/s41534-024-00849-2](https://doi.org/10.1038/s41534-024-00849-2) | 低温 SFQ 控制器
- ★ Control and readout of a 13-level trapped ion qudit — Low et al. | 2025 | 11, 85 | [10.1038/s41534-025-01031-y](https://doi.org/10.1038/s41534-025-01031-y) | 离子 qudit 全控制/读出栈
- ★ Closed-loop optimization of fast trapped-ion shuttling with sub-quanta excitation — Sterk et al. | 2022 | 8, 68 | [10.1038/s41534-022-00579-3](https://doi.org/10.1038/s41534-022-00579-3)
- ★ Feedback-based active reset of a spin qubit in silicon — Kobayashi et al. | 2023 | 9, 52 | [10.1038/s41534-023-00719-3](https://doi.org/10.1038/s41534-023-00719-3)
- ★ Real-time calibration with spectator qubits — Majumder et al. | 2020 | 6, 19 | [10.1038/s41534-020-0251-y](https://doi.org/10.1038/s41534-020-0251-y)
- A mid-circuit erasure check on a dual-rail cavity qubit — de Graaf et al. | 2025 | 11, 1 | [10.1038/s41534-024-00944-4](https://doi.org/10.1038/s41534-024-00944-4)
- Layered KIK error mitigation for dynamic circuits — Bar et al. | 2026 | 12, 79 | [10.1038/s41534-026-01207-0](https://doi.org/10.1038/s41534-026-01207-0)
- Pipeline quantum processor architecture for silicon spin qubits — Patomäki et al. | 2024 | 10 | [10.1038/s41534-024-00823-y](https://doi.org/10.1038/s41534-024-00823-y)
- High-fidelity trapped-ion qubit operations with scalable photonic modulators — Hogle et al. | 2023 | 9, 74 | [10.1038/s41534-023-00737-1](https://doi.org/10.1038/s41534-023-00737-1)
- Reprogrammable holographic optical addressing of trapped ions — Shih et al. | 2021 | 7, 57 | [10.1038/s41534-021-00396-0](https://doi.org/10.1038/s41534-021-00396-0)
- Power-optimal, stabilized entangling gate between trapped-ion qubits — Blümel et al. | 2021 | 7, 147 | [10.1038/s41534-021-00489-w](https://doi.org/10.1038/s41534-021-00489-w)
- Fault-tolerant operation with neutral atom logical qubits — Chung et al. | 2025 | 11, 193 | [10.1038/s41534-025-01095-w](https://doi.org/10.1038/s41534-025-01095-w)
- ML message-passing for scalable QLDPC decoding — Maan et al. | 2025 | 11, 78 | [10.1038/s41534-025-01033-w](https://doi.org/10.1038/s41534-025-01033-w)
- Almost-linear time decoding for QLDPC under circuit-level noise — deMarti iOlius et al. | 2026 | 12, 152 | [10.1038/s41534-026-01292-1](https://doi.org/10.1038/s41534-026-01292-1)
- （另有读出系列 Takeda 2024、Kiyama 2024、Harpt 2025、Park 2025、Kam 2024、Chen 2023、Nachman 2020；RL/校准系列 Niu 2019、Zhang 2019、Xu 2019、Nguyen 2021、Joas 2021、Gupta 2020、Li 2025、Vetter 2024、Henao 2023 等 25+ 条，全表见存档）

### 4.4 Quantum（社区 OA 刊）

**控制软件/编译/脉冲级**：
- ★ Pulser: pulse sequence design for programmable neutral-atom arrays — Silvério et al. | 2022 | 6, 629 | [10.22331/q-2022-01-24-629](https://doi.org/10.22331/q-2022-01-24-629) | 中性原子脉冲级控制事实标准
- ★ Automated Generation of Shuttling Sequences for a Linear Segmented Ion Trap QC — Durandau et al. | 2023 | 7, 1175 | [10.22331/q-2023-11-08-1175](https://doi.org/10.22331/q-2023-11-08-1175) | **离子搬运序列自动编译**
- ★ Quantum Circuit Compiler for a Shuttling-Based Trapped-Ion QC — Kreppel et al. | 2023 | 7, 1176 | [10.22331/q-2023-11-08-1176](https://doi.org/10.22331/q-2023-11-08-1176) | **电路→搬运执行完整编译栈（AQT 路线）**
- ★ Compiling Quantum Circuits for Dynamically Field-Programmable Neutral Atoms Array Processors — Tan et al. | 2024 | 8, 1281 | [10.22331/q-2024-03-14-1281](https://doi.org/10.22331/q-2024-03-14-1281)
- ★ Hybrid discrete-continuous compilation of trapped-ion circuits with deep RL — Preti et al. | 2024 | 8, 1343 | [10.22331/q-2024-05-14-1343](https://doi.org/10.22331/q-2024-05-14-1343)
- Mitigating controller noise in quantum gates using optimal control theory — Aroch et al. | 2024 | 8, 1482 | [10.22331/q-2024-09-25-1482](https://doi.org/10.22331/q-2024-09-25-1482) | **控制电子学噪声建模**
- Efficient quantum programming using EASE gates on a trapped-ion QC — Grzesiak et al. | 2022 | 6, 634 | [10.22331/q-2022-01-27-634](https://doi.org/10.22331/q-2022-01-27-634)
- Binary Control Pulse Optimization — Fei et al. | 2023 | 7, 892 | [10.22331/q-2023-01-04-892](https://doi.org/10.22331/q-2023-01-04-892)
- Latency considerations for stochastic optimizers in VQAs — Menickelly et al. | 2023 | 7, 949 | [10.22331/q-2023-03-16-949](https://doi.org/10.22331/q-2023-03-16-949) | 量子-经典延迟一等约束

**前馈/MCM/反馈**：
- State preparation by shallow circuits using feed forward — Buhrman et al. | 2024 | 8, 1552 | [10.22331/q-2024-12-09-1552](https://doi.org/10.22331/q-2024-12-09-1552) | 前馈 MCM 深度收益理论
- Deep RL for Quantum State Preparation with Weak Nonlinear Measurements — Porotti et al. | 2022 | 6, 747 | [10.22331/q-2022-06-28-747](https://doi.org/10.22331/q-2022-06-28-747)
- Learning Feedback Mechanisms for MB-VQ State Preparation — Alcalde Puente et al. | 2025 | 9, 1792 | [10.22331/q-2025-07-11-1792](https://doi.org/10.22331/q-2025-07-11-1792)

**实时/流式译码与控制器-译码器协同**：
- ★ Controller-decoder system requirements derived by implementing Shor's algorithm with surface code — Kurman et al. | 2026 | 10, 2170 | [10.22331/q-2026-07-22-2170](https://doi.org/10.22331/q-2026-07-22-2170) | **从算法反推控制器-译码器延迟/吞吐需求——Bell 指标论证直接参照**
- ★ Snowflake: A Distributed Streaming Decoder — Chan et al. | 2026 | 10, 2033 | [10.22331/q-2026-03-20-2033](https://doi.org/10.22331/q-2026-03-20-2033)
- Actis: A Strictly Local Union–Find Decoder — Chan et al. | 2023 | 7, 1183 | [10.22331/q-2023-11-14-1183](https://doi.org/10.22331/q-2023-11-14-1183)
- A scalable and fast ANN syndrome decoder for surface codes — Gicev et al. | 2023 | 7, 1058 | [10.22331/q-2023-07-12-1058](https://doi.org/10.22331/q-2023-07-12-1058)
- Quantum error correction for long chains of trapped ions — Ye et al. | 2025 | 9, 1920 | [10.22331/q-2025-11-27-1920](https://doi.org/10.22331/q-2025-11-27-1920) | 长链离子阱 QEC
- Adaptive syndrome measurements for Shor-style error correction — Tansuwannont et al. | 2023 | 7, 1075 | [10.22331/q-2023-08-08-1075](https://doi.org/10.22331/q-2023-08-08-1075)
- Diversity Methods for QEC Decoders Through Hardware Emulation — Garcia-Herrero et al. | 2026 | 10, 2071 | [10.22331/q-2026-04-16-2071](https://doi.org/10.22331/q-2026-04-16-2071)
- （另有表面码译码综述 2024、擦除译码 2024、色码译码 2025、BB 码 ML 译码 2026、实时光子数分辨 2024、自适应层析 2023 等，DOI 见存档）

### 4.5 QST / ACM TQC / EPJ QT / AQT / AVS QS / QIP / IJQI（核心节选）

**Quantum Science and Technology（IOP）**：
- ★ Qiskit pulse: programming quantum computers through the cloud with pulses — Alexander et al. | 2020 | 5(4), 044006 | [10.1088/2058-9565/aba404](https://doi.org/10.1088/2058-9565/aba404) | **OpenPulse 脉冲级编程**
- ★ An open-source, industrial-strength optimizing compiler (Qiskit Terra) — Smith et al. | 2020 | 5(4), 044001 | [10.1088/2058-9565/ab9acb](https://doi.org/10.1088/2058-9565/ab9acb)
- ★ t|ket⟩: a retargetable compiler for NISQ devices — Sivarajah et al. | 2020 | 6(1), 014003 | [10.1088/2058-9565/ab8e92](https://doi.org/10.1088/2058-9565/ab8e92)
- ★ NetQASM — a low-level ISA for hybrid quantum–classical programs — Dahlberg et al. | 2022 | 7(3), 035023 | [10.1088/2058-9565/ac753f](https://doi.org/10.1088/2058-9565/ac753f) | **量子-经典控制流低层 ISA**
- ★ Qibosoq: an open-source framework for quantum circuit RFSoC programming — Carobene et al. | 2025 | 10(3), 035010 | [10.1088/2058-9565/adcd97](https://doi.org/10.1088/2058-9565/adcd97) | **RFSoC 控制栈框架（QICK+Qibo）**
- Software tools for quantum control (Q-CTRL) — Ball et al. | 2021 | 6(4), 044011 | [10.1088/2058-9565/abdca6](https://doi.org/10.1088/2058-9565/abdca6)
- ★ Control electronics for semiconductor spin qubits — Geck et al. | 2019 | 5(1), 015004 | [10.1088/2058-9565/ab5e07](https://doi.org/10.1088/2058-9565/ab5e07) | 综述
- ★ Speeding up qubit control with bipolar SFQ pulse sequences — Vozhakov et al. | 2023 | 8(3), 035024 | [10.1088/2058-9565/acd9e6](https://doi.org/10.1088/2058-9565/acd9e6)
- ★ Techniques for combining fast local decoders with global decoders under circuit-level noise — Chamberland et al. | 2023 | 8(4), 045011 | [10.1088/2058-9565/ace64d](https://doi.org/10.1088/2058-9565/ace64d) | **快局部+慢全局分层译码**
- Real-time frequency estimation of a qubit without single-shot-readout — Zohar et al. | 2023 | 8(3), 035017 | [10.1088/2058-9565/acd415](https://doi.org/10.1088/2058-9565/acd415)
- Optimal calibration of gates in trapped-ion QCs — Maksymov et al. | 2021 | 6(3), 034009 | [10.1088/2058-9565/abf718](https://doi.org/10.1088/2058-9565/abf718)
- A memristive neural decoder for cryogenic FT-QEC — Yon et al. | 2025 | 10(2), 025049 | [10.1088/2058-9565/adc3ba](https://doi.org/10.1088/2058-9565/adc3ba)
- Spatially parallel decoding for multi-qubit lattice surgery — Lin et al. | 2025 | 10(3), 035007 | [10.1088/2058-9565/adc6b6](https://doi.org/10.1088/2058-9565/adc6b6)
- Cryogenic ion trap system for near-field microwave-driven quantum logic — Weber et al. | 2023 | 9(1), 015007 | [10.1088/2058-9565/acfba8](https://doi.org/10.1088/2058-9565/acfba8)
- Scalable chip-based 3D ion traps — Jordan et al. | 2025 | 10(4), 045005 | [10.1088/2058-9565/adf2db](https://doi.org/10.1088/2058-9565/adf2db)
- Characterization of inner control electrode shapes for multi-layer surface-electrode ion traps — Ungerechts et al. | 2026 | 11(3), 035077 | [10.1088/2058-9565/ae917b](https://doi.org/10.1088/2058-9565/ae917b)
- Full programmable QC with trapped-ions using semi-global fields — Solomons et al. | 2026 | 11(2), 025036 | [10.1088/2058-9565/ae573c](https://doi.org/10.1088/2058-9565/ae573c)
- Hardware Trojans in multitone generators（控制安全） — Adedokun et al. | 2026 | 11(2), 025023 | [10.1088/2058-9565/ae4eb8](https://doi.org/10.1088/2058-9565/ae4eb8)
- （另有校准/脉冲优化/自动调优系列 15+ 条，DOI 见存档）

**ACM Transactions on Quantum Computing**：
- ★ OpenQASM 3: A Broader and Deeper Quantum Assembly Language — Cross, Javadi-Abhari, Alexander, de Beaudrap, Bishop, Heidel, Ryan, Sivarajah, Smolin, Gambetta, Johnson | 2022 | 3(3), Art.12 | [10.1145/3505636](https://doi.org/10.1145/3505636) | **实时控制栈核心语言（CS4Q-P10）**
- ★ Automatic Qubit Characterization and Gate Optimization with QubiC — Y. Xu et al. | 2022 | 4(1) | [10.1145/3529397](https://doi.org/10.1145/3529397) | QubiC 全自动校准
- ★ A Classical Architecture for Digital Quantum Computers — F. Zhang et al. | 2023 | 5(1) | [10.1145/3626199](https://doi.org/10.1145/3626199) | **分层 QISA 下沉 RISC-V MMIO——与 Bell 的 RISC-V 后端同构**
- ★ QASMTrans: End-to-End QASM Compilation with Pulse Generation — Hoyt et al. | 2026 | online first | [10.1145/3837861](https://doi.org/10.1145/3837861) | **JIT QASM→脉冲直连 QICK FPGA**
- ★ AC/DC: Automated Compilation for Dynamic Circuits — Niu et al. | 2026 | online first | [10.1145/3846519](https://doi.org/10.1145/3846519) | **动态电路自动编译（MCM/复位/条件前馈）**
- ★ Efficient Compilation for Shuttling Trapped-Ion Machines via the Position Graph Abstraction — Bach et al. | 2026 | 7(4) | [10.1145/3831246](https://doi.org/10.1145/3831246) | **离子阱搬运编译**
- ★ Quingo: A Programming Framework for Heterogeneous Quantum-Classical Computing — X. Fu et al. | 2021 | 2(4) | [10.1145/3483528](https://doi.org/10.1145/3483528) | **eQASM 团队时序暴露编程框架**
- ★ QIRO: A SSA-based Quantum Program Representation — Ittah et al. | 2022 | 3(3) | [10.1145/3491247](https://doi.org/10.1145/3491247) | **SSA 风格量子 IR（与 Bell SSA 流水线同类）**
- ARQUIN: Architectures for Multinode Superconducting QCs — Ang et al. | 2024 | 5(3) | [10.1145/3674151](https://doi.org/10.1145/3674151)
- SpinQ: Compilation Strategies for Scalable Spin-Qubit Architectures — Paraskevopoulos et al. | 2023 | 5(1) | [10.1145/3624484](https://doi.org/10.1145/3624484)
- qSIEVE: Efficient qLDPC Memory via Systolic Movement in Atom Arrays — Viszlai et al. | 2026 | 7(2) | [10.1145/3779066](https://doi.org/10.1145/3779066)
- TimeStitch: Exploiting Slack to Mitigate Decoherence — K. N. Smith et al. | 2022 | 4(1) | [10.1145/3548778](https://doi.org/10.1145/3548778)
- Switching Time Optimization for Binary Quantum Optimal Control — Fei et al. | 2025 | 6(1) | [10.1145/3670416](https://doi.org/10.1145/3670416)
- Quantum Measurement Classification Using Statistical Learning — Utt et al. | 2024 | 5(2) | [10.1145/3644823](https://doi.org/10.1145/3644823)
- PyMatching: MWPM decoding package — Higgott | 2022 | 3(3) | [10.1145/3505637](https://doi.org/10.1145/3505637)
- （另有 ML 症候译码 2024、标准单元设计 2025、QuL 2025、qprof 2022、FIDDLE 2025、QLOPS 2026、Addressable Quantum Gates 2023 等，DOI 见存档）

**EPJ Quantum Technology**：
- ★ Optimising the quantum/classical interface with a multi-level hardware abstraction layer — Barnes et al. (Riverlane) | 2023 | 10(1), 36 | [10.1140/epjqt/s40507-023-00192-z](https://doi.org/10.1140/epjqt/s40507-023-00192-z) | **多级硬件抽象层降接口延迟**
- ★ CIRCUS: an autonomous control system for antimatter, atomic and quantum physics experiments — Volponi et al. | 2024 | 11(1), 10 | [10.1140/epjqt/s40507-024-00220-6](https://doi.org/10.1140/epjqt/s40507-024-00220-6) | **基于 ARTIQ/Sinara 的实时控制系统（CERN）**
- ★ Exploring the FPGA and ASIC design space of BP+OSD decoders — Báscones et al. | 2025 | 12(1), 140 | [10.1140/epjqt/s40507-025-00446-y](https://doi.org/10.1140/epjqt/s40507-025-00446-y)
- ★ An open-source FPGA control architecture for solid-state spin-photon interfaces — Park et al. | 2026 | online first | [10.1140/epjqt/s40507-026-00555-2](https://doi.org/10.1140/epjqt/s40507-026-00555-2) | 扩展 QICK overlay
- Comparative study of high-Jc/low-Jc SFQ microwave generators for transmon control — Shen et al. | 2026 | 13(1), 68 | [10.1140/epjqt/s40507-026-00514-x](https://doi.org/10.1140/epjqt/s40507-026-00514-x)
- Stacking the odds: full-stack quantum system design space exploration — Safi et al. | 2025 | 12(1) | [10.1140/epjqt/s40507-025-00413-7](https://doi.org/10.1140/epjqt/s40507-025-00413-7)
- Quantum algorithm compiler for semiconductor spin qubits — Tadokoro et al. | 2025 | 12(1), 81 | [10.1140/epjqt/s40507-025-00384-9](https://doi.org/10.1140/epjqt/s40507-025-00384-9)
- A scalable architecture for QIP: partitioning, placement, scheduling for minimized circuit latency — Alimohammadi et al. | 2026 | 13(1), 56 | [10.1140/epjqt/s40507-026-00519-6](https://doi.org/10.1140/epjqt/s40507-026-00519-6)
- Impact of control signal phase noise on qubit fidelity — Barsotti et al. | 2026 | online first | [10.1140/epjqt/s40507-026-00546-3](https://doi.org/10.1140/epjqt/s40507-026-00546-3)
- Quantum optimal control in quantum technologies (strategic report) — Koch et al. | 2022 | 9(1), 19 | [10.1140/epjqt/s40507-022-00138-x](https://doi.org/10.1140/epjqt/s40507-022-00138-x)
- Engineering cryogenic setups for 100-qubit scale superconducting circuit systems — Krinner et al. | 2019 | 6(1), 2 | [10.1140/epjqt/s40507-019-0072-0](https://doi.org/10.1140/epjqt/s40507-019-0072-0)
- （另有 Transformer 译码 2025/2026、软症候 LDPC 2023、中性原子综述 2023、低温滤波/热建模等 15+ 条，DOI 见存档）

**AVS Quantum Science**：
- ★ Shuttling-based trapped-ion quantum information processing — Kaushal et al. | 2020 | 2(1) | [10.1116/1.5126186](https://doi.org/10.1116/1.5126186) | **离子搬运/波形硬件综述**
- ★ Toolchain for shuttling trapped-ion qubits in segmented traps — Conta et al. | 2026 | 8(2) | [10.1116/5.0323942](https://doi.org/10.1116/5.0323942) | **分段阱搬运编程工具链**
- ★ The impact of hardware specifications on reaching quantum advantage in the FT regime — Webber et al. | 2022 | 4(1) | [10.1116/5.0073075](https://doi.org/10.1116/5.0073075) | **控制/测量硬件规格对容错的约束**
- Ytterbium ion trap quantum computing: state-of-the-art — Nop et al. | 2021 | 3(4), 044101 | [10.1116/5.0065951](https://doi.org/10.1116/5.0065951)
- Comparison of cloud-based ion trap and superconducting architectures — Blinov et al. | 2021 | 3(3) | [10.1116/5.0058187](https://doi.org/10.1116/5.0058187)
- Design of fully integrated 45 nm CMOS SoC receiver for transmon readout — Salmanogli | 2025 | 7(4) | [10.1116/5.0291986](https://doi.org/10.1116/5.0291986)
- Design and fabrication of ion traps for low RF power dissipation — Sterk et al. | 2026 | 8(2) | [10.1116/5.0332336](https://doi.org/10.1116/5.0332336)

**AQT（Wiley）**：
- ★ Efficient Qubit Routing for a Globally Connected Trapped Ion QC — Webber et al. | 2020 | 3(8) | [10.1002/qute.202000027](https://doi.org/10.1002/qute.202000027) | 离子搬运编译/路由
- 2D Linear Trap Array for QIP — Holz et al. | 2020 | 3(11) | [10.1002/qute.202000031](https://doi.org/10.1002/qute.202000031)
- Generating Microwave Signals Using SFQ Pulses for Controlling Qubit — Shen et al. | 2024 | 7(8) | [10.1002/qute.202400001](https://doi.org/10.1002/qute.202400001)
- Open and Closed Loop Approaches for Energy Efficient Quantum Optimal Control — Fauquenot et al. | 2025 | 8(10) | [10.1002/qute.202400690](https://doi.org/10.1002/qute.202400690)
- （另有光镊/离子阱芯片/ML 噪声表征等 10+ 条，DOI 见存档）

**QIP（Springer）**（偏理论最优控制/反馈，18 条全表见存档，核心）：
- ★ XIRAC-Q: a near-real-time quantum operating system scheduling structure — Zirak et al. | 2023 | 22(11), 403 | [10.1007/s11128-023-04155-2](https://doi.org/10.1007/s11128-023-04155-2) | **近实时量子 OS 调度**
- Hierarchical system mapping for large-scale FTQC — Hwang & Choi | 2021 | 20(6), 215 | [10.1007/s11128-021-03151-8](https://doi.org/10.1007/s11128-021-03151-8)
- Preparing quantum statistical ensembles using mid-circuit measurements — Stenger et al. | 2024 | 23(6), 219 | [10.1007/s11128-024-04412-y](https://doi.org/10.1007/s11128-024-04412-y)
- Discriminating two non-orthogonal states against decoherence by feedback control — Yang et al. | 2020 | 19(2), 69 | [10.1007/s11128-019-2568-z](https://doi.org/10.1007/s11128-019-2568-z)

**IJQI（World Scientific）**：本主题产出极少，仅 FPGA QKD 纠错（Tang 2019, [10.1142/s0219749919500138](https://doi.org/10.1142/s0219749919500138)）、DL 控制 STIRAP（Moro 2021）、no-knowledge 反馈（Rao 2021）等 6 条边缘命中。

> **重要勘误**：**"Nature Quantum Information" 期刊不存在**（经 OpenAlex/DOAJ/nature.com 三重核验，截至 2026-09-29）。Nature 旗下量子信息刊为 **npj Quantum Information**（ISSN 2056-6387，2015 创刊）。提示词与投稿指南基准表中 "Nature Quantum Information ~25 IF" 一行应予更正。

---

## 5. EDA / 设计自动化 venue（DAC / ICCAD / DATE / ASP-DAC / FCCM / CGO / CC / ISLPED / ICRC / PACT / TCAD）

> 数据来源：EDA agent 的 Crossref 全量枚举（16 个 venue，1131 条原始记录，见 `tmp_usage/master.out`），以下为主题过滤后的测控相关条目。★★ 为与 Bell 最直接对标。注意：**2026 年 DAC/ICCAD 的量子论文 Crossref 未收录**（仅 arXiv comment 可见），该两 venue 2026 覆盖不完整。

### 5.1 DAC（Design Automation Conference）

| 年份 | 论文 | 一作 | DOI | 关联 |
|---|---|---|---|---|
| 2025 | ★ EPOC: An Efficient Pulse Generation Framework with Advanced Synthesis for Quantum Circuits | Cheng | [10.1109/DAC63849.2025.11133150](https://doi.org/10.1109/dac63849.2025.11133150) | **脉冲生成综合框架** |
| 2025 | ★ DyREM: Dynamically Mitigating Quantum Readout Error with Embedded Accelerator | Zhou | [10.1109/DAC63849.2025.11132635](https://doi.org/10.1109/dac63849.2025.11132635) | 嵌入式读出误差缓解加速器 |
| 2025 | ★ Efficient and Scalable Architectures for Multi-level Superconducting Qubit Readout | Mude | [10.1109/DAC63849.2025.11133314](https://doi.org/10.1109/dac63849.2025.11133314) | 多能级读出架构 |
| 2025 | ★ KLiNQ: Knowledge Distillation-Assisted Lightweight NN for Qubit Readout on FPGA | Guo | [10.1109/DAC63849.2025.11132854](https://doi.org/10.1109/dac63849.2025.11132854) | FPGA 轻量读出 NN |
| 2025 | Weighted Range-Constrained Ising-Model Decoder for QEC | Guo | [10.1109/DAC63849.2025.11133309](https://doi.org/10.1109/dac63849.2025.11133309) | Ising 模型译码器 |
| 2025 | Hardware-Software Co-design for Distributed Quantum Computing | Liu | [10.1109/DAC63849.2025.11132538](https://doi.org/10.1109/dac63849.2025.11132538) | 分布式量子软硬件协同 |
| 2024 | ★ TITAN: A Fast and Distributed Large-Scale Trapped-Ion NISQ Computer | Wang | [10.1145/3649329.3655908](https://doi.org/10.1145/3649329.3655908) | **分布式离子阱体系结构/编译——Bell 对比基线** |
| 2024 | ★ Q-Pilot: Field Programmable Qubit Array Compilation with Flying Ancillas | Wang | [10.1145/3649329.3658470](https://doi.org/10.1145/3649329.3658470) | 中性原子 FPQA 编译 |
| 2024 | ★ SpREM: Exploiting Hamming Sparsity for Fast Quantum Readout Error Mitigation | Zhang | [10.1145/3649329.3655675](https://doi.org/10.1145/3649329.3655675) | 快速读出误差缓解 |
| 2024 | Fast Virtual Gate Extraction for Silicon Quantum Dot Devices | Che | [10.1145/3649329.3655923](https://doi.org/10.1145/3649329.3655923) | 硅量子点虚拟门提取 |
| 2024 | Hybrid Circuit Mapping: Full Spectrum of Neutral Atom QCs | Schmid | [10.1145/3649329.3655959](https://doi.org/10.1145/3649329.3655959) | 中性原子映射 |
| 2024 | RCGP: Automatic Synthesis for Reversible Quantum-Flux-Parametron Logic | Fu | [10.1145/3649329.3655950](https://doi.org/10.1145/3649329.3655950) | AQFP 逻辑综合 |
| 2023 | (Invited) Predictive analytics for cryogenic CMOS in future QC systems | Joshi (IBM) | [10.1109/DAC56929.2023.10247978](https://doi.org/10.1109/dac56929.2023.10247978) | cryo-CMOS 预测分析 |
| 2023 | Design Automation for Cryogenic CMOS Circuits | van Santen | [10.1109/DAC56929.2023.10247824](https://doi.org/10.1109/dac56929.2023.10247824) | 低温 CMOS 设计自动化 |
| 2023 | Hybrid Gate-Pulse Model for Variational Quantum Algorithms | Liang | [10.1109/DAC56929.2023.10247923](https://doi.org/10.1109/dac56929.2023.10247923) | 门-脉冲混合模型 |
| 2023 | Cryogenic In-Memory Matrix-Vector Multiplication using FE-SQUID | Alam | [10.1109/DAC56929.2023.10247669](https://doi.org/10.1109/dac56929.2023.10247669) | 低温存内计算 |
| 2021 | ★ QECOOL: On-Line Quantum Error Correction with a Superconducting Decoder for Surface Code | Ueno | [10.1109/DAC18074.2021.9586326](https://doi.org/10.1109/dac18074.2021.9586326) | **在线表面码超导译码器（SFQ）** |
| 2021 | Mitigating Crosstalk via Commutativity-Based Instruction Reordering | Xie | [10.1109/DAC18074.2021.9586145](https://doi.org/10.1109/dac18074.2021.9586145) | 指令重排抑串扰 |
| 2020 | Codar: A Contextual Duration-Aware Qubit Mapping | Deng | [10.1109/DAC18072.2020.9218561](https://doi.org/10.1109/dac18072.2020.9218561) | 时长感知映射 |

### 5.2 ICCAD

| 年份 | 论文 | 一作 | DOI | 关联 |
|---|---|---|---|---|
| 2025 | ★★ CLASS: A Controller-Centric Layout Synthesizer for Dynamic Quantum Circuits | Chen | [10.1109/ICCAD66269.2025.11240650](https://doi.org/10.1109/iccad66269.2025.11240650) | **控制器中心的动态电路布局综合** |
| 2025 | ★ SOME: Symmetric One-Hot Matching Elector — A Lightweight Microsecond Decoder for QEC | Guo | [10.1109/ICCAD66269.2025.11240965](https://doi.org/10.1109/iccad66269.2025.11240965) | **微秒级轻量译码器** |
| 2025 | J2Place: Multiphase Clocking-Oriented Length-Matching Placement for RSFQ Circuits | Fu | [10.1109/ICCAD66269.2025.11240637](https://doi.org/10.1109/iccad66269.2025.11240637) | RSFQ 时钟感知布局 |
| 2025 | Routing-Aware Placement for Zoned Neutral Atom-based QC | Stade | [10.1109/ICCAD66269.2025.11240721](https://doi.org/10.1109/iccad66269.2025.11240721) | 分区中性原子布局 |
| 2025 | An Efficient Routing Optimization Framework for Silicon-Based Spin-Qubit Devices | Huang | [10.1109/ICCAD66269.2025.11240960](https://doi.org/10.1109/iccad66269.2025.11240960) | 自旋比特路由 |
| 2024 | ★ On Reducing the Execution Latency of Superconducting QPs via Quantum Job Scheduling | Wu | [10.1145/3676536.3676678](https://doi.org/10.1145/3676536.3676678) | **作业调度降执行延迟** |
| 2024 | SMT-based Layout Synthesis for Silicon-based QC with Crossbar Architecture | Huang | [10.1145/3676536.3676819](https://doi.org/10.1145/3676536.3676819) | crossbar 自旋布局综合 |
| 2024 | RL-Enhanced Analog Circuit Generator for Cryogenic Temperatures (130/180nm OpenPDKs) | Hammoud | [10.1145/3676536.3676823](https://doi.org/10.1145/3676536.3676823) | 低温模拟电路自动生成 |
| 2023 | QPulseLib（脉冲库，agent 二手核实） | — | 待补 DOI | 脉冲级控制库 |
| 2020 | DisQ: 基于 OpenPulse 的脉冲级编译（agent 二手核实） | — | 待补 DOI | 脉冲级编译先声 |

### 5.3 DATE

| 年份 | 论文 | 一作 | DOI | 关联 |
|---|---|---|---|---|
| 2025 | ★★ Low-Latency Digital Feedback for Stochastic Quantum Calibration Using Cryogenic CMOS | Miller | [10.23919/DATE64628.2025.10992779](https://doi.org/10.23919/date64628.2025.10992779) | **低温 CMOS 低延迟数字反馈——与 Bell 亚微秒反馈最直接对标** |
| 2025 | ★ Design of an FPGA-Based Neutral Atom Rearrangement Accelerator | Guo | [10.23919/DATE64628.2025.10992700](https://doi.org/10.23919/date64628.2025.10992700)（arXiv:2411.12401） | FPGA 原子重排加速器 |
| 2025 | ★ CIM-Based Parallel Fully FFNN Surface Code High-Level Decoder | Wang | [10.23919/DATE64628.2025.10993142](https://doi.org/10.23919/date64628.2025.10993142) | 存内计算表面码译码器 |
| 2025 | Empowering Quantum Error Traceability with MoE for Automatic Calibration | Li | [10.23919/DATE64628.2025.10993074](https://doi.org/10.23919/date64628.2025.10993074) | 自动校准 |
| 2025 | Transistor Aging and Circuit Reliability at Cryogenic Temperatures | Diaz-Fortuny | [10.23919/DATE64628.2025.10992904](https://doi.org/10.23919/date64628.2025.10992904) | 低温器件老化 |
| 2025 | qGDP: Quantum Legalization and Detailed Placement for Superconducting QCs | Zhang | [10.23919/DATE64628.2025.10993236](https://doi.org/10.23919/date64628.2025.10993236) | 超导芯片详细布局 |
| 2025 | Optimal State Preparation for Logical Arrays on Zoned Neutral Atom QCs | Stade | [10.23919/DATE64628.2025.10993241](https://doi.org/10.23919/date64628.2025.10993241) | 分区中性原子态制备 |
| 2026 | Quantum Circuit Compilation for Superconducting Bus-Resonator Architectures | Hopf | [10.23919/DATE69613.2026.11539523](https://doi.org/10.23919/date69613.2026.11539523) | 总线谐振腔架构编译 |
| 2026 | Optimal Compilation of Syndrome Extraction Circuits for General QLDPC Codes | Zhang | [10.23919/DATE69613.2026.11539585](https://doi.org/10.23919/date69613.2026.11539585) | 症候提取电路编译 |
| 2026 | SurgeQ: Ultra-Fast Quantum Processor Design and Crosstalk-Aware Circuit Execution | Chen | [10.23919/DATE69613.2026.11539678](https://doi.org/10.23919/date69613.2026.11539678) | 串扰感知执行 |
| 2024 | ★★ A Scalable Low-Latency FPGA Architecture for Spin Qubit Control Through Direct Digital Synthesis | Toubeix | [10.23919/DATE58400.2024.10546620](https://doi.org/10.23919/date58400.2024.10546620) | **低延迟 FPGA DDS 比特控制** |
| 2024 | ★ From Master Equation to SPICE: A Platform to Model Cryo-CMOS Control for Qubits | Pešić | [10.23919/DATE58400.2024.10546593](https://doi.org/10.23919/date58400.2024.10546593) | cryo-CMOS 控制建模 |
| 2024 | ★ Depth-Optimal Addressing of 2D Qubit Array with 1D Controls | Tan | [10.23919/DATE58400.2024.10546763](https://doi.org/10.23919/date58400.2024.10546763) | **控制线寻址优化** |
| 2024 | ★ Towards Cycle-based Shuttling for Trapped-Ion Quantum Computers | Schoenberger | [10.23919/DATE58400.2024.10546506](https://doi.org/10.23919/date58400.2024.10546506) | 离子阱周期级搬运 |
| 2024 | JPlace: Clock-Aware Length-Matching Placement for RSFQ Circuits | Chen | [10.23919/DATE58400.2024.10546887](https://doi.org/10.23919/date58400.2024.10546887) | RSFQ 布局 |
| 2024 | SuperFlow: RTL-to-GDS Flow for AQFP Superconducting Circuits | Xie | [10.23919/DATE58400.2024.10546680](https://doi.org/10.23919/date58400.2024.10546680) | AQFP 全流程 |
| 2023 | ★ Quantum Measurement Discrimination using Cumulative Distribution Functions | Utt | [10.23919/DATE56975.2023.10136989](https://doi.org/10.23919/date56975.2023.10136989) | **测量判别（CDF 方法）** |
| 2022 | ★★ Muzzle the Shuttle: Efficient Compilation for Multi-Trap Trapped-Ion Quantum Computers | Saki | [10.23919/DATE54114.2022.9774619](https://doi.org/10.23919/date54114.2022.9774619) | **多阱离子搬运编译（arXiv:2111.07961）** |
| 2022 | ★★ A Cryo-CMOS Transmon Qubit Controller and Verification with FPGA Emulation | Tien (IBM) | [10.23919/DATE54114.2022.9774702](https://doi.org/10.23919/date54114.2022.9774702) | **cryo-CMOS 控制器+FPGA 验证** |
| 2022 | Full-stack quantum computing systems in the NISQ era | Bandic | [10.23919/DATE54114.2022.9774643](https://doi.org/10.23919/date54114.2022.9774643) | 全栈编译综述 |
| 2021 | ★ Exact Physical Design of Quantum Circuits for Ion-Trap-based Quantum Architectures | Keszocze | [10.23919/DATE51398.2021.9474188](https://doi.org/10.23919/date51398.2021.9474188) | 离子阱物理设计 |
| 2021 | Circuit models for the co-simulation of superconducting QC systems | Acharya | [10.23919/DATE51398.2021.9474086](https://doi.org/10.23919/date51398.2021.9474086) | 超导系统协同仿真 |
| 2021 | Structured Optimized Architecting of Full-Stack Quantum Systems | Almudever | [10.23919/DATE51398.2021.9474197](https://doi.org/10.23919/date51398.2021.9474197) | 全栈架构方法学 |
| 2020 | Quantum Computer Architecture: Towards Full-Stack Quantum Accelerators | Bertels (TU Delft) | [10.23919/DATE48585.2020.9116502](https://doi.org/10.23919/date48585.2020.9116502) | 全栈量子加速器 |
| 2020 | A Timing Uncertainty-Aware Clock Tree Topology Generation Algorithm for SFQ Circuits | Shahsavani | [10.23919/DATE48585.2020.9116331](https://doi.org/10.23919/date48585.2020.9116331) | SFQ 时钟树 |
| 2019 | Challenges and the status of superconducting SFQ technology | Katam | [10.23919/DATE.2019.8747356](https://doi.org/10.23919/date.2019.8747356) | SFQ 技术现状 |

### 5.4 ASP-DAC

| 年份 | 论文 | 一作 | DOI | 关联 |
|---|---|---|---|---|
| 2026 | ★★ Quantum Instruction Set Architecture: The Good, the Bad, and the Future | Chen | [10.1109/ASP-DAC66049.2026.11420359](https://doi.org/10.1109/asp-dac66049.2026.11420359) | **QISA 综述/展望——与 Bell 指令层直接相关** |
| 2026 | ★ Hardware-Efficient Union-Find Decoder Towards Scalable Topological Quantum Codes | Liang | [10.1109/ASP-DAC66049.2026.11420605](https://doi.org/10.1109/asp-dac66049.2026.11420605) | 硬件高效 Union-Find 译码器 |
| 2026 | A Scalable Qubit Mapping and Shuttling Framework for Neutral Atom Devices | Hsieh | [10.1109/ASP-DAC66049.2026.11420425](https://doi.org/10.1109/asp-dac66049.2026.11420425) | 中性原子映射+搬运 |
| 2025 | ★ Cryo-CMOS Analog Circuits for Spin Qubit Control | Miki | [10.1145/3658617.3703141](https://doi.org/10.1145/3658617.3703141) | 低温模拟控制电路 |
| 2025 | ★ Compilation for Dynamically Field-Programmable Qubit Arrays with Near-Optimal Scheduling | Tan | [10.1145/3658617.3697778](https://doi.org/10.1145/3658617.3697778) | FPQA 编译调度 |
| 2025 | Physics-based Modeling to Extend a MOSFET Compact Model for Cryogenic Operation | Navarro | [10.1145/3658617.3703137](https://doi.org/10.1145/3658617.3703137) | 低温 MOSFET 紧凑模型 |
| 2024 | ★★ Using Boolean Satisfiability for Exact Shuttling in Trapped-Ion Quantum Computers | Schoenberger | [10.1109/ASP-DAC58780.2024.10473902](https://doi.org/10.1109/asp-dac58780.2024.10473902) | **SAT 精确离子搬运求解** |
| 2024 | ★ CTQr: Control and Timing-Aware Qubit Routing | Huang | [10.1109/ASP-DAC58780.2024.10473795](https://doi.org/10.1109/asp-dac58780.2024.10473795) | **控制/时序感知路由** |
| 2024 | Towards Multiphase Clocking in Single-Flux Quantum Systems | Bairamkulov | [10.1109/ASP-DAC58780.2024.10473879](https://doi.org/10.1109/asp-dac58780.2024.10473879) | SFQ 多相时钟 |
| 2023 | ★★ Quantum Data Compression for Efficient Generation of Control Pulses | Volya | [10.1145/3566097.3567927](https://doi.org/10.1145/3566097.3567927) | **控制脉冲数据压缩（与 Bell step-table 同思路）** |
| 2023 | Software Tools for Decoding Quantum LDPC Codes | Berent | [10.1145/3566097.3567934](https://doi.org/10.1145/3566097.3567934) | QLDPC 译码工具 |
| 2023 | A Global Optimization Algorithm for Buffer and Splitter Insertion in AQFP Circuits | Fu | [10.1145/3566097.3567936](https://doi.org/10.1145/3566097.3567936) | AQFP 缓冲插入 |

### 5.5 FCCM / CGO / CC / ISLPED / ICRC / PACT

| venue | 论文 | 一作 | 年份 | DOI | 关联 |
|---|---|---|---|---|---|
| ★★ FCCM 2025 | Multi-FPGA Synchronization and Data Communication for Quantum Control and Measurement | Xu (LBNL/QubiC) | 2025 | [10.1109/FCCM62733.2025.00075](https://doi.org/10.1109/fccm62733.2025.00075) | **多 FPGA 同步与数据通信——与 Bell 跨板同步直接对标** |
| ★ FCCM 2023 | Scalable Quantum Error Correction for Surface Codes using FPGA | Liyanage | 2023 | [10.1109/FCCM57271.2023.00045](https://doi.org/10.1109/fccm57271.2023.00045) | 表面码 FPGA 译码 |
| ★ CGO 2025 | Weaver: A Retargetable Compiler Framework for FPQA Quantum Architectures | Kırmemiş | 2025 | [10.1145/3696443.3708965](https://doi.org/10.1145/3696443.3708965) | 可重定向 FPQA 编译框架 |
| ★ CGO 2025 | Qubit Movement-Optimized Program Generation on Zoned Neutral Atom Processors | Jang | 2025 | [10.1145/3696443.3708937](https://doi.org/10.1145/3696443.3708937) | 分区原子阵列移动优化 |
| CGO 2025 | ASDF: A Compiler for Qwerty, a Basis-Oriented Quantum Programming Language | Adams | 2025 | [10.1145/3696443.3708966](https://doi.org/10.1145/3696443.3708966) | 量子语言编译器 |
| CGO 2026 | Space-Time Optimisations for Early Fault-Tolerant Quantum Computation | Sharma | 2026 | [10.1109/CGO68049.2026.11395205](https://doi.org/10.1109/cgo68049.2026.11395205) | 早期容错时空优化 |
| CGO 2026 | OpenQudit: Extensible Numerical Quantum Compilation via a JIT-Compiled DSL | Younis | 2026 | [10.1109/CGO68049.2026.11394847](https://doi.org/10.1109/cgo68049.2026.11394847) | JIT DSL 数值编译 |
| CGO 2021 | Relaxed Peephole Optimization: A Novel Compiler Optimization for Quantum Circuits | Liu | 2021 | [10.1109/CGO51591.2021.9370310](https://doi.org/10.1109/cgo51591.2021.9370310) | 量子电路窥孔优化 |
| ★★ CC 2022 | QSSA: An SSA-based IR for Quantum Computing | Peduri, Bhat, Grosser (ETH) | 2022 | [10.1145/3497776.3517772](https://doi.org/10.1145/3497776.3517772) | **SSA 量子 IR——与 Bell 的 SSA/活跃性分析/寄存器分配流水线最直接对应** |
| CC 2022 | Writing and Verifying a Quantum Optimizing Compiler (keynote) | Rand | 2022 | [10.1145/3497776.3526941](https://doi.org/10.1145/3497776.3526941) | 量子优化编译器验证 |
| ISLPED 2025 | Design Techniques for Ultra-low Power Cryogenic CMOS for QC Applications | Chakraborty (IBM) | 2025 | [10.1109/ISLPED65674.2025.11261769](https://doi.org/10.1109/islped65674.2025.11261769) | 超低功耗 cryo-CMOS |
| ISLPED 2024 | Cooling the Chaos: Threshold Voltage Variation in Cryogenic CMOS Memories | Saligram | 2024 | [10.1145/3665314.3670844](https://doi.org/10.1145/3665314.3670844) | 低温存储 Vth 涨落 |
| ISLPED 2023 | Cryogenic CMOS as an Enabler for Low Power Dynamic Logic | Saligram | 2023 | [10.1109/ISLPED58423.2023.10244724](https://doi.org/10.1109/islped58423.2023.10244724) | 低温动态逻辑 |
| ★★ ICRC 2020 | Understanding Quantum Control Processor Capabilities and Limitations through Circuit Characterization | Butko (LBNL) | 2020 | [10.1109/ICRC2020.2020.00011](https://doi.org/10.1109/icrc2020.2020.00011) | **QUASAR/qV 控制处理器 ISA（CS4Q-P14）** |
| ★ ICRC 2020 | Adiabatic Circuits for Quantum Computer Control | DeBenedictis | 2020 | [10.1109/ICRC2020.2020.00004](https://doi.org/10.1109/icrc2020.2020.00004) | 绝热量子计算机控制电路 |
| ★ ICRC 2021 | Enabling a Programming Environment for an Experimental Ion Trap Quantum Testbed | Adams | 2021 | [10.1109/ICRC53822.2021.00014](https://doi.org/10.1109/icrc53822.2021.00014) | **离子阱实验编程环境** |
| PACT 2020 | Memory-Equipped Quantum Architectures | Baker | 2020 | [10.1145/3410463.3414644](https://doi.org/10.1145/3410463.3414644) | 内存增强量子架构 |
| PACT 2024 | Faster and More Reliable Quantum SWAPs via Native Gates | Gokhale | 2024 | [10.1145/3656019.3689818](https://doi.org/10.1145/3656019.3689818) | 原生门 SWAP |

### 5.6 IEEE TCAD（期刊，量子测控核心条目）

| 年份 | 论文 | 一作 | DOI | 关联 |
|---|---|---|---|---|
| 2025 | ★ SmartQCache: Fast and Precise Pulse Control With Near-Quantum Cache Design on FPGA | Liqiang Lu | [10.1109/TCAD.2024.3497839](https://doi.org/10.1109/tcad.2024.3497839) | **FPGA 近量子缓存脉冲控制——核心** |
| 2025 | ★ Shuttling for Scalable Trapped-Ion Quantum Computers | Schoenberger | [10.1109/TCAD.2024.3513262](https://doi.org/10.1109/tcad.2024.3513262) | **可扩展离子阱搬运（期刊版）** |
| 2024 | ★ Analytical Modeling of Multiple Co-Existing Inaccuracies in RF Controlling Circuits | Yao Tong | [10.1109/TCAD.2023.3311732](https://doi.org/10.1109/tcad.2023.3311732) | RF 控制电路非理想建模 |
| 2025 | ★ A Predictive Readout Fidelity Model for Readout Circuit Design | Yao Tong | [10.1109/TCAD.2024.3483670](https://doi.org/10.1109/tcad.2024.3483670) | 读出保真度预测模型 |
| 2024 | ★ NAPA: Intermediate-Level Variational Native-Pulse Ansatz | Zhiding Liang | [10.1109/TCAD.2024.3355277](https://doi.org/10.1109/tcad.2024.3355277) | 原生脉冲级变分 |
| 2026 | ★ A Framework for Dynamic Quantum Circuit Execution: Balancing Effectiveness and Efficiency | Chen | [10.1109/TCAD.2025.3626447](https://doi.org/10.1109/tcad.2025.3626447) | **动态量子电路执行框架** |
| 2026 | EDA-Q: Electronic Design Automation for Superconducting Quantum Chip | Zhao | [10.1109/TCAD.2025.3580341](https://doi.org/10.1109/tcad.2025.3580341) | 超导芯片 EDA |
| 2026 | GeoSynth: Constraint-Aware Automation for Scalable Superconducting Quantum Chip Design | Yu | [10.1109/TCAD.2026.3663259](https://doi.org/10.1109/tcad.2026.3663259) | 芯片设计自动化 |
| 2025 | DasAtom: A Divide-and-Shuttle Atom Approach to Quantum Circuit Transformation | Huang | [10.1109/TCAD.2025.3532818](https://doi.org/10.1109/tcad.2025.3532818) | 中性原子搬运变换 |
| 2025 | Technology Legalization and Optimization for AQFP | Lee | [10.1109/TCAD.2024.3434385](https://doi.org/10.1109/tcad.2024.3434385) | AQFP 工艺合法化 |
| 2025 | CGP-Based Automatic Synthesis for Reversible Quantum-Flux-Parametron Logic | Fu | [10.1109/TCAD.2025.3546884](https://doi.org/10.1109/tcad.2025.3546884) | AQFP 综合 |
| 2022 | Timing and Resource-Aware Mapping of Quantum Circuits | Lingling Lao | [10.1109/TCAD.2021.3057583](https://doi.org/10.1109/tcad.2021.3057583) | 时序感知映射 |
| 2025 | CAMEL: Crosstalk-Aware Mapping and Gate Scheduling for Frequency-Tunable Chips | Bin-Han Lu | [10.1109/TCAD.2024.3507580](https://doi.org/10.1109/tcad.2024.3507580) | 串扰感知调度 |
| 2023 | Timing-Aware Qubit Mapping and Gate Scheduling for Neutral Atom | Yongshang Li | [10.1109/TCAD.2023.3261244](https://doi.org/10.1109/tcad.2023.3261244) | 中性原子时序映射 |
| 2024 | QuBEC: Equivalence Checking with QEC Embedding | Lu | [10.1109/TCAD.2024.3361402](https://doi.org/10.1109/tcad.2024.3361402) | QEC 嵌入等价检验 |
| 2024 | A Parametric EDA Method for CPW Channel Recognition and Air-Bridge Construction in Quantum Chip Design | Li | [10.1109/TCAD.2024.3394368](https://doi.org/10.1109/tcad.2024.3394368) | 量子芯片版图 EDA |

> **覆盖说明**：TODAES 本主题命中极少（仅 3 条边缘）；TVLSI 命中已并入第 3 节；ACM/SIGDA FPGA 会议无量子控制论文；**2026 DAC/ICCAD 量子论文 Crossref 未收录**（仅 arXiv comment 可见），需以 arXiv 补充。ICCAD'23 QPulseLib、ICCAD'20 DisQ、DAC'25 PHOENIX 由 agent 二手核实，DOI 待补。

---

## 6. 软件工程 / 编程语言 venue（POPL / PLDI / OOPSLA / ASE / ICSE / FSE / TSE / TOSEM）

> 检索方法：Crossref 按 ISSN/DOI 逐条核验 + arXiv 官方 API。✅ = 官方 API 确认。

### 6.1 PL 顶会（PACMPL）——控制流语义与编译（Bell 的语言层对标）

| 论文 | 作者 | 年份 | venue | DOI | 关联 |
|---|---|---|---|---|---|
| ★★ Quantum Control Machine: The Limits of Control Flow in Quantum Programming | Yuan, Carbin (MIT) | 2024 | POPL | [10.1145/3649811](https://doi.org/10.1145/3649811) | **量子程序控制流语义边界——Bell 前端 DSL 必对标** |
| ★★ The T-Complexity Costs of Error Correction for Control Flow in Quantum Computation | Yuan, Carbin | 2024 | PLDI | [10.1145/3656397](https://doi.org/10.1145/3656397) | **控制流抽象的容错开销模型（Spire）** |
| ★ Compositional Quantum Control Flow with Efficient Compilation in Qunity | Mints et al. | 2025 | OOPSLA | [10.1145/3763056](https://doi.org/10.1145/3763056) | 可组合控制流+高效编译 |
| ★ Compiling Conditional Quantum Gates without Using Helper Qubits | Huang, Palsberg | 2024 | PLDI | [10.1145/3656436](https://doi.org/10.1145/3656436) | 条件门编译（免辅助比特） |
| Quantum Register Machine: Efficient Implementation of Quantum Recursive Programs | Zhang et al. | 2025 | PACMPL | [10.1145/3729283](https://doi.org/10.1145/3729283) | 量子递归程序运行时 |
| Qunity: A Unified Language for Quantum and Classical Computing | Voichick et al. | 2023 | POPL | [10.1145/3571225](https://doi.org/10.1145/3571225) | 量子-经典统一语言 |
| Silq: A High-Level Quantum Language with Safe Uncomputation | Bichsel et al. | 2020 | PLDI | [10.1145/3385412.3386007](https://doi.org/10.1145/3385412.3386007) | 安全反计算语言 |
| SimuQ: A Retargetable Programming Model for Pulse-Level QC | — | 2024 | POPL | [10.1145/3632923](https://doi.org/10.1145/3632923) | 可重定向脉冲级编程模型 |
| Dependency-Aware Compilation for Surface Code | — | 2025 | PACMPL | [10.1145/3720416](https://doi.org/10.1145/3720416) | 表面码依赖感知编译 |
| Verified Compilation of Quantum Oracles | — | 2022 | OOPSLA | [10.1145/3563309](https://doi.org/10.1145/3563309) | 验证式 oracle 编译 |
| Quartz / Giallar | — | 2022 | PLDI | [10.1145/3519939.3523433](https://doi.org/10.1145/3519939.3523433) / [10.1145/3519939.3523431](https://doi.org/10.1145/3519939.3523431) | 电路验证 |

> **确认空白**：脉冲级时序/反馈编译在 PLDI/OOPSLA/POPL/ICFP 上尚无先例——Bell 的"反馈时延预算作为编译期一等约束"定位无人占据。

### 6.2 软工会议与期刊（ASE / ICSE / FSE / TSE / TOSEM）

| 论文 | 年份 | venue | DOI | 关联 |
|---|---|---|---|---|
| MorphQ（ metamorphic testing of quantum programs）— Paltenghi, Pradel | 2023 | ICSE | [10.1109/ICSE48619.2023.00202](https://doi.org/10.1109/ICSE48619.2023.00202) | 量子程序蜕变测试 |
| LintQ | 2024 | FSE | [10.1145/3660802](https://doi.org/10.1145/3660802) | 量子静态检查 |
| Exact Inference for Quantum Circuits: A Testing Oracle — Lee Kanguk | 2025 | ASE | [10.1109/ASE63991.2025.00203](https://doi.org/10.1109/ASE63991.2025.00203) | 测试 oracle |
| NovaQ | 2025 | ASE | [10.1109/ASE63991.2025.00335](https://doi.org/10.1109/ASE63991.2025.00335) | 量子程序分析 |
| Is Measurement Enough? | 2025 | ASE | [10.1109/ASE63991.2025.00324](https://doi.org/10.1109/ASE63991.2025.00324) | 测量充分性 |
| Quantum Program Testing Through Commuting Pauli Strings — Muqeet et al. | 2024 | ASE | [10.1145/3691620.3695275](https://doi.org/10.1145/3691620.3695275) | 量子测试 |
| The Road to Hybrid Quantum Programs — De Maio et al. | 2025 | FSE | [10.1145/3696630.3731623](https://doi.org/10.1145/3696630.3731623) | 混合量子程序 |
| ★ Software Pipelining for Quantum Loop Programs — Guo Jingzhe | 2023 | TSE | [10.1109/TSE.2022.3232623](https://doi.org/10.1109/TSE.2022.3232623) | **量子循环程序软流水（Bell 的 loop 编译相邻工作）** |
| Quantum SE: Roadmap and Challenges Ahead | 2025 | TOSEM | [10.1145/3712002](https://doi.org/10.1145/3712002) | 量子软工路线图 |
| Testing/Debugging Quantum Programs: Road to 2030 | 2025 | TOSEM | [10.1145/3715106](https://doi.org/10.1145/3715106) | 测试调试展望 |
| A Taxonomy of Real Faults for Hybrid Quantum-Classical Software | 2026 | TOSEM | [10.1145/3788677](https://doi.org/10.1145/3788677) | 混合系统缺陷分类 |
| Laws of Quantum Programming | 2026 | TOSEM | [10.1145/3765903](https://doi.org/10.1145/3765903) | 量子程序定律 |
| Bug-Locating in Quantum Programs | 2025 | TSE | [10.1109/TSE.2025.3597316](https://doi.org/10.1109/TSE.2025.3597316) | 缺陷定位 |
| QOIN | 2024 | TSE | [10.1109/TSE.2024.3462974](https://doi.org/10.1109/TSE.2024.3462974) | 量子程序推断 |
| Dynamic Test Oracle | 2026 | TSE | [10.1109/TSE.2026.3670211](https://doi.org/10.1109/TSE.2026.3670211) | 动态测试 oracle |

### 6.3 动态电路编译补充（arXiv 已核验）

- Efficient Transpilation of OpenQASM 3.0 Dynamic Circuits to CUDA-Q | [arXiv:2604.11599](https://arxiv.org/abs/2604.11599)
- Compile-Time Simplification of Classically Controlled Operations in Dynamic Circuits | [arXiv:2605.28439](https://arxiv.org/abs/2605.28439)

### 6.4 量子专业会议（QCrypt / TQC / QIP / APS March Meeting）

- **QCrypt（2024/2025）**：未检索到任何测控/控制栈/编译器/反馈论文（全部为 QKD 与密码协议）。查询词：`QCrypt conference quantum cryptography control hardware FPGA talk`。
- **TQC 2025**：未检索到反馈控制/编译器理论论文；最接近的是 *Tesseract: A Search-Based Decoder for QEC*（Google Quantum AI，算法层面）。
- **QIP**：邀请制、不出版 proceedings、无 DOI 可引；2026 accepted papers 全为理论。
- **APS March Meeting**（摘要制，无 DOI）：有成建制测控 session——"Quantum Control Hardware"（MAR-N36, 2025，chair Gonzalez-Guerrero/LBNL，含 **FASQuiC 分布式 FPGA 反馈架构：波形重配 76.8 ns、数字反馈 137.6 ns**、QubiC update 2025）、"QEC Experiments in the Surface Code"（MAR-A16, 2025，Google invited + Rigetti/Riverlane 实时译码 <1 µs/轮）、"Quantum Software Stack"（K52, 2024，含 Qblox Quantify 控制栈）、"Hardware, Software and Techniques for Optimal Quantum Control"（R33, 2021）。

### 6.5 综合顶刊里程碑（Nature / Science 系，全部 DOI 已核验 ✅）

| 论文 | 作者 | 年份 | venue | DOI | 关联 |
|---|---|---|---|---|---|
| ★★ A 98-qubit trapped-ion quantum computer with all-to-all connectivity（Helios） | Ransford Anthony et al. (Quantinuum) | 2026 | Nature | [10.1038/s41586-026-10676-4](https://doi.org/10.1038/s41586-026-10676-4) | **与 Bell 最贴近的离子阱大型系统（CS4Q-P08）** |
| ★ Quantum error correction below the surface code threshold（Willow） | Google Quantum AI | 2024/25 | Nature 638, 920–926 | [10.1038/s41586-024-08449-y](https://doi.org/10.1038/s41586-024-08449-y) | 低于阈值表面码+实时译码（CS4Q-S09） |
| ★ Suppressing quantum errors by scaling a surface code logical qubit | Google Quantum AI | 2023 | Nature | [10.1038/s41586-022-05434-1](https://doi.org/10.1038/s41586-022-05434-1) | 表面码缩放 |
| ★ Demonstration of the trapped-ion quantum CCD computer architecture | Pino J. M. et al. (Honeywell) | 2021 | Nature | [10.1038/s41586-021-03318-4](https://doi.org/10.1038/s41586-021-03318-4) | **QCCD 架构奠基实验** |
| ★ Combining quantum processors with real-time classical communication | Carrera Vazquez et al. (IBM) | 2024 | Nature | [10.1038/s41586-024-08178-2](https://doi.org/10.1038/s41586-024-08178-2) | **处理器间实时经典通信** |
| ★ Real-time quantum error correction beyond break-even | Sivak V. V. et al. | 2023 | Nature | [10.1038/s41586-023-05782-6](https://doi.org/10.1038/s41586-023-05782-6) | 实时 QEC 超越盈亏平衡 |
| ★ Learning high-accuracy error decoding for quantum processors（AlphaQubit） | Bausch Johannes et al. (DeepMind) | 2024 | Nature | [10.1038/s41586-024-08148-8](https://doi.org/10.1038/s41586-024-08148-8) | ML 高精度译码 |
| ★ High-fidelity gates and mid-circuit erasure conversion in an atomic qubit | Ma Shuo et al. | 2023 | Nature | [10.1038/s41586-023-06438-1](https://doi.org/10.1038/s41586-023-06438-1) | 中性原子 MCM 擦除转换 |
| ★ A fault-tolerant neutral-atom architecture for universal quantum computation | Bluvstein Dolev et al. (Harvard) | 2025 | Nature | [10.1038/s41586-025-09848-5](https://doi.org/10.1038/s41586-025-09848-5) | 容错中性原子架构 |
| Logical quantum processor based on reconfigurable atom arrays | Bluvstein Dolev et al. | 2023 | Nature | [10.1038/s41586-023-06927-3](https://doi.org/10.1038/s41586-023-06927-3) | 48 逻辑比特 |
| Universal control of a six-qubit quantum processor in silicon | Philips Stephan G. J. et al. | 2022 | Nature | [10.1038/s41586-022-05117-x](https://doi.org/10.1038/s41586-022-05117-x) | 硅自旋全控制 |
| ★ How to scale the electronic control systems of a quantum computer | Potočnik Anton et al. | 2025 | Nature Electronics | [10.1038/s41928-024-01331-9](https://doi.org/10.1038/s41928-024-01331-9) | **控制电子学扩展性路线图——需求侧必引** |
| ★ A real-time, scalable, fast and resource-efficient decoder for a quantum computer | Barber Ben et al. (Riverlane) | 2025 | Nature Electronics | [10.1038/s41928-024-01319-5](https://doi.org/10.1038/s41928-024-01319-5) | **实时可扩展译码器** |
| Controlling a superconducting quantum processor | Zeissler Katharina | 2023 | Nature Electronics | [10.1038/s41928-023-00948-6](https://doi.org/10.1038/s41928-023-00948-6) | 超导处理器控制评述 |
| ★ Realizing a deep reinforcement learning agent for real-time quantum feedback | Reuer Kevin et al. (ETH) | 2023 | Nature Communications | [10.1038/s41467-023-42901-3](https://doi.org/10.1038/s41467-023-42901-3) | **实时量子反馈 RL agent** |
| ★ Demonstrating real-time and low-latency QEC with superconducting qubits | Caune Laura et al. (Riverlane+Rigetti) | 2026 | Nature Communications | [10.1038/s41467-026-73331-6](https://doi.org/10.1038/s41467-026-73331-6) | **实时低延迟 QEC 全栈演示** |
| ★ Parallel window decoding enables scalable FTQC | Skoric Luka et al. (Riverlane) | 2023 | Nature Communications | [10.1038/s41467-023-42482-1](https://doi.org/10.1038/s41467-023-42482-1) | 并行窗口译码 |
| Demonstrating multi-round subsystem QEC using matching and ML decoders | Sundaresan Neereja et al. (IBM) | 2023 | Nature Communications | [10.1038/s41467-023-38247-5](https://doi.org/10.1038/s41467-023-38247-5) | 多轮子系统 QEC |
| Autonomous error correction of a single logical qubit using two transmons | Li Ziqian et al. | 2024 | Nature Communications | [10.1038/s41467-024-45858-z](https://doi.org/10.1038/s41467-024-45858-z) | 自主纠错 |
| Experimental demonstration of continuous QEC | Livingston William P. et al. | 2022 | Nature Communications | [10.1038/s41467-022-29906-0](https://doi.org/10.1038/s41467-022-29906-0) | 连续 QEC |
| ★ Error correction of a logical qubit encoded in a single atomic ion | DeBry Kyle et al. | 2026 | Nature Physics | [10.1038/s41567-026-03315-2](https://doi.org/10.1038/s41567-026-03315-2) | **单离子逻辑比特纠错** |
| Measurement-induced quantum phases realized in a trapped-ion QC | Noel Crystal et al. | 2022 | Nature Physics | [10.1038/s41567-022-01619-7](https://doi.org/10.1038/s41567-022-01619-7) | MCM 测量诱导相变 |
| Measurement-induced entanglement phase transition … mid-circuit readout | Koh Jin Ming et al. | 2023 | Nature Physics | [10.1038/s41567-023-02076-6](https://doi.org/10.1038/s41567-023-02076-6) | MCM 读出 |
| Quantum many-body mixed phase space revealed by hybrid feedback control | Dong Hang et al. | 2026 | Nature Physics | [10.1038/s41567-026-03431-z](https://doi.org/10.1038/s41567-026-03431-z) | 混合反馈控制 |
| A fiber array architecture for atom quantum computing | Li Xiao et al. | 2025 | Nature Communications | [10.1038/s41467-025-64738-8](https://doi.org/10.1038/s41467-025-64738-8) | 原子计算光纤阵列架构 |
| ★ Quantum computing requires high-performance software（评论） | Chow Jerry M. (IBM) | 2025 | Science | [10.1126/science.adt0019](https://doi.org/10.1126/science.adt0019) | **高性能量子软件需求侧论述** |

> **勘误与未核实项**：⚠️ Quantinuum "Nature 2024 High-fidelity logical qubit…" 标题在 Crossref 无命中，**勿引用**（Quantinuum 实时容错里程碑实为 PRX 11, 041058 (2021)）。⚠️ HRL 硅基 QPU（CS4Q-P02 标注 Nature 2026, DOI:10.1038/s41586-026-10754-7）与 ⚠️ Atom Computing 中性原子 QEC（CS4Q-P06, arXiv:2606.04079）在多轮 Crossref 检索中无命中，引用前需再核实（CS4Q 导读核对过预印本全文，Nature 正式版待确认）。

---

## 7. 网络 venue 与 FPGA 会议（量子网络控制平面 + 查缺补漏）

> 检索方法：Crossref REST API。⚠️ NSDI/USENIX ATC/OSDI/SOSP 四项因 Crossref 收录稀薄+DBLP 被 Anubis 反爬拦截，"未检索到"为**置信度最低**的判定（非断言不存在）。

### 7.1 IEEE INFOCOM（量子网络控制平面最集中的场所）

| 论文 | 一作 | 年份 | DOI | 关联 |
|---|---|---|---|---|
| ★ FPGA-based Deterministic and Low-Latency Control for Distributed Quantum Computing（WKSHPS） | Oliveira | 2023 | [10.1109/INFCOMWKSHPS57453.2023.10226129](https://doi.org/10.1109/infocomwkshps57453.2023.10226129) | **FPGA 确定性低延迟控制+分布式量子计算** |
| NetQStack: toward building a network-integrated computing stack for quantum data centers | Monga | 2026 | [10.1109/INFCOM59046.2026.11571765](https://doi.org/10.1109/infocom59046.2026.11571765) | 量子数据中心网络-计算一体栈 |
| Qubit Allocation for Distributed Quantum Computing | Mao | 2023 | [10.1109/INFCOM53939.2023.10228915](https://doi.org/10.1109/infocom53939.2023.10228915) | 分布式比特分配 |
| Joint Optimization of Circuit Transformation and Qubit Mapping for Distributed QC | Zhang | 2026 | [10.1109/INFCOM59046.2026.11571664](https://doi.org/10.1109/infocom59046.2026.11571664) | 线路变换+映射联合优化 |
| Quantum BGP with Online Path Selection via Network Benchmarking | Liu | 2024 | [10.1109/INFCOM52122.2024.10621359](https://doi.org/10.1109/infocom52122.2024.10621359) | 网络基准驱动路径选择 |
| LinkSelFiE: Link Selection and Fidelity Estimation in Quantum Networks | Liu | 2024 | [10.1109/INFCOM52122.2024.10621263](https://doi.org/10.1109/infocom52122.2024.10621263) | 链路选择与保真度估计 |
| Fortuña: Efficient Selection of High-Fidelity Link for Quantum Network in the Wild | Li | 2025 | [10.1109/INFCOM55648.2025.11044624](https://doi.org/10.1109/infocom55648.2025.11044624) | 现网高保真链路选择 |
| Dynamic Entanglement Packet Scheduling for Quantum Networks | Tran | 2026 | [10.1109/INFCOM59046.2026.11571755](https://doi.org/10.1109/infocom59046.2026.11571755) | 动态纠缠包调度 |
| AEPA: Adaptive Entanglement Pre-Allocation for Low-Latency Quantum Repeater Networks | Chen | 2026 | [10.1109/INFCOM59046.2026.11571752](https://doi.org/10.1109/infocom59046.2026.11571752) | 低延迟纠缠预分配 |
| Fidelity-Threshold Online Path Selection and Request Scheduling | Chen | 2026 | [10.1109/INFCOM59046.2026.11571406](https://doi.org/10.1109/infocom59046.2026.11571406) | 在线路径选择+调度 |
| Age-Based Scheduling for a Memory-Constrained Quantum Switch | Mitrolaris | 2026 | [10.1109/INFCOM59046.2026.11571768](https://doi.org/10.1109/infocom59046.2026.11571768) | 内存受限交换机调度 |
| （纠缠路由/纯化系列：Zhao 2021/2022、Zeng 2022、Farahbakhsh 2022、Pouryousef 2023、Yang 2023、Panigrahy 2023、Wang 2025、Zhang 2025、Luo 2025、Gu 2025、Lin 2025、Tunc 2026、Mesny 2026、Ho 2026 等 17 条，DOI 见存档） | | | | |

### 7.2 SIGCOMM / JSAC / ToN / TNSM

- ★ A link layer protocol for quantum networks — Dahlberg et al. | 2019 | SIGCOMM 主会 | [10.1145/3341302.3342070](https://doi.org/10.1145/3341302.3342070) | 量子网络链路层协议（控制平面经典）
- SIGCOMM 2026 Workshop on Quantum Networks and Distributed Quantum Computing（8 条：Timely Control for Quantum Cloud、Joint Circuit and Network Orchestration、DPRQ 比特路由、NetQStack 仿真、SoS-SDQN 等，DOI 10.1145/3833409.38334xx 系列）+ 主会 Poster（Lim 2026, [10.1145/3789240.3830279](https://doi.org/10.1145/3789240.3830279)）+ Posters/Demos（Garces 2025, [10.1145/3744969.3748417](https://doi.org/10.1145/3744969.3748417)）
- ★ Design for High-Precision Time-Sensitive Networking: Synchronization for the Quantum Network Control Plane — Bush et al. | 2024 | IEEE JSAC | [10.1109/JSAC.2024.3380093](https://doi.org/10.1109/jsac.2024.3380093) | **量子网络控制平面时间同步**
- ★ QuIP: A P4 Quantum Internet Protocol Prototyping Framework — Kozlowski et al. | 2024 | JSAC | [10.1109/JSAC.2024.3380096](https://doi.org/10.1109/jsac.2024.3380096) | **P4 可编程量子互联网协议框架**
- ★ Building a Hierarchical Architecture and Communication Model for the Quantum Internet — He et al. | 2024 | JSAC | [10.1109/JSAC.2024.3380103](https://doi.org/10.1109/jsac.2024.3380103) | 量子互联网分层架构
- Guest Editorial: The Quantum Internet: Principles, Protocols and Architectures — Cacciapuoti et al. | 2024 | JSAC | [10.1109/JSAC.2024.3379106](https://doi.org/10.1109/jsac.2024.3379106) | **JSAC 量子互联网专刊导读（2024）**
- QPing: A Quantum Ping Primitive for Quantum Networks — Miguel-Ramiro et al. | 2026 | JSAC | [10.1109/JSAC.2026.3693981](https://doi.org/10.1109/jsac.2026.3693981) | 量子网络 ping 原语
- Toward City-Scale Quantum Timing: Wireless Synchronization via Quantum Hubs — Dabiri et al. | 2026 | JSAC | [10.1109/JSAC.2026.3711027](https://doi.org/10.1109/jsac.2026.3711027) | 城市级量子时间同步
- Layer-Wise Security Framework and Analysis for the Quantum Internet — Yang et al. | 2025 | JSAC | [10.1109/JSAC.2025.3568063](https://doi.org/10.1109/jsac.2025.3568063)
- An Optimal Latency Qubit Transmission Strategy for Quantum Information Networks — Cen et al. | 2026 | JSAC | [10.1109/JSAC.2026.3688604](https://doi.org/10.1109/jsac.2026.3688604)
- （ToN 8 条纠缠路由/传输协议：Zhao 2023、Shi 2024、Zeng 2024、Gu 2024、Wei 2024、Chen 2024 等；TNSM 5 条调度/供给：Oki 2026、Hu 2026、Li 2023/2024、Cacciapuoti 2024——DOI 见存档 `agent_network_instruments.md`）

### 7.3 FPGA 会议与系统会议（查缺补漏）

| venue | 论文 | 一作 | 年份 | DOI | 关联 |
|---|---|---|---|---|---|
| ★★ FCCM 2025 | Multi-FPGA Synchronization and Data Communication for Quantum Control and Measurement | Xu (LBNL/QubiC) | 2025 | [10.1109/FCCM62733.2025.00075](https://doi.org/10.1109/fccm62733.2025.00075) | **多 FPGA 同步测控——与 Bell 跨板同步直接对标** |
| ★ FCCM 2023 | Scalable Quantum Error Correction for Surface Codes using FPGA | Liyanage | 2023 | [10.1109/FCCM57271.2023.00045](https://doi.org/10.1109/fccm57271.2023.00045) | 表面码 FPGA 译码 |
| FCCM 2024 | PCQ: Parallel Compact Quantum Circuit Simulation | Liang | 2024 | [10.1109/FCCM60383.2024.00013](https://doi.org/10.1109/fccm60383.2024.00013) | 并行线路仿真 |
| ★ FPL 2023 | A Scalable and Cross-Technology Quantum Control Processor | Guo | 2023 | [10.1109/FPL60245.2023.00063](https://doi.org/10.1109/fpl60245.2023.00063) | **跨工艺量子控制处理器** |
| FPL 2022 | A Flexible and Scalable Quantum-Classical Interface based on FPGAs (Demo) | Miyoshi | 2022 | [10.1109/FPL57034.2022.00089](https://doi.org/10.1109/fpl57034.2022.00089) | 量子-经典 FPGA 接口 |
| FPL 2021 | An Emulation of Quantum Error-Correction on an FPGA device | Hart | 2021 | [10.1109/FPL53798.2021.00025](https://doi.org/10.1109/fpl53798.2021.00025) | FPGA QEC 仿真 |
| ★ FPT 2021 | A modular RFSoC-based approach to interface superconducting quantum bits | Gebauer | 2021 | [10.1109/ICFPT52863.2021.9609909](https://doi.org/10.1109/icfpt52863.2021.9609909) | 模块化 RFSoC 接口 |
| FPT 2023 | FPGA-accelerated Quantum Transport Measurements | Haarman | 2023 | [10.1109/ICFPT59805.2023.00010](https://doi.org/10.1109/icfpt59805.2023.00010) | FPGA 加速输运测量 |
| ★ EuroSys 2026 | A Case for Elastic Quantum Error Correction Decoders | Maurya | 2026 | [10.1145/3767295.3803584](https://doi.org/10.1145/3767295.3803584) | **弹性 QEC 译码器系统（EuroSys 首篇）** |
| USENIX ATC / OSDI / SOSP / NSDI | 未检索到 | — | — | — | 置信度低（Crossref 收录稀薄+DBLP 拦截），建议用 dblp.xml.gz 离线补查 |
| ACM/SIGDA FPGA | 未检索到量子控制/译码论文 | — | — | — | 实时译码主战场在 QCE/FCCM |

### 7.4 仪器与低温期刊（RSI / TIM / Cryogenics / SUST / JLTP / TAS）

> 此组与第 3 节电路期刊互补：第 3 节侧重 ISSCC/JSSC 芯片谱系，本节为 Crossref 全量枚举的仪器期刊补充。

**Review of Scientific Instruments（控制系统整机谱系——Bell 直接同类）**：
- ★ The QICK (Quantum Instrumentation Control Kit) — Stefanazzi et al. | 2022 | 93(4), 044709 | [10.1063/5.0076249](https://doi.org/10.1063/5.0076249) | RFSoC 直合成 6 GHz（CS4Q-S07）
- ★ Presto: Measurement and control of a superconducting quantum processor with a fully integrated RF system on a chip — Tholén et al. | 2022 | [10.1063/5.0101398](https://doi.org/10.1063/5.0101398) | **184–254 ns 低延迟反馈**
- ★ FPGA-based electronic system for the control and readout of superconducting quantum processors — Yang et al. | 2022 | 93(7), 074701 | [10.1063/5.0085467](https://doi.org/10.1063/5.0085467) | **反馈延迟 125 ns、时钟抖动 ~5 ps**
- ★ Manarat: A scalable QICK-based control system supporting synchronized control of 10 flux-tunable qubits — Silva et al. | 2026 | [10.1063/5.0301360](https://doi.org/10.1063/5.0301360) | QICK 多板同步扩展
- ★ ICARUS-Q: Integrated control and readout unit for scalable quantum processors — Park et al. | 2022 | 93(10) | [10.1063/5.0081232](https://doi.org/10.1063/5.0081232)
- ★ A quantum computing measurement and control system with an FPGA-based scheduling system — Liu et al. | 2024 | [10.1063/5.0225000](https://doi.org/10.1063/5.0225000) | FPGA 调度器+指令压缩
- A co-simulation of superconducting qubit and control electronics — Jin et al. | 2023 | [10.1063/5.0163725](https://doi.org/10.1063/5.0163725)
- High-density wiring solution for 500-qubit scale superconducting QPs — Tian et al. | 2025 | [10.1063/5.0287659](https://doi.org/10.1063/5.0287659)
- NQontrol: open-source platform for digital control-loops — Darsow-Fromm et al. | 2020 | [10.1063/1.5135873](https://doi.org/10.1063/1.5135873)；PyRPL — Neuhaus et al. | 2024 | [10.1063/5.0178481](https://doi.org/10.1063/5.0178481) | 量子光学 FPGA 反馈环
- Switching, amplifying, and chirping diode lasers with current pulses — Buser et al. | 2024 | [10.1063/5.0230870](https://doi.org/10.1063/5.0230870) | **离子阱激光高带宽调制**
- Automation in quantum logic experiments with cold molecular ions — Karl et al. | 2026 | [10.1063/5.0309976](https://doi.org/10.1063/5.0309976)
- Microwave output stabilization of a qubit controller — Kurimoto et al. | 2026 | [10.1063/5.0311173](https://doi.org/10.1063/5.0311173)
- Automated SNR-based optimization of TWPAs for multiplexed qubit readout — Choi et al. | 2026 | [10.1063/5.0323923](https://doi.org/10.1063/5.0323923)

**IEEE TIM**：
- ★ SQ-CARS: A Scalable Quantum Control and Readout System — Singhal et al. | 2023 | 72:1–15 | [10.1109/TIM.2023.3305656](https://doi.org/10.1109/tim.2023.3305656) | ZCU111 低延迟反馈
- ★ An FPGA-Based Hardware Platform for the Control of Spin-Based Quantum Systems — Qin et al. | 2020 | 69:1127–1139 | [10.1109/TIM.2019.2910921](https://doi.org/10.1109/tim.2019.2910921)
- ★ Cryogenic Evaluation of a DAC for a Trapped-Ion Quantum Computer — Meyer et al. | 2025 | 74 | [10.1109/TIM.2025.3571087](https://doi.org/10.1109/tim.2025.3571087) | **离子阱低温 DAC 评测**
- Real-Time In Situ Quantum Feedback Control of Electron Spin in Atomic Spin Gyroscopes — Pei et al. | 2024 | [10.1109/TIM.2023.3325515](https://doi.org/10.1109/tim.2023.3325515)
- Cryogenic Measurement of CMOS Devices for Quantum Technologies — Pérez-Bailón et al. | 2023 | [10.1109/TIM.2023.3325446](https://doi.org/10.1109/tim.2023.3325446)

**Cryogenics / SUST / JLTP / TAS**（SFQ 低温控制谱系，节选）：
- ★ Low power SFQ qubit control circuit without high-frequency input — Weng et al. | SUST 2023 | [10.1088/1361-6668/ace660](https://doi.org/10.1088/1361-6668/ace660)
- ★ Amplitude-controllable microwave pulse generator using SFQ pulse pairs — Shen et al. | SUST 2023 | [10.1088/1361-6668/ace8c7](https://doi.org/10.1088/1361-6668/ace8c7)
- ★ Sub-nanosecond operations on superconducting quantum register based on Ramsey patterns — Bastrakova et al. | SUST 2022 | [10.1088/1361-6668/ac5505](https://doi.org/10.1088/1361-6668/ac5505) | **亚纳秒 SFQ 操控**
- ★ Feedback-enabled low-latency AQFP logic using a mixed clocking scheme — He et al. | SUST 2025 | [10.1088/1361-6668/ada201](https://doi.org/10.1088/1361-6668/ada201) | **低温低延迟反馈逻辑**
- Frequency synchronization of SFQ oscillators — Yamanashi et al. | SUST 2021 | [10.1088/1361-6668/ac1d96](https://doi.org/10.1088/1361-6668/ac1d96)
- ★ Interfacing Superconducting Qubits With Cryogenic Logic: Readout — Howington et al. | TAS 2019 | [10.1109/TASC.2019.2908884](https://doi.org/10.1109/tasc.2019.2908884) | MIT Lincoln Lab
- ★ Design and Fabrication of Low-Power SFQ Circuits Toward Qubit Control — Tanaka et al. | TAS 2023 | [10.1109/TASC.2023.3251304](https://doi.org/10.1109/tasc.2023.3251304)
- Design of SFQ Qubit Control Circuit With Adjustable Patterns — Weng et al. | TAS 2024 | [10.1109/TASC.2024.3354676](https://doi.org/10.1109/tasc.2024.3354676)
- Low-Power SFQ Standard Cell Library for Qubit Control — Tanaka et al. | TAS 2025 | [10.1109/TASC.2024.3521892](https://doi.org/10.1109/tasc.2024.3521892)
- A Multi-Qubit SFQ Control Architecture Using Recycled Bias Current — Weng et al. | TAS 2026 | [10.1109/TASC.2026.3653712](https://doi.org/10.1109/tasc.2026.3653712)
- Monolithic Integration of a Superconducting Qubit with an SFQ Control Circuit — Miyajima et al. | TAS 2023 | [10.1109/TASC.2023.3241270](https://doi.org/10.1109/tasc.2023.3241270)
- SFQ Multiplier Circuits for Synthesizing GHz Waveforms — Castellanos-Beltran et al. (NIST) | TAS 2021 | [10.1109/TASC.2021.3057013](https://doi.org/10.1109/tasc.2021.3057013)
- SFQ-CMOS 接口系列（CMOS-to-SFQ 2024、Ternary Output 2025、4JL 4K–50K 2025、Reed-Muller ECC 2026）— Mustafa & Köse / Li / Krause et al. | TAS | DOI 见存档
- Optimal cooling configurations for QIP at mK temperatures — Poole et al. | Cryogenics 2022 | [10.1016/j.cryogenics.2022.103538](https://doi.org/10.1016/j.cryogenics.2022.103538)
- Towards scalable cryogenic quantum dot biasing using memristor-based DC sources — Mouny et al. | Cryogenics 2024 | [10.1016/j.cryogenics.2024.103910](https://doi.org/10.1016/j.cryogenics.2024.103910)
- Room Temperature ASIC for Cryogenic TES/SQUID Control and Readout — Chen et al. | JLTP 2022 | [10.1007/s10909-022-02833-6](https://doi.org/10.1007/s10909-022-02833-6)
- Characterization of Tunnel Diode Oscillator for Qubit Readout — Grytsenko et al. | JLTP 2025 | [10.1007/s10909-025-03293-4](https://doi.org/10.1007/s10909-025-03293-4)

**清单外高相关补充**：
- ★★ Cryogenic time-division-multiplexed voltage control for scalable trapped-ion quantum processors — Ohira et al. | 2026 | Applied Physics Letters | [10.1063/5.0344625](https://doi.org/10.1063/5.0344625) | **低温 TDM 电压控制，直接对标离子阱布线瓶颈**
- ★ Measurement（Elsevier）：未检索到测控/反馈直接相关论文（均为量子传感/计量）
- ★ IEEE Sensors Journal：Multichannel Control for Quantum Diamond Microscope — Shi et al. | 2023 | [10.1109/JSEN.2023.3303192](https://doi.org/10.1109/jsen.2023.3303192)（边缘）

---

## 8. 结论：QuCtrl-BELL 主题文献地图与投稿启示

### 8.1 文献地图（按 QuCtrl-BELL 的四个技术层归位）

**① 编译层（DSL → CFG → SSA → 寄存器分配 → step-table）**
- 语言/IR 先例：OpenQASM 3（ACM TQC 2022）、QSSA（CC 2022，SSA IR）、QIRO（ACM TQC 2022）、NetQASM（QST 2022）、eQASM（HPCA 2019）、Quingo（ACM TQC 2021）、Quantum Control Machine（POPL 2024，控制流语义边界）、CLINE（HPCA 2026，控制流编译+控制线编码）
- 脉冲级编译：Qiskit Pulse（QST 2020）、OpenPulse 编译（MICRO 2020）、EPOC（DAC 2025）、PAQOC（HPCA 2023）、AccQOC（ISCA 2020）、脉冲级 IR（QCE 2025）、HyPulse（QCE 2026，离子阱）、MLIR 脉冲方言（QCE 2026）、Direct Pulse-Level Compilation（PRApplied 2024）
- 序列压缩/内存优化（与 step-table 同思路）：COMPAQT（MICRO 2022，波形内存压缩）、Quantum Data Compression for Control Pulses（ASP-DAC 2023）、SmartQCache（TCAD 2025）、FPGA 调度器+指令压缩（RSI 2024）、Hardware-Assisted Parameterized Circuit Execution（CS4Q-P16）

**② 反馈层（<700 ns 测量→条件操作闭环）**
- 延迟对标谱系（由快到慢）：AQFP 反馈逻辑（SUST 2025）→ FPGA 电荷感测反馈（PRApplied 2021）→ 超导稳定子实时处理 590 ns（npj QI 2020，Ristè）→ **QuCtrl-BELL ≈690 ns（离子阱）** → Presto 184–254 ns（RSI 2022，超导）→ FPGA 测控系统 125 ns（RSI 2022）→ ARTERY 分支预测反馈（ISCA 2025）→ FASQuiC 数字反馈 137.6 ns（APS 2025 摘要）
- 动态电路/前馈实验：IBM 动态电路（PRL 2021）、QFT 动态电路（PRL 2024）、实时前馈扇出（PRApplied 2025）、长程纠缠动态电路（PRX Quantum 2024）、Qubit-Reuse 编译（PRX 2023）、AC/DC 动态电路编译（ACM TQC 2026）、前馈误差表征（QCE 2026）
- 离子阱反馈：Quantinuum 相干反馈（PRX Quantum 2022）、实时容错 QEC（PRX 2021）、搬运式容错宇称读出（PRX 12, 011032）、单离子逻辑比特纠错（Nature Physics 2026）

**③ 离子阱平台层（QCCD/电极/搬运/同步）**
- 架构：QCCD 演示（Nature 2021）、Murali QCCD 架构（ISCA 2020）、TILT（HPCA 2021）、千比特布线（PRX Quantum 2023）、微波 QCCD 控制系统（QCE 2024）、Helios 98q（Nature 2026）、表面码离子阱架构（ASPLOS 2026）、iSwitch（ASPLOS 2026）
- 搬运编译：Muzzle the Shuttle（DATE 2022）、Cycle-based Shuttling（DATE 2024）、SAT 精确搬运（ASP-DAC 2024）、Shuttling for Scalable Trapped-Ion（TCAD 2025）、BOSS（HPCA 2025）、S-SYNC（ISCA 2025）、MUSS-TI（MICRO 2025）、Cyclone（HPCA 2026）、搬运序列自动生成（Quantum 2023）、AQT 编译栈（Quantum 2023）、位置图抽象编译（ACM TQC 2026）、多区搬运编排（QCE 2025）
- 电极控制硬件：片上电压源（PRApplied 2019）、低温 TDM 电压控制（APL 2026）、低温电极信号处理单元（ESSERC 2024）、搬运控制器 SoC（ISCAS 2025）、跨压域仪表放大器（TCAS-II 2026）、离子阱低温 DAC 评测（TIM 2025）、低噪声 DAC SoM（QCE 2026）、电极阵列复用控制（QCE 2025）、SoC 搬运波形发生器（QCE 2025）、⁹Be⁺ Cryo-BiCMOS 控制器（ISSCC 2025/JSSC 2026）、离子阱微波 SoC（RFIC 2024）、9.4K DDS（ISCAS 2025）

**④ 控制处理器/运行时层（RISC-V + PXIe 板级执行）**
- 控制处理器：QuMA（IEEE Micro 2018）、eQASM（HPCA 2019）、QUASAR/qV（ICRC 2020）、XQsim（ISCA 2022）、控制微架构并行（MICRO 2021）、经典架构 RISC-V MMIO（ACM TQC 2023）、HetArch（MICRO 2023）、LSQCA（HPCA 2025）、Distributed-HISQ（MICRO 2025）、Vectorizing Quantum Control RISC-V（QCE 2026）、ReQISC（ASPLOS 2026）、FPL 跨工艺控制处理器（2023）
- 开源控制器平台（Bell 直接对比对象）：ARTIQ/Sinara（QCE 2023 + CIRCUS EPJ QT 2024）、QubiC（TQE 2021 / QCE 2023 / QCE 2024）、QICK（RSI 2022 / PRResearch 2024 / Qibosoq QST 2025）、Presto（RSI 2022）、ICARUS-Q（RSI 2022）、Manarat（RSI 2026）、SQ-CARS（TIM 2023）、多 FPGA 同步（FCCM 2025）、TITAN（DAC 2024）
- 译码-反馈协同（Bell 自承的多轮 QEC 瓶颈所在）：controller-decoder 需求推导（Quantum 2026）、Riverlane 实时译码器（Nature Electronics 2025）、实时低延迟 QEC 演示（Nature Communications 2026）、Deltaflow/Deltakit（QCE 2025）、Micro Blossom（ASPLOS 2025）、SWIPER（ISCA 2025）、Triage（ISCA 2026）、亚微秒译码-反馈开源系统（QCE 2026）、Pinball 低温预译码（HPCA 2026）、4K 症候压缩（ISCA 2026）

### 8.2 关键判断

1. **新颖性定位成立**："把反馈时延预算作为编译期一等约束 + 控制/数据严格分离 + 离子阱平台"的交叉点无直接先例。最接近的三篇必须正面对标：**ARTERY**（ISCA 2025，分支预测做反馈）、**CLINE**（HPCA 2026，控制流编译+控制线编码）、**Quantum Control Machine**（POPL 2024，控制流语义）。硬件侧最近邻是 **ARTIQ**（内核式实时控制，无静态编译流水线）与 **QubiC/QICK**（超导平台，反馈延迟量级相当）。
2. **亚微秒反馈不是孤例**：超导平台已有 125–590 ns 量级的实时反馈（RSI 2022、npj QI 2020），Bell 的 ~690 ns 在离子阱平台上属首次系统化+编译驱动，写作时应以"离子阱平台 + 编译期保证 + 无主机介入"为差异点，而非单纯延迟数字。
3. **QCE 2026 已出现同方向密集投稿**（QSYS·Quantum Control Architectures / Accelerated QEC & Feedback Systems 两个 session），说明该主题正热；ISCAS 2027 电路视角（RISC-V 板级 + TTL/TCM 硬件协议）仍有空间，但需强调电路-系统协同（对比 FCCM 2025 多 FPGA 同步、DATE 2025 低温 CMOS 低延迟反馈）。
4. **多轮 QEC 扩展是公认痛点**：Bell 自承每次反馈固定 ~700 ns 开销；Quantum 2026 controller-decoder 需求论文与 Riverlane/Google 的延迟口径之争（CS4Q-R05）表明"译码-反馈延迟预算"是活跃争议点，可作为 ISCAS 2027 后续工作的动机。

### 8.3 检索覆盖度说明（不重不漏的边界）

| venue 类别 | 覆盖方式 | 置信度 |
|---|---|---|
| IEEE TQE / QCE | 本地全目录逐条筛选（465+1674 条，100%） | **最高** |
| 电路 venue（ISSCC/JSSC/TCAS/T-MTT/TIM/TAS/RSI 等） | Crossref 全量枚举 + WebSearch 补充 | 高 |
| EDA venue（DAC/ICCAD/DATE/ASP-DAC/TCAD 等 16 个） | Crossref 全量枚举（1131 条原始记录） | 高（**2026 DAC/ICCAD 缺**，Crossref 未收录） |
| 体系结构（ISCA/MICRO/HPCA/ASPLOS/TC/TCAD/CAL/TACO/Micro） | Crossref 相关性检索 + DOI 去重 | 高（非完整 TOC 枚举，或有极少量遗漏） |
| 量子期刊（PRX Q/npj/QST/Quantum/ACM TQC 等 16 刊） | Crossref+OpenAlex 双源核验 | 高 |
| 软工/PL（POPL/PLDI/OOPSLA/ASE/ICSE/FSE/TSE/TOSEM/CGO/CC） | Crossref 逐条 DOI 核验 | 高 |
| 网络（INFOCOM/SIGCOMM/JSAC/ToN/TNSM） | Crossref 会议论文集+期刊过滤 | 高 |
| FPGA 会议（FCCM/FPL/FPT） | Crossref | 高 |
| **NSDI / USENIX ATC / OSDI / SOSP** | Crossref 收录稀薄 + DBLP 被 Anubis 反爬拦截 | **低**（"未检索到"非断言不存在；可用 dblp.xml.gz 离线补查） |
| QCrypt / TQC / QIP / APS March Meeting | 官网/摘要库检索 | 中（摘要制无 DOI，QIP 无 proceedings） |
| Cryogenics / SUST / JLTP | Crossref 关键词过滤 | 中（未穷举全部年份） |
| ICECS / TBioCAS / MWTL / TODAES / Measurement | 明确检索，未命中相关论文 | 高（阴性结论） |

**存档文件**（本 worktree 外的主仓库 `C:\Users\xiaoshe\.claude\jobs\bd00f0a5\tmp\`）：
- `agent_quantum_journals.md` — 量子期刊全量表（含 QIP 18 条、IJQI 6 条完整书目）
- `agent_architecture.md` — 体系结构全量表（含 ISCA/MICRO/HPCA/ASPLOS 全部边缘条目）
- `agent_softpl_topjournals.md` — 软工 PL + 顶刊全量表
- `agent_network_instruments.md` — 网络/仪器全量表（含 INFOCOM 28 条、ToN/TNSM/JSAC 全部）
- `tmp_usage/master.out` — EDA agent 的 1131 条 Crossref 原始记录

---

*报告生成：2026-09-29。7 个并行检索 agent（离子阱/体系结构/EDA/电路/量子期刊/软工顶刊/网络仪器）+ 本地 TQE/QCE 全目录筛选。所有 DOI/arXiv 链接均来自实际检索，未核实项已标注 ⚠。*


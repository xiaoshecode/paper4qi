# 测控与容错纠错：来源核验记录

核验日期：2026-10-28。对应 `data_src/research/control-qec.json` 的 8 个子专题、24 个不同来源。

本轮核对了论文题名、作者来源页面、年份或期刊引用信息，以及摘要能够支持的研究范围；部分期刊页面还读取了引言、方法说明或数据/代码信息。来源限定为作者提交的 arXiv 页面和原出版机构页面，不以新闻稿、聚合数据库或搜索摘要的宣传用语作为技术结论。没有重跑作者实验、复现其代码或逐页审阅全部补充材料，因而不将摘要阅读写成完整复现。

本文件和 JSON 中的“研究空白”均是编辑综合提出的后续问题，不是“该问题从未被研究”的事实判断。检索覆盖从脉冲控制到逻辑操作的代表路径，不是全领域系统综述；未收录某篇论文不代表其不重要。

## 年份与证据边界

`year` 优先采用能够核验到的期刊年；只以预印本收录的项目采用首次提交年。在线发表年、期刊卷年和修订年可能不同，显著差异在记录注释中说明。QICK 按 arXiv 首次提交的 2021 年收录；QubiC 分布式架构按 2024 年预印本收录，未据此宣称有某个正式期刊版本。

Google 的低于表面码阈值论文是 2024 年在线发表、2025 年期刊卷，页面另列 2026-04-28 作者勘误。本轮只用它支持“码距扩展、实时译码、周期与延迟要分开”的范围性判断，未复制勘误相关精确实验数字。需要定量引用时，应读取期刊更新版和勘误。

以下表格的“用途与限制”只记录本轮用于组织专题的要点，完整引用仍以链接原文为准。

| 子专题 | 已核验的一手来源 | 年份与用途 / 限制 |
| --- | --- | --- |
| 脉冲校准 | [Simple pulses for elimination of leakage in weakly nonlinear qubits](https://arxiv.org/abs/0901.0534) | 2009；DRAG 理论基础，非任意器件实测保证。 |
| 脉冲校准 | [Optimal quantum control using randomized benchmarking](https://arxiv.org/abs/1403.0035) | 2014；以实验基准驱动控制优化。 |
| 脉冲校准 | [Adaptive hybrid optimal quantum control for imprecisely characterized systems](https://arxiv.org/abs/1402.7193) | 2014；模型优化与闭环校正结合。 |
| FPGA / RFSoC | [The QICK: Readout and control for qubits and detectors](https://arxiv.org/abs/2110.00557) | arXiv 2021，修订 2022；开放控制系统及器件基准。 |
| FPGA / RFSoC | [QubiC 2.0](https://arxiv.org/abs/2309.10333) | 2023；控制系统、同步及条件前馈演示。 |
| FPGA / RFSoC | [Distributed Architecture for FPGA-based Superconducting Qubit Control](https://arxiv.org/abs/2404.15260) | 2024 预印本；控制核、中间表示与编译路径。 |
| 低温与读出 | [CMOS-based cryogenic control of silicon quantum circuits](https://www.nature.com/articles/s41586-021-03469-4) | 2021；区分冷端控制器与量子比特温区。 |
| 低温与读出 | [A cryo-CMOS chip that integrates silicon quantum dots and multiplexed dispersive readout electronics](https://www.nature.com/articles/s41928-021-00687-6) | 在线 2021 / 期刊 2022；电荷读出不等于自旋态判别。 |
| 低温与读出 | [Rapid high-fidelity multiplexed readout of superconducting qubits](https://arxiv.org/abs/1801.07904) | 2018；测量时长、选择性和串扰需要分别评估。 |
| 反馈延迟 | [Deterministic entanglement of superconducting qubits by parity measurement and feedback](https://www.nature.com/articles/nature12513) | 2013；奇偶测量与反馈的原语实验。 |
| 反馈延迟 | [Quantum error correction below the surface code threshold](https://www.nature.com/articles/s41586-024-08449-y) | 在线 2024 / 期刊 2025；2026 勘误可见，定量引文须用更新版。 |
| 反馈延迟 | [Demonstrating real-time and low-latency quantum error correction with superconducting qubits](https://www.nature.com/articles/s41467-026-73331-6) | 2026-06-01；8 比特实验，指定反馈测量边界。 |
| 表面码译码 | [Almost-linear time decoding algorithm for topological codes](https://arxiv.org/abs/1709.06218) | 2017 预印本 / Quantum 2021；Union-Find 理论与数值基线。 |
| 表面码译码 | [Sparse Blossom](https://quantum-journal.org/papers/q-2025-01-20-1600/) | Quantum 2025；软件算法速度与整机反馈延迟不同。 |
| 表面码译码 | [Local clustering decoder as a fast and adaptive hardware decoder for the surface code](https://www.nature.com/articles/s41467-025-66773-x) | 2025-12-17；FPGA 译码与噪声适配，留意评估条件。 |
| qLDPC | [Decoding Across the Quantum LDPC Code Landscape](https://arxiv.org/abs/2005.07016) | 2020；BP+OSD 数值基线，页面含期刊引用与代码入口。 |
| qLDPC | [High-threshold and low-overhead fault-tolerant quantum memory](https://www.nature.com/articles/s41586-024-07107-7) | 2024；编码、连接与噪声模型方案，非对应硬件存储实验。 |
| qLDPC | [Localized statistics decoding for quantum low-density parity-check codes](https://www.nature.com/articles/s41467-025-63214-7) | 2025-09-02；数值与并行算法，未当作硬件实时演示。 |
| 逻辑操作 | [Surface code quantum computing by lattice surgery](https://arxiv.org/abs/1111.4022) | 2011 预印本 / NJP 2012；理论构造。 |
| 逻辑操作 | [A Game of Surface Codes](https://quantum-journal.org/papers/q-2019-03-05-128/) | 2019；带假设的时空资源模型。 |
| 逻辑操作 | [Experimental demonstration of logical magic state distillation](https://www.nature.com/articles/s41586-025-09367-3) | 2025；逻辑蒸馏实验，保留后选择与接受率口径。 |
| 玻色编码 | [Encoding a qubit in an oscillator](https://journals.aps.org/pra/abstract/10.1103/PhysRevA.64.012310) | PRA 2001；GKP 理论来源。 |
| 玻色编码 | [Real-time quantum error correction beyond break-even](https://arxiv.org/abs/2211.09116) | 2022 预印本 / Nature 2023；存储增益而非通用逻辑门结论。 |
| 玻色编码 | [Hardware-efficient quantum error correction via concatenated bosonic qubits](https://www.nature.com/articles/s41586-025-08642-7) | 2025；猫态与外层重复码，分别评估两类逻辑错误。 |

## 检索匹配如何使用

`keywords` 是用于本地标题、摘要和标签匹配的字面英文词组，包含常见连字符变体。缩写仅在有足够区分度时保留，例如 QICK、QubiC、RFSoC、PyMatching 和 qLDPC。当前 `exclude_keywords` 留空，避免未经样本评估就排除交叉研究。`categories` 是现有大类的辅助过滤，不应当作严格本体或人工审定标签。

推荐给其他 agent 的调研产物为一张逐篇证据表：来源链接、年份口径、理论/数值/硬件/整机实验类型、实际代码与器件规模、噪声模型、时序起止点、误差指标、资源成本和适用限制。之后再提出跨来源比较；不能把不同论文的最好数值直接拼成一台系统的性能。

## 本轮可优先继续的交叉问题

1. **校准到逻辑表现**：把并行串扰和漂移输入 syndrome 模型，验证平均物理门改善是否转化为逻辑失败率下降。
2. **译码到条件执行**：把吞吐、响应分布、窗口和分支依赖一起放入时序评估，检查非 Clifford 工作负载的真实关键路径。
3. **码率到系统资源**：统一比较 qLDPC、表面码和玻色级联方案的连接、热预算、控制器、辅助比特与经典计算代价。

以上三点是本轮编辑综合的研究建议，仍需继续检索与实验验证。

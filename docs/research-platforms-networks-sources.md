# 硬件平台、互连网络与应用验证：来源与范围

核查日期：2026-10-28。结构化主文件：`data_src/research/platforms-networks.json`。

## 核查范围与证据等级

本轮建立 9 个子主题、28 个来源条目。来源限于原始论文的出版方页面或作者 arXiv、作者维护的软件仓库，以及 IRTF 官方技术文档；未使用新闻报道、百科或二次文献聚合页支撑研究结论。覆盖材料与封装、原子与离子、自旋接口、光子与转换器、网络中继、模块化执行、传感、算法资源及 QML 验证，目的是形成可继续扩展的调研入口，不声称穷尽这些领域。

本轮核查了可取得的题名、发表元数据及摘要或正文相关段落。若出版方直连因登录/缓存跳转失败，则使用同一出版方的检索可见正文或作者预印本交叉检查；这不等于逐篇完整审读补充材料，更不等于复现实验。研究问题、研究判断和下一步实验设计属于本站综合，不应当作被引作者已证明的结论。

日期口径：Nature 等期刊的 `year` 优先使用卷期年份；在线发表年份不同的条目已在备注说明。arXiv 入口按所核查的首次提交年记录，未据此声称已同行评审。Qualtran 使用仓库本身作为持续演化的软件来源，不虚构单一发表年。RFC 9340 的 `kind=standard` 仅用于站点技术文档分类，文件实际状态是 IRTF Informational，明确不是 Internet Standards Track 标准。

部分 Nature 页面直连存在跳转限制，所用出版方检索摘要仍可核对：中性原子容错架构、硅自旋高保真门与搬运、可制造光子平台、硅纳米机械转换器、长寿命远程离子纠缠。材料论文保留作者 arXiv 入口与 2020 提交年，避免把未在该入口核实的期刊年份混入。

## 子主题与原始来源


### 超导材料、三维封装与跨芯片耦合

`superconducting-materials-packaging` · 分类：SUP, MAT

| 来源 | 类型 / 年份 | 本轮使用范围与限制 |
| --- | --- | --- |
| [New material platform for superconducting transmon qubits with coherence times exceeding 0.3 milliseconds](https://arxiv.org/abs/2003.00024) | paper / 2020 | 作者预印本入口，年份取首次提交年。以钽材料和工艺改进研究 transmon 相干性；该指标不能直接替代多比特门、封装良率或容错性能。 |
| [Solid-state qubits integrated with superconducting through-silicon vias](https://www.nature.com/articles/s41534-020-00289-8) | paper / 2020 | 原始实验将超导 TSV 与量子比特、两芯片凸点键合和控制读出结合，适合作为垂直互连研究起点；并非完整大规模处理器验证。 |
| [Entanglement across separate silicon dies in a modular superconducting qubit device](https://www.nature.com/articles/s41534-021-00484-1) | paper / 2021 | 在四块分立芯片之间演示确定性耦合与纠缠门；比较时应保留门型、误差条和各器件分布，不能只用最佳保真度概括全部互连。 |

### 离子阱与中性原子的动态连接和持续运行

`ion-neutral-atom-platforms` · 分类：PLAT, QEC

| 来源 | 类型 / 年份 | 本轮使用范围与限制 |
| --- | --- | --- |
| [A Race-Track Trapped-Ion Quantum Processor](https://journals.aps.org/prx/abstract/10.1103/PhysRevX.13.041052) | paper / 2023 | QCCD 原始系统论文，同时报告基本操作、系统级基准和应用实验；适合追踪搬运架构到实际程序的性能损失。 |
| [Logical quantum processor based on reconfigurable atom arrays](https://www.nature.com/articles/s41586-023-06927-3) | paper / 2024 | Nature 卷期年为 2024，在线发表于 2023。分区原子阵列支持编码操作与中途读出；部分结果采用误差探测，不能统称为长期容错运行。 |
| [A fault-tolerant neutral-atom architecture for universal quantum computation](https://www.nature.com/articles/s41586-025-09848-5) | paper / 2026 | Nature 卷期年为 2026，在线发表于 2025。研究重复纠错、逻辑门、通用性与中途复用等构件；应逐项核对轮次、编码与错误移除条件。 |

### 半导体自旋接口、搬运总线与多体校验

`spin-qubit-interfaces` · 分类：PLAT, ARCH

| 来源 | 类型 / 年份 | 本轮使用范围与限制 |
| --- | --- | --- |
| [Quantum logic with spin qubits crossing the surface code threshold](https://www.nature.com/articles/s41586-021-04273-w) | paper / 2022 | 以门集层析评估硅自旋通用门，并考察邻比特串扰和闲置误差；标题中的阈值比较依赖噪声与编码假设，并非完整纠错处理器证明。 |
| [High-fidelity single-spin shuttling in silicon](https://www.nature.com/articles/s41565-025-01920-5) | paper / 2025 | 对比两类搬运模式，报告往返累计距离下的相干传输。累计 10 微米不是两端相距 10 微米的独立一次链路；保留其 RB 与相位补偿条件。 |
| [Weight-four parity checks in a spin-shuttling architecture](https://www.nature.com/articles/s41586-026-10766-3) | paper / 2026 | 2026 年原始实验用搬运总线连接有效五比特系统，演示最高权重四的 X/Z 校验与多体纠缠；校验构件不等于长期逻辑纠错收益。 |

### 集成光子、微波光学转换与量子链路

`photonic-transduction-links` · 分类：PHOT, COMM

| 来源 | 类型 / 年份 | 本轮使用范围与限制 |
| --- | --- | --- |
| [A manufacturable platform for photonic quantum computing](https://www.nature.com/articles/s41586-025-08820-7) | paper / 2025 | 集成生成、操控、探测与芯片间光子接口的制造平台。若干保真度以成功探测为条件，必须与光子损耗和成功概率一起解读。 |
| [Quantum-enabled microwave-to-optical transduction via silicon nanomechanics](https://www.nature.com/articles/s41565-025-01874-8) | paper / 2025 | 原始实验研究集成硅电光机械转换器的量子工作区间；低附加噪声和转换效率是链路构件指标，不直接等于远程计算门性能。 |
| [Quantum Entanglement between Optical and Microwave Photonic Qubits](https://journals.aps.org/prx/abstract/10.1103/PhysRevX.14.031055) | paper / 2024 | 芯片级微波与光学光子纠缠源，采用双轨编码并估计纠缠保真度下界；并非两个独立超导处理器间完整通信栈演示。 |

### 量子中继、纠缠路由与网络控制

`quantum-repeaters-routing` · 分类：COMM

| 来源 | 类型 / 年份 | 本轮使用范围与限制 |
| --- | --- | --- |
| [RFC 9340: Architectural Principles for a Quantum Internet](https://www.rfc-editor.org/rfc/rfc9340.html) | standard / 2023 | IRTF/QIRG 的 Informational 架构文档，不是 Internet Standards Track 标准。提供纠缠、临时状态和经典控制协同的术语与设计原则。 |
| [Entanglement of nanophotonic quantum memory nodes in a telecom network](https://www.nature.com/articles/s41586-024-07252-z) | paper / 2024 | 钻石 SiV 纳米光子存储节点接入电信光纤，分别演示光纤盘与城市部署光纤链路；两节点实验不能替代多跳中继吞吐验证。 |
| [Long-lived remote ion–ion entanglement for scalable quantum repeaters](https://www.nature.com/articles/s41586-026-10177-4) | paper / 2026 | 远程离子存储纠缠寿命超过平均建立时间，是中继所需构件。论文的有限尺寸密钥分析与渐近距离结果采用不同口径，应分开引用。 |

### 分布式量子计算与模块化执行

`distributed-modular-computing` · 分类：ARCH, COMM

| 来源 | 类型 / 年份 | 本轮使用范围与限制 |
| --- | --- | --- |
| [Deterministic teleportation of a quantum gate between two logical qubits](https://www.nature.com/articles/s41586-018-0470-y) | paper / 2018 | 利用实时自适应控制在超导腔编码比特之间实现门传态。它是模块化执行构件，不能当作远距离光纤网络或完整容错系统性能。 |
| [Distributed quantum computing across an optical network link](https://www.nature.com/articles/s41586-024-08404-x) | paper / 2025 | 两个光学互连离子模块通过远程纠缠执行传态门及分布式小型算法；应同时记录远程门保真度、建链开销与算法成功率。 |
| [Unconditionally teleported quantum gates between remote solid-state qubit registers](https://www.nature.com/articles/s41467-026-72818-6) | paper / 2026 | 远程 NV 电子自旋与碳核数据比特协同实现无后选择门。文中仍讨论纠缠生成超时，不能把 unconditional 解释为整个建链过程始终成功。 |

### 量子传感、精密计量与真实测量增益

`sensing-metrology-validation` · 分类：SENS

| 来源 | 类型 / 年份 | 本轮使用范围与限制 |
| --- | --- | --- |
| [Quantum sensing](https://journals.aps.org/rmp/abstract/10.1103/RevModPhys.89.035002) | review / 2017 | 作者综述提供信号耦合、控制、估计与灵敏度的系统框架。用于统一指标与术语，不能用其历史例子代表当前性能纪录。 |
| [Entanglement-Enhanced Optical Atomic Clock](https://arxiv.org/abs/2006.07501) | paper / 2020 | 作者页明确关联 Nature 588, 414–418（2020）。演示光学钟纠缠增强与 Allan 偏差改善；优势比较以文中相同系统的 SQL 基线为准。 |
| [Reconstruction-Free Quantum Sensing of Arbitrary Waveforms](https://journals.aps.org/prapplied/abstract/10.1103/PhysRevApplied.12.054028) | paper / 2019 | 用 NV 自旋和差分回波直接测时变磁场，连接控制序列与传感带宽；脉冲持续时间及实验条件限制其可外推范围。 |

### 算法资源估算与应用可行性验证

`algorithm-resource-validation` · 分类：ALG, ARCH, QEC

| 来源 | 类型 / 年份 | 本轮使用范围与限制 |
| --- | --- | --- |
| [Assessing requirements to scale to practical quantum advantage](https://arxiv.org/abs/2211.07629) | paper / 2022 | 作者预印本把应用到物理比特的层级联系起来，比较规模、速度与可控性；结果依赖其任务、误差预算和体系结构假设。 |
| [How to factor 2048 bit RSA integers with less than a million noisy qubits](https://arxiv.org/abs/2505.15917) | paper / 2025 | 作者预印本给出特定误差率、纠错周期与反馈时延下的空间时间折中估算。论文不是实际分解 RSA-2048 的实验报告，也不表示硬件已满足这些假设。 |
| [Quantum computing enhanced computational catalysis](https://journals.aps.org/prresearch/abstract/10.1103/PhysRevResearch.3.033055) | paper / 2021 | 从催化化学流程连接电子结构、量子算法与资源估算，补充材料提供不同活性空间成本。其化学模型、初态准备与所需精度须连同门数一起审查。 |
| [Qualtran: quantum algorithms representation and resource analysis](https://github.com/quantumlib/Qualtran) | software / 持续更新 | 官方研究软件仓库，用可组合算法构件支持资源分析。软件仍在演化，复现时固定提交或版本，并独立检查分解规则、精度与成本参数。 |

### 量子机器学习的基线、可训练性与优势边界

`qml-benchmark-validity` · 分类：QML, ALG

| 来源 | 类型 / 年份 | 本轮使用范围与限制 |
| --- | --- | --- |
| [Power of data in quantum machine learning](https://www.nature.com/articles/s41467-021-22539-9) | paper / 2021 | 分析训练数据如何增强经典预测能力，并提出判断学习优势的方法。构造任务的分离或数值优势不能直接推广到一般真实数据。 |
| [Barren plateaus in quantum neural network training landscapes](https://www.nature.com/articles/s41467-018-07090-4) | paper / 2018 | 给出一类随机参数化电路中梯度集中和训练困难的理论分析；结论依赖线路分布、深度等条件，并非断言所有量子模型都不可训练。 |
| [Better than classical? The subtle art of benchmarking quantum machine learning models](https://arxiv.org/abs/2403.07059) | paper / 2024 | 作者预印本系统比较多种量子分类器与经典基线，展示实验设计与消融的重要性；其有限规模任务结果不能作为所有 QML 不可能有优势的证明。 |

## 推荐的横向证据表

先统一实验任务和资源口径，再进行横向比较。每条结论至少记录：原始链接、版本或发表状态、物理平台、任务规模、样本量、误差条、是否后选择、是否仅条件成功、总尝试次数、总墙钟时间，以及有无可获取代码和数据。

- 硬件和封装：把最佳器件、器件均值与批次分布分开；保留同时操作、串扰、热循环和失效条件。
- 搬运和网络：分别记录单次端到端距离与往返累计距离；将等待、重试、确认消息、超时及存储衰减纳入吞吐和尾时延。
- 远程量子门：无后选择的门操作不意味着纠缠建立无失败；将建链服务和条件于已有纠缠的门区分。
- 光子和转换器：条件保真度与光子损失、转换效率、附加噪声、带宽和热负载同时报告。
- 传感：统一总测量时间、粒子数、带宽与目标参数，检查死区时间和状态制备成本。
- 算法和 QML：固定任务精度与成功概率，使用公平的经典基线，报告数据准备、调参、shots、物理成本与失败实验。

## 自动归类的边界

`keywords` 是供站点检索的英文词组线索，不是科学分类真值。主题可重叠，标题与摘要未命中不等于论文不相关；关键词命中也不证明论文本身支持该主题的研究判断。`categories` 沿用站点现有分类，不引入新枚举。`exclude_keywords` 暂为空，避免在没有人工误判样本时过早剔除跨学科结果。建议上线后对每个子主题人工抽检命中与未命中样本，并保存规则版本。

本轮另用当前库试跑关联规则，抽看各主题得分前三的题名。发现宽泛词组 `photonic quantum` 把一个金融强化学习题目排到器件互连主题前列，已改用集成光子、光子源、探测器、转换器与互连词组。调整后领先题名转为探测器校准、量子转换策略与集成光子硬件。这只是小样本相关性检查，不能报告为分类准确率；仍需读摘要和原文进行筛选。

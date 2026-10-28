# 软件、编译与系统架构：来源核验记录

核验日期：2026-10-28（Asia/Shanghai）。对应数据：`data_src/research/software.json`。

本轮按 8 个子主题整理 26 个来源引用，使用作者提交的 arXiv 页面、出版机构页面、规范维护者和工具维护者文档。其用途是建立可继续研究的证据入口，不能据此声称覆盖全部相关论文。

## 核验方法与限制

- 论文主要核对标题、摘要、提交／修订记录，以及可获得的会议或期刊信息；没有将这一过程写成逐篇全文审读或性能复现。
- `year` 对 arXiv 链接通常取首次预印本年份；对 Quantum、Nature 正式论文取已核验的发表年份。预印本后续修订不覆盖首次年份。
- 规范与工具文档不随意填写出版年。其内容会变化，后续复现应固定 tag、commit、软件依赖与目标硬件状态。
- 不采用搜索结果中的非一手聚合文章、维基百科或社交媒体作为事实依据；它们至多用于发现原始链接。
- 不复述来源的绝对领先宣传，不把特定实验的相对加速或资源节省外推为普遍优势。
- `keywords` 用于标题、摘要与标签的字面匹配；多词短语与工具名并用。命中只是调研线索，不等同于人工确认分类，未命中也不证明主题无相关工作。

## 元数据与时效性注意

1. OpenQASM 3 设计论文的 2021 预印本与正式期刊 DOI 需区分。官方仓库与版本化页面本轮显示 3.1 入口，不以通用搜索摘要中可能残留的旧版本描述判定当前规范。
2. QIR 仓库及 profile 持续更新。能力应按具体 profile／版本检查，不把“基于 LLVM”推导为无条件互操作。
3. QED-C 的 arXiv 页面同时显示首次提交 2021、修订 2023、TQE.2023 DOI 和不一致的 journal-reference 年份。本数据保留 2021 预印本年，避免将元数据冲突静默改成出版结论。
4. Generating Compilers for Qubit Mapping and Routing 首发 2025-08-14，读取到的 v3 修订日期为 2026-01-21；正文摘要较早搜索摘录有变化，以落地页当前摘要为准。
5. Irene 首发 2026-09-28，属于本轮较新的预印本线索。其支持范围为有界混合程序，未复现其性能或漏洞发现结果。
6. QNodeOS 正式题名为 An operating system for executing applications on quantum network nodes，2025-03-12 发表，DOI 10.1038/s41586-025-08704-w。另有 2024 预印本题名 Design and demonstration of an operating system for executing applications on quantum network nodes（[arXiv](https://arxiv.org/abs/2407.18306)）。出版机构 HTML 直接读取曾发生授权跳转；核验使用其搜索可读正文与[出版机构 PDF](https://www.nature.com/articles/s41586-025-08704-w.pdf)所载书目信息，并与作者预印本交叉核对。

## 1. 语言规范与多层中间表示 (languages-ir)

### 1.1 OpenQASM 3: A broader and deeper quantum assembly language

- 一手来源：[论文页面](https://arxiv.org/abs/2104.14722)
- 年份：2021；具体预印本／正式发表口径见下。
- 已核验及解释边界：2021 年预印本；阐明实时与近实时经典交互，以及控制流、时序和多层表示的设计动机。期刊版本 DOI 为 10.1145/3505636，不能把预印本年份直接写成期刊出版年。

### 1.2 Introduction — OpenQASM 3.1 Specification

- 一手来源：[官方规范](https://openqasm.com/versions/3.1/intro.html)
- 年份：不填写；持续维护文档，没有据本次证据确定统一出版年。
- 已核验及解释边界：核对官方版本化规范入口和基于测量结果的经典前馈语义；具体语法与变更应继续检查对应章节及版本记录。规范存在某特性并不证明设备已支持。

### 1.3 QIR specification defining how to represent quantum programs within the LLVM IR

- 一手来源：[官方规范](https://github.com/qir-alliance/qir-spec)
- 年份：不填写；持续维护文档，没有据本次证据确定统一出版年。
- 已核验及解释边界：QIR Alliance 官方规范仓库；用于追踪 LLVM 表示、profile 与能力约束。该入口持续变化，未在本次固定规范发布日期或宣称所有实现兼容。

- 本主题描述、问题与研究空白为编辑综合，研究空白均标记“综合判断／待验证”；不是来源作者共同确认的结论。

## 2. 线路综合、布局与硬件感知路由 (synthesis-routing)

### 2.1 Tackling the Qubit Mapping Problem for NISQ-Era Quantum Devices

- 一手来源：[论文页面](https://arxiv.org/abs/1809.02573)
- 年份：2018；具体预印本／正式发表口径见下。
- 已核验及解释边界：2018 年预印本，ASPLOS 2019 发表；提出 SABRE 的双向搜索、初始映射与深度／门数权衡。原文实验结果只适用于其基准和对照条件。

### 2.2 Tackling the Qubit Mapping Problem with Permutation-Aware Synthesis

- 一手来源：[论文页面](https://arxiv.org/abs/2305.02939)
- 年份：2023；具体预印本／正式发表口径见下。
- 已核验及解释边界：核对 PAS/PAM 的分块、输入输出置换和路由协同方法；IEEE QCE 2023 DOI 为 10.1109/QCE57702.2023.00090。

### 2.3 Generating Compilers for Qubit Mapping and Routing

- 一手来源：[论文页面](https://arxiv.org/abs/2508.10781)
- 年份：2025；具体预印本／正式发表口径见下。
- 已核验及解释边界：预印本首发 2025-08-14，所读版本修订于 2026-01-21；用设备状态机和领域专用描述生成映射路由算法。竞争力是论文案例中的结果，不代表任意硬件上的最优性。

- 本主题描述、问题与研究空白为编辑综合，研究空白均标记“综合判断／待验证”；不是来源作者共同确认的结论。

## 3. 动态线路、前馈与实时运行时 (dynamic-runtime)

### 3.1 QubiC 2.0: An Extensible Open-Source Qubit Control System Capable of Mid-Circuit Measurement and Feed-Forward

- 一手来源：[论文页面](https://arxiv.org/abs/2309.10333)
- 年份：2023；具体预印本／正式发表口径见下。
- 已核验及解释边界：核对 FPGA／RFSoC 控制架构、多核分布设计、Python 编译栈与条件线路演示。论文报告的是具体平台实验，不能推广成任意设备的延迟保证。

### 3.2 Classical feedforward and control flow (dynamic circuits)

- 一手来源：[官方工具文档／仓库](https://quantum.cloud.ibm.com/docs/en/guides/classical-feedforward-and-control-flow)
- 年份：不填写；持续维护文档，没有据本次证据确定统一出版年。
- 已核验及解释边界：IBM 官方指南，说明中途测量、经典逻辑和控制流编程；示例依赖页面标示的软件版本。未将 SDK 构造能力等同于全部硬件支持。

### 3.3 Execute dynamic circuits

- 一手来源：[官方工具文档／仓库](https://quantum.cloud.ibm.com/docs/en/guides/execute-dynamic-circuits)
- 年份：不填写；持续维护文档，没有据本次证据确定统一出版年。
- 已核验及解释边界：核对执行侧约束，包括控制电子学内存、条件广播和 OpenQASM 输入支持范围；这些限制会变化，实际实验前应重新读取并查询目标后端。

- 本主题描述、问题与研究空白为编辑综合，研究空白均标记“综合判断／待验证”；不是来源作者共同确认的结论。

## 4. 形式化验证与编译等价性 (verification)

### 4.1 A Verified Optimizer for Quantum Circuits

- 一手来源：[论文页面](https://arxiv.org/abs/1912.02250)
- 年份：2019；具体预印本／正式发表口径见下。
- 已核验及解释边界：2019 年预印本；VOQC 以 Coq 与 SQIR 为基础证明优化保持语义。该证明范围应按论文语言和变换定义理解，不能自动扩展到任意 SDK 的执行栈。

### 4.2 Equivalence Checking of Parameterized Quantum Circuits: Verifying the Compilation of Variational Quantum Algorithms

- 一手来源：[论文页面](https://arxiv.org/abs/2210.12166)
- 年份：2022；具体预印本／正式发表口径见下。
- 已核验及解释边界：2022 年预印本，页面标注 ASP-DAC 2023；采用 ZX-calculus 处理参数化等价关系，并链接 QCEC 实现。

### 4.3 MQT QCEC — A tool for Quantum Circuit Equivalence Checking

- 一手来源：[官方工具文档／仓库](https://mqt.readthedocs.io/projects/qcec/en/stable/)
- 年份：不填写；持续维护文档，没有据本次证据确定统一出版年。
- 已核验及解释边界：官方工具文档，用于查验检查器、接口和适用限制。实际复现需固定稳定版本，不把随版本变化的支持矩阵写成永久事实。

### 4.4 Irene: Equivalence Checking of Hybrid Quantum Programs via Structure-Preserving Symbolic Reduction

- 一手来源：[论文页面](https://arxiv.org/abs/2609.36065)
- 年份：2026；具体预印本／正式发表口径见下。
- 已核验及解释边界：2026-09-28 预印本；处理有界混合量子程序，使用结构保持的符号化简、混合路径和与密度核推理。仅核对公开论文陈述，未复现其基准或漏洞结果。

- 本主题描述、问题与研究空白为编辑综合，研究空白均标记“综合判断／待验证”；不是来源作者共同确认的结论。

## 5. 经典仿真、张量网络与 HPC (simulation-hpc)

### 5.1 cuQuantum SDK: A High-Performance Library for Accelerating Quantum Science

- 一手来源：[论文页面](https://arxiv.org/abs/2308.01999)
- 年份：2023；具体预印本／正式发表口径见下。
- 已核验及解释边界：核对面向状态向量和张量网络的 GPU 原语及分布式扩展定位；论文页面标注 QCE 2023 接收。加速结果依赖具体线路、精度与硬件配置。

### 5.2 qsim — High-performance quantum circuit simulator for C++ and Python

- 一手来源：[官方工具文档／仓库](https://github.com/quantumlib/qsim)
- 年份：不填写；持续维护文档，没有据本次证据确定统一出版年。
- 已核验及解释边界：官方仓库说明状态向量表示、门融合、向量指令、多线程和 Cirq 接口，并要求引用所用版本。未在本次执行工具性能测试。

### 5.3 AerSimulator — Qiskit Aer

- 一手来源：[官方工具文档／仓库](https://qiskit.github.io/qiskit-aer/stubs/qiskit_aer.AerSimulator.html)
- 年份：不填写；持续维护文档，没有据本次证据确定统一出版年。
- 已核验及解释边界：官方 API 文档列出多种模拟方法、GPU 支持条件、精度、分块与动态线路抽样选项；方法和安装环境决定功能可用性。

- 本主题描述、问题与研究空白为编辑综合，研究空白均标记“综合判断／待验证”；不是来源作者共同确认的结论。

## 6. 基准体系与可复现评价 (benchmarks-reproducibility)

### 6.1 Application-Oriented Performance Benchmarks for Quantum Computing

- 一手来源：[论文页面](https://arxiv.org/abs/2110.03137)
- 年份：2021；具体预印本／正式发表口径见下。
- 已核验及解释边界：预印本首发 2021，所读版本修订于 2023；讨论应用质量、宽深规模和求解时间。页面的 journal-reference 年份与 TQE.2023 DOI 存在不一致，本条 year 明确取预印本首发年。

### 6.2 SupermarQ: A Scalable Quantum Benchmark Suite

- 一手来源：[论文页面](https://arxiv.org/abs/2202.11045)
- 年份：2022；具体预印本／正式发表口径见下。
- 已核验及解释边界：核对应用级、硬件无关基准与特征向量覆盖设计；原文不同平台结果应保留对应实验配置，不能视为持续更新的硬件排行榜。

### 6.3 Benchmarking the performance of quantum computing software

- 一手来源：[论文页面](https://arxiv.org/abs/2409.08844)
- 年份：2024；具体预印本／正式发表口径见下。
- 已核验及解释边界：Benchpress 的原始论文，评估软件开发工具的功能和处理性能。软件操作耗时不能替代量子硬件质量或算法实用收益。

- 本主题描述、问题与研究空白为编辑综合，研究空白均标记“综合判断／待验证”；不是来源作者共同确认的结论。

## 7. 分布式编译、网络运行时与调度 (distributed-scheduling)

### 7.1 NetQASM -- A low-level instruction set architecture for hybrid quantum-classical programs in a quantum internet

- 一手来源：[论文页面](https://arxiv.org/abs/2111.09823)
- 年份：2021；具体预印本／正式发表口径见下。
- 已核验及解释边界：核对网络指令集对本地门、经典逻辑与远程纠缠生成的表达，以及高层 SDK 的定位。协议／ISA 的通用性仍受实现系统模型约束。

### 7.2 AutoComm: A Framework for Enabling Efficient Communication in Distributed Quantum Programs

- 一手来源：[论文页面](https://arxiv.org/abs/2207.11674)
- 年份：2022；具体预印本／正式发表口径见下。
- 已核验及解释边界：MICRO 2022 工作；利用 burst communication 结构优化通信资源与程序延迟。报告的收益绑定论文基准与假设，并非跨 QPU 系统的普遍保证。

### 7.3 An operating system for executing applications on quantum network nodes

- 一手来源：[论文页面](https://www.nature.com/articles/s41586-025-08704-w)
- 年份：2025；具体预印本／正式发表口径见下。
- 已核验及解释边界：核对 Nature 2025-03-12 发表信息与 QNodeOS 演示：两节点 NV 平台执行应用和多任务，另展示单离子节点驱动；未把该实验描述成任意规模异构网络的实证。

- 本主题描述、问题与研究空白为编辑综合，研究空白均标记“综合判断／待验证”；不是来源作者共同确认的结论。

## 8. 容错编译与跨层资源估算 (fault-tolerant-compilation)

### 8.1 A Game of Surface Codes: Large-Scale Quantum Computing with Lattice Surgery

- 一手来源：[论文页面](https://quantum-journal.org/papers/q-2019-03-05-128/)
- 年份：2019；具体预印本／正式发表口径见下。
- 已核验及解释边界：核对 Quantum 3, 128，2019-03-05；通过表面码 patch 与晶格手术描述时空权衡、数据块和魔态供给。

### 8.2 Assessing requirements to scale to practical quantum advantage

- 一手来源：[论文页面](https://arxiv.org/abs/2211.07629)
- 年份：2022；具体预印本／正式发表口径见下。
- 已核验及解释边界：2022 年预印本提出跨栈资源估算框架与应用案例；所需物理资源取决于器件、编码、算法与错误预算假设。

### 8.3 Expressing and Analyzing Quantum Algorithms with Qualtran

- 一手来源：[论文页面](https://arxiv.org/abs/2409.04643)
- 年份：2024；具体预印本／正式发表口径见下。
- 已核验及解释边界：核对算法表示、可复用构件、资源计数及向表面码物理成本模型传递的流程；逻辑资源计数与物理成本应保留边界。

### 8.4 A High Performance Compiler for Very Large Scale Surface Code Computations

- 一手来源：[论文页面](https://quantum-journal.org/papers/q-2024-05-22-1354/)
- 年份：2024；具体预印本／正式发表口径见下。
- 已核验及解释边界：核对 Quantum 8, 1354，2024-05-22；面向大规模表面码计算的流式编译。编译吞吐演示不等于对应规模的容错硬件执行演示。

- 本主题描述、问题与研究空白为编辑综合，研究空白均标记“综合判断／待验证”；不是来源作者共同确认的结论。

## 后续优先核查

- 优先获取并阅读候选论文全文的实验设置、附录、局限与开源工件，再决定是否用于具体性能结论。
- 建立“规范表达／工具解析／编译通过／硬件执行／语义验证”五列能力矩阵，分别保存失败样本。
- 基准记录拆分软件处理耗时、硬件输出质量与端到端成本；公开超时和不支持项目。
- 资源估算公开假设与误差预算；仿真、解析估算和硬件实证单列，禁止混用证据等级。

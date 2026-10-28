## 核心判断

OpenQASM 已从量子电路交换语言发展为连接高级程序、实时经典控制和硬件校准的多层中间表示。对 Bell 这样的 FPGA 测控栈，最有价值的部分是 **测量反馈、时间约束、校准绑定与可验证的编译过程**。仅增加一个 QASM 文件导入器，通常不足以构成强的研究贡献。

截至 **2026 年 10 月 27 日**核查，官方最新正式规范为 **OpenQASM 3.1.0**；核心 OpenQASM 3 论文正式发表于 **2022 年 ACM Transactions on Quantum Computing**。规范版本、论文年份、解析器包版本和厂商支持版本应分别记录。[正式规范发布](https://github.com/openqasm/openqasm/releases/tag/spec/v3.1.0) · [核心论文与发表记录](https://arxiv.org/abs/2104.14722)

本专题选择 13 篇代表文献，其中 10 篇已确认正式发表，3 篇按预印本或技术报告列示；选取原则是覆盖语言、编译、静态分析、形式化验证和脉冲控制。这是一份研究导读，不是全领域文献计量统计。

## 规范与版本演进

| 时间 | 对象与状态 | 主要变化及引用方式 |
| --- | --- | --- |
| 2017 | OpenQASM 2 原始论文 | 门、电路、测量、复位和受限经典反馈；适用于电路交换。原始文按 arXiv 技术报告列示。 |
| 2020-11-11 | GitHub `3.0` 预发布标签 | 发布元数据标记为 prerelease，不应当作后来正式 3.0.0 的发布日期。 |
| 2021 / 2022 | OpenQASM 3 论文 | 2021 年预印本，2022 年正式期刊发表；提出更丰富的实时控制、时序与校准表达。 |
| 2023-08-16 | 正式规范 3.0.0 | 官方正式发布记录，与上述预发布标签及论文日期不同。 |
| 2024-05-15 | 正式规范 3.1.0 | 包括 `switch/case/default` 等扩展；本次核查的最新正式发布。 |
| 持续更新 | Live Specification / `main` | 开发中的规范；做实现或可复现实验时应固定稳定版本或具体提交。 |

日期采用发布源所列 UTC 日期。[官方发布列表](https://github.com/openqasm/openqasm/releases) · [发布元数据](https://api.github.com/repos/openqasm/openqasm/releases) · [稳定 3.1 规范](https://openqasm.com/versions/3.1/) · [3.1 更新说明](https://openqasm.com/versions/3.1/release_notes.html)

**“标准”的准确含义。** OpenQASM 是公开维护的语言规范，并形成广泛采用的交换格式。项目由 Technical Steering Committee 和工作组治理，通过公开提案与代码审查演进；这里的“开放规范”不等于获得 ISO、IEC 或 IEEE 标准编号。它也没有规定统一任务提交协议、驱动 ABI、FPGA 指令集或完整运行环境。[项目治理](https://github.com/openqasm/openqasm/blob/main/governance.md) · [版本维护流程](https://github.com/openqasm/openqasm/blob/main/CONTRIBUTING.md) · [规范范围](https://openqasm.com/versions/3.1/intro.html)

部分文档段落仍保留旧版草案措辞，判断正式版本时应以发布标签为准。Python 包的版本号与语言版本号是两套编号，不能由同名 PyPI 包的版本推断标准版本。

## OpenQASM 2 与 3 的能力差异

| 维度 | OpenQASM 2 | OpenQASM 3 系列 |
| --- | --- | --- |
| 主要用途 | 门级电路表示和交换 | 电路、实时经典计算、时间约束与校准的多层表示 |
| 数据 | `qreg`、`creg` 与门参数 | `qubit`、`bit`、`bool`、有位宽的整数/浮点/角度、数组等 |
| 控制流 | 经典寄存器与整数比较的受限条件执行 | `if/else`、`for`、`while`、子程序；3.1 加入 `switch` |
| 实时计算 | 表达能力有限，但并非完全没有反馈 | 可表达测量后的经典计算及 `extern` 调用 |
| 时序 | `barrier` 约束重排，无通用显式时间模型 | `duration`、`delay`、`durationof`、`stretch`、`box` |
| 校准 | 不提供 3 系列的校准机制 | `defcal`、`cal` 与可选的校准体语法 |
| 可移植性 | 门集、非标准头文件和厂商扩展仍需核对 | 还需核对类型、控制流、时序、脉冲和目标资源子集 |

表中是语言表达能力，不是任意设备的承诺。规范允许硬件限制其实时计算子集；编译期可求值与运行时可执行也必须区分。[OpenQASM 2 原始文](https://arxiv.org/abs/1707.03429) · [3.1 实现范围](https://openqasm.com/versions/3.1/intro.html) · [类型](https://openqasm.com/versions/3.1/language/types.html) · [语法](https://openqasm.com/versions/3.1/grammar/index.html)

以下自包含的门级例子展示“测量后决定是否施加 X”，而不要求某个具体厂商的校准文件。它是语言示例，能否在设备上执行还取决于目标能力。

```text
OPENQASM 3.0;
include "stdgates.inc";
qubit q;
bit result;
reset q;
h q;
result = measure q;
if (result == 1) {
    x q;
}
```

OpenQASM 3 重点解决相干时间内的实时交互；主机上的优化器、实验管理、批处理和参数扫描仍可由 Python 等框架负责。`extern` 是外部经典调用接口，本身不提供执行延迟保证。[OpenQASM 3 论文](https://doi.org/10.1145/3505636) · [经典指令](https://openqasm.com/versions/3.1/language/classical.html)

迁移 2 → 3 时不能只替换文件首行：标准库从常见的 `qelib1.inc` 转到 `stdgates.inc`，内建 `U` 等相位约定需要核对，受控操作中尤其不能随意忽略全局相位。[标准库兼容说明](https://openqasm.com/language/standard_library.html)

## 时序和 OpenPulse 应怎样理解

`delay` 给出显式时间；`barrier` 主要约束指令的重排顺序；`box` 约束一个操作区域；`stretch` 让编译器在编译期求解非负间隔。`dt` 是后端定义的波形采样时间单位，不能普遍解释成 CPU 指令周期，也不能未经约定直接等同 Bell 的 4 ns 时钟。[时序规范](https://openqasm.com/versions/3.1/language/delays.html)

`gate` 描述量子操作的酉变换结构；`defcal` 将一个操作绑定到物理比特和校准实现。`defcalgrammar "openpulse";` 选择 OpenPulse 校准语法，其模型包含 `port`、`frame`、`waveform` 和播放/采集操作。端口、频率、相位、校准数据和资源映射仍依赖设备。[校准接口](https://openqasm.com/versions/3.1/language/pulses.html)

稳定 3.1 文档仍注明 OpenPulse 语法处于积极开发中。因而“支持 OpenQASM 3”不能推出“支持 OpenPulse”，更不能推出“同一脉冲程序可无修改地在不同硬件上执行”。此外，规范要求 `defcal` 的持续时间在编译期确定；其中存在分支时，各分支需有可确定且相同的持续时间。这直接影响测量反馈的填充与调度设计。[OpenPulse 状态](https://openqasm.com/versions/3.1/language/openpulse.html) · [defcal 时长限制](https://openqasm.com/versions/3.1/language/pulses.html#restrictions-on-defcal-bodies)

**与 QIR 的关系。** QIR 是建立在 LLVM IR 上的量子程序表示；OpenQASM 更直接表达电路、时间与校准。两者可以衔接，但转换器只保证其声明支持的范围，不能假设脉冲、时序和动态程序信息会无损往返。[QIR 规范](https://github.com/qir-alliance/qir-spec) · [Microsoft OpenQASM 编译路径](https://github.com/microsoft/qdk/blob/main/source/compiler/qsc_openqasm_compiler/README.md)

## 当前应用与工具支持

评估工具时应分别询问四件事：能否解析、能否导入导出、能否保持语义地编译、目标设备能否执行。下面列的是本次核查时官方材料描述的能力，具体作业仍需查询设备与 SDK 版本。

| 平台或工具 | 用途与已声明能力 | 实际边界 | 官方资料 |
| --- | --- | --- | --- |
| IBM / Qiskit | OpenQASM 2/3 电路互换、动态电路工具链 | SDK 表示/导出能力与硬件不同；官方表对 `if/else` 与 `for/while/extern/def` 的硬件支持分别列示，不能统一写“全部支持” | [互操作](https://quantum.cloud.ibm.com/docs/en/guides/interoperate-qiskit-qasm3) · [逐项能力表](https://quantum.cloud.ibm.com/docs/en/guides/qasm-feature-table) |
| Amazon Braket | OpenQASM 3 门模型任务、厂商 pragma、支持设备上的脉冲控制 | QPU、按需模拟器与 LocalSimulator 的子集不同；本地模拟器支持的经典控制可能多于云端目标 | [支持特性](https://docs.aws.amazon.com/braket/latest/developerguide/braket-openqasm-supported-features.html) |
| Quantinuum / pytket | 电路优化、离子阱执行；增强 OpenQASM 2 与 QIR 路线 | 厂商扩展的经典运算/程序控制不能称为标准 OpenQASM 3；转换还需关注隐式比特置换 | [系统接口](https://docs.quantinuum.com/systems/user_guide/emulator_user_guide/introduction.html) · [pytket QASM](https://docs.quantinuum.com/tket/api-docs/qasm.html) |
| Google Cirq | 当前文档提供 OpenQASM 2.0/3.0 导入和导出 | 导入仍属实验性有限子集；不代表任意经典控制或 Google 硬件执行能力 | [互操作文档](https://quantumai.google/cirq/build/interop) |
| Microsoft QDK | OpenQASM 3 语义 AST → Q# → 能力分析、部分求值与 QIR | 类型、资源释放、输出与测量结果需要语义转换；不是纯文本格式替换 | [编译器说明](https://github.com/microsoft/qdk/blob/main/source/compiler/qsc_openqasm_compiler/README.md) |
| qe-compiler | 基于 MLIR 的量子、OpenQASM、Pulse、控制系统方言；面向通道划分和后端扩展 | 官方定位为编译框架，须实现目标后端；不是可直接使用的 Bell 驱动 | [项目仓库](https://github.com/openqasm/qe-compiler) |
| qBraid-QIR | OpenQASM 3 → QIR，连接多种软件框架 | 转换接口不自动提供目标硬件能力或脉冲可移植性 | [项目文档](https://sdk.qbraid.com/qbraid-qir/index.html) |

应用可归为三类：第一类是电路交换、编译和基准复现；第二类是中途测量、主动复位和纠错等实时反馈；第三类是门校准、表征和脉冲调度。前两类已经有成熟工具与实验需求，第三类更依赖厂商接口与实验室控制栈，不能单由语言版本判断可用性。

历史材料需要与现行服务区分。2020 年 Qiskit Pulse 论文是脉冲接口的重要文献，但 `qiskit.pulse` 已在 Qiskit 2.0 移除，IBM QPU 也不再开放这一脉冲级接口。[IBM 迁移说明](https://quantum.cloud.ibm.com/docs/en/guides/qiskit-2.0)

## 代表论文与发表状态

这里的年份优先采用正式发表年；没有确认正式版本的条目标为预印本。arXiv 自己分配的 `10.48550/arXiv...` DOI 不等于期刊或会议正式发表。下列每项均给出可继续核查的原始记录。

| 编号 | 文献与年份 | 发表状态和出处 | 主要价值及边界 |
| --- | --- | --- | --- |
| P01 | **Open Quantum Assembly Language**，Cross 等，2017 | 预印本/技术报告；[arXiv:1707.03429](https://arxiv.org/abs/1707.03429) | OpenQASM 2 的原始定义；不提供 3 系列的通用控制流、时序与校准模型。 |
| P02 | **OpenQASM 3: A broader and deeper quantum assembly language**，Cross 等，2022 | 已发表，ACM TQC 3(3)；[DOI 10.1145/3505636](https://doi.org/10.1145/3505636)；[预印本 2021](https://arxiv.org/abs/2104.14722) | 理解实时/近实时分界、多层 IR 的首读文献；语言提案不能直接作为所有后端的功能清单。 |
| P03 | **Qiskit Pulse: Programming Quantum Computers Through the Cloud with Pulses**，Alexander 等，2020 | 已发表，Quantum Science and Technology 5, 044006；[DOI](https://doi.org/10.1088/2058-9565/aba404) · [arXiv](https://arxiv.org/abs/2004.06755) | 云端脉冲与读出接口的历史案例；现行 IBM 接口已变化。 |
| P04 | **A MLIR Dialect for Quantum Assembly Languages**，2021 | 已发表，IEEE QCE，255–264；[DOI](https://doi.org/10.1109/QCE52317.2021.00043) · [作者机构记录](https://www.ornl.gov/publication/mlir-dialect-quantum-assembly-languages) | OpenQASM 2 经 MLIR/LLVM/QIR 渐进降低；不可写成 OpenQASM 3 全规范实现。 |
| P05 | **isQ: An Integrated Software Stack for Quantum Programming**，Guo 等，2023 | 已发表，IEEE TQE 4, 2500116；[DOI](https://doi.org/10.1109/TQE.2023.3275868) · [作者机构记录](https://www.research.ed.ac.uk/en/publications/isq-an-integrated-software-stack-for-quantum-programming/) | 通过 MLIR 支持高层程序，并输出 QIR、eQASM、OpenQASM 3.0、QCIS；是跨层软件栈的参考。 |
| P06 | **QASMTrans: A QASM Quantum Transpiler Framework for NISQ Devices**，2023 | 已发表，SC ’23 Workshops，1468–1477；[DOI](https://doi.org/10.1145/3624062.3624222) · [arXiv](https://arxiv.org/abs/2308.07581) | 轻量 C++ 转译与编译效率；性能结果须连同基准和配置解读。 |
| P07 | **Supporting Static Program Analysis and Transformation of Quantum-Based Languages**，2024 | 已发表，IEEE QCE；[DOI](https://doi.org/10.1109/QCE60285.2024.00103) · [作者全文](https://www.cs.kent.edu/~jmaletic/papers/Quantum24.pdf) | 将 srcML 扩展到 OpenQASM，支持源码结构查询与变换；不等于语义正确性证明。 |
| P08 | **Rule-Based Hardware-Configurable Static Analysis for Quantum Programs**，2025 | 已发表，IEEE QCE；[DOI](https://doi.org/10.1109/QCE65121.2025.00087) · [作者机构记录](https://www.amazon.science/publications/rule-based-hardware-configurable-static-analysis-for-quantum-programs) | SHARP 将 ISA 约束数据化，开展多阶段检查；规则覆盖决定可发现的错误。 |
| P09 | **ASDF: A Compiler for Qwerty, a Basis-Oriented Quantum Programming Language**，2025 | 已发表，ACM/IEEE CGO，444–458；[DOI](https://doi.org/10.1145/3696443.3708966) · [arXiv](https://arxiv.org/abs/2501.13262) | 高层基表示经 MLIR 输出 OpenQASM 3 或 QIR；输出格式支持不意味着完整脉冲后端。 |
| P10 | **AutoQ 2.0: From Verification of Quantum Circuits to Verification of Quantum Programs**，2025 | 已发表，TACAS，LNCS 15698，87–108；[出版社记录](https://doi.org/10.1007/978-3-031-90660-2_5) | 验证含测量与经典循环的程序，适合关注 RUS 等动态控制；仍需要相应规约与不变量。 |
| P11 | **Enabling the Verification and Formalization of Hybrid Quantum-Classical Computing with OpenQASM 3.0 compatible QASM-TS 2.0**，2025 | 已发表，JOSS 10(113), 8696；[期刊记录](https://joss.theoj.org/papers/10.21105/joss.08696) · [2024 预印本](https://arxiv.org/abs/2412.12578) | TypeScript 的混合量子经典表示和工具基础；不是完整控制硬件验证。 |
| P12 | **QASMTrans: An End-to-End QASM Compilation Framework with Pulse Generation for Near-Term Quantum Devices**，2026 | 预印本，2026-02-05；[arXiv:2602.05154](https://arxiv.org/abs/2602.05154) | 连接 QASM、脉冲与 QICK，研究延迟感知门集、校准感知布局；所报保真度等结果应限定于其测试和仿真条件。 |
| P13 | **When Equivalent Quantum Circuits Lose Synthesis Choices**，2026 | 预印本，2026-10-05；[arXiv:2610.06142](https://arxiv.org/abs/2610.06142) | 研究格式交换后高层合成选择丢失；说明“功能等价”与“保留后续优化信息”是不同目标，结论受所测工具版本和路线约束。 |

这些发表记录显示，OpenQASM 相关研究已从语言设计延伸至编译系统（QCE、CGO、SC Workshops）、静态分析与验证（QCE、TACAS）、可复用软件（JOSS）和测控接口（Quantum Science and Technology）。选择投稿方向时应对齐自己的主要贡献，而不是仅因为程序接受 OpenQASM 就把工作定位为语言标准研究。

## 与现有 paper4qi 文献库的联系

本次在本地重建后的 **2338 条研究记录**中，对标题、摘要、中文说明和标签进行大小写不敏感的 `OpenQASM` 字面匹配，命中 **10 条**：QCE 正式论文记录 8 条、TQE 1 条、QCE26 日程记录 1 条。放宽至 `QASM` 得到 18 条，其中 6 条仅涉及使用 QASM simulator 的算法应用。这个数字依赖本地快照及摘要覆盖，不能当作全球 OpenQASM 论文总数。

专题中的 P04、P05、P07、P08 可与现有库直接交叉阅读。其他值得从库中展开的方向包括：

- **源码分析**：[A Uniform Representation of Classical and Quantum Source Code for Static Code Analysis](https://doi.org/10.1109/QCE57702.2023.00115)，QCE 2023，用代码属性图联系经典与量子程序。
- **FPGA 仿真**：[Towards Quantum Circuit Emulation on Low-Tier FPGAs](https://doi.org/10.1109/QCE60285.2024.10381)，QCE 2024。此处研究 FPGA 上的量子线路仿真，不能等同驱动真实量子器件。
- **程序生成**：[QAgent: An LLM-based Multi-Agent System for Autonomous OpenQASM Programming](https://arxiv.org/abs/2508.20134)。本地库来源为 QCE26 日程条目，未附正式出版 DOI；应保留其来源状态，而非据日程推定正式论文已出版。

现有 CS4Q 导读的 OpenQASM 3 条目采用 2021 预印本年份；本次一并补充 2022 正式发表信息。新专题按人工策展维护，不属于现有每周 Crossref 数据更新脚本的自动核查范围。

## 对 Bell 的研究与实现建议

以下是结合 Bell 当前 AST → CFG → SSA → 寄存器分配 → 自定义 RISC-V，以及 DDS/TTL/TCM 多板执行模型提出的设计建议；不是已完成的 OpenQASM 支持。

推荐的实现关系为：**OpenQASM 前端 → 类型与目标能力检查 → 门及校准映射 → Bell IR → 多板调度与同步 → RISC-V 和参数上传 → 模拟器或硬件执行**。Python Sequence DSL 可以继续作为另一种前端。

| 问题 | 建议的实现边界 | 应收集的验证证据 |
| --- | --- | --- |
| 量子测量与 TTL 计数含义不同 | 显式定义计数阈值、分类、复位和 qubit/channel 映射；不要把 `read_ttl()` 返回值直接当 `measure` 的 bit | 已知测量结果输入下的分支、读出和操作轨迹一致性 |
| 运行时控制流和位宽 | 先声明支持的整数位宽、条件、循环、最大资源需求，对不支持的语法/类型明确报错 | 正负例能力矩阵；溢出、比较、循环边界和资源耗尽用例 |
| 时间离散化 | 明确 SI 时间、设备 `dt`、Bell 4 ns 控制时钟之间的换算和舍入/拒绝策略 | 时间戳误差、最长路径、分支等时填充、跨板偏斜 |
| 多板反馈同步 | 将测量数据依赖与 TCM 广播、等待/唤醒、Step FIFO 的语义关联 | 各控制路径的 FIFO、等待配对、广播顺序和死锁检查 |
| 校准与脉冲绑定 | 把门参数、物理比特、校准版本映射到 DDS/TTL 状态和时长；先做受控子集 | 校准查找正确性、通道冲突、相位/频率保持、时长约束 |
| 优化正确性 | 以可观察的读出、事件顺序和时间约束检验编译变换 | 原始与优化程序差分；模拟器读出与硬件步骤轨迹比较 |

可发表的问题应围绕一项明确主张组织。例如：**面向分布式 FPGA 控制器、保留测量反馈与时序约束的 OpenQASM 3 子集编译**。可比较无优化映射与所提算法，在相同程序/校准下报告编译时间、指令和存储量、反馈延迟、板间偏斜、调度失败率及语义一致性。控制流、读出与事件时序的一致性可先用 Bell 模拟器做差分和回归测试；这些测试不能替代完整的编译正确性证明，量子态演化、保真度与真实端到端反馈延迟还需要另外的物理仿真或硬件实验。

建议先完成一个最小闭环：带中途测量的主动复位或条件门，配合固定次数循环和固定时长。再逐步引入变量控制、等时分支、跨板执行、校准及 `stretch`。这种路线可以把每一步的语言语义、硬件限制和验证结果对应起来。

## 阅读顺序与后续资料维护

1. 先读 P01、P02，建立门级交换、实时控制和多层 IR 的基本概念；实现时对照稳定 3.1 规范。
2. 再读 P04、P05、P09，并参考 qe-compiler，比较各层 IR 应保存什么信息、何时绑定硬件。
3. 读 P08、P10、P13，分别关注硬件约束检查、动态程序验证与交换过程的信息损失。
4. 面向 Bell 脉冲与控制后端，重点读 P03 的历史接口设计和 P12 的 QICK 集成，同时核查现行厂商文档。

维护每篇文献时，至少保存题名、作者、预印本年、正式发表年、venue、DOI/arXiv、发表状态、适用 OpenQASM 版本、实现子集、代码入口、实验平台和指标口径。标准变更看官方 releases；厂商能力看各平台文档；论文状态以出版记录为准。资料站的内容快照与正式规范都应保留核查日期，避免将自动抓取的更新时间当成逐条人工核验时间。

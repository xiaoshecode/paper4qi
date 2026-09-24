# -*- coding: utf-8 -*-
"""Shared taxonomy / classification helpers for the paper4qi data pipeline.

Ported from the reference implementations:
  * C:/work/paper/ISCAS2027/paperresearch/tqe_data/categorize.py  (keyword tables,
    FORCE rules, REVIEW_PAT, is_front_matter, TQE scoring)
  * C:/work/paper/ISCAS2027/paperresearch/qce_data/build.py       (QCE join,
    front-matter rule, QCE26 track metadata)

Pure standard library.
"""
import html
import re

# --------------------------------------------------------------------------
# categories
# --------------------------------------------------------------------------
# The 13 report categories (FRONT is tracked separately via front_matter).
CAT_ORDER = [
    "QEC", "ALG", "ARCH", "COMM", "QML", "SUP",
    "PLAT", "PHOT", "SENS", "CRYO", "MAT", "REV", "OTHER",
]

CAT_NAMES = {
    "QEC": "量子纠错与容错计算",
    "ALG": "量子算法与应用",
    "ARCH": "量子体系结构、编译与基准测试",
    "COMM": "量子通信与网络",
    "QML": "量子机器学习",
    "SUP": "超导量子硬件",
    "PLAT": "自旋/离子阱/中性原子等硬件平台",
    "PHOT": "量子光子学与光学器件",
    "SENS": "量子传感与计量",
    "CRYO": "低温电子学与量子测控",
    "MAT": "量子材料与器件工艺",
    "REV": "综述与路线图",
    "OTHER": "其他",
    "FRONT": "期刊前置页",
}

# category -> (display_zh, keywords); title hit x4, keyword hit x2, abstract hit x1
CATS = [
    ("QEC", "量子纠错与容错计算", [
        "error correction", "error-correcting", "surface code", "stabilizer", "fault-tolerant", "fault tolerant",
        "quantum ldpc", "qldpc", "decoder", "decoding", "gkp", "bosonic code", "magic state", "logical qubit",
        "topological code", "color code", "concatenated code", "error mitigation", "quantum error mitigation",
        "syndrome", "toric code", "ldpc"]),
    ("QML", "量子机器学习", [
        "machine learning", "neural network", "quantum neural", "classifier", "classification", "quantum kernel",
        "kernel method", "generative model", "qgan", "reinforcement learning", "deep learning", "qnn",
        "variational quantum classifier", "data reuploading", "quantum generative", "quantum autoencoder"]),
    ("ALG", "量子算法与应用", [
        "algorithm", "vqe", "qaoa", "variational quantum", "quantum approximate", "quantum simulation",
        "hamiltonian simulation", "optimization", "qubo", "grover", "shor", "amplitude estimation",
        "quantum chemistry", "molecular", "quantum finance", "monte carlo", "linear systems", "hhl",
        "quantum walk", "adiabatic", "annealing", "phase estimation", "trotter", "qft", "quantum game",
        "differential equation", "many-body", "quantum advantage", "quantum supremacy", "fuzzy",
        "inference engine", "combinatorial", "graph coloring", "travelling salesman", "tsp", "scheduling problem"]),
    ("ARCH", "量子体系结构、编译与基准测试", [
        "compiler", "compilation", "transpil", "circuit optimization", "gate synthesis", "scheduling",
        "mapping", "qubit allocation", "microarchitecture", "instruction set", "architecture", "benchmark",
        "benchmarking", "randomized benchmarking", "tomography", "characterization", "verification",
        "circuit synthesis", "depth reduction", "routing", "layout", "programming", "software",
        "simulator", "classical simulation", "tensor network", "emulation", "resource estimation",
        "circuit cutting", "knitting", "pauli tracking", "mbqc", "measurement-based"]),
    ("COMM", "量子通信与网络", [
        "qkd", "quantum key distribution", "quantum network", "quantum internet", "repeater", "entanglement distribution",
        "teleportation", "quantum channel", "cryptography", "post-quantum", "quantum communication",
        "entanglement swapping", "quantum memory network", "cv-qkd", "mdi-qkd", "twin-field", "quantum routing",
        "entanglement routing", "quantum switch", "network protocol", "ruleset", "quantum link",
        "atmospheric", "free-space", "freespace", "satellite", "secret sharing", "secure multiparty",
        "private product", "authentication", "quantum secure direct communication", "wdm",
        "wavelength-division", "channel loss", "pointing error", "detection error probability"]),
    ("SUP", "超导量子硬件", [
        "superconducting", "transmon", "josephson", "squid", "fluxonium", "coplanar", "resonator",
        "microwave cavity", "3d cavity", "kinetic inductance", "parametric amplifier", "jpa", "twpa",
        "josephson junction", "flux qubit", "charge qubit", "circuit qed", "superconducting qubit",
        "superconducting resonator", "seamless cavity", "niobium", "tantalum", "tin ", "quasiparticle",
        "two-level system", "tls", "superconducting film"]),
    ("PLAT", "自旋/离子阱/中性原子等硬件平台", [
        "trapped ion", "ion trap", "neutral atom", "rydberg", "quantum dot", "spin qubit", "nv center",
        "nitrogen-vacancy", "silicon spin", "donor", "hole spin", "gate-defined", "electrometry",
        "semiconductor qubit", "isotop", "silicon qubit", "germanium", "color center", "sic", "diamond",
        "atom array", "optical tweezer", "tweezer", "molecular qubit", "rare earth"]),
    ("PHOT", "量子光子学与光学器件", [
        "photonic", "single-photon", "single photon", "spdc", "photon detector", "snspd", "integrated photonics",
        "waveguide", "silicon photonics", "optical", "photon source", "quantum dot photon", "cavity qed photon",
        "boson sampling", "linear optical", "frequency comb", "squeezed", "homodyne", "continuous-variable",
        "quantum illumination", "laser", "electro-optic", "nonlinear optics", "fiber"]),
    ("SENS", "量子传感与计量", [
        "sensing", "sensor", "magnetometer", "magnetometry", "metrology", "quantum clock", "atomic clock",
        "gravimeter", "gyroscope", "accelerometer", "imaging", "microscopy", "quantum radar", "electrometer",
        "thermometry", "noise spectroscopy", "quantum-enhanced measurement", "quantum illumination radar"]),
    ("CRYO", "低温电子学与量子测控", [
        "cryo-cmos", "cryogenic cmos", "cryogenic electronics", "cryogenic", "control electronics",
        "readout electronics", "readout chain", "microwave control", "dac", "adc", "pll", "wiring",
        "sfq", "single flux quantum", "rapid single", "rsfq", "dilution refrigerator",
        "cryostat", "control system", "qubit control", "pulse shaping", "arbitrary waveform", "awg", "fpga",
        "cryogenic memory", "maser", "cmos", "low-noise amplifier", "lna", "bias tee", "attenuator",
        "coaxial", "microwave line", "control line", "signal chain", "digital-to-analog", "analog-to-digital"]),
    ("MAT", "量子材料与器件工艺", [
        "material", "fabrication", "thin film", "epitax", "wafer", "loss tangent", "dielectric loss",
        "surface loss", "oxidation", "lithography", "deposition", "anneal", "defect", "dislocation",
        "superconducting material", "3d integration", "packaging", "through-silicon", "tsv", "flip-chip",
        "bonding", "cleanroom", "process"]),
]

CATS_MAP = {key: name for key, name, _ in CATS}
CATS_WORDS = {key: words for key, _, words in CATS}
CATS_ORDER = [key for key, _, _ in CATS]

# phrases that force a category (title only)
FORCE = [
    (r"quantum error correction|surface code|fault.tolerant|stabilizer|gkp|qldpc|quantum ldpc|decod(er|ing)", "QEC"),
    (r"quantum key distribution|\bqkd\b|quantum network|quantum internet|quantum repeater|teleportation", "COMM"),
    (r"machine learning|neural network|quantum kernel|classifier", "QML"),
    (r"magnetomet|atomic clock|gravimeter|quantum sensing|quantum sensor", "SENS"),
    (r"cryo.?cmos|cryogenic (cmos|electronics)|sfq|single flux quantum", "CRYO"),
]

REVIEW_PAT = re.compile(r"\b(review|survey|tutorial|roadmap|perspective|overview of|outlook)\b", re.I)

# TQE ordering: category priority then art_no / title; FRONT sorts last
TQE_CAT_ORDER = CAT_ORDER + ["FRONT"]
CAT_RANK = {key: i for i, key in enumerate(TQE_CAT_ORDER)}


# --------------------------------------------------------------------------
# text helpers
# --------------------------------------------------------------------------
_TAG_PAT = re.compile(r"<[^>]+>")
_WS_PAT = re.compile(r"\s+")


def clean(value):
    """Unescape HTML entities, drop tags, collapse whitespace (QCE/TQE reference behaviour)."""
    value = html.unescape(value or "")
    value = _TAG_PAT.sub("", value)
    return _WS_PAT.sub(" ", value).strip()


def split_authors(text):
    """Split the QCE26 comma/'and' joined author string into a list."""
    parts = re.split(r", | and ", text or "")
    return [name for name in (clean(p) for p in parts) if name]


# --------------------------------------------------------------------------
# TQE helpers (verbatim behaviour of tqe_data/categorize.py)
# --------------------------------------------------------------------------
def is_front_matter(title):
    """Cover / copyright / index style journal front matter."""
    t = clean(title).lower().strip("[]")
    return (t.startswith("front cover")
            or t == "ieee transactions on quantum engineering"
            or "publication information" in t
            or bool(re.match(r"^\d{4} index ieee", t)))


def score_categories(title, abstract="", keywords=None):
    """Keyword score per category: title x4, keyword x2, abstract x1."""
    t = (title or "").lower()
    a = (abstract or "").lower()
    kws = [k.lower() for k in (keywords or [])]
    scores = {}
    for key, _name, words in CATS:
        score = 0
        for word in words:
            if word in t:
                score += 4
            if word in a:
                score += 1
            if any(word in k for k in kws):
                score += 2
        scores[key] = score
    return scores


def best_by_score(scores):
    """Highest score wins; ties resolved by CATS declaration order; all-zero -> OTHER."""
    best, best_score = "OTHER", 0
    for key in CATS_ORDER:
        if scores.get(key, 0) > best_score:
            best, best_score = key, scores[key]
    return best if best_score > 0 else "OTHER"


def categorize_tqe(record):
    """Return (cat, cat_name) for a TQE merged record (reference algorithm)."""
    title = record.get("title", "")
    if is_front_matter(title):
        return "FRONT", CAT_NAMES["FRONT"]
    if REVIEW_PAT.search(title or ""):
        return "REV", CAT_NAMES["REV"]
    t = (title or "").lower()
    for pat, cat in FORCE:
        if re.search(pat, t):
            return cat, CATS_MAP[cat]
    abstract = record.get("abstract") or ""
    if re.search(r"quantum network|quantum internet|repeater|entanglement distribution|qkd\b",
                 t + " " + abstract[:400]):
        return "COMM", CATS_MAP["COMM"]
    cat = best_by_score(score_categories(title, abstract, record.get("keywords")))
    return cat, CAT_NAMES[cat]


# --------------------------------------------------------------------------
# QCE 2020–2025 helpers (labels of data_src/qce/cats.json -> one main category)
# --------------------------------------------------------------------------
# priority, highest first.  Specific topic labels outrank broad ones, so a paper
# tagged both 量子机器学习 and a concrete topic lands in the concrete class; QML
# only receives papers whose most specific label is 量子机器学习.  教育与科普 is
# deliberately last: it is a broad "context" label in cats.json.
QCE_LABEL_PRIORITY = [
    "纠错与容错",
    "量子安全",
    "网络与通信",
    "硬件与器件",
    "编译与电路优化",
    "软件与工具",
    "量子机器学习",
    "应用与基准",
    "模拟与仿真",
    "算法与理论",
    "教育与科普",
]
QCE_LABEL_CAT = {
    "纠错与容错": "QEC",
    "量子机器学习": "QML",
    "网络与通信": "COMM",
    "量子安全": "COMM",
    "硬件与器件": None,  # second-stage sub-division
    "编译与电路优化": "ARCH",
    "软件与工具": "ARCH",
    "模拟与仿真": "ALG",
    "算法与理论": "ALG",
    "应用与基准": "ALG",
    "教育与科普": "OTHER",
}
HARDWARE_SUBCATS = ["SUP", "PLAT", "PHOT", "CRYO", "MAT"]


def subdivide_hardware(title):
    """Pick the best-matching hardware class by counting title keyword hits."""
    t = (title or "").lower()
    best, best_score = None, 0
    for key in HARDWARE_SUBCATS:
        score = sum(1 for word in CATS_WORDS[key] if word in t)
        if score > best_score:
            best, best_score = key, score
    return best or "OTHER"


def categorize_qce(title, labels, abstract="", front=False):
    """Map a QCE 2020–2025 entry to one of the 13 categories."""
    if front:
        return "OTHER"
    if REVIEW_PAT.search(title or ""):
        return "REV"
    label_set = set(labels or [])
    for label in QCE_LABEL_PRIORITY:
        if label not in label_set:
            continue
        cat = QCE_LABEL_CAT[label]
        return cat if cat else subdivide_hardware(title)
    # no label at all -> reference keyword scoring fallback
    t = (title or "").lower()
    for pat, cat in FORCE:
        if re.search(pat, t):
            return cat
    return best_by_score(score_categories(title, abstract))


# --------------------------------------------------------------------------
# QCE 2026 track metadata
# --------------------------------------------------------------------------
QCE26_TRACK_ORDER = ["QALG", "QSYS", "QNET", "QECS", "QPHO", "QML", "QTEM", "QGDD", "QAPP"]

TRACK_MAP = {
    "QALG": "ALG",
    "QML": "QML",
    "QNET": "COMM",
    "QPHO": "PHOT",
    "QSYS": "ARCH",
    "QTEM": "PLAT",
    "QECS": "ALG",
    "QGDD": "QML",
    "QAPP": "ALG",
}

TRACK_ZH = {
    "QALG": "量子算法",
    "QSYS": "量子系统软件",
    "QNET": "量子网络与通信",
    "QECS": "端到端量子—经典混合案例",
    "QPHO": "量子光子学",
    "QML": "量子机器学习",
    "QTEM": "量子技术与系统工程",
    "QGDD": "量子与生成式 AI 协同设计与发现",
    "QAPP": "量子应用",
}

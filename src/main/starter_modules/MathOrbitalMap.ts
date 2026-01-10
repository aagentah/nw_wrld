/*
@nwWrld name: MathOrbitalMap
@nwWrld category: 2D
@nwWrld imports: ModuleBase, d3
*/

import type { ModuleBase as ModuleBaseType } from "../../projector/helpers/moduleBase";

// Runtime-injected globals
declare const ModuleBase: typeof ModuleBaseType;
declare const d3: any;

interface Concept {
  id: string;
  x: number;
  y: number;
  name: string;
  type: string;
}

interface Orbit {
  source: string;
  target: string;
  equation: string;
}

class MathOrbitalMap extends ModuleBase {
  static methods = [
    {
      name: "randomize",
      executeOnLoad: false,
      options: [],
    },
  ];

  // Properties
  name!: string;
  svg!: any;
  concepts!: Concept[];
  orbits!: Orbit[];

  constructor(container: HTMLElement) {
    super(container);
    this.name = MathOrbitalMap.name;
    this.svg = null;
    this.concepts = [];
    this.orbits = [];
    this.init();
  }

  init(): void {
    const containerWidth = this.elem.clientWidth;
    const containerHeight = this.elem.clientHeight;

    const html = `
      <div class="math-orbital-container" style="width: 100%; height: 100%;">
        <svg width="100%" height="100%" viewBox="0 0 ${containerWidth} ${containerHeight}"></svg>
      </div>
    `;
    this.elem.insertAdjacentHTML("beforeend", html);
    this.svg = d3.select(this.elem.querySelector("svg"));

    this.generateData();
    this.createVisualization();
  }

  generateData(): void {
    const containerWidth = this.elem.clientWidth;
    const containerHeight = this.elem.clientHeight;
    const scaleCoord = (x: number, y: number) => ({
      x: (x * containerWidth) / 1000,
      y: (y * containerHeight) / 800 + containerHeight * 0.1,
    });

    this.concepts = [
      {
        id: "algorithms",
        ...scaleCoord(200, 100),
        name: "Algorithm Complexity",
        type: "O(n)",
      },
      {
        id: "datastructures",
        ...scaleCoord(500, 150),
        name: "Data Structures",
        type: "Trees",
      },
      {
        id: "recursion",
        ...scaleCoord(350, 300),
        name: "Recursion",
        type: "f(n)",
      },
      {
        id: "optimization",
        ...scaleCoord(650, 250),
        name: "Optimization",
        type: "min(f)",
      },
      {
        id: "graphs",
        ...scaleCoord(800, 400),
        name: "Graph Theory",
        type: "G(V,E)",
      },
      {
        id: "probability",
        ...scaleCoord(250, 500),
        name: "Probability",
        type: "P(A∩B)",
      },
      {
        id: "calculus",
        ...scaleCoord(850, 150),
        name: "Calculus",
        type: "∫f(x)dx",
      },
      {
        id: "linear_algebra",
        ...scaleCoord(550, 600),
        name: "Linear Algebra",
        type: "Ax=b",
      },
      {
        id: "number_theory",
        ...scaleCoord(400, 200),
        name: "Number Theory",
        type: "ℤ/nℤ",
      },
      {
        id: "topology",
        ...scaleCoord(700, 350),
        name: "Topology",
        type: "(X,τ)",
      },
      {
        id: "neural_networks",
        ...scaleCoord(800, 300),
        name: "Neural Networks",
        type: "σ(Wx+b)",
      },
      {
        id: "reinforcement",
        ...scaleCoord(300, 400),
        name: "Reinforcement Learning",
        type: "Q(s,a)",
      },
      {
        id: "cryptography",
        ...scaleCoord(600, 200),
        name: "Cryptography",
        type: "E(m,k)",
      },
      {
        id: "quantum_comp",
        ...scaleCoord(450, 450),
        name: "Quantum Computing",
        type: "|ψ⟩",
      },
      {
        id: "parallel",
        ...scaleCoord(750, 250),
        name: "Parallel Computing",
        type: "P||Q",
      },
      {
        id: "automata",
        ...scaleCoord(250, 250),
        name: "Automata Theory",
        type: "δ(q,σ)",
      },
      {
        id: "group_theory",
        ...scaleCoord(550, 100),
        name: "Group Theory",
        type: "(G,·)",
      },
      {
        id: "statistics",
        ...scaleCoord(700, 500),
        name: "Statistics",
        type: "μ±σ",
      },
      {
        id: "chaos_theory",
        ...scaleCoord(350, 150),
        name: "Chaos Theory",
        type: "dx/dt",
      },
      {
        id: "category_theory",
        ...scaleCoord(500, 300),
        name: "Category Theory",
        type: "F:C→D",
      },
      {
        id: "game_theory",
        ...scaleCoord(150, 200),
        name: "Game Theory",
        type: "Nash(G)",
      },
      {
        id: "information_theory",
        ...scaleCoord(650, 180),
        name: "Information Theory",
        type: "H(X)",
      },
      {
        id: "type_theory",
        ...scaleCoord(420, 280),
        name: "Type Theory",
        type: "Π(x:A)",
      },
      {
        id: "complexity_theory",
        ...scaleCoord(300, 420),
        name: "Complexity Theory",
        type: "P=?NP",
      },
      {
        id: "formal_lang",
        ...scaleCoord(580, 350),
        name: "Formal Languages",
        type: "L(G)",
      },
      {
        id: "differential_geo",
        ...scaleCoord(720, 220),
        name: "Differential Geometry",
        type: "∇_X Y",
      },
      {
        id: "measure_theory",
        ...scaleCoord(400, 500),
        name: "Measure Theory",
        type: "μ(E)",
      },
      {
        id: "galois_theory",
        ...scaleCoord(250, 180),
        name: "Galois Theory",
        type: "Gal(K/F)",
      },
      {
        id: "homology",
        ...scaleCoord(620, 420),
        name: "Homology Theory",
        type: "H_n(X)",
      },
      {
        id: "spectral_theory",
        ...scaleCoord(420, 220),
        name: "Spectral Theory",
        type: "σ(A)",
      },
    ];

    const validIds = new Set(this.concepts.map((c) => c.id));
    const potentialOrbits: Orbit[] = [
      { source: "algorithms", target: "datastructures", equation: "O(log n)" },
      {
        source: "recursion",
        target: "optimization",
        equation: "f(n) = f(n-1) + 1",
      },
      { source: "graphs", target: "probability", equation: "P(path) = Σ w(e)" },
      { source: "algorithms", target: "graphs", equation: "DFS/BFS" },
      { source: "calculus", target: "optimization", equation: "∇f = 0" },
      { source: "linear_algebra", target: "neural_networks", equation: "W·x" },
      { source: "probability", target: "statistics", equation: "E[X]" },
      { source: "group_theory", target: "cryptography", equation: "Z*_p" },
      { source: "quantum_comp", target: "cryptography", equation: "QFT" },
      { source: "topology", target: "chaos_theory", equation: "Λ" },
      { source: "category_theory", target: "automata", equation: "F(M)" },
      {
        source: "neural_networks",
        target: "reinforcement",
        equation: "π(a|s)",
      },
      { source: "number_theory", target: "group_theory", equation: "φ(n)" },
      { source: "parallel", target: "optimization", equation: "P||O" },
      { source: "graphs", target: "category_theory", equation: "Mor(G)" },
      { source: "recursion", target: "automata", equation: "L*" },
      { source: "statistics", target: "neural_networks", equation: "σ²" },
      { source: "topology", target: "group_theory", equation: "π₁(X)" },
      { source: "quantum_comp", target: "parallel", equation: "|0⟩⊗n" },
      { source: "calculus", target: "chaos_theory", equation: "λ > 0" },
      {
        source: "game_theory",
        target: "optimization",
        equation: "max_x min_y",
      },
      {
        source: "information_theory",
        target: "probability",
        equation: "I(X;Y)",
      },
      { source: "type_theory", target: "category_theory", equation: "C[T]" },
      { source: "complexity_theory", target: "algorithms", equation: "DTIME" },
      { source: "formal_lang", target: "automata", equation: "REG⊂CFL" },
      { source: "differential_geo", target: "topology", equation: "TM" },
      { source: "measure_theory", target: "probability", equation: "L¹" },
      { source: "galois_theory", target: "group_theory", equation: "Aut(K)" },
      { source: "homology", target: "topology", equation: "∂ₙ" },
      { source: "spectral_theory", target: "linear_algebra", equation: "λ∈σ" },
    ];

    this.orbits = potentialOrbits.filter(
      (orbit) => validIds.has(orbit.source) && validIds.has(orbit.target)
    );
  }

  randomize(): void {
    const seed = Math.random();
    const rng = d3.randomUniform.source(d3.randomLcg(seed))();
    const containerWidth = this.elem.clientWidth;
    const containerHeight = this.elem.clientHeight;

    this.concepts.forEach((concept) => {
      concept.x = rng() * containerWidth * 0.8 + containerWidth * 0.1;
      concept.y = rng() * containerHeight * 0.8 + containerHeight * 0.1;
    });

    if (this.svg) {
      this.svg.selectAll("*").remove();
      this.createVisualization();
    }
  }

  createVisualization(): void {
    const orbitGroup = this.svg.append("g").attr("class", "orbits");

    this.orbits.forEach((orbit) => {
      const source = this.concepts.find((c) => c.id === orbit.source);
      const target = this.concepts.find((c) => c.id === orbit.target);

      if (source && target) {
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dr = Math.sqrt(dx * dx + dy * dy) * 1.2;

        orbitGroup
          .append("path")
          .attr(
            "d",
            `M${source.x},${source.y}A${dr},${dr} 0 0,1 ${target.x},${target.y}`
          )
          .attr("fill", "none")
          .attr("stroke", "#ff3366")
          .attr("stroke-width", 0.75)
          .attr("opacity", 0.4);

        orbitGroup
          .append("text")
          .attr("x", (source.x + target.x) / 2)
          .attr("y", (source.y + target.y) / 2 - 8)
          .attr("text-anchor", "middle")
          .attr("fill", "#ff9933")
          .attr("font-size", "2px")
          .text(orbit.equation);
      }
    });

    const nodeGroup = this.svg.append("g").attr("class", "nodes");

    this.concepts.forEach((concept) => {
      nodeGroup
        .append("circle")
        .attr("cx", concept.x)
        .attr("cy", concept.y)
        .attr("r", 1)
        .attr("fill", "#ffffff");

      nodeGroup
        .append("text")
        .attr("x", concept.x)
        .attr("y", concept.y - 8)
        .attr("text-anchor", "middle")
        .attr("fill", "#ffffff")
        .attr("font-size", "2px")
        .text(concept.name);

      nodeGroup
        .append("text")
        .attr("x", concept.x)
        .attr("y", concept.y + 12)
        .attr("text-anchor", "middle")
        .attr("fill", "#ff9933")
        .attr("font-size", "2px")
        .text(concept.type);
    });
  }

  destroy(): void {
    if (this.svg) {
      this.svg.remove();
      this.svg = null;
    }
    super.destroy();
  }
}

export default MathOrbitalMap;

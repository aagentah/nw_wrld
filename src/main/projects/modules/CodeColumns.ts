/*
@nwWrld name: CodeColumns
@nwWrld category: Text
@nwWrld imports: ModuleBase
*/

import { ModuleBase as ModuleBaseType } from "../../../projector/helpers/moduleBase";
import p5 from "p5";


class CodeColumns extends ModuleBaseType {
  // Module properties (extended)

  myp5!: p5 | null;
  canvas!: p5.Renderer | null;
  columns!: Array<{x: number; height: number; speed: number}>;
  isAnimating!: boolean;
  name!: string;
  elem!: HTMLElement;
  data!: any;
  leftColumn!: any;
  rightColumn!: any;
  
  static methods = [
    {
      name: "iterate",
      executeOnLoad: false,
      options: [],
    },
    {
      name: "columnVisibility",
      executeOnLoad: true,
      options: [
        {
          name: "leftColumn",
          defaultVal: true,
          type: "boolean",
        },
        {
          name: "rightColumn",
          defaultVal: true,
          type: "boolean",
        },
      ],
    },
  ];

  constructor(container) {
    super(container);
    this.name = CodeColumns.name;
    this.leftColumn = null;
    this.rightColumn = null;
    this.init();
  }

  init(): void {
    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.flexWrap = "wrap";
    wrapper.style.width = "100%";
    wrapper.style.height = "100%";
    wrapper.style.boxSizing = "border-box";
    this.elem.appendChild(wrapper);
    this.elem = wrapper;

    const leftColumn = document.createElement("div");
    const rightColumn = document.createElement("div");

    leftColumn.classList.add("code-column", "code-column__left");
    leftColumn.style.position = "absolute";
    leftColumn.style.left = "5vh";
    leftColumn.style.width = "15%";
    leftColumn.style.height = "100%";
    leftColumn.style.overflow = "hidden";
    leftColumn.style.fontSize = "calc(2px + 0.6vmin)";
    leftColumn.style.color = "white";
    leftColumn.style.paddingLeft = "3%";
    leftColumn.style.textAlign = "left";
    leftColumn.style.whiteSpace = "pre-wrap";

    rightColumn.classList.add("code-column", "code-column__right");
    rightColumn.style.position = "absolute";
    rightColumn.style.right = "5vh";
    rightColumn.style.width = "15%";
    rightColumn.style.height = "100%";
    rightColumn.style.overflow = "hidden";
    rightColumn.style.fontSize = "calc(2px + 0.6vmin)";
    rightColumn.style.color = "white";
    rightColumn.style.paddingRight = "3%";
    rightColumn.style.textAlign = "right";
    rightColumn.style.whiteSpace = "pre-wrap";

    this.leftColumn = leftColumn;
    this.rightColumn = rightColumn;

    this.elem.appendChild(leftColumn);
    this.elem.appendChild(rightColumn);

    this.generateInitialContent();
  }

  generateInitialContent() {
    const pythonSnippets = [
      `def fibonacci(n):\n  if n <= 1:\n    return n\n  else:\n    return(fibonacci(n-1) + fibonacci(n-2))\n`,
      `for i in range(1, 11):\n  print(i)`,
      `def factorial(n):\n  return 1 if n == 0 else n * factorial(n - 1)`,
      `list_comp = [i for i in range(10) if i % 2 == 0]`,
      `lambda_func = lambda x: x * 2\nprint(lambda_func(5))`,
    ];

    const getRandomSnippets = (snippets, count) => {
      const shuffled = [...snippets].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, count).join("\n");
    };

    const baseSnippets = getRandomSnippets(pythonSnippets, 5);
    let pythonCode = baseSnippets.repeat(50);

    const words = pythonCode.split(/\s+/);
    const indices = [];
    const maxRedWords = Math.min(50, Math.floor(words.length * 0.1));
    while (indices.length < maxRedWords) {
      const randomIndex = Math.floor(Math.random() * words.length);
      if (!indices.includes(randomIndex)) {
        indices.push(randomIndex);
      }
    }

    for (let index of indices) {
      words[index] = `<span style="color: red;">${words[index]}</span>`;
    }

    pythonCode = words.join(" ");

    this.leftColumn.innerHTML = pythonCode;
    this.rightColumn.innerHTML = pythonCode;
  }

  iterate() {
    if (!this.leftColumn || !this.rightColumn) return;
    this.generateInitialContent();
  }

  columnVisibility({ leftColumn = true, rightColumn = true } = {}) {
    if (this.leftColumn) {
      this.leftColumn.style.display = leftColumn ? "block" : "none";
    }
    if (this.rightColumn) {
      this.rightColumn.style.display = rightColumn ? "block" : "none";
    }
  }

  setColumnVisibility(options: Record<string, unknown> = {}) {
    return this.columnVisibility(options);
  }

  destroy(): void {
    while (this.elem.firstChild) {
      this.elem.removeChild(this.elem.firstChild);
    }
    this.leftColumn = null;
    this.rightColumn = null;
    super.destroy();
  }
}

export default CodeColumns;

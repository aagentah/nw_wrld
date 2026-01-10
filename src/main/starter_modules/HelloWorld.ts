/*
@nwWrld name: HelloWorld
@nwWrld category: Text
@nwWrld imports: ModuleBase
*/

import type { ModuleBase as ModuleBaseType } from "../../projector/helpers/moduleBase";

// Runtime-injected globals (provided by sandbox)
declare const ModuleBase: typeof ModuleBaseType;

interface TextMethodOptions {
  value: string;
}

class HelloWorld extends ModuleBase {
  static methods = [
    {
      name: "text",
      executeOnLoad: true,
      options: [{ name: "text", defaultVal: "Hello world", type: "text" }],
    },
  ];

  textEl!: HTMLDivElement;

  constructor(container: HTMLElement) {
    super(container);
    this.textEl = document.createElement("div");
    this.textEl.style.cssText = [
      "width: 100%;",
      "height: 100%;",
      "display: flex;",
      "align-items: center;",
      "justify-content: center;",
      "font-family: monospace;",
      "font-size: 48px;",
      "color: white;",
    ].join(" ");
    if (this.elem) {
      this.elem.appendChild(this.textEl);
    }
  }

  text({ value }: TextMethodOptions): void {
    this.textEl.textContent = String(value);
  }
}

export default HelloWorld;

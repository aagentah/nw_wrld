/*
@nwWrld name: HelloWorld
@nwWrld category: Text
@nwWrld imports: ModuleBase
*/

import { ModuleBase as ModuleBaseType } from "../../../projector/helpers/moduleBase";

class HelloWorld extends ModuleBaseType {
  textEl!: HTMLDivElement;

  static methods = [
    {
      name: "text",
      executeOnLoad: true,
      options: [{ name: "text", defaultVal: "Hello world", type: "text" }],
    },
  ];

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

  text({ value }: { value: any }) {
    this.textEl.textContent = String(value);
  }
}

export default HelloWorld;

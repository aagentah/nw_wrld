import "../rendererPolyfills";
import "../shared/styles/_main.css";
import Projector from "./Projector.js";

if (document.querySelector(".projector")) {
  Projector.init();
}


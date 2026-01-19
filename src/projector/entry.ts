import "../rendererPolyfills";
import "../shared/styles/_main.css";
import Projector from "./Projector";

if (document.querySelector(".projector")) {
  Projector.init();
}


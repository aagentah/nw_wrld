import Projector from "./projector/Projector.js";

import "./shared/styles/_main.css";

const App = {
  init() {
    const projector = document.querySelector(".projector");

    if (projector) {
      Projector.init();
    }
  },
};

App.init();

export default App;

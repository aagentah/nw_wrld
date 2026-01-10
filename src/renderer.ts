import Dashboard from "./dashboard/Dashboard";
import Projector from "./projector/Projector";

import "./shared/styles/_main.css";

interface App {
  init(): void;
}

const App: App = {
  init() {
    const projector = document.querySelector(".projector");

    if (projector) {
      Projector.init();
    }
  },
};

App.init();

export default App;

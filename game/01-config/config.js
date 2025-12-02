// game/01-config/config.js

(function () {
  "use strict";

  // In SugarCube story JS, global `Config` is provided by the format.
  // We check for the bare global, not window.Config.
  if (typeof Config === "undefined") {
    console.warn("config.js: Config not available");
    return;
  }

  /* History configuration */
  Config.history.maxStates = 100;
  Config.history.controls = false;   // hide back/forward UI

  /* Save configuration (minimal for now) */
  if (Config.saves) {
    // These are official SugarCube 2.36.1 options, so they are safe.
    Config.saves.autosave = ["autosave"];  // autosave only on passages tagged "autosave"
    Config.saves.isAllowed = function () {
      // Disallow saving on passages tagged "nosave"
      return !tags().includes("nosave");
    };
  }

  /* Misc configuration */
  Config.debug = false;
  Config.addVisitedLinkClass = false;

  /* Macro safety */
  if (Config.macros) {
    Config.macros.maxLoopIterations = 1000;
  }

  /* Debug mode toggle: Ctrl+Shift+D */
  jQuery(document).on("keydown", function (e) {
    if (e.ctrlKey && e.shiftKey && e.key === "D") {
      window.DEBUG_MODE = !window.DEBUG_MODE;

      // Look up SugarCube UI / Engine at keypress time
      var SC = window.SugarCube || {};
      var UI = SC.UI;
      var Engine = SC.Engine;

      if (window.DEBUG_MODE) {
        console.log("Debug mode enabled");
        if (UI && typeof UI.alert === "function") {
          UI.alert("Debug mode enabled.");
        }
      } else {
        console.log("Debug mode disabled");
        if (UI && typeof UI.alert === "function") {
          UI.alert("Debug mode disabled.");
        }
      }

      if (Engine && typeof Engine.show === "function") {
        Engine.show();
      }
    }
  });

})();

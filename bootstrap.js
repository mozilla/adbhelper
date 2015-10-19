const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");

const REASON = [ 'unknown', 'startup', 'shutdown', 'enable', 'disable',
                 'install', 'uninstall', 'upgrade', 'downgrade' ];

// Usefull piece of code from :bent
// http://mxr.mozilla.org/mozilla-central/source/dom/workers/test/extensions/bootstrap/bootstrap.js
function registerAddonResourceHandler(data) {
  let file = data.installPath;
  let fileuri = file.isDirectory() ?
                Services.io.newFileURI(file) :
                Services.io.newURI("jar:" + file.path + "!/", null, null);
  let resourceName = encodeURIComponent(data.id.replace("@", "at"));

  Services.io.getProtocolHandler("resource").
              QueryInterface(Ci.nsIResProtocolHandler).
              setSubstitution(resourceName, fileuri);

  return "resource://" + resourceName + "/";
}

let mainModule;
let loader;
let unload;

function install(data, reason) {}

function startup(data, reason) {
  let uri = registerAddonResourceHandler(data);

  let loaderModule =
    Cu.import('resource://gre/modules/commonjs/toolkit/loader.js').Loader;
  let { Loader, Require, Main } = loaderModule;
  unload = loaderModule.unload;

  let loaderOptions = {
    paths: {
      "./": uri,
      "": "resource://gre/modules/commonjs/"
    },
    modules: {
      "toolkit/loader": loaderModule
    }
  };

  /**
   * setup a console object that only dumps messages if
   * LOGPREF is true
   */

  const LOGPREF = "extensions.adbhelper@mozilla.org.debug";
  const LOGPREFIX = "ADB Addon Helper:";

  try {
    Services.prefs.getBoolPref(LOGPREF);
  } catch(e) {
    // Doesn't exist yet
    Services.prefs.setBoolPref(LOGPREF, false);
  }

  function canLog() {
    return Services.prefs.getBoolPref(LOGPREF);
  }

  // In Firefox 44 and later, many DevTools modules were relocated.
  // See https://bugzil.la/912121
  let ConsoleAPI;
  let consolePaths = [
    "resource://gre/modules/Console.jsm",
    "resource://gre/modules/devtools/shared/Console.jsm",
    "resource://gre/modules/devtools/Console.jsm",
  ];
  for (let path of consolePaths) {
    try {
      ({ ConsoleAPI } = Cu.import(path));
      // We loaded a path successfully
      break;
    } catch (e) {
      // We'll try the next path
    }
  }

  let _console = new ConsoleAPI();
  loaderOptions.globals = {
    console: {
      log: function(...args) {
        canLog() && _console.log(LOGPREFIX, ...args);
      },
      warn: function(...args) {
        canLog() && _console.warn(LOGPREFIX, ...args);
      },
      error: function(...args) {
        canLog() && _console.error(LOGPREFIX, ...args);
      },
      exception: function(...args) {
        canLog() && _console.exception(LOGPREFIX, ...args);
      },
      debug: function(...args) {
        canLog() && _console.debug(LOGPREFIX, ...args);
      }
    }
  }

  loader = Loader(loaderOptions);
  let require_ = Require(loader, { id: "./addon" });
  mainModule = require_("./main");
}

function shutdown(data, reasonCode) {
  let reason = REASON[reasonCode];
  if (loader) {
    unload(loader, reason);
    unload = null;
  }
  if (mainModule && mainModule.shutdown) {
    mainModule.shutdown();
  }
}

function uninstall(data, reason) {}

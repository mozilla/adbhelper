/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/* exported install, startup, shutdown, uninstall */

const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");

const REASON = [ "unknown", "startup", "shutdown", "enable", "disable",
                 "install", "uninstall", "upgrade", "downgrade" ];

// Useful piece of code from :bent
// http://mxr.mozilla.org/mozilla-central/source/dom/workers/test/extensions/bootstrap/bootstrap.js
function registerAddonResourceHandler(data) {
  let file = data.installPath;
  let fileURI = Services.io.newFileURI(file);
  if (!file.isDirectory()) {
    fileURI = Services.io.newURI("jar:" + fileURI.spec + "!/");
  }
  let resourceName = encodeURIComponent(data.id.replace("@", "at"));

  Services.io.getProtocolHandler("resource").
              QueryInterface(Ci.nsIResProtocolHandler).
              setSubstitution(resourceName, fileURI);

  return "resource://" + resourceName + "/";
}

function getBaseLoader() {
  try {
    // >=FF57 use the base-loader from DevTools.
    return Cu.import("resource://devtools/shared/base-loader.js", {});
  } catch (e) {
    // <FF57 use the addon-sdk loader.
    return Cu.import("resource://gre/modules/commonjs/toolkit/loader.js").Loader;
  }
}

let mainModule;
let loader;
let unload;

function install(data, reason) {}

function startup(data, reason) {
  let uri = registerAddonResourceHandler(data);

  let loaderModule = getBaseLoader();
  let { Loader, Require } = loaderModule;
  unload = loaderModule.unload;

  let loaderOptions = {
    paths: {
      "./": uri,
    },
  };

  /**
   * setup a console object that only dumps messages if
   * LOGPREF is true
   */

  const LOGPREF = "extensions.adbhelper@mozilla.org.debug";
  const LOGPREFIX = "ADB Helper:";

  try {
    Services.prefs.getBoolPref(LOGPREF);
  } catch (e) {
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
      log(...args) {
        canLog() && _console.log(LOGPREFIX, ...args);
      },
      warn(...args) {
        canLog() && _console.warn(LOGPREFIX, ...args);
      },
      error(...args) {
        canLog() && _console.error(LOGPREFIX, ...args);
      },
      exception(...args) {
        canLog() && _console.exception(LOGPREFIX, ...args);
      },
      debug(...args) {
        canLog() && _console.debug(LOGPREFIX, ...args);
      }
    }
  };

  loader = Loader(loaderOptions);
  let require_ = Require(loader, { id: "./addon" });
  mainModule = require_("./main");

  // TODO: debugging, remove?
  this.require = require_;
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

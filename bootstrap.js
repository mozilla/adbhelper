const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");

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

function install(data, reason) {}

function startup(data, reason) {
  let uri = registerAddonResourceHandler(data);

  let { Loader, Require, Main } = loaderModule = 
    Cu.import('resource://gre/modules/commonjs/toolkit/loader.js').Loader;

  const { ConsoleAPI } = Cu.import("resource://gre/modules/devtools/Console.jsm");

  let loader = Loader({
    paths: {
      "./": uri,
      "": "resource://gre/modules/commonjs/"
    },
    globals: {
      console: new ConsoleAPI({
        prefix: data.id
      })
    },
    modules: {
      "toolkit/loader": loaderModule
    }
  });

  let require_ = Require(loader, { id: "./addon" });
  require_("./main");
}

function shutdown(data, reason) {}

function uninstall(data, reason) {}

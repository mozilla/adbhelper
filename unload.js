/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { Cc, Ci } = require("chrome");
const observerService = Cc["@mozilla.org/observer-service;1"]
                          .getService(Ci.nsIObserverService);
const unloadSubject = require("@loader/unload");
const observers = [];

observerService.addObserver({
  observe(subject, topic, data) {
    // If this loader is unload then `subject.wrappedJSObject` will be
    // `destructor`.
    if (subject.wrappedJSObject === unloadSubject) {
      observerService.removeObserver(this, "sdk:loader:destroy");
      observers.forEach(observer => {
        try {
          observer(data);
        } catch (error) {
          console.exception(error);
        }
      });
    }
  }
  // Note that we use strong reference to listener here to make sure it's not
  // GC-ed, which may happen otherwise since nothing keeps reference to `onunolad`
  // function.
}, "sdk:loader:destroy", false);

function unload(observer) {
  if (observers.includes(observer)) {
    return;
  }
  observers.unshift(observer);
};
module.exports = unload;
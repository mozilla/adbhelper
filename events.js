/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

 // Note: this module can be replaced once we're not supporting anymore versions of
 // Firefox with SDK.
 try {
   // <FF57
   module.exports = require("resource://gre/modules/commonjs/sdk/event/core");
 } catch (e) {
   // >=FF57, after SDK removal
   module.exports = require("./devtools-require")("devtools/shared/event-emitter");
 }

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Cu } = require("chrome");
const { OS } = require("resource://gre/modules/osfile.jsm");
const { Services } = Cu.import("resource://gre/modules/Services.jsm", {});
const { NetUtil } = require("resource://gre/modules/NetUtil.jsm");
const { TextDecoder } =
  Cu.getGlobalForObject(Cu.import("resource://gre/modules/Services.jsm", {}));
const { FileUtils } = require("resource://gre/modules/FileUtils.jsm");

const ADDON_ROOT_PATH = "resource://adbhelperatmozilla.org";
// Use the "local" profile directory, since it's meant for temporary storage.
const UNPACKED_ROOT_PATH = OS.Path.join(OS.Constants.Path.localProfileDir, "adbhelper");
const MANIFEST = "manifest.json";

function getPlatformDir() {
  let { OS: platform, XPCOMABI } = Services.appinfo;
  switch (platform) {
    case "Linux":
      return XPCOMABI.indexOf("x86_64") == 0 ? "linux64" : "linux";
    case "Darwin":
      return "mac64";
    case "WINNT":
      return "win32";
    default:
      throw new Error("Unsupported platform : " + platform);
  }
}

/**
 * Read the manifest from inside the add-on.
 * Uses NetUtil since data is packed inside the add-on, not a local file.
 */
async function getManifestFromAddon() {
  return new Promise((resolve, reject) => {
    NetUtil.asyncFetch({
      uri: `${ADDON_ROOT_PATH}/${getPlatformDir()}/${MANIFEST}`,
      loadUsingSystemPrincipal: true
    }, (input) => {
      let data;
      try {
        let string = NetUtil.readInputStreamToString(input, input.available());
        data = JSON.parse(string);
      } catch (e) {
        reject(new Error("Could not read manifest in add-on"));
        return;
      }
      resolve(data);
    });
  });
}

/**
 * Read the manifest from the unpacked binary directory.
 * Uses OS.File since this is a local file.
 */
async function getManifestFromUnpacked() {
  let dirPath = OS.Path.join(UNPACKED_ROOT_PATH, getPlatformDir());
  let manifestPath = OS.Path.join(dirPath, MANIFEST);
  if (!await OS.File.exists(manifestPath)) {
    throw new Error("Manifest doesn't exist at unpacked path");
  }
  let binary = await OS.File.read(manifestPath);
  let json = new TextDecoder().decode(binary);
  let data;
  try {
    data = JSON.parse(json);
  } catch (e) {
    throw new Error("Could not read unpacked manifest");
  }
  return data;
}

/**
 * Unpack file from the add-on.
 * Uses NetUtil to read and write, since it's required for reading.
 *
 * @param {string} file
 *        The base name of the file, such as "adb".
 * @param {object} options
 *        Object with the properties:
 *        - exec {boolean}
 *          Whether to mark the file as executable.
 */
async function unpackFile(file, { exec }) {
  // Assumes that destination dir already exists.
  let filePath = OS.Path.join(UNPACKED_ROOT_PATH, getPlatformDir(), file);
  await new Promise((resolve, reject) => {
    NetUtil.asyncFetch({
      uri: `${ADDON_ROOT_PATH}/${getPlatformDir()}/${file}`,
      loadUsingSystemPrincipal: true
    }, (input) => {
      try {
        // Since we have to use NetUtil to read, probably it's okay to use for
        // writing, rather than bouncing to OS.File...?
        let outputFile = new FileUtils.File(filePath);
        let output = FileUtils.openAtomicFileOutputStream(outputFile);
        NetUtil.asyncCopy(input, output, resolve);
      } catch (e) {
        reject(new Error(`Could not unpack file ${file} in add-on: ${e}`));
      }
    });
  });
  // Mark binaries as executable.
  if (exec) {
    await OS.File.setPermissions(filePath, { unixMode: 0o744 });
  }
}

/**
 * Check state of binary unpacking, including the location and manifest.
 */
async function isUnpacked() {
  let dirPath = OS.Path.join(UNPACKED_ROOT_PATH, getPlatformDir());
  let manifestPath = OS.Path.join(dirPath, MANIFEST);
  if (!await OS.File.exists(manifestPath)) {
    console.log("Needs unpacking, no manifest found");
    return false;
  }
  let addonManifest = await getManifestFromAddon();
  let unpackedManifest = await getManifestFromUnpacked();
  if (addonManifest.version != unpackedManifest.version) {
    console.log(
      `Needs unpacking, add-on version ${addonManifest.version} != ` +
      `unpacked version ${unpackedManifest.version}`
    );
    return false;
  }
  console.log("Already unpacked");
  return true;
}

/**
 * Unpack binaries for the current OS along with the manifest.
 */
async function unpack() {
  let dirPath = OS.Path.join(UNPACKED_ROOT_PATH, getPlatformDir());
  await OS.File.makeDir(dirPath, { from: OS.Constants.Path.localProfileDir });
  let manifest = await getManifestFromAddon();
  for (let file of manifest.files) {
    await unpackFile(file, { exec: true });
  }
  await unpackFile(MANIFEST, { exec: false });
}

/**
 * Get a file object for a given named binary that was packed in this add-on.
 *
 * @param {string} name
 *        Base name of the binary, such as "adb".
 * @return {nsIFile}
 *        File object for the binary.
 */
async function getFileForBinary(name) {
  if (!await isUnpacked()) {
    await unpack();
  }
  let path = OS.Path.join(UNPACKED_ROOT_PATH, getPlatformDir(), name);
  let { OS: platform } = Services.appinfo;
  if (platform == "WINNT") {
    path += ".exe";
  }
  console.log(`Binary path: ${path}`);
  return new FileUtils.File(path);
}

exports.getFileForBinary = getFileForBinary;

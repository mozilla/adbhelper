A Firefox addon to ease connecting to Firefox for Android.

Addon license: http://www.mozilla.org/MPL/

ADB license: http://www.apache.org/licenses/LICENSE-2.0.html

ADB source code: https://android.googlesource.com/platform/system/core/+/master/adb

## Building

To build the addon, run `make` from the root folder of your clone.

This will package the addon for various operating systems:
- adbhelper-X.Y.Z-linux.xpi
- adbhelper-X.Y.Z-linux64.xpi
- adbhelper-X.Y.Z-mac64.xpi
- adbhelper-X.Y.Z-win32.xpi

## Testing

### Prerequisite: Firefox for Android

You need a Firefox for Android to connect to.

If you are already setup to build Firefox and don't want to use a real device, the easiest way is to use an Artifact Build for Firefox for Android. See the [documentation on MDN](https://developer.mozilla.org/en-US/docs/Mozilla/Developer_guide/Build_Instructions/Simple_Firefox_for_Android_build#I_want_to_work_on_the_front-end).

Once you have Firefox for Android running in a simulator, go to `Settings` > `Advanced` and turn on `Remote Debugging via USB` in the `DevTools` section.

If you prefer to use a real device, refer to the documentation on MDN for [USB Debugging](https://developer.mozilla.org/en-US/docs/Tools/Remote_Debugging/Debugging_Firefox_for_Android_with_WebIDE).

You are now ready to test ADB Helper.

### Test a local build of ADB Helper

Only Firefox Nightly allows to load unsigned extensions, so make sure to use this distribution channel.

In about:config, turn the following preferences:
- `xpinstall.signatures.required` should be set to `false`
- `extensions.legacy.enabled` should be set to true

Drag and drop the xpi file for your current operating system to your browser window. You will get a prompt about installing adbhelper.

Open WebIDE (Shift+F8). You should see your Firefox for Android runtime listed under "USB Devices".

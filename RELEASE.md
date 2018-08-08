# Release a new version

1) Update add-on version

The current version on github should already be `${YOUR_VERSION}pre`.
The version is set in `Makefile` header, in a `ADDON_VERSION` variable.
So your first task will be to remove the `pre` suffix.
For example, if we were about to release 0.12.1, Makefile should already be set to:
```
  ADDON_VERSION=0.12.1pre
```
And, while releasing, you have to update that variable to:
```
  ADDON_VERSION=0.12.1
```

2) Commit that change

```
$ git commit -m "Release 0.12.1" Makefile
```

3) Get AWS keys to sign *and* upload the add-on

For all the informations about how to sign the add-on, and get keys, see:
  https://mana.mozilla.org/wiki/display/SVCOPS/Sign+a+Mozilla+Internal+Extension
To get keys used for uploading the addon, please use this bug as a template for you:
  https://bugzilla.mozilla.org/show_bug.cgi?id=1481123
  
4) Build the add-on

This step is simple, just do:
```
  $ make
```
It will create `adbhelper-0.12.1-linux64.xpi`, `adbhelper-0.12.1-linux.xpi`, `adbhelper-0.12.1-win32.xpi`, `adbhelper-0.12.1-mac64.xpi`.

5) Setup `sign-xpi` tool, used to sign the add-on

```
  git clone https://github.com/mozilla-services/sign-xpi/
  # We need to checkout this revision since we are currently updating and testing a new implementation
  cd sign-xpi/cli
  git checkout 291a3e22ddb100772a452264c2827daaf4ac5774
  virtualenv venv
  source venv/bin/activate
  pip install -e .
```

After that, you can verify that `sign-xpi` is in your path by running it:
```
  $ sign-xpi
  Traceback (most recent call last):
    File "/home/alex/adbhelper/sign-xpi/cli/venv/bin/sign-xpi", line 11, in <module>
  ...
    raise NoRegionError()
  botocore.exceptions.NoRegionError: You must specify a region.
```
(`sign-xpi` throws when no arguments are given, but it means it is in your path!)

You may also want to install amazon AWS cli tool, if you don't have it installed yet:
```
  $ pip install awscli --upgrade
```
(Note that it will install it in the virtualenv, and will only be available from it)

6) Test your add-on

In step 3, you should have received two set of signing keys.
One for "production", and another for "stage".
You can use the stage one in order to test your addon.
Pick the xpi file related to your operating system and do:
```
$ SIGN_AWS_SECRET_ACCESS_KEY=xxx SIGN_AWS_ACCESS_KEY_ID=xxx ./sign.sh adbhelper-0.12.1-linux64.xpi
Signing adbhelper-0.12.1-linux64.xpi
{"uploaded": {"bucket": "net-mozaws-prod-addons-signxpi-output", "key": "adbhelper-0.12.1-linux64.xpi"}}
download: s3://net-mozaws-prod-addons-signxpi-output/adbhelper-0.12.1-linux64.xpi to ./adbhelper-0.12.1-linux64.xpi
```
The xpi file should now be signed and be installable in Firefox.
Please test your add-on now.

7) Release the add-on

If the add-on works great after testing it, you can release it via:
```
  SIGN_AWS_SECRET_ACCESS_KEY=xxx SIGN_AWS_ACCESS_KEY_ID=xxx  AWS_SECRET_ACCESS_KEY=xxx AWS_ACCESS_KEY_ID=xxx make release
```

SIGN_AWS_SECRET_ACCESS_KEY and SIGN_AWS_ACCESS_KEY_ID are the credential to sign the add-on,
while AWS_SECRET_ACCESS_KEY and AWS_ACCESS_KEY_ID are the one to upload it.

8) Push the release to github

```
$ git tag 0.12.1
$ git push upstream 0.12.1
```

9) Update master's current version

Go edit Makefile again to bump to the next "pre" version:
```
  ADDON_VERSION=0.12.2pre
```
And commit and push that change to master branch:
```
  $ git commit --msg "Bump to 0.12.2pre" Makefile
  $ git push upstream HEAD:master
```


FILES=adb.js install.rdf bootstrap.js main.js subprocess.js
XPI_NAME=adbhelper

all: xpi-win xpi-linux xpi-mac

xpi-win: $(FILES) subprocess_worker_win.js win32
	zip "$(XPI_NAME)-windows.xpi" -r $^

xpi-linux: $(FILES) subprocess_worker_unix.js linux linux64
	zip $(XPI_NAME)-linux.xpi -r $^

xpi-mac: $(FILES) subprocess_worker_unix.js mac64
	zip $(XPI_NAME)-mac.xpi -r $^

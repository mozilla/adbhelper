FILES=adb.js adb-*.js install.rdf bootstrap.js main.js subprocess.js
ADDON_VERSION=0.2.1
XPI_NAME=adbhelper-$(ADDON_VERSION)

FTP_ROOT_PATH=/pub/mozilla.org/labs/fxos-simulator/adb-helper

UPDATE_PATH=$(B2G_VERSION)/$(B2G_PLATFORM)
UPDATE_LINK=https://ftp.mozilla.org$(FTP_ROOT_PATH)/

UPDATE_RDF=sed -e 's/@@ADDON_VERSION@@/$(ADDON_VERSION)/' template-update.rdf

XPIS = $(XPI_NAME)-win32.xpi $(XPI_NAME)-linux.xpi $(XPI_NAME)-mac64.xpi
UPDATE_MANIFESTS = update-win32.rdf update-linux.rdf update-linux64.rdf update-mac64.rdf

all: $(XPIS) $(UPDATE_MANIFESTS)

$(XPI_NAME)-win32.xpi: $(FILES) subprocess_worker_win.js win32
	zip $@ -r $^

$(XPI_NAME)-linux.xpi: $(FILES) subprocess_worker_unix.js linux
	zip $@ -r $^

$(XPI_NAME)-linux64.xpi: $(FILES) subprocess_worker_unix.js linux64
	zip $@ -r $^

$(XPI_NAME)-mac64.xpi: $(FILES) subprocess_worker_unix.js mac64
	zip $@ -r $^

update-win32.rdf:
	$(UPDATE_RDF) | sed -e 's#@@UPDATE_LINK@@#$(UPDATE_LINK)win32/$(XPI_NAME)-win32.xpi#' > $@

update-linux.rdf:
	$(UPDATE_RDF) | sed -e 's#@@UPDATE_LINK@@#$(UPDATE_LINK)linux/$(XPI_NAME)-linux.xpi#' > $@

update-linux64.rdf:
	$(UPDATE_RDF) | sed -e 's#@@UPDATE_LINK@@#$(UPDATE_LINK)linux64/$(XPI_NAME)-linux64.xpi#' > $@

update-mac64.rdf:
	$(UPDATE_RDF) | sed -e 's#@@UPDATE_LINK@@#$(UPDATE_LINK)mac64/$(XPI_NAME)-mac64.xpi#' > $@

clean:
	rm -f $(XPI_NAME)-*.xpi
	rm -f update-*.rdf

release: $(XPIS) $(UPDATE_MANIFESTS)
	ssh $(SSH_USER)@stage.mozilla.org 'mkdir -m 755 -p $(FTP_ROOT_PATH)/{win32,linux,linux64,mac64}'
	chmod 766 $(XPIS) $(UPDATE_MANIFESTS)
	scp -p $(XPI_NAME)-win32.xpi $(SSH_USER)@stage.mozilla.org:$(FTP_ROOT_PATH)/win32/$(XPI_NAME)-win32.xpi
	scp -p update-win32.rdf $(SSH_USER)@stage.mozilla.org:$(FTP_ROOT_PATH)/win32/update.rdf
	scp -p $(XPI_NAME)-linux.xpi $(SSH_USER)@stage.mozilla.org:$(FTP_ROOT_PATH)/linux/$(XPI_NAME)-linux.xpi
	scp -p update-linux.rdf $(SSH_USER)@stage.mozilla.org:$(FTP_ROOT_PATH)/linux/update.rdf
	scp -p $(XPI_NAME)-linux64.xpi $(SSH_USER)@stage.mozilla.org:$(FTP_ROOT_PATH)/linux64/$(XPI_NAME)-linux.xpi
	scp -p update-linux64.rdf $(SSH_USER)@stage.mozilla.org:$(FTP_ROOT_PATH)/linux64/update.rdf
	scp -p $(XPI_NAME)-mac64.xpi $(SSH_USER)@stage.mozilla.org:$(FTP_ROOT_PATH)/mac64/$(XPI_NAME)-mac64.xpi
	scp -p update-mac64.rdf $(SSH_USER)@stage.mozilla.org:$(FTP_ROOT_PATH)/mac64/update.rdf

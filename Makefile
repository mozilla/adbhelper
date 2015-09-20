FILES=adb.js adb-*.js bootstrap.js device.js fastboot.js main.js scanner.js
ADDON_VERSION=0.8.1pre
XPI_NAME=adbhelper-$(ADDON_VERSION)

FTP_ROOT_PATH=/pub/mozilla.org/labs/fxos-simulator/adb-helper

UPDATE_LINK=https://ftp.mozilla.org$(FTP_ROOT_PATH)/
UPDATE_URL=$(UPDATE_LINK)

XPIS = $(XPI_NAME)-win32.xpi $(XPI_NAME)-linux.xpi $(XPI_NAME)-linux64.xpi $(XPI_NAME)-mac64.xpi

all: $(XPIS)

define build-xpi
	echo "build xpi for $1";
	sed -e 's#@@UPDATE_URL@@#$(UPDATE_URL)$1/update.rdf#;s#@@ADDON_VERSION@@#$(ADDON_VERSION)#' template-install.rdf > install.rdf
	zip $(XPI_NAME)-$1.xpi -r $2 install.rdf
endef

$(XPI_NAME)-win32.xpi: $(FILES) win32
	@$(call build-xpi,win32, $^)

$(XPI_NAME)-linux.xpi: $(FILES) linux linux64
	@$(call build-xpi,linux, $^)

$(XPI_NAME)-linux64.xpi: $(FILES) linux linux64
	@$(call build-xpi,linux64, $^)

$(XPI_NAME)-mac64.xpi: $(FILES) mac64
	@$(call build-xpi,mac64, $^)

clean:
	rm -f adbhelper-*.xpi
	rm -f update.rdf install.rdf

define release
  echo "releasing $1"
  # Copy the xpi
  chmod 766 $(XPI_NAME)-$1.xpi
	scp -p $(XPI_NAME)-$1.xpi $(SSH_USER)@stage.mozilla.org:$(FTP_ROOT_PATH)/$1/$(XPI_NAME)-$1.xpi
  # Update the "latest" symbolic link
	ssh $(SSH_USER)@stage.mozilla.org 'cd $(FTP_ROOT_PATH)/$1/ && ln -fs $(XPI_NAME)-$1.xpi adbhelper-$1-latest.xpi'
  # Update the update manifest
	sed -e 's#@@UPDATE_LINK@@#$(UPDATE_LINK)$1/$(XPI_NAME)-$1.xpi#;s#@@ADDON_VERSION@@#$(ADDON_VERSION)#' template-update.rdf > update.rdf
  chmod 766 update.rdf
	scp update.rdf $(SSH_USER)@stage.mozilla.org:$(FTP_ROOT_PATH)/$1/update.rdf
endef

release: $(XPIS)
	@if [ -z $(SSH_USER) ]; then \
	  echo "release target requires SSH_USER env variable to be defined."; \
	  exit 1; \
	fi
	ssh $(SSH_USER)@stage.mozilla.org 'mkdir -m 755 -p $(FTP_ROOT_PATH)/{win32,linux,linux64,mac64}'
	@$(call release,win32)
	@$(call release,linux)
	@$(call release,linux64)
	@$(call release,mac64)

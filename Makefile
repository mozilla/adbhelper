FILES=adb.js adb-*.js binary-manager.js bootstrap.js device.js devtools-import.js devtools-require.js events.js fastboot.js main.js scanner.js unload.js
ADDON_NAME=adbhelper
ADDON_VERSION=0.12.1pre
XPI_NAME=$(ADDON_NAME)-$(ADDON_VERSION)

REMOTE_ROOT_PATH=/pub/labs/fxos-simulator/adb-helper/

UPDATE_LINK=https://ftp.mozilla.org$(REMOTE_ROOT_PATH)
UPDATE_URL=$(UPDATE_LINK)

S3_BASE_URL=s3://net-mozaws-prod-delivery-contrib$(REMOTE_ROOT_PATH)

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
  ./sign.sh $(XPI_NAME)-$1.xpi
  echo "releasing $1"
	aws s3 cp $(XPI_NAME)-$1.xpi $(S3_BASE_URL)$1/$(XPI_NAME)-$1.xpi
  # Update the "latest" symbolic link with a copy inside s3
	aws s3 cp $(S3_BASE_URL)$1/$(XPI_NAME)-$1.xpi $(S3_BASE_URL)$1/$(ADDON_NAME)-$1-latest.xpi
  # Update the update manifest
	sed -e 's#@@UPDATE_LINK@@#$(UPDATE_LINK)$1/$(XPI_NAME)-$1.xpi#;s#@@ADDON_VERSION@@#$(ADDON_VERSION)#' template-update.rdf > update.rdf
	aws s3 cp --cache-control max-age=3600 update.rdf $(S3_BASE_URL)$1/update.rdf
endef

release: $(XPIS)
	@$(call release,win32)
	@$(call release,linux)
	@$(call release,linux64)
	@$(call release,mac64)

# gitlab-startos
#
# Both arches build cheaply here (the image is pulled, not built), so build
# both. Releases still ship x86_64 only until aarch64 is validated on real
# hardware — see RELEASE_ARCHES below.
ARCHES := x86 arm
# overrides to s9pk.mk must precede the include statement
include node_modules/@start9labs/start-sdk/s9pk.mk

# "19.2.2:0" -> "19.2.2.0". A colon is legal in a path but awkward; the period
# form also matches what the publishing tooling derives from the manifest.
VERSION   := $(shell awk -F"'" '/version:/ {print $$2; exit}' startos/versions/current.ts | tr ':' '.')
BUILD_DIR := builds/$(VERSION)
# The registry's publish script globs *-040.s9pk to tell 0.4.0 builds apart
# from 0.3.5 ones.
SUFFIX    ?= -040

# Ship only what has been validated on real hardware. To promote aarch64:
#   make release RELEASE_ARCHES="x86_64 aarch64"
RELEASE_ARCHES ?= x86_64

# Git tag for this version: "19.2.2:0" -> "v19.2.2_0" (StartOS convention).
TAG := v$(shell awk -F"'" '/version:/ {print $$2; exit}' startos/versions/current.ts | tr ':' '_')

.PHONY: release
release:
	@rm -rf $(BUILD_DIR)          # a stale artifact would slip into SHA256SUMS
	@mkdir -p $(BUILD_DIR)
	@for a in $(RELEASE_ARCHES); do \
	  $(MAKE) --no-print-directory arch/$$a || exit 1; \
	  mv $(PACKAGE_ID)_$$a.s9pk $(BUILD_DIR)/$(PACKAGE_ID)_$$a$(SUFFIX).s9pk; \
	done
	@cd $(BUILD_DIR) && sha256sum *.s9pk > SHA256SUMS
	@echo "→ $(BUILD_DIR)/"

# Publish the built release to GitHub so specific versions can be sideloaded.
# Sign builds/<version>/SHA256SUMS on the air-gapped machine first and put the
# detached signature beside it; this only uploads what is already there.
.PHONY: publish-github
publish-github:
	@./scripts/publish-github.sh "$(BUILD_DIR)" "$(TAG)"

.PHONY: print-tag
print-tag:
	@echo '$(TAG)'

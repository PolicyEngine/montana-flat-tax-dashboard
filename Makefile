PYTHON ?= $(if $(wildcard .venv/Scripts/python.exe),.venv/Scripts/python.exe,.venv/bin/python)

.PHONY: install dataset data test build

install:
	uv venv --python 3.13 .venv
	uv pip install --python $(PYTHON) -r requirements.txt
	cd frontend && npm ci

# Download the Montana slices of the Populace release (built on Modal by
# scripts/build_dataset.py) into .cache/datasets/.
dataset:
	modal volume get mt-flat-tax-data populace .cache/datasets --force

# Regenerate every file in frontend/public/data/ from reform.json.
data:
	cd scripts && ../$(PYTHON) pipeline.py
	cd scripts && ../$(PYTHON) district_pipeline.py
	cd scripts && ../$(PYTHON) compute_example_households.py

test:
	cd frontend && npm run lint && npm test

build:
	cd frontend && npm run build

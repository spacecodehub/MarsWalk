#!/usr/bin/env python3
"""Validate P1 metadata manifests for MarsWalk."""

from __future__ import annotations

import csv
import hashlib
import sys
from pathlib import Path

import rasterio

REPO_ROOT = Path(__file__).resolve().parents[1]
DATA_FALLBACK = REPO_ROOT.parent / 'data'
MANIFESTS = [
    REPO_ROOT / 'data' / 'metadata' / 'dataset_inventory.csv',
    REPO_ROOT / 'data' / 'metadata' / 'source_manifest.csv',
    REPO_ROOT / 'data' / 'metadata' / 'product_validation.csv',
]
ALLOWED_STATUSES = {
    'VERIFIED',
    'DOWNLOADED_NOT_VALIDATED',
    'AVAILABLE_NOT_DOWNLOADED',
    'MISSING',
    'PARTIAL',
    'DUPLICATE',
    'PENDING_DISTRIBUTION',
}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(65536), b''):
            h.update(chunk)
    return h.hexdigest().upper()


def validate_raster_file(path: Path, require_georeferencing: bool = True) -> list[str]:
    errors: list[str] = []
    suffix = path.suffix.lower()
    if suffix not in {'.tif', '.tiff', '.img', '.vrt'}:
        return errors

    try:
        with rasterio.open(path) as src:
            if src.width <= 0 or src.height <= 0:
                errors.append(f'INVALID_RASTER_DIMS:{path}')
            if src.count <= 0:
                errors.append(f'INVALID_RASTER_BANDS:{path}')
            if src.dtypes and not src.dtypes[0]:
                errors.append(f'INVALID_RASTER_DTYPE:{path}')
            if require_georeferencing and src.crs is None:
                errors.append(f'MISSING_RASTER_CRS:{path}')
            if src.res is None or any(v <= 0 for v in src.res):
                errors.append(f'INVALID_RASTER_RESOLUTION:{path}')
            if src.crs is not None:
                bounds = src.bounds
                if bounds is None or (bounds.right - bounds.left <= 0) or (bounds.top - bounds.bottom <= 0):
                    errors.append(f'INVALID_RASTER_BOUNDS:{path}')
    except Exception as exc:  # pragma: no cover - exercised at runtime
        errors.append(f'UNREADABLE_RASTER:{path}:{exc}')

    return errors


def normalize(value: str | None) -> str:
    if value is None:
        return ''
    return value.strip()


def resolve_path(raw: str) -> Path | None:
    if not raw:
        return None
    raw = raw.strip()
    if raw.startswith('C:/') or raw.startswith('C:\\') or raw.startswith('\\\\'):
        return Path(raw)
    if raw.startswith('data/') or raw.startswith('data\\'):
        candidates = [REPO_ROOT / raw.replace('\\', '/'), DATA_FALLBACK / raw.replace('data/', '').replace('data\\', '')]
        for p in candidates:
            if p.exists():
                return p
        return REPO_ROOT / raw.replace('\\', '/')
    if raw.startswith('./'):
        return (REPO_ROOT / raw[2:]).resolve()
    if raw.startswith('/'):
        return Path(raw)
    path = (REPO_ROOT / raw).resolve()
    if path.exists():
        return path
    parent_candidate = (DATA_FALLBACK / raw).resolve()
    if parent_candidate.exists():
        return parent_candidate
    return path


def check_manifest(path: Path) -> tuple[int, int, list[str]]:
    errors: list[str] = []
    rows_seen = 0
    seen_product_ids: set[str] = set()

    if not path.exists():
        return 0, 0, [f'MISSING_MANIFEST:{path}']

    with path.open('r', newline='', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        if reader.fieldnames is None:
            return 0, 0, [f'NO_HEADERS:{path}']
        required_base = {'dataset_id', 'product_id'}
        missing_cols = sorted(required_base - set(reader.fieldnames))
        if missing_cols:
            errors.append(f'{path.name}: missing required columns: {missing_cols}')

        for row_index, row in enumerate(reader, start=2):
            rows_seen += 1
            if None in row or any(value is None for key, value in row.items() if key is not None):
                errors.append(f'{path.name}:{row_index}: CSV row field count does not match header')

            dataset_id = normalize(row.get('dataset_id'))
            product_id = normalize(row.get('product_id'))
            source_url = normalize(row.get('source_url'))
            file_path = normalize(row.get('file_path'))
            label_path = normalize(row.get('label_path'))
            checksum = normalize(row.get('checksum'))
            size_field = normalize(row.get('size_bytes'))
            acquisition_status = normalize(row.get('acquisition_status'))
            validation_status = normalize(row.get('validation_status'))

            if not dataset_id:
                errors.append(f'{path.name}:{row_index}: dataset_id is empty')
                continue

            if product_id:
                if product_id in seen_product_ids:
                    errors.append(f'{path.name}:{row_index}: duplicate product_id {product_id}')
                else:
                    seen_product_ids.add(product_id)

            if acquisition_status and acquisition_status not in ALLOWED_STATUSES:
                errors.append(f'{path.name}:{row_index}: unsupported acquisition_status {acquisition_status}')
            if validation_status and validation_status not in ALLOWED_STATUSES:
                errors.append(f'{path.name}:{row_index}: unsupported validation_status {validation_status}')

            if source_url and not source_url.startswith(('http://', 'https://')):
                errors.append(f'{path.name}:{row_index}: malformed source_url {source_url}')

            if file_path:
                full_path = resolve_path(file_path)
                missing_allowed = (
                    acquisition_status in {'MISSING', 'AVAILABLE_NOT_DOWNLOADED', 'PENDING_DISTRIBUTION'}
                    or validation_status in {'MISSING', 'AVAILABLE_NOT_DOWNLOADED', 'PENDING_DISTRIBUTION'}
                )
                if full_path is None or not full_path.exists():
                    if not missing_allowed:
                        errors.append(f'{path.name}:{row_index}: file missing: {file_path}')
                else:
                    if full_path.is_file():
                        if full_path.stat().st_size == 0:
                            errors.append(f'{path.name}:{row_index}: file is empty: {file_path}')
                        if validation_status == 'VERIFIED' and checksum:
                            actual = sha256(full_path)
                            if actual.upper() != checksum.upper():
                                errors.append(f'{path.name}:{row_index}: checksum mismatch for {file_path}')
                        if size_field:
                            try:
                                expected = int(size_field)
                            except ValueError:
                                errors.append(f'{path.name}:{row_index}: non-integer size_bytes {size_field}')
                            else:
                                if full_path.stat().st_size != expected:
                                    errors.append(f'{path.name}:{row_index}: size_bytes mismatch for {file_path}')
                        if full_path.suffix.lower() in {'.tif', '.tiff', '.img', '.vrt'}:
                            has_pds4_label = (
                                full_path.suffix.lower() == '.img'
                                and full_path.with_suffix('.xml').is_file()
                            )
                            errors.extend(validate_raster_file(full_path, not has_pds4_label))
                    elif full_path.is_dir():
                        if validation_status == 'VERIFIED' and not any(full_path.iterdir()):
                            errors.append(f'{path.name}:{row_index}: geodatabase directory is empty: {file_path}')

            if label_path:
                full_path = resolve_path(label_path)
                missing_allowed = (
                    acquisition_status in {'MISSING', 'AVAILABLE_NOT_DOWNLOADED', 'PENDING_DISTRIBUTION'}
                    or validation_status in {'MISSING', 'AVAILABLE_NOT_DOWNLOADED', 'PENDING_DISTRIBUTION'}
                )
                if full_path is None or not full_path.exists():
                    if not missing_allowed:
                        errors.append(f'{path.name}:{row_index}: label missing: {label_path}')

    return rows_seen, len(errors), errors


def main() -> int:
    all_errors: list[str] = []
    total_rows = 0
    for manifest in MANIFESTS:
        rows, error_count, errors = check_manifest(manifest)
        total_rows += rows
        if errors:
            all_errors.extend(errors)
        print(f'{manifest.relative_to(REPO_ROOT)}: {rows} rows checked; {error_count} errors')

    if all_errors:
        print('P1 validation failed:')
        for e in all_errors:
            print(f' - {e}')
        return 1

    print(f'P1 manifest validation passed for {total_rows} rows across {len(MANIFESTS)} manifests.')
    return 0


if __name__ == '__main__':
    sys.exit(main())

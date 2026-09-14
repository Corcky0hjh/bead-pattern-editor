# Palette provenance

MARD's existing 291 entries are retained unchanged. New datasets and exact upstream commits are recorded in sources.json. Imported data is distributed with the corresponding MIT license files in this directory.

Artkal C includes 157 C-numbered ordinary colors from the official-chart transcription. CG/CP/CT specialty materials are excluded: the current renderer has no physical glow, pearl or transparent-material model. Other palettes use community reference RGB values, not a guarantee of physical color or a claim to contain the latest complete manufacturer catalog.

Brand and series are independent catalogs. No nearest-color cross-brand aliases are generated. Existing patterns remain hex-based; identical RGB colors cannot be counted separately by brand within a drawing. Work boxes retain explicit brand/code metadata. The legacy MARD-first fallback remains for older works without that metadata.

Run node scripts/import-brand-palettes.mjs to fetch current upstream versions and revalidate the generated data. Review changes before accepting an update.

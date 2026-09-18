# Bear-in-a-Can Clicker Keychain

Two-part prototype for a standard MX-style mechanical keyboard switch. The detailed supplied polar-bear STL is the moving button; the supplied soda-can STL is the fixed body. The can keeps its solid exterior while hiding the guide and switch cavity inside.

## Print files

- `stl/bear_can_clicker_base.stl` — covered soda-can body and connected switch mount
- `stl/bear_can_clicker_top.stl` — bear button with an internal MX cross socket and head-mounted keyring loop
- `stl/bear_can_clicker_assembly_reference.stl` — assembled visual reference only; do not print this file

## Hardware

- 1 standard MX-style mechanical keyboard switch
- 1 split keyring (up to about 4 mm wire thickness)

## Suggested print settings

- PLA or PETG
- 0.16–0.20 mm layer height
- 3 walls
- 15–20% infill
- Print both parts upright in the supplied orientation
- Base: no support should be needed
- Bear top: use light tree/organic supports from the build plate for the muzzle, paws and ears

A 0.2 mm nozzle will preserve the face best. A 0.4 mm nozzle should also work, but use a fine layer height around the MX socket.

## Assembly

1. Push the MX switch downward through the square opening in the recessed top of the can until its side clips engage with the plate.
2. Align the cross socket under the bear with the switch stem.
3. Press the bear straight down onto the stem.
4. Confirm the bear moves freely and returns after every click.
5. Add the split ring through the loop behind the bear's head.

## Prototype fit notes

- Top switch plate opening: 14.05 × 14.05 mm; the can underside is closed
- Bear-to-can running clearance: approximately 0.50 mm per side
- MX cross socket: 4.25 mm overall width, 1.35 mm arm thickness, 4.8 mm usable depth
- Planned button travel: 3.5 mm
- Assembled size: approximately 44 × 44 × 78 mm, excluding the keyring

Printer calibration and switch-stem brands vary. Test one copy first. If the bear is tight on the stem, enlarge `4.25` and/or `1.35` slightly in `generate.py`; if loose, reduce them slightly. The can artwork is intentionally generic and does not include a beverage trademark.

## Regenerating the model

`generate_from_meshy.py` rebuilds the printable pieces from the two supplied Meshy STL files. It requires Python, `trimesh`, `numpy`, `manifold3d`, and the original source files at the paths listed near the top of the script. Run `render_preview.py` afterward to refresh the preview image. The earlier fully parametric concept remains in `generate.py` for reference.

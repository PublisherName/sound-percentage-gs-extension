# Sound percentage (GNOME Shell extension)

Display the current sound percentage in the top bar, next to the corresponding
system indicator.

![screenshot](screenshot.png)

## Testing

1. Install dependency
```bash
uv sync
```

2. Build a zip
```bash
./build.sh
```

3. Check the zip
```bash
uv run shexli sound-percentage@maestroschan.fr.zip
```
# Server Rack Planner

A simple, browser-based tool for planning equipment placement in a server rack. Choose a rack size, add equipment to available rack units, keep configuration notes, and export the finished layout as JSON.

Server Rack Planner runs entirely in the browser. It has no build step, external dependencies, account requirement, or backend service.

## Features

- Plan racks from 2U to 64U
- Add, edit, move, and delete rack-mounted equipment
- Assign common server, network, storage, patch-panel, power, and accessory types
- Reserve multiple contiguous rack units for a device
- Prevent overlapping or out-of-bounds equipment placement
- Save rack and equipment notes
- Automatically preserve the current plan in browser storage
- Export plans to JSON and import them later
- Follow the system color scheme with a manual light/dark theme toggle
- Use a responsive layout on desktop and mobile browsers

## Getting started

No installation or build process is required.

### Open directly

Clone the repository and open `index.html` in a web browser:

```bash
git clone https://github.com/tylxr59/RackPlanner.git
cd RackPlanner
```

Then double-click `index.html`, or open it from your browser.

### Run a local server

Some browsers behave more consistently when the app is served over HTTP. From the project directory, run:

```bash
python3 -m http.server 8000
```

Then visit [http://localhost:8000](http://localhost:8000).

## Usage

1. Select the rack size from the **Rack Size** menu.
2. Click an empty rack unit to add equipment at that position.
3. Enter a name, type, size, location, and any optional notes.
4. Click occupied equipment to edit, move, resize, or delete it.
5. Add general configuration details in the **Notes** section.
6. Use **Export JSON** to create a portable backup of the plan.

To restore a saved plan, select **Import JSON** and choose a previously exported file. **Clear All** removes every equipment item from the current rack after confirmation.

> [!NOTE]
> Changing to a smaller rack removes equipment that no longer fits, but only after you confirm the change.

## Data and privacy

Rack data is stored locally in the browser using `localStorage`. Nothing is sent to a server by this application. Browser data can be cleared by browser settings, private-browsing behavior, or storage cleanup, so export important configurations as JSON backups.

An exported plan has this structure:

```json
{
  "rackSize": 42,
  "equipment": [
    {
      "name": "Core Switch",
      "type": "Core Switch",
      "size": 1,
      "notes": "Primary distribution switch",
      "startPosition": 40
    }
  ],
  "notes": "Main network rack",
  "exportDate": "2026-01-01T12:00:00.000Z"
}
```

## Project structure

```text
RackPlanner/
├── index.html   # Application markup and equipment form
├── scripts.js   # Rack state, rendering, persistence, and import/export
├── styles.css   # Responsive light and dark themes
├── LICENSE      # MIT license
└── README.md
```

## Contributing

Contributions are welcome. Fork the repository, create a focused branch, make and test your changes in a modern browser, and open a pull request describing what changed.

When reporting a bug, include the browser and operating system, steps to reproduce it, and the behavior you expected.

## License

Server Rack Planner is available under the [MIT License](LICENSE).

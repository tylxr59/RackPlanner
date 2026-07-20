const STORAGE_KEY = 'rackPlanner';
const SCHEMA_VERSION = 2;
const MAX_IMPORT_BYTES = 1024 * 1024;
const SUPPORTED_RACK_SIZES = [2, 4, 8, 12, 16, 20, 24, 32, 42, 48, 52, 64];

let rackSize = 42;
let equipment = [];
let rackNotes = '';
let currentEditingId = null;
let lastFocusedElement = null;
let notesSaveTimer = null;
let toastTimer = null;

const app = document.getElementById('app');
const rackContainer = document.getElementById('rack-container');
const rackSizeSelect = document.getElementById('rack-size');
const rackTitle = document.getElementById('rack-title');
const rackNotesTextarea = document.getElementById('rack-notes');
const usageSummary = document.getElementById('usage-summary');
const freeSummary = document.getElementById('free-summary');
const usedStat = document.getElementById('used-stat');
const freeStat = document.getElementById('free-stat');
const deviceStat = document.getElementById('device-stat');
const freeRanges = document.getElementById('free-ranges');
const capacityFill = document.getElementById('capacity-fill');
const equipmentList = document.getElementById('equipment-list');
const equipmentCount = document.getElementById('equipment-count');
const autosaveStatus = document.getElementById('autosave-status');

const modal = document.getElementById('equipment-modal');
const equipmentForm = document.getElementById('equipment-form');
const modalTitle = document.getElementById('modal-title');
const modalEyebrow = document.getElementById('modal-eyebrow');
const closeModalBtn = document.getElementById('close-modal-btn');
const equipmentName = document.getElementById('equipment-name');
const equipmentType = document.getElementById('equipment-type');
const equipmentSize = document.getElementById('equipment-size');
const equipmentNotes = document.getElementById('equipment-notes');
const rackLocation = document.getElementById('rack-location');
const placementPreview = document.getElementById('placement-preview');
const formError = document.getElementById('form-error');
const saveEquipmentBtn = document.getElementById('save-equipment-btn');
const cancelEquipmentBtn = document.getElementById('cancel-equipment-btn');
const deleteEquipmentBtn = document.getElementById('delete-equipment-btn');

const addEquipmentBtn = document.getElementById('add-equipment-btn');
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const clearBtn = document.getElementById('clear-btn');
const fileInput = document.getElementById('file-input');
const themeToggle = document.getElementById('theme-toggle');
const toast = document.getElementById('toast');

function createEquipmentId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
    }

    return `equipment-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function showToast(message, type = 'success') {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.dataset.type = type;
    toast.hidden = false;
    toastTimer = window.setTimeout(() => {
        toast.hidden = true;
    }, 3200);
}

function setSaveStatus(message) {
    autosaveStatus.textContent = message;
}

function initTheme() {
    let savedTheme = null;

    try {
        savedTheme = localStorage.getItem('theme');
    } catch (error) {
        console.warn('Theme preference is unavailable:', error);
    }

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDarkMode(savedTheme === 'dark' || (savedTheme !== 'light' && prefersDark));

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
        try {
            if (!localStorage.getItem('theme')) {
                setDarkMode(event.matches);
            }
        } catch (error) {
            setDarkMode(event.matches);
        }
    });
}

function setDarkMode(isDark) {
    document.body.classList.toggle('dark-mode', isDark);
    themeToggle.querySelector('.theme-icon').textContent = isDark ? '☀' : '☾';
    themeToggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
}

function toggleTheme() {
    const isDark = !document.body.classList.contains('dark-mode');
    setDarkMode(isDark);

    try {
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    } catch (error) {
        showToast('Theme preference could not be saved.', 'error');
    }
}

function normalizeRackPlan(rawData) {
    if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) {
        throw new Error('The file does not contain a rack plan.');
    }

    const normalizedRackSize = rawData.rackSize;
    if (typeof normalizedRackSize !== 'number' || !Number.isInteger(normalizedRackSize) || !SUPPORTED_RACK_SIZES.includes(normalizedRackSize)) {
        throw new Error(`Rack size must be one of: ${SUPPORTED_RACK_SIZES.join(', ')}U.`);
    }

    if (!Array.isArray(rawData.equipment)) {
        throw new Error('Equipment must be provided as a list.');
    }

    if (rawData.notes !== undefined && typeof rawData.notes !== 'string') {
        throw new Error('Rack notes must be text.');
    }

    const occupiedPositions = new Set();
    const knownIds = new Set();
    const normalizedEquipment = rawData.equipment.map((item, index) => {
        const itemNumber = index + 1;
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            throw new Error(`Equipment item ${itemNumber} is invalid.`);
        }

        const name = typeof item.name === 'string' ? item.name.trim() : '';
        const size = item.size;
        const startPosition = item.startPosition;

        if (!name) {
            throw new Error(`Equipment item ${itemNumber} needs a name.`);
        }
        if (typeof size !== 'number' || !Number.isInteger(size) || size < 1 || size > normalizedRackSize) {
            throw new Error(`"${name}" has an invalid size.`);
        }
        if (typeof startPosition !== 'number' || !Number.isInteger(startPosition) || startPosition < 1 || startPosition + size - 1 > normalizedRackSize) {
            throw new Error(`"${name}" is outside the ${normalizedRackSize}U rack.`);
        }
        if (item.type !== undefined && typeof item.type !== 'string') {
            throw new Error(`"${name}" has an invalid type.`);
        }
        if (item.notes !== undefined && typeof item.notes !== 'string') {
            throw new Error(`"${name}" has invalid notes.`);
        }

        for (let position = startPosition; position < startPosition + size; position += 1) {
            if (occupiedPositions.has(position)) {
                throw new Error(`"${name}" overlaps another device at U${position}.`);
            }
            occupiedPositions.add(position);
        }

        let id = typeof item.id === 'string' ? item.id.trim() : '';
        if (!id || knownIds.has(id)) {
            id = createEquipmentId();
        }
        knownIds.add(id);

        return {
            id,
            name: name.slice(0, 120),
            type: (item.type || '').trim(),
            size,
            notes: (item.notes || '').slice(0, 1000),
            startPosition
        };
    });

    return {
        rackSize: normalizedRackSize,
        equipment: normalizedEquipment,
        notes: rawData.notes || ''
    };
}

function saveToLocalStorage() {
    const data = {
        schemaVersion: SCHEMA_VERSION,
        rackSize,
        equipment,
        notes: rackNotes
    };

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        setSaveStatus('Saved locally');
        return true;
    } catch (error) {
        console.error('Could not save rack plan:', error);
        setSaveStatus('Save failed');
        showToast('This plan could not be saved in your browser.', 'error');
        return false;
    }
}

function loadFromLocalStorage() {
    let saved = null;

    try {
        saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) {
            return;
        }

        const plan = normalizeRackPlan(JSON.parse(saved));
        rackSize = plan.rackSize;
        equipment = plan.equipment;
        rackNotes = plan.notes;
    } catch (error) {
        console.error('Saved rack plan is invalid:', error);
        showToast('The saved plan was invalid, so a new rack was opened.', 'error');
    }
}

function generateRack() {
    rackContainer.innerHTML = '';

    for (let position = rackSize; position >= 1; position -= 1) {
        const rackUnit = document.createElement('button');
        rackUnit.className = 'rack-unit';
        rackUnit.type = 'button';
        rackUnit.dataset.position = position;

        const leftRail = document.createElement('span');
        leftRail.className = 'rack-rail left';
        leftRail.setAttribute('aria-hidden', 'true');

        const rackSpace = document.createElement('span');
        rackSpace.className = 'rack-space';

        const rightRail = document.createElement('span');
        rightRail.className = 'rack-rail right';
        rightRail.setAttribute('aria-hidden', 'true');

        const label = document.createElement('span');
        label.className = 'rack-label';
        label.textContent = `U${position}`;
        rightRail.appendChild(label);

        rackUnit.append(leftRail, rackSpace, rightRail);
        rackContainer.appendChild(rackUnit);
    }

    rackTitle.textContent = `${rackSize}U Server Rack`;
}

function findEquipmentAtPosition(position) {
    return equipment.find((item) => position >= item.startPosition && position < item.startPosition + item.size);
}

function findEquipmentById(id) {
    return equipment.find((item) => item.id === id);
}

function arePositionsAvailable(startPosition, size, excludeId = null) {
    if (!Number.isInteger(startPosition) || !Number.isInteger(size) || size < 1) {
        return false;
    }
    if (startPosition < 1 || startPosition + size - 1 > rackSize) {
        return false;
    }

    for (let position = startPosition; position < startPosition + size; position += 1) {
        const existing = findEquipmentAtPosition(position);
        if (existing && existing.id !== excludeId) {
            return false;
        }
    }

    return true;
}

function getAvailablePositions(size, excludeId = null) {
    if (!Number.isInteger(size) || size < 1 || size > rackSize) {
        return [];
    }

    const positions = [];
    for (let position = rackSize - size + 1; position >= 1; position -= 1) {
        if (arePositionsAvailable(position, size, excludeId)) {
            positions.push(position);
        }
    }
    return positions;
}

function formatRange(startPosition, size) {
    const endPosition = startPosition + size - 1;
    return size === 1 ? `U${startPosition}` : `U${startPosition}–U${endPosition}`;
}

function renderEquipment() {
    rackContainer.querySelectorAll('.rack-unit').forEach((unit) => {
        const position = Number(unit.dataset.position);
        const rackSpace = unit.querySelector('.rack-space');
        const item = findEquipmentAtPosition(position);

        unit.className = 'rack-unit';
        delete unit.dataset.equipmentId;
        rackSpace.innerHTML = '';

        if (!item) {
            unit.setAttribute('aria-label', `U${position}, empty. Add equipment.`);
            unit.title = `Add equipment at U${position}`;
            return;
        }

        const highestPosition = item.startPosition + item.size - 1;
        unit.classList.add('occupied');
        unit.dataset.equipmentId = item.id;

        if (item.size === 1) {
            unit.classList.add('equipment-single');
        } else if (position === highestPosition) {
            unit.classList.add('equipment-top');
        } else if (position === item.startPosition) {
            unit.classList.add('equipment-bottom');
        } else {
            unit.classList.add('equipment-middle');
        }

        if (position === highestPosition) {
            const info = document.createElement('span');
            info.className = 'equipment-info';

            const name = document.createElement('span');
            name.className = 'equipment-name';
            name.textContent = item.name;

            const details = document.createElement('span');
            details.className = 'equipment-type';
            details.textContent = `${item.type || 'Equipment'} · ${item.size}U`;

            info.append(name, details);
            rackSpace.appendChild(info);
        }

        const range = formatRange(item.startPosition, item.size);
        unit.setAttribute('aria-label', `U${position}, occupied by ${item.name}, ${item.size}U at ${range}. Edit equipment.`);
        unit.title = `Edit ${item.name} (${range})`;
    });

    renderSummary();
    renderEquipmentList();
}

function calculateFreeRanges() {
    const ranges = [];
    let rangeStart = null;

    for (let position = 1; position <= rackSize; position += 1) {
        if (!findEquipmentAtPosition(position) && rangeStart === null) {
            rangeStart = position;
        }

        const rangeEnds = rangeStart !== null && (findEquipmentAtPosition(position) || position === rackSize);
        if (rangeEnds) {
            const rangeEnd = findEquipmentAtPosition(position) ? position - 1 : position;
            ranges.push(rangeStart === rangeEnd ? `U${rangeStart}` : `U${rangeStart}–U${rangeEnd}`);
            rangeStart = null;
        }
    }

    return ranges;
}

function renderSummary() {
    const used = equipment.reduce((total, item) => total + item.size, 0);
    const free = rackSize - used;
    const usagePercent = rackSize ? (used / rackSize) * 100 : 0;

    usageSummary.textContent = `${used} of ${rackSize}U used`;
    freeSummary.textContent = `${free}U available`;
    usedStat.textContent = `${used}U`;
    freeStat.textContent = `${free}U`;
    deviceStat.textContent = String(equipment.length);
    equipmentCount.textContent = String(equipment.length);
    freeRanges.textContent = calculateFreeRanges().join(', ') || 'None';
    capacityFill.style.width = `${usagePercent}%`;
    capacityFill.parentElement.setAttribute('aria-label', `${Math.round(usagePercent)}% of rack capacity used`);
}

function renderEquipmentList() {
    equipmentList.innerHTML = '';

    if (equipment.length === 0) {
        const emptyState = document.createElement('p');
        emptyState.className = 'empty-state';
        emptyState.textContent = 'No equipment yet. Add a device to get started.';
        equipmentList.appendChild(emptyState);
        return;
    }

    const sortedEquipment = [...equipment].sort((a, b) => {
        const aTop = a.startPosition + a.size - 1;
        const bTop = b.startPosition + b.size - 1;
        return bTop - aTop;
    });

    sortedEquipment.forEach((item) => {
        const button = document.createElement('button');
        button.className = 'equipment-list-item';
        button.type = 'button';
        button.dataset.equipmentId = item.id;
        button.setAttribute('aria-label', `Edit ${item.name}, ${formatRange(item.startPosition, item.size)}`);

        const copy = document.createElement('span');
        const name = document.createElement('strong');
        name.textContent = item.name;
        const type = document.createElement('small');
        type.textContent = item.type || 'Uncategorized equipment';
        copy.append(name, type);

        const range = document.createElement('span');
        range.className = 'range-badge';
        range.textContent = formatRange(item.startPosition, item.size);

        button.append(copy, range);
        equipmentList.appendChild(button);
    });
}

function clearFormError() {
    formError.hidden = true;
    formError.textContent = '';
    [equipmentName, equipmentSize, rackLocation].forEach((field) => field.removeAttribute('aria-invalid'));
}

function showFormError(message, field = null) {
    formError.textContent = message;
    formError.hidden = false;
    if (field) {
        field.setAttribute('aria-invalid', 'true');
        field.focus();
    }
}

function populateLocationSelector(preferredPosition, size, excludeId) {
    const availablePositions = getAvailablePositions(size, excludeId);
    rackLocation.innerHTML = '';

    if (availablePositions.length === 0) {
        const option = document.createElement('option');
        option.textContent = 'No contiguous space available';
        option.value = '';
        rackLocation.appendChild(option);
        rackLocation.disabled = true;
        saveEquipmentBtn.disabled = true;
        updatePlacementPreview();
        return;
    }

    rackLocation.disabled = false;
    saveEquipmentBtn.disabled = false;

    const selectedPosition = availablePositions.includes(preferredPosition)
        ? preferredPosition
        : availablePositions.reduce((nearest, position) => (
            Math.abs(position - preferredPosition) < Math.abs(nearest - preferredPosition) ? position : nearest
        ));

    availablePositions.forEach((position) => {
        const option = document.createElement('option');
        option.value = String(position);
        option.textContent = formatRange(position, size);
        option.selected = position === selectedPosition;
        rackLocation.appendChild(option);
    });

    updatePlacementPreview();
}

function updatePlacementPreview() {
    const size = Number(equipmentSize.value);
    const position = Number(rackLocation.value);

    if (!Number.isInteger(size) || !Number.isInteger(position) || rackLocation.disabled) {
        placementPreview.textContent = 'Choose a valid size to see available placement.';
        return;
    }

    placementPreview.textContent = `This device will occupy ${formatRange(position, size)}.`;
}

function openModalForAdd(position) {
    currentEditingId = null;
    lastFocusedElement = document.activeElement;
    equipmentForm.reset();
    equipmentSize.value = '1';
    equipmentSize.max = String(rackSize);
    modalTitle.textContent = 'Add equipment';
    modalEyebrow.textContent = 'New placement';
    deleteEquipmentBtn.hidden = true;
    clearFormError();
    populateLocationSelector(position, 1, null);
    openModal();
}

function openModalForEdit(item) {
    currentEditingId = item.id;
    lastFocusedElement = document.activeElement;
    equipmentName.value = item.name;
    equipmentType.value = item.type;
    equipmentSize.value = String(item.size);
    equipmentSize.max = String(rackSize);
    equipmentNotes.value = item.notes;
    modalTitle.textContent = 'Edit equipment';
    modalEyebrow.textContent = formatRange(item.startPosition, item.size);
    deleteEquipmentBtn.hidden = false;
    clearFormError();
    populateLocationSelector(item.startPosition, item.size, item.id);
    openModal();
}

function openModal() {
    modal.hidden = false;
    document.body.classList.add('modal-open');
    app.inert = true;
    window.requestAnimationFrame(() => equipmentName.focus());
}

function closeModalDialog() {
    if (modal.hidden) {
        return;
    }

    modal.hidden = true;
    document.body.classList.remove('modal-open');
    app.inert = false;
    currentEditingId = null;
    clearFormError();

    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
        lastFocusedElement.focus();
    }
}

function handleRackClick(event) {
    const unit = event.target.closest('.rack-unit');
    if (!unit) {
        return;
    }

    const position = Number(unit.dataset.position);
    const existing = findEquipmentAtPosition(position);
    if (existing) {
        openModalForEdit(existing);
    } else {
        openModalForAdd(position);
    }
}

function saveEquipment(event) {
    event.preventDefault();
    clearFormError();

    const name = equipmentName.value.trim();
    const size = Number(equipmentSize.value);
    const selectedPosition = Number(rackLocation.value);
    const existing = currentEditingId ? findEquipmentById(currentEditingId) : null;

    if (!name) {
        showFormError('Enter an equipment name.', equipmentName);
        return;
    }
    if (!Number.isInteger(size) || size < 1 || size > rackSize) {
        showFormError(`Size must be a whole number between 1 and ${rackSize}U.`, equipmentSize);
        return;
    }
    if (!Number.isInteger(selectedPosition) || !arePositionsAvailable(selectedPosition, size, currentEditingId)) {
        showFormError('Choose an available rack location.', rackLocation);
        return;
    }

    const updatedItem = {
        id: existing ? existing.id : createEquipmentId(),
        name: name.slice(0, 120),
        type: equipmentType.value,
        size,
        notes: equipmentNotes.value.trim().slice(0, 1000),
        startPosition: selectedPosition
    };

    if (existing) {
        equipment = equipment.map((item) => item.id === existing.id ? updatedItem : item);
    } else {
        equipment.push(updatedItem);
    }

    saveToLocalStorage();
    renderEquipment();
    closeModalDialog();
    showToast(existing ? `${updatedItem.name} updated.` : `${updatedItem.name} added.`);
}

function deleteEquipment() {
    const existing = findEquipmentById(currentEditingId);
    if (!existing) {
        return;
    }

    if (window.confirm(`Delete "${existing.name}" from the rack?`)) {
        equipment = equipment.filter((item) => item.id !== existing.id);
        saveToLocalStorage();
        renderEquipment();
        closeModalDialog();
        showToast(`${existing.name} deleted.`);
    }
}

function exportToJSON() {
    const data = {
        schemaVersion: SCHEMA_VERSION,
        rackSize,
        equipment: [...equipment].sort((a, b) => a.startPosition - b.startPosition),
        notes: rackNotes,
        exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rack-planner-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    showToast('Rack plan exported.');
}

function importFromJSON(file) {
    if (file.size > MAX_IMPORT_BYTES) {
        showToast('Import files must be smaller than 1 MB.', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const plan = normalizeRackPlan(JSON.parse(event.target.result));
            const hasCurrentPlan = equipment.length > 0 || rackNotes.trim();
            if (hasCurrentPlan && !window.confirm('Importing will replace the current rack plan. Continue?')) {
                return;
            }

            rackSize = plan.rackSize;
            equipment = plan.equipment;
            rackNotes = plan.notes;
            rackSizeSelect.value = String(rackSize);
            rackNotesTextarea.value = rackNotes;
            generateRack();
            renderEquipment();
            saveToLocalStorage();
            showToast('Rack plan imported.');
        } catch (error) {
            showToast(`Import failed: ${error.message}`, 'error');
        }
    };
    reader.onerror = () => showToast('The selected file could not be read.', 'error');
    reader.readAsText(file);
}

function clearAllEquipment() {
    if (equipment.length === 0) {
        showToast('The rack is already empty.');
        return;
    }

    if (window.confirm('Remove all equipment from this rack? Rack notes will be kept.')) {
        equipment = [];
        saveToLocalStorage();
        renderEquipment();
        showToast('All equipment removed.');
    }
}

function handleRackSizeChange(event) {
    const newSize = Number(event.target.value);
    const removedItems = equipment.filter((item) => item.startPosition + item.size - 1 > newSize);

    if (removedItems.length > 0) {
        const message = `Changing to ${newSize}U will remove ${removedItems.length} device${removedItems.length === 1 ? '' : 's'} that no longer fit. Continue?`;
        if (!window.confirm(message)) {
            rackSizeSelect.value = String(rackSize);
            return;
        }
        equipment = equipment.filter((item) => item.startPosition + item.size - 1 <= newSize);
    }

    rackSize = newSize;
    generateRack();
    renderEquipment();
    saveToLocalStorage();
    showToast(`Rack resized to ${rackSize}U.`);
}

function handleEquipmentSizeChange() {
    clearFormError();
    const size = Number(equipmentSize.value);
    const existing = currentEditingId ? findEquipmentById(currentEditingId) : null;
    const currentSelection = Number(rackLocation.value) || (existing ? existing.startPosition : 1);
    populateLocationSelector(currentSelection, size, currentEditingId);
}

function openFirstAvailablePosition() {
    const available = getAvailablePositions(1);
    if (available.length === 0) {
        showToast('This rack is full. Resize it or remove equipment first.', 'error');
        return;
    }
    openModalForAdd(available[0]);
}

function trapModalFocus(event) {
    if (event.key === 'Escape') {
        closeModalDialog();
        return;
    }
    if (event.key !== 'Tab') {
        return;
    }

    const focusable = [...modal.querySelectorAll('button:not([disabled]):not([hidden]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])')];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}

function attachEventListeners() {
    rackContainer.addEventListener('click', handleRackClick);
    equipmentList.addEventListener('click', (event) => {
        const button = event.target.closest('[data-equipment-id]');
        if (button) {
            const item = findEquipmentById(button.dataset.equipmentId);
            if (item) {
                openModalForEdit(item);
            }
        }
    });

    addEquipmentBtn.addEventListener('click', openFirstAvailablePosition);
    rackSizeSelect.addEventListener('change', handleRackSizeChange);
    equipmentForm.addEventListener('submit', saveEquipment);
    closeModalBtn.addEventListener('click', closeModalDialog);
    cancelEquipmentBtn.addEventListener('click', closeModalDialog);
    deleteEquipmentBtn.addEventListener('click', deleteEquipment);
    equipmentSize.addEventListener('input', handleEquipmentSizeChange);
    rackLocation.addEventListener('change', updatePlacementPreview);
    equipmentName.addEventListener('input', clearFormError);

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModalDialog();
        }
    });
    modal.addEventListener('keydown', trapModalFocus);

    exportBtn.addEventListener('click', exportToJSON);
    importBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (event) => {
        const [file] = event.target.files;
        if (file) {
            importFromJSON(file);
        }
        event.target.value = '';
    });
    clearBtn.addEventListener('click', clearAllEquipment);
    themeToggle.addEventListener('click', toggleTheme);

    rackNotesTextarea.addEventListener('input', (event) => {
        rackNotes = event.target.value;
        setSaveStatus('Saving…');
        window.clearTimeout(notesSaveTimer);
        notesSaveTimer = window.setTimeout(saveToLocalStorage, 350);
    });
}

function init() {
    initTheme();
    loadFromLocalStorage();
    rackSizeSelect.value = String(rackSize);
    rackNotesTextarea.value = rackNotes;
    generateRack();
    renderEquipment();
    attachEventListeners();
}

document.addEventListener('DOMContentLoaded', init);

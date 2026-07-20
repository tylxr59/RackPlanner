// State management
let rackSize = 42;
let equipment = [];
let rackNotes = '';
let currentEditingPosition = null;

// DOM elements
const rackContainer = document.getElementById('rack-container');
const rackSizeSelect = document.getElementById('rack-size');
const rackTitle = document.getElementById('rack-title');
const rackNotesTextarea = document.getElementById('rack-notes');
const modal = document.getElementById('equipment-modal');
const modalTitle = document.getElementById('modal-title');
const closeModal = document.querySelector('.close');
const equipmentName = document.getElementById('equipment-name');
const equipmentType = document.getElementById('equipment-type');
const equipmentSize = document.getElementById('equipment-size');
const equipmentNotes = document.getElementById('equipment-notes');
const rackLocation = document.getElementById('rack-location');
const originalPosition = document.getElementById('original-position');
const originalPositionInfo = document.getElementById('original-position-info');
const saveEquipmentBtn = document.getElementById('save-equipment-btn');
const cancelEquipmentBtn = document.getElementById('cancel-equipment-btn');
const deleteEquipmentBtn = document.getElementById('delete-equipment-btn');
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const clearBtn = document.getElementById('clear-btn');
const fileInput = document.getElementById('file-input');
const themeToggle = document.getElementById('theme-toggle');

// Theme management
function initTheme() {
    // Check for saved theme preference or default to auto-detect
    const savedTheme = localStorage.getItem('theme');
    
    if (savedTheme === 'dark') {
        setDarkMode(true);
    } else if (savedTheme === 'light') {
        setDarkMode(false);
    } else {
        // Auto-detect based on browser preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setDarkMode(prefersDark);
    }
    
    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        // Only apply if user hasn't manually set a preference
        if (!localStorage.getItem('theme')) {
            setDarkMode(e.matches);
        }
    });
}

function setDarkMode(isDark) {
    if (isDark) {
        document.body.classList.add('dark-mode');
        themeToggle.querySelector('.theme-icon').textContent = '☀️';
        themeToggle.setAttribute('aria-label', 'Switch to light mode');
    } else {
        document.body.classList.remove('dark-mode');
        themeToggle.querySelector('.theme-icon').textContent = '🌙';
        themeToggle.setAttribute('aria-label', 'Switch to dark mode');
    }
}

function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-mode');
    setDarkMode(isDark);
    // Save user preference
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// Initialize
function init() {
    initTheme();
    loadFromLocalStorage();
    generateRack(rackSize);
    renderEquipment();
    attachEventListeners();
    rackNotesTextarea.value = rackNotes;
}

// Generate rack visual
function generateRack(size) {
    rackContainer.innerHTML = '';
    
    // Generate from top to bottom, but label from bottom to top
    for (let i = size; i >= 1; i--) {
        const rackUnit = document.createElement('div');
        rackUnit.className = 'rack-unit';
        rackUnit.dataset.position = i;
        
        // Left rail
        const leftRail = document.createElement('div');
        leftRail.className = 'rack-rail left';
        
        // Center space
        const rackSpace = document.createElement('div');
        rackSpace.className = 'rack-space';
        
        // Right rail with label
        const rightRail = document.createElement('div');
        rightRail.className = 'rack-rail right';
        const label = document.createElement('span');
        label.className = 'rack-label';
        label.textContent = `U${i}`;
        rightRail.appendChild(label);
        
        rackUnit.appendChild(leftRail);
        rackUnit.appendChild(rackSpace);
        rackUnit.appendChild(rightRail);
        
        rackUnit.addEventListener('click', () => handleRackClick(i));
        
        rackContainer.appendChild(rackUnit);
    }
    
    rackTitle.textContent = `${size}U Server Rack`;
}

// Handle rack unit click
function handleRackClick(position) {
    // Check if this position is occupied
    const existingEquipment = findEquipmentAtPosition(position);
    
    if (existingEquipment) {
        // Edit existing equipment
        openModalForEdit(existingEquipment);
    } else {
        // Add new equipment
        openModalForAdd(position);
    }
}

// Find equipment at a specific position
function findEquipmentAtPosition(position) {
    return equipment.find(eq => {
        return position >= eq.startPosition && position < eq.startPosition + eq.size;
    });
}

// Check if positions are available
function arePositionsAvailable(startPos, size, excludeEquipment = null) {
    if (startPos < 1 || startPos + size - 1 > rackSize) {
        return false;
    }
    
    for (let pos = startPos; pos < startPos + size; pos++) {
        const existingEq = findEquipmentAtPosition(pos);
        if (existingEq && existingEq !== excludeEquipment) {
            return false;
        }
    }
    
    return true;
}

// Populate location selector with available positions
function populateLocationSelector(currentPosition, size, excludeEquipment) {
    rackLocation.innerHTML = '';
    
    for (let pos = rackSize; pos >= 1; pos--) {
        if (arePositionsAvailable(pos, size, excludeEquipment)) {
            const option = document.createElement('option');
            option.value = pos;
            option.textContent = `U${pos}`;
            if (pos === currentPosition) {
                option.selected = true;
            }
            rackLocation.appendChild(option);
        }
    }
    
    // If current position is not available (shouldn't happen), add it anyway
    if (!rackLocation.querySelector(`option[value="${currentPosition}"]`)) {
        const option = document.createElement('option');
        option.value = currentPosition;
        option.textContent = `U${currentPosition}`;
        option.selected = true;
        rackLocation.appendChild(option);
    }
}

// Open modal for adding equipment
function openModalForAdd(position) {
    currentEditingPosition = position;
    modalTitle.textContent = 'Add Equipment';
    equipmentName.value = '';
    equipmentType.value = '';
    equipmentSize.value = '1';
    equipmentNotes.value = '';
    populateLocationSelector(position, 1, null);
    originalPositionInfo.style.display = 'none';
    deleteEquipmentBtn.style.display = 'none';
    modal.style.display = 'block';
}

// Open modal for editing equipment
function openModalForEdit(eq) {
    currentEditingPosition = eq.startPosition;
    modalTitle.textContent = 'Edit Equipment';
    equipmentName.value = eq.name;
    equipmentType.value = eq.type || '';
    equipmentSize.value = eq.size;
    equipmentNotes.value = eq.notes || '';
    populateLocationSelector(eq.startPosition, eq.size, eq);
    originalPosition.textContent = `U${eq.startPosition}`;
    originalPositionInfo.style.display = 'block';
    deleteEquipmentBtn.style.display = 'inline-block';
    modal.style.display = 'block';
}

// Close modal
function closeModalDialog() {
    modal.style.display = 'none';
    currentEditingPosition = null;
}

// Save equipment
function saveEquipment() {
    const name = equipmentName.value.trim();
    const type = equipmentType.value;
    const size = parseInt(equipmentSize.value);
    const notes = equipmentNotes.value.trim();
    const selectedPosition = parseInt(rackLocation.value);
    
    if (!name) {
        alert('Please enter an equipment name');
        return;
    }
    
    if (size < 1 || size > rackSize) {
        alert(`Size must be between 1 and ${rackSize}U`);
        return;
    }
    
    // Check if editing existing equipment
    const existingEquipment = findEquipmentAtPosition(currentEditingPosition);
    
    // Check if positions are available (excluding current equipment if editing)
    if (!arePositionsAvailable(selectedPosition, size, existingEquipment)) {
        alert('The selected positions are not available or exceed rack size');
        return;
    }
    
    if (existingEquipment) {
        // Update existing equipment
        existingEquipment.name = name;
        existingEquipment.type = type;
        existingEquipment.size = size;
        existingEquipment.notes = notes;
        existingEquipment.startPosition = selectedPosition;
    } else {
        // Add new equipment
        equipment.push({
            name,
            type,
            size,
            notes,
            startPosition: selectedPosition
        });
    }
    
    saveToLocalStorage();
    renderEquipment();
    closeModalDialog();
}

// Delete equipment
function deleteEquipment() {
    const existingEquipment = findEquipmentAtPosition(currentEditingPosition);
    
    if (existingEquipment) {
        if (confirm(`Are you sure you want to delete "${existingEquipment.name}"?`)) {
            equipment = equipment.filter(eq => eq !== existingEquipment);
            saveToLocalStorage();
            renderEquipment();
            closeModalDialog();
        }
    }
}

// Render equipment on rack
function renderEquipment() {
    // Reset all rack units
    const rackUnits = document.querySelectorAll('.rack-unit');
    rackUnits.forEach(unit => {
        unit.classList.remove('occupied', 'equipment-start', 'equipment-middle', 'equipment-end');
        const rackSpace = unit.querySelector('.rack-space');
        rackSpace.innerHTML = '';
    });
    
    // Render each equipment
    equipment.forEach(eq => {
        for (let i = 0; i < eq.size; i++) {
            const position = eq.startPosition + i;
            const rackUnit = document.querySelector(`[data-position="${position}"]`);
            
            if (rackUnit) {
                rackUnit.classList.add('occupied');
                
                if (eq.size === 1) {
                    // Single unit equipment
                    rackUnit.classList.add('equipment-start');
                    rackUnit.classList.add('equipment-end');
                    const rackSpace = rackUnit.querySelector('.rack-space');
                    
                    const infoDiv = document.createElement('div');
                    infoDiv.className = 'equipment-info';
                    
                    const nameDiv = document.createElement('div');
                    nameDiv.className = 'equipment-name';
                    nameDiv.textContent = eq.name;
                    
                    const typeDiv = document.createElement('div');
                    typeDiv.className = 'equipment-type';
                    typeDiv.textContent = eq.type || `${eq.size}U Equipment`;
                    
                    infoDiv.appendChild(nameDiv);
                    infoDiv.appendChild(typeDiv);
                    rackSpace.appendChild(infoDiv);
                } else if (i === 0) {
                    // First unit of equipment
                    rackUnit.classList.add('equipment-start');
                    const rackSpace = rackUnit.querySelector('.rack-space');
                    
                    const infoDiv = document.createElement('div');
                    infoDiv.className = 'equipment-info';
                    
                    const nameDiv = document.createElement('div');
                    nameDiv.className = 'equipment-name';
                    nameDiv.textContent = eq.name;
                    
                    const typeDiv = document.createElement('div');
                    typeDiv.className = 'equipment-type';
                    typeDiv.textContent = eq.type || `${eq.size}U Equipment`;
                    
                    infoDiv.appendChild(nameDiv);
                    infoDiv.appendChild(typeDiv);
                    rackSpace.appendChild(infoDiv);
                } else if (i === eq.size - 1) {
                    // Last unit of equipment
                    rackUnit.classList.add('equipment-end');
                } else {
                    // Middle units
                    rackUnit.classList.add('equipment-middle');
                }
            }
        }
    });
}

// Export to JSON
function exportToJSON() {
    // Sort equipment by position (bottom to top)
    const sortedEquipment = [...equipment].sort((a, b) => a.startPosition - b.startPosition);
    
    const data = {
        rackSize,
        equipment: sortedEquipment,
        notes: rackNotes,
        exportDate: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `rack-planner-${Date.now()}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
}

// Import from JSON
function importFromJSON(file) {
    const reader = new FileReader();
    
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            
            if (!data.rackSize || !Array.isArray(data.equipment)) {
                throw new Error('Invalid rack planner data format');
            }
            
            // Validate rack size
            if (data.rackSize < 2 || data.rackSize > 64) {
                throw new Error('Invalid rack size in imported data');
            }
            
            // Update rack size
            rackSize = data.rackSize;
            rackSizeSelect.value = rackSize;
            
            // Import equipment
            equipment = data.equipment;
            
            // Import notes if available
            rackNotes = data.notes || '';
            rackNotesTextarea.value = rackNotes;
            
            // Regenerate rack and render
            generateRack(rackSize);
            attachRackEventListeners();
            renderEquipment();
            saveToLocalStorage();
            
            alert('Import successful!');
        } catch (error) {
            alert('Error importing file: ' + error.message);
        }
    };
    
    reader.readAsText(file);
}

// Clear all equipment
function clearAllEquipment() {
    if (equipment.length === 0) {
        alert('Rack is already empty');
        return;
    }
    
    if (confirm('Are you sure you want to remove all equipment from the rack?')) {
        equipment = [];
        saveToLocalStorage();
        renderEquipment();
    }
}

// Save to localStorage
function saveToLocalStorage() {
    const data = {
        rackSize,
        equipment,
        notes: rackNotes
    };
    localStorage.setItem('rackPlanner', JSON.stringify(data));
}

// Load from localStorage
function loadFromLocalStorage() {
    const saved = localStorage.getItem('rackPlanner');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            if (data.rackSize && Array.isArray(data.equipment)) {
                rackSize = data.rackSize;
                rackSizeSelect.value = rackSize;
                equipment = data.equipment;
                rackNotes = data.notes || '';
            }
        } catch (error) {
            console.error('Error loading from localStorage:', error);
        }
    }
}

// Attach event listeners to rack units
function attachRackEventListeners() {
    const rackUnits = document.querySelectorAll('.rack-unit');
    rackUnits.forEach(unit => {
        const position = parseInt(unit.dataset.position);
        unit.addEventListener('click', () => handleRackClick(position));
    });
}

// Attach all event listeners
function attachEventListeners() {
    // Rack size change
    rackSizeSelect.addEventListener('change', (e) => {
        const newSize = parseInt(e.target.value);
        
        // Check if any equipment would be out of bounds
        const outOfBounds = equipment.some(eq => eq.startPosition + eq.size - 1 > newSize);
        
        if (outOfBounds) {
            if (!confirm('Changing rack size will remove equipment that no longer fits. Continue?')) {
                rackSizeSelect.value = rackSize;
                return;
            }
            
            // Remove out of bounds equipment
            equipment = equipment.filter(eq => eq.startPosition + eq.size - 1 <= newSize);
        }
        
        rackSize = newSize;
        generateRack(rackSize);
        attachRackEventListeners();
        renderEquipment();
        saveToLocalStorage();
    });
    
    // Modal controls
    closeModal.addEventListener('click', closeModalDialog);
    cancelEquipmentBtn.addEventListener('click', closeModalDialog);
    saveEquipmentBtn.addEventListener('click', saveEquipment);
    deleteEquipmentBtn.addEventListener('click', deleteEquipment);
    
    // Update location selector when size changes
    equipmentSize.addEventListener('input', () => {
        const newSize = parseInt(equipmentSize.value) || 1;
        const existingEquipment = findEquipmentAtPosition(currentEditingPosition);
        const currentSelection = parseInt(rackLocation.value) || currentEditingPosition;
        populateLocationSelector(currentSelection, newSize, existingEquipment);
    });
    
    // Click outside modal to close
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModalDialog();
        }
    });
    
    // Export/Import/Clear
    exportBtn.addEventListener('click', exportToJSON);
    importBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            importFromJSON(e.target.files[0]);
            e.target.value = ''; // Reset file input
        }
    });
    clearBtn.addEventListener('click', clearAllEquipment);
    
    // Theme toggle
    themeToggle.addEventListener('click', toggleTheme);
    
    // Notes auto-save
    rackNotesTextarea.addEventListener('input', (e) => {
        rackNotes = e.target.value;
        saveToLocalStorage();
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'block') {
            closeModalDialog();
        }
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    // Setup Panel
    const setupPanel = document.getElementById('setup-panel');
    const assemblyTypeSelect = document.getElementById('assembly-type');
    const csvInput = document.getElementById('csv-input');
    const startBtn = document.getElementById('start-btn');
    const setupError = document.getElementById('setup-error');

    // Attendance Panel
    const attendancePanel = document.getElementById('attendance-panel');
    const quorumStatus = document.getElementById('quorum-status');
    const progressBarFill = document.getElementById('progress-bar-fill');
    const quorumMarker = document.getElementById('quorum-marker');
    const currentPercentageEl = document.getElementById('current-percentage');
    const targetPercentageEl = document.getElementById('target-percentage');
    
    const searchInput = document.getElementById('search-input');
    const unitsTbody = document.getElementById('units-tbody');
    const downloadBtn = document.getElementById('download-btn');
    const resetBtn = document.getElementById('reset-btn');

    // --- State ---
    let units = [];
    let targetQuorum = 33; // Default
    let totalPercentagePresent = 0;

    // --- Functions ---

    function showError(message) {
        setupError.textContent = message;
        setupError.classList.remove('hidden');
    }

    function hideError() {
        setupError.classList.add('hidden');
    }

    function parseCSV(text) {
        const lines = text.split('\n');
        const parsedUnits = [];
        let totalAlicuota = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const parts = line.split(',');
            if (parts.length < 2) {
                throw new Error(`Error en la línea ${i + 1}: Formato incorrecto. Usa "Nombre, Porcentaje"`);
            }

            const name = parts[0].trim();
            const rawPercentage = parts[1].trim().replace('%', '');
            const percentage = parseFloat(rawPercentage);

            if (isNaN(percentage) || percentage < 0) {
                throw new Error(`Error en la línea ${i + 1}: El porcentaje "${parts[1]}" no es válido.`);
            }

            parsedUnits.push({
                id: `unit_${i}`,
                name: name,
                percentage: percentage,
                present: false
            });
            
            totalAlicuota += percentage;
        }

        if (parsedUnits.length === 0) {
            throw new Error('No se encontraron datos. Por favor, ingresa al menos una unidad.');
        }

        return { parsedUnits, totalAlicuota };
    }

    function initAttendance() {
        hideError();
        const csvText = csvInput.value;
        
        try {
            const { parsedUnits, totalAlicuota } = parseCSV(csvText);
            
            // Optional warning if it doesn't sum to near 100%
            if (Math.abs(totalAlicuota - 100) > 1) {
                console.warn(`La suma total de alícuotas es ${totalAlicuota}%, no 100%.`);
            }

            units = parsedUnits;
            targetQuorum = parseFloat(assemblyTypeSelect.options[assemblyTypeSelect.selectedIndex].dataset.quorum);
            
            // Setup UI
            targetPercentageEl.textContent = targetQuorum === 50.01 ? '>50%' : `${targetQuorum}%`;
            quorumMarker.style.left = `${Math.min(targetQuorum, 100)}%`;
            
            totalPercentagePresent = 0;
            updateDashboard();
            renderUnitsList(units);

            // Switch Panels
            setupPanel.classList.remove('active');
            setupPanel.classList.add('hidden');
            attendancePanel.classList.remove('hidden');
            attendancePanel.classList.add('active');

        } catch (error) {
            showError(error.message);
        }
    }

    function togglePresence(unitId) {
        const unit = units.find(u => u.id === unitId);
        if (unit) {
            unit.present = !unit.present;
            updateDashboard();
            renderUnitsList(units); // Re-render to update UI, could be optimized
        }
    }

    function updateDashboard() {
        totalPercentagePresent = units
            .filter(u => u.present)
            .reduce((sum, u) => sum + u.percentage, 0);

        const formattedPercentage = totalPercentagePresent.toFixed(2);
        currentPercentageEl.textContent = `${formattedPercentage}%`;

        // Update Progress Bar
        const barWidth = Math.min(totalPercentagePresent, 100);
        progressBarFill.style.width = `${barWidth}%`;

        // Check Quorum
        let isQuorumMet = false;
        if (targetQuorum === 50.01) {
            isQuorumMet = totalPercentagePresent > 50;
        } else {
            isQuorumMet = totalPercentagePresent >= targetQuorum;
        }

        if (isQuorumMet) {
            quorumStatus.textContent = 'Quórum Alcanzado';
            quorumStatus.className = 'badge success';
            progressBarFill.classList.add('success');
        } else {
            quorumStatus.textContent = 'No Alcanzado';
            quorumStatus.className = 'badge warning';
            progressBarFill.classList.remove('success');
        }
    }

    function renderUnitsList(listToRender) {
        unitsTbody.innerHTML = '';
        
        const searchTerm = searchInput.value.toLowerCase();
        const filteredList = listToRender.filter(u => u.name.toLowerCase().includes(searchTerm));

        filteredList.forEach(unit => {
            const tr = document.createElement('tr');
            
            const statusHtml = unit.present 
                ? `<div class="status-indicator"><div class="dot present"></div> Presente</div>`
                : `<div class="status-indicator"><div class="dot absent"></div> Ausente</div>`;
                
            const btnHtml = unit.present
                ? `<button class="toggle-btn active" data-id="${unit.id}">Marcar Ausente</button>`
                : `<button class="toggle-btn" data-id="${unit.id}">Marcar Presente</button>`;

            tr.innerHTML = `
                <td><strong>${unit.name}</strong></td>
                <td>${unit.percentage.toFixed(2)}%</td>
                <td>${statusHtml}</td>
                <td>${btnHtml}</td>
            `;

            unitsTbody.appendChild(tr);
        });

        // Add event listeners to newly created buttons
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                togglePresence(e.target.dataset.id);
            });
        });
    }

    function downloadRecord() {
        let csvContent = "data:text/csv;charset=utf-8,";
        
        // Header
        csvContent += "Unidad,Alicuota (%),Estado Asistencia\n";
        
        // Data
        units.forEach(unit => {
            const status = unit.present ? "Presente" : "Ausente";
            const row = `"${unit.name}",${unit.percentage},${status}`;
            csvContent += row + "\n";
        });
        
        // Summary
        csvContent += "\nResumen\n";
        csvContent += `Tipo Asamblea,${assemblyTypeSelect.options[assemblyTypeSelect.selectedIndex].text}\n`;
        csvContent += `Quorum Requerido,${targetPercentageEl.textContent}\n`;
        csvContent += `Asistencia Total,${totalPercentagePresent.toFixed(2)}%\n`;
        csvContent += `Estado,${quorumStatus.textContent}\n`;

        // Encode and Download
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        
        const date = new Date().toISOString().split('T')[0];
        link.setAttribute("download", `registro_asistencia_${date}.csv`);
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function resetApp() {
        if(confirm('¿Estás seguro de finalizar? Se perderán los datos no guardados.')) {
            attendancePanel.classList.remove('active');
            attendancePanel.classList.add('hidden');
            setupPanel.classList.remove('hidden');
            setupPanel.classList.add('active');
            units = [];
            totalPercentagePresent = 0;
            searchInput.value = '';
        }
    }

    // --- Event Listeners ---
    startBtn.addEventListener('click', initAttendance);
    
    searchInput.addEventListener('input', () => {
        renderUnitsList(units);
    });

    downloadBtn.addEventListener('click', downloadRecord);
    resetBtn.addEventListener('click', resetApp);
    
    // Auto-fill example data on double click of textarea for testing
    csvInput.addEventListener('dblclick', () => {
        if (!csvInput.value) {
            csvInput.value = "Depto 101, 15.5\nDepto 102, 20.0\nDepto 103, 14.5\nDepto 201, 25.0\nDepto 202, 25.0";
        }
    });
});

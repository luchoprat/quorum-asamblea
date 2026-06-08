document.addEventListener('DOMContentLoaded', () => {
    // --- Firebase Initialization ---
    const firebaseConfig = {
      apiKey: "AIzaSyCHyai2btBespTCDHTTpLSGDiM7omlbPKg",
      authDomain: "quorum-asambleas.firebaseapp.com",
      projectId: "quorum-asambleas",
      storageBucket: "quorum-asambleas.firebasestorage.app",
      messagingSenderId: "584244044765",
      appId: "1:584244044765:web:c6864d1ddf0c6bde3dcc34"
    };
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();

    // --- DOM Elements ---
    // Setup Panel
    const setupPanel = document.getElementById('setup-panel');
    const assemblyTypeSelect = document.getElementById('assembly-type');
    const csvInput = document.getElementById('csv-input');
    const startBtn = document.getElementById('start-btn');
    const setupError = document.getElementById('setup-error');
    
    // Cloud Elements
    const cloudSelect = document.getElementById('cloud-select');
    const cloudLoadBtn = document.getElementById('cloud-load-btn');
    const cloudDeleteBtn = document.getElementById('cloud-delete-btn');
    const cloudSaveName = document.getElementById('cloud-save-name');
    const cloudSaveBtn = document.getElementById('cloud-save-btn');
    
    // Resume Elements
    const resumeContainer = document.getElementById('resume-container');
    const resumeBtn = document.getElementById('resume-btn');

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

            saveActiveState();
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
            saveActiveState();
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
            localStorage.removeItem('activeAssembly');
            resumeContainer.classList.add('hidden');
        }
    }

    // --- Active Session Recovery ---
    function saveActiveState() {
        const state = {
            units,
            targetQuorum,
            totalPercentagePresent,
            assemblyType: assemblyTypeSelect.value
        };
        localStorage.setItem('activeAssembly', JSON.stringify(state));
    }

    function checkActiveState() {
        const saved = localStorage.getItem('activeAssembly');
        if (saved) {
            resumeContainer.classList.remove('hidden');
        }
    }

    function resumeAssembly() {
        const saved = localStorage.getItem('activeAssembly');
        if (!saved) return;
        
        try {
            const state = JSON.parse(saved);
            units = state.units;
            targetQuorum = state.targetQuorum;
            totalPercentagePresent = state.totalPercentagePresent;
            
            assemblyTypeSelect.value = state.assemblyType;
            targetPercentageEl.textContent = targetQuorum === 50.01 ? '>50%' : `${targetQuorum}%`;
            quorumMarker.style.left = `${Math.min(targetQuorum, 100)}%`;
            
            updateDashboard();
            renderUnitsList(units);

            setupPanel.classList.remove('active');
            setupPanel.classList.add('hidden');
            attendancePanel.classList.remove('hidden');
            attendancePanel.classList.add('active');
        } catch(e) {
            console.error("Error resuming state", e);
        }
    }

    // --- Cloud Functions ---
    async function loadCloudLists() {
        try {
            const snapshot = await db.collection('condominios').get();
            cloudSelect.innerHTML = '<option value="">Selecciona un condominio...</option>';
            snapshot.forEach(doc => {
                const opt = document.createElement('option');
                opt.value = doc.id;
                opt.textContent = doc.id;
                cloudSelect.appendChild(opt);
            });
        } catch(e) {
            console.error("Error loading lists", e);
            cloudSelect.innerHTML = '<option value="">Error cargando listas</option>';
        }
    }

    // --- Event Listeners ---
    startBtn.addEventListener('click', initAttendance);
    
    searchInput.addEventListener('input', () => {
        renderUnitsList(units);
    });

    downloadBtn.addEventListener('click', downloadRecord);
    resetBtn.addEventListener('click', resetApp);
    resumeBtn.addEventListener('click', resumeAssembly);
    
    cloudSaveBtn.addEventListener('click', async () => {
        const name = cloudSaveName.value.trim();
        const csv = csvInput.value.trim();
        if(!name || !csv) {
            alert('Por favor ingresa un nombre y pega los datos CSV abajo antes de guardar.');
            return;
        }
        
        cloudSaveBtn.textContent = 'Guardando...';
        cloudSaveBtn.disabled = true;
        
        try {
            parseCSV(csv); // Verify format
            await db.collection('condominios').doc(name).set({
                csvData: csv,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            alert('Lista guardada exitosamente en la nube.');
            cloudSaveName.value = '';
            loadCloudLists();
        } catch(e) {
            alert('Error: ' + e.message);
        } finally {
            cloudSaveBtn.textContent = 'Guardar';
            cloudSaveBtn.disabled = false;
        }
    });

    cloudLoadBtn.addEventListener('click', async () => {
        const selectedId = cloudSelect.value;
        if(!selectedId) {
            alert('Por favor selecciona una lista.');
            return;
        }
        cloudLoadBtn.textContent = '...';
        try {
            const doc = await db.collection('condominios').doc(selectedId).get();
            if(doc.exists) {
                csvInput.value = doc.data().csvData;
            }
        } catch(e) {
            alert('Error cargando la lista.');
        } finally {
            cloudLoadBtn.textContent = 'Cargar';
        }
    });

    cloudDeleteBtn.addEventListener('click', async () => {
        const selectedId = cloudSelect.value;
        if(!selectedId) {
            alert('Por favor selecciona una lista para eliminar.');
            return;
        }
        if(confirm(`¿Estás seguro de eliminar "${selectedId}" de la nube?`)) {
            cloudDeleteBtn.disabled = true;
            try {
                await db.collection('condominios').doc(selectedId).delete();
                alert('Eliminado exitosamente.');
                loadCloudLists();
                csvInput.value = '';
            } catch(e) {
                alert('Error al eliminar.');
            } finally {
                cloudDeleteBtn.disabled = false;
            }
        }
    });
    
    checkActiveState();
    loadCloudLists();
    
    // Auto-fill example data on double click of textarea for testing
    csvInput.addEventListener('dblclick', () => {
        if (!csvInput.value) {
            csvInput.value = "Depto 101, 15.5\nDepto 102, 20.0\nDepto 103, 14.5\nDepto 201, 25.0\nDepto 202, 25.0";
        }
    });
});

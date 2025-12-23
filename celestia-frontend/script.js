document.addEventListener('DOMContentLoaded', () => {
    const apiUrl = 'https://celestia-latency-backend.onrender.com/api/latency/summary';

    // --- DOM Elements ---
    const statusLight = document.getElementById('status-light');
    const statusText = document.getElementById('status-text');
    const lastUpdated = document.getElementById('last-updated');

    const grpcOnlineStatus = document.getElementById('grpc-online-status');
    const rpcOnlineStatus = document.getElementById('rpc-online-status');
    const globalArchival = document.getElementById('global-archival');
    const globalLatency = document.getElementById('global-latency');
    const globalSuccess = document.getElementById('global-success');
    
    const regionsContainer = document.getElementById('regions-container');
    const top15List = document.getElementById('top-15-list');
    const top3List = document.getElementById('top-3-list');
    
    // --- Renderer Functions ---

    const renderGlobalStats = (globalData) => {
        if (!globalData) return;
        grpcOnlineStatus.textContent = `${globalData.grpc_online} / ${globalData.grpc_total}`;
        rpcOnlineStatus.textContent = `${globalData.rpc_online} / ${globalData.rpc_total}`;
        globalArchival.textContent = `${globalData.archival_grpc_total}`;
        globalLatency.textContent = `${globalData.avg_latency_ms} ms`;
        globalSuccess.textContent = `${(globalData.success_rate * 100).toFixed(2)} %`;
    };

    const renderRegions = (regions) => {
        regionsContainer.innerHTML = '';
        if (!regions || regions.length === 0) {
            regionsContainer.innerHTML = '<p class="loading">Awaiting data from regional tests...</p>';
            return;
        }
        
        const table = document.createElement('table');
        table.className = 'region-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>POP</th>
                    <th>Best RPC</th>
                    <th>Latency</th>
                    <th>Health</th>
                    <th>Details</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        const tbody = table.querySelector('tbody');

        regions.sort((a, b) => a.region.localeCompare(b.region));

        regions.forEach(region => {
            const healthStatus = region.success_rate > 0.8 ? 'Healthy' : 'Unhealthy';
            const healthClass = healthStatus === 'Healthy' ? 'status-healthy' : 'status-unhealthy';
            const bestRpcUrl = region.bestRpc ? region.bestRpc.url : 'N/A';
            const bestRpcLatency = region.bestRpc ? `${region.bestRpc.latency_ms}ms` : 'N/A';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${region.region.toUpperCase()}</td>
                <td>${bestRpcUrl}</td>
                <td>${bestRpcLatency}</td>
                <td class="${healthClass}">${healthStatus}</td>
                <td>${region.online} OK, ${region.offline} failed</td>
            `;
            tbody.appendChild(row);
        });
        regionsContainer.appendChild(table);
    };

    const renderTop15 = (top15) => {
        top15List.innerHTML = '';
        if (!top15 || top15.length === 0) {
            top15List.innerHTML = '<li class="loading">Awaiting data from multiple regions...</li>';
            return;
        }

        top15.forEach(endpoint => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <span class="endpoint-url" title="${endpoint.endpoint}">${endpoint.endpoint}</span>
                <span class="online-indicator">ONLINE</span>
                <span class="endpoint-latency">${endpoint.avg_latency_global} ms</span>
            `;
            top15List.appendChild(listItem);
        });
    };

    const renderTop3Latest = (top3) => {
        top3List.innerHTML = '';
        if (!top3 || top3.length === 0) {
            top3List.innerHTML = '<p class="loading">Awaiting data from synced endpoints...</p>';
            return;
        }

        top3.forEach((endpoint, index) => {
            const item = document.createElement('div');
            item.className = 'top-3-item';
            item.innerHTML = `
                <div class="top-3-rank">#${index + 1}</div>
                <div class="top-3-details">
                    <span class="endpoint-url" title="${endpoint.url}">${endpoint.url}</span>
                    <span class="endpoint-meta">${endpoint.region.toUpperCase()}</span>
                </div>
                <div class="top-3-latency">${endpoint.latency_ms} ms</div>
            `;
            top3List.appendChild(item);
        });
    };

    const updateStatus = (state, timestamp) => {
        statusLight.className = 'status-light';
        statusText.textContent = '';
        statusLight.classList.add(state);
        statusText.textContent = `API Status: ${state.charAt(0).toUpperCase() + state.slice(1)}`;
        
        if (timestamp) {
            lastUpdated.textContent = new Date(timestamp).toLocaleString();
        } else {
            lastUpdated.textContent = new Date().toLocaleString();
        }
    };

    const updateDashboard = async () => {
        updateStatus('checking');
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const result = await response.json();

            if (result.success) {
                const { data } = result;
                renderGlobalStats(data.global);
                renderRegions(data.regions);
                renderTop15(data.top_15_fastest);
                renderTop3Latest(data.top_3_latest);
                updateStatus('online', data.generated_at);
            } else {
                throw new Error('API returned success: false');
            }
        } catch (error) {
            console.error("Failed to update dashboard:", error);
            updateStatus('offline');
        }
    };

    // --- Initial Load & Interval ---
    updateDashboard();
    setInterval(updateDashboard, 60000); // Refresh every 60 seconds
});
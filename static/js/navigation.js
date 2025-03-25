// Initialize map
const map = L.map('map').setView([40.7128, -74.0060], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Map layers
const markers = {};
const paths = L.layerGroup().addTo(map);
let currentRoute = null;

// Initialize the application
async function initialize() {
    try {
        const response = await fetch('/api/locations');
        const data = await response.json();
        
        // Add markers for each location
        Object.entries(data.locations).forEach(([id, location]) => {
            const marker = L.marker([location.lat, location.lon], {
                title: location.name
            }).addTo(map);
            
            // Create popup content with amenities
            let popupContent = <strong>${location.name}</strong>;
            if (location.amenities && location.amenities.length > 0) {
                popupContent += '<br><br><strong>Amenities:</strong><ul>';
                location.amenities.forEach(amenity => {
                    popupContent += <li>${amenity.name} (${amenity.type})</li>;
                });
                popupContent += '</ul>';
            }
            
            marker.bindPopup(popupContent);
            markers[id] = marker;
        });
        
        // Draw road connections
        data.roads.forEach(([start, end, type, name]) => {
            const startLoc = data.locations[start];
            const endLoc = data.locations[end];
            
            L.polyline(
                [[startLoc.lat, startLoc.lon], [endLoc.lat, endLoc.lon]],
                {
                    color: getRoadColor(type),
                    weight: getRoadWeight(type),
                    opacity: 0.6,
                    dashArray: type === 'highway' ? '10, 10' : null
                }
            ).addTo(paths);
        });
        
        // Update amenities list
        updateAmenitiesList(data.locations);
        
    } catch (error) {
        console.error('Error initializing map:', error);
        showError('Failed to load map data');
    }
}

// Get road color based on type
function getRoadColor(type) {
    switch (type) {
        case 'highway':
            return '#1976D2';
        case 'main_road':
            return '#388E3C';
        default:
            return '#666666';
    }
}

// Get road weight based on type
function getRoadWeight(type) {
    switch (type) {
        case 'highway':
            return 4;
        case 'main_road':
            return 3;
        default:
            return 2;
    }
}

// Update amenities list in sidebar
function updateAmenitiesList(locations) {
    const amenitiesList = document.getElementById('amenities-list');
    amenitiesList.innerHTML = '';
    
    Object.values(locations).forEach(location => {
        if (location.amenities && location.amenities.length > 0) {
            location.amenities.forEach(amenity => {
                const item = document.createElement('div');
                item.className = 'amenity-item';
                item.innerHTML = `
                    <i class="material-icons">${getAmenityIcon(amenity.type)}</i>
                    <span>${amenity.name}</span>
                `;
                amenitiesList.appendChild(item);
            });
        }
    });
}

// Get icon for amenity type
function getAmenityIcon(type) {
    switch (type) {
        case 'restaurant':
            return 'restaurant';
        case 'parking':
            return 'local_parking';
        case 'hotel':
            return 'hotel';
        default:
            return 'place';
    }
}

// Find route between locations
async function findRoute() {
    const start = document.getElementById('start').value;
    const end = document.getElementById('end').value;
    const optimizeFor = document.querySelector('input[name="optimize"]:checked').value;
    const avoidHighways = document.getElementById('avoid-highways').checked;
    
    if (!start || !end) {
        showError('Please select both start and end locations');
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await fetch('/api/route', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                start,
                end,
                optimize_for: optimizeFor,
                avoid_highways: avoidHighways
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            showError(data.error);
            return;
        }
        
        displayRoute(data);
        
    } catch (error) {
        console.error('Error finding route:', error);
        showError('Failed to calculate route');
    } finally {
        showLoading(false);
    }
}

// Display the calculated route
function displayRoute(routeData) {
    // Clear previous route
    if (currentRoute) {
        paths.removeLayer(currentRoute);
    }
    
    // Create route path
    const routeCoords = routeData.path.map(id => {
        const location = routeData.locations[id];
        return [location.lat, location.lon];
    });
    
    currentRoute = L.polyline(routeCoords, {
        color: '#F44336',
        weight: 5,
        opacity: 0.8
    }).addTo(paths);
    
    // Fit map to route bounds
    map.fitBounds(currentRoute.getBounds(), { padding: [50, 50] });
    
    // Update info panel
    document.getElementById('total-distance').textContent = 
        ${Math.round(routeData.total_distance)} km;
    document.getElementById('total-time').textContent = 
        ${Math.round(routeData.total_time * 60)} min;
    document.getElementById('total-stops').textContent = 
        routeData.path.length;
    
    // Update steps list
    updateStepsList(routeData);
}

// Update the route steps list
function updateStepsList(routeData) {
    const stepsList = document.getElementById('steps-list');
    stepsList.innerHTML = '';
    
    routeData.path.forEach((locationId, index) => {
        const location = routeData.locations[locationId];
        const step = document.createElement('div');
        step.className = 'step-item';
        
        let icon = 'place';
        if (index === 0) icon = 'trip_origin';
        else if (index === routeData.path.length - 1) icon = 'flag';
        
        step.innerHTML = `
            <i class="material-icons">${icon}</i>
            <div>
                <strong>${location.name}</strong>
                ${location.amenities.length > 0 ? 
                    <br><small>${location.amenities.map(a => a.name).join(', ')}</small> 
                    : ''}
            </div>
        `;
        
        stepsList.appendChild(step);
    });
}

// Show/hide loading overlay
function showLoading(show) {
    document.getElementById('loading').classList.toggle('hidden', !show);
}

// Show error message
function showError(message) {
    alert(message);
}

// Event listeners
document.getElementById('find-route').addEventListener('click', findRoute);
document.getElementById('reset').addEventListener('click', () => {
    if (currentRoute) {
        paths.removeLayer(currentRoute);
        currentRoute = null;
    }
    document.getElementById('total-distance').textContent = '0 km';
    document.getElementById('total-time').textContent = '0 min';
    document.getElementById('total-stops').textContent = '0';
    document.getElementById('steps-list').innerHTML = '';
    document.getElementById('start').value = '';
    document.getElementById('end').value = '';
});

// Initialize the application
initialize
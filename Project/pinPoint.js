  const map = L.map('map').setView([23.1000, 72.6000], 13); // Anand coordinates
        
        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        
        // Add marker
        let marker = L.marker([23.1000, 72.6000], {
            draggable: true
        }).addTo(map);
        
        // Update coordinates when marker is moved
        marker.on('dragend', function() {
            updateCoordinateDisplay(marker.getLatLng());
        });
        
        // Add click event to map to place marker
        map.on('click', function(e) {
            // Remove existing marker
            if (marker) {
                map.removeLayer(marker);
            }
            
            // Add new marker at clicked position
            marker = L.marker(e.latlng, {
                draggable: true
            }).addTo(map);
            
            // Update coordinate display
            updateCoordinateDisplay(e.latlng);
            
            // Reverse geocode to get address
            reverseGeocode(e.latlng.lat, e.latlng.lng);
            
            // Add event listener to new marker
            marker.on('dragend', function() {
                updateCoordinateDisplay(marker.getLatLng());
            });
        });
        
        // Detect user's location
        document.getElementById('detectLocation').addEventListener('click', function() {
            if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition(
                    function(position) {
                        const userLocation = {
                            lat: position.coords.latitude,
                            lng: position.coords.longitude
                        };
                        
                        // Remove existing marker
                        if (marker) {
                            map.removeLayer(marker);
                        }
                        
                        // Add marker at user's location
                        marker = L.marker([userLocation.lat, userLocation.lng], {
                            draggable: true
                        }).addTo(map);
                        
                        // Update map view
                        map.setView([userLocation.lat, userLocation.lng], 16);
                        
                        // Update coordinate display
                        updateCoordinateDisplay(marker.getLatLng());
                        
                        // Reverse geocode to get address
                        reverseGeocode(userLocation.lat, userLocation.lng);
                        
                        // Add event listener to new marker
                        marker.on('dragend', function() {
                            updateCoordinateDisplay(marker.getLatLng());
                        });
                    },
                    function(error) {
                        alert("Unable to get your location. Please make sure location services are enabled.");
                        console.error("Geolocation error:", error);
                    }
                );
            } else {
                alert("Geolocation is not supported by your browser.");
            }
        });
        
        // Search for address
        document.getElementById('searchAddress').addEventListener('click', function() {
            const address = document.getElementById('addressInput').value.trim();
            
            if (address) {
                // Use Nominatim for geocoding (OpenStreetMap)
                fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`)
                    .then(response => response.json())
                    .then(data => {
                        if (data && data.length > 0) {
                            const location = data[0];
                            const lat = parseFloat(location.lat);
                            const lon = parseFloat(location.lon);
                            
                            // Remove existing marker
                            if (marker) {
                                map.removeLayer(marker);
                            }
                            
                            // Add marker at searched location
                            marker = L.marker([lat, lon], {
                                draggable: true
                            }).addTo(map);
                            
                            // Update map view
                            map.setView([lat, lon], 16);
                            
                            // Update coordinate display
                            updateCoordinateDisplay({lat: lat, lng: lon});
                            
                            // Update address display
                            document.getElementById('address').textContent = location.display_name;
                            
                            // Add event listener to new marker
                            marker.on('dragend', function() {
                                updateCoordinateDisplay(marker.getLatLng());
                            });
                        } else {
                            alert("Address not found. Please try a different search term.");
                        }
                    })
                    .catch(error => {
                        console.error("Geocoding error:", error);
                        alert("Error searching for address. Please try again.");
                    });
            } else {
                alert("Please enter an address to search.");
            }
        });
        
        // Confirm location button
        document.getElementById('confirmLocation').addEventListener('click', function() {
            const lat = marker.getLatLng().lat;
            const lng = marker.getLatLng().lng;
            const address = document.getElementById('address').textContent;
            
            // Save location data to session storage
            const locationData = {
                address: address,
                latitude: lat.toFixed(6),
                longitude: lng.toFixed(6)
            };
            
            sessionStorage.setItem('selectedLocation', JSON.stringify(locationData));
            
            alert(`✅ Location confirmed!\nLatitude: ${lat.toFixed(6)}\nLongitude: ${lng.toFixed(6)}\nAddress: ${address}`);
            
            // Return to the main form
            window.location.href = 'index.html#report';
        });
        
        // Function to update coordinate display
        function updateCoordinateDisplay(latlng) {
            document.getElementById('latitude').textContent = latlng.lat.toFixed(6) + '° N';
            document.getElementById('longitude').textContent = latlng.lng.toFixed(6) + '° E';
            
            // Reverse geocode to get address
            reverseGeocode(latlng.lat, latlng.lng);
        }
        
        // Function to reverse geocode coordinates to address
        function reverseGeocode(lat, lng) {
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`)
                .then(response => response.json())
                .then(data => {
                    if (data && data.display_name) {
                        document.getElementById('address').textContent = data.display_name;
                    }
                })
                .catch(error => {
                    console.error("Reverse geocoding error:", error);
                    document.getElementById('address').textContent = "Address not available";
                });
        }
        
        // Initialize coordinate display
        updateCoordinateDisplay(marker.getLatLng());
        reverseGeocode(23.1000, 72.6000);
        
        // Cancel button functionality
        document.getElementById('cancelButton').addEventListener('click', function() {
            window.location.href = 'index.html#report';
        });

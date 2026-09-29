window.initCampusMap = function () {
  const fallbackLocation = {
    lat: 16.4632,
    lng: 80.5064,
  };

  const map = new google.maps.Map(
    document.getElementById("campus-map"),
    {
      center: fallbackLocation,
      zoom: 17,
      streetViewControl: false,
      mapTypeControl: false,
    }
  );

  let userMarker = null;

  document.getElementById("map-status").textContent = "LIVE";

  if (!navigator.geolocation) {
    userMarker = new google.maps.Marker({
      position: fallbackLocation,
      map: map,
      title: "Demo location",
    });

    return;
  }

  navigator.geolocation.watchPosition(
    (position) => {
      const userLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      map.setCenter(userLocation);

      if (!userMarker) {
        userMarker = new google.maps.Marker({
          position: userLocation,
          map: map,
          title: "You are here",
        });
      } else {
        userMarker.setPosition(userLocation);
      }

      document.getElementById("map-status").textContent = "LIVE GPS";
    },

    () => {
      if (!userMarker) {
        userMarker = new google.maps.Marker({
          position: fallbackLocation,
          map: map,
          title: "Demo location",
        });
      }

      document.getElementById("map-status").textContent = "DEMO";
    },

    {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 10000,
    }
  );
};